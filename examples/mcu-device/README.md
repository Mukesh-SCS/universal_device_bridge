#MCUDeviceExamples

ExamplesforrunningUDBdaemononmicrocontrollers.

##TargetPlatforms

-**ESP32**-WiFi-enabledMCU
-**STM32**-ARMCortex-Mseries
-**Arduino**-Forcompatibleboards
-**RP2040**-RaspberryPiPico

##Architecture

MCUdaemonswillbelightweightimplementationsoftheUDBprotocol:

```
┌─────────────────────────────────────┐
│MCU(e.g.,ESP32)│
├─────────────────────────────────────┤
│┌──────────────────────────────┐│
││udbd-mcu(C/C++)││
││┌────────┐┌────────────┐││
│││WiFi/││Protocol│││
│││Serial││Handler│││
││└────────┘└────────────┘││
│└──────────────────────────────┘│
└─────────────────────────────────────┘
```

##Contributing

Ifyou'reinterestedinMCUsupport,contributionsarewelcome.Keyconsiderations:

-Minimalmemoryfootprint
-Nodynamicallocationwherepossible
-SupportforbothWiFiTCPandSerialtransports
-Subsetofprotocol(exec,status,push/pull)
