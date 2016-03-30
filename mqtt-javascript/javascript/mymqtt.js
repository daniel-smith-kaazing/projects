/**
* mymqtt.js - Implementation of an MQTT client.
* For further details on MQTT v. 3.1 and the 3.1.1. draft, see these specifications:
* http://public.dhe.ibm.com/software/dw/webservices/ws-mqtt/mqtt-v3r1.html
* http://docs.oasis-open.org/mqtt/mqtt/v3.1.1/csprd01/mqtt-v3.1.1-csprd01.html
*/

var DEBUG_MQTT = false;
var MQTT_SEND_DUPLICATES = false;
var MQTT_RETAIN_LAST = false;
var MQTT_LAST_WILL_ENABLED = false;
var MQTT_SIMULATE_CLIENT_DOWN = false;

function setDebugMQTT(val)
{
	DEBUG_MQTT = val;
}

function setSendDuplicateMessages(val)
{
	MQTT_SEND_DUPLICATES = val;
}

function mustSendDuplicate(QoS)
{
	return (MQTT_SEND_DUPLICATES && (QoS >= QOS_AT_LEAST_ONCE));
}

function setRetainLastMessage(val)
{
	MQTT_RETAIN_LAST = val;
}

function setLastWillEnabled(val)
{
	MQTT_LAST_WILL_ENABLED = val;
}

function setSimulateClientDown(val)
{
	MQTT_SIMULATE_CLIENT_DOWN = val;
}

var connectKeepAlive = 0;
var lastMessageTimestamp = 0;
var keepAliveTimer = null;

var socket;
var output;

// We want this to be global so
// we can process multiple frames into it.
var buffer = new ByteBuffer();

// Keep track of current op we are processing.
var MQTT_NONE = 0xff;
var MQTT_LOWEST_OP = 0x10;
var MQTT_HIGHEST_OP = 0xe0;

// Message type or operation code.
var opCode = MQTT_NONE;

// Remaining length - Variable header length + payload length.
var remainingLen = 0;

// This is (remainingLen - variable header length).
var payloadLen;

// Variable headers (for some message types)
var variableHeaders;

// Message ID. Range from 0 .. 65535.
var messageID = 0;

// For received PUBLISH messages, the QoS in the received message.
// This determines how it is processed.
var publishQoS = 0;

// For received PUBLISH messages, the received message ID.
var publishMessageID = -1;

// For received PUBREC messages, the received message ID.
var pubrecMessageID = -1;

// NOTE - the type (op) code is always in the high (leftmost) bits).
// To decode by testing the high bits of the first received byte
// for the first MQTT frame of any message (that possibly spans
// many such frames).
// decoded = byte & 0xf0 
// opname = MSG_TYPES_CODES_TO_STRINGS[decoded]
var MSG_TYPES_CODES_TO_STRINGS = 
{
  0x00: "RESERVED",
  0x10: "CONNECT",
  0x20: "CONNACK",
  0x30: "PUBLISH",
  0x40: "PUBACK",
  0x50: "PUBREC",
  0x60: "PUBREL",
  0x70: "PUBCOMP",
  0x80: "SUBSCRIBE",
  0x90: "SUBACK",
  0xa0: "UNSUBSCRIBE",
  0xb0: "UNSUBACK",
  0xc0: "PINGREQ",
  0xd0: "PINGRESP",
  0xe0: "DISCONNECT",
  0xf0: "RESERVED"
};
 
// NOTE - the type (op) code is always in the high (leftmost) bits).
// To encode by setting the op high bits:
// code = MSG_TYPES_STRINGS_TO_CODES[OPNAME]
// byte = byte | code
var MSG_TYPES_STRINGS_TO_CODES = 
{
  "RESERVED" : 0x00,
  "CONNECT" : 0x10,
  "CONNACK" : 0x20,
  "PUBLISH" : 0x30,
  "PUBACK" : 0x40,
  "PUBREC" : 0x50,
  "PUBREL" : 0x60,
  "PUBCOMP" : 0x70,
  "SUBSCRIBE" : 0x80,
  "SUBACK" : 0x90,
  "UNSUBSCRIBE" : 0xa0,
  "UNSUBACK" : 0xb0,
  "PINGREQ" : 0xc0,
  "PINGRESP" : 0xd0,
  "DISCONNECT" : 0xe0,
  "RESERVED" : 0xf0
};

var WEBSOCKET_READY_STATES =
{
	0 : "CONNECTING",
	1 : "OPEN",
	2 : "CLOSING",
	3 : "CLOSED"
};

// On the first sent or received MQTT frame,
// QoS is bits 1 and 2 of the rightmost (lower order) bits
// (assuming they are indexed 7 to 0 right to left)
// of the fixed header.
// Possible values are:
// 0 - at most once 
// 1 - at least once
// 2 - exactly once
// Use these below with bitwise OR to set them:
// The first is the default (zero value).
// We will make the default QOS_AT_LEAST_ONCE
var QOS_AT_MOST_ONCE = 0x00;
var QOS_AT_LEAST_ONCE = 0x01;
var QOS_EXACTLY_ONCE = 0x02;

// PROTOCOL_NAME
var PROTOCOL_NAME = "MQIsdp";

// Currently version 3
var PROTOCOL_VERSION = 0x03;

// Flags for sending u/p, other features
var SEND_USER_PWD = 0xc0;
var LAST_WILL_FLAG = 0x04;
var LAST_WILL_RETAIN = 0x20;

// CONNECT "Clean" flag - set bit 1 to 1
var CONNECT_CLEAN_FLAG = 0x02

