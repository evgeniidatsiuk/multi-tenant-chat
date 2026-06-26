import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../../../common/auth/auth.guard';
import { CreateMessageDto } from '../../application/dto/create-message.dto';
import { CreateMessageUseCase } from '../../application/use-cases/create-message.use-case';
import { MessageView, toMessageView } from './message.presenter';

@ApiTags('messages')
@ApiBearerAuth('bearer')
@Controller('/api/messages')
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly createMessage: CreateMessageUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a message',
    description:
      'Persists the message and enqueues an outbox event that is published to Kafka and indexed in Elasticsearch.',
  })
  @ApiBody({
    type: CreateMessageDto,
    examples: {
      minimal: {
        summary: 'Minimal payload',
        value: { conversationId: 'c1', content: 'hello world' },
      },
      withMetadata: {
        summary: 'With sender override and metadata',
        value: {
          conversationId: 'c1',
          content: 'hello with metadata',
          senderId: 'user:tenant-a',
          metadata: { source: 'web', clientMessageId: '4f9b' },
        },
      },
    },
  })
  @ApiCreatedResponse({ type: MessageView, description: 'The created message.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async create(@Body() dto: CreateMessageDto): Promise<MessageView> {
    const message = await this.createMessage.execute(dto);
    return toMessageView(message);
  }
}
