## Synopsis

This project is a basic WebRTC to SIP gateway. It uses [drachtio](https://github.com/davehorton/drachtio) for SIP signaling and [Kurento](https://www.kurento.org/) for the Media Server.
This node application was made using [Kurent-tutorial-node/helloworld](https://github.com/Kurento/kurento-tutorial-node/tree/master/kurento-hello-world).
Html client UI is made using Login/Logout Animation Concept by Nikolay Talanov
http://codepen.io/suez/pen/dPqxoM.

## Motivation

This gateway was made to easily connect a browser to any classic SIP endpoint like Softphone, PABX or MCU.
It was firstly designed to work with Asterisk and it works with it.

## Installation on Ubuntu 14.04

First, install  [Kurento-media-server](https://github.com/Kurento/kurento-media-server) (with a coturn server it's better) :

```bash
echo "deb http://ubuntu.kurento.org trusty kms6" | sudo tee /etc/apt/sources.list.d/kurento.list
wget -O - http://ubuntu.kurento.org/kurento.gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install kurento-server
```

Now, install [coturn](http://doc-kurento.readthedocs.io/en/stable/faq.html)
```bash
sudo apt-get install coturn
```

Edit cotrun startup script /etc/init.d/coturn

* If you're behind a NAT add :
```bash
EXTERNAL_IP=$(curl http://169.254.169.254/latest/meta-data/public-ipv4)
LOCAL_IP=$(curl http://169.254.169.254/latest/meta-data/local-ipv4)

DAEMON_ARGS="-c /etc/turnserver.conf -f -o -a -v -r kurento.org
-u kurento:kurento --no-stdout-log --external-ip $EXTERNAL_IP/$LOCAL_IP"
```


Next, install  [drachtio-server](https://github.com/davehorton/drachtio-server) :

Note : we must install devlop branch to support sip info.

```bash
sudo apt-get install autotool automake libtool-bin g++
git clone --depth=50 --branch=develop git://github.com/davehorton/drachtio-server.git && cd drachtio-server
git submodule update --init --recursive
./bootstrap.sh
mkdir build && cd $_
../configure CPPFLAGS='-DNDEBUG'
make
sudo make install
# Put Drachtio as a Deamon service with sytemd
cp drachtio-server.service /etc/systemd/system
# Put Drachtio as a Deamon service with init.d
cp drachtio-init-script /etc/systemd/system


cd ../..
cp drachtio-conf.xml /etc

#start service
service drachtio-server start
#or
service drachtio-init-script start
```

And finally, install node modules :
```bash
npm install
```

## Server Configuration
Change config.serverPublicIP in file config.js to expose external  public IP used for SIP sdp generation.

* config.kurento.as_uri is for HTTPS node server, default=8443.
* config.kurento.ws_uri is for Kurento-media-sever uri, default='ws://localhost:8888/kurento'
* config.maxCallSeconds is for Call time limitation to control and limit long call usage (Demo server is limited to 60 seconds calls)
* config.maxConcurentCalls is for limiting max concurrent call on a server.

## Client Configuration
Change client gateway option in static/js/config_client.js

* wsUrl : Kurneto-SIP-GW websocket server URL (default to 'wss://' + location.host + '/sip-gw' ).

* dtmfTransport : "inband" for audio inband DTMF || "sip"  for SIP INFO dtmf (Default to inband).


## To run
```bash
node server.js
```

Open https://localhost:8443/ and fill a userName and a destination number like 999@192.168.0.11 and click on Start Call.

Kurento-SIP-GW will send an invite to destination and connect media after call accept by remote end.
## Tested with
* linphone
* asterisk 11 video echo diaplan application

## Current Limitations

* Only a SIP inviter to other endpoint
* No STUN/TURN/ICE support on SIP/RTP side
* DTMF sending only not receiving

## Roadmap

 0. Provide Demo ready server
 1. Add RFC 4733 DTMF sending support
 2. Add SIP REGISTER
 3. Add incoming call support
 4. Codec selection
 5. Call control API and administrator UI
 6. Build unit Test
 7. Run load Test


## Contributors
Damien Fétis

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
