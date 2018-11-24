#!/bin/sh

echo "Start kurento"
sudo service kurento-media-server-6.0 start

echo "Start Dracthio"
sudo service drachtio-init-script start

echo "Done"

