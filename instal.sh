#!/bin/sh

echo "Kurent SIP gateway basic sh script installation for Ubuntu 16"
echo "Start"

echo "Installation of basic element"

sudo apt-get -y install git nodejs autotool automake libtool-bin g++

echo "Installation of Kurento"

echo "deb http://ubuntu.kurento.org xenial kms6" | sudo tee /etc/apt/sources.list.d/kurento.list
wget -O - http://ubuntu.kurento.org/kurento.gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install kurento-server

echo "Installation of coturn"
sudo apt-get install coturn

echo "Installation of Drachtio"
git clone --depth=50 --branch=develop git://github.com/davehorton/drachtio-server.git && cd drachtio-server
git submodule update --init --recursive
./bootstrap.sh
mkdir build && cd $_
../configure CPPFLAGS='-DNDEBUG'
make
sudo make install

echo "Installation od node modules"
npm install

echo "end"
