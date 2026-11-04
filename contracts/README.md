# Contracts (Monad / EVM)

Solidity smart contracts compiled for **Monad** (`evmVersion: osaka`, Solidity `0.8.31`) using [Hardhat 3](https://hardhat.org/).

## Commands

```bash
npm run compile
npm test
npm run deploy:local
npm run deploy:testnet   # requires PRIVATE_KEY
```

## Networks

| Network        | Chain ID | Default RPC                    |
|----------------|----------|--------------------------------|
| Monad Testnet  | 10143    | https://testnet-rpc.monad.xyz  |
| Monad Mainnet  | 143      | https://rpc.monad.xyz          |

Copy `.env.example` to `.env` and set `PRIVATE_KEY` for live deployments.

See [Monad Hardhat docs](https://docs.monad.xyz/tooling-and-infra/toolkits/hardhat).