function setup ()
{
	output = document.getElementById("output");
	url = document.getElementById("url");
    
	// Construct the WebSocket location
    var locationURI = new URI(document.URL || location.href);
	if (locationURI.port == null) {
        var defaultPorts = { "http":80, "https":443 };
        locationURI.port = defaultPorts[locationURI.scheme];
    }

    locationURI.scheme = locationURI.scheme.replace("http", "ws");
    // This must match what is configured in the <accept> in the gateway-config.xml
	locationURI.path = "/mqttproxy";
    delete locationURI.query;
    delete locationURI.fragment;

    // default the location
    url.value = locationURI.toString();
	
	// Generate a random client ID
	// WARNING - this may not be unique.
	var cid = document.getElementById("clientID");
	var rnd = Math.round(Math.random() * 1000000);
	cid.value = rnd;
	cid.placeholder = rnd;
	
	// Compute a default Last Will message
	var lwmsg = document.getElementById("lastWillMsg");
	lwmsg.value = "Client " + rnd + " seems to be down.";
	lwmsg.placeholder = lwmsg.value;
	
	log("Hello, MQTT World!");
};

/**
* The onclose handler is called when the connection is terminated.
*/
function onclose(event)
{
	// DEBUG HERE
	log("Closing WebSocket connection. Code: " + event.code + " Reason: " + event.reason);
	
	// Cancel keep alive
	if (keepAliveTimer)
	{
		clearInterval(keepAliveTimer);
		keepAliveTimer = null;
	}
};

/**
 * Subscribes to receive messages delivered to a specific destination.
 *
 * @param location - the URI to connect to the Kaazing gateway
 * @param clientID - client ID. Must be unique per client.
 * @param username - can be blank/njll
 * @param password - if username is not blank, this must also be provided
 * @param keepAlive - a value in seconds >= 0. 0 means the server won't disconnect.
 * @param lastWillTopicName - topic where Last Will messages will be delivered if the server
 * 		  receives an I/O error when communicating with the client, if the client does not 
 *		  properly respond to PUBLISH handshaking, or if the client fails to send a PINGREQ
 *		  within the 'keep alive' interval (if this is > 0).
 *		  If this is not blank, the Last Will feature is being used as part of the CONNECT command.
 * @param lastWillQoSVal- can be one of 0 (fire and forget, default), 1 (send at least once) or 2 (send at most once)
 * @param lastWillMsgStr - the message that will be sent by the MQTT server on behalf of the client
 *		  if the client is "down"
 * @param lastWillRetailVal - true/false. When true the Last Will topic will retain the last of the 
 *        Last Will messages published on behalf of this client
 */
function connect(location, clientID, username, password, keepAlive,
					lastWillTopicName, lastWillQoSVal, lastWillMsgStr, lastWillRetainVal)
{
	// Credentials may be given...
	// By default the provided gateway-config.xml does not have required authentication,
        // nor does the MQTT back-end.
	connectKeepAlive = keepAlive;
	var wsf = new WebSocketFactory();
	socket = wsf.createWebSocket(location);

	socket.onopen = function() 
	{
		writeFrame(
			"CONNECT", 
			{"clientID": clientID, "username": username, "password": password, "keepAlive": keepAlive, 
			"lastWillTopic": lastWillTopicName, "lastWillQoS": lastWillQoSVal, "lastWillMsg": lastWillMsgStr, "lastWillRetain": lastWillRetainVal}, 
			null);
		
		log("Connection request sent for " + location + " with u/p " + username + "," + password);
	};	

	socket.onmessage = function(event) 
	{
		printEventDataAsHex(event);
		readFragment(event); 
	};
	
	socket.onclose = function(event) 
	{ 
		onclose(event); 
	};
};

/**
 * Subscribes to receive messages delivered to a specific destination.
 *
 * @param destination the message destination
 * @param QoS - requested QoS level for the specified destination.
 *    The server may not support the requested level. The server will
 *    respond with the supported QoS level.
 */
function subscribe(destination, QoS) 
{
	var msgID = calculateMessageID();
	writeFrame("SUBSCRIBE", {"msgID" : msgID, "topicQoS" : QoS, "destination" : destination});
	if (mustSendDuplicate(QoS))
		writeFrame("SUBSCRIBE", {"msgID" : msgID, "topicQoS" : QoS, "destination" : destination, "isDuplicate" : true});
}

/**
 * Unsubscribes from receiving messages for a specific destination.
 *
 * @param destination the message destination
 * @param QoS - Unlike for SUBSCRIBE, this is the QoS level of the
 *    UNSUBSCRIBE message itself. A value of 0 will result in no UNSUBACK
 *	  message being returned by the server.
 */
function unsubscribe(destination, QoS) 
{
	QoS = QoS || QOS_AT_LEAST_ONCE;
	var msgID = calculateMessageID();
	writeFrame("UNSUBSCRIBE", {"msgID" : msgID, "QoS" : QoS, "destination" : destination});
	if (mustSendDuplicate(QoS))
		writeFrame("UNSUBSCRIBE", {"msgID" : msgID, "QoS" : QoS, "destination" : destination, "isDuplicate" : true});
}

/**
 * Disconnects from the remote STOMP server.
 */
function disconnect() 
{
	var readyState = 0;
	
	try
	{
		readyState = socket.readyState;
	}
	catch(err)
	{
		// ignore it
	}
	
	if (readyState === 1) 
	{
		writeFrame("DISCONNECT", {});
		socket.close(1000, "Closing WebSocket connection normally.");
	}
	else
	{
		throw "Cannot disconnect: socket ready state: " + WEBSOCKET_READY_STATES[readyState];
	}
}

/**
 * Sends a message to a specific destination at the remote STOMP Server.
 *
 * @param destination the message destination
 * @param body the message body
 * @param QoS - QoS for the PUBLISHed message: 0 (default), 1, 2 (as described above)
 */
function publish(destination, body, QoS)
{
	var msgID = calculateMessageID();
	log("Length of payload to be PUBLISHed: " + (body? body.length : 0));
	writeFrame("PUBLISH", {"msgID" : msgID, "QoS" : QoS, "destination" : destination, "retainLast" : MQTT_RETAIN_LAST}, body);
	if (mustSendDuplicate(QoS))
		writeFrame("PUBLISH", {"msgID" : msgID, "QoS" : QoS, "destination" : destination, "retainLast" : MQTT_RETAIN_LAST, "isDuplicate" : true}, body);
}

