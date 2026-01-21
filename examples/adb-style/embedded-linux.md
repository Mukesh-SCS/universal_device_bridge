# Embedded Linux (Raspberry Pi, BeagleBone, etc.)

## Setup

1. Install UDB daemon on device:
```bash
npm install -g @udb/daemon
udbd --name "pi-lab"
```

2. From your workstation:
```bash
udb connect pi.local:9910
```

## Usage

```bash
# Open shell
udb shell

# Run command
udb exec "uname -a"

# Deploy application
udb push ./build/app /opt/myapp/app
udb exec "systemctl restart myapp"

# View logs
udb exec "journalctl -f -u myapp"
```

## Output

```
$ udb devices
NAME             TYPE              TARGET                   STATUS
pi-lab           embedded-linux    10.0.0.1:9910      online

$ udb shell
pi-lab:~$ 
```
