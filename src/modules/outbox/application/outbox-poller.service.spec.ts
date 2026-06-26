import type { ConfigService } from '@nestjs/config';
import { OutboxEntry } from '../domain/outbox-entry';
import type { OutboxRepository } from '../domain/outbox.repository';
import type { KafkaOutboxPublisher } from '../infrastructure/messaging/kafka-outbox.publisher';
import { OutboxPoller } from './outbox-poller.service';

const config = {
  pollIntervalMs: 1000,
  batchSize: 10,
  leaseMs: 5000,
  maxAttempts: 3,
  enabled: true,
};

const fakeConfig = {
  get: (_key: string, _opts?: unknown) => config,
} as unknown as ConfigService;

const buildEntry = (id: string) =>
  OutboxEntry.create({
    topic: 'messages.created',
    key: `tenant-a:conv-${id}`,
    headers: { tenantId: 'tenant-a' },
    payload: JSON.stringify({ id }),
  });

describe('OutboxPoller.tick', () => {
  it('publishes claimed entries and marks them as published', async () => {
    const entry = buildEntry('1');
    const repo: jest.Mocked<OutboxRepository> = {
      enqueue: jest.fn(),
      claim: jest.fn().mockResolvedValueOnce([entry]).mockResolvedValueOnce([]),
      markPublished: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    };
    const publisher: jest.Mocked<KafkaOutboxPublisher> = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<KafkaOutboxPublisher>;

    const poller = new OutboxPoller(repo, publisher, fakeConfig as never);
    const processed = await poller.tick();

    expect(processed).toBe(1);
    expect(publisher.publish).toHaveBeenCalledWith(entry);
    expect(repo.markPublished).toHaveBeenCalledWith(entry.id);
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('marks failed entries and continues with the rest of the batch', async () => {
    const ok = buildEntry('1');
    const bad = buildEntry('2');
    const repo: jest.Mocked<OutboxRepository> = {
      enqueue: jest.fn(),
      claim: jest.fn().mockResolvedValueOnce([bad, ok]).mockResolvedValueOnce([]),
      markPublished: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const publisher = {
      publish: jest
        .fn()
        .mockImplementationOnce(async () => {
          throw new Error('broker down');
        })
        .mockResolvedValue(undefined),
    } as unknown as jest.Mocked<KafkaOutboxPublisher>;

    const poller = new OutboxPoller(repo, publisher, fakeConfig as never);
    const processed = await poller.tick();

    expect(processed).toBe(1);
    expect(repo.markFailed).toHaveBeenCalledWith(bad.id, 'broker down', config.maxAttempts);
    expect(repo.markPublished).toHaveBeenCalledWith(ok.id);
  });

  it('drains multiple batches until the claim returns empty', async () => {
    const batchA = [buildEntry('1'), buildEntry('2')];
    const batchB = [buildEntry('3')];
    const repo: jest.Mocked<OutboxRepository> = {
      enqueue: jest.fn(),
      claim: jest
        .fn()
        .mockResolvedValueOnce(batchA)
        .mockResolvedValueOnce(batchB)
        .mockResolvedValueOnce([]),
      markPublished: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn(),
    };
    const publisher: jest.Mocked<KafkaOutboxPublisher> = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<KafkaOutboxPublisher>;

    const poller = new OutboxPoller(repo, publisher, fakeConfig as never);
    const processed = await poller.tick();

    expect(processed).toBe(3);
    expect(repo.claim).toHaveBeenCalledTimes(3);
  });
});
