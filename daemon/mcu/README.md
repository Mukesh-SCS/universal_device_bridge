#MCUDaemon

LightweightUDBdaemonformicrocontrollersandresource-constraineddevices.

##AvailableImplementations

###Node.jsReference(`udbd-mcu.js`)

AminimalNode.jsimplementationfortestingandasareferencefornativeports:

```bash
nodedaemon/mcu/udbd-mcu.js--namemy-mcu--tcp9910
```

Features:
-Single-connectionmodel(oneclientatatime)
-Minimalmemoryfootprint
-Built-incommands:help,info,uptime,memory,gpio,reboot
-Customcommandhandlersupport
-Noexternaldependencies

##QuickStart

```bash
#StarttheMCUdaemon
nodedaemon/mcu/udbd-mcu.js--nametest-mcu

#Inanotherterminal
udbpair127.0.0.1:9910
udbexec"info"
udbexec"uptime"
udbexec"memory"
```

##Built-inCommands

|Command|Description|
|---------|-------------|
|`help`|Listavailablecommands|
|`info`|Deviceinformation|
|`uptime`|Secondssincestart|
|`memory`|Heapmemoryusage|
|`gpio`|GPIOstatus(simulated)|
|`reboot`|Rebootdevice(simulated)|

##Configuration

```bash
#Customdevicename
nodedaemon/mcu/udbd-mcu.js--namemy-device

#Customport
nodedaemon/mcu/udbd-mcu.js--tcp9920

#Manualpairingmode
nodedaemon/mcu/udbd-mcu.js--pairingmanual

#Customcommandhandler
nodedaemon/mcu/udbd-mcu.js--exec./my-handler.js
```

##CustomCommandHandler

CreateaJavaScriptmodulewithan`exec`function:

```javascript
//my-handler.js
exportfunctionexec(cmd){
if(cmd==="ledon"){
//Yourcustomlogichere
return{stdout:"LEDturnedon\n",stderr:"",code:0};
}
returnnull;//Fallthroughtobuilt-incommands
}
```

##DesignGoals

1.**Minimalfootprint**-Singleconnection,limitedbuffers
2.**Noexternaldependencies**-PureNode.js(ornativeC)
3.**Subsetprotocol**-Coreoperationsonly
4.**Embedded-friendly**-EasytoporttoC/C++

##ProtocolSubset

TheMCUdaemonimplementsaminimalsubsetoftheUDBprotocol:

|Message|Supported|
|---------|-----------|
|HELLO|Yes|
|AUTH_CHALLENGE/RESPONSE|Yes|
|PAIR_REQUEST|Yes|
|UNPAIR_REQUEST|Yes|
|STATUS|Yes|
|EXEC|Yes|
|PUSH/PULL|No|
|OPEN_SERVICE|No|

##NativeCImplementation(Future)

Directorystructurefornativeports:

```
daemon/mcu/
├──udbd-mcu.js#Node.jsreference
├──native/
│├──src/
││├──protocol.c#Messageparsing
││├──auth.c#Crypto(Ed25519)
││├──handlers.c#Messagehandlers
││└──main.c#Entrypoint
│├──hal/
││├──esp32/#ESP-IDFHAL
││├──stm32/#STM32HAL
││└──rp2040/#PicoSDKHAL
│└──CMakeLists.txt
└──README.md
```

##Contributing

Nativeportswelcome!TheNode.jsimplementationservesasaspecification.

##Contributing

MCUsupportisasignificantundertaking.Ifinterested:

1.StartwithESP32(mostresources,WiFibuilt-in)
2.Implementminimalprotocolsubset
3.Testwithexistingclient/CLI
4.Expandtootherplatforms
