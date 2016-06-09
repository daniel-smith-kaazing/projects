#!/bin/sh
CONTS=`docker ps -a -q`
if [ ! -z "$CONTS" ]; then
  docker stop $CONTS
  docker rm $CONTS
  echo Done cleaning up.
else
  echo No containers to clean up.
fi
