#!/bin/sh
usage()
{
  echo Usage: sudo cpFromContainer.sh CONTAINER-ID PATH-TO-CONTAINER-ITEM-TO-COPY LOCAL-PATH
  echo You need sudo privileges to be able to test for existence of the item and to copy it.
}

MYCONT=$1
if [ -z $MYCONT ]; then
  echo You must provide the container ID.
  usage
  exit
fi

MYCONTPATH=$2
if [ -z $MYCONTPATH ]; then
  echo You must provide a path to something to copy on the container.
  usage
  exit
fi

MYPATHFROM=`ls -d /var/lib/docker/aufs/mnt/$MYCONT* | grep -v init`$MYCONTPATH
if [ ! -e $MYPATHFROM ]; then
  echo $MYPATHFROM does not exist on container.
  usage
  exit
fi

MYLOCALPATH=$3
if [ -z $MYLOCALPATH ]; then
  echo You must provide a local path to copy to.
  usage
  exit
fi

if [ ! -e $MYLOCALPATH ]; then
  echo Local path $MYLOCALPATH does not exist.
  usage
  exit
fi

sudo cp $MYPATHFROM $MYLOCALPATH/
sudo ls -latr $MYLOCALPATH

