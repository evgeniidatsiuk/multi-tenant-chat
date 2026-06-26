import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../common/config/configuration';
import { OUTBOX_REPOSITORY, type OutboxRepository } from '../domain/outbox.repository';
import { KafkaOutboxPublisher } from '../infrastructure/messaging/kafka-outbox.publisher';

/**
 * Drains the outbox by repeatedly claiming pending entries and dispatching
 * them to Kafka. Each iteration runs until the queue empties so that a burst
 * of writes is flushed without waiting for the next tick.
 */
@Injectable()
export class OutboxPoller implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPoller.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly repository: OutboxRepository,
    private readonly publisher: KafkaOutboxPublisher,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    const cfg = this.config.get('outbox', { infer: true });
    if (!cfg.enabled) {
      this.logger.warn('Outbox poller disabled by configuration');
      return;
    }
    this.scheduleNext(cfg.pollIntervalMs);
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
    const cfg = this.config.get('outbox', { infer: true });
    let processed = 0;
    while (!this.stopped) {
      const claimed = await this.repository.claim({
        batchSize: cfg.batchSize,
        leaseMs: cfg.leaseMs,
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
          await this.repository.markFailed(entry.id, message, cfg.maxAttempts);
        }
      }
    }
    return processed;
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      void this.runOnce(delayMs);
    }, delayMs);
    // Don't keep the event loop alive solely for the poller.
    this.timer.unref?.();
  }

  private async runOnce(delayMs: number): Promise<void> {
    if (this.stopped) return;
    this.running = true;
    try {
      await this.tick();
    } catch (error) {
      this.logger.error(`Outbox tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
      if (!this.stopped) this.scheduleNext(delayMs);
    }
  }
}
