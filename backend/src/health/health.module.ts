import { Module } from '@nestjs/common';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PortfolioModule],
  controllers: [HealthController],
})
export class HealthModule {}
