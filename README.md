## Synopsis

This project is a basic WebRTC to SIP gateway. It uses drachtio for SIP signaling and Kurento for the Media Server.  

## Motivation

This gateway was made to easily connect a browser to any classic SIP endpoint like Softphone, PABX or MCU.
It was firstly designed to work with Asterisk.

## Installation

Firstly install  Kurento-media-server (with a cotrun server it's better) and drachtio server in your local host.

Next install node modules :
```bash
npm install
```

## Configuration
Change config.serverPublicIP in file config.js to expose public IP used for SIP sdp generation.

## To run
```bash
node server.js
```

Open https://localhost:8443/ and fill a userName and a destination number like 999@192.168.0.11 and click on Start Call.

Kurento-SIP-GW will send an invite to destination and connect media after call accept by remote end.


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