/**
 * Writes a WebSocket frame as part of sending an MQTT command.
 *
 * @param command - the command code for the current MQTT command
 * @param headers - message headers
 * @param body the message body
 */
function writeFrame(command, headers, body)
{
	// create a new frame buffer
	var frame = new ByteBuffer();
 
	var bodyTxt = body || ""
	var bodyLen = bodyTxt.length
	log("Sending command: " + command + " headers: " + headerToString(headers) + " payload length: " + bodyLen + " payload: ");
	log(bodyTxt); 

	// build the command line
	// First, build the fixed header byte
	var fixed = buildFixedHeader(command, headers);
	frame.put(fixed);
	
	// Optimization
	if ((command == "DISCONNECT") || (command == "PINGREQ"))
	{
		// There is no more to send; 
		// write a remaining length of 0.
		frame.put(0x00);
	}
	else
	{
		// We must build the rest of the message
		// before we can calculate the "remaining length".
		// That is the length of the variable headers
		// as well as the message body.
	
		var remainder = buildVariableHeaders(command, headers);
		var bodyBuf = buildPayload(command, headers, body);

		// Concatenate body to variable headers
		// All is taken into account for remaining length.
		remainder.putBuffer(bodyBuf);
		remainder.flip();
	
		// Calculate the length and the "remaining length" bytes.
		var len = remainder.limit;
		var remainingLengthBytes = encodeRemainingLengthBytes(len);
	
		// Put the rest of the message in the frame.
		frame.putBuffer(remainingLengthBytes);
		frame.putBuffer(remainder);
	}
	
	// flip the frame buffer
	frame.flip();
	debugLog("Frame to send for: " + command + ":");
	debugLog(debugByteBufferAsHex(frame)); 
	
	// Send the frame buffer
	socket.send(frame);
	
	// Set this as the connection is still active
	// (per MQTT 3.1 spec, keep alive only affects sends, not receives,
	// i.e. the server must receive some kind of message from the current client
	// within the keep alive interval set on the CONNECT command (if this is > 0).
	setLastMessageTimestamp();
}

/**
 * Builds the appropriate fixed two-byte header for the command
 *
 * @param command - the command string for the current MQTT command
 * @param headers - array of message header values to include by setting the appropriate bits
 */
function buildFixedHeader(command, headers)
{
	var code = MSG_TYPES_STRINGS_TO_CODES[command];
	
	var val = 0x00;
	// Set msg type = command.
	val |= code;
	
	// According to 3.1.1 spec, the two QoS bits are reserved
	// and must always be set to "1" for SUBSCRIBE.
	// QoS for each topic subscription is specified
	// in the variable headers, not here.
	var QoS = command == "SUBSCRIBE" ? QOS_AT_LEAST_ONCE : (headers["QoS"] || QOS_AT_MOST_ONCE);

	// Remaning bits, left to right:
	// RETAIN (1), QoS (2 bits) and DUP flag (1).
	// Set only QoS.
	// NOTE = here we need to shift QoS to the left 1 bit.
	// The first bit is for RETAIN and we won't set it.
	QoS = QoS << 1;
	val |= QoS;
	
	// DUP bit.
	var isDuplicate = headers["isDuplicate"] || false;

	if (isDuplicate)
	{
		// Set bit 3 to 1
		var dup = 1 << 3;
		val |= dup;
	}
	
	if (command == "PUBLISH")
	{
		var itRetainsLast = headers["retainLast"] || false;
	
		if (itRetainsLast)
		{
			// Set bit 0 to 1
			var retain = 1 >> 0;
			val |= retain;
		}
	}
	
	return val;
}

/**
 * Builds the appropriate variable header buffer for the command and header values
 *
 * @param command - the command string for the current MQTT command
 * @param headers - array of message header values to include by setting the appropriate bits (not used yet)
 */
function buildVariableHeaders(command, headers)
{
	switch (command)
	{
		case "CONNECT":
			return buildCONNECTHeaders(headers);
			break;
		case "SUBSCRIBE":
			return buildSUBSCRIBEHeaders(headers);
			break;
		case "UNSUBSCRIBE":
			return buildUNSUBSCRIBEHeaders(headers);
			break;
		case "PUBLISH":
			return buildPUBLISHHeaders(headers);
			break;
		case "PUBACK":
			return buildPUBACKHeaders(headers);
			break;
		case "PUBREL":
			return buildPUBRELHeaders(headers);
			break;
		default:
			throw "Command not recognized: " + command;
			break;
	}
}

function buildCONNECTHeaders(headers)
{
	var buf = new ByteBuffer();
	// Next, mandatory UTF-8 encoded protocol name:
	// Case is significant
	writeMQTTUTF8String(buf, PROTOCOL_NAME);

	// Protocol
	buf.put(PROTOCOL_VERSION);

	// CONNECT flags 
	
	// Set user and password bits
	var user = headers["username"];
	var pwd = headers["password"] || "";

	// Set up CONNECT_FLAGS byte
	// Right shift to convert to 32 bits
	var cxFlags = 0x00 >> 0;
	
	if (user)
	{
		// Set user, password bits
		// If user is provided, password must be.
		// Set highest two bits.
		cxFlags |= SEND_USER_PWD;
	}
	
	// Next bit, left to right - Will RETAIN - leave at 0
	// Next bit, Will flag
	// Next two bits, Will QoS - leave at 0
	if (MQTT_LAST_WILL_ENABLED)
	{
		// Set Last Will flag.
		cxFlags |= LAST_WILL_FLAG;
		
		// Default for Last Will QoS is 0
		var lwQoS = headers["lastWillQoS"] || 0;
		if (lwQoS > 0)
		{
			// Convert to 32 bit
			lwQoS = lwQoS >> 0;
			// Shift to the left 3 places
			// as Last Will QoS occupies bits 3 and 2 right to left
			lwQoS = lwQoS << 3;
			cxFlags |= lwQoS;
		}
		// Will Retain
		var lwRetain = headers["lastWillRetain"] || false;
		if (lwRetain)
		{
			// Set bit 5 right to left
			cxFlags |= LAST_WILL_RETAIN;
		}
	}
		
	// Next bit - Clean bit - set
	cxFlags = cxFlags | CONNECT_CLEAN_FLAG;
	// Eighth bit is reserved.
	
	// Byte 10
	buf.put(cxFlags);
	
	// Keep Alive
	// bytes 11 and 12
	// Default is 0, do not disconnect
	var cxKeepAlive = headers["keepAlive"] || 0;
	
	var highbyte = getHighByte(cxKeepAlive);
	var lowbyte = getLowByte(cxKeepAlive);
	
	buf.put(highbyte);
	buf.put(lowbyte);

	return buf;
}	

