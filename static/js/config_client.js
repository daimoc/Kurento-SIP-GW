// Gateway Cnnfiguration
var wsUrl = 'wss://' + location.host + '/sip-gw';
//var dtmfTransport ="inband";
var dtmfTransport ="sip";

// Renegotiate mode are how SIP calls deals with remote re-invite
// none = only reply to sip but not vhnage on the media stack
// rtp = Restart the rtp connection part on media stack (default value)
// rtp-webrtc = Restart the rtp connection part on media stack and restart the peerconnectino on browser part  
var renegotiateMode = "rtp"
