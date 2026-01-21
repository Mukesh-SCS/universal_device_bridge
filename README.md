
#UniversalDeviceBridge(UDB)

UniversalDeviceBridge(UDB)isa**local-first,offline-capabledeviceaccesstool**inspiredbythearchitectureofAndroidDebugBridge(ADB),butdesignedtoworkacross**non-Androiddevices**suchas:

-**Linuxsystems**(servers,embeddedLinux)
-**Embeddedplatforms**(IoTdevices,SBCs)
-**MCUs**(microcontrollersviaserial/TCP)
-**Simulators**(virtualdevicetesting)
-**AutomotiveECUs**(vehicleembeddedsystems)

UDBprovidesalightweight,secure,andscriptablesystemfordiscoveringdevices,pairingwiththem,andexecutingcommandslocallyorremotely.

Itworksreliablyacross:
-Localnetworks(withorwithoutUDPbroadcast)
-Windows,Linux,andmacOSenvironments
-Restricted/air-gappednetworks
-CloudandCI/CDsystems

ItprovidesadeterministicCLIexperiencesimilarinphilosophytotoolslike`kubectl`and`adb`,butwithoutrelyingonfragileassumptions.

---

##KeyFeatures

-**Devicediscovery**(UDPfastpathwithfallback)
-**Context-baseddevicemanagement**(save&reuseknowndevices)
-**Explicitremotetargets**(`tcp://host:port`)
-**Securepairingandauthorization**(cryptographickeypairs)
-**Commandexecution**(withstdout/stderr)
-**ProgrammaticAPI**(`@udb/client`-executeUDBfromNode.js)
-**Batchoperations**(runcommandsacrossmultipledevices)
-**Fleetmanagement**(logicalgroupingandlabeling)
-**JSONoutputforautomation**
-**100%offline**(nocloud,notelemetry)

---

##ArchitectureOverview

UDBconsistsof:

-**Daemon(`udbd`)**-Runsontargetdevice,exposesTCPcontrolinterface
-**CLI(`udb`)**-Command-linetoolforoperatorsandscripts
-**ClientAPI(`@udb/client`)**-ProgrammaticAPIforautomation

Communicationisauthenticatedusingcryptographickeypairsandexplicitpairing.

---

##QuickStart

###1.Startthedaemon

```bash
#Ontargetdevice(oruseudbdaemonstart)
udbdaemonstart
```

###2.Discoverdevices

```bash
udbdevices
udbdevices--json
```

###3.Pairandexecute

```bash
udbpair10.0.0.1:9910
udbexec"whoami"
```

---

##CLIUsage

###DeviceOperations

```bash
#Discoverdevicesonnetwork
udbdevices[--json]

#Getdevicestatus
udbstatus[ip:port][--json]

#Pairwithdevice
udbpair<ip:port>

#Unpairfromdevice
udbunpair<ip:port>[--all|--fp<fingerprint>]

#Executecommand
udbexec[ip:port]"<cmd>"

#Pushfiletodevice
udbpush[ip:port]<local-path><remote-path>

#Pullfilefromdevice
udbpull[ip:port]<remote-path><local-path>

#Listpairedclients
udblist-paired<ip:port>[--json]
```

###ContextManagement

```bash
#Saveadeviceasacontext
udbcontextaddlab10.0.0.1:9910

#Selectactivecontext
udbcontextuselab

#Listcontexts
udbcontextlist[--json]

#Oncecontextisactive,allcommandstargetit
udbexec"whoami"
```

###FleetManagement(Phase3)

```bash
#Createadevicegroup
udbgroupaddlab10.0.0.1:991010.0.0.2:9910

#Executeonentiregroup
udbgroupexeclab"uname-a"

#Listgroups
udbgrouplist[--json]

#Exportfleetinventory
udbinventory[--json]
```

###Configuration

```bash
#Viewconfiguration
udbconfigshow[--json]

#Daemonmanagement
udbdaemonstart
udbdaemonstop
udbdaemonstatus
```

---

##ProgrammaticAPI

ExecuteUDBoperationsfromNode.jsscriptsorapplications:

