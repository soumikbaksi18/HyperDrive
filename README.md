# HyperDrive

Buy and sell Nasdaq xStocks on Monad (chain 143) with USDC, at a price signed by our backend and settled atomically against an on-chain inventory desk. The app also tracks positions and PnL per wallet.

```
contracts/   Hardhat 3 + viem. HyperdriveDesk.sol, deploy/sandbox scripts, tests
backend/     NestJS 11 + Mongoose + viem. Quote signer, Trade-log indexer, portfolio/PnL API
frontend/    Next.js 16 + wagmi 3 + Tailwind 4. Markets board, trade dialog, portfolio page
frontend/data/nasdaq-monad-xstocks.json   xStock catalog (symbol, address, 18 decimals), shared by all three
```

## Architecture

```
            ┌─────────── POST /api/quotes ───────────┐
 Browser ───┤                                         ▼
 (wagmi)    │                              backend (NestJS, :3001)
            │                               ├─ xStocks price API (live price)
            │                               ├─ signs EIP-712 Quote (QUOTE_SIGNER_PRIVATE_KEY)
            │                               └─ Mongo: quotes, trades, indexer_state, portfolio_snapshots
            │                                         ▲
            │  approve + buy()/sell()                 │ getLogs(Trade) poller + POST /api/trades/sync
            └──────────────► HyperdriveDesk (Monad) ──┘
                              USDC + xStock inventory
```

## USDC → xStock flow

1. The frontend calls `POST /api/quotes` with `{trader, symbol, side: "buy", amount: "<USDC>"}`.
2. The backend checks the catalog, the desk listing, trade limits (`QUOTE_MIN_USDC`/`QUOTE_MAX_USDC`), the trader's USDC balance and the desk's xStock inventory. It then fetches the live xStocks price and applies `QUOTE_SPREAD_BPS` against the trader. It signs `Quote{trader,token,side,amountIn,price,deadline,nonce}` (EIP-712 domain `HyperdriveDesk`/`1`, the desk chainId and address, deadline now + `QUOTE_TTL_SECONDS`, random 32-byte nonce), stores it in `quotes` with status `issued`, and returns it with the exact `expectedOut`.
3. The wallet approves USDC to the desk if needed, then calls `buy(quote, signature, minSharesOut = expectedOut)`.
4. The desk checks the signer, trader, deadline, listing and single-use nonce, takes the fee (`feeBps` of the USDC) for `feeRecipient`, pulls the USDC and sends `(amountIn - fee) * 1e18 / price` xStock from its own inventory, then emits `Trade`.
5. The frontend calls `POST /api/trades/sync {txHash}` so the trade is indexed immediately. The poller would pick it up anyway. Trades are upserted on `(chainId, txHash, logIndex)` and the quote is marked `filled`.

Sells work the same way in reverse: `amount` is xStock shares, the desk pays out `shares * price / 1e18` minus the fee in USDC, and it needs enough USDC inventory to cover the gross amount.

## Quickstart A: local sandbox (chain 31337)

Requires Node 24 and MongoDB on `localhost:27017`. Prices still come from the real xStocks API, so you need internet access.

```bash
# 1. chain (terminal 1)
cd contracts && npm install && npm run node

# 2. sandbox contracts (terminal 2): mock USDC, mock xStocks injected at the real catalog
#    addresses (AAPLx,NVDAx,TSLAx,MSFTx,AMZNx,GOOGLx,METAx; override with LOCAL_SYMBOLS),
#    desk with fee 10 bps and quote signer = account #1, inventory funded,
#    50,000 USDC to account #0 (or LOCAL_TRADER). Writes deployments/31337.json.
cd contracts && npm run local:setup
```

`backend/.env.local` (loaded before `backend/.env`). Copy the values the script prints:

