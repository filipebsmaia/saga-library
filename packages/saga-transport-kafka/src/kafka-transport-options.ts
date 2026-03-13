import type { KafkaConfig, logLevel } from 'kafkajs';
import type { SagaLogger } from '@fbsm/saga-core';

export interface KafkaTransportOptions {
  /** Kafka broker addresses */
  brokers: string[] | KafkaConfig['brokers'];
  /** Client identifier for Kafka connections. Default: 'saga-client' */
  clientId?: string;
  /** TLS/SSL configuration. Pass `true` for default TLS or a tls.ConnectionOptions object */
  ssl?: KafkaConfig['ssl'];
  /** SASL authentication configuration (PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER, AWS) */
  sasl?: KafkaConfig['sasl'];
  /** Connection timeout in milliseconds. Default: KafkaJS default (1000) */
  connectionTimeout?: number;
  /** Authentication timeout in milliseconds */
  authenticationTimeout?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** KafkaJS retry options for the client-level retry policy */
  retry?: KafkaConfig['retry'];
  /** KafkaJS log level. Default: WARN */
  logLevel?: logLevel;
  /** Custom socket factory for advanced networking (e.g., SOCKS proxy) */
  socketFactory?: KafkaConfig['socketFactory'];
  /** Number of partitions consumed concurrently. Default: 3 */
  partitionsConsumedConcurrently?: number;
  /** Register KafkaJsInstrumentation with OTel SDK. Default: true if OTel available */
  enableOtelInstrumentation?: boolean;
  /** Auto-create topics via admin client before subscribing. Default: false */
  autoCreateTopics?: boolean;
  /** Custom logger. Default: ConsoleSagaLogger */
  logger?: SagaLogger;
}
