#@udb/client

ProgrammaticAPIforUniversalDeviceBridge.UsethismoduletoautomateUDBoperationsinNode.jsscripts,CIsystems,orapplicationswithoutusingtheCLI.

##Installation

```bash
npminstall@udb/client
```

##QuickStart

```javascript
import{discoverDevices,exec,status,createSession}from"@udb/client";

//Discoverdevicesonthenetwork
constdevices=awaitdiscoverDevices();
console.log(devices);//[{host:"10.0.0.1",port:9910,name:"device1"}]

//Executeacommand(one-shot,auto-connects)
constresult=awaitexec("10.0.0.1:9910","whoami");
console.log(result.stdout);//"user\n"

//Oruseasessionformultipleoperations
constsession=awaitcreateSession("10.0.0.1:9910");
constr1=awaitsession.exec("hostname");
constr2=awaitsession.exec("uptime");
awaitsession.close();
```

##APIReference

###Discovery&TargetResolution

-`discoverDevices(timeoutMs)`-DiscoverdevicesviaUDPbroadcast
-`parseTarget(arg)`-Parse"ip:port"or"tcp://host:port"string
-`resolveTarget(maybeTarget)`-Resolvetargetfromarg,context,ordiscovery
-`probeTcp(target,timeoutMs)`-TestTCPconnectivity

###CoreOperations(One-Shot)

-`pair(target)`-Pairwithadevice
-`unpair(target,options)`-Unpairfromadevice
-`exec(target,command)`-Executeacommandondevice
-`status(target)`-Getdevicestatus
-`push(target,localPath,remotePath)`-Pushfiletodevice
-`pull(target,remotePath,localPath)`-Pullfilefromdevice
-`listPaired(target)`-Listpairedclientsondevice

###Sessions(PersistentConnection)

-`createSession(target)`-Createapersistentsession
-`createStreamingSession(target)`-AliasforcreateSession(streamingsupport)
-`UdbSession.exec(command)`-Executecommandinsession
-`UdbSession.status()`-Getstatusinsession
-`UdbSession.openService(name,options)`-Openstreamingservice(e.g.,shell)
-`UdbSession.close()`-Closesession

###ContextManagement

-`getContexts()`-Getallsavedcontexts
-`getCurrentContextName()`-Getcurrentcontextname
-`setCurrentContext(name)`-Switchtoacontext
-`addContext(name,target)`-Saveanewcontext
-`getContext(name)`-Getcontextbyname
-`removeContext(name)`-Removeacontext

###BatchOperations

-`execBatch(targets,command,options)`-Runcommandonmultipledevices

##FleetManagement

Importfleetfunctionsseparately:

```javascript
import{createGroup,execOnGroup,findByLabels}from"@udb/client/fleet";

//Createadevicegroup
createGroup("lab",[
{host:"10.0.0.1",port:9910},
{host:"10.0.0.2",port:9910}
]);

//Executeonentiregroup
constresults=awaitexecOnGroup("lab","hostname");

//Labeldevicesandquerybylabel
setLabels({host:"10.0.0.1",port:9910},{env:"prod",role:"web"});
constprodDevices=findByLabels({env:"prod"});
```

##Examples

See`examples/`folderforreal-worldusagepatterns.

##ErrorHandling

AllAPIfunctionsthrowdescriptiveerrors:

```javascript
import{exec,AuthError,ConnectionError,CommandError}from"@udb/client";

try{
awaitexec("10.0.0.1:9910","false");
}catch(err){
if(errinstanceofAuthError){
console.error("Notpaired-run:udbpair<target>");
}elseif(errinstanceofConnectionError){
console.error("Cannotreachdevice:",err.message);
}elseif(errinstanceofCommandError){
console.error("Commandfailedwithexitcode:",err.code);
}
}
```

##Configuration

Storepersistentconfigin`~/.udb/config.json`:

```json
{
"lastTarget":{"host":"10.0.0.1","port":9910},
"contexts":{
"lab":{"host":"10.0.0.1","port":9910,"name":"lab-device"}
}
}
```

##100%Offline

All@udb/clientoperationsworkwithoutinternetorcloudservices.Notelemetry,nocloudrequirements.

---

ForfullAPIdocumentation,see[API.md](./API.md).
