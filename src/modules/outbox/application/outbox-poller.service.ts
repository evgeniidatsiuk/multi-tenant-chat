import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { OUTBOX_REPOSITORY, type OutboxRepository } from '../domain/outbox.repository';
import { OUTBOX_CONFIG, type OutboxConfig } from './ports/outbox-config';
import { OUTBOX_PUBLISHER, type OutboxPublisher } from './ports/outbox-publisher.port';

/**
 * Drains the outbox by repeatedly claiming pending entries and dispatching
 * them through the publisher. Each tick runs until the queue empties so a
 * burst of writes is flushed without waiting for the next interval.
 */
@Injectable()
export class OutboxPoller implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPoller.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly repository: OutboxRepository,
    @Inject(OUTBOX_PUBLISHER) private readonly publisher: OutboxPublisher,
    @Inject(OUTBOX_CONFIG) private readonly cfg: OutboxConfig,
  ) {}

  onModuleInit(): void {
    if (!this.cfg.enabled) {
      this.logger.warn('Outbox poller disabled by configuration');
      return;
    }
    this.scheduleNext();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    // Allow an in-flight tick to settle so we don't leave half-leased rows.
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async tick(): Promise<number> {
    if (this.stopped) return 0;
    let processed = 0;
    while (!this.stopped) {
      const claimed = await this.repository.claim({
        batchSize: this.cfg.batchSize,
        leaseMs: this.cfg.leaseMs,
      });
      if (claimed.length === 0) break;
      for (const entry of claimed) {
        try {
          await this.publisher.publish(entry);
          await this.repository.markPublished(entry.id);
          processed += 1;
        } catch (error) {
          const message = (error as Error).message ?? 'unknown error';
          this.logger.error(`Failed to publish outbox entry ${entry.id}: ${message}`);
          await this.repository.markFailed(entry.id, message, this.cfg.maxAttempts);
        }
      }
    }
    return processed;
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      void this.runOnce();
    }, this.cfg.pollIntervalMs);
    // Don't keep the event loop alive solely for the poller.
    this.timer.unref?.();
  }

  private async runOnce(): Promise<void> {
    if (this.stopped) return;
    this.running = true;
    try {
      await this.tick();
    } catch (error) {
      this.logger.error(`Outbox tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
      if (!this.stopped) this.scheduleNext();
    }
  }
}
