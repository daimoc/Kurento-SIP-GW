/*
 * DTMFSender.js
 *
 * This serves as a polyfill that adds a DTMF sender interface to the
 * RTCRTPSender objects on RTCRTPPeerConnecions for Firefox 44 and later.
 * Implementations simply include this file, and then use the DTMF sender
 * as described in the WebRTC specification.
 *
 * For versions of Firefox prior to 44, implementations need to manually
 * instantiate a version of the DTMFSender object, pass it a stream, and
 * then retreive "outputStream" from the sender object. Implmentations
 * may also choose to attach the sender to the corresponding RTCRTPSender,
 * if they wish.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://mozilla.org/MPL/2.0/.
 */


// The MediaStream enhancements we need to make a polyfill work landed
// at the same time as the "addTrack" method as added to MediaStream.
// If this is possible, we monkeypatch ourselves into RTCPeerConnection.addTrack
// so thatwe attach a new DTMF sender to each RTP Sender as they are created.

var senderDTMFInband;



function DTMFSenderInband(senderOrStream) {
  var ctx = this._audioCtx = new AudioContext();
  this._outputStreamNode = ctx.createMediaStreamDestination();
  var outputStream = this._outputStreamNode.stream;

  var inputStream;
  var rtpSender = null;

  if ("track" in senderOrStream) {
    rtpSender = senderOrStream;
    inputStream = new MediaStream([rtpSender.track]);
  } else {
    inputStream = senderOrStream;
    this.outputStream = outputStream;
  }

  this._source = ctx.createMediaStreamSource(inputStream);
  this._source.connect(this._outputStreamNode);

  this._f1Oscillator = ctx.createOscillator();
  this._f1Oscillator.connect(this._outputStreamNode);
  this._f1Oscillator.frequency.value = 0;
  this._f1Oscillator.start(0);

  this._f2Oscillator = ctx.createOscillator();
  this._f2Oscillator.connect(this._outputStreamNode);
  this._f2Oscillator.frequency.value = 0;
  this._f2Oscillator.start(0);

  if (rtpSender) {
    rtpSender.replaceTrack(outputStream.getAudioTracks()[0])
      .then(function() {
        rtpSender.dtmf = this;
      }.bind(this));
  }
}

/* Implements the same interface as RTCDTMFSender */
DTMFSenderInband.prototype = {

  ontonechange: undefined,

  get duration() {
    return this._duration;
  },

  get interToneGap() {
    return this._interToneGap;
  },

  get toneBuffer() {
    return this._toneBuffer;
  },

  insertDTMF: function(tones, duration, interToneGap) {
    if (/[^0-9a-d#\*,]/i.test(tones)) {
      throw(new Error("InvalidCharacterError"));
    }

    this._duration = Math.min(6000, Math.max(40, duration || 100));
    this._interToneGap = Math.max(40, interToneGap || 70);
    this._toneBuffer = tones;

    if (!this._playing) {
      setTimeout(this._playNextTone.bind(this), 0);
      this._playing = true;
    }
  },

  /* Private */
  _duration: 100,
  _interToneGap: 70,
  _toneBuffer: "",
  _f1Oscillator: null,
  _f2Oscillator: null,
  _playing: false,

  _freq: {
    "1": [ 1209, 697 ],
    "2": [ 1336, 697 ],
    "3": [ 1477, 697 ],
    "a": [ 1633, 697 ],
    "4": [ 1209, 770 ],
    "5": [ 1336, 770 ],
    "6": [ 1477, 770 ],
    "b": [ 1633, 770 ],
    "7": [ 1209, 852 ],
    "8": [ 1336, 852 ],
    "9": [ 1477, 852 ],
    "c": [ 1633, 852 ],
    "*": [ 1209, 941 ],
    "0": [ 1336, 941 ],
    "#": [ 1477, 941 ],
    "d": [ 1633, 941 ]
  },

  _playNextTone: function() {
    if (this._toneBuffer.length == 0) {
      this._playing = false;
      this._f1Oscillator.frequency.value = 0;
      this._f2Oscillator.frequency.value = 0;
      if (this.ontonechange) {
        this.ontonechange({tone: ""});
      }
      return;
    }

    var digit = this._toneBuffer.substr(0,1);
    this._toneBuffer = this._toneBuffer.substr(1);

    if (this.ontonechange) {
      this.ontonechange({tone: digit});
    }

    if (digit == ',') {
      setTimeout(this._playNextTone.bind(this), 2000);
      return;
    }

    var f = this._freq[digit.toLowerCase()];
    if (f) {
      this._f1Oscillator.frequency.value = f[0];
      this._f2Oscillator.frequency.value = f[1];
      setTimeout(this._stopTone.bind(this), this._duration);
    } else {
      // This shouldn't happen. If it does, just move on.
      setTimeout(this._playNextTone.bind(this), 0);
    }
  },

  _stopTone: function() {
    this._f1Oscillator.frequency.value = 0;
    this._f2Oscillator.frequency.value = 0;
    setTimeout(this._playNextTone.bind(this), this._interToneGap);
  }
};
