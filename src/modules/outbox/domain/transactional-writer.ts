export const TRANSACTIONAL_WRITER = Symbol('TRANSACTIONAL_WRITER');

/**
 * Runs the given function inside a single storage-level transaction. Any
 * repository call made from inside `fn` (including nested calls) commits or
 * rolls back together with the rest of the work.
 */
export interface TransactionalWriter {
  run<T>(fn: () => Promise<T>): Promise<T>;
}
