import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuoteRecord, QuoteRecordSchema } from '../db/schemas';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: QuoteRecord.name, schema: QuoteRecordSchema }])],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
