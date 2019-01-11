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
var inbandsender ;

var defaultMute = false;
var audioTrack;
var videoTrack;

var audioSender;
var videoSender;

const I_CAN_START = 0;
const I_CAN_STOP = 1;
const I_AM_STARTING = 2;


var streamBlack;
var videoMuted;

var callFrom;
var callTo;


window.onload = function() {
	console.log('Page loaded ...');
	videoInput = document.getElementById('videoInput');
	videoOutput = document.getElementById('videoOutput');
	setState(I_CAN_START);
	$('.btndtmf').attr('onclick', 'sendDtmf(event)');
	$('#alertButton').click(function(){
		$("#alert").hide();
	});
	$('#micButton').click(function(){
		if(audioTrack){
			toggleAudio();
		}
	});
	$('#videoButton').click(function(){
		if (videoTrack){
			toggleVideo();
		}
	});
  var canvas = document.getElementById('canvasBlack');
	var ctx = canvas.getContext("2d");
	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, 10, 10);

	streamBlack = canvas.captureStream().getVideoTracks()[0];

  videoMuted = false;
}

function toggleAudio(){
	$("#micMuted").toggle();
	if (defaultMute){
		audioTrack.enabled = !audioTrack.enabled;
	}
	else {
		var sender = getAudioSender();
		if (sender == null)
			audioSender.replaceTrack(audioTrack);
		else {
			audioSender.replaceTrack(null)
		}
	}
}
function toggleVideo(){
	$("#videoMuted").toggle();
	$(".app_video_local_muted").toggle();
	if (defaultMute){
		videoTrack.enabled = !videoTrack.enabled;
	}
	else {
		var sender = getVideoSender();
		//videoTrack.enabled = !videoTrack.enabled;
		videoMuted = !videoMuted;
		//if (sender == null)
		if (!videoMuted)
			videoSender.replaceTrack(videoTrack)
		else {
			videoSender.replaceTrack(streamBlack);
		}
	}
}

function getAudioSender(){
	var sender = null;
	var senders = pc.getSenders();
	for (var i = 0 ;i<senders.length;i++){
		if (senders[i].track == audioTrack){
			sender=senders[i];
		}
	}
	return sender;
}

function getVideoSender(){
	var sender = null;
	var senders = pc.getSenders();
	for (var i = 0 ;i<senders.length;i++){
		if (senders[i].track == videoTrack){
			sender=senders[i];
		}
	}
	return sender;
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
		 setTimeout(function(){$("#stop").trigger("click");},2000);
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

function start(from,to) {
	console.log('Starting video call ...')

	callTo = to;
	callFrom = from;

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
										inbandsender = new DTMFSenderInband(stream[0]);
									}
									else {
										// Chrome Opera version
										var stream = pc.getLocalStreams();
										var videoTracks = stream[0].getVideoTracks();
										inbandsender = new DTMFSenderInband(stream[0]);
										var audioTracks = inbandsender.outputStream.getAudioTracks()
										pc.removeStream(stream[0]);
										var newTracks = [videoTracks[0],audioTracks[0]];
										var nStream = new MediaStream(newTracks);
										pc.addStream(nStream);
								}

			  }
				if ("getSenders" in  RTCPeerConnection.prototype){
					var RTCPSender = pc.getSenders();
					videoTrack = RTCPSender[1].track;
					audioTrack = RTCPSender[0].track;
				}
				else {
					var stream = pc.getLocalStreams();
					videoTrack = stream[0].getVideoTracks()[0];
					audioTrack = stream[0].getAudioTracks()[0];
				}

				audioSender = getAudioSender();
				videoSender = getVideoSender();
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
		to : callTo,
		from : callFrom
	}
	sendMessage(message);
}

function onError(error) {
	console.log(error);
	$("#errorBox").text(error);
	$("#alert").show();
}

function startResponse(message) {
	setState(I_CAN_STOP);
	console.log('SDP answer received from server. Processing ...');
	webRtcPeer.processAnswer(message.sdpAnswer,onAnswerProcess);
	hideSpinner(videoInput, videoOutput);
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

	$("#micMuted").hide();
	$("#videoMuted").hide();
	$(".app_video_local_muted").hide();
	videoMuted=false;

  displayEndPoster(videoInput, videoOutput);
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
			  inbandsender.insertDTMF(dtmfValue,400,50);
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
		arguments[i].poster = '';
		arguments[i].style.background = '';
	}
}

function displayEndPoster() {
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