function buildSUBSCRIBEHeaders(headers)
{
	// This might be returned empty but we can't return null.
	var buf = new ByteBuffer();
	
	// Message identifier - two bytes.
	var QoS = headers["topicQoS"] || QOS_AT_LEAST_ONCE;
	
	if (QoS > QOS_AT_MOST_ONCE)
	{
		var msgID = headers["msgID"];
		if  (msgID == null)
			throw "Message ID must be provided for SUBSCRIBE and QoS" + (QoS >> 1);
	
		var highbyte = getHighByte(msgID);
		var lowbyte = getLowByte(msgID);
	
		buf.put(highbyte);
		buf.put(lowbyte);
	}

	return buf;
}

function buildUNSUBSCRIBEHeaders(headers)
{
	// These happen to be the same as for SUBSCRIBE.
	return buildSUBSCRIBEHeaders(headers);
}

function buildPUBLISHHeaders(headers)
{
	// This might be returned empty but we can't return null.
	var buf = new ByteBuffer();
	
	var destination = headers["destination"];
	if (!destination)
		throw "Topic name must be provided for SUBSCRIBE";

	writeMQTTUTF8String(buf, destination);
	
	// Message identifier - two bytes.
	var QoS = headers["QoS"];
	
	if (QoS > QOS_AT_MOST_ONCE)
	{
		var msgID = headers["msgID"];
		if  (msgID == null)
			throw "Message ID must be provided for SUBSCRIBE and QoS" + (QoS >> 1);
	
		var highbyte = getHighByte(msgID);
		var lowbyte = getLowByte(msgID);
	
		buf.put(highbyte);
		buf.put(lowbyte);
	}

	return buf;
}

function buildPUBACKHeaders(headers)
{
	// This might be returned empty but we can't return null.
	var buf = new ByteBuffer();
	
	var msgID = headers["msgID"];
	if  (msgID == null)
		throw "Message ID must be provided for PUBACK";
	
	var highbyte = getHighByte(msgID);
	var lowbyte = getLowByte(msgID);
	
	buf.put(highbyte);
	buf.put(lowbyte);

	return buf;
}

function buildPUBRELHeaders(headers)
{
	// This might be returned empty but we can't return null.
	var buf = new ByteBuffer();
	
	var msgID = headers["msgID"];
	if  (msgID == null)
		throw "Message ID must be provided for PUBACK";
	
	var highbyte = getHighByte(msgID);
	var lowbyte = getLowByte(msgID);
	
	buf.put(highbyte);
	buf.put(lowbyte);

	return buf;
}

/**
 * Builds the appropriate variable header buffer for the command and header values
 *
 * @param command - the command string for the current MQTT command
 * @param headers - array of message header values to include by setting the appropriate bits (not used yet)
 * @param headers - message body (if any)
 */
function buildPayload(command, headers, body)
{
	switch (command)
	{
		case "CONNECT":
			// Ignore any body
			return buildConnectPayload(headers);
			break;
		case "SUBSCRIBE":
			// Ignore any body
			return buildSubscribePayload(headers);
			break;
		case "UNSUBSCRIBE":
			// Ignore any body
			return buildUnsubscribePayload(headers);
			break;
		case "PUBLISH":
			return buildPublishPayload(body);
			break;
		case "PUBACK":
		case "PUBREL":
			// Ignore any body
			// No payload
			return new ByteBuffer();
			break;
		default:
			throw "Command not recognized: " + command;
			break;
	}
}

function buildConnectPayload(headers)
{
	var cid = headers["clientID"];
	if ((!cid) || (cid.length < 0))
		throw "Client ID must be provided!";
		
	var user = headers["username"];
	var pwd = username? headers["password"] : null;
	
	if (user && ((pwd == null) || pwd.trim().length == 0))
	{
		throw "Password must be provided for username!";
	}

	var lwTopic = null;
	var lwMsg = null;
	
	if (MQTT_LAST_WILL_ENABLED)
	{
		lwTopic = headers["lastWillTopic"] || null;
		if ((!lwTopic) || (lwTopic.length < 1))
			throw "If Last Will is enabled, a topic name must be provided."
			
		lwMsg = headers["lastWillMsg"] || null;
		if ((!lwMsg) || (lwMsg.length < 1))
			throw "If Last Will is enabled, a last will message must be provided."
	}
	
	var payload = new ByteBuffer();
	writeMQTTUTF8String(payload, cid);
	
	if (MQTT_LAST_WILL_ENABLED)
	{
		writeMQTTUTF8String(payload, lwTopic);
		writeMQTTUTF8String(payload, lwMsg);
	}
	
	// Next is the Will Topic. We won't use for now.
	
	// Next is the Will message. We won't use for now.
	
	// Next, username / password.
	if (user)
	{
		writeMQTTUTF8String(payload, user);
		writeMQTTUTF8String(payload, pwd);
	}
	
	// Set it for reading.
	payload.flip();
	return payload;
}

