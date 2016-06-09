#!/bin/sh
docker run -i -t -p 8000:8000 -p 8001:8001 -p 61616:61616 $1 bash
