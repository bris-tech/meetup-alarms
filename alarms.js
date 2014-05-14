var Trello = require('node-trello');
var nodemailer = require("nodemailer");
var trelloKey = '698e58f291aaec1fdb8ff04ef21f9381';

if (!process.env['TRELLO_TOKEN']) {
  console.error('Please authorise this application at https://trello.com/1/connect?name=Bristech%20Meetup%20Alarms&expiration=never&response_type=token&key=' + trelloKey);
  process.exit(1);
}

var t = new Trello(trelloKey, process.env['TRELLO_TOKEN']);
var now = Date.now();
var yesterday = new Date(now - (1000 * 60 * 60 * 24)).toISOString();
var eightWeeks = new Date(now + (1000 * 60 * 60 * 24 * 7 * 8)).toISOString();

var times = {
  'day after': (1000 * 60 * 60 * 24) * -1,
  'on the day': (1000 * 60 * 60 * 24),
  'week before': (1000 * 60 * 60 * 24 * 7)
};


var todo = /^(day after|on the day|week before|(\d+) weeks before)/i;

var smtpTransport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: "bristechmeetup@gmail.com",
        pass: process.env['GMAIL_PASSWORD']
    }
});

process.on('exit', smtpTransport.close);

function processCardChecklists(cardName, cardDue, cardURL) {
  return function(err, data) {
    if (err) throw err;

    var needsDoing = [];

    for (var i = 0, checklist; checklist = data[i]; i++) {
      var match = todo.exec(checklist.name);
      if (match) {
        var comparison;
        if (match[2]) {
          var weeks = parseInt(match[2], 10);
          comparison = times['week before'] * weeks;
        } else {
          comparison = times[match[1].toLowerCase()];
        }
        if ((comparison < 0 && cardDue < now + comparison) || (cardDue > now && cardDue < now + comparison)) {
          for (var j = 0, checkItem; checkItem = checklist.checkItems[j]; j++) {
            if (checkItem.state === 'incomplete') {
              needsDoing.push(checkItem.name);
            }
          }
        }
      }
    }

    if (needsDoing.length > 0) {
      var email = {
        from: 'Bristech <bristechmeetup@gmail.com>',
        to: 'james@briste.ch, nic@briste.ch, sam@briste.ch, chris@briste.ch',
        subject: 'Bristech TODO',
        text: 'The following items need doing for ' + cardName + ':\n\n' + needsDoing.join('\n'),
        html: '<p>The following items need doing for <a href="' + cardURL + '">' + cardName + '</a></p><ul><li>' + needsDoing.join('</li><li>') + '</li></ul>'
      }
      smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log(error);
        }else{
            console.log("Message sent: " + response.message);
        }
      });
    }
  };
}

t.get("/1/boards/VcltdZag/cards", { since: today, before: eightWeeks, fields: 'name,due' }, function(err, data) {
  if (err) throw err;
  for (var i = 0, card; card = data[i]; i++) {
    t.get('/1/cards/' + card.id + '/checklists', { fields: 'name', card_fields: 'due' }, processCardChecklists(card.name, Date.parse(card.due).getTime()));
  }
})
