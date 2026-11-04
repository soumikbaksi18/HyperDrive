import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.31",
    settings: {
      evmVersion: "osaka",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    monadTestnet: {
      type: "http",
      url: process.env.MONAD_TESTNET_RPC_URL ?? "https://testnet-rpc.monad.xyz",
      accounts: [configVariable("PRIVATE_KEY")],
      chainId: 10143,
    },
    monadMainnet: {
      type: "http",
      url: process.env.MONAD_MAINNET_RPC_URL ?? "https://rpc.monad.xyz",
      accounts: [configVariable("PRIVATE_KEY")],
      chainId: 143,
    },
  },
});