function buildSubscribePayload(headers)
{
	var destination = headers["destination"];
	if ((!destination) || (destination.length < 1))
		throw "Topic name must be provided for SUBSCRIBE";
		
	var payload = new ByteBuffer();
	writeMQTTUTF8String(payload, destination);
	
	var QoS = headers["QoS"];
	payload.put(QoS);
	// Set it for reading.
	payload.flip();
	return payload;
}

function buildUnsubscribePayload(headers)
{
	var destination = headers["destination"];
	if ((!destination) || (destination.length < 1))
		throw "Topic name must be provided for UNSUBSCRIBE";
		
	var payload = new ByteBuffer();
	writeMQTTUTF8String(payload, destination);
	
	// Set it for reading.
	payload.flip();
	return payload;
}

function buildPublishPayload(body)
{
	// All payloads in MQTT are handled as BLOBs.
	// It is up to each application to interpret the data.
	// The payload can be zero-length.
	var payload = new ByteBuffer();
	
	// Our body is a string; let's convert it to UTF8 bytes.
	// However, this must not include a length field, so we won't use
	// writeMQTTUTF8String().
	// The length is part of the total variable length which
	// will be calculated by writeFrame().
	if (body && body.length > 0)
	{
		payload.putString(body, Charset.UTF8);	
	}
	
	// Set it for reading.
	payload.flip();
	return payload;
}

/** 
* Global scope variables that will be re-used if the message in question
* consists of multiple WebSocket frames.
*/
function initMessageVars()
{
	buffer = new ByteBuffer();
	payload = new ByteBuffer();
	payloadComplete = false;
	remainingLen = 0;
	publishQoS = 0;
	publishMessageID = -1;
	pubrecMessageID = -1;
	opCode = MQTT_NONE;
}

function readFragment(event)
{
	// append new data to the buffer
	var data = event.data;

	var cb = function(result) 
	{
		// Wrap the new data.
		var buf = new ByteBuffer(result);
		
		if (buf.limit == 2)
		{
			// Take a peek to see if this is a PINGRESP
			// which can come in the middle of processing
			// frames for another message.
			var firstByte = buf.getAt(0) >> 0;
			var tempCode = firstByte & 0xf0;
			var secondByte = buf.getAt(1) >> 0;

			if (tempCode === MSG_TYPES_STRINGS_TO_CODES["PINGRESP"])
			{
				secondByte = buf.getAt(1) >> 0;
				log("PINGRESP received. Remaining length: " + secondByte);
				return;
			}
			else
			{
				log("Unknown 2 byte fragment received. Ignoring.");
				return;
			}
		}
		

		// Remove the byte already processed.
		buf.compact();

		if (remainingLen == 0)
		{
			// We are not currently processing frames for an op.
			// This also reinitializes the buffer.
			initMessageVars();
		}
		else
		{
			// We are continuing processing.
			// This is so the data we append will go on the end.
			// NOTE - this assumes at some point we will remove
			// what has already been processed by using "slice" or "compact"
			// before returning.
			buffer.skip(buffer.remaining());
		}
		
		buffer.putBuffer(buf);
		// Prepare the buffer for reading
		buffer.flip();
		 
		if (remainingLen == 0)
		{
			// message / op type is in the first byte
			// It is in the high bits.
			var b1 = buffer.get() >> 0;
			// Strip off low bits
			opCode = b1 & 0xf0;
			
			// We are processing new data for a new message (type).
			if ((opCode < MQTT_LOWEST_OP) && (opCode > MQTT_HIGHEST_OP))
			{
				// Invalid state or buffer.
				log("Invalid MQTT message type: " + opCode + ". Data ignored.");
				buffer.clear();
				// This will trigger re-initialization of variables on next read
				remainingLen = 0;
				return;
			}
		
			if (opCode === MSG_TYPES_STRINGS_TO_CODES["PUBLISH"])
			{
				// Fetch and set the received QoS
				// Strip off all but bits 1 and 2
				// and shift 
				publishQoS = (b1 & 0x06) >> 1;
			}
			
			// Fetch the DUP bit.
			dup = b1 & 0x08;
			dup = dup >> 3;
			
			if (dup == 1)
				log("Duplicate message received for command: " + MSG_TYPES_CODES_TO_STRINGS[opCode]);

			// Calculate the remaining length
			remainingLen = decodeRemainingLength(buffer);
			
			// Fetch the variable headers.
			var variableHeaders = fetchVariableHeaders(buffer, opCode);
			var headersOK = processVariableHeaders(variableHeaders, opCode);
				
			if (!headersOK)
			{
				log("Remaining message data will be ignored.");
				buffer.clear();
				// This will trigger re-initialization of variables on next read
				remainingLen = 0;
				return;
			}
				
			if (opCode === MSG_TYPES_STRINGS_TO_CODES["CONNACK"])
			{
				if (connectKeepAlive > 0)
				{
					// Start the timer that checks keep alive time.
					// Convert keep alive to milliseconds.
					keepAliveTimer = setInterval(function(){checkKeepAlive()}, (connectKeepAlive*1000));
				}
			}

			if (variableHeaders != null)
			{
				// Deduct what we have already processed.
				remainingLen = remainingLen - variableHeaders.position;
			}
			
			log(MSG_TYPES_CODES_TO_STRINGS[opCode] + " total payload length to be retrieved: " + remainingLen); 
		}

		payloadComplete = fetchPayload(buffer);
		// compact the buffer
		// This slices off what has already been processed.
		buffer.compact();
		
		if (payloadComplete)
		{
			var result = processPayload(opCode);
			
			if (result)
			{
				if (publishMessageID > -1)
				{
					if (publishQoS == 1)
					{
						writeFrame("PUBACK", {"msgID" : publishMessageID});
					}
					else if (publishQoS == 2)
					{
						// PUBREC always sets QoS to AT MOST ONCE.
						writeFrame("PUBREC", {"msgID" : publishMessageID, "QoS" : QOS_AT_MOST_ONCE});
					}
					// TODO - handle receiving a PUBLISHed message with QoS == 2.
					// This will require testing with an MQTT provider other than
					// Apache MQ 5.9.1 / 5.10.0 as that always PUBLISHes messages with
					// QoS = 0, no matter what a client specifies when PUBLISHing.
				}
				else if (pubrecMessageID > -1)
				{
					// PUBREL always sets QoS to AT LEAST ONCE.
					writeFrame("PUBREL", {"msgID" : pubrecMessageID, "QoS" : QOS_AT_LEAST_ONCE});
					if (mustSendDuplicate(QOS_AT_LEAST_ONCE))
						writeFrame("PUBREL", {"msgID" : pubrecMessageID, "QoS" : QOS_AT_LEAST_ONCE, "isDuplicate" : true});
				}
			}
		}
    };
	
	var arr = BlobUtils.asNumberArray(cb, data);
}

