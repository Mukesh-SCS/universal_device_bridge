#TCPTransport

TCPtransportimplementationforUDB.

##Ports

|Port|Protocol|Purpose|
|------|----------|---------|
|9909|UDP|Discovery(broadcast)|
|9910|TCP|Controlconnection|

##Usage

TCPtransportisusedautomaticallywhenconnectingtodevicesviaIPaddress:

```bash
udbpair10.0.0.1:9910
udbexec10.0.0.1:9910"whoami"
```

##Implementation

TheTCPtransportisintegratedinto:

-`daemon/linux/udbd.js`-Server-sidelistener
-`client/src/index.js`-Client-sideconnection

See`transport/abstract.ts`forthetransportinterface.
