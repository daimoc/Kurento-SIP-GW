
/*
 * Kurento media Stack
 */

 var kurento = require('kurento-client');
 var transform = require('sdp-transform');


 var MediaStack = function () {
   this.sessions = {};
   this.sip = null;
   this.candidatesQueue = {};
   this.kurentoClient = null;
   this.config = null;
 };

 MediaStack.prototype.init = function (config,sip){
   this.sip = null;
   this.config=config;
 }

 MediaStack.prototype.start = function (sessionId, ws, from,to, sdpOffer, callback) {
     if (!sessionId) {
         return callback('Cannot use undefined sessionId');
     }
     this.sessions[sessionId]={
       'ws': ws
     };

    console.log(sessionId +"Concurent calls : " + Object.keys(sessions).length +"/"+ config.maxConcurentCalls + util.inspect(sessions) );
     if(Object.keys(sessions).length > config.maxConcurentCalls){

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
                 if (this.candidatesQueue[sessionId]) {
                     while(this.candidatesQueue[sessionId].length) {
                         var candidate = this.candidatesQueue[sessionId].shift();
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
                         this.sessions[sessionId].pipeline = pipeline;
                         this.sessions[sessionId].webRtcEndpoint = webRtcEndpoint;
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
    if (kurentoClient !== null) {
        return callback(null, kurentoClient);
    }

    kurento(config.kurento.ws_uri, function(error, _kurentoClient) {
        if (error) {
            console.log("Could not find media server at address " + config.kurento.ws_uri);
            return callback("Could not find media server at address" + config.kurento.ws_uri
                    + ". Exiting with error " + error);
        }

        kurentoClient = _kurentoClient;
        callback(null, kurentoClient);
    });
}

function getIPAddress() {
  return this.config.serverPublicIP;
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
  var h264Payload = this.sip.getH264Payload(sdp);
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
        this.sip.invite (sessionId,from,to,modSdp,function (error,remoteSdp){
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
              this.sip.bye(sessionId);stopFromBye(sessionId);}
              ,config.maxCallSeconds*1000);
            return callback(null);
          });
        });
      });
}

MediaStack.prototype.stop = function (sessionId) {
    this.sip.bye(sessionId);
    if (this.sessions[sessionId]) {
        var pipeline = this.sessions[sessionId].pipeline;
        if (pipeline != undefined){
          console.info('Releasing pipeline');
          pipeline.release();
        }
        delete this.sessions[sessionId];
        delete this.candidatesQueue[sessionId];
    }
}

MediaStack.prototype.stopFromBye =  function (sessionId) {
    if (this.sessions[sessionId]) {
      var ws = this.sessions[sessionId].ws;
      if (ws != undefined){
        ws.send(JSON.stringify({
            id : 'stopFromBye'
        }));
      }
      var pipeline = this.sessions[sessionId].pipeline;
      if (pipeline != undefined){
        console.info('Releasing pipeline');
        pipeline.release();
      }
      delete this.sessions[sessionId];
      delete this.candidatesQueue[sessionId];
    }
}

MediaStack.prototype.onIceCandidate = function (sessionId, _candidate) {
    var candidate = kurento.getComplexType('IceCandidate')(_candidate);
    if (this.sessions[sessionId]!=undefined && this.sessions[sessionId].webRtcEndpoint!=undefined) {
        console.info('Sending candidate');
        var webRtcEndpoint = sessions[sessionId].webRtcEndpoint;
        webRtcEndpoint.addIceCandidate(candidate);
    }
    else {
        console.info('Queueing candidate');
        if (!this.candidatesQueue[sessionId]) {
            this.candidatesQueue[sessionId] = [];
        }
        this.candidatesQueue[sessionId].push(candidate);
    }
}

function sendDtmf(sessionId, dtmf){
    this.sip.infoDtmf(sessionId,dtmf);
}

MediaStack.prototype.kurentoPipelineRelease = function (sessionId){
  console.log('Stop session ID '+sessionId);
  this.stopFromBye(sessionId);
}
module.exports = new MediaStack();
