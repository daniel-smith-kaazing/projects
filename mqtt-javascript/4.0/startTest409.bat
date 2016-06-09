@REM example Windows batch file for loading our MQTT demo config and starting the gateway
@setlocal
@echo off
@rem The next three lines are necessary due to classpath syntax
if "%OS%" == "Windows_NT" SETLOCAL EnableDelayedExpansion
verify other 2>nul
SETLOCAL enableextensions
@REM Change this to a full path to GATEWAY_HOME
@REM Also the working directory for executing this script must be on the same drive
set GW_HOME=E:\kaazing-websocket-gateway-4.0.9
set ROOTDIR=%~dp0
@REM Use GW_CONFIG to load our config but load the rest from the default gateway conf directory
set GW_CONFIG=%ROOTDIR%config
%GW_HOME%\bin\gateway.start.bat --config %GW_CONFIG%\gateway-config-mqtt-amq.xml

