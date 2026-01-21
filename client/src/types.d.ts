/**
 * @udb/client Type Definitions
 * 
 * API Stability:
 *   ✅ Stable - frozen, backward compatible only
 *   🔶 Beta - may change in minor versions
 */

/* ===================== Core Types ✅ ===================== */

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

export interface InfoResult {
  name: string;
  version: string;
  build: string;
  platform: string;
  arch: string;
  protocol: number;
  pairingMode: string;
  execEnabled: boolean;
  tcpPort: number;
  udpPort: number;
  simulator?: boolean;
}

export interface ServicesResult {
  services: Record<string, Record<string, unknown>>;
}

export interface PingResult {
  name: string;
  latencyMs: number;
  uptime: number;
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

export interface PushResult {
  bytes: number;
}

export interface PullResult {
  bytes: number;
}

export interface PushOptions {
  chunkSize?: number;
}

export interface PullOptions {
  chunkSize?: number;
}

/* ===================== Batch Operations ✅ ===================== */

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

/* ===================== Context Types ✅ ===================== */

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

/* ===================== Error Classes ✅ ===================== */

export class UdbError extends Error {
  override name: string;
  code: string;
  details: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>);
}

export class AuthError extends UdbError {
  override name: string;
  constructor(message: string);
}

export class ConnectionError extends UdbError {
  override name: string;
  constructor(message: string, details?: Record<string, unknown>);
}

export class CommandError extends UdbError {
  override name: string;
  constructor(message: string, exitCode: number);
}

/* ===================== Session Classes ✅ ===================== */

export class UdbSession {
  target: Target;
  authenticated: boolean;
  
  constructor(target: Target);
  connect(): Promise<void>;
  exec(command: string): Promise<ExecResult>;
  status(): Promise<StatusResult>;
  close(): Promise<void>;
}

/* ===================== Streaming Session 🔶 ===================== */

export interface StreamOptions {
  pty?: boolean;
  cols?: number;
  rows?: number;
}

export class Stream {
  streamId: number;
  write(data: string | Buffer): void;
  resize(cols: number, rows: number): void;
  close(): void;
  on(event: "data", callback: (data: Buffer) => void): void;
  on(event: "close", callback: () => void): void;
  on(event: "error", callback: (error: Error) => void): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
}

export class StreamingSession {
  target: Target;
  authenticated: boolean;
  
  openService(name: string, options?: StreamOptions): Promise<Stream>;
  close(): Promise<void>;
}

/* ===================== Transport Layer 🔶 ===================== */

export interface TransportOptions {
  timeout?: number;
}

export interface TcpTransportOptions extends TransportOptions {
  host: string;
  port: number;
}

export interface SerialTransportOptions extends TransportOptions {
  path: string;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd" | "mark" | "space";
}

export abstract class Transport {
  options: TransportOptions;
  
  abstract connect(): Promise<void>;
  abstract send(data: Buffer): void;
  abstract close(): Promise<void>;
  abstract isConnected(): boolean;
  abstract getType(): string;
  abstract getRemoteInfo(): Record<string, unknown>;
  
  onData(callback: (data: Buffer) => void): void;
  onClose(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
}

export class TcpTransport extends Transport {
  constructor(options: TcpTransportOptions);
  connect(): Promise<void>;
  send(data: Buffer): void;
  close(): Promise<void>;
  isConnected(): boolean;
  getType(): string;
  getRemoteInfo(): Record<string, unknown>;
}

export class SerialTransport extends Transport {
  constructor(options: SerialTransportOptions);
  connect(): Promise<void>;
  send(data: Buffer): void;
  close(): Promise<void>;
  isConnected(): boolean;
  getType(): string;
  getRemoteInfo(): Record<string, unknown>;
}

/* ===================== Functions ✅ ===================== */

// Discovery & Connection
export function discoverDevices(timeoutMs?: number): Promise<DiscoveredDevice[]>;
export function parseTarget(arg: string): Target;
export function resolveTarget(maybeTarget?: string | Target): Promise<Target>;
export function probeTcp(target: Target, timeoutMs?: number): Promise<boolean>;

// Core Operations
export function status(target: string | Target): Promise<StatusResult>;
export function getInfo(target: string | Target): Promise<InfoResult>;
export function getServices(target: string | Target): Promise<ServicesResult>;
export function ping(target: string | Target): Promise<PingResult>;
export function pair(target: string | Target): Promise<PairResult>;
export function unpair(target: string | Target, options?: UnpairOptions): Promise<UnpairResult>;
export function listPaired(target: string | Target): Promise<PairedClient[]>;
export function exec(target: string | Target, command: string): Promise<ExecResult>;
export function push(target: string | Target, localPath: string, remotePath: string, options?: PushOptions): Promise<PushResult>;
export function pull(target: string | Target, remotePath: string, localPath: string, options?: PullOptions): Promise<PullResult>;

// Context Management
export function getContexts(): Record<string, ContextConfig>;
export function getCurrentContextName(): string | null;
export function setCurrentContext(name: string): void;
export function addContext(name: string, target: Target): void;
export function getContext(name: string): ContextConfig | null;
export function removeContext(name: string): void;

// Sessions
export function createSession(target: string | Target): Promise<UdbSession>;
export function createStreamingSession(target: string | Target): Promise<StreamingSession>;

// Batch Operations
export function execBatch(
  targets: (string | Target)[],
  command: string,
  options?: ExecBatchOptions
): Promise<BatchResult[]>;

// Transport Factories 🔶
export function createTcpTransport(target: Target, options?: TransportOptions): TcpTransport;
export function createSerialTransport(path: string, options?: Partial<SerialTransportOptions>): SerialTransport;
export function parseSerialTarget(url: string): SerialTransportOptions;

// Config
export function getConfig(): Config;
export function setConfig(cfg: Config): void;

/* ===================== Fleet Module (@udb/client/fleet) ✅ ===================== */

export interface GroupInfo {
  name: string;
  deviceCount: number;
  devices: Target[];
}

export interface DeviceWithLabels extends Target {
  labels: Record<string, string>;
}

export interface Inventory {
  timestamp: string;
  groups: Record<string, DeviceWithLabels[]>;
}

export interface FleetExecResult {
  target: Target;
  success: boolean;
  result?: ExecResult;
  error?: Error;
}

export interface FleetExecOptions {
  parallel?: boolean;
  stopOnError?: boolean;
}

// Group Management
export function createGroup(groupName: string, targets: Target[]): GroupInfo;
export function getGroup(groupName: string): Target[];
export function listGroups(): GroupInfo[];
export function addToGroup(groupName: string, targets: Target | Target[]): GroupInfo;
export function removeFromGroup(groupName: string, target: Target): GroupInfo;
export function deleteGroup(groupName: string): boolean;

// Labels
export function setLabels(target: Target, labels: Record<string, string>): void;
export function getLabels(target: Target): Record<string, string>;
export function findByLabels(query: Record<string, string>): Target[];

// Inventory
export function exportInventory(): Inventory;

// Fleet Execution
export function execOnGroup(groupName: string, command: string, options?: FleetExecOptions): Promise<FleetExecResult[]>;
export function execByLabels(query: Record<string, string>, command: string, options?: FleetExecOptions): Promise<FleetExecResult[]>;
