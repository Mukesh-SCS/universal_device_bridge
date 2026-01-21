#CISimulator

UDBincludesasimulatorforautomatedtestingwithouthardware.

##StartSimulator

```bash
nodedaemon/simulator/udbd-sim.js--port9910--name"ci-sim"
```

##CIUsage

```bash
#Connecttosimulator
udbconnect127.0.0.1:9910

#Runtests
udbexec"npmtest"
EXIT_CODE=$?

#Deployiftestspass
if[$EXIT_CODE-eq0];then
udbpush./dist/app
udbexec"systemctlrestartapp"
fi
```

##GitHubActions

```yaml
-name:StartUDBSimulator
run:nodedaemon/simulator/udbd-sim.js&

-name:RuntestsviaUDB
run:|
udbconnect127.0.0.1:9910
udbexec"npmtest"
```

##Output

```
$udbdevices
NAMETYPETARGETSTATUS
ci-simsimulator127.0.0.1:9910online

$udbexec"echoHello"
Hello
```

##KeyPoints

-Simulatorrequiresnohardware
-Samecommandsworkonrealdevices
-PerfectforCI/CDpipelines
