import { TenantContext } from '../../../../common/tenant/tenant-context';
import type { TransactionalWriter } from '../../../outbox/domain/transactional-writer';
import type { MessageRepository } from '../../domain/message.repository';
import type { MessagePublisher } from '../ports/message-publisher.port';
import { CreateMessageUseCase } from './create-message.use-case';

describe('CreateMessageUseCase', () => {
  const buildContext = (tenantId = 'tenant-a', userId = 'user-1') => {
    const ctx = new TenantContext();
    return {
      ctx,
      run: <T>(fn: () => Promise<T> | T) => ctx.run({ tenantId, userId }, fn),
    };
  };

  const buildRepo = (): jest.Mocked<MessageRepository> => ({
    save: jest.fn().mockResolvedValue(undefined),
    list: jest.fn(),
  });

  const buildPublisher = (): jest.Mocked<MessagePublisher> => ({
    publishMessageCreated: jest.fn().mockResolvedValue(undefined),
  });

  const buildWriter = () => {
    const writer = {
      committed: 0,
      rolledBack: 0,
      run: jest.fn(async <T>(fn: () => Promise<T>): Promise<T> => {
        try {
          const result = await fn();
          writer.committed += 1;
          return result;
        } catch (error) {
          writer.rolledBack += 1;
          throw error;
        }
      }),
    } satisfies TransactionalWriter & { committed: number; rolledBack: number };
    return writer;
  };

  it('persists the message and enqueues the event inside the same transaction', async () => {
    const { ctx, run } = buildContext();
    const repo = buildRepo();
    const publisher = buildPublisher();
    const writer = buildWriter();
    const order: string[] = [];
    repo.save.mockImplementation(async () => {
      order.push('save');
    });
    publisher.publishMessageCreated.mockImplementation(async () => {
      order.push('publish');
    });

    const useCase = new CreateMessageUseCase(repo, publisher, writer, ctx);

    const message = await run(() =>
      useCase.execute({ conversationId: 'conv-1', content: 'hello' }),
    );

    expect(writer.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['save', 'publish']);
    expect(writer.committed).toBe(1);
    expect(writer.rolledBack).toBe(0);
    expect(message.tenantId).toBe('tenant-a');
    expect(message.senderId).toBe('user-1');
  });

  it('uses senderId from the DTO when provided', async () => {
    const { ctx, run } = buildContext();
    const useCase = new CreateMessageUseCase(buildRepo(), buildPublisher(), buildWriter(), ctx);
    const message = await run(() =>
      useCase.execute({ conversationId: 'conv-1', content: 'hi', senderId: 'override' }),
    );
    expect(message.senderId).toBe('override');
  });

  it('rolls back when the publisher fails', async () => {
    const { ctx, run } = buildContext();
    const repo = buildRepo();
    const publisher = buildPublisher();
    publisher.publishMessageCreated.mockRejectedValueOnce(new Error('outbox down'));
    const writer = buildWriter();

    const useCase = new CreateMessageUseCase(repo, publisher, writer, ctx);

    await expect(
      run(() => useCase.execute({ conversationId: 'conv-1', content: 'hi' })),
    ).rejects.toThrow('outbox down');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(writer.committed).toBe(0);
    expect(writer.rolledBack).toBe(1);
  });

  it('rejects invalid input before opening a transaction', async () => {
    const { ctx, run } = buildContext();
    const repo = buildRepo();
    const publisher = buildPublisher();
    const writer = buildWriter();
    const useCase = new CreateMessageUseCase(repo, publisher, writer, ctx);

    await expect(
      run(() => useCase.execute({ conversationId: 'conv-1', content: '   ' })),
    ).rejects.toThrow(/content/);
    expect(writer.run).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });
});
