#UDBDocumentation

CompletedocumentationforUniversalDeviceBridge.

---

##TableofContents

-[Overview](#overview)
-[Architecture](#architecture)
-[Installation](#installation)
-[PlatformSupport](#platform-support)
-[Security](#security)
-[ExitCodes](#exit-codes)
-[ReportingIssues](#reporting-issues)

---

##Overview

UniversalDeviceBridge(UDB)isa**local-first,offline-capable**deviceaccesssysteminspiredbyAndroidDebugBridge(ADB),buttargetingnon-AndroiddeviceslikeembeddedLinux,MCUs,simulators,andautomotiveECUs.

###KeyFeatures

-**Devicediscovery**-Finddevicesonyournetwork
-**Securepairing**-Ed25519keypair-basedauthentication
-**Commandexecution**-Runcommandsremotely
-**Filetransfer**-Push/pullfilesto/fromdevices
-**Interactiveshell**-FullPTY-basedshellsessions
-**Fleetmanagement**-Managemultipledeviceswithgroupsandlabels
-**CI-ready**-ScriptableCLIwithJSONoutput

---

##Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│CLIENTSIDE│
├─────────────────────────────────────────────────────────────────┤
│┌───────────┐┌─────────────┐┌─────────────────────┐│
││udbCLI│───▶│@udb/client│───▶│@udb/protocol││
│└───────────┘└─────────────┘└─────────────────────┘│
│││
└──────────────────────────────────────────────│──────────────────┘
│
┌──────────┴──────────┐
│TCP/Serial/USB│
└──────────┬──────────┘
│
┌──────────────────────────────────────────────│──────────────────┐
│DEVICESIDE││
├──────────────────────────────────────────────│──────────────────┤
│▼│
│┌─────────────────────────────────────────────────────────┐│
││udbd(Daemon)││
││┌─────────┐┌─────────┐┌─────────┐┌────────────┐││
│││Auth││Exec││Push/││Discovery│││
│││Pairing││Handler││Pull││(UDP)│││
││└─────────┘└─────────┘└─────────┘└────────────┘││
│└─────────────────────────────────────────────────────────┘│
││
│Targets:Linux/Embedded/MCU/Simulator/ECU│
└─────────────────────────────────────────────────────────────────┘
```

###CoreComponents

|Component|Description|
|-----------|-------------|
|**CLI(`udb`)**|Command-lineinterfaceforalloperations|
|**ClientLibrary**|Node.jsAPI(`@udb/client`)forprogrammaticuse|
|**Daemon(`udbd`)**|Runsontargetdevicestohandlerequests|
|**Protocol**|Wireprotocolforclient-daemoncommunication|

###DesignPrinciples

-**Local-first**-Workswithoutinternet
-**Offline-capable**-Noclouddependencies
-**Secure**-Cryptographicauthenticationbydefault
-**Scriptable**-CLI+programmaticAPI
-**Simple**-Nocomplexorchestration

---

##Installation

###One-LineInstall

**Linux/macOS:**
```bash
curl-fsSLhttps://udb.dev/install.sh|sh
```

**Windows(PowerShell):**
```powershell
irmhttps://udb.dev/install.ps1|iex
```

###ManualDownload

Downloadprebuiltbinariesfrom[GitHubReleases](https://github.com/user/udb/releases).

###npmInstall

```bash
npminstall-g@udb/cli
```

---

##PlatformSupport

###PrebuiltBinaries

|Platform|Architecture|
|----------|-------------|
|Linux|x86_64|
|Linux|ARM64|
|macOS|Intel|
|macOS|AppleSilicon|
|Windows|x86_64|

###Node.jsRuntime(npmusage)

|Node.jsVersion|Notes|
|----------------|-------|
|22.x|Recommended|
|20.xLTS|Supported|
|18.xLTS|Minimum|

###TargetDeviceSupport

|Platform|
|----------|
|Linuxx86/x64|
|LinuxARM|
|Simulator|
|Serialdevices|

---

##Security

###SecurityModel

UDBusesEd25519keypair-basedauthentication:

1.**KeypairIdentity**-Eachclienthasauniquekeypair
2.**Challenge-Response**-Devicesverifyclientsviasignednonces
3.**Fingerprint**-Publickeyfingerprintsforverification
4.**NoCentralAuthority**-Alltrustisdevice-local
5.**Revocable**-Devicescanunpairclientsatanytime

###KeyStorage

```
~/.udb/
├──keys/
│├──client.key#Privatekey(0600)
│├──client.pub#Publickey
│└──known_devices/#Paireddevicekeys
└──config.json
```

###SecureDefaults

|Setting|Default|
|---------|---------|
|AuthRequired|Yes|
|PairingRequired|Yes|
|KeyPermissions|0600|
|ConnectionTimeout|30s|

###SecurityChecklist

-[]KeepUDBupdated
-[]Protect`~/.udb/keys/`directory
-[]Reviewpaireddevicesregularly(`udbdevices`)
-[]Useontrustednetworksonly

---

##ExitCodes

###StandardCodes

|Code|Meaning|
|------|---------|
|`0`|Success|
|`1`|Generalerror(connection,auth,runtime)|
|`2`|Usageerror(invalidarguments)|

###`udbexec`ExitCodes

The`exec`commandreturnstheremotecommand'sexitcode:

|Code|Description|
|------|-------------|
|`0`|Remotecommandsucceeded|
|`1-125`|Remotecommand'sexitcode|
|`126`|Commandnotexecutable|
|`127`|Commandnotfound|

###ScriptingExample

```bash
#Checkdevicereachability
ifudbping10.0.0.1:9910;then
echo"Deviceonline"
else
echo"Deviceoffline"
fi

#Capturecommandoutput
result=$(udbexec10.0.0.1:9910"whoami")
echo"User:$result"
```

---

##ReportingIssues

###BugReports

Reportbugsat:https://github.com/user/udb/issues

###SecurityVulnerabilities

**DonotreportsecurityvulnerabilitiesthroughpublicGitHubissues.**

Email:tripathimukeshmani@outlook.com

Include:
-Descriptionofthevulnerability
-Stepstoreproduce
-Affectedversions
-Potentialimpact

###ResponseTimeline

|Phase|Timeline|
|-------|----------|
|InitialResponse|24-48hours|
|Triage|1week|
|Fix(critical)|2weeks|
|Fix(high)|4weeks|

---

##License

MITLicense-see[LICENSE](../LICENSE)fordetails.
