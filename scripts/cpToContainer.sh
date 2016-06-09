#!/bin/sh
usage()
{
  echo Usage: cpToContainer.sh CONTAINER-ID ITEM-TO-COPY CONTAINER-PATH
}

MYCONT=$1
if [ -z $MYCONT ]; then
  echo You must provide the container ID.
  usage
  exit
fi

MYPATH=$2
if [ -z $MYPATH ]; then
  echo You must provide a path to something to copy.
  usage
  exit
fi

if [ ! -e $MYPATH ]; then
  echo $MYPATH does not exist.
  usage
  exit
fi

MYPATHTO=$3
if [ -z $MYPATHTO ]; then
  echo You must provide a path to copy to.
  usage
  exit
fi

MYDIRTO=`ls -d /var/lib/docker/aufs/mnt/$MYCONT* | grep -v init`$MYPATHTO
if [ ! -e $MYDIRTO ]; then
  echo Directory $MYDIRTO does not exist.
  exit
fi

sudo cp $MYPATH $MYDIRTO/
MYFILE=`basename $MYPATH`
sudo ls -latr $MYDIRTO/$MYFILE

