#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve snapshot-safe path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the real CLI
await import(path.join(__dirname, "../cli/src/udb.js"));
