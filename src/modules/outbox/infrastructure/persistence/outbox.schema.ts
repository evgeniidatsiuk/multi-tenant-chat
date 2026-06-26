import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'outbox', versionKey: false })
export class OutboxModel {
  @Prop({ type: String, required: true, unique: true })
  id!: string;

  @Prop({ type: String, required: true })
  topic!: string;

  @Prop({ type: String, default: null })
  key!: string | null;

  @Prop({ type: Object, default: {} })
  headers!: Record<string, string>;

  @Prop({ type: String, required: true })
  payload!: string;

  @Prop({ type: String, required: true, enum: ['pending', 'publishing', 'published', 'failed'] })
  status!: 'pending' | 'publishing' | 'published' | 'failed';

  @Prop({ type: Number, required: true, default: 0 })
  attempts!: number;

  @Prop({ type: String })
  lastError?: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ type: Date })
  leaseExpiresAt?: Date;
}

export const OutboxSchema = SchemaFactory.createForClass(OutboxModel);

// Drives the poller's claim query and keeps the scan bounded to recent work.
OutboxSchema.index({ status: 1, createdAt: 1 });
// Periodic sweep of published rows; TTL is intentionally generous so failed
// rows are preserved long enough for investigation before being dropped.
OutboxSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
