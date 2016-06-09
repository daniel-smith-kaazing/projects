#!/bin/sh
JAVAPROCS=`ps -ef | grep java | awk '{print $2}'`
kill -9 "$JAVAPROCS"
