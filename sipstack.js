var drachtio = require('drachtio');
var appSip = drachtio() ;
var debug = require('debug')('basic') ;
var transform = require('sdp-transform');
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
	 SipStack.res = {};
	 SipStack.sessionIds = {};
	 SipStack.sessionIdByCalls = {};
	 SipStack.requests = {};
	 SipStack.localSDP = {};
	 SipStack.options = {};
	 SipStack.mediastack = null;
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

			console.log(req.body);
    	var callId = res.msg.headers['call-id'];
    //	console.log('INVITE recieved: %s index %s' , JSON.stringify(req),callId ) ;
			// get sessionId


			var sessionId = SipStack.sessionIdByCalls[callId];
			if (sessionId){
				var remoteSdpStr = req.body;
				var dialog =  SipStack.dialogs[sessionId];
				var options = 	SipStack.options[sessionId];
				if (options.renegotiate == "none"){
					res.send( 200,{
						body: SipStack.localSDP[sessionId]
					});
				}
				else if (options.renegotiate == "rtp-webrtc"){
					SipStack.mediastack.renegotiateRTP(sessionId,remoteSdpStr,function(err,newLocalSdp){
						console.log("RTP renegotiated");
						if (err) {
							console.log(err);
							return;
						}
						SipStack.res[sessionId] = res;
						SipStack.localSDP[sessionId] = newLocalSdp;
						SipStack.mediastack.renegotiateWebRTC(sessionId,function(err){
									console.log("WebRTC renegotiated");
						});
					});
				}
				else if (!options || !options.renegotiate || options.renegotiate == "rtp"){ // Default renegotiate only RTP
					SipStack.mediastack.renegotiateRTP(sessionId,remoteSdpStr,function(err,newLocalSdp){
						console.log("RTP renegotiated");
						if (err) {
							console.log(err);
							return;
						}
						SipStack.localSDP[sessionId] = newLocalSdp;
						res.send( 200,{
							body: SipStack.localSDP[sessionId]
						},function(){
							setTimeout( () => {SipStack.mediastack.reconnect(sessionId);},500);
						});
					});
				}
			}
			else
				res.send(404) ;
	 });


SipStack.prototype.reponseToReInvite = function (sessionId){
		if (SipStack.res[sessionId]){
			console.log("Send 200 OK"+SipStack.localSDP[sessionId]);
			SipStack.res[sessionId].send( 200,{
				body: SipStack.localSDP[sessionId]},function(){
					//SipStack.mediastack.reconnect(sessionId);
						setTimeout( () => {SipStack.mediastack.reconnect(sessionId);},500);
				});
		}
}

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

SipStack.prototype.invite = function (sessionId,from,to,localSDP,options,callback){


	console.log('Mediastack in sip id=' + SipStack.mediastack.id);

	var sipDest = to;
  console.log("Send invite to "+ sipDest);
	console.log("Send  local SDP to "+ localSDP);
	console.log("Invite options"+ options);


	if (sipDest.indexOf("sip:")!=0)
		sipDest="sip:"+sipDest;
	if (from.indexOf("sip:")!=0)
			from="sip:"+from;

  if (sipServerConnected){
    SipStack.appSip.request({
              uri: sipDest,
              method: 'INVITE',
              headers: {
                  'User-Agent': 'dracht.io',
									'from': from
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
							SipStack.options[sessionId] = options;
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
									delete SipStack.options[sessionId];
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
	var h264Payload=0;
	if (newRTP.length > 0)
		h264Payload = newRTP[0].payload;

	return h264Payload;
}


SipStack.prototype.setMediaSatck = function (media){
	SipStack.mediastack = media;
}


/*Asuming a classic sdp with media[1] as the only video media*/
SipStack.prototype.getH264Payload = getH264Payload;

module.exports = new SipStack();
