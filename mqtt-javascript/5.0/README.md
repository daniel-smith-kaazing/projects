May/June 2014
Updated March 29, 2016
Dan Smith

# LINKS

MQTT 3.1 specs:
http://public.dhe.ibm.com/software/dw/webservices/ws-mqtt/mqtt-v3r1.html

MQTT 3.1.1 draft spec:
http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/csprd01/mqtt-v3.1.1-csprd01.html

Apache MQ MQTT:
http://activemq.apache.org/mqtt.html

# SERVER COMPONENTS

Kaazing Gateway 4.0.9
Apache Active MQ 5.10.0

# FILES

To make this example work, three files must be copied somewhere under GATEWAY_HOME\web\extras\demo.
For example, in my installation, I copied to:
E:\kaazing-websocket-gateway-jms-4.0.9\web\extras\demo\gateway\javascript

1. mqtt.html
2. mymqtt.js
3. WebSocket.js - one can copy that from the GATEWAY_HOME\lib\javascript directory. Alternately, if one copies the first two files to the existing GATEWAY_HOME\web\extras\demo\gateway\javascript directory, WebSocket.js will be loaded from there.

# CONFIGURATION

## Gateway

See the MqttProxy section of the config\gateway-config-mqtt-amq.xml config file. I used property "mqtt.provider.host" - you can use what you'd like. 

Set that value to the host that Active MQ is running on.

```xml
  <service>
    <name>MqttProxy</name>
    <description>Proxy Service</description>
    <accept>ws://${gateway.host}:${gateway.extras.port}/mqttproxy</accept>
	<connect>tcp://${mqtt.provider.host}:1883</connect>

    <type>proxy</type>

    <!--
    <realm-name>demo</realm-name>

    <authorization-constraint>
      <require-role>AUTHORIZED</require-role>
    </authorization-constraint>
    -->
    <!--
    <cross-site-constraint>
      <allow-origin>*</allow-origin>
    </cross-site-constraint>
    -->
  </service>
```

## ACTIVEMQ 

No special configuration; run it with its out-of-the-box configuration which configures itself
to listen for MQTT connections on:

http://0.0.0.0:1883 - listens on all available network interfaces on port 1883.

# /etc/hosts
You need to add the IP address for the *mqtt_gateway* container to your Docker hosts' /etc/hosts file. You can find that out like this:

```
docker exec -it mqtt_gateway ifconfig
```

That will return something like this:

```
eth0      Link encap:Ethernet  HWaddr 02:42:ac:12:00:03  
          inet addr:172.18.0.3  Bcast:0.0.0.0  Mask:255.255.0.0
          inet6 addr: fe80::42:acff:fe12:3/64 Scope:Link
          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1
          RX packets:71 errors:0 dropped:0 overruns:0 frame:0
          TX packets:16 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:10193 (10.1 KB)  TX bytes:1320 (1.3 KB)

lo        Link encap:Local Loopback  
          inet addr:127.0.0.1  Mask:255.0.0.0
          inet6 addr: ::1/128 Scope:Host
          UP LOOPBACK RUNNING  MTU:65536  Metric:1
          RX packets:120 errors:0 dropped:0 overruns:0 frame:0
          TX packets:120 errors:0 dropped:0 overruns:0 carrier:0
          collisions:0 txqueuelen:0 
          RX bytes:9055 (9.0 KB)  TX bytes:9055 (9.0 KB)

```

Look for the *eth0* inet addr, in this case *172.18.0.3.

In this example, these entries would be added to the /etc/hosts file:

```
172.18.0.3 gateway.kaazing.test
```

# RUNNING

```
docker-compose up [-d]
```

Use -d to put it in the background (if you want).

```
http://gateway.kaazing.test:8001/demo/gateway/javascript/mqtt.html
```

You can load two copies in two browser tabs/windows - one can publish, and the other can subscribe.

## CONNECT

To connect you need:

Client ID - any arbitrary string but each client should have its own; otherwise confusing things happen.

User/password - you can use what you'd like as security isn't enabled. However, if you enter a user with no password, Apache MQ doesn't like it. So the Javascript client code won't allow that.

Keep Alive - I defaulted to 0 which tells MQTT not to sever the connection (never to time out).
It can be set to any value 0..65535 seconds. If you set it higher than 0, the Javascript client code will send a PINGREQ to Apache MQ every "keep alive" seconds and
you should see a PINGRESP come back.

## PUBLISH (Default QoS: AT MOST ONCE)

You can enter an arbitrary topic (it can start with a / or not). MQTT will not accept publishing to a wildcard topic specification.

