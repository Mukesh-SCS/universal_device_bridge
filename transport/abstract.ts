// Abstract transport interface for UDB

export abstract class AbstractTransport {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(data: Uint8Array): Promise<void>;
  abstract onReceive(callback: (data: Uint8Array) => void): void;
}
