import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, keccak256, parseUnits, toHex, type Address } from "viem";

const BUY = 0;
const SELL = 1;

describe("HyperdriveDesk", async () => {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, signer, trader, other, treasury] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  let nonceCounter = 0;
  const freshNonce = () => keccak256(toHex(`nonce-${nonceCounter++}-${Date.now()}`));

  async function setup(feeBps = 0) {
    const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    const aapl = await viem.deployContract("MockERC20", ["Apple xStock", "AAPLx", 18]);
    const desk = await viem.deployContract("HyperdriveDesk", [
      usdc.address,
      signer.account.address,
      treasury.account.address,
      feeBps,
      owner.account.address,
    ]);
    await desk.write.listTokens([[aapl.address]]);

    // Desk inventory: 100 AAPLx + 50k USDC. Trader wallet: 10k USDC.
    await aapl.write.mint([desk.address, parseUnits("100", 18)]);
    await usdc.write.mint([desk.address, parseUnits("50000", 6)]);
    await usdc.write.mint([trader.account.address, parseUnits("10000", 6)]);
    await usdc.write.approve([desk.address, 2n ** 255n], { account: trader.account });
    await aapl.write.approve([desk.address, 2n ** 255n], { account: trader.account });

    return { usdc, aapl, desk };
  }

  async function signQuote(
    desk: Address,
    quote: {
      trader: Address;
      token: Address;
      side: number;
      amountIn: bigint;
      price: bigint;
      deadline: bigint;
      nonce: `0x${string}`;
    },
    by = signer,
  ) {
    return by.signTypedData({
      account: by.account,
      domain: { name: "HyperdriveDesk", version: "1", chainId, verifyingContract: desk },
      types: {
        Quote: [
          { name: "trader", type: "address" },
          { name: "token", type: "address" },
          { name: "side", type: "uint8" },
          { name: "amountIn", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "Quote",
      message: quote,
    });
  }

  async function makeQuote(
    desk: Address,
    token: Address,
    side: number,
    amountIn: bigint,
    overrides: Partial<{ trader: Address; price: bigint; deadline: bigint }> = {},
  ) {
    const block = await publicClient.getBlock();
    const quote = {
      trader: overrides.trader ?? trader.account.address,
      token,
      side,
      amountIn,
      price: overrides.price ?? parseUnits("200", 6), // $200 per share
      deadline: overrides.deadline ?? block.timestamp + 120n,
      nonce: freshNonce(),
    };
    return { quote, signature: await signQuote(desk, quote) };
  }

  it("buys xStock shares with USDC at the signed price", async () => {
    const { usdc, aapl, desk } = await setup();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("500", 6));

    await viem.assertions.emitWithArgs(
      desk.write.buy([quote, signature, 0n], { account: trader.account }),
      desk,
      "Trade",
      [
        getAddress(trader.account.address),
        getAddress(aapl.address),
        BUY,
        parseUnits("500", 6),
        parseUnits("2.5", 18),
        parseUnits("200", 6),
        0n,
        quote.nonce,
      ],
    );

    assert.equal(await aapl.read.balanceOf([trader.account.address]), parseUnits("2.5", 18));
    assert.equal(await usdc.read.balanceOf([trader.account.address]), parseUnits("9500", 6));
    assert.equal(await aapl.read.balanceOf([desk.address]), parseUnits("97.5", 18));
  });

  it("sells xStock shares back for USDC", async () => {
    const { usdc, aapl, desk } = await setup();
    const buy = await makeQuote(desk.address, aapl.address, BUY, parseUnits("1000", 6));
    await desk.write.buy([buy.quote, buy.signature, 0n], { account: trader.account });

    // 5 shares bought at $200; sell 2 at $250.
    const sell = await makeQuote(desk.address, aapl.address, SELL, parseUnits("2", 18), {
      price: parseUnits("250", 6),
    });
    await desk.write.sell([sell.quote, sell.signature, parseUnits("500", 6)], {
      account: trader.account,
    });

    assert.equal(await aapl.read.balanceOf([trader.account.address]), parseUnits("3", 18));
    assert.equal(await usdc.read.balanceOf([trader.account.address]), parseUnits("9500", 6));
  });

  it("takes the fee in USDC and sends it to the fee recipient", async () => {
    const { usdc, aapl, desk } = await setup(50); // 0.5%
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("1000", 6));
    await desk.write.buy([quote, signature, 0n], { account: trader.account });

    assert.equal(await usdc.read.balanceOf([treasury.account.address]), parseUnits("5", 6));
    // (1000 - 5) / 200 = 4.975 shares
    assert.equal(await aapl.read.balanceOf([trader.account.address]), parseUnits("4.975", 18));
  });

  it("rejects a replayed quote", async () => {
    const { aapl, desk } = await setup();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6));
    await desk.write.buy([quote, signature, 0n], { account: trader.account });
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, signature, 0n], { account: trader.account }),
      desk,
      "QuoteAlreadyUsed",
    );
  });

  it("rejects an expired quote", async () => {
    const { aapl, desk } = await setup();
    const block = await publicClient.getBlock();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6), {
      deadline: block.timestamp - 1n,
    });
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, signature, 0n], { account: trader.account }),
      desk,
      "QuoteExpired",
    );
  });

  it("rejects a quote signed by anyone but the quote signer", async () => {
    const { aapl, desk } = await setup();
    const { quote } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6));
    const forged = await signQuote(desk.address, quote, other);
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, forged, 0n], { account: trader.account }),
      desk,
      "BadSignature",
    );
  });

  it("rejects a tampered amount or price", async () => {
    const { aapl, desk } = await setup();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6));
    await viem.assertions.revertWithCustomError(
      desk.write.buy([{ ...quote, price: 1n }, signature, 0n], { account: trader.account }),
      desk,
      "BadSignature",
    );
  });

  it("rejects a quote issued to a different trader", async () => {
    const { aapl, desk } = await setup();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6), {
      trader: other.account.address,
    });
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, signature, 0n], { account: trader.account }),
      desk,
      "NotQuoteTrader",
    );
  });

  it("enforces the slippage floor", async () => {
    const { aapl, desk } = await setup();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6));
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, signature, parseUnits("1", 18)], { account: trader.account }),
      desk,
      "Slippage",
    );
  });

  it("rejects buys beyond the desk's inventory", async () => {
    const { usdc, aapl, desk } = await setup();
    await usdc.write.mint([trader.account.address, parseUnits("100000", 6)]);
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("40000", 6));
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, signature, 0n], { account: trader.account }),
      desk,
      "InsufficientInventory",
    );
  });

  it("rejects unlisted tokens and wrong sides", async () => {
    const { desk } = await setup();
    const rogue = await viem.deployContract("MockERC20", ["Rogue", "RGE", 18]);
    const unlisted = await makeQuote(desk.address, rogue.address, BUY, parseUnits("100", 6));
    await viem.assertions.revertWithCustomError(
      desk.write.buy([unlisted.quote, unlisted.signature, 0n], { account: trader.account }),
      desk,
      "NotListed",
    );
    await viem.assertions.revertWithCustomError(
      desk.write.sell([unlisted.quote, unlisted.signature, 0n], { account: trader.account }),
      desk,
      "WrongSide",
    );
  });

  it("lets the owner or signer cancel an unfilled quote", async () => {
    const { aapl, desk } = await setup();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6));
    await viem.assertions.revertWithCustomError(
      desk.write.cancelNonces([[quote.nonce]], { account: trader.account }),
      desk,
      "NotAuthorized",
    );
    await desk.write.cancelNonces([[quote.nonce]], { account: signer.account });
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, signature, 0n], { account: trader.account }),
      desk,
      "QuoteAlreadyUsed",
    );
  });

  it("blocks trading while paused and limits admin calls to the owner", async () => {
    const { aapl, desk } = await setup();
    await desk.write.pause();
    const { quote, signature } = await makeQuote(desk.address, aapl.address, BUY, parseUnits("100", 6));
    await viem.assertions.revertWithCustomError(
      desk.write.buy([quote, signature, 0n], { account: trader.account }),
      desk,
      "EnforcedPause",
    );
    await desk.write.unpause();

    await viem.assertions.revertWithCustomError(
      desk.write.setQuoteSigner([other.account.address], { account: other.account }),
      desk,
      "OwnableUnauthorizedAccount",
    );
    await viem.assertions.revertWithCustomError(
      desk.write.setFee([101, treasury.account.address]),
      desk,
      "FeeTooHigh",
    );
  });
});
