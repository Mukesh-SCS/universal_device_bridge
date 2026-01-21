# Contributing to UDB

Thank you for your interest in contributing to UDB! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Release Process](#release-process)
- [Governance](#governance)

---

## Code of Conduct

This project follows a simple code of conduct:

1. **Be respectful** - Treat everyone with respect and professionalism
2. **Be constructive** - Provide helpful feedback, not criticism
3. **Be patient** - Maintainers are often volunteers with limited time
4. **Be inclusive** - Welcome newcomers and help them contribute

Violations should be reported to the maintainers.

---

## Getting Started

### What Can I Contribute?

| Type | Examples | Process |
|------|----------|---------|
| **Bug Fixes** | Fix crashes, incorrect behavior | Open PR directly |
| **Documentation** | Fix typos, clarify explanations | Open PR directly |
| **Tests** | Add missing tests, improve coverage | Open PR directly |
| **Small Features** | Minor enhancements, CLI flags | Open issue first |
| **Large Features** | New commands, protocol changes | RFC required |

### Before You Start

1. **Check existing issues** - Someone may already be working on it
2. **Read the docs** - Understand the architecture and design decisions
3. **Ask questions** - Open a discussion if unsure

---

## Development Setup

### Prerequisites

- **Node.js**: 20.x or later
- **npm**: 10.x or later
- **Git**: 2.x or later

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourorg/udb.git
cd udb

# Install root dependencies
npm install

# Install component dependencies
npm install --prefix cli
npm install --prefix client
npm install --prefix protocol
npm install --prefix daemon/linux
```

### Project Structure

```
udb/
├── cli/              # Command-line interface
├── client/           # JavaScript client library
├── protocol/         # Wire protocol implementation
├── daemon/           # Device daemon implementations
│   ├── linux/        # Full Linux daemon
│   ├── mcu/          # Microcontroller daemon
│   └── simulator/    # Test simulator
├── transport/        # Transport layer abstractions
├── auth/             # Authentication modules
├── scripts/          # Build and utility scripts
├── ci/               # CI/CD configurations
├── docs/             # Documentation
└── examples/         # Usage examples
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
node --test protocol/src/messages.test.js

# Run with verbose output
npm test -- --test-reporter=spec

# Run smoke tests (CI validation)
node ci/smoke-test.js
```

### Building Binaries

```bash
# Build for current platform
npm run build

# Build for all platforms
npm run build:all
```

---

## How to Contribute

### Reporting Bugs

Create an issue with:

1. **Title**: Clear, concise summary
2. **Environment**: OS, Node.js version, UDB version
3. **Steps to Reproduce**: Minimal steps to trigger the bug
4. **Expected Behavior**: What should happen
5. **Actual Behavior**: What actually happens
6. **Logs/Output**: Error messages, stack traces

### Suggesting Features

Open a discussion (not issue) with:

1. **Problem Statement**: What problem does this solve?
2. **Proposed Solution**: How would it work?
3. **Alternatives**: What else did you consider?
4. **Scope**: Is this a CLI, client, or protocol change?

### Writing Code

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b fix/issue-123`
3. **Make changes** following coding standards
4. **Add tests** for new functionality
5. **Run tests** to ensure nothing breaks
6. **Commit** with clear messages
7. **Push** and open a pull request

---

## Pull Request Process

### PR Requirements

- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated (if applicable)
- [ ] Commit messages are clear
- [ ] No unrelated changes included

### PR Title Format

```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
Scopes: cli, client, protocol, daemon, transport, auth
```

Examples:
- `feat(cli): add --timeout flag to exec command`
- `fix(client): handle connection timeout correctly`
- `docs: update API examples for push/pull`

### Review Process

1. **Automated checks** run (tests, linting)
2. **Maintainer review** within 1 week
3. **Address feedback** or discuss alternatives
4. **Approval and merge** by maintainer

### Merge Strategy

- **Squash merge** for most PRs (clean history)
- **Merge commit** for large features with meaningful commits
- **Rebase** rarely, for very clean single-commit changes

---

## Coding Standards

### JavaScript Style

We follow a minimal, consistent style:

```javascript
// Use ES modules
import fs from "node:fs";

// Prefer const, use let when needed, never var
const config = loadConfig();
let counter = 0;

// Use async/await over raw promises
async function fetchData() {
  const result = await client.exec("command");
  return result;
}

// Use explicit comparisons
if (value === null) { ... }
if (items.length === 0) { ... }

// Error handling with specific types
try {
  await riskyOperation();
} catch (err) {
  if (err.code === 'ECONNREFUSED') {
    throw new ConnectionError(address, err);
  }
  throw err;
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `device-manager.js` |
| Functions | camelCase | `connectDevice()` |
| Classes | PascalCase | `DeviceConnection` |
| Constants | SCREAMING_SNAKE | `DEFAULT_TIMEOUT` |
| Private | underscore prefix | `_internalState` |

### Error Handling

- Throw specific error types (see `client/src/index.js`)
- Include context in error messages
- Use error codes for programmatic handling
- Never swallow errors silently

### Comments

```javascript
// Good: Explains WHY
// Retry with backoff to handle transient network issues
await retry(connect, { maxAttempts: 3, backoff: 1000 });

// Bad: Explains WHAT (obvious from code)
// Increment counter by 1
counter++;
```

---

## Testing

### Test Framework

We use Node.js built-in test runner:

```javascript
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

describe("MyModule", () => {
  beforeEach(() => {
    // Setup
  });

  it("should do something", async () => {
    const result = await myFunction();
    assert.strictEqual(result, expected);
  });
});
```

### Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit | `*.test.js` next to source | Test individual functions |
| Integration | `test/integration/` | Test component interaction |
| Smoke | `ci/smoke-test.js` | Quick validation for CI |

### Coverage Goals

- **Protocol**: 100% coverage (critical path)
- **Client**: 90%+ coverage
- **CLI**: 80%+ coverage (tested via smoke tests)
- **Daemon**: 80%+ coverage

---

## Documentation

### What Needs Docs

- All public APIs
- CLI commands and flags
- Configuration options
- Protocol changes
- Architecture decisions

### Documentation Locations

| Type | Location |
|------|----------|
| API Reference | `client/API.md` |
| CLI Reference | `cli/src/udb.js` (--help) |
| Architecture | `docs/architecture.md` |
| Protocol | `protocol/spec.md` |
| Examples | `examples/` |

### Doc Style

- Use present tense ("Returns..." not "Will return...")
- Include code examples
- Keep examples minimal but complete
- Update docs in the same PR as code changes

---

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Release Steps (Maintainers)

1. Update `CHANGELOG.md`
2. Update version in `package.json`
3. Commit: `chore: release v0.5.0`
4. Tag: `git tag v0.5.0`
5. Push: `git push origin main --tags`
6. GitHub Actions builds and publishes

### Pre-release Versions

For testing before stable release:

```bash
# Beta
npm version 0.5.0-beta.1

# Release candidate
npm version 0.5.0-rc.1
```

---

## Governance

### Decision Making

| Decision Type | Process |
|--------------|---------|
| Bug fixes | Maintainer discretion |
| Minor features | Issue discussion + maintainer approval |
| Major features | RFC in Discussions + consensus |
| Breaking changes | RFC + 2-week comment period |
| Protocol changes | RFC + extensive review + FROZEN after v1 |

### RFC Process

For significant changes:

1. Open a Discussion with `[RFC]` prefix
2. Describe the proposal in detail
3. Gather community feedback (minimum 1 week)
4. Address concerns and iterate
5. Maintainer makes final decision
6. Document decision in `docs/decisions/`

### Maintainers

Current maintainers:

- TBD (Update with actual maintainers)

Maintainers are responsible for:
- Reviewing and merging PRs
- Triaging issues
- Making release decisions
- Enforcing code of conduct

### Becoming a Maintainer

Regular contributors may be invited to become maintainers based on:
- Quality of contributions
- Community engagement
- Alignment with project values
- Time availability

---

## License

By contributing, you agree that your contributions will be licensed under the project's license (see [LICENSE](LICENSE)).

---

## Questions?

- **General questions**: Open a Discussion
- **Bug reports**: Open an Issue
- **Security issues**: See [SECURITY.md](SECURITY.md)

Thank you for contributing! 🙏
