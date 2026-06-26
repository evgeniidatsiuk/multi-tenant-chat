import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../../common/config/configuration';
import { OutboxEntry } from '../../../outbox/domain/outbox-entry';
import { OUTBOX_REPOSITORY, type OutboxRepository } from '../../../outbox/domain/outbox.repository';
import type { MessagePublisher } from '../../application/ports/message-publisher.port';
import type { MessageCreatedEvent } from '../../domain/events/message-created.event';

/**
 * Translates a domain event into an outbox row. The actual send to Kafka is
 * handled out-of-band by `OutboxPoller`, which means the caller's transaction
 * commits the message and the publication intent atomically.
 */
@Injectable()
export class OutboxMessagePublisher implements MessagePublisher {
  private readonly topic: string;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository,
    config: ConfigService<AppConfig, true>,
  ) {
    this.topic = config.get('kafka', { infer: true }).topicMessagesCreated;
  }

  async publishMessageCreated(event: MessageCreatedEvent): Promise<void> {
    const entry = OutboxEntry.create({
      topic: this.topic,
      // Per-conversation key keeps order stable on the broker partition.
      key: `${event.payload.tenantId}:${event.payload.conversationId}`,
      headers: { tenantId: event.payload.tenantId, eventType: event.type },
      payload: JSON.stringify(event),
    });
    await this.outbox.enqueue(entry);
  }
}
