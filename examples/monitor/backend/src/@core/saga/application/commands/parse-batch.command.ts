import { Command } from '@core/common/domain/command';
import { extractSagaHeaders } from '@core/saga/infra/kafka/header-extractor';
import type { PreparedMessage } from '@core/saga/application/types/projector.types';

export interface ParseBatchInput {
  messages: { headers?: Record<string, Buffer | string | (string | Buffer)[] | undefined>; offset: string }[];
  topic: string;
  partition: number;
}

export interface ParseBatchOutput {
  prepared: PreparedMessage[];
  skipped: number;
}

export class ParseBatchCommand extends Command<ParseBatchInput, ParseBatchOutput> {
  async execute({ messages, topic, partition }: ParseBatchInput): Promise<ParseBatchOutput> {
    const prepared: PreparedMessage[] = [];
    let skipped = 0;

    for (const message of messages) {
      const headers = (message.headers ?? {}) as Record<string, Buffer | string | undefined>;
      const parsed = extractSagaHeaders(headers);
      if (!parsed || !parsed.sagaEventId) {
        skipped++;
        continue;
      }
      prepared.push({
        parsed,
        headersJson: this.serializeHeaders(headers),
        topic,
        partition,
        offset: message.offset,
      });
    }

    return { prepared, skipped };
  }

  private serializeHeaders(headers: Record<string, Buffer | string | undefined>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined && value !== null) {
        result[key] = typeof value === 'string' ? value : value.toString('utf-8');
      }
    }
    return result;
  }
}
