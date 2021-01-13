#!/bin/sh

echo "Start"


#echo "Installation of coturn"
#sudo apt-get install coturn

echo "Installation of Drachtio"
git clone --depth=50 --branch=develop git://github.com/davehorton/drachtio-server.git
cd drachtio-server
git submodule update --init --recursive
./bootstrap.sh
mkdir build && cd build
../configure CPPFLAGS='-DNDEBUG'
make
sudo make install
# Put Drachtio as a Deamon service
cp drachtio-server.service /etc/systemd/system

cd ../..
cp drachtio-conf.xml /etc

echo "Installation of node modules"
npm install
