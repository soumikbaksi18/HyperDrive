import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { encodeAbiParameters, encodeFunctionData, getAddress, parseUnits, type Address, type Hex } from "viem";

/** Flags the hook needs in the low 14 bits of its address: beforeInitialize | beforeAddLiquidity | beforeSwap | beforeSwapReturnsDelta. */
const HOOK_FLAGS = (1n << 13n) | (1n << 11n) | (1n << 7n) | (1n << 3n);
const SQRT_PRICE_1_1 = 2n ** 96n;

describe("HyperdriveBasket (NVDAx + TSLAx) and Uniswap v4 hook", async () => {
  const { viem, provider } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, alice, bob] = await viem.getWalletClients();

  async function setup() {
    const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
    const nvda = await viem.deployContract("MockERC20", ["NVIDIA xStock", "NVDAx", 18]);
    const tsla = await viem.deployContract("MockERC20", ["Tesla xStock", "TSLAx", 18]);
    const router = await viem.deployContract("MockSwapRouter");
    // 1 share ~= $1 at launch: 0.0025 NVDAx ($200) + 0.00125 TSLAx ($400).
    const basket = await viem.deployContract("HyperdriveBasket", [
      "Hyperdrive NVDA-TSLA Basket",
      "hNVTS",
      usdc.address,
      router.address,
      [nvda.address, tsla.address],
      [parseUnits("0.0025", 18), parseUnits("0.00125", 18)],
      owner.account.address,
    ]);
    for (const who of [alice, bob]) {
      await usdc.write.mint([who.account.address, parseUnits("10000", 6)]);
    }
    const buyLeg = (token: Address, usdcIn: bigint, out: bigint) =>
      encodeFunctionData({
        abi: router.abi,
        functionName: "swap",
        args: [usdc.address, token, usdcIn, out, basket.address],
      });
    const sellLeg = (token: Address, amountIn: bigint, usdcOut: bigint) =>
      encodeFunctionData({
        abi: router.abi,
        functionName: "swap",
        args: [token, usdc.address, amountIn, usdcOut, basket.address],
      });
    return { usdc, nvda, tsla, router, basket, buyLeg, sellLeg };
  }

  it("mints shares for USDC split across NVDAx and TSLAx", async () => {
    const { usdc, nvda, tsla, basket, buyLeg } = await setup();
    await usdc.write.approve([basket.address, parseUnits("1000", 6)], { account: alice.account });
    // $500 -> 2.5 NVDAx, $500 -> 1.25 TSLAx
    await basket.write.mint(
      [
        parseUnits("1000", 6),
        [parseUnits("500", 6), parseUnits("500", 6)],
        [buyLeg(nvda.address, parseUnits("500", 6), parseUnits("2.5", 18)), buyLeg(tsla.address, parseUnits("500", 6), parseUnits("1.25", 18))],
        0n,
        alice.account.address,
        alice.account.address,
      ],
      { account: alice.account },
    );
    assert.equal(await basket.read.balanceOf([alice.account.address]), parseUnits("1000", 18));
    assert.deepEqual(await basket.read.reserves(), [parseUnits("2.5", 18), parseUnits("1.25", 18)]);
    assert.equal(await usdc.read.balanceOf([basket.address]), 0n);
  });

  it("prices later mints off the smallest proportional leg (oracle-free)", async () => {
    const { usdc, nvda, tsla, basket, buyLeg } = await setup();
    await usdc.write.approve([basket.address, 2n ** 255n], { account: alice.account });
    await usdc.write.approve([basket.address, 2n ** 255n], { account: bob.account });
    await basket.write.mint(
      [parseUnits("1000", 6), [parseUnits("500", 6), parseUnits("500", 6)],
        [buyLeg(nvda.address, parseUnits("500", 6), parseUnits("2.5", 18)), buyLeg(tsla.address, parseUnits("500", 6), parseUnits("1.25", 18))],
        0n, alice.account.address, alice.account.address],
      { account: alice.account },
    );
    // Bob adds 10% of NVDAx reserves but only 8% of TSLAx reserves -> 8% of supply.
    await basket.write.mint(
      [parseUnits("100", 6), [parseUnits("50", 6), parseUnits("50", 6)],
        [buyLeg(nvda.address, parseUnits("50", 6), parseUnits("0.25", 18)), buyLeg(tsla.address, parseUnits("50", 6), parseUnits("0.1", 18))],
        0n, bob.account.address, bob.account.address],
      { account: bob.account },
    );
    assert.equal(await basket.read.balanceOf([bob.account.address]), parseUnits("80", 18));
  });

  it("redeems in kind and to USDC, pro-rata", async () => {
    const { usdc, nvda, tsla, basket, buyLeg, sellLeg } = await setup();
    await usdc.write.approve([basket.address, 2n ** 255n], { account: alice.account });
    await basket.write.mint(
      [parseUnits("1000", 6), [parseUnits("500", 6), parseUnits("500", 6)],
        [buyLeg(nvda.address, parseUnits("500", 6), parseUnits("2.5", 18)), buyLeg(tsla.address, parseUnits("500", 6), parseUnits("1.25", 18))],
        0n, alice.account.address, alice.account.address],
      { account: alice.account },
    );
    await basket.write.redeem([parseUnits("400", 18), alice.account.address], { account: alice.account });
    assert.equal(await nvda.read.balanceOf([alice.account.address]), parseUnits("1", 18));
    assert.equal(await tsla.read.balanceOf([alice.account.address]), parseUnits("0.5", 18));

    const usdcBefore = await usdc.read.balanceOf([alice.account.address]);
    // 100 shares -> 0.25 NVDAx + 0.125 TSLAx, sold for $55 + $45.
    await basket.write.redeemToUsdc(
      [parseUnits("100", 18),
        [sellLeg(nvda.address, parseUnits("0.25", 18), parseUnits("55", 6)), sellLeg(tsla.address, parseUnits("0.125", 18), parseUnits("45", 6))],
        parseUnits("99", 6), alice.account.address, alice.account.address],
      { account: alice.account },
    );
    assert.equal((await usdc.read.balanceOf([alice.account.address])) - usdcBefore, parseUnits("100", 6));
    assert.equal(await basket.read.totalSupply(), parseUnits("500", 18));
  });

  it("refunds unspent USDC and enforces the share floor", async () => {
    const { usdc, nvda, tsla, basket, buyLeg } = await setup();
    await usdc.write.approve([basket.address, 2n ** 255n], { account: alice.account });
    const before = await usdc.read.balanceOf([alice.account.address]);
    // Legs only spend 400 + 500 of the 1000 allotted (router pulls exactly amountIn).
    await basket.write.mint(
      [parseUnits("1000", 6), [parseUnits("500", 6), parseUnits("500", 6)],
        [buyLeg(nvda.address, parseUnits("400", 6), parseUnits("2", 18)), buyLeg(tsla.address, parseUnits("500", 6), parseUnits("1.25", 18))],
        0n, alice.account.address, alice.account.address],
      { account: alice.account },
    );
    assert.equal(before - (await usdc.read.balanceOf([alice.account.address])), parseUnits("900", 6));
    await viem.assertions.revertWithCustomError(
      basket.write.mint(
        [parseUnits("100", 6), [parseUnits("50", 6), parseUnits("50", 6)],
          [buyLeg(nvda.address, parseUnits("50", 6), parseUnits("0.2", 18)), buyLeg(tsla.address, parseUnits("50", 6), parseUnits("0.125", 18))],
          parseUnits("1000", 18), alice.account.address, alice.account.address],
        { account: alice.account },
      ),
      basket,
      "Slippage",
    );
  });

  it("buys and sells the basket with USDC through a Uniswap v4 pool + hook", async () => {
    const { usdc, nvda, tsla, basket, buyLeg, sellLeg } = await setup();
    const poolManager = await viem.deployContract("PoolManager", [owner.account.address]);

    // Deploy the hook, then place its (immutable-only) runtime code at an address whose low bits
    // carry the hook flags, as v4 requires. On mainnet the deploy script mines a CREATE2 salt instead.
    const impl = await viem.deployContract("HyperdriveBasketHook", [poolManager.address, basket.address]);
    const hookAddress = getAddress(`0x${((0x4444n << 144n) | HOOK_FLAGS).toString(16).padStart(40, "0")}`);
    const code = await publicClient.getCode({ address: impl.address });
    await provider.request({ method: "hardhat_setCode", params: [hookAddress, code!] });
    const hook = await viem.getContractAt("HyperdriveBasketHook", hookAddress);
    assert.equal(getAddress(await hook.read.basket()), getAddress(basket.address));

    const usdcIs0 = BigInt(usdc.address) < BigInt(basket.address);
    const key = {
      currency0: usdcIs0 ? usdc.address : basket.address,
      currency1: usdcIs0 ? basket.address : usdc.address,
      fee: 0,
      tickSpacing: 1,
      hooks: hookAddress,
    } as const;
    await poolManager.write.initialize([key, SQRT_PRICE_1_1]);

    const router = await viem.deployContract("BasketRouter", [poolManager.address]);
    const deadline = (await publicClient.getBlock()).timestamp + 600n;

    // BUY: 1000 USDC in -> 1000 hNVTS out (first mint).
    const buyData = encodeAbiParameters(
      [{ type: "uint256[]" }, { type: "bytes[]" }, { type: "uint256" }, { type: "address" }],
      [
        [parseUnits("500", 6), parseUnits("500", 6)],
        [buyLeg(nvda.address, parseUnits("500", 6), parseUnits("2.5", 18)), buyLeg(tsla.address, parseUnits("500", 6), parseUnits("1.25", 18))] as Hex[],
        parseUnits("990", 18),
        alice.account.address,
      ],
    );
    await usdc.write.approve([router.address, parseUnits("1000", 6)], { account: alice.account });
    await router.write.swapExactIn(
      [key, usdcIs0, parseUnits("1000", 6), parseUnits("990", 18), buyData, alice.account.address, deadline],
      { account: alice.account },
    );
    assert.equal(await basket.read.balanceOf([alice.account.address]), parseUnits("1000", 18));
    assert.deepEqual(await basket.read.reserves(), [parseUnits("2.5", 18), parseUnits("1.25", 18)]);
    assert.equal(await usdc.read.balanceOf([hookAddress]), 0n);
    assert.equal(await basket.read.balanceOf([hookAddress]), 0n);

    // SELL: 200 hNVTS in -> 0.5 NVDAx + 0.25 TSLAx sold for $210 out.
    const sellData = encodeAbiParameters(
      [{ type: "bytes[]" }, { type: "uint256" }, { type: "address" }],
      [
        [sellLeg(nvda.address, parseUnits("0.5", 18), parseUnits("110", 6)), sellLeg(tsla.address, parseUnits("0.25", 18), parseUnits("100", 6))] as Hex[],
        parseUnits("200", 6),
        alice.account.address,
      ],
    );
    const usdcBefore = await usdc.read.balanceOf([alice.account.address]);
    await basket.write.approve([router.address, parseUnits("200", 18)], { account: alice.account });
    await router.write.swapExactIn(
      [key, !usdcIs0, parseUnits("200", 18), parseUnits("200", 6), sellData, alice.account.address, deadline],
      { account: alice.account },
    );
    assert.equal((await usdc.read.balanceOf([alice.account.address])) - usdcBefore, parseUnits("210", 6));
    assert.equal(await basket.read.totalSupply(), parseUnits("800", 18));
  });

  it("rejects pools for any other pair", async () => {
    const { usdc, nvda, basket } = await setup();
    const poolManager = await viem.deployContract("PoolManager", [owner.account.address]);
    const impl = await viem.deployContract("HyperdriveBasketHook", [poolManager.address, basket.address]);
    const hookAddress = getAddress(`0x${((0x5555n << 144n) | HOOK_FLAGS).toString(16).padStart(40, "0")}`);
    await provider.request({ method: "hardhat_setCode", params: [hookAddress, (await publicClient.getCode({ address: impl.address }))!] });
    const [c0, c1] = BigInt(usdc.address) < BigInt(nvda.address) ? [usdc.address, nvda.address] : [nvda.address, usdc.address];
    await assert.rejects(poolManager.write.initialize([{ currency0: c0, currency1: c1, fee: 0, tickSpacing: 1, hooks: hookAddress }, SQRT_PRICE_1_1]));
  });
});
