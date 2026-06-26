import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../../../common/auth/auth.guard';
import { ListMessagesQueryDto } from '../../application/dto/list-messages.query.dto';
import { SearchMessagesQueryDto } from '../../application/dto/search-messages.query.dto';
import { ListMessagesUseCase } from '../../application/use-cases/list-messages.use-case';
import { SearchMessagesUseCase } from '../../application/use-cases/search-messages.use-case';
import {
  ListMessagesResponse,
  SearchMessagesResponse,
  toMessageView,
  toSearchHitView,
} from './message.presenter';

@ApiTags('conversations')
@ApiBearerAuth('bearer')
@ApiParam({ name: 'conversationId', example: 'c1', description: 'Conversation id.' })
@Controller('/api/conversations/:conversationId/messages')
@UseGuards(AuthGuard)
export class ConversationMessagesController {
  constructor(
    private readonly listMessages: ListMessagesUseCase,
    private readonly searchMessages: SearchMessagesUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List messages in a conversation',
    description: 'Cursor-paginated, newest-first by default. Pass `nextCursor` back as `cursor`.',
  })
  @ApiOkResponse({ type: ListMessagesResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async list(
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<ListMessagesResponse> {
    const result = await this.listMessages.execute(conversationId, query);
    return {
      items: result.items.map(toMessageView),
      nextCursor: result.nextCursor,
    };
  }

  @Get('search')
  @ApiOperation({
    summary: 'Full-text search within a conversation',
    description: 'Backed by Elasticsearch. Returns hits sorted by score then timestamp.',
  })
  @ApiOkResponse({ type: SearchMessagesResponse })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token.' })
  async search(
    @Param('conversationId') conversationId: string,
    @Query() query: SearchMessagesQueryDto,
  ): Promise<SearchMessagesResponse> {
    const result = await this.searchMessages.execute(conversationId, query);
    return {
      hits: result.hits.map(toSearchHitView),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }
}
