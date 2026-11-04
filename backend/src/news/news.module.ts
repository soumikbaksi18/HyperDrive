import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NewsArticleDoc, NewsArticleDocSchema, NewsSyncState, NewsSyncStateSchema } from '../db/schemas';
import { NewsController } from './news.controller';
import { NewsProvider } from './news.provider';
import { NewsRefreshService } from './news-refresh.service';
import { NewsTransformService } from './news-transform.service';
import { NewsService } from './news.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NewsArticleDoc.name, schema: NewsArticleDocSchema },
      { name: NewsSyncState.name, schema: NewsSyncStateSchema },
    ]),
  ],
  controllers: [NewsController],
  providers: [NewsProvider, NewsTransformService, NewsRefreshService, NewsService],
  exports: [NewsService],
})
export class NewsModule {}
