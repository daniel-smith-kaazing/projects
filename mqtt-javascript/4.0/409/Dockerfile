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
RUN curl -L -o gateway.tar.gz http://10.0.67.121/artifactory/archiva-internal/com/kaazing/gateway/com.kaazing.gateway.assembly.full/4.0.9.383/com.kaazing.gateway.assembly.full-4.0.9.383.tar.gz
RUN tar -xvf gateway.tar.gz
RUN rm gateway.tar.gz
RUN mv kaazing-* kaazing-gateway

# Add fixed gateway.start
ADD gateway.start /kaazing-gateway/bin/

# Add Log4J settings to redirect to STDOUT
ADD log4j-config.xml /kaazing-gateway/conf/

# Define mountable directories
VOLUME ["kaazing-gateway/"]

# Expose Ports
EXPOSE 8000 8001

# Set Working Dir
WORKDIR kaazing-gateway

# Define default command
CMD ["bin/gateway.start"]
