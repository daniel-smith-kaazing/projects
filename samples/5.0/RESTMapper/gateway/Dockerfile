# Pull base image
FROM kaazing/enterprise-gateway:5.0.2

MAINTAINER Daniel Smith. Contact via github issues: https://github.com/daniel-smith-kaazing

# Fetch build and runtime utils
RUN apt-get update; apt-get -y install dnsutils ldap-utils net-tools vim telnet zip

# add the lib/ext subdir from RESTMapper lib dir
ADD lib.ext.tar.gz /kaazing-gateway/

# add all the sample configs
ADD ./conf/gateway-config.xml /kaazing-gateway/conf/
ADD ./conf/truststore.* /kaazing-gateway/conf/
ADD ./conf/keystore.* /kaazing-gateway/conf/
ADD data-poller.tar.gz /

RUN chmod +x /data-poller/bin/data-poller

# add demo files
ADD web.tar.gz /kaazing-gateway/

# Add our startup script
ADD ./bin/start_gateway_and_data_poller /usr/local/bin/

RUN chmod +x /usr/local/bin/start_gateway_and_data_poller

# add new files to the path
ENV PATH=$PATH:/kaazing-gateway/bin

# Set Working Dir
#WORKDIR /kaazing-gateway

# Expose Ports
EXPOSE 80 443 8000

# Define default command
#CMD ["gateway.start"]
CMD ["/usr/local/bin/start_gateway_and_data_poller"]

