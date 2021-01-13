#!/bin/sh

echo "Kurent SIP gateway basic sh script installation for Ubuntu 16"
echo "Start"

echo "Installation of basic element"

sudo apt update

sudo apt-get -y install git nodejs autoconf automake libtool-bin gcc g++ libcurl4-openssl-dev libssl-dev openh264-gst-plugins-bad-1.5

echo "Installation of Kurento"
# Import the Kurento repository signing key
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 5AFA7A83
DISTRIB_CODENAME="bionic"
# Get Ubuntu version definitions
source /etc/upstream-release/lsb-release 2>/dev/null || source /etc/lsb-release

# Add the repository to Apt
sudo tee "/etc/apt/sources.list.d/kurento.list" >/dev/null <<EOF
# Kurento Media Server - Release packages
deb [arch=amd64] http://ubuntu.openvidu.io/6.15.0 $DISTRIB_CODENAME kms6
EOF

sudo apt-get update && sudo apt-get install --no-install-recommends --yes \
    kurento-media-server

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

#PUT Kurento-sip-gw as a service

# replace SERVERPATH with current installation path
PATH=`pwd`
sed -i -e "s/SERVERPATH/$PATH/g" kurento-sip-gw.service > my-kurento-sip-gw.service
cp my-kurento-sip-gw.service /etc/systemd/system
systemctl daemon-reload


echo "end"
