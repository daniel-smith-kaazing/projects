#!/bin/sh
cat /c/Users/DanielSmith/Google\ Drive/Docker/scripts/add_docker_link >> $HOME/.profile
# Add Docker swarm image
echo docker run swarm --help >> $HOME/.profile
cat $HOME/.profile
echo $HOME/.profile updated
