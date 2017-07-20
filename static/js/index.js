/*
 * (C) Copyright 2014-2015 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var ws = new WebSocket(wsUrl);
var videoInput;
var videoOutput;
var webRtcPeer;
var pc;
var state = null;
var sender ;

const I_CAN_START = 0;
const I_CAN_STOP = 1;
const I_AM_STARTING = 2;

window.onload = function() {
	console.log('Page loaded ...');
	videoInput = document.getElementById('videoInput');
	videoOutput = document.getElementById('videoOutput');
	setState(I_CAN_START);
	$('.btndtmf').attr('onclick', 'sendDtmf(event)');
}

window.onbeforeunload = function() {
	ws.close();
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'startResponse':
		startResponse(parsedMessage);
		break;
	case 'error':
		if (state == I_AM_STARTING) {
			setState(I_CAN_START);
		}
		onError('Error message from server: ' + parsedMessage.message);
		break;
	case 'iceCandidate':
		webRtcPeer.addIceCandidate(parsedMessage.candidate)
		break;
	case 'stopFromBye':
			 $("#stop").trigger("click");
		break;
	default:
		if (state == I_AM_STARTING) {
			setState(I_CAN_START);
		}
		onError('Unrecognized message', parsedMessage);
	}
}

function start() {
	console.log('Starting video call ...')

	// Disable start button
	setState(I_AM_STARTING);
	showSpinner(videoInput, videoOutput);

	console.log('Creating WebRtcPeer and generating local sdp offer ...');

    var options = {
      localVideo: videoInput,
      remoteVideo: videoOutput,
      onicecandidate : onIceCandidate
    }

    webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function(error) {
        if(error) return onError(error);
				pc = webRtcPeer.peerConnection;
				if(dtmfTransport=="inband"){
								if ("getSenders" in  RTCPeerConnection.prototype){
										// Firefox Version
										var stream = pc.getSenders();
										var track = stream[0];
										sender = new DTMFSenderInband(stream[0]);
									}
									else {
										// Chrome Opera version
										var stream = pc.getLocalStreams();
										var videoTracks = stream[0].getVideoTracks();
										sender = new DTMFSenderInband(stream[0]);
										var audioTracks = sender.outputStream.getAudioTracks()
										pc.removeStream(stream[0]);
										var newTracks = [videoTracks[0],audioTracks[0]];
										var nStream = new MediaStream(newTracks);
										pc.addStream(nStream);
								}

				}
        this.generateOffer(onOffer);
    });
}


function onIceCandidate(candidate) {
	   console.log('Local candidate' + JSON.stringify(candidate));

	   var message = {
	      id : 'onIceCandidate',
	      candidate : candidate
	   };
	   sendMessage(message);
}

function onOffer(error, offerSdp) {
	if(error) return onError(error);


	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
		id : 'start',
		sdpOffer : offerSdp,
		to : $("#to").val(),
		from : $("#from").val()
	}
	sendMessage(message);
}

function onError(error) {
	console.error(error);
}

function startResponse(message) {
	setState(I_CAN_STOP);
	console.log('SDP answer received from server. Processing ...');
	webRtcPeer.processAnswer(message.sdpAnswer,onAnswerProcess);
}

function onAnswerProcess(){
	if (senderDTMFInband)
		senderDTMFInband.dtmf.ontonechange = function(e) {
								console.log(JSON.stringify(e));
							}
}

function stop() {
	console.log('Stopping video call ...');
	setState(I_CAN_START);
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;

		var message = {
			id : 'stop'
		}
		sendMessage(message);
	}
  hideSpinner(videoInput, videoOutput);
}

function setState(nextState) {
	state = nextState;
}

function sendDtmf(event){
	var target = event.target;
	if (target != undefined && target.innerText!= undefined){
		var dtmfValue = target.innerText;
		console.log("sendDTMF "+dtmfValue);

		if (dtmfTransport =="sip"){
			var message = {
				id : 'sendDtmf',
				dtmf : dtmfValue
			}
			sendMessage(message);
		}
		if (dtmfTransport=="rfc4733"){
			if (pc != undefined && pc.getSenders) {
				    var dtmfSender = pc.getSenders()[0].dtmf;
						if (dtmfSender){
							dtmfSender.ontonechange = handleToneChangeEvent;
							console.log("Sending DTMF: \"" + dtmfValue + "\"");
						  dtmfSender.insertDTMF(dtmfValue, 400, 50);
						}
				  }
			}
		}
		if(dtmfTransport=="inband"){
			  sender.insertDTMF(dtmfValue,400,50);
		}

}

function handleToneChangeEvent(event) {
	if (event.tone !== "") {
	    console.log("Tone played: " + event.tone);
	}
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Senging message: ' + jsonMessage);
	ws.send(jsonMessage);
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = 'center transparent url("./img/spinner.gif") no-repeat';
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
