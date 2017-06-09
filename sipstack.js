var drachtio = require('drachtio');
var appSip = drachtio() ;
var fs = require('fs') ;
var debug = require('debug')('basic') ;
var transform = require('sdp-transform');
var kill  = require('tree-kill');
var config = require('./config');

function getConnectionIp (sdpJson){
	return  sdpJson.connection.ip;
}


function getPortByType (sdpJson,type){
	var media = sdpJson.media;
	for (var i = 0 ; i < media.length ; i++){
		if (media[i].type == type){
			return media[i].port;
		}
	}
	return 0;
}



var SipStack = function () {};

   SipStack.appSip = drachtio();

	 SipStack.dialogs = {};
	 SipStack.sessionIds = {};
	 SipStack.sessionIdByCalls = {};
	 SipStack.requests = {};
	 SipStack.prototype.log = function () {
			 console.log('doo!');
	 }

	SipStack.kurentoPipelineRelease = function (sessionId) {
			console.log('Bad callback end') ;

	};

  SipStack.appSip.use('bye', function( req, res){
    	console.log('BYE recieved: %s', JSON.stringify(res) ) ;
    	var callId = res.msg.headers['call-id'];
    	console.log('BYE recieved: %s index %s' , JSON.stringify(res),callId ) ;
			// get sessionId
			var sessionId = SipStack.sessionIdByCalls[callId];
			SipStack.kurentoPipelineRelease(sessionId);
			var dialog =  SipStack.dialogs[sessionId];

			delete SipStack.sessionIds[dialog];
			delete SipStack.dialogs[sessionId];
			delete SipStack.sessionIdByCalls[callId];
    	res.send(200) ;
    }) ;

SipStack.prototype.init = function (callback){
  	SipStack.sipServerConnected = false;
		SipStack.kurentoPipelineRelease = callback;
	  SipStack.sessions = {};
    SipStack.appSip.connect(config.drachtio,
    function(err, hostport){
        if( err ) throw err ;
    		console.log("Connected to SIP server");
    		sipServerConnected = true;
    	}
    ) ;
}

SipStack.prototype.invite = function (sessionId,from,to,localSDP,callback){
  var sipDest = to;
  console.log("Send invite to "+ sipDest);
  if (sipServerConnected){
    SipStack.appSip.request({
              uri: "sip:"+sipDest,
              method: 'INVITE',
              headers: {
                  'User-Agent': 'dracht.io',
									'from': "sip:"+from
              },
              body: localSDP
          },
        function( err, req ){
          if( err ) {
             console.log('Error '+ err ) ;
             throw err;
           }
          console.log('sent request: %s', JSON.stringify(req) ) ;

          req.on('response', function(res,ack){
            console.log('received response with status: %s', res.status) ;
            console.log('recieved response: %s', JSON.stringify(res) ) ;

            if( res.status == 200) {
              var remoteSdpStr = res.body;
							remoteSdpStr+="\na=ptime:20";
              console.log('recieved response: %s', remoteSdpStr);
              console.log(req.msg.headers);
							console.log('dialogId recv: ', res.stackDialogId);
  						SipStack.dialogs[sessionId] = res.stackDialogId ;
							SipStack.sessionIds[res.stackDialogId] = sessionId;
              var callId = req.msg.headers["call-id"];
							SipStack.sessionIdByCalls[callId] = sessionId;
							delete SipStack.requests[sessionId];
              ack() ;
							console.log("Ack sended");
							return callback(null,remoteSdpStr);
            }

						else if (res.status >=300){
							  console.log('Invite rejected');
								SipStack.kurentoPipelineRelease(sessionId);
								return callback("reject",null);
						}
						else if (res.status < 200){
							  console.log('Intermediate repsonse');
								SipStack.requests[sessionId] = req ;
						}

        }) ;
      }
    );
    return "";
  }
  return "";
};

SipStack.prototype.bye =  function (sessionId,sdpLocal) {

		if (SipStack.requests[sessionId]!=undefined){
			SipStack.requests[sessionId].cancel();
		}
		else {
		var dialog = SipStack.dialogs[sessionId];
			if (dialog != undefined){
					SipStack.appSip.request({
	                method: 'BYE',
	                stackDialogId: dialog
	              }, function(err, req){
	  							if( err || req == undefined) {
										console.log(err);
										return;
									}
									var callId = req.msg.headers["call-id"];
									delete SipStack.sessionIds[dialog];
									delete SipStack.dialogs[sessionId];
									delete SipStack.sessionIdByCalls[callId];
             			req.on('response', function(response){
	                console.log('BYE '+response.status);
	                });
								}) ;
			}
	}
};


SipStack.prototype.response =  function (sessionId) {

};

SipStack.prototype.registerWebRTCEndpoint =  function (from) {

};

SipStack.prototype.registerSIP =  function (from,host,password) {

};

module.exports = new SipStack();
