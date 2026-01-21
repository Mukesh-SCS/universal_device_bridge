# CI Simulator

UDB includes a simulator for automated testing without hardware.

## Start Simulator

```bash
node daemon/simulator/udbd-sim.js --port 9910 --name "ci-sim"
```

## CI Usage

```bash
# Connect to simulator
udb connect 127.0.0.1:9910

# Run tests
udb exec "npm test"
EXIT_CODE=$?

# Deploy if tests pass
if [ $EXIT_CODE -eq 0 ]; then
  udb push ./dist /app
  udb exec "systemctl restart app"
fi
```

## GitHub Actions

```yaml
- name: Start UDB Simulator
  run: node daemon/simulator/udbd-sim.js &

- name: Run tests via UDB
  run: |
    udb connect 127.0.0.1:9910
    udb exec "npm test"
```

## Output

```
$ udb devices
NAME             TYPE              TARGET                   STATUS
ci-sim           simulator         127.0.0.1:9910           online

$ udb exec "echo Hello"
Hello
```

## Key Points

- Simulator requires no hardware
- Same commands work on real devices
- Perfect for CI/CD pipelines
