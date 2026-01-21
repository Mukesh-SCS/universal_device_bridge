#@udb/client-QuickReferenceGuide

Fastlookupforcommonoperations.Forfulldocumentation,see[API.md](./API.md).

---

##Installation

```bash
npminstall@udb/client
```

---

##ImportExamples

```javascript
//Coreoperations
import{exec,status,pair,unpair}from"@udb/client";

//Discovery
import{discoverDevices,resolveTarget}from"@udb/client";

//Sessions
import{createSession}from"@udb/client";

//Batch
import{execBatch}from"@udb/client";

//Context
import{setCurrentContext,addContext}from"@udb/client";

//Fleet(separatemodule)
import{createGroup,execOnGroup}from"@udb/client/fleet";

//Errors
import{UdbError,AuthError,CommandError}from"@udb/client";
```

---

##MostCommonPatterns

###ExecuteaCommand
```javascript
constresult=awaitexec("10.0.0.1:9910","whoami");
console.log(result.stdout);//"user\n"
```

###GetDeviceStatus
```javascript
constinfo=awaitstatus("10.0.0.1:9910");
console.log(info.name);//"device-name"
```

###DiscoverDevices
```javascript
constdevices=awaitdiscoverDevices();
devices.forEach(d=>console.log(d.name));
```

###CreateaSession(MultipleCommands)
```javascript
constsession=awaitcreateSession("10.0.0.1:9910");
awaitsession.exec("cd/tmp");
awaitsession.exec("ls");
awaitsession.close();
```

###BatchExecuteAcrossMultipleDevices
```javascript
constresults=awaitexecBatch(devices,"whoami");
results.forEach(r=>{
if(r.success)console.log(r.result.stdout);
elseconsole.error(r.error.message);
});
```

###PairwithDevice
```javascript
constresult=awaitpair("10.0.0.1:9910");
console.log(result.fingerprint);//"abc123..."
```

---

##ContextQuickReference

###AddContext
```javascript
import{addContext,getContexts}from"@udb/client";
addContext("lab",{host:"10.0.0.1",port:9910});
```

###UseContext(ResolveWithoutArgs)
```javascript
import{setCurrentContext,resolveTarget}from"@udb/client";
setCurrentContext("lab");
consttarget=awaitresolveTarget();//Uses"lab"context
awaitexec(target,"whoami");
```

###ListContexts
```javascript
import{getContexts}from"@udb/client";
constall=getContexts();
```

---

##FleetManagementQuickReference

```javascript
import{
createGroup,
getGroup,
execOnGroup,
setLabels,
findByLabels,
exportInventory
}from"@udb/client/fleet";

//Creategroup
createGroup("lab",[
{host:"10.0.0.1",port:9910},
{host:"10.0.0.2",port:9910}
]);

//Executeongroup
constresults=awaitexecOnGroup("lab","uptime");

//Labeldevices
setLabels({host:"10.0.0.1",port:9910},{
env:"prod",
role:"gateway"
});

//Findbylabel
constdevices=findByLabels({env:"prod"});

//Export
constinventory=exportInventory();
```

---

##ErrorHandling

```javascript
import{
exec,
AuthError,
ConnectionError,
CommandError,
UdbError
}from"@udb/client";

try{
constresult=awaitexec(target,"command");
}catch(err){
if(errinstanceofAuthError){
console.log("Devicenotpaired");
}elseif(errinstanceofConnectionError){
console.log("Networkerror");
}elseif(errinstanceofCommandError){
console.log(`Commandfailedwithcode${err.code}`);
}else{
console.log(`Unknownerror:${err.message}`);
}
}
```

---

##TargetFormats

Allfunctionsaccepttargetsinmultipleformats:

```javascript
//Stringformat
awaitexec("10.0.0.1:9910","whoami");
awaitexec("tcp://10.0.0.1:9910","whoami");

//Objectformat
awaitexec({host:"10.0.0.1",port:9910},"whoami");

//Stringcontextname(aftersettingit)
awaitexec("lab","whoami");
```

---

##ReturnTypeExamples

###ExecResult
```javascript
{
stdout:"user\n",
stderr:"",
exitCode:0
}
```

###StatusResult
```javascript
{
name:"device-name",
pairingMode:"auto",
execEnabled:true,
pairedCount:3
}
```

###BatchResult
```javascript
[
{
target:{host:"...",port:9910},
success:true,
result:{stdout:"...",...}
},
{
target:{host:"...",port:9910},
success:false,
error:Error("Connectionfailed")
}
]
```

---

##PerformanceTips

