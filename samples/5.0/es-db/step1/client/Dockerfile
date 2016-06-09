# Pull base image
FROM ubuntu:latest

# Some needed utilities and PostgresQL client
RUN apt-get update \
        && apt-get install -y apt-utils net-tools postgresql-client

# Add our script
ADD sleep_and_query /usr/local/bin/

RUN chmod +x /usr/local/bin/sleep_and_query
