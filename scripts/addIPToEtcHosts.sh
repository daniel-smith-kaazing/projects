#!/bin/sh
CHECKNAMES=`sudo grep $1 /etc/hosts`
if [ ! -z "$CHECKNAMES" ]; then
  echo `ifconfig | grep "inet addr" | grep "172" | awk '{print $2}' | sed s/addr://` "$1" >> /etc/hosts
else
  echo "$1" is already in /etc/hosts
fi
