import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Counter", async () => {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  it("starts at zero and increments", async () => {
    const counter = await viem.deployContract("Counter");

    assert.equal(await counter.read.count(), 0n);

    const hash = await counter.write.increment([], {
      account: walletClient.account,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    assert.equal(await counter.read.count(), 1n);
  });
});
