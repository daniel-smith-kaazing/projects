# Pull base image
FROM kaazing/development-gateways:409

# Add our gateway and log4j configs
ADD *.xml /kaazing-gateway/conf/

# Add our MQTT client code
ADD mqtt.html /kaazing-gateway/web/extras/demo/gateway/javascript/
ADD mymqtt.js /kaazing-gateway/web/extras/demo/gateway/javascript/
