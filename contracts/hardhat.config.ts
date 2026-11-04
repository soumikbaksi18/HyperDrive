import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    compilers: [
      {
        version: "0.8.31",
        settings: {
          evmVersion: "osaka",
          viaIR: true,
          optimizer: { enabled: true, runs: 200 },
        },
      },
      {
        // Uniswap v4 PoolManager is pinned to 0.8.26 (used by local tests only).
        version: "0.8.26",
        settings: {
          evmVersion: "cancun",
          viaIR: true,
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
    npmFilesToBuild: [
      "@uniswap/v4-core/src/PoolManager.sol",
    ],
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
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
