import { Global, Module } from '@nestjs/common';
import { KafkaClient } from './kafka.client';

@Global()
@Module({
  providers: [KafkaClient],
  exports: [KafkaClient],
})
export class KafkaModule {}
