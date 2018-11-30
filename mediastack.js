var util = require('util');

/*
 * Kurento media Stack
 */

 var kurento = require('kurento-client');
 var transform = require('sdp-transform');
 var config = require('./config');



 var MediaStack = function () {
   MediaStack.sessions = {};
   MediaStack.sip = null;
   MediaStack.candidatesQueue = {};
   MediaStack.kurentoClient = null;
 };

 MediaStack.prototype.init = function (sip){
   MediaStack.sip = sip;
 }

 MediaStack.prototype.start = function (sessionId, ws, from,to, sdpOffer, callback) {
     if (!sessionId) {
         return callback('Cannot use undefined sessionId');
     }
     MediaStack.sessions[sessionId]={
       'ws': ws
     };

    console.log(sessionId +"Concurent calls : " + Object.keys(MediaStack.sessions).length +"/"+ config.maxConcurentCalls + util.inspect(MediaStack.sessions) );
     if(Object.keys(MediaStack.sessions).length > config.maxConcurentCalls){

         return callback('Unable to start call due to server concurrent capacity limit');
     }
     getKurentoClient(function(error, kurentoClient) {
         if (error) {
             return callback(error);
         }

         kurentoClient.create('MediaPipeline', function(error, pipeline) {

             if (error) {
                 return callback(error);
             }

             createMediaElements(sessionId,pipeline, ws,from,to, function(error, webRtcEndpoint,rtpEndpoint) {
                 if (error) {
                     pipeline.release();
                     return callback(error);
                 }
                 console.log("Collect Candidates");
                 if (MediaStack.candidatesQueue[sessionId]) {
                     while(MediaStack.candidatesQueue[sessionId].length) {
                         var candidate = MediaStack.candidatesQueue[sessionId].shift();
                         webRtcEndpoint.addIceCandidate(candidate);
                     }
                 }
                 console.log("connect media element");
                 connectMediaElements(webRtcEndpoint,rtpEndpoint, function(error) {
                     if (error) {
                         pipeline.release();
                         return callback(error);
                     }

                     webRtcEndpoint.on('OnIceCandidate', function(event) {
                         var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
                         ws.send(JSON.stringify({
                             id : 'iceCandidate',
                             candidate : candidate
                         }));
                     });

                     webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
                         console.log("Sdp Answer WebRTC Endpoint " + sdpAnswer);
                         if (error) {
                             pipeline.release();
                             return callback(error);
                         }
                         MediaStack.sessions[sessionId].pipeline = pipeline;
                         MediaStack.sessions[sessionId].webRtcEndpoint = webRtcEndpoint;
                         return callback(null, sdpAnswer);
                     });

                     webRtcEndpoint.gatherCandidates(function(error) {
                         if (error) {
                             return callback(error);
                         }
                     });
                 });
               });
         });
     });
 }

// Recover kurentoClient for the first time.
function getKurentoClient(callback) {
    console.log("Get Kurento Client ");
    if (MediaStack.kurentoClient) {
        console.log(" Kurento Client not null ");
        return callback(null, MediaStack.kurentoClient);
    }

    kurento(config.kurento.ws_uri, function(error, _kurentoClient) {
        if (error) {
            console.log("Could not find media server at address " + config.kurento.ws_uri);
            return callback("Could not find media server at address" + config.kurento.ws_uri
                    + ". Exiting with error " + error);
        }
        MediaStack.kurentoClient = _kurentoClient;
        console.log(" Call Abck Kurento CLient ");
        callback(null, MediaStack.kurentoClient);
    });
}

function getIPAddress() {
  return config.serverPublicIP;
}

function replace_ip(sdp, ip) {
    if (!ip)
      ip = getIPAddress();
    console.log("IP " + ip);
    console.log("sdp init : "+sdp);

   var sdpObject = transform.parse(sdp);
   sdpObject.origin.address = ip;
   sdpObject.connection.ip = ip;
   var sdpResult = transform.write(sdpObject);
   console.log("sdp result : "+sdpResult);
   return sdpResult;
}

