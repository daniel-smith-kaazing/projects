# Pull base image
FROM kaazing/enterprise-gateway

# Add some net utils we may need
RUN apt-get update \
        && apt-get install -y apt-utils net-tools vim less

# Add our configuration files
ADD log4j-*.xml /kaazing-gateway/conf/
ADD gateway-*.xml /kaazing-gateway/conf/
