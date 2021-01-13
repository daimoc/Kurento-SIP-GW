## Synopsis

This project is a basic WebRTC to SIP gateway. It uses [drachtio](https://github.com/davehorton/drachtio) for SIP signaling and [Kurento](https://www.kurento.org/) for the Media Server.
This node application was made using [Kurent-tutorial-node/helloworld](https://github.com/Kurento/kurento-tutorial-node/tree/master/kurento-hello-world).
Html client UI is made using Login/Logout Animation Concept by Nikolay Talanov
http://codepen.io/suez/pen/dPqxoM.

## Motivation

This gateway was made to easily connect a browser to any classic SIP endpoint like Softphone, PABX or MCU.
It was firstly designed to work with Asterisk and it works with it.

## Architecture
![Kurento-SIP-GW architecture](https://raw.githubusercontent.com/daimoc/Kurento-SIP-GW/master/archi.png "Kurento-SIP-GW architecture")

## Installation on Ubuntu 18.04

First, install  [Kurento-media-server](https://github.com/Kurento/kurento-media-server) (with a coturn server it's better) :

```bash
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 5AFA7A83
source /etc/upstream-release/lsb-release 2>/dev/null || source /etc/lsb-release

sudo tee "/etc/apt/sources.list.d/kurento.list" >/dev/null <<EOF
# Kurento Media Server - Release packages
deb [arch=amd64] http://ubuntu.openvidu.io/6.15.0 bionic kms6
EOF

sudo apt-get update && sudo apt-get install --no-install-recommends --yes \
    kurento-media-server

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
sudo apt-get install autoconf automake libtool-bin g++ libcurl4-openssl-dev libssl-dev
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


Install nodejs 8 LTS vesion :
```bash
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
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

* renegotiateMode : set how SIP calls deals with remote re-invite
  - none = only reply to SIP  but not change anything in media stack
  - rtp = restart the rtp connection part on media stack (default value)
  - rtp-webrtc = restart the rtp connection part on media stack and restart the peerconnectino on browser part  


## To run
```bash
node server.js
```
Open https://localhost:8443/ and fill a userName and a destination number like 999@192.168.0.11 and click on Start Call.

Kurento-SIP-GW will send an invite to destination and connect media after call accept by remote end.

## Reduce CPU usage by disabling H264 encoding in Kurento
By removing VP8 support in Kurento server configuration you can disable h264 encoding and reduce  CPU usage by a factor 4  (from 40% to 10% of 1 core on a i7-7820HQ CPU per call).

Take care that removing transcoding in Kurento add some stability issues (Maybe due to keyframe generation on browser side).

First install openh264 gstreamer plugin
```bash
sudo apt-get install openh264-gst-plugins-bad-1.5
```
Then remove vp8 from /etc/kurento/modules/kurento/SdpEndpoint.conf.json by commenting VP8 line  "name" : "VP8/90000" in VideoCodecs Array.

Restart Kurento
```bash
sudo kurent-mediaserver-6.0 restart
```

## Tested with
* Linphone
* Asterisk 11 video echo diaplan application
* Scopia Elite 6000 Series MCU - Avaya
* Cisco MSE 8000 Series MCU

## Current Limitations

* Only a SIP inviter to other endpoint
* No STUN/TURN/ICE support on SIP/RTP side
* DTMF sending only not receiving

## Roadmap

 0. Provide Demo ready server (still waiting  purchasing department agreement....)
 1. Codec selection
 2. Call control API and administrator UI
 3. Build unit Test

Not planified yet :

 4. Run load Test
 5. Add RFC 4733 DTMF sending support
 6. Add SIP REGISTER
 7. Add incoming call support


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