function mungleSDP(sdp){
  mugleSdp = sdp;
  var mugleSdp =  sdp.replace(new RegExp("RTP/AVPF", "g"),  "RTP/AVP");
  var h264Payload = MediaStack.sip.getH264Payload(sdp);
  mugleSdp+="a=fmtp:"+h264Payload+" profile-level-id=42801F\n";
  return mugleSdp;
}

function prettyJSON(obj) {
    console.log(JSON.stringify(obj, null, 2));
}

function createMediaElements(sessionId,pipeline, ws,from,to , callback) {
    pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
        if (error) {
            return callback(error);
        }

        pipeline.create('RtpEndpoint', function(error, rtpEndpoint){
            if (error) {
                return callback(error);
            }
            createSipCall(sessionId,from+"@"+getIPAddress(),to,rtpEndpoint,function(error){
                if (error) {
                  return callback(error);
                }

                return callback(null, webRtcEndpoint, rtpEndpoint);
            });

        });
    });
}

function connectMediaElements(webRtcEndpoint, rtpEndpoint,callback) {
    rtpEndpoint.connect(webRtcEndpoint, function(error) {
        if (error) {
            return callback(error);
        }
        webRtcEndpoint.connect(rtpEndpoint,function (error){
          if (error) {
              return callback(error);
          }
          return callback(null);
        });
    });
}

function createSipCall(sessionId,from,to,rtpEndpoint,callback){
      rtpEndpoint.generateOffer(function(error, sdpOffer) {
        var modSdp =  replace_ip(sdpOffer);
        modSdp = mungleSDP(modSdp);
        MediaStack.sip.invite (sessionId,from,to,modSdp,function (error,remoteSdp){
          if (error){
            return callback(error);
          }
          rtpEndpoint.processAnswer(remoteSdp,function(error){
            if (error){
              return callback(error);
            }
            // Insert EnCall timeout
            setTimeout(function(){
              console.log("EndCall Timeout "+sessionId);
              MediaStack.sip.bye(sessionId);stopFromBye(sessionId);}
              ,config.maxCallSeconds*1000);
            return callback(null);
          });
        });
      });
}

MediaStack.prototype.stop = function (sessionId) {
    MediaStack.sip.bye(sessionId);
    if (MediaStack.sessions[sessionId]) {
        var pipeline = MediaStack.sessions[sessionId].pipeline;
        if (pipeline != undefined){
          console.info('Releasing pipeline');
          pipeline.release();
        }
        delete MediaStack.sessions[sessionId];
        delete MediaStack.candidatesQueue[sessionId];
    }
}

MediaStack.prototype.stopFromBye =  function (sessionId) {
    if (MediaStack.sessions[sessionId]) {
      var ws = MediaStack.sessions[sessionId].ws;
      if (ws != undefined){
        ws.send(JSON.stringify({
            id : 'stopFromBye'
        }));
      }
      var pipeline = MediaStack.sessions[sessionId].pipeline;
      if (pipeline != undefined){
        console.info('Releasing pipeline');
        pipeline.release();
      }
      delete MediaStack.sessions[sessionId];
      delete MediaStack.candidatesQueue[sessionId];
    }
}

MediaStack.prototype.onIceCandidate = function (sessionId, _candidate) {
    var candidate = kurento.getComplexType('IceCandidate')(_candidate);
    if (MediaStack.sessions[sessionId]!=undefined && MediaStack.sessions[sessionId].webRtcEndpoint!=undefined) {
        console.info('Sending candidate');
        var webRtcEndpoint = MediaStack.sessions[sessionId].webRtcEndpoint;
        webRtcEndpoint.addIceCandidate(candidate);
    }
    else {
        console.info('Queueing candidate');
        if (!MediaStack.candidatesQueue[sessionId]) {
            MediaStack.candidatesQueue[sessionId] = [];
        }
        MediaStack.candidatesQueue[sessionId].push(candidate);
    }
}

function sendDtmf(sessionId, dtmf){
    MediaStack.sip.infoDtmf(sessionId,dtmf);
}


module.exports = new MediaStack();
