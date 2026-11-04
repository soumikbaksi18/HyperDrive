import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { network } from "hardhat";
import { getAddress, isAddress, parseUnits } from "viem";

/**
 * Local sandbox faucet: mints mock USDC + gas to your MetaMask address.
 * Usage: FUND_ADDRESS=0xYourAddress [FUND_USDC=10000] npm run local:fund
 */
const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const target = process.env.FUND_ADDRESS;
  if (!target || !isAddress(target)) throw new Error("Set FUND_ADDRESS=0xYourMetaMaskAddress");
  const to = getAddress(target);

  const { viem, provider } = await network.connect();
  const chainId = await (await viem.getPublicClient()).getChainId();
  if (chainId !== 31337) throw new Error(`local-fund refuses to run on chain ${chainId}`);

  const deployment = JSON.parse(
    readFileSync(path.join(here, "../deployments/31337.json"), "utf8"),
  ) as { usdc: `0x${string}` };
  const usdc = await viem.getContractAt("MockERC20", deployment.usdc);
  const amount = process.env.FUND_USDC ?? "10000";
  await usdc.write.mint([to, parseUnits(amount, 6)]);
  await provider.request({ method: "hardhat_setBalance", params: [to, "0x56BC75E2D63100000"] }); // 100 MON for gas

  console.log(`Sent ${amount} USDC + 100 MON (gas) to ${to}`);
  console.log(`USDC token for MetaMask "Import tokens": ${deployment.usdc}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
