import { Injectable } from '@nestjs/common';
import { KafkaClient } from '../../../../common/kafka/kafka.client';
import type { OutboxEntry } from '../../domain/outbox-entry';

/**
 * Sends a single outbox entry to Kafka. Stateless and reusable by anything
 * that has an `OutboxEntry` to publish (today only the poller).
 */
@Injectable()
export class KafkaOutboxPublisher {
  constructor(private readonly kafka: KafkaClient) {}

  async publish(entry: OutboxEntry): Promise<void> {
    const props = entry.toJSON();
    await this.kafka.producer.send({
      topic: props.topic,
      messages: [
        {
          key: props.key,
          value: props.payload,
          headers: { ...props.headers, outboxId: props.id },
        },
      ],
    });
  }
}
