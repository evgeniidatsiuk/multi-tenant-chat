import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Conversation identifier scoped to the tenant.',
    example: 'c1',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  conversationId!: string;

  @ApiProperty({
    description: 'Message body. Stored verbatim, trimmed and length-bounded.',
    example: 'hello world',
    minLength: 1,
    maxLength: 8000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Override sender id. Defaults to the authenticated principal user id.',
    example: 'user:tenant-a',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  senderId?: string;

  @ApiPropertyOptional({
    description: 'Free-form metadata stored alongside the message.',
    example: { source: 'web', clientMessageId: '4f9b' },
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, unknown>;
}
