# Payment lifecycle

1. Trusted obligation loaded server-side (invoice/bill). **USD / USDC ledger amounts** map to stablecoin `EXACT_OUTPUT` (default native NEAR USDC) so payers fund the **dollar total**; origin NEAR is priced by 1Click (`amountInUsd`).
2. `POST /v0/quote` (dry preview or executable)
3. Verify quote signature (PHP/Sodium)
4. Store settlement + deposit address/memo
5. Payer approves deposit in wallet (NEAR: `wrap.near` `ft_transfer` to quote `depositAddress`; EVM: USDC transfer assist on Base route)
6. `POST /v0/deposit/submit` via MATCHFLOW `confirm-deposit` (includes `nearSenderAccount` on NEAR when available)
7. Poll `GET /v0/status` with depositAddress (+ memo)
8. Verify status signature
9. On signed `SUCCESS`, validate destination details and reconcile once
10. Unknown provider statuses → `UNKNOWN_REVIEW` (never paid)

Statuses: PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, INCOMPLETE_DEPOSIT, PROCESSING, SUCCESS, REFUNDED, FAILED.
