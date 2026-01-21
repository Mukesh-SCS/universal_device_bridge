#UDBProtocolSpecification

ThisdocumentdescribesthewireprotocolforUniversalDeviceBridge.

---

##Overview

UDBusesasimplelength-prefixedJSONprotocoloverTCP.AllmessagesareJSONobjectswitha`type`fieldindicatingthemessagetype.

---

##FrameFormat

```
┌─────────────────────────────────────────────┐
│4bytes(BE)│Nbytes│
│PayloadLen│JSONPayload(UTF-8)│
└─────────────────────────────────────────────┘
```

-**Length**:4-bytebig-endianunsignedinteger
-**Payload**:UTF-8encodedJSONobject

---

##MessageTypes

###Connection&Authentication

|Type|Direction|Description|
|------|-----------|-------------|
|`hello`|Client→Device|Initialconnectionwithclientnameandpublickey|
|`hello_ok`|Device→Client|Connectionaccepted|
|`auth_required`|Device→Client|Clientnotpaired,pairingrequired|
|`auth_challenge`|Device→Client|Authenticationchallengewithnonce|
|`auth_response`|Client→Device|Signednonceresponse|
|`auth_ok`|Device→Client|Authenticationsuccessful|
|`auth_fail`|Device→Client|Authenticationfailed|

###Pairing

|Type|Direction|Description|
|------|-----------|-------------|
|`pair_request`|Client→Device|Requesttopair|
|`pair_ok`|Device→Client|Pairingsuccessfulwithfingerprint|
|`pair_denied`|Device→Client|Pairingdenied|
|`unpair_request`|Client→Device|Requesttounpair|
|`unpair_ok`|Device→Client|Unpairsuccessful|
|`unpair_all`|Client→Device|Removeallpairedclients|

###CommandExecution

|Type|Direction|Description|
|------|-----------|-------------|
|`exec`|Client→Device|Executecommand|
|`exec_result`|Device→Client|Commandresultwithstdout/stderr/code|

###FileTransfer

|Type|Direction|Description|
|------|-----------|-------------|
|`push_begin`|Client→Device|Startfilepush,includesremotePath|
|`push_chunk`|Client→Device|Filechunk(base64encoded)|
|`push_end`|Client→Device|Endfilepush|
|`push_ready`|Device→Client|Readytoreceivechunks|
|`push_ack`|Device→Client|Chunkreceivedacknowledgment|
|`push_ok`|Device→Client|Pushcompletedsuccessfully|
|`pull_begin`|Client→Device|Requestfilepull,includesremotePath|
|`pull_chunk`|Device→Client|Filechunk(base64encoded)|
|`pull_end`|Device→Client|Endoffile|

###Status&Discovery

|Type|Direction|Description|
|------|-----------|-------------|
|`status`|Client→Device|Requestdevicestatus|
|`status_result`|Device→Client|Devicestatusinfo|
|`list_paired`|Client→Device|Listpairedclients|
|`list_paired_result`|Device→Client|Pairedclientslist|

###Errors

|Type|Direction|Description|
|------|-----------|-------------|
|`error`|Device→Client|Errorresponsewitherrorcode|

---

##MessageDetails

###hello

```json
{
"type":"hello",
"clientName":"my-client",
"pubKey":"-----BEGINPUBLICKEY-----\n..."
}
```

###auth_challenge

```json
{
"type":"auth_challenge",
"nonce":"base64-encoded-random-bytes"
}
```

###auth_response

```json
{
"type":"auth_response",
"signatureB64":"base64-encoded-signature"
}
```

###exec

```json
{
"type":"exec",
"cmd":"whoami"
}
```

###exec_result

```json
{
"type":"exec_result",
"stdout":"user\n",
"stderr":"",
"code":0
}
```

###push_begin

```json
{
"type":"push_begin",
"remotePath":"/tmp/file.txt"
}
```

###push_chunk

```json
{
"type":"push_chunk",
"b64":"base64-encoded-data"
}
```

###pull_begin

```json
{
"type":"pull_begin",
"remotePath":"/tmp/file.txt"
}
```

###status_result

```json
{
"type":"status_result",
"deviceName":"my-device",
"pairingMode":"auto",
"execEnabled":true,
"pairedCount":2
}
```

###error

```json
{
"type":"error",
"error":"error_code",
"detail":"Humanreadablemessage"
}
```

---

##DiscoveryProtocol(UDP)

SeparatefromTCP,usedfordevicediscoveryonlocalnetwork.

###Request(Client→Broadcast)

```
UDB_DISCOVER_V1
```

PlaintextstringsenttoUDPport9909.

###Response(Device→Client)

```json
{
"name":"device-name",
"tcpPort":9910,
"udpPort":9909
}
```

---

##Security

###Keypair

-Algorithm:Ed25519
-Clientgenerateskeypaironfirstrun
-Storedin`~/.udb/keypair.json`

###Fingerprint

-SHA-256hashofpublickeyPEM
-First16hexcharactersusedasidentifier

###AuthenticationFlow

1.ClientsendsHELLOwithpublickey
2.Ifpaired:DevicesendsAUTH_CHALLENGEwithrandomnonce
3.Clientsignsnoncewithprivatekey
4.ClientsendsAUTH_RESPONSEwithsignature
5.Deviceverifiessignaturematchesstoredpublickey
6.Ifvalid:AUTH_OK,else:AUTH_FAIL

---

##Ports

|Port|Protocol|Purpose|
|------|----------|---------|
|9909|UDP|Discoverybroadcasts|
|9910|TCP|Controlconnection|