You can use the text field to send a message, or you can use the "Text file to publish" button to browse and load a text file and then click "Publish File Contents" to publish it.

Requested Publish QoS:
You can choose different QoS levels to PUBLISH which causes different handshaking to occur:
AT MOST ONCE (0) - fire and forget
AT LEAST ONCE (1) - a PUBLISH message will be acknowledged by the MQTT server with a PUBACK response.
EXACTLY ONCE (2) - the PUBLISH procotol is:
client PUBLISH, server PUBREC, client PUBREL, server PUBCOMP.
The Javascript client will display each of these.

A client that receives a PUBLISH message at EXACTLY ONCE QoS should participate in the above
handshake but in the opposite direction:
server PUBLISH - client PUBREC - server PUBREL - client PUBCOMP

## Send Duplicate Message (FALSE/TRUE, default FALSE)

Setting this to true will affect these MQTT message types:
PUBLISH, PUBREL, SUBSCRIBE, UNSUBSCRIBE
Each time a message is published AND this is set to true AND the QoS level is higher than "AT MOST ONCE", a second message will also be published with the DUP bit set.

Usually, with QoS = "AT LEAST ONCE", if the client does not receive a PUBACK (within a reasonable amount of time), it should resend the message. Here we have simplified - if "Send Duplicate Message" is true, we send the duplicate.

Also, with QoS = "EXACTLY ONCE", if the client does not receive a PUBREC (within a reasonable amount of time), it should resend the message. Again, here we have simplified - if "Send Duplicate Message" is true, we send the duplicate. 

Further, if the client's PUBREL message is not followed by a PUBCOMP (within a reasonable amount of time), the client should resend the PUBREL. Again, here we have simplified - if "Send Duplicate Message" is true, we send the duplicate.

Here we have simplified a bit just to test the bit being set or not. With this bit set, if the server gets a duplicate message and has received the original (with the same message ID), it ignores the duplicate.

I have also tested to verify that a subscribed client only gets one copy of a PUBLISHed message, even if a duplicate was sent.

## Retain Last PUBLISHed

When this is true, a PUBLISHed message will also have the "RETAIN" bit set in its fixed header (see the MQTT 3.1 spec for details).

Further, a new subscriber that subscribes after the RETAINed message was sent will get the last such message.

## SUBSCRIBE (default QoS: AT MOST ONCE)

You can use wildcards to subscribe with this client app. See the section "Working with Destinations with MQTT" on the following page for the MQTT wildcards, which are not the same as Active MQ's. The mapping between them is here as well:

http://activemq.apache.org/mqtt.html

### AMQ 5.10.0 MQTT QoS Glitch

I have noted that, no matter which QoS one uses to PUBLISH a message, Active MQ 5.10.0's MQTT support always seems to broadcast messages to subscribers at "AT MOST ONCE". Therefore, I did not implement the AT LEAST ONCE or EXACTLY ONCE handshaking from the subscribing client perspective.

# ADVANCED CONNECTION OPTIONS

## LAST WILL AND TESTAMENT

Last Will Enabled - TRUE/FALSE

When enabled, the MQTT Last Will feature will be exercised. An extra bit, the Last Will bit, will be set in the CONNECT message header.
Further, the configured Last Will Topic, Last Will Message and Requested Last Will QoS will be sent as part of the CONNECT header or payload.

In order to see this feature in action you will need two clients:
- Client One will connect using the default parameters, and then subscribe to a Last Will Topic (default topic/lastwill).
This client will receive the Last Will Message when the other client is down (we will simulate it being down).
- Client Two will configure the Last Will feature when it connects.

For Client Two:
- Before connecting, set Last Will Enabled to TRUE.
- Also set the Keep Alive (sec) to a value > 0, say 30 secs.
- IMPORTANT - also set Simulate Down Client (no PINGREQ) to TRUE.
- CONNECT. You will see a CONNACK as usual.
- After 30 seconds or so, you will see a message like this that is logged:
Simulating down client. PINGREQ message will not be sent.
This is because the configured timeout has transpired but we have not allowed a PINGREQ to be sent from the client.
- Client One should receive a PUBLISHed message like this:
Client 714909 seems to be down. (this is the default Last Will message for, say, client 714909)
- After a bit longer, Client Two should see this logged:
Closing WebSocket connection. Code: 1000 Reason:
The MQTT server has closed its connection, and the WebSocket connection has closed, because Client Two did not send a PINGREQ in time to keep those alive.

# Docker containers to try it out!

