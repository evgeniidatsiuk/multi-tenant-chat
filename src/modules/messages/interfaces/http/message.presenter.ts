import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SearchHit } from '../../domain/message-search.repository';
import type { Message } from '../../domain/message.entity';

export class MessageView {
  @ApiProperty({ example: '01HXYABCDEFGHJKMNPQRSTVWXY' })
  id!: string;

  @ApiProperty({ example: 'c1' })
  conversationId!: string;

  @ApiProperty({ example: 'user:tenant-a' })
  senderId!: string;

  @ApiProperty({ example: 'hello world' })
  content!: string;

  @ApiProperty({ example: '2026-01-01T12:34:56.789Z', format: 'date-time' })
  timestamp!: string;

  @ApiPropertyOptional({
    example: { source: 'web', clientMessageId: '4f9b' },
    type: 'object',
    additionalProperties: true,
  })
  metadata?: Record<string, unknown>;
}

export const toMessageView = (message: Message): MessageView => {
  const props = message.toJSON();
  return {
    id: props.id,
    conversationId: props.conversationId,
    senderId: props.senderId,
    content: props.content,
    timestamp: props.timestamp.toISOString(),
    metadata: props.metadata,
  };
};

export class SearchHitView extends MessageView {
  @ApiProperty({ example: 1.42, description: 'Elasticsearch relevance score.' })
  score!: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['<em>hello</em> world'],
    description: 'Highlight snippets of `content`.',
  })
  highlights?: string[];
}

export const toSearchHitView = (hit: SearchHit): SearchHitView => ({
  ...toMessageView(hit.message),
  score: hit.score,
  highlights: hit.highlights,
});

export class ListMessagesResponse {
  @ApiProperty({ type: [MessageView] })
  items!: MessageView[];

  @ApiPropertyOptional({
    description: 'Pass back as `cursor` to fetch the next page. Absent on the last page.',
    example: 'eyJ0IjoiMjAyNi0wMS0wMVQwMDowMDowMFoiLCJpIjoiMDFIWFkifQ',
  })
  nextCursor?: string;
}

export class SearchMessagesResponse {
  @ApiProperty({ type: [SearchHitView] })
  hits!: SearchHitView[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}
