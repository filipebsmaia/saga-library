import { Command } from '@core/common/domain/command';
import { SagaPublisher } from '@core/saga/application/saga-publisher';
import type { SagaUpdate } from '@core/saga/application/types/projector.types';

export interface PublishUpdatesInput {
  sagaUpdates: SagaUpdate[];
}

export class PublishUpdatesCommand extends Command<PublishUpdatesInput> {
  constructor(private readonly publisher: SagaPublisher) {
    super();
  }

  async execute({ sagaUpdates }: PublishUpdatesInput): Promise<void> {
    if (sagaUpdates.length === 0) {
      return;
    }

    await Promise.all(
      sagaUpdates.map((u) =>
        this.publisher.publishSagaUpdate(u.state, u.event).catch(() => {
          //
        }),
      ),
    );
  }
}
