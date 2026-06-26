import { OutboxEntry } from '../domain/outbox-entry';
import type { OutboxRepository } from '../domain/outbox.repository';
import { OutboxPoller } from './outbox-poller.service';
import type { OutboxConfig } from './ports/outbox-config';
import type { OutboxPublisher } from './ports/outbox-publisher.port';

const config = {
  enabled: true,
  pollIntervalMs: 1000,
  batchSize: 10,
  leaseMs: 5000,
  maxAttempts: 3,
} satisfies OutboxConfig;

const buildEntry = (id: string) =>
  OutboxEntry.create({
    topic: 'messages.created',
    key: `tenant-a:conv-${id}`,
    headers: { tenantId: 'tenant-a' },
    payload: JSON.stringify({ id }),
  });

const buildRepo = (overrides: Partial<jest.Mocked<OutboxRepository>> = {}) => {
  const repo = {
    enqueue: jest.fn().mockResolvedValue(undefined),
    claim: jest.fn().mockResolvedValue([]),
    markPublished: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies jest.Mocked<OutboxRepository>;
  return repo;
};

const buildPublisher = () => {
  const publisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  } satisfies jest.Mocked<OutboxPublisher>;
  return publisher;
};

describe('OutboxPoller.tick', () => {
  it('publishes claimed entries and marks them as published', async () => {
    const entry = buildEntry('1');
    const repo = buildRepo({
      claim: jest.fn().mockResolvedValueOnce([entry]).mockResolvedValueOnce([]),
    });
    const publisher = buildPublisher();

    const processed = await new OutboxPoller(repo, publisher, config).tick();

    expect(processed).toBe(1);
    expect(publisher.publish).toHaveBeenCalledWith(entry);
    expect(repo.markPublished).toHaveBeenCalledWith(entry.id);
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it('marks failed entries and continues with the rest of the batch', async () => {
    const bad = buildEntry('1');
    const ok = buildEntry('2');
    const repo = buildRepo({
      claim: jest.fn().mockResolvedValueOnce([bad, ok]).mockResolvedValueOnce([]),
    });
    const publisher = buildPublisher();
    publisher.publish
      .mockImplementationOnce(async () => {
        throw new Error('broker down');
      })
      .mockResolvedValue(undefined);

    const processed = await new OutboxPoller(repo, publisher, config).tick();

    expect(processed).toBe(1);
    expect(repo.markFailed).toHaveBeenCalledWith(bad.id, 'broker down', config.maxAttempts);
    expect(repo.markPublished).toHaveBeenCalledWith(ok.id);
  });

  it('drains multiple batches until the claim returns empty', async () => {
    const batchA = [buildEntry('1'), buildEntry('2')];
    const batchB = [buildEntry('3')];
    const repo = buildRepo({
      claim: jest
        .fn()
        .mockResolvedValueOnce(batchA)
        .mockResolvedValueOnce(batchB)
        .mockResolvedValueOnce([]),
    });
    const publisher = buildPublisher();

    const processed = await new OutboxPoller(repo, publisher, config).tick();

    expect(processed).toBe(3);
    expect(repo.claim).toHaveBeenCalledTimes(3);
  });
});
