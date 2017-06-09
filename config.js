var config = {};

config.serverPublicIP = "192.168.0.17";

config.kurento =  {
        as_uri: 'https://localhost:8443/',
        ws_uri: 'ws://localhost:8888/kurento'
};

config.drachtio = {
  host: '127.0.0.1',
  port: 9022,
  secret: 'cymru',
  methods: ['invite','bye','option'],
}

module.exports = config;