```bash
MONAD_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
DESK_ADDRESS=<desk from deployments/31337.json>
DESK_DEPLOY_BLOCK=<deployBlock from deployments/31337.json>
QUOTE_SIGNER_PRIVATE_KEY=<hardhat account #1 key, printed by `npm run node`>
INDEXER_BLOCK_RANGE=1000
MONGODB_URI=mongodb://localhost:27017/hyperdrive-local   # recommended: keep sandbox data separate
```

```bash
cd backend && npm install && npm run start:dev      # http://localhost:3001/api/health
```

`frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

```bash
cd frontend && npm install && npm run dev            # http://localhost:3000
```

MetaMask: add a network with RPC `http://127.0.0.1:8545` and chain ID `31337`, then import hardhat account #0 using the private key that `npm run node` prints. You can also import the mock USDC address from `deployments/31337.json` as a token so the balance shows.

**After restarting `hardhat node`**, the chain is empty but the redeployed addresses are deterministic, so the old indexer cursor and trades would be reused. Re-run `npm run local:setup`, drop the sandbox database, and clear MetaMask activity (Settings → Advanced → Clear activity tab data) to reset nonces:

```bash
cd backend && node -e "const m=require('mongoose');m.connect('mongodb://localhost:27017/hyperdrive-local').then(()=>m.connection.dropDatabase()).then(()=>m.disconnect())"
```

## Quickstart B: Monad mainnet (chain 143)

1. **Generate a dedicated quote-signer key.** It must hold no funds and be used for nothing else.
   ```bash
   cd backend && node -e "import('viem/accounts').then(({generatePrivateKey:g,privateKeyToAccount:a})=>{const k=g();console.log(k,a(k).address)})"
   ```
2. **Deploy.** In `contracts/.env`: set `PRIVATE_KEY` (the deployer) and `QUOTE_SIGNER_ADDRESS` (the address from step 1). Optional settings: `USDC_ADDRESS` (default is native Monad USDC `0x754704Bc059F8C67012fEd69BC8A327a5aafb603`), `FEE_RECIPIENT`, `FEE_BPS` (0–100), `DESK_OWNER` (starts a 2-step transfer; the new owner must call `acceptOwnership()`), and `MONAD_MAINNET_RPC_URL`.
   ```bash
   cd contracts && npm run deploy:desk:mainnet     # lists the whole catalog in batches of 60
   ```
   The script writes `contracts/deployments/143.json` with `desk` and `deployBlock`.
3. **Fund the inventory.** Send plain ERC-20 transfers to the desk: xStocks for every symbol you want to sell to users, and USDC to pay out sells. Quotes fail with `409` when inventory is short.
4. **Backend env** (`backend/.env`, see `.env.example`): `CHAIN_ID=143`, `MONAD_RPC_URL`, `DESK_ADDRESS`, `DESK_DEPLOY_BLOCK`, `QUOTE_SIGNER_PRIVATE_KEY`, `MONGODB_URI`, `CORS_ORIGIN`, and optionally `QUOTE_SPREAD_BPS`. Check that `GET /api/health` reports a `quoteSigner` equal to the desk's on-chain `quoteSigner()`.
5. **Frontend env** (`frontend/.env.local`): `NEXT_PUBLIC_API_URL=<backend>/api`, and optionally `NEXT_PUBLIC_RPC_URL`. Leave `NEXT_PUBLIC_CHAIN_ID` unset or set it to `143`. The frontend reads the desk and USDC addresses from `GET /api/desk`. The deploy script mentions `NEXT_PUBLIC_DESK_ADDRESS`, but nothing reads it.

## API (prefix `/api`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Mongo state, chainId, desk, quote signer address, indexer status/lag |
| GET | `/desk` | `{configured, chainId, desk, usdc, feeBps}` |
| POST | `/quotes` | `{trader, symbol, side: "buy"\|"sell", amount}` → signed quote + `expectedOut`, fee, prices, `expiresAt` |
| GET | `/portfolio/:wallet` | Positions, cost basis, realized/unrealized PnL. `?onchain=1` adds wallet balances |
| GET | `/portfolio/:wallet/trades` | Trade history, `?limit=` 1–500 (default 100) |
| GET | `/portfolio/:wallet/history` | Value snapshots, `?days=` 1–365 (default 30) |
| POST | `/trades/sync` | `{txHash}`: index one desk tx now and snapshot the affected wallets |

