import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentRun, AgentRunSchema } from '../../db/schemas';
import { NewsModule } from '../../news/news.module';
import { SwapsModule } from '../../swaps/swaps.module';
import { LLMModule } from '../llm/llm.module';
import { AgentsController } from './agents.controller';
import { BasketService } from './basket.service';
import { UnifiedAgentService } from './unified-agent.service';

@Module({
  imports: [
    LLMModule,
    NewsModule,
    SwapsModule,
    MongooseModule.forFeature([{ name: AgentRun.name, schema: AgentRunSchema }]),
  ],
  controllers: [AgentsController],
  providers: [UnifiedAgentService, BasketService],
  exports: [UnifiedAgentService, BasketService],
})
export class AgentsModule {}
