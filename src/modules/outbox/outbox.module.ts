import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { AppConfig } from '../../common/config/configuration';
import { OutboxPoller } from './application/outbox-poller.service';
import { OUTBOX_CONFIG } from './application/ports/outbox-config';
import { OUTBOX_PUBLISHER } from './application/ports/outbox-publisher.port';
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
    OutboxPoller,
    { provide: OUTBOX_REPOSITORY, useClass: MongoOutboxRepository },
    { provide: OUTBOX_PUBLISHER, useClass: KafkaOutboxPublisher },
    { provide: TRANSACTIONAL_WRITER, useClass: MongoTransactionalWriter },
    {
      provide: OUTBOX_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => config.get('outbox', { infer: true }),
    },
  ],
  exports: [OUTBOX_REPOSITORY, TRANSACTIONAL_WRITER, TransactionContext],
})
export class OutboxModule {}
