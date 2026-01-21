#USBTransport

USBtransportimplementationforUDB.

##Installation

TheUSBtransportrequiresthe`serialport`package:

```bash
npminstallserialport
```

##Purpose

USBtransportenablesdirectdeviceconnectionswithoutnetwork:

-DirectUSBcableconnection
-USBserial(CDC/ACM)devices
-USB-UARTbridges(FTDI,CP210x,CH340,etc.)
-MCU/embeddeddeviceswithUSB

##UseCases

-Deviceswithoutnetworkconnectivity
-Secureenvironments(air-gapped)
-Initialdevicesetupbeforenetworkconfig
-MCU/embeddeddeviceswithUSB

##QuickStart

```javascript
import{UsbTransport,UsbTransportFactory}from"./usb-transport.js";

//ListavailableUSBserialports
constports=awaitUsbTransport.listPorts();
console.log(ports);

//FindUDB-compatibledevices
constdevices=awaitUsbTransport.findUdbDevices();
console.log(devices);

//Connectbyportpath
consttransport=UsbTransportFactory.byPath("/dev/ttyUSB0");
awaittransport.connect();

//Orauto-detect
constautoTransport=awaitUsbTransportFactory.autoDetect();
if(autoTransport){
awaitautoTransport.connect();
}
```

##SupportedDevices

Thetransportauto-detectscommonUSB-serialadapters:

|Chip|VendorID|Description|
|------|-----------|-------------|
|FTDIFT232|0403|ClassicUSB-UART|
|CP210x|10C4|SiliconLabs|
|CH340|1A86|WinChipHead|
|PL2303|067B|Prolific|
|Arduino|2341|Arduinoboards|
|ESP32|303A|Espressif|
|STM32|0483|STMicroelectronics|

##Configuration

```javascript
consttransport=newUsbTransport({
path:"/dev/ttyUSB0",//Serialportpath
baudRate:115200,//Baudrate(default:115200)
dataBits:8,//Databits(default:8)
stopBits:1,//Stopbits(default:1)
parity:"none"//Parity(default:none)
});
```

##API

###UsbTransport

```javascript
//Staticmethods
UsbTransport.listPorts()//Listallserialports
UsbTransport.findUdbDevices()//Findcompatibledevices

//Instancemethods
transport.connect()//Connecttodevice
transport.disconnect()//Disconnect
transport.send(data)//Senddata
transport.onReceive(callback)//Registerreceivehandler
transport.isConnected()//Checkconnectionstate
transport.getState()//Getdetailedstate
```

###UsbTransportFactory

```javascript
UsbTransportFactory.byPath(path,options)//Byportpath
UsbTransportFactory.byVendorProduct(vid,pid,options)//ByUSBIDs
UsbTransportFactory.autoDetect(options)//Auto-detect
```

##FrameFormat

Usessamelength-prefixedformatasTCPtransport:

```
┌─────────────────────────────────────────┐
│4bytes(BE)│Nbytes│
│PayloadLen│JSONPayload(UTF-8)│
└─────────────────────────────────────────┘
```

##PlatformNotes

###Linux
-Mayneedudevrulesfornon-rootaccess
-Portsappearas`/dev/ttyUSB*`or`/dev/ttyACM*`

###macOS
-Portsappearas`/dev/cu.usbserial-*`or`/dev/cu.usbmodem*`

###Windows
-Portsappearas`COM1`,`COM2`,etc.
-Mayneeddriverinstallationforsomeadapters
-Serialportabstraction
-Deviceenumerationandauto-detection
