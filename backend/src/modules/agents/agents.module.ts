import { Module } from '@nestjs/common';
import { UnifiedAgentService } from './unified-agent.service';
import { AgentsController } from './agents.controller';
import { LLMModule } from '../llm/llm.module';

@Module({
  imports: [LLMModule],
  controllers: [AgentsController],
  providers: [UnifiedAgentService],
  exports: [UnifiedAgentService],
})
export class AgentsModule {}
