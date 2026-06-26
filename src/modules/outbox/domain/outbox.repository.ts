import type { OutboxEntry } from './outbox-entry';

export interface ClaimOptions {
  batchSize: number;
  leaseMs: number;
}

export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');

export interface OutboxRepository {
  /**
   * Persists a new outbox entry. When called inside `TransactionalWriter.run`
   * the insert participates in the active transaction.
   */
  enqueue(entry: OutboxEntry): Promise<void>;

  /**
   * Atomically claims up to `batchSize` entries that are either pending or have
   * an expired lease, marking them as `publishing` and extending the lease.
   * Entries are returned in creation order so partition-keyed events keep their
   * relative order on the wire.
   */
  claim(options: ClaimOptions): Promise<OutboxEntry[]>;

  markPublished(id: string): Promise<void>;

  markFailed(id: string, error: string, maxAttempts: number): Promise<void>;
}
