May/June 2014
Last updated June 15, 2016
Dan Smith

# LINKS

MQTT 3.1 specs:
http://public.dhe.ibm.com/software/dw/webservices/ws-mqtt/mqtt-v3r1.html

MQTT 3.1.1 draft spec:
http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/csprd01/mqtt-v3.1.1-csprd01.html

Apache MQ MQTT:
http://activemq.apache.org/mqtt.html

# SERVER COMPONENTS

Kaazing Gateway 5.0 EE (from Docker image kaazing/enterprise-gateway)
Apache Active MQ 5.10.0

# FILES

To make this example work, three files must be copied somewhere under GATEWAY_HOME\web\extras\demo.
For example, in my installation, I copied to:
E:\kaazing-websocket-gateway-jms-4.0.9\web\extras\demo\gateway\javascript

1. mqtt.html
2. mymqtt.js
3. WebSocket.js - one can copy that from the GATEWAY_HOME\lib\javascript directory. Alternately, if one copies the first two files to the existing GATEWAY_HOME\web\extras\demo\gateway\javascript directory, WebSocket.js will be loaded from there.

## Docker images

The Javascript client files are downloaded copied for you by the gateway/Dockerfile.

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

## Docker image

The gateway Dockerfile copies a gateway-config.xml file that is pre-configured for you.

## ACTIVEMQ 

No special configuration; run it with its out-of-the-box configuration which configures itself
to listen for MQTT connections on:

http://0.0.0.0:1883 - listens on all available network interfaces on port 1883.

# RUNNING

## Docker containers to try it out!

You can use these Docker containers and the docker-compose.yml suite to try out the MQTT client. 

## Versions

Docker version 1.11.0, build 4dc5990
docker-compose version 1.7.0, build 0d7bf73

## docker-compose.yml

This defines an *amq* image that will run Apache MQ 5.10.0. This is in turn based on a Kaazing 3rd party gateway. You may have to change the path shown in the following section, depending on where your copy of this 3rd party gateway Dockerfile resides:

```
amq:
  build: ../../tools.docker/3rd-party/activemq-5.10.0
  hostname: amq.kaazing.test
```

It also defines a *gateway* image as already described.

## Run

```
docker-compose up [-d]
```

You should see both images come up. Check with docker ps.

## /etc/hosts
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

Look for the *eth0* inet addr, in this case *172.18.0.3. YOUR IP MAY VARY.

In this example, this entry would be added to the /etc/hosts file:

```
172.18.0.3 gateway.kaazing.test
```

## amq

There is no need to add its hostname, amq.kaazing.test, to the /etc/hosts file as it will already be known to the gateway by that name, thanks to the docker-compose.yml.

## Browser client URI

You can load two copies in two browser tabs/windows - one can publish, and the other can subscribe. Or, you can have one copy that does both.

```
http://gateway.kaazing.test:8001/demo/gateway/javascript/mqtt.html
```

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

