import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { OutboxEntry, type OutboxEntryProps } from '../../domain/outbox-entry';
import type { ClaimOptions, OutboxRepository } from '../../domain/outbox.repository';
import { OutboxModel } from './outbox.schema';
import { TransactionContext } from './transaction.context';

@Injectable()
export class MongoOutboxRepository implements OutboxRepository {
  constructor(
    @InjectModel(OutboxModel.name) private readonly model: Model<OutboxModel>,
    private readonly txContext: TransactionContext,
  ) {}

  async enqueue(entry: OutboxEntry): Promise<void> {
    const props = entry.toJSON();
    await this.model.create([this.toDoc(props)], { session: this.txContext.current() });
  }

  async claim({ batchSize, leaseMs }: ClaimOptions): Promise<OutboxEntry[]> {
    const claimed: OutboxEntry[] = [];
    // findOneAndUpdate is atomic against concurrent pollers: two replicas
    // racing on the same row will see only one winner per call.
    for (let i = 0; i < batchSize; i += 1) {
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + leaseMs);
      const doc = await this.model
        .findOneAndUpdate(
          {
            $or: [{ status: 'pending' }, { status: 'publishing', leaseExpiresAt: { $lte: now } }],
          },
          {
            $set: { status: 'publishing', leaseExpiresAt },
            $inc: { attempts: 1 },
          },
          { sort: { createdAt: 1 }, returnDocument: 'after' },
        )
        .lean()
        .exec();
      if (!doc) break;
      claimed.push(this.toDomain(doc));
    }
    return claimed;
  }

  async markPublished(id: string): Promise<void> {
    await this.model.updateOne(
      { id },
      { $set: { status: 'published', publishedAt: new Date() }, $unset: { leaseExpiresAt: '' } },
    );
  }

  async markFailed(id: string, error: string, maxAttempts: number): Promise<void> {
    // Promote to a permanent failure once the row has burned through its
    // retries; otherwise drop the lease so the next poll picks it up again.
    await this.model.updateOne({ id }, [
      {
        $set: {
          lastError: error,
          status: {
            $cond: [{ $gte: ['$attempts', maxAttempts] }, 'failed', 'pending'],
          },
          leaseExpiresAt: '$$REMOVE',
        },
      },
    ]);
  }

  private toDoc(props: OutboxEntryProps): OutboxModel {
    return {
      id: props.id,
      topic: props.topic,
      key: props.key,
      headers: props.headers,
      payload: props.payload,
      status: props.status,
      attempts: props.attempts,
      lastError: props.lastError,
      createdAt: props.createdAt,
      publishedAt: props.publishedAt,
      leaseExpiresAt: props.leaseExpiresAt,
    };
  }

  private toDomain(doc: OutboxModel): OutboxEntry {
    return OutboxEntry.rehydrate({
      id: doc.id,
      topic: doc.topic,
      key: doc.key,
      headers: doc.headers ?? {},
      payload: doc.payload,
      status: doc.status,
      attempts: doc.attempts,
      lastError: doc.lastError,
      createdAt: doc.createdAt,
      publishedAt: doc.publishedAt,
      leaseExpiresAt: doc.leaseExpiresAt,
    });
  }
}
