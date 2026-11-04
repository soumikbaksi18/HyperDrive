import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";
import { concat, encodeDeployData, getAddress, getContractAddress, keccak256, pad, parseUnits, toHex, type Address, type Hex } from "viem";

/**
 * Deploys the NVDAx + TSLAx basket on Monad mainnet and wires it into Uniswap v4:
 *   1. HyperdriveBasket (hNVTS), components NVDAx/TSLAx, swaps through the KyberSwap router.
 *   2. HyperdriveBasketHook at a CREATE2 address whose low 14 bits are the hook flags.
 *   3. BasketRouter (one-tx USDC -> basket swaps through the PoolManager).
 *   4. Initializes the USDC/hNVTS v4 pool (fee 0, tick spacing 1; the hook supplies all liquidity).
 *
 * Env: PRIVATE_KEY (deployer, needs MON for gas). Optional: BASKET_WEIGHTS (default "50,50").
 */
const POOL_MANAGER: Address = "0x188d586ddcf52439676ca21a244753fa19f9ea8e";
const KYBER_ROUTER: Address = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5";
const CREATE2_DEPLOYER: Address = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const USDC: Address = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const COMPONENTS = ["NVDAx", "TSLAx"] as const;
const HOOK_FLAGS = (1n << 13n) | (1n << 11n) | (1n << 7n) | (1n << 3n);
const FLAG_MASK = (1n << 14n) - 1n;

const here = path.dirname(fileURLToPath(import.meta.url));

async function xstocksPrice(symbol: string) {
  const res = await fetch(`https://api.xstocks.fi/api/v2/public/assets/${symbol}/price-data`, {
    headers: { Accept: "application/json", "User-Agent": "Hyperdrive/0.1" },
  });
  const body = (await res.json()) as { quote?: number };
  if (!body.quote) throw new Error(`no price for ${symbol}`);
  return body.quote;
}

function mineSalt(initCode: Hex): { salt: Hex; address: Address } {
  const codeHash = keccak256(initCode);
  for (let i = 0n; i < 5_000_000n; i++) {
    const salt = pad(toHex(i), { size: 32 });
    const address = getContractAddress({ from: CREATE2_DEPLOYER, opcode: "CREATE2", salt, bytecodeHash: codeHash });
    if ((BigInt(address) & FLAG_MASK) === HOOK_FLAGS) return { salt, address };
  }
  throw new Error("no salt found");
}

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();
  if (chainId !== 143) throw new Error(`deploy-basket targets Monad mainnet (143), got ${chainId}`);

  const catalog = JSON.parse(readFileSync(path.join(here, "../../frontend/data/monad-xstocks.json"), "utf8")) as {
    stocks: { symbol: string; address: string }[];
  };
  const tokens = COMPONENTS.map((sym) => getAddress(catalog.stocks.find((s) => s.symbol === sym)!.address));
  const weights = (process.env.BASKET_WEIGHTS ?? "50,50").split(",").map(Number);

  // Size one share to ~$1 at launch: component units per 1e18 shares = weight% * $1 / price.
  const prices = await Promise.all(COMPONENTS.map(xstocksPrice));
  const units = prices.map((p, i) => parseUnits(((weights[i] / 100) / p).toFixed(18), 18));
  console.log("prices", Object.fromEntries(COMPONENTS.map((s, i) => [s, prices[i]])), "units/share", units.map(String));

  const basket = await viem.deployContract("HyperdriveBasket", [
    "Hyperdrive NVDA-TSLA Basket",
    "hNVTS",
    USDC,
    KYBER_ROUTER,
    tokens,
    units,
    deployer.account.address,
  ]);
  console.log("HyperdriveBasket", basket.address);

  const artifact = await import("../artifacts/contracts/basket/HyperdriveBasketHook.sol/HyperdriveBasketHook.json", { with: { type: "json" } });
  const initCode = encodeDeployData({
    abi: artifact.default.abi,
    bytecode: artifact.default.bytecode as Hex,
    args: [POOL_MANAGER, basket.address],
  });
  const { salt, address: hookAddress } = mineSalt(initCode);
  console.log("mined hook address", hookAddress, "salt", salt);
  const tx = await deployer.sendTransaction({ to: CREATE2_DEPLOYER, data: concat([salt, initCode]) });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  if (!(await publicClient.getCode({ address: hookAddress }))) throw new Error("hook deployment failed");
  console.log("HyperdriveBasketHook", hookAddress);

  const router = await viem.deployContract("BasketRouter", [POOL_MANAGER]);
  console.log("BasketRouter", router.address);

  const usdcIs0 = BigInt(USDC) < BigInt(basket.address);
  const key = {
    currency0: usdcIs0 ? USDC : basket.address,
    currency1: usdcIs0 ? basket.address : USDC,
    fee: 0,
    tickSpacing: 1,
    hooks: hookAddress,
  } as const;
  const pm = await viem.getContractAt("PoolManager", POOL_MANAGER);
  const initHash = await pm.write.initialize([key, 2n ** 96n]);
  await publicClient.waitForTransactionReceipt({ hash: initHash });
  console.log("v4 pool initialized");

  const record = {
    chainId,
    symbol: "hNVTS",
    basket: basket.address,
    hook: hookAddress,
    router: router.address,
    poolManager: POOL_MANAGER,
    swapRouter: KYBER_ROUTER,
    usdc: USDC,
    components: COMPONENTS.map((s, i) => ({ symbol: s, address: tokens[i], weight: weights[i], unitPerShare: units[i].toString() })),
    poolKey: key,
    deployedAt: new Date().toISOString(),
  };
  mkdirSync(path.join(here, "../deployments"), { recursive: true });
  writeFileSync(path.join(here, "../deployments/basket-143.json"), JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
