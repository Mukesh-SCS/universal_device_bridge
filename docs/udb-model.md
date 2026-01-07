# UDB Mental Model

## Purpose

This document defines the **core mental model of Universal Device Bridge (UDB)**. It exists to lock architectural decisions and prevent feature drift. Everything in UDB — protocol, daemon, CLI, and client APIs — must conform to this model.

UDB is intentionally designed to feel and behave like **ADB**, but generalized for *any device*.

If a feature does not fit this model, it does not belong in UDB core.

---

## Core Principle

> **UDB = Device → Service → Stream**

This is the single most important rule.

* You do not “run commands” directly
* You **connect to a device**
* You **open a service on that device**
* You **exchange data over a stream**

This model enables extensibility, multiplexing, and long-term stability.

---

## Concepts

### 1. Device

A **device** is any target that runs a UDB daemon (`udbd`).

Examples:

* Linux machine
* Embedded Linux board
* MCU (via lightweight daemon)
* Simulator
* Automotive ECU

A device is identified by:

* Transport address (TCP, USB, serial, etc.)
* Device name (human-readable)

A device does **not** imply:

* A specific OS
* A shell
* A filesystem

Those are provided by services.

---

### 2. Transport

A **transport** is how the host communicates with a device.

Examples:

* TCP
* USB
* Serial
* Simulator loopback

Key rules:

* Transport is abstracted
* Protocol does not depend on transport
* Multiple transports can exist simultaneously

Transport is **not** a service.

---

### 3. Service

A **service** is a named capability exposed by a device.

Services are the heart of UDB.

Examples:

* `shell` – interactive command shell
* `exec` – one-shot command execution
* `logs` – log streaming
* `fs` – file transfer (push/pull)
* `status` – device metadata
* `track-devices` – device discovery stream

Rules:

* Services are identified by string names
* Services are opened explicitly
* Services define their own behavior
* Services may be streaming or request/response

Adding a new feature should mean **adding a service**, not a new protocol message.

---

### 4. Stream

A **stream** is a logical, bidirectional channel between host and device.

Properties:

* Identified by a `streamId`
* Belongs to exactly one service
* Can be opened and closed independently
* Can stream data continuously

Multiple streams can exist over a single transport connection.

This enables:

* `udb shell` and `udb logs` at the same time
* GUIs and CLIs sharing one connection
* Long-running services

Streams are the unit of concurrency.

---

## Connection Lifecycle

1. Host connects to device over a transport
2. Authentication and pairing occur
3. Host opens one or more services
4. Each service is bound to a stream
5. Streams exchange data
6. Streams close independently
7. Transport closes when no streams remain

---

## CLI Mapping

The CLI is a **thin UX layer** over the model.

| CLI Command     | Device | Service         | Stream Type        |
| --------------- | ------ | --------------- | ------------------ |
| `udb devices`   | host   | `track-devices` | streaming          |
| `udb pair`      | device | `auth`          | request/response   |
| `udb shell`     | device | `shell`         | interactive stream |
| `udb exec`      | device | `exec`          | one-shot stream    |
| `udb logs`      | device | `logs`          | streaming          |
| `udb push/pull` | device | `fs`            | streaming          |
| `udb status`    | device | `status`        | request/response   |

CLI commands **must not bypass services**.

---

## Programmatic API Mapping

The client API mirrors the same model:

```js
const device = await connect(target)

const shell = await device.openService("shell")
shell.write("ls\n")

const logs = await device.openService("logs")
logs.on("data", ...)
```

The API must not introduce hidden behavior or implicit services.

---

## What UDB Core Is Responsible For

UDB core provides:

* Transport abstraction
* Authentication and pairing
* Service routing
* Stream multiplexing
* Stable protocol framing

UDB core does **not** provide:

* Orchestration
* Scheduling
* Business logic
* Cloud dependency

Those belong outside the core.

---

## Non-Goals

UDB intentionally does NOT:

* Replace SSH
* Provide configuration management
* Act as a cloud service
* Enforce device roles

UDB is a **device access layer**, not a management platform.

---

## Design Constraints (Hard Rules)

* One mental model: Device → Service → Stream
* No feature without a service
* No implicit behavior in the protocol
* Offline-first always
* Backward compatibility is sacred

Breaking these rules requires a major version bump.

---

## Why This Model Exists

ADB succeeded because:

* It was boring
* It was strict
* It was extensible
* It was predictable

UDB follows the same philosophy, generalized for all devices.

This document is the contract.
