import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';
import { LLMController } from './llm.controller';
import { OllamaProvider } from './providers/ollama.provider';

@Module({
  imports: [ConfigModule],
  controllers: [LLMController],
  providers: [LLMService, OllamaProvider],
  exports: [LLMService],
})
export class LLMModule {}