You can use these Docker containers and the docker-compose.yml suite to try out the MQTT client. 

## Versions

Docker version 1.10.3, build 20f81dd
docker-compose version 1.6.2, build 4d72027

## /etc/hosts file

To enable running the MQTT client from the Docker host that will run these containers, add the following entries to your Docker host's /etc/hosts file (your IPs may vary: this was for Ubuntu 14.04.02):

```
# Added for MQTT testing
172.17.0.2 amq.kaazing.test
172.17.0.3 gateway.kaazing.test
```

## 409 image

You can use this directory to build your own 4.0.9 Gateway. You should build it as follows, for use later by the *gateway* image:

```
docker build -t kaazing/development-gateways:409
```

## docker-compose.yml

This defines an *amq* image that will run Apache MQ 5.10.0. This is in turn based on a Kaazing 3rd party gateway. You may have to change the path shown in the following section, depending on where your copy of this 3rd party gateway Dockerfile resides:

```
amq:
  build: ../../tools.docker/3rd-party/activemq-5.10.0
  hostname: amq.kaazing.test
```
## Run

docker-compose up

You should see both images come up:

```
kaazing@kaazing-support:~/Docker/projects/mqtt-javascript$ docker-compose upCreating mqttjavascript_amq_1
Creating mqttjavascript_gateway_1
Attaching to mqttjavascript_amq_1, mqttjavascript_gateway_1
amq_1     | *** Running /etc/my_init.d/00_regen_ssh_host_keys.sh...
amq_1     | No SSH host key available. Generating one...
amq_1     | Creating SSH2 RSA key; this may take some time ...
amq_1     | Creating SSH2 DSA key; this may take some time ...
amq_1     | Creating SSH2 ECDSA key; this may take some time ...
amq_1     | Creating SSH2 ED25519 key; this may take some time ...
amq_1     | invoke-rc.d: policy-rc.d denied execution of restart.
amq_1     | *** Running /etc/rc.local...
amq_1     | *** Booting runit daemon...
amq_1     | *** Runit started as PID 94
amq_1     | Java Runtime: Oracle Corporation 1.7.0_79 /usr/lib/jvm/java-7-openjdk-amd64/jre
amq_1     |   Heap sizes: current=60928k  free=58633k  max=932352k
amq_1     |     JVM args: -Xmx1G -Dcom.sun.management.jmxremote.ssl=false -Dcom.sun.management.jmxremote.password.file=/opt/activemq/conf/jmx.password -Dcom.sun.management.jmxremote.access.file=/opt/activemq/conf/jmx.access -Djava.util.logging.config.file=logging.properties -Dcom.sun.management.jmxremote -Djava.io.tmpdir=/opt/activemq/tmp -Dactivemq.classpath=/opt/activemq/conf -Dactivemq.home=/opt/activemq -Dactivemq.base=/opt/activemq -Dactivemq.conf=/opt/activemq/conf -Dactivemq.data=/opt/activemq/data
amq_1     | Extensions classpath:
amq_1     |   [/opt/activemq/lib,/opt/activemq/lib/camel,/opt/activemq/lib/optional,/opt/activemq/lib/web,/opt/activemq/lib/extra]
amq_1     | ACTIVEMQ_HOME: /opt/activemq
amq_1     | ACTIVEMQ_BASE: /opt/activemq
amq_1     | ACTIVEMQ_CONF: /opt/activemq/conf
amq_1     | ACTIVEMQ_DATA: /opt/activemq/data
amq_1     | Loading message broker from: xbean:activemq.xml
amq_1     |  INFO | Refreshing org.apache.activemq.xbean.XBeanBrokerFactory$1@462eab5b: startup date [Wed Mar 30 21:02:33 UTC 2016]; root of context hierarchy
amq_1     | Mar 30 21:02:32 amq syslog-ng[100]: syslog-ng starting up; version='3.5.3'
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:33,448 INFO  com.kaazing.gateway.server.Gateway [main] Kaazing WebSocket Gateway (4.0.9.383)
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:33,449 INFO  com.kaazing.gateway.server.Gateway [main] Configuration file: /kaazing-gateway/conf/gateway-config.xml
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:33,551 INFO  com.kaazing.gateway.server.Gateway [main] Checking license information
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:33,709 INFO  com.kaazing.gateway.server.Gateway [main]   Found license: Developer License, Maximum 50 connections, See license.txt
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,648 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,648 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.extras.port}], replaced with [8001], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,649 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,649 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.extras.port}], replaced with [8001], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,653 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,653 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.base.port}], replaced with [8000], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,659 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,659 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.extras.port}], replaced with [8001], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,660 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,660 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.base.port}], replaced with [8000], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,688 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,688 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.extras.port}], replaced with [8001], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,688 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${mqtt.provider.host}], replaced with [amq.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,689 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,689 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.extras.port}], replaced with [8001], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,690 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,693 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.host}], replaced with [gateway.kaazing.test], as a result of resolution strategy [SYSTEM_PROPERTIES]
gateway_1 | com.kaazing.gateway.server.config.parse.GatewayConfigParameter 2016-03-30 21:02:34,693 INFO  com.kaazing.gateway.server.config.parse.GatewayConfigParameter [pool-1-thread-1] Detected configuration parameter [${gateway.base.port}], replaced with [8000], as a result of resolution strategy [PARAMETER_DEFINITION_DEFAULT]
amq_1     |  INFO | PListStore:[/opt/activemq/data/localhost/tmp_storage] started
amq_1     |  INFO | Using Persistence Adapter: KahaDBPersistenceAdapter[/opt/activemq/data/kahadb]
amq_1     |  INFO | Apache ActiveMQ 5.10.0 (localhost, ID:amq.kaazing.test-47208-1459371756329-0:1) is starting
amq_1     |  INFO | Listening for connections at: tcp://amq.kaazing.test:61616?maximumConnections=1000&wireFormat.maxFrameSize=104857600
amq_1     |  INFO | Connector openwire started
amq_1     |  INFO | Listening for connections at: amqp://amq.kaazing.test:5672?maximumConnections=1000&wireFormat.maxFrameSize=104857600
amq_1     |  INFO | Connector amqp started
amq_1     |  INFO | Listening for connections at: stomp://amq.kaazing.test:61613?maximumConnections=1000&wireFormat.maxFrameSize=104857600
amq_1     |  INFO | Connector stomp started
amq_1     |  INFO | Listening for connections at: mqtt://amq.kaazing.test:1883?maximumConnections=1000&wireFormat.maxFrameSize=104857600
amq_1     |  INFO | Connector mqtt started
amq_1     |  INFO | Listening for connections at ws://amq.kaazing.test:61614?maximumConnections=1000&wireFormat.maxFrameSize=104857600
amq_1     |  INFO | Connector ws started
amq_1     |  INFO | Apache ActiveMQ 5.10.0 (localhost, ID:amq.kaazing.test-47208-1459371756329-0:1) started
amq_1     |  INFO | For help or more information please see: http://activemq.apache.org
amq_1     |  WARN | Store limit is 102400 mb (current store usage is 0 mb). The data directory: /opt/activemq/data/kahadb only has 7649 mb of usable space - resetting to maximum available disk space: 7649 mb
amq_1     | ERROR | Temporary Store limit is 51200 mb, whilst the temporary data directory: /opt/activemq/data/localhost/tmp_storage only has 7649 mb of usable space - resetting to maximum available 7649 mb.
gateway_1 | transport.http.accept 2016-03-30 21:02:37,750 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' null
gateway_1 | transport.tcp.accept 2016-03-30 21:02:37,751 DEBUG transport.tcp.accept [main] TCP acceptor: worker count = 2
amq_1     |  INFO | ActiveMQ WebConsole available at http://0.0.0.0:8161/
amq_1     |  INFO | Initializing Spring FrameworkServlet 'dispatcher'
gateway_1 | com.kaazing.gateway.server.transport.nio.AbstractNioAcceptor 2016-03-30 21:02:38,156 INFO  com.kaazing.gateway.server.transport.nio.AbstractNioAcceptor [main] Bound to resource: tcp://172.17.0.3:8000
gateway_1 | transport.http.accept 2016-03-30 21:02:38,156 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,156 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,157 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,169 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;e/cookies' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,171 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,172 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8000/;resource' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,180 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,180 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,181 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,181 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,181 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,181 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,181 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8000/;resource' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,182 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,182 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8000/snmp' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,182 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,182 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,183 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,183 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,189 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,190 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,190 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,190 TRACE transport.http.accept [main] binding: 'httpx://gateway.kaazing.test:8000/;resource' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,191 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,191 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,192 TRACE transport.http.accept [main] binding: 'httpx://gateway.kaazing.test:8000/snmp' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,192 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,192 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,193 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,193 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,193 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,194 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,194 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,194 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,194 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,195 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,195 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,220 TRACE transport.http.accept [main] binding: 'httpx-draft://gateway.kaazing.test:8000/;resource' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,228 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,236 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,236 TRACE transport.http.accept [main] binding: 'httpx-draft://gateway.kaazing.test:8000/snmp' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,237 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,258 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,282 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/;resource' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,282 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;e/cr' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,284 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8000/;resource' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,284 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;e/cr' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,284 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8000/snmp/;e/cr' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,284 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/snmp/;e/cr' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,324 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/commandcenter' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,355 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' null
gateway_1 | com.kaazing.gateway.server.transport.nio.AbstractNioAcceptor 2016-03-30 21:02:38,357 INFO  com.kaazing.gateway.server.transport.nio.AbstractNioAcceptor [main] Bound to resource: tcp://172.17.0.3:8001
gateway_1 | transport.http.accept 2016-03-30 21:02:38,357 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,357 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,357 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,362 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;e/cookies' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,363 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,373 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/;resource' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,373 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,375 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,380 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,381 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,381 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,381 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,384 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/;resource' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,384 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,384 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/mqttproxy' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,384 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,384 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,385 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,385 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,385 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,385 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,400 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,400 TRACE transport.http.accept [main] binding: 'httpx://gateway.kaazing.test:8001/;resource' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,400 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,401 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,401 TRACE transport.http.accept [main] binding: 'httpx://gateway.kaazing.test:8001/mqttproxy' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,401 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,402 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,404 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,404 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,406 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,418 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,418 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,418 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,418 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,422 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,424 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,430 TRACE transport.http.accept [main] binding: 'httpx-draft://gateway.kaazing.test:8001/;resource' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,430 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,430 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,430 TRACE transport.http.accept [main] binding: 'httpx-draft://gateway.kaazing.test:8001/mqttproxy' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,431 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,460 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,488 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/;resource' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,490 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;e/cr' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,491 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/;resource' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,492 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;e/cr' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,492 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/mqttproxy/;e/cr' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,493 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/mqttproxy/;e/cr' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,506 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,533 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,537 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,562 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;e/cookies' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,584 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,585 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,585 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,585 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,586 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/echo' wse/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,586 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' httpxe/1.1
gateway_1 | transport.http.accept 2016-03-30 21:02:38,589 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,589 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,590 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,590 TRACE transport.http.accept [main] binding: 'httpx://gateway.kaazing.test:8001/echo' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,591 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,591 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' ws/rfc6455
gateway_1 | transport.http.accept 2016-03-30 21:02:38,592 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,592 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,593 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,595 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,595 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,596 TRACE transport.http.accept [main] binding: 'httpx-draft://gateway.kaazing.test:8001/echo' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,596 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;api' null
gateway_1 | transport.http.accept 2016-03-30 21:02:38,596 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo' ws/draft-7x
gateway_1 | transport.http.accept 2016-03-30 21:02:38,612 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;e/cr' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,612 TRACE transport.http.accept [main] binding: 'httpxe://gateway.kaazing.test:8001/echo/;e/cr' wsr/1.0
gateway_1 | transport.http.accept 2016-03-30 21:02:38,613 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/echo/;e/cr' httpxe/1.1
amq_1     |  INFO | jolokia-agent: No access restrictor found at classpath:/jolokia-access.xml, access to all MBeans is allowed
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,189 INFO  com.kaazing.gateway.server.Gateway [main] JMX Management service started with URI jmx://gateway.kaazing.test:2020/ with service URI service:jmx:rmi:///jndi/rmi://gateway.kaazing.test:2020/jmxrmi
gateway_1 | transport.http.accept 2016-03-30 21:02:39,199 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8000/' null
gateway_1 | transport.http.accept 2016-03-30 21:02:39,200 TRACE transport.http.accept [main] binding: 'http://gateway.kaazing.test:8001/session' null
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main] Starting server
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main] Starting services
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main]   http://gateway.kaazing.test:8000/
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main]   http://gateway.kaazing.test:8000/commandcenter
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main]   http://gateway.kaazing.test:8001/
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main]   http://gateway.kaazing.test:8001/session
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main]   ws://gateway.kaazing.test:8000/snmp
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main]   ws://gateway.kaazing.test:8001/echo
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main]   ws://gateway.kaazing.test:8001/mqttproxy
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,200 INFO  com.kaazing.gateway.server.Gateway [main] Started services
gateway_1 | com.kaazing.gateway.server.Gateway 2016-03-30 21:02:39,206 INFO  com.kaazing.gateway.server.Gateway [main] Started server successfully in 2.733 secs at 2016-03-30 21:02:36

```

Load the client as outlined above, and enjoy!

