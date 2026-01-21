#UDBGitHubActionsIntegration

ThisexampledemonstrateshowtouseUDBinaCI/CDpipelinewithGitHubActions.

##Overview

Thisworkflowshows:
1.RunningtheUDBsimulatorinCI
2.Pairingwiththedevice
3.Runningcommands
4.Collectinglogsandartifacts

##QuickStart

Copy`.github/workflows/udb-example.yml`toyourrepository.

##Files

-`workflows/udb-example.yml`-ExampleGitHubActionsworkflow
-`scripts/deploy.sh`-Exampledeploymentscript

##UsagePatterns

###BasicCommandExecution

```yaml
-name:Runcommandondevice
run:udbexec${{env.DEVICE_TARGET}}"systemctlrestartmyapp"
```

###CheckExitCodes

```yaml
-name:Verifyservicerunning
run:|
udbexec${{env.DEVICE_TARGET}}"systemctlis-activemyapp"
```

###JSONOutputforParsing

```yaml
-name:Getdeviceinfo
id:device-info
run:|
info=$(udbinfo${{env.DEVICE_TARGET}}--json)
echo"version=$(echo$info|jq-r'.version')">>$GITHUB_OUTPUT
```

###FleetOperations

```yaml
-name:Deploytocluster
run:|
udbgroupaddcluster10.0.0.1:991010.0.0.2:991010.0.0.3:9910
udbgroupexeccluster"systemctlrestartmyapp"
```

##EnvironmentVariables

|Variable|Description|
|----------|-------------|
|`UDB_TARGET`|Defaulttargetforcommands|
|`UDB_CONFIG_DIR`|Customconfigdirectory|
|`UDB_TIMEOUT`|Defaulttimeoutinms|

##SecurityConsiderations

1.**KeypairManagement**:StoreclientkeypairasaGitHubsecret
2.**NetworkAccess**:Ensurerunnerscanreachdevices
3.**Pairing**:Useauto-pairingforCIorpre-pairedkeys

##Troubleshooting

###ConnectionRefused

```yaml
-name:Diagnoseconnectivity
run:udbdoctor${{env.DEVICE_TARGET}}
```

###AuthenticationFailed

Ensurethekeypairiscorrectlysetup:

```yaml
-name:SetupUDBkeypair
run:|
mkdir-p~/.udb
echo"${{secrets.UDB_PRIVATE_KEY}}">~/.udb/id_ed25519
echo"${{secrets.UDB_PUBLIC_KEY}}">~/.udb/id_ed25519.pub
chmod600~/.udb/id_ed25519
```
