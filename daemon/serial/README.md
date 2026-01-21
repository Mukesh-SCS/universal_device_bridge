#SerialTransport

SerialporttransportforUDB-enablescommunicationwithembeddeddevicesandMCUsoverserial/UART.

##Overview

TheserialtransportusestheexactsameprotocolasTCP,provingthatUDB'stransportabstractionworkscorrectly.Noprotocolchangeswererequired.

##Installation

Theserialtransportrequiresthe`serialport`npmpackage:

```bash
npminstallserialport
```

##Usage

###ClientSide

```javascript
import{createSerialTransport,tcpRequest}from"@udb/client";

//Createaserialtransport
consttransport=createSerialTransport("COM3",{
baudRate:115200,
timeout:10000
});

//UsewithtcpRequest(nameismisleading,workswithanytransport)
constresult=awaittcpRequest(null,messages,{transport});
```

###URLFormat

SerialtargetscanbespecifiedasURLs:

```
serial://COM3
serial:///dev/ttyUSB0
serial://COM3?baud=9600
```

###DaemonSide

Runtheserialdaemononthedevice:

```bash
#Basicusage
nodeserial-daemon.js--port/dev/ttyUSB0

#Withoptions
nodeserial-daemon.js--portCOM3--baud115200--namemy-device--verbose
```

##VirtualSerialPortsforTesting

###Windows

Use[com0com](https://sourceforge.net/projects/com0com/)tocreatevirtualserialportpairs.

```
#Installcom0com
#CreatesCOM10<->COM11pairbydefault
```

###Linux

Use`socat`tocreatevirtualserialportpairs:

```bash
#Createpair
socat-d-dpty,raw,echo=0pty,raw,echo=0

#Outputwillshowpathslike:
#/dev/pts/2<->/dev/pts/3
```

###macOS

Use`socat`(installviaHomebrew):

```bash
brewinstallsocat
socat-d-dpty,raw,echo=0pty,raw,echo=0
```

##SupportedOperations

AllstandardUDBoperationsworkoverserial:

-`services`-Querydevicecapabilities
-`info`-Querydevicemetadata
-`ping`-Healthcheck
-`pair`-Pairingflow
-`exec`-Commandexecution
-`status`-Devicestatus

##ArchitectureValidation

TheserialtransportvalidatesUDB'sdesign:

1.**Noprotocolchanges**-ExactsamemessageformatasTCP
2.**Noframingchanges**-Samelength-prefixedJSONframes
3.**Noclientchanges**-`tcpRequest`workswithanyTransport
4.**Transportindependence**-AddingUSB/BLEwouldfollowthesamepattern

##Example:EmbeddedDevice

```javascript
import{createSerialTransport,exec}from"@udb/client";

consttransport=createSerialTransport("/dev/ttyUSB0");

//Executecommandonembeddeddevice
constresult=awaitexec("gpioread17",{transport});
console.log(result.stdout);
```

##Troubleshooting

###PortAccessDenied(Linux)

Addusertodialoutgroup:

```bash
sudousermod-a-Gdialout$USER
#Logoutandbackin
```

###PortBusy

Checkforotherprocessesusingtheport:

```bash
lsof/dev/ttyUSB0
```

###NoDataReceived

1.Checkbaudratematchesbetweenclientanddevice
2.VerifyTX/RXwiringiscorrect(mayneedcrossover)
3.Checkflowcontrolsettings
