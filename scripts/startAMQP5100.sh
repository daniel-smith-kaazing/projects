#!/bin/sh
CURDIR=`dirname $0`
$CURDIR/addIPToEtcHosts.sh container.kaazing.com
/usr/share/kaazing/jms/4.0/apache-activemq-5.10.0/bin/activemq start
