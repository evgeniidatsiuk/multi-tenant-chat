import { randomUUID } from 'node:crypto';

export type OutboxStatus = 'pending' | 'publishing' | 'published' | 'failed';

export interface OutboxEntryProps {
  id: string;
  topic: string;
  key: string | null;
  headers: Record<string, string>;
  payload: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: Date;
  publishedAt?: Date;
  leaseExpiresAt?: Date;
}

export interface NewOutboxEntry {
  topic: string;
  key?: string | null;
  headers?: Record<string, string>;
  payload: string;
}

export class OutboxEntry {
  private constructor(private readonly props: OutboxEntryProps) {}

  static create(input: NewOutboxEntry): OutboxEntry {
    if (!input.topic) {
      throw new Error('Outbox entry requires a topic');
    }
    if (!input.payload) {
      throw new Error('Outbox entry requires a payload');
    }
    return new OutboxEntry({
      id: randomUUID(),
      topic: input.topic,
      key: input.key ?? null,
      headers: input.headers ?? {},
      payload: input.payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
    });
  }

  static rehydrate(props: OutboxEntryProps): OutboxEntry {
    return new OutboxEntry({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get topic(): string {
    return this.props.topic;
  }
  get key(): string | null {
    return this.props.key;
  }
  get headers(): Record<string, string> {
    return this.props.headers;
  }
  get payload(): string {
    return this.props.payload;
  }
  get status(): OutboxStatus {
    return this.props.status;
  }
  get attempts(): number {
    return this.props.attempts;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toJSON(): OutboxEntryProps {
    return { ...this.props };
  }
}
