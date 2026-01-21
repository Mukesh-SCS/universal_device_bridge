#EmbeddedLinux(RaspberryPi,BeagleBone,etc.)

##Setup

1.InstallUDBdaemonondevice:
```bash
npminstall-g@udb/daemon
udbd--name"pi-lab"
```

2.Fromyourworkstation:
```bash
udbconnectpi.local:9910
```

##Usage

```bash
#Openshell
udbshell

#Runcommand
udbexec"uname-a"

#Deployapplication
udbpush./build/app/opt/myapp/app
udbexec"systemctlrestartmyapp"

#Viewlogs
udbexec"journalctl-f-umyapp"
```

##Output

```
$udbdevices
NAMETYPETARGETSTATUS
pi-labembedded-linux10.0.0.1:9910online

$udbshell
pi-lab:~$
```
