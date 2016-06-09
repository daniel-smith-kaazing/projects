#!/bin/sh
CURDIR=`dirname $0`
$CURDIR/addIPToEtcHosts.sh container.kaazing.com
/usr/share/kaazing/jms/4.0/bin/gateway.start --config /usr/share/kaazing/jms/4.0/conf/gateway-config-KGS-979.xml
