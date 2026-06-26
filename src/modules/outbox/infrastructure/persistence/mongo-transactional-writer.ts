import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { TransactionalWriter } from '../../domain/transactional-writer';
import { TransactionContext } from './transaction.context';

@Injectable()
export class MongoTransactionalWriter implements TransactionalWriter {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly context: TransactionContext,
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await this.context.run(session, fn);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
