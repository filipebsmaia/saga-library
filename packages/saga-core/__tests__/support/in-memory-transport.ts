import type {
  SagaTransport,
  InboundMessage,
  OutboundMessage,
  TransportSubscribeOptions,
} from "../../src/transport/transport.interface";
import { SagaTransportNotConnectedError } from "../../src/errors/saga-transport-not-connected.error";

type MessageHandler = (message: InboundMessage) => Promise<void>;

export class InMemoryTransport implements SagaTransport {
  private connected = false;
  private subscriptions = new Map<string, MessageHandler>();
  private publishedMessages: OutboundMessage[] = [];

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async publish(message: OutboundMessage): Promise<void> {
    if (!this.connected) throw new SagaTransportNotConnectedError();

    this.publishedMessages.push(message);

    const handler = this.subscriptions.get(message.topic);
    if (handler) {
      const inbound: InboundMessage = {
        topic: message.topic,
        key: message.key,
        value: message.value,
        headers: message.headers,
      };
      await handler(inbound);
    }
  }

  async subscribe(
    topics: string[],
    handler: (message: InboundMessage) => Promise<void>,
    _options?: TransportSubscribeOptions,
  ): Promise<void> {
    for (const topic of topics) {
      this.subscriptions.set(topic, handler);
    }
  }

  getPublishedMessages(): OutboundMessage[] {
    return [...this.publishedMessages];
  }

  isConnected(): boolean {
    return this.connected;
  }

  clear(): void {
    this.publishedMessages = [];
    this.subscriptions.clear();
  }
}
