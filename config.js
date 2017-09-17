var config = {};

// Server exposeed external  public IP used for SIP sdp generation.
config.serverPublicIP = "192.168.0.17";

// Kurento WebRTC media server specific option
config.kurento =  {
        as_uri: 'https://localhost:8443/',
        ws_uri: 'ws://localhost:8888/kurento'
};

// Drachtio SIP server specific options
config.drachtio = {
  host: '127.0.0.1',
  port: 9022,
  secret: 'cymru',
  methods: ['invite','bye','option'],
}

// Limite max call time to 60 seconds
config.maxCallSeconds = 60;

// Maximum concurrent calls supported by the server, every new startcalls will be rejected after this limit
config.maxConcurentCalls = 1;

module.exports = config;