###UseSessionsforMultipleOperations
```javascript
//Good-Oneconnection,multiplecommands
constsession=awaitcreateSession(target);
awaitsession.exec("cmd1");
awaitsession.exec("cmd2");
awaitsession.close();

//Avoid-Newconnectionpercommand
awaitexec(target,"cmd1");
awaitexec(target,"cmd2");
```

###UseBatchExecutionforMultipleDevices
```javascript
//Good-Parallelexecution
constresults=awaitexecBatch(devices,"whoami",{parallel:true});

//Avoid-Sequentialexecution
for(constdofdevices)awaitexec(d,"whoami");
```

###UseContextsforRepeatedAccess
```javascript
//Good-Onesetup,reusemanytimes
addContext("prod",target);
setCurrentContext("prod");
constt=awaitresolveTarget();
//Usetmanytimes

//Avoid-Typingtargetrepeatedly
awaitexec("10.0.0.1:9910","cmd1");
awaitexec("10.0.0.1:9910","cmd2");
```

---

##TimeoutHandling

Alloperationshavedefaults,customizableviaoptions:

```javascript
//Discoverytimeout
awaitdiscoverDevices(2000);//2seconds

//AllTCPoperationsdefaultto10seconds
```

---

##ConfigurationPersistence

```javascript
import{getConfig,setConfig}from"@udb/client";

//Readcurrentconfig
constcfg=getConfig();

//Modifyconfig
cfg.lastTarget={host:"...",port:9910};

//Writeback
setConfig(cfg);
```

---

##CLIEquivalents

CompareCLIwithAPI:

|Operation|CLI|API|
|-----------|-----|-----|
|Discover|`udbdevices`|`awaitdiscoverDevices()`|
|Status|`udbstatus`|`awaitstatus(target)`|
|Execute|`udbexec"cmd"`|`awaitexec(target,"cmd")`|
|Pair|`udbpair`|`awaitpair(target)`|
|Batch|`udbgroupexec`|`awaitexecOnGroup(group,cmd)`|

---

##Real-WorldExamples

###CI/CDDeployment
```javascript
import{execBatch}from"@udb/client";
constdevices=JSON.parse(process.env.TARGETS);
constresults=awaitexecBatch(devices,"dockerpull&&dockerstart");
```

###DeviceHealthCheck
```javascript
import{discoverDevices,status}from"@udb/client";
constdevices=awaitdiscoverDevices();
for(constdofdevices){
try{
consts=awaitstatus(d);
console.log(`${d.name}:${s.pairingMode}`);
}catch(e){
console.log(`${d.name}:OFFLINE`);
}
}
```

###FleetLabeling
```javascript
import{createGroup,setLabels}from"@udb/client/fleet";
createGroup("gateways",gatewayDevices);
gatewayDevices.forEach(d=>
setLabels(d,{role:"gateway",env:"prod"})
);
```

---

##Debugging

###EnableErrorDetails
```javascript
try{
awaitexec(target,"cmd");
}catch(err){
console.log(err.code);//Errorcodestring
console.log(err.message);//Humanmessage
console.log(err.details);//Additionalinfo(ifavailable)
}
```

###VerifyTargetReachability
```javascript
import{probeTcp}from"@udb/client";
constonline=awaitprobeTcp({host:"10.0.0.1",port:9910});
```

###ParseTargetStrings
```javascript
import{parseTarget}from"@udb/client";
constt1=parseTarget("10.0.0.1:9910");
constt2=parseTarget("tcp://example.com:9910");
```

---

##CommonGotchas

###❌Forgetting`await`
```javascript
//Wrong-Promisenotawaited
exec(target,"whoami");

//Right
awaitexec(target,"whoami");
```

###❌NotClosingSessions
```javascript
//Wrong-Resourceleak
consts=awaitcreateSession(target);
awaits.exec("cmd");
//Forgotawaits.close()

//Right
consts=awaitcreateSession(target);
try{
awaits.exec("cmd");
}finally{
awaits.close();
}
```

###❌IgnoringCommandErrors
```javascript
//Wrong-Commandexitcodenotchecked
constr=awaitexec(target,"false");//exit1

//Right-CommandErrorthrown
try{
awaitexec(target,"false");
}catch(err){
if(errinstanceofCommandError){
console.log(`Exitcode:${err.code}`);
}
}
```

---

##FullDocumentation

Forcompletereference,see[API.md](./API.md)

Forworkingexamples,see[scripts/README.md](../scripts/README.md)

---

**LastUpdated:**Phase3Complete
**Status:**ProductionReady
**License:**Apache-2.0
