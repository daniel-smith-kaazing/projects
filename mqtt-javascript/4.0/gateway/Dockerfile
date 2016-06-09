# Pull base image
FROM ubuntu:14.04

# Install Zulu Open JDK
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 0x219BD9C9
RUN echo "deb http://repos.azulsystems.com/ubuntu `lsb_release -cs` main" >> /etc/apt/sources.list.d/zulu.list
RUN apt-get -qq update
RUN apt-get -qqy install zulu-8=8.6.0.1

# Install utilities
RUN apt-get install -y curl

# Add the latest released version of gateway,
ENV KAAZING_GATEWAY_URL http://download.kaazing.com/com/download/gateway/4.0.9.377/kaazing-websocket-gateway-full-4.0.9.tar.gz
RUN curl -L -o gateway.tar.gz $KAAZING_GATEWAY_URL \
        && tar -xvf gateway.tar.gz \
        && rm gateway.tar.gz \
        && mv kaazing-* kaazing-gateway \
        && rm -rf /apache-activemq-5.10.0


# Add fixed gateway.start
ADD gateway.start /kaazing-gateway/bin/

# Add Log4J settings to redirect to STDOUT
ADD log4j-*.xml /kaazing-gateway/conf/

# Add our MQTT gateway config
ADD gateway-config.xml /kaazing-gateway/conf

# Add our MQTT client code
ADD mqtt.html /kaazing-gateway/web/extras/demo/gateway/javascript/
ADD mymqtt.js /kaazing-gateway/web/extras/demo/gateway/javascript/

# Define mountable directories
#VOLUME ["kaazing-gateway/"]

# Expose Ports
EXPOSE 8000 8001

# Set Working Dir
WORKDIR kaazing-gateway

# Define default command
CMD ["bin/gateway.start"]
