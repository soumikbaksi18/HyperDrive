import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loadConfig } from './config/configuration';
import { CoreModule } from './core.module';
import { HealthModule } from './health/health.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { QuotesModule } from './quotes/quotes.module';
import { SwapsModule } from './swaps/swaps.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    MongooseModule.forRootAsync({ useFactory: () => ({ uri: loadConfig().mongoUri }) }),
    CoreModule,
    QuotesModule,
    PortfolioModule,
    SwapsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
