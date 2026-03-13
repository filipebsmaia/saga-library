import type { KafkaConfig, logLevel } from "kafkajs";
import type { SagaLogger } from "@fbsm/saga-core";

export interface KafkaTransportOptions {
  /** Kafka broker addresses */
  brokers: string[] | KafkaConfig["brokers"];
  /** Client identifier for Kafka connections. Default: 'saga-client' */
  clientId?: string;
  /** TLS/SSL configuration. Pass `true` for default TLS or a tls.ConnectionOptions object */
  ssl?: KafkaConfig["ssl"];
  /** SASL authentication configuration (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER, AWS) */
  sasl?: KafkaConfig["sasl"];
  /** Connection timeout in milliseconds. Default: KafkaJS default (1000) */
  connectionTimeout?: number;
  /** Authentication timeout in milliseconds */
  authenticationTimeout?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** KafkaJS retry options for the client-level retry policy */
  retry?: KafkaConfig["retry"];
  /** KafkaJS log level. Default: WARN */
  logLevel?: logLevel;
  /** Custom socket factory for advanced networking (e.g., SOCKS proxy) */
  socketFactory?: KafkaConfig["socketFactory"];
  /** Number of partitions consumed concurrently. Default: 3 */
  partitionsConsumedConcurrently?: number;
  /** Register KafkaJsInstrumentation with OTel SDK. Default: true if OTel available */
  enableOtelInstrumentation?: boolean;
  /** Auto-create topics via admin client before subscribing. Default: false */
  autoCreateTopics?: boolean;
  /** Custom logger. Default: ConsoleSagaLogger */
  logger?: SagaLogger;
  /** Interval in milliseconds at which a heartbeat is automatically sent to the broker
   *  while a message handler is running. Prevents consumer group rebalance when handlers
   *  take longer than `sessionTimeout`. Set to 0 to disable and manage heartbeats manually
   *  via `getKafkaHeartbeat()`. Default: 5000 */
  autoHeartbeatInterval?: number;
  /** Consumer group session timeout in milliseconds. The broker evicts the consumer if no
   *  heartbeat is received within this window. Default: KafkaJS default (30000) */
  sessionTimeout?: number;
  /** How often the consumer sends heartbeats to the broker, in milliseconds.
   *  Should be less than `sessionTimeout / 3`. Default: KafkaJS default (3000) */
  heartbeatInterval?: number;
}