function checkKeepAlive()
{
	if (isKeepAliveExpired())
	{
		if (MQTT_SIMULATE_CLIENT_DOWN)
		{
			log("Simulating down client. PINGREQ message will not be sent.");
			return;
		}
		
		writeFrame("PINGREQ", {});
	}
}

function fetchVariableHeaders(buffer, opCode)
{
	var rtrn = null;
	
	switch (opCode)
	{
		case MSG_TYPES_STRINGS_TO_CODES["CONNACK"]:
		case MSG_TYPES_STRINGS_TO_CODES["SUBACK"]:
		case MSG_TYPES_STRINGS_TO_CODES["UNSUBACK"]:
		case MSG_TYPES_STRINGS_TO_CODES["PUBACK"]:
		case MSG_TYPES_STRINGS_TO_CODES["PUBREC"]:
		case MSG_TYPES_STRINGS_TO_CODES["PUBCOMP"]:
			rtrn = fetchBasicVariableHeaders(buffer);
			break;
		case MSG_TYPES_STRINGS_TO_CODES["PUBLISH"]:
			rtrn = fetchPUBLISHVariableHeaders(buffer);
			break;
		// TODO add more cases
		default:
			break;
	}
	
	if (rtrn != null)
		rtrn.flip();
		
	return rtrn;
}

function fetchBasicVariableHeaders(buffer)
{
	var rtrn = new ByteBuffer();

	// Fetch the message ID.
	rtrn.put(buffer.get() >> 0);
	rtrn.put(buffer.get() >> 0);
	
	return rtrn;
}

function fetchPUBLISHVariableHeaders(buffer)
{
	var rtrn = new ByteBuffer();
	// Fetch the topic name length.
	var byt1 = buffer.get() >> 0;
	byt1 = byt1 << 16;
	var byt2 = buffer.get() >> 0;
	var strlen = byt1 || byt2;
	// NOTE - we will write the length of the topic name
	// so the processing logic knows how long the topic string is.
	rtrn.put(byt1);
	rtrn.put(byt2);
	
	for (var i = 0; i < strlen; i++)
	{
		rtrn.put(buffer.get() >> 0);
	}
	
	if (publishQoS > 0)
	{
		// Fetch the message ID.
		rtrn.put(buffer.get() >> 0);
		rtrn.put(buffer.get() >> 0);
	}
	
	return rtrn;
}

function processVariableHeaders(buffer, opCode)
{
	var rtrn = false;

	switch (opCode)
	{
		case MSG_TYPES_STRINGS_TO_CODES["CONNACK"]:
			rtrn = processCONNACKHeaders(buffer);
			break;
		case MSG_TYPES_STRINGS_TO_CODES["SUBACK"]:
			rtrn = processSUBACKHeaders(buffer);
			break;
		case MSG_TYPES_STRINGS_TO_CODES["UNSUBACK"]:
			rtrn = processUNSUBACKHeaders(buffer);
			break;
		case MSG_TYPES_STRINGS_TO_CODES["PUBACK"]:
			rtrn = processPUBACKHeaders(buffer);
			break;
		case MSG_TYPES_STRINGS_TO_CODES["PUBREC"]:
			rtrn = processPUBRECHeaders(buffer);
			break;
		case MSG_TYPES_STRINGS_TO_CODES["PUBCOMP"]:
			rtrn = processPUBCOMPHeaders(buffer);
			break;
		case MSG_TYPES_STRINGS_TO_CODES["PUBLISH"]:
			rtrn = processPUBLISHHeaders(buffer);
			break;
		// TODO add more cases
		default:
			rtrn = false;
			break;
	}
	
	return rtrn;
}

function processCONNACKHeaders(buffer)
{
	// Ignore the first byte
	var b = buffer.get() >> 0;
	b = buffer.get() >> 0;
	var rtrn = null;
	
	// The following cases for CONNACK return codes are per the 3.1 MQTT specification.
	switch(b)
	{
		case 0x00:
			log("CONNACK Connection Accepted.");
			rtrn = true;
			break;
		case 0x01:
			log("CONNACK Connection Refused: unacceptable protocol version.");
			rtrn = false;
			break;
		case 0x02:
			log("CONNACK Connection Refused: identifier rejected.");
			rtrn = false;
			break;
		case 0x03:
			log("CONNACK Connection Refused: server unavailable (for this client - non-unique client ID?).");
			rtrn = false;
			break;
		case 0x04:
			log("CONNACK Connection Refused: bad user name or password.");
			rtrn = false;
			break;
		case 0x05:
			log("CONNACK Connection Refused: not authorized.");
			rtrn = false;
			break;
		default:
			log("CONNACK Illegal return code: Reserved for future use");
			rtrn = false;
			break;
	}
	
	return rtrn;
}

