export interface SagaTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(message: OutboundMessage): Promise<void>;
  subscribe(
    topics: string[],
    handler: (message: InboundMessage) => Promise<void>,
    options?: TransportSubscribeOptions,
  ): Promise<void>;
}

export interface OutboundMessage {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
}

export interface InboundMessage {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
}

export interface TransportSubscribeOptions {
  fromBeginning?: boolean;
  groupId?: string;
}
