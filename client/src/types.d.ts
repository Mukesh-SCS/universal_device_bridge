/**
 * @udb/client Type Definitions
 */

export interface Target {
  host: string;
  port: number;
}

export interface DiscoveredDevice extends Target {
  name: string;
}

export interface StatusResult {
  name: string;
  pairingMode: string;
  execEnabled: boolean;
  pairedCount: number;
}

export interface PairResult {
  fingerprint: string;
  paired: boolean;
}

export interface UnpairOptions {
  all?: boolean;
  fingerprint?: string;
}

export interface UnpairResult {
  scope: "all" | "single";
  removed: number;
  fingerprint?: string;
}

export interface PairedClient {
  fp: string;
  name: string;
  addedAt: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecBatchOptions {
  stopOnError?: boolean;
  parallel?: boolean;
}

export interface BatchResult {
  target: Target;
  success: boolean;
  result?: ExecResult;
  error?: Error;
}

export interface ContextConfig {
  host: string;
  port: number;
  name?: string;
}

export interface Config {
  lastTarget?: Target;
  currentContext?: string;
  contexts?: Record<string, ContextConfig>;
}

export class UdbError extends Error {
  name: "UdbError";
  code: string;
  details: Record<string, any>;
  constructor(message: string, code: string, details?: Record<string, any>);
}

export class AuthError extends UdbError {
  name: "AuthError";
  constructor(message: string);
}

export class ConnectionError extends UdbError {
  name: "ConnectionError";
  constructor(message: string, details?: Record<string, any>);
}

export class CommandError extends UdbError {
  name: "CommandError";
  constructor(message: string, exitCode: number);
}

export class UdbSession {
  target: Target;
  authenticated: boolean;
  
  constructor(target: Target);
  connect(): Promise<void>;
  exec(command: string): Promise<ExecResult>;
  status(): Promise<StatusResult>;
  close(): Promise<void>;
}

// Discovery & Connection
export function discoverDevices(timeoutMs?: number): Promise<DiscoveredDevice[]>;
export function parseTarget(arg: string): Target;
export function resolveTarget(maybeTarget?: string | Target): Promise<Target>;
export function probeTcp(target: Target, timeoutMs?: number): Promise<boolean>;

// Core Operations
export function status(target: string | Target): Promise<StatusResult>;
export function pair(target: string | Target): Promise<PairResult>;
export function unpair(target: string | Target, options?: UnpairOptions): Promise<UnpairResult>;
export function listPaired(target: string | Target): Promise<PairedClient[]>;
export function exec(target: string | Target, command: string): Promise<ExecResult>;

// Context Management
export function getContexts(): Record<string, ContextConfig>;
export function getCurrentContextName(): string | null;
export function setCurrentContext(name: string): void;
export function addContext(name: string, target: Target): void;
export function getContext(name: string): ContextConfig | null;
export function removeContext(name: string): void;

// Sessions
export function createSession(target: string | Target): Promise<UdbSession>;

// Batch Operations
export function execBatch(
  targets: (string | Target)[],
  command: string,
  options?: ExecBatchOptions
): Promise<BatchResult[]>;

// Config
export function getConfig(): Config;
export function setConfig(cfg: Config): void;