function processSUBACKHeaders(buffer)
{
	var byt1 = buffer.get() >> 0;
	// The first byte is the MSB of the message ID of the SUBSCRIBE message being acknowledged.
	// The second byte is the LSB of that message ID.
	byt1 = byt1 << 8;
	var byt2 = buffer.get() >> 0;
	var ackID = byt1 || byt2;
	var rtrn = true;
	
	log("SUBACK (SUBSCRIBE acknowledgement) received for message ID: " + ackID);
	
	return true;
}

function processUNSUBACKHeaders(buffer)
{
	var byt1 = buffer.get() >> 0;
	// The first byte is the MSB of the message ID of the SUBSCRIBE message being acknowledged.
	// The second byte is the LSB of that message ID.
	byt1 = byt1 << 8;
	var byt2 = buffer.get() >> 0;
	var ackID = byt1 || byt2;
	var rtrn = true;
	
	log("UNSUBACK (UNSUBSCRIBE acknowledgement) received for message ID: " + ackID);
	
	return true;
}

function processPUBACKHeaders(buffer)
{
	var byt1 = buffer.get() >> 0;
	// The first byte is the MSB of the message ID of the SUBSCRIBE message being acknowledged.
	// The second byte is the LSB of that message ID.
	byt1 = byt1 << 8;
	var byt2 = buffer.get() >> 0;
	var ackID = byt1 || byt2;
	var rtrn = true;
	
	log("PUBACK (PUBLISH acknowledgement) received for message ID: " + ackID);
	
	return true;
}

function processPUBRECHeaders(buffer)
{
	var byt1 = buffer.get() >> 0;
	// The first byte is the MSB of the message ID of the SUBSCRIBE message being acknowledged.
	// The second byte is the LSB of that message ID.
	byt1 = byt1 << 8;
	var byt2 = buffer.get() >> 0;
	pubrecMessageID = byt1 || byt2;
	var rtrn = true;
	
	log("PUBREC (assured PUBLISH received part 1) received for message ID: " + pubrecMessageID);
	
	return true;
}

function processPUBCOMPHeaders(buffer)
{
	// Ignore the first byte
	var byt1 = buffer.get() >> 0;
	// The first byte is the MSB of the message ID of the SUBSCRIBE message being acknowledged.
	// The second byte is the LSB of that message ID.
	byt1 = byt1 << 8;
	var byt2 = buffer.get() >> 0;
	var ackID = byt1 || byt2;
	var rtrn = true;
	
	log("PUBCOMP (assured PUBLISH received part 2) received for message ID: " + ackID);
	
	return true;
}

function processPUBLISHHeaders(buffer)
{
	try{
	
		// Fetch the topic name length.
		var byt1 = buffer.get() >> 0;
		byt1 = byt1 << 16;
		var byt2 = buffer.get() >> 0;
		var strlen = byt1 || byt2;

		// Copy the topic name into a temp buffer
		var topicTemp = new ByteBuffer();
		for (var i = 0; i < strlen; i++)
			topicTemp.put(buffer.get());
		
		// Read the topic name
		topicTemp.flip();
		topicName = topicTemp.getString(Charset.UTF8);

		if (publishQoS > 0)
		{
			var byt1 = buffer.get() >> 0;
			// The first byte is the MSB of the message ID of the SUBSCRIBE message being acknowledged.
			// The second byte is the LSB of that message ID.
			byt1 = byt1 << 8;
			var byt2 = buffer.get() >> 0;
			publishMessageID = byt1 || byt2;
			log("PUBLISH message received from topic name: " + topicName + ", QoS: " + publishQoS + ", message ID: " + msgIDStr);
		}
		else
		{
			log("PUBLISH message received from topic name: " + topicName + ", QoS: " + publishQoS);
		}
	
		return true;
	}
	catch(err)
	{
		log("Unable to process PUBLISH message headers: " + err);
	}
}

function fetchPayload(buffer)
{
	// Optimization
	if (remainingLen == 0)
		return true;
		
	var amountToFetch = buffer.remaining() >= remainingLen? remainingLen : buffer.remaining();
	
	if (amountToFetch > 0)
	{
		var payloadSlice = buffer.getBytes(amountToFetch);
		payload.putBytes(payloadSlice);
		remainingLen = remainingLen - amountToFetch;
	}	

	var isComplete = (remainingLen == 0);

	if (isComplete)
		payload.flip();

	return isComplete;
}

function processPayload(opCode)
{
	switch (opCode)
	{
		case MSG_TYPES_STRINGS_TO_CODES["CONNACK"]:
		case MSG_TYPES_STRINGS_TO_CODES["PUBACK"]:
		case MSG_TYPES_STRINGS_TO_CODES["PUBREC"]:
		case MSG_TYPES_STRINGS_TO_CODES["PUBCOMP"]:
			return true;
		case MSG_TYPES_STRINGS_TO_CODES["SUBACK"]:
			return processSUBACKPayload();
			break;
		case MSG_TYPES_STRINGS_TO_CODES["PUBLISH"]:
			return processPUBLISHPayload();
			break;
		// TODO add more cases
		default:
			return false;
			break;
	}
}

function processSUBACKPayload()
{
	// Payload is a vector of QoS values, once for each topic.
	// Since we only allow subscribing to one topic at a time in this client,
	// there will be one.
	var subQoS = payload.get();
	log("QoS for SUBACK: " + subQoS);
	return true;
}

function processPUBLISHPayload()
{
	// We will assume it is a UTF8 string.
	try
	{
		if ((payload != null) && (payload.limit > 0))
		{
			var payloadStr = payload.getString(Charset.UTF8);
			log("Received PUBLISHed message:");
			log(payloadStr);
		}
		else
		{
			log("Received PUBLISHed message: <BLANK>");
		}
		
		return true;
	}
	catch(err)
	{
		log("Unable to process PUBLISHed message payload (not a UTF-8 string?): " + err);
		return false;
	}
}

/// **************************************************************
/// UTILITY FUNCTIONS
/// **************************************************************

