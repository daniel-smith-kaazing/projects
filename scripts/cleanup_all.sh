#!/bin/sh
DIRNAME=`dirname $0`
$DIRNAME/cleanup_images.sh
$DIRNAME/cleanup_containers.sh
docker images
docker ps
