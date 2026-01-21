#SimulatorExamples

ThisdirectorycontainsexamplesforusingtheUDBsimulatordaemonfortesting.

##Purpose

Thesimulatordaemon(`udbd-sim.js`)allowstestingUDBworkflowswithoutphysicalhardware.Itprovidesa**fullysimulatedenvironment**with:

-Mockcommandexecution(returnsrealisticsimulatedoutput)
-Virtualfilesystemforpush/pulloperations
-Simulatedinteractiveshell
-Configurablelatencyfortestingtimeouts
-Fullauthenticationandpairingsupport

##QuickStart

```bash
#Startsimulator
nodedaemon/simulator/udbd-sim.js--nametest-device

#Inanotherterminal
udbdevices
udbpair127.0.0.1:9910
udbexec"whoami"#Returns:simulator
udbexec"hostname"#Returns:test-device
udbexec"uname-a"#ReturnssimulatedLinuxkernelinfo
```

##SupportedCommands

Thesimulatorprovidesrealisticoutputforcommoncommands:

|Command|SimulatedOutput|
|---------|-----------------|
|`whoami`|`simulator`|
|`hostname`|Devicename|
|`uname-a`|SimulatedLinuxkernelinfo|
|`id`|Simulateduserinfo|
|`uptime`|Simulateduptime|
|`ps`|Simulatedprocesslist|
|`ls`,`ls-la`|Simulateddirectorylisting|
|`df-h`|Simulateddiskusage|
|`free-m`|Simulatedmemoryinfo|
|`echo<text>`|Echoesthetext|
|`cat<file>`|Readsfromvirtualfilesystem|
|`true`|Exitcode0|
|`false`|Exitcode1|
|`exit<n>`|Exitwithcoden|

##VirtualFilesystem

Thesimulatorincludesavirtualfilesystem:

-`/etc/hostname`-Devicename
-`/etc/os-release`-SimulatedOSinfo
-`/proc/uptime`-Simulateduptime
-`/tmp/test.txt`-Testfile

Filespushedvia`udbpush`arestoredinthevirtualfilesystemandpersisted.

##UseCases

1.**Development**-Testclientcodewithoutdevices
2.**CI/CD**-Automatedtestinginpipelines
3.**Documentation**-Generatescreenshotsandexamples
4.**Learning**-UnderstandUDBwithouthardware
5.**LatencyTesting**-Use`--latency`totesttimeouthandling

##Configuration

```bash
#Customport
nodedaemon/simulator/udbd-sim.js--tcp9920--udp9919

#Customdevicename
nodedaemon/simulator/udbd-sim.js--namemy-sim-device

#Auto-pairmode(default)
nodedaemon/simulator/udbd-sim.js--pairingauto

#Manualpairmode(fortestingpairingflow)
nodedaemon/simulator/udbd-sim.js--pairingprompt

#Simulatenetworklatency(100msdelay)
nodedaemon/simulator/udbd-sim.js--latency100

#Verboselogging
nodedaemon/simulator/udbd-sim.js--verbose
```

##StateDirectory

Simulatorstateisstoredin`~/.udbd-sim/`:
-`authorized_keys.json`-Pairedclients
-`files/`-Pushedfiles
