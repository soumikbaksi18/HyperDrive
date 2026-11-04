import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { IsEthereumAddress, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { BasketsService, type BasketSide } from './baskets.service';

class BasketQuoteDto {
  @IsEthereumAddress() trader!: string;
  @IsIn(['buy', 'sell']) side!: BasketSide;
  /** USDC for a buy, basket shares for a sell. */
  @Matches(/^\d+(\.\d+)?$/) amount!: string;
  @IsOptional() @IsInt() @Min(10) @Max(500) slippageBps?: number;
}

@Controller('baskets')
export class BasketsController {
  constructor(private readonly baskets: BasketsService) {}

  /** Basket composition, reserves, NAV per share, TVL. */
  @Get()
  info() {
    return this.baskets.info();
  }

  /** Uniswap v4 swap parameters (pool key + hookData) for BasketRouter.swapExactIn. */
  @Post('quote')
  quote(@Body() body: BasketQuoteDto) {
    return this.baskets.quote(body);
  }
}

@Module({
  controllers: [BasketsController],
  providers: [BasketsService],
  exports: [BasketsService],
})
export class BasketsModule {}
