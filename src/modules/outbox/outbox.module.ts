import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxPoller } from './application/outbox-poller.service';
import { OUTBOX_REPOSITORY } from './domain/outbox.repository';
import { TRANSACTIONAL_WRITER } from './domain/transactional-writer';
import { KafkaOutboxPublisher } from './infrastructure/messaging/kafka-outbox.publisher';
import { MongoOutboxRepository } from './infrastructure/persistence/mongo-outbox.repository';
import { MongoTransactionalWriter } from './infrastructure/persistence/mongo-transactional-writer';
import { OutboxModel, OutboxSchema } from './infrastructure/persistence/outbox.schema';
import { TransactionContext } from './infrastructure/persistence/transaction.context';

@Module({
  imports: [MongooseModule.forFeature([{ name: OutboxModel.name, schema: OutboxSchema }])],
  providers: [
    TransactionContext,
    KafkaOutboxPublisher,
    OutboxPoller,
    { provide: OUTBOX_REPOSITORY, useClass: MongoOutboxRepository },
    { provide: TRANSACTIONAL_WRITER, useClass: MongoTransactionalWriter },
  ],
  exports: [OUTBOX_REPOSITORY, TRANSACTIONAL_WRITER, TransactionContext],
})
export class OutboxModule {}
