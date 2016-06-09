#!/bin/sh

if [ ! -h /home/docker/Docker ]; then
  ln -s /c/Users/DanielSmith/Docker /home/docker/Docker
fi

PATH=/home/docker/Docker/scripts:$PATH
export PATH
