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

var path = require('path');
var url = require('url');
var cookieParser = require('cookie-parser')
var express = require('express');
var session = require('express-session')
var minimist = require('minimist');
var ws = require('ws');
var fs    = require('fs');
var https = require('https');
var sip = require('./sipstack.js');
var media = require('./mediastack.js');
var config = require('./config');
var uuid = require('uuid/v1');
var util = require('util');

var options =
{
  key:  fs.readFileSync('keys/server.key'),
  cert: fs.readFileSync('keys/server.crt')
};

var app = express();

/*
 * Management of sessions
 */
app.use(cookieParser());

var sessionHandler = session({
    secret : 'none',
    rolling : true,
    resave : true,
    saveUninitialized : true
});

app.use(sessionHandler);

/*
 * Server startup
 */
var asUrl = url.parse(config.kurento.as_uri);
var port = asUrl.port;
var server = https.createServer(options, app).listen(port, function() {
    console.log('Kurento SIP GW');
    console.log('Open ' + url.format(asUrl) + ' with a WebRTC capable browser');
    console.log('Call timeout ' + config.maxCallSeconds + ' seconds');
    console.log('Maximum concurent calls ' + config.maxConcurentCalls);
});


function kurentoPipelineRelease(sessionId){
  console.log('Stop session ID '+sessionId);
  media.stopFromBye(sessionId);
}

sip.init(kurentoPipelineRelease);
media.init(sip);
sip.setMediaSatck(media);




var wss = new ws.Server({
    server : server,
    path : '/sip-gw'
});

/*
 * Management of WebSocket messages
 */
wss.on('connection', function(ws) {
    var sessionId = null;
    var request = ws.upgradeReq;
    var response = {
        writeHead : {}
    };

    sessionHandler(request, response, function(err) {
        sessionId = uuid();
        console.log('Connection received with sessionId ' + sessionId);
    });

    ws.on('error', function(error) {
        console.log('Connection ' + sessionId + ' error');
        media.stop(sessionId);
    });

    ws.on('close', function() {
        console.log('Connection ' + sessionId + ' closed');
        media.stop(sessionId);
    });

    ws.on('message', function(_message) {
        var message = JSON.parse(_message);
        console.log('Connection ' + sessionId + ' received message ', message);
        switch (message.id) {
        case 'start':
            media.start(sessionId, ws, message.from,message.to,message.sdpOffer, function(error, sdpAnswer) {
                if (error) {
                    return ws.send(JSON.stringify({
                        id : 'error',
                        message : error
                    }));
                }
                ws.send(JSON.stringify({
                    id : 'startResponse',
                    sdpAnswer : sdpAnswer
                }));
            });
            break;
        case 'stop':
            media.stop(sessionId);
            break;
        case 'onIceCandidate':
            media.onIceCandidate(sessionId, message.candidate);
            break;
        case 'sendDtmf':
            media.sendDtmf(sessionId, message.dtmf);
            break;
        case 'renegotiateResponse':
            media.renegotiateResponse(sessionId,message.answerSdp);
            break;
        default:
            ws.send(JSON.stringify({
                id : 'error',
                message : 'Invalid message ' + message
            }));
            break;
        }
    });
});

app.use(express.static(path.join(__dirname, 'static')));
