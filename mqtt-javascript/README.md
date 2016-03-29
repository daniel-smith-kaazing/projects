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

## ACTIVEMQ 

No special configuration; run it with its out-of-the-box configuration which configures itself
to listen for MQTT connections on:

http://0.0.0.0:1883 - listens on all available network interfaces on port 1883.

# RUNNING

Run the gateway and Active MQ. Use --config gateway-config-mqtt-amq.xml.

Load this in the browser (your.host, port, and path may vary - I am using the default
"extras" port in the gateway):
http:/YOUR-HOST:8001/demo/PATH-TO-YOUR-MQTT-FILES-DIR/mqtt.html

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
