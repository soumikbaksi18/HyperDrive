import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";
import { getAddress, type Address } from "viem";

/**
 * Deploys HyperdriveDesk and lists every Nasdaq xStock from the frontend catalog.
 *
 * Env:
 *   QUOTE_SIGNER_ADDRESS  required: address of the backend's QUOTE_SIGNER_PRIVATE_KEY
 *   USDC_ADDRESS          defaults to native USDC on Monad mainnet
 *   FEE_RECIPIENT         defaults to the deployer
 *   FEE_BPS               defaults to 0 (max 100)
 *   DESK_OWNER            defaults to the deployer
 */
const MONAD_USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const LIST_BATCH = 60;

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  const signer = process.env.QUOTE_SIGNER_ADDRESS;
  if (!signer) throw new Error("Set QUOTE_SIGNER_ADDRESS (the backend quote signer's address).");

  const usdc = getAddress(process.env.USDC_ADDRESS ?? MONAD_USDC);
  const feeRecipient = getAddress(process.env.FEE_RECIPIENT ?? deployer.account.address);
  const owner = getAddress(process.env.DESK_OWNER ?? deployer.account.address);
  const feeBps = Number(process.env.FEE_BPS ?? 0);

  const desk = await viem.deployContract("HyperdriveDesk", [
    usdc,
    getAddress(signer),
    feeRecipient,
    feeBps,
    deployer.account.address, // owner during setup; transferred below if DESK_OWNER differs
  ]);
  const deployBlock = await publicClient.getBlockNumber();
  console.log(`HyperdriveDesk ${desk.address} (chain ${chainId}, block ${deployBlock})`);

  // Only list real catalog tokens on Monad mainnet; other chains list via LIST_TOKENS.
  let tokens: Address[] = [];
  if (process.env.LIST_TOKENS) {
    tokens = process.env.LIST_TOKENS.split(",").map((t) => getAddress(t.trim()));
  } else if (chainId === 143) {
    const catalog = JSON.parse(
      readFileSync(path.join(here, "../../frontend/data/nasdaq-monad-xstocks.json"), "utf8"),
    ) as { stocks: { address: string }[] };
    tokens = catalog.stocks.map((s) => getAddress(s.address));
  }

  for (let i = 0; i < tokens.length; i += LIST_BATCH) {
    const batch = tokens.slice(i, i + LIST_BATCH);
    const hash = await desk.write.listTokens([batch]);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Listed ${Math.min(i + LIST_BATCH, tokens.length)}/${tokens.length}`);
  }

  if (owner !== getAddress(deployer.account.address)) {
    await desk.write.transferOwnership([owner]);
    console.log(`Ownership transfer started to ${owner}; it must call acceptOwnership().`);
  }

  const outDir = path.join(here, "../deployments");
  mkdirSync(outDir, { recursive: true });
  const record = {
    chainId,
    desk: desk.address,
    usdc,
    quoteSigner: getAddress(signer),
    feeRecipient,
    feeBps,
    deployBlock: deployBlock.toString(),
    listed: tokens.length,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(path.join(outDir, `${chainId}.json`), JSON.stringify(record, null, 2));
  console.log(JSON.stringify(record, null, 2));
  console.log("\nNext: fund the desk with xStock inventory and USDC (plain ERC-20 transfers),");
  console.log("then set DESK_ADDRESS / DESK_DEPLOY_BLOCK in backend/.env and NEXT_PUBLIC_DESK_ADDRESS in frontend/.env.local.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
