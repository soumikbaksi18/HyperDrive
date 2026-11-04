import { network } from "hardhat";

async function main() {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();

  const counter = await viem.deployContract("Counter");
  console.log("Counter deployed by:", deployer.account.address);
  console.log("Counter address:", counter.address);
  console.log("Chain id:", await publicClient.getChainId());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
