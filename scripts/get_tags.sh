#!/bin/sh
curl http://dockerhub1.kaazing.test:5000/v1/repositories/support/tags | \
awk '{FS - ": "; for (i = 1; i <NF; i+=2) printf ($i"\n");}'
