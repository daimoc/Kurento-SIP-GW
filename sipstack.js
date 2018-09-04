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
	 SipStack.localSDP = {};
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
			delete SipStack.localSDP[sessionId];
    	res.send(200) ;
    }) ;

	SipStack.appSip.use('invite', function( req, res){
    	console.log('INviTE recieved: %s', JSON.stringify(res) ) ;
    	var callId = res.msg.headers['call-id'];
    	console.log('INVITE recieved: %s index %s' , JSON.stringify(res),callId ) ;
			// get sessionId
			var sessionId = SipStack.sessionIdByCalls[callId];
			if (sessionId){
				var dialog =  SipStack.dialogs[sessionId];
				res.send( 200,{
        	body: SipStack.localSDP[sessionId]
    		}) ;
			}
			else
				res.send(404) ;
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
	console.log("Send  local SDP to "+ localSDP);

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
             return callback("reject",null);
           }
          console.log('sent request: %s', JSON.stringify(req) ) ;

          req.on('response', function(res,ack){
            console.log('received response with status: %s', res.status) ;
            console.log('recieved response: %s', JSON.stringify(res) ) ;

            if( res.status == 200) {
              var remoteSdpStr = res.body;
							remoteSdpStr+="a=ptime:20";
							var h264Payload = getH264Payload(remoteSdpStr);
						  remoteSdpStr =  remoteSdpStr.replace(new RegExp("a=rtcp-fb:\\*", "g"),  "a=rtcp-fb:"+h264Payload);
              console.log('recieved response: %s', remoteSdpStr);
              console.log(req.msg.headers);
							console.log('dialogId recv: ', res.stackDialogId);
  						SipStack.dialogs[sessionId] = res.stackDialogId ;
							SipStack.localSDP[sessionId] = localSDP;

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
									delete SipStack.localSDP[sessionId];
             			req.on('response', function(response){
	                console.log('BYE '+response.status);
	                });
								}) ;
			}
	}
};

SipStack.prototype.infoDtmf =  function (sessionId,dtmf) {

		var dialog = SipStack.dialogs[sessionId];
		if (dialog != undefined){
				var messageBody="Signal="+dtmf+"\r\nDuration=160\r\n";
				SipStack.appSip.request({
                method: 'INFO',
                stackDialogId: dialog,
								headers: {
									  'User-Agent': 'dracht.io',
										'Content-Type': 'application/dtmf-relay'
								},
								body: messageBody
              }, function(err, req){

								if(req!=undefined)
									console.log('sent request: %s', JSON.stringify(req) ) ;


  							if( err || req == undefined) {
									console.log(err);
									console.log(req);
									return;
								}
           			req.on('response', function(response){
                	console.log('INFO '+response.status);
                });
							}) ;
		}
};


SipStack.prototype.response =  function (sessionId) {

};

SipStack.prototype.registerWebRTCEndpoint =  function (from) {

};

SipStack.prototype.registerSIP =  function (from,host,password) {

};

function getH264Payload(sdp){
	var sdpObject = transform.parse(sdp);
//	if (sdpObject.media.length < 2)
	//	return 0;
	console.log("RTP lenght"+sdpObject.media[1].rtp.length);
	var newRTP = [];
	for (var i=0; i < sdpObject.media[1].rtp.length ; i++){
		console.log("Media 1 Codec  : "+sdpObject.media[1].rtp[i].codec);
		if (sdpObject.media[1].rtp[i].codec=="H264"){
				newRTP.push(sdpObject.media[1].rtp[i]);
				break;
		}
	}
	var h264Payload=newRTP[0].payload;
	return h264Payload;
}

/*Asuming a classic sdp with media[1] as the only video media*/
SipStack.prototype.getH264Payload = getH264Payload;

module.exports = new SipStack();