function writeMQTTUTF8String(buffer, str)
{
	// For MQTT, each UTF-8 string is prefixed with its two-byte length.
	// For simplicity we will disallow strings > 32767
	// since we only have two bytes to encode their length.
	// We must measure its encoded length.
	var tmp = new ByteBuffer();
	tmp.putString(str, Charset.UTF8);
	tmp.flip();
	var len = tmp.limit;
	if (len > 32767)
		throw "String: " + str + " is too long for MQTT!";

	var highbyte = getHighByte(len);
	var lowbyte = getLowByte(len);
	
	buffer.put(highbyte);
	buffer.put(lowbyte);
	
	buffer.putBuffer(tmp);
}

function getHighByte(input)
{
	// Convert to 32 bit first.
	var temp = input >> 0;
	// Strip off high 16 bits.
	temp = temp << 16;
	temp = temp >> 16;
	// Get value of high 8 bits.
	return Math.floor(temp / 256);
}

function getLowByte(input)
{
	// Convert to 32 bit first.
	var temp = input >> 0;
	// Strip off high 16 bits.
	temp = temp << 16;
	temp = temp >> 16;
	return temp % 256;
}

function testEncodeDecodeRemainingLength()
{
	// Various encodings:
	
	// Lower bound producing one byte
	var encoded = encodeRemainingLengthBytes(0);
	var decoded = decodeRemainingLength(encoded);

	// Upper bound producing one byte
	encoded = encodeRemainingLengthBytes(127);
	decoded = decodeRemainingLength(encoded);
	
	// Lower bound producing two bytes
	encoded = encodeRemainingLengthBytes(128);
	decoded = decodeRemainingLength(encoded);
	
	// Upper bound producing two bytes
	encoded = encodeRemainingLengthBytes(16383);
	decoded = decodeRemainingLength(encoded);

	// Lower bound producing three bytes
	encoded = encodeRemainingLengthBytes(16384);
	decoded = decodeRemainingLength(encoded);

	// Upper bound producing three bytes
	encoded = encodeRemainingLengthBytes(2097151);
	decoded = decodeRemainingLength(encoded);

	// Lower bound producing four bytes
	encoded = encodeRemainingLengthBytes(2097152);
	decoded = decodeRemainingLength(encoded);

	// Upper bound producing four bytes
	encoded = encodeRemainingLengthBytes(268435455);
	decoded = decodeRemainingLength(encoded);
}

function encodeRemainingLengthBytes(len)
{
	var copy = len;
	
	var encoded = new ByteBuffer();
	
	do
	{
		var digit = copy % 0x80;
		copy = Math.floor(copy / 0x80);
		// If there are more digits to encode, set the top bit of this digit
		if ( copy > 0)
			digit |= 0x80;
		encoded.put(digit);
	}
	while (copy > 0);
	
	encoded.flip(); 
	
	return encoded;
}

function decodeRemainingLength(encoded)
{
	// Depending on the value returned,
	// the caller may have to adjust pos.
	var copy = encoded;

	var multiplier = 1;
	var decoded = 0x00;
	var digit = 0x00;
	
	do
	{
		// We have to strip off upper bit
		// as it does NOT mean "negative" here.
		// >> converts to 32-bit integer.
		var digit = encoded.get() >> 0;
		var masked = digit & 0x7F;
		
		decoded += masked * multiplier;
		multiplier *= 128;
	}
	while ((digit & 0x80) != 0);
	
	return decoded;
}

var headerToString = function(headers)
{
	var str = null;
	
	for (var hdr in headers)
	{
		if (!str)
			str = "";
		else 
			str = str + ", ";
		
		var headerVal = headers[hdr]; 
		var strVal = headerVal === 0? "0": 
			(headerVal? headerVal: "<BLANK>");
			
		str = str + hdr + " : " + strVal;
	}
	
	return str;
}

function debugLog(s)
{
	if (DEBUG_MQTT)
		log(s);
}

function log(s)
{
	var p = document.createElement("p");
	p.style.wordwrap = "break-word";
	p.textContent = s;
	output.appendChild(p);
	
	var children = output.childNodes;
	while (children && children.length > 100)
		output.removeChild(children[0]);
}

function clearLog()
{
	var children = output.childNodes;
	while (children && children.length > 0)
		output.removeChild(children[0]);
}

function calculateMessageID()
{
	var rtrn = messageID++;
	
	// We are limited to 2^16 unsigned ID
	if (messageID > 65535)
	{
		// Overflow; could be an issue when a lot of messages are sent.
		messageID = 0;
	}
	
	return rtrn;
}

function setLastMessageTimestamp()
{
	lastMessageTimestamp = Math.round(new Date().getTime() / 1000);
}

function isKeepAliveExpired()
{
	if (connectKeepAlive = 0)
		return false;
		
	var currentTime = Math.round(new Date().getTime() / 1000);
	return currentTime - lastMessageTimestamp > connectKeepAlive;
}

var hexChar = ["0", "1", "2", "3", "4", "5", "6", "7","8", "9", "A", "B", "C", "D", "E", "F"];
 
function byteToHex(b) 
{
  return hexChar[(b >> 4) & 0x0f] + hexChar[b & 0x0f];
}

function debugByteBufferAsHex(buf)
{
	if (!DEBUG_MQTT)
		return "";
		
	var hex = "";

	for (var i = 0; i < buf.limit; i++)
	{
		var byt = buf.getAt(i);
		hex = hex + byteToHex(byt) + " ";
	}
	
	return hex;
}

function printEventDataAsHex(event)
{
	if (!DEBUG_MQTT)
		return;

	var cb = function(result)
	{
		var hex = "";
		
		var buf = new ByteBuffer(result);
		
		while (buf.hasRemaining())
		{
			var byt = buf.get();
			hex = hex + byteToHex(byt) + " ";
		}
		
		log ("Received event data (as hex):");
		log(hex);
	}
	
	BlobUtils.asNumberArray(cb, event.data);
}