```javascript
import{exec,status,pair,discoverDevices}from"@udb/client";

//Discoverdevices
constdevices=awaitdiscoverDevices();

//Executecommand
constresult=awaitexec("10.0.0.1:9910","whoami");
console.log(result.stdout);//"user\n"

//Getdevicestatus
constinfo=awaitstatus("10.0.0.1:9910");
console.log(info.name);//"device-name"

//Pairwithdevice
constpair_result=awaitpair("10.0.0.1:9910");
console.log(pair_result.fingerprint);
```

###AdvancedFeatures

**PersistentSessions:**
```javascript
constsession=awaitcreateSession("10.0.0.1:9910");
awaitsession.exec("cmd1");
awaitsession.exec("cmd2");
awaitsession.close();
```

**BatchExecution:**
```javascript
constresults=awaitexecBatch(devices,"whoami",{parallel:true});
```

**FleetOperations:**
```javascript
import{createGroup,execOnGroup}from"@udb/client/fleet";

createGroup("lab",devices);
constresults=awaitexecOnGroup("lab","uname-a");
```

---

##DiscoveryStrategy

UDBuseslayereddevicediscovery:

1.**UDPbroadcast**(fast,localnetwork)
2.**Savedcontexts**(reliablefallback)
3.**Explicittargets**(alwaysavailable)

ThisensuresUDBworkseverywhere:
-Localnetworkswithbroadcast
-RestrictednetworkswithoutUDP
-Cloudenvironments
-CI/CDsystems

---

##Contexts

Contextssavedeviceaddresseslocallyforeasyaccess:

```bash
#Addcontext
udbcontextaddproduction10.0.0.100:9910
udbcontextaddstaging10.0.1.100:9910

#Usecontext
udbcontextuseproduction

#Commandsnowtargetthisdevice
udbexec"hostname"
udbstatus
```

Contextsarestoredin`~/.udb/config.json`andworkoffline.

---

##SecurityModel

-**Explicitpairing**-Devicesmustapprovefirstconnection
-**Cryptographickeypairs**-Eachclienthasuniquekeypair
-**Fingerprintverification**-Optionalpairingconfirmation
-**Revocableaccess**-Unpairtorevokeclientaccess
-**Noglobaltrust**-Nocentralauthorityneeded

---

##Examples

###Example1:Basicexecution

```bash
udbpair10.0.0.1:9910
udbexec"uptime"
```

###Example2:Usingcontexts

```bash
udbcontextaddlab10.0.0.1:9910
udbcontextuselab
udbexec"df-h"
udbstatus--json
```

###Example3:Fleetoperation

```bash
udbgroupaddlab10.0.0.1:991010.0.0.2:991010.0.0.3:9910
udbgroupexeclab"systemctlstatusnginx"
udbinventory--json>fleet.json
```

###Example4:Programmaticusage

```javascript
//Seescripts/folderforfullexamples
nodescripts/devices.js
nodescripts/exec.js
nodescripts/context.js10.0.0.1:9910
nodescripts/pair.js
nodescripts/group.js10.0.0.1:9910
```

---

##Configuration

UDBstoresconfigurationin`~/.udb/config.json`:

```json
{
"lastTarget":{"host":"10.0.0.1","port":9910},
"currentContext":"lab",
"contexts":{
"lab":{"host":"10.0.0.1","port":9910,"name":"lab-device"}
}
}
```

Viewconfiguration:
```bash
udbconfigshow
udbconfigshow--json
```

---

##Documentation

-[Documentation](docs/DOCUMENTATION.md)-CompleteUDBdocumentation
-[APIReference](client/API.md)-ProgrammaticAPIdetails

---

##DesignPhilosophy

UDBfollowstheseprinciples:

1.**Local-first**-Alloperationsworkoffline
2.**Explicit**-Nomagic,cleartargetspecification
3.**Secure**-Cryptographicbydefault
4.**Scriptable**-BothCLIandprogrammaticAPIs
5.**Reliable**-Deterministicbehavioracrossplatforms
6.**Simple**-Nocomplexorchestration
7.**Composable**-Worksinpipelinesandautomation

---

##100%Offline

UDBrequires**nocloudconnection**:
-Discoveryworksonlocalnetworks
-Pairingislocal-only
-Notelemetry
-Noexternaldependencies
-Worksinair-gappedenvironments

---

##License

ThisprojectislicensedundertheApache-2.0License.SeetheLICENSEfilefordetails.