import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  list(
    @Query('ticker') ticker?: string,
    @Query('category') category?: string,
    @Query('time_filter') time_filter?: string,
    @Query('page') page?: string,
    @Query('page_size') page_size?: string,
    @Query('q') q?: string,
  ) {
    return this.news.list({ ticker, category, time_filter, page, page_size, q });
  }

  @Get('search')
  search(
    @Query('q') q: string,
    @Query('time_filter') time_filter?: string,
    @Query('page') page?: string,
    @Query('page_size') page_size?: string,
  ) {
    return this.news.search({ q: q ?? '', time_filter, page, page_size });
  }

  @Get('summary')
  summary(@Query('time_filter') time_filter?: string, @Query('ticker') ticker?: string) {
    return this.news.summary({ time_filter, ticker });
  }

  @Post('sentiment')
  sentiment(@Body() body: { text?: string }) {
    return this.news.analyzeSentiment(body.text ?? '');
  }
}
