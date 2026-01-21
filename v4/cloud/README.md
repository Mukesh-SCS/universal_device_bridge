#UDBCloudServices(Optional)

OptionalcloudservicesthatenhanceUDBwithoutcompromisingitslocal-firstnature.

##CorePrinciple

>**Allcloudfeaturesarestrictlyopt-in.UDBworks100%offlinebydefault.**

##AvailableServices

###1.DiscoveryRelay

Helpsdevicesfindeachotheracrossdifferentnetworks:

```
┌─────────────────┐┌─────────────────┐
│Client││Device│
│(Office)││(Factory)│
└────────┬────────┘└────────┬────────┘
││
│┌─────────────────┐│
└───▶│Discovery│◀───┘
│Relay│
└─────────────────┘
```

**Howitworks:**
-Devicesregistertheirpresencewithrelay
-Clientsqueryrelaytofinddevices
-AllactualcommunicationisstilldirectP2P
-Relayneverseescommanddata

###2.FleetRegistry

Optionalcentralizedstorageforfleetmetadata:

-Devicenamesandlabels
-Groupdefinitions
-Historicalstatussnapshots
-Auditlogs(whodidwhatwhen)

**NOTstored:**
-Authenticationkeys(alwayslocal)
-Commandoutput(alwaysdirect)
-Filecontents(alwaysdirect)

###3.StatusDashboard

Web-baseddashboardforfleetvisibility:

-Deviceonline/offlinestatus
-Recentcommandhistory
-Fleethealthoverview
-Alertsandnotifications

##Architecture

```
┌────────────────────────────────────────────────────────────────┐
│CLOUDLAYER(Optional)│
├────────────────────────────────────────────────────────────────┤
│┌──────────────┐┌──────────────┐┌──────────────────────┐│
││Discovery││Fleet││Dashboard││
││Relay││Registry││API││
│└──────────────┘└──────────────┘└──────────────────────┘│
└────────────────────────────────────────────────────────────────┘
│
│HTTPS(metadataonly)
│
┌────────────────────────────────────────────────────────────────┐
│LOCALLAYER│
├────────────────────────────────────────────────────────────────┤
│┌──────────────┐┌──────────────────────┐│
││udbCLI│◀────TCP/UDP────▶│udbd││
││@udb/client│(direct,local)│(device)││
│└──────────────┘└──────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

##Configuration

```bash
#Enablecloudrelay(opt-in)
udbconfigsetcloud.enabledtrue
udbconfigsetcloud.relayhttps://relay.udb.example.com

#Disablecloud(default)
udbconfigsetcloud.enabledfalse
```

##Self-Hosting

Allcloudservicescanbeself-hosted:

```bash
#Runyourownrelay
dockerrun-p8080:8080udb/relay

#PointUDBtoyourrelay
udbconfigsetcloud.relayhttp://localhost:8080
```

##Privacy

-Notelemetrycollected
-Nousagedatasent
-Allcloudfeaturescanbedisabled
-Self-hostingfullysupported
-Dataneverleavesyournetworkwithoutexplicitopt-in

