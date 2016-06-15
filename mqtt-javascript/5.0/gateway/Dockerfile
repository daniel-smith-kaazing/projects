# Pull base image
FROM kaazing/enterprise-gateway

# Install a couple of things
RUN apt-get -qq update \
        && apt-get -qqy install net-tools curl zip

# Add Log4J settings to redirect to STDOUT
ADD log4j-*.xml /kaazing-gateway/conf/

# Add our MQTT gateway config
ADD gateway-config.xml /kaazing-gateway/conf

# Add our MQTT client code
ENV DEMO_DIR /kaazing-gateway/web/extras/demo/gateway/javascript/
ADD mqtt.html $DEMO_DIR
ADD mymqtt.js $DEMO_DIR

ENV KAAZING_JAVASCRIPT_VERSION 4.1.0
ENV KAAZING_JAVASCRIPT_PREFIX kaazing-enterprise-javascript-client
ENV KAAZING_JAVASCRIPT_URL http://cdn.kaazing.com/releases/enterprise.javascript.client/$KAAZING_JAVASCRIPT_VERSION/$KAAZING_JAVASCRIPT_PREFIX-$KAAZING_JAVASCRIPT_VERSION.zip
ENV KAAZING_JAVASCRIPT_DIR $KAAZING_JAVASCRIPT_PREFIX-$KAAZING_JAVASCRIPT_VERSION

# Add the latest 4.1.0 Javascript client lib to $DEMO_DIR
RUN curl -L -o javascript.zip $KAAZING_JAVASCRIPT_URL \
        && unzip javascript.zip \
        && rm javascript.zip \
        && cp $KAAZING_JAVASCRIPT_DIR/*.* $DEMO_DIR 

# Expose Ports
EXPOSE 8000 8001

# WORKDIR and CMD set in base image - we will use those.
