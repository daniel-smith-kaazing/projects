#!/bin/sh
export MY_COMPOSE_CMD=$1
shift
echo docker-compose command is $MY_COMPOSE_CMD
echo remaining args: $*
docker run -v "$(pwd)":/app -v /var/run/docker.sock:/var/run/docker.sock -ti dduportal/docker-compose:latest $MY_COMPOSE_CMD -d $*
