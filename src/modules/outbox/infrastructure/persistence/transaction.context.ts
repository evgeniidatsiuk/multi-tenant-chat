import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';

/**
 * Carries the active Mongo `ClientSession` through async call chains so that
 * repositories can join the current transaction without taking the session as
 * an explicit parameter.
 */
@Injectable()
export class TransactionContext {
  private readonly storage = new AsyncLocalStorage<ClientSession>();

  run<T>(session: ClientSession, fn: () => T): T {
    return this.storage.run(session, fn);
  }

  current(): ClientSession | undefined {
    return this.storage.getStore();
  }
}
