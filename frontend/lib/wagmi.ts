import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { monad } from "viem/chains";

/**
 * NEXT_PUBLIC_CHAIN_ID=31337 points the app at the local Hardhat sandbox
 * (contracts/scripts/local-setup.ts). Anything else is Monad mainnet.
 */
const localSandbox = defineChain({
  id: 31337,
  name: "Monad (local sandbox)",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545"] },
  },
});

export const monadChain =
  process.env.NEXT_PUBLIC_CHAIN_ID === "31337" ? localSandbox : monad;

export const explorerTx = (hash: string) =>
  monadChain.id === monad.id ? `https://monadscan.com/tx/${hash}` : null;

export const wagmiConfig = createConfig({
  chains: [monadChain],
  multiInjectedProviderDiscovery: false,
  connectors: [
    injected({
      target: "metaMask",
      shimDisconnect: false,
    }),
  ],
  transports: {
    [monad.id]: http(process.env.NEXT_PUBLIC_RPC_URL ?? monad.rpcUrls.default.http[0]),
    [localSandbox.id]: http(localSandbox.rpcUrls.default.http[0]),
  },
  ssr: true,
});
