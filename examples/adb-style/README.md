#udb-StyleUDBExamples

UDBworkslikeAndroid'sudbbutforanydevice.Theseexamplesshowcommonworkflows.

##QuickStart

```bash
#InstallUDB
curl-fsSLhttps://get.udb.dev|sh

#Discoverdevices
udbdevices

#Connectanduse
udbconnect10.0.0.1:9910
udbshell
```

##Examples

1.[EmbeddedLinux](embedded-linux.md)-RaspberryPi,BeagleBone,etc.
2.[MCUoverSerial](mcu-serial.md)-ESP32,Arduino,STM32
3.[CISimulator](ci-simulator.md)-Automatedtesting

##udbCommandMapping

|udb|UDB|Notes|
|-----|-----|-------|
|`udbdevices`|`udbdevices`|Listsalldevices|
|`udbconnect<ip>`|`udbconnect<ip>:9910`|Connectstodevice|
|`udbshell`|`udbshell`|Opensinteractiveshell|
|`udbpush<src><dst>`|`udbpush<src><dst>`|Pushesfile|
|`udbpull<src><dst>`|`udbpull<src><dst>`|Pullsfile|
|`udbstart-server`|`udbstart-server`|Startsdaemon|
|`udbkill-server`|`udbkill-server`|Stopsdaemon|
