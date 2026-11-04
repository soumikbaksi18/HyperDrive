import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { monad } from "viem/chains";

export const monadChain = monad;

export const wagmiConfig = createConfig({
  chains: [monad],
  multiInjectedProviderDiscovery: false,
  connectors: [
    injected({
      target: "metaMask",
      shimDisconnect: false,
    }),
  ],
  transports: {
    [monad.id]: http(monad.rpcUrls.default.http[0]),
  },
  ssr: true,
});
