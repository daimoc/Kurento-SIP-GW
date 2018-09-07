const test = require('blue-tape');

var sip = require('../sipstack.js');


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('sendInviteRejected', (t) => {
  t.timeoutAfter(60000);

  Promise.resolve()
      .then(() => {
      return t.end();
    })
});

// init with drachtio-server running
test('intiWithDrachtio', (t) => {
  t.timeoutAfter(60000);
  Promise.resolve()
      .then(()){
        function kurentoPipelineRelease(sessionId){
          console.log('Stop session ID '+sessionId);
          stopFromBye(sessionId);
        };
        sip.init(kurentoPipelineRelease);
      })
      .then(() => {

      })
      .then(() => {
      return t.end();
    })
});
// init with drachtio-server stopped

// drachtio-server without active dialog

// drachtio-server restart with active dialog

// send Invite bad adresse

// send Invite accepted

// send Invite rejected

// send Invite timeout

// send bye

// recieve bye

// recieve invite out of a dialog

// recieve reINvite

// receive options

// send options

// receive message

// send message
