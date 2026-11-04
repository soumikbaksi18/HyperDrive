import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";
import { getAddress, parseUnits, type Address } from "viem";

/**
 * Local dev only (run against `npx hardhat node`). Builds a sandbox that looks like Monad to the app:
 *   - Mock USDC (6 decimals)
 *   - Mock 18-decimal tokens injected at the REAL catalog addresses of a few xStocks,
 *     so the backend/frontend catalog works unchanged
 *   - HyperdriveDesk with hardhat account #1 as quote signer, funded with inventory
 *   - USDC minted to hardhat account #0 (or LOCAL_TRADER) so you can trade from MetaMask
 *
 * Usage: npx hardhat run scripts/local-setup.ts --network localhost
 */
const SYMBOLS = (process.env.LOCAL_SYMBOLS ?? "AAPLx,NVDAx,TSLAx,MSFTx,AMZNx,GOOGLx,METAx").split(",");
const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { viem, provider } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, signer] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();
  if (chainId !== 31337) throw new Error(`local-setup refuses to run on chain ${chainId}`);

  const trader = getAddress(process.env.LOCAL_TRADER ?? deployer.account.address);
  const catalog = JSON.parse(
    readFileSync(path.join(here, "../../frontend/data/nasdaq-monad-xstocks.json"), "utf8"),
  ) as { stocks: { symbol: string; address: string }[] };

  const usdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  const template = await viem.deployContract("MockERC20", ["xStock", "XSTOCK", 18]);
  const code = await publicClient.getCode({ address: template.address });

  const tokens: Address[] = [];
  for (const symbol of SYMBOLS) {
    const stock = catalog.stocks.find((s) => s.symbol === symbol);
    if (!stock) throw new Error(`${symbol} is not in the catalog`);
    const address = getAddress(stock.address);
    await provider.request({ method: "hardhat_setCode", params: [address, code] });
    tokens.push(address);
  }

  const desk = await viem.deployContract("HyperdriveDesk", [
    usdc.address,
    signer.account.address,
    deployer.account.address,
    10, // 0.10% fee so fee accounting is visible locally
    deployer.account.address,
  ]);
  const deployBlock = await publicClient.getBlockNumber();
  await desk.write.listTokens([tokens]);

  for (const token of tokens) {
    const mock = await viem.getContractAt("MockERC20", token);
    await mock.write.mint([desk.address, parseUnits("10000", 18)]);
  }
  await usdc.write.mint([desk.address, parseUnits("1000000", 6)]);
  await usdc.write.mint([trader, parseUnits("50000", 6)]);
  // Gas money for a MetaMask account that isn't a hardhat default.
  await provider.request({ method: "hardhat_setBalance", params: [trader, "0x56BC75E2D63100000"] });

  const record = {
    chainId,
    desk: desk.address,
    usdc: usdc.address,
    quoteSigner: signer.account.address,
    trader,
    deployBlock: deployBlock.toString(),
    tokens: Object.fromEntries(SYMBOLS.map((s, i) => [s, tokens[i]])),
  };
  mkdirSync(path.join(here, "../deployments"), { recursive: true });
  writeFileSync(path.join(here, "../deployments/31337.json"), JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
  console.log(`
backend/.env.local:
  MONAD_RPC_URL=http://127.0.0.1:8545
  CHAIN_ID=31337
  DESK_ADDRESS=${desk.address}
  DESK_DEPLOY_BLOCK=${deployBlock}
  QUOTE_SIGNER_PRIVATE_KEY=<hardhat account #1 private key, printed by \`npx hardhat node\`>
  INDEXER_BLOCK_RANGE=1000

frontend/.env.local:
  NEXT_PUBLIC_CHAIN_ID=31337
  NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
