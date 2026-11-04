import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loadConfig } from './config/configuration';
import { CoreModule } from './core.module';
import { HealthModule } from './health/health.module';
import { LLMModule } from './modules/llm/llm.module';
import { AgentsModule } from './modules/agents/agents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    LLMModule,
    AgentsModule,
import { PortfolioModule } from './portfolio/portfolio.module';
import { QuotesModule } from './quotes/quotes.module';
import { SwapsModule } from './swaps/swaps.module';
import { NewsModule } from './news/news.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    MongooseModule.forRootAsync({ useFactory: () => ({ uri: loadConfig().mongoUri }) }),
    CoreModule,
    QuotesModule,
    PortfolioModule,
    SwapsModule,
    NewsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
