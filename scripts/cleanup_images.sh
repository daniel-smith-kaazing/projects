#!/bin/sh
# This removes untagged images
findUntagged()
{
  docker images -a | grep "^<none>" | awk '{print $3}'
}

CONTS=`docker ps -a -q`
if [ ! -z "$CONTS" ]; then
  docker stop $CONTS
fi
docker rmi -f `findUntagged`
docker images