Details are in [backend/README.md](backend/README.md).

## Mongo collections

| Collection | Contents |
|---|---|
| `trades` | One doc per desk `Trade` log. Unique on `(chainId, txHash, logIndex)`. Raw amounts are stored as base-unit strings, with float copies for display. Positions and PnL are derived from this collection |
| `quotes` | Every signed quote (nonce, price, market price, spread, expectedOut, signature, deadline), `issued` → `filled` + txHash |
| `indexer_state` | Cursor `{key: "trades:<chainId>:<desk>", lastBlock}` |
| `portfolio_snapshots` | `{wallet, at, marketValue, costBasis, realizedPnl, unrealizedPnl, netInvested}`, written every `SNAPSHOT_INTERVAL_MS` and after each sync |

## PnL method

The ledger is average cost, kept per token in exact bigint arithmetic (`backend/src/portfolio/pnl.ts`) and replayed in chain order:

- Buy: shares += received and cost += USDC paid. Fees count toward the cost basis.
- Sell: the sold slice costs `cost * sold / held`, and `realized += net proceeds - that slice`. Proceeds are already net of fees.
- Selling more than the desk ledger shows (tokens transferred in from outside) treats the excess as zero-basis, so it is all realized gain. Held shares are clamped at 0.
- Unrealized = shares × live xStocks price − remaining cost. If no live price is available, the last trade price is used.

## Risks and operational notes

- **The desk needs inventory.** Buys need xStock balance and sells need USDC balance. Nothing rebalances automatically. Watch balances and top them up or withdraw them (`withdraw`, owner only).
- **The quote signer key is hot.** It sits in the backend env. Anyone who has it can sign any price, and could drain the desk inventory. Keep it dedicated and unfunded. If it leaks, call `pause()` and `setQuoteSigner()` right away. The fee is capped at 1% on-chain, but the price is not bounded on-chain.
- **The xStocks price API is not an executable feed.** `api.xstocks.fi` price-data is indicative and can be stale, especially outside market hours. The desk carries the market risk between quote and hedge. `QUOTE_SPREAD_BPS` (default 0) adds a spread against the trader, and `QUOTE_TTL_SECONDS` (default 60) limits how long a quote stays valid. Set the spread above 0 in production.
- Every quote is bound to its trader (`msg.sender`), and each nonce can be used once. The trader's slippage floor is the exact `expectedOut`.

## Mainnet DEX mode (no desk required)

When the backend runs on Monad mainnet (`CHAIN_ID=143`) with `DESK_ADDRESS` empty, trades route through the
**KyberSwap aggregator** instead of HyperdriveDesk. Nothing is custodied, and no inventory is needed:

1. `POST /api/swap/quote` (same body as `/api/quotes`) checks your wallet balance, gets the best route,
   rejects it if the DEX price is more than `PRICE_BAND_PCT` worse than the xStocks price, and builds the router
   call with `SWAP_SLIPPAGE_BPS` (default 0.5%) slippage protection.
2. The browser approves the token to the router (exact amount) and sends the router call from your wallet.
3. `POST /api/trades/sync` reads the receipt's ERC-20 `Transfer` logs (USDC out + xStock in = buy, reverse = sell)
   and stores the fill in `trades`, so Portfolio and PnL work the same as with the desk.

Not every xStock has DEX liquidity (as of 2026-11-04 NVDAx routes, AAPLx does not); the dialog says so per stock.
`/api/desk` reports `"mode": "dex"` or `"mode": "desk"`.

Switching configs: `backend/.env.local` + `frontend/.env.local` hold mainnet; the local sandbox config is in
`.env.sandbox` in each folder. Copy it over `.env.local` and restart both servers to switch back.
