import { Body, Controller, Module, Post } from '@nestjs/common';
import { CreateQuoteDto } from '../quotes/quotes.controller';
import { SwapsService } from './swaps.service';

@Controller('swap')
export class SwapsController {
  constructor(private readonly swaps: SwapsService) {}

  /** Build a wallet-signed USDC <-> xStock swap through the DEX aggregator (mainnet path). */
  @Post('quote')
  quote(@Body() body: CreateQuoteDto) {
    return this.swaps.quote(body);
  }
}

@Module({
  controllers: [SwapsController],
  providers: [SwapsService],
  exports: [SwapsService],
})
export class SwapsModule {}
