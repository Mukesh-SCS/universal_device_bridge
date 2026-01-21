#LinuxDeviceExamples

ThisdirectorycontainsexamplesfordeployingUDBdaemononLinuxdevices.

##QuickStart

```bash
#StartdaemonontargetLinuxdevice
nodedaemon/linux/udbd.js--pairingauto

#Fromclient,discoverandconnect
udbdevices
udbpair<ip>:9910
udbexec"uname-a"
```

##TargetPlatforms

-**x86/x64servers**-StandardLinuxservers
-**ARMdevices**-RaspberryPi,BeagleBone,etc.
-**EmbeddedLinux**-OpenWrt,Yocto-basedsystems
-**CloudVMs**-AWS,GCP,Azureinstances

##DeploymentOptions

###SystemdService

```ini
#/etc/systemd/system/udbd.service
[Unit]
Description=UniversalDeviceBridgeDaemon
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node/opt/udb/daemon/linux/udbd.js--pairingauto
Restart=always
User=root

[Install]
WantedBy=multi-user.target
```

###Docker

```dockerfile
FROMnode:20-slim
COPYdaemon/linux/app
WORKDIR/app
EXPOSE9909/udp9910/tcp
CMD["node","udbd.js","--pairing","auto"]
```

##SecurityConsiderations

-Use`--pairingprompt`formanualapprovalinproduction
-Runwithminimalprivilegeswherepossible
-Use`--root`torestrictfiletransferpaths
-Considerfirewallrulesforports9909/9910
