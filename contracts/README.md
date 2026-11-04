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

## HyperdriveDesk

`contracts/HyperdriveDesk.sol` is an inventory-backed desk that swaps USDC for Nasdaq xStocks (18-decimal ERC-20s) and back, at a price the backend signs off-chain. It inherits `Ownable2Step`, `Pausable`, `ReentrancyGuard` and `EIP712("HyperdriveDesk", "1")`.

**Quote** (EIP-712):
`Quote(address trader,address token,uint8 side,uint256 amountIn,uint256 price,uint256 deadline,bytes32 nonce)`

- `side`: 0 = Buy, 1 = Sell. `amountIn` is USDC (6 dec) for a buy and xStock units for a sell.
- `price`: USDC base units per **one whole token**. For example, $332.285 → `332285000`.
- Each quote must be submitted by `trader`, before `deadline`, for a listed token, with an unused nonce, and signed by `quoteSigner`. Nonces are single-use (`usedNonces`).

**Trading**

| Function | Effect |
|---|---|
| `buy(quote, sig, minSharesOut)` | `fee = amountIn * feeBps / 1e4`, `shares = (amountIn - fee) * 10^dec / price`. Pulls USDC, sends the fee to `feeRecipient` and the shares from inventory |
| `sell(quote, sig, minUsdcOut)` | Pulls shares, measuring what actually arrived. `gross = received * price / 10^dec`, `fee = gross * feeBps / 1e4`, and the trader receives `gross - fee`. The desk needs USDC ≥ `gross` |
| `hashQuote(quote)` | Returns the digest the signer signs, for off-chain cross-checks |

Both functions emit `Trade(trader, token, side, usdcAmount, shares, price, fee, nonce)`. `usdcAmount` is what the trader paid on a buy (fee included) or received on a sell (fee deducted). Reverts include `Slippage`, `InsufficientInventory`, `QuoteExpired`, `QuoteAlreadyUsed`, `BadSignature`, `NotQuoteTrader`, `NotListed` and `WrongSide`.

**Admin (owner)**: `listTokens` / `delistTokens` (decimals are cached at listing), `setQuoteSigner`, `setFee(bps, recipient)` (bps ≤ `MAX_FEE_BPS` = 100), `withdraw(token, to, amount)`, `pause` / `unpause`. To top up inventory, send plain ERC-20 transfers to the desk.

### Commands

```bash
npm test                      # includes test/HyperdriveDesk.ts
npm run export-abi            # compile + write backend/src/chain/desk-abi.ts and frontend/lib/desk-abi.ts
npm run node                  # local hardhat node (127.0.0.1:8545, chain 31337)
npm run local:setup           # sandbox on the local node (see below)
npm run deploy:desk:mainnet   # also deploy:desk:testnet / deploy:desk:local
```

**`scripts/deploy-desk.ts`** settings (via env or `.env`):

| Var | Required | Default / notes |
|---|---|---|
| `PRIVATE_KEY` | yes (live networks) | Deployer |
| `QUOTE_SIGNER_ADDRESS` | yes | Address of the backend's `QUOTE_SIGNER_PRIVATE_KEY` |
| `USDC_ADDRESS` | no | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` (Monad USDC) |
| `FEE_RECIPIENT` | no | Deployer |
| `FEE_BPS` | no | `0` |
| `DESK_OWNER` | no | Deployer. If set, starts a 2-step transfer, and the new owner must call `acceptOwnership()` |
| `LIST_TOKENS` | no | Comma-separated tokens to list. On chain 143 without this, the whole frontend catalog is listed in batches of 60 |
| `MONAD_MAINNET_RPC_URL` / `MONAD_TESTNET_RPC_URL` | no | RPC overrides |

The script writes `deployments/<chainId>.json` (`desk`, `usdc`, `quoteSigner`, `feeBps`, `deployBlock`, ...). Afterwards, fund the desk with xStocks and USDC, then set `DESK_ADDRESS` and `DESK_DEPLOY_BLOCK` in the backend env.

**`scripts/local-setup.ts`** runs on chain 31337 only. It deploys mock USDC (6 dec) and uses `hardhat_setCode` to inject 18-decimal mock tokens at the **real** catalog addresses of `LOCAL_SYMBOLS` (default `AAPLx,NVDAx,TSLAx,MSFTx,AMZNx,GOOGLx,METAx`), so the catalog works unchanged. It then deploys the desk with account #1 as quote signer and a 10 bps fee, and funds it with 10,000 of each token and 1,000,000 USDC. It mints 50,000 USDC and 100 ETH to account #0 (or `LOCAL_TRADER`), writes `deployments/31337.json`, and prints the backend and frontend `.env.local` values.
