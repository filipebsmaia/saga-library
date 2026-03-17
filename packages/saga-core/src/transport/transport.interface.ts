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

export interface TransportHealthResult {
  status: "up" | "down";
  details?: Record<string, unknown>;
}

export interface HealthCheckable {
  healthCheck(): Promise<TransportHealthResult>;
}

export function isHealthCheckable(
  transport: SagaTransport,
): transport is SagaTransport & HealthCheckable {
  return typeof (transport as any).healthCheck === "function";
}
