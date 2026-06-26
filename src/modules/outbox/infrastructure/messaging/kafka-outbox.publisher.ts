import { Injectable } from '@nestjs/common';
import { KafkaClient } from '../../../../common/kafka/kafka.client';
import type { OutboxPublisher } from '../../application/ports/outbox-publisher.port';
import type { OutboxEntry } from '../../domain/outbox-entry';

@Injectable()
export class KafkaOutboxPublisher implements OutboxPublisher {
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
