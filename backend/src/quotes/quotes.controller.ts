import { Body, Controller, Post } from '@nestjs/common';
import { IsEthereumAddress, IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';
import type { TradeSide } from '../db/schemas';
import { QuotesService } from './quotes.service';

export class CreateQuoteDto {
  @IsEthereumAddress() trader!: string;
  @IsString() @IsNotEmpty() symbol!: string;
  @IsIn(['buy', 'sell']) side!: TradeSide;
  /** Human units: USDC for a buy, xStock shares for a sell. */
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a positive decimal string' })
  amount!: string;
}

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  @Post()
  create(@Body() body: CreateQuoteDto) {
    return this.quotes.create(body);
  }
}
