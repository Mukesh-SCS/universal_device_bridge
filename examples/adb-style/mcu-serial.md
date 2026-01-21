#MCUoverSerial(ESP32,Arduino,STM32)

##Setup

1.FlashUDBfirmwaretoMCU(see`daemon/mcu/`)
2.ConnectviaUSB

##Usage

```bash
#Listdevices(includesserial)
udbdevices

#Connecttoserialdevice
udbconnectserial:///dev/ttyUSB0

#OronWindows
udbconnectserial://COM3

#Runcommand
udbexec"reboot"

#Pushfirmware
udbpush./firmware.bin/flash/app.bin
```

##Output

```
$udbdevices
NAMETYPETARGETSTATUS
esp32-01mcuserial:///dev/ttyUSB0online

$udbexec"version"
UDB-MCUv1.0.0(ESP32)
```

##Notes

-Defaultbaudrate:115200
-Custombaud:`serial:///dev/ttyUSB0?baud=921600`
-MCUcommandsdependonfirmwareimplementation
