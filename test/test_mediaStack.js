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
