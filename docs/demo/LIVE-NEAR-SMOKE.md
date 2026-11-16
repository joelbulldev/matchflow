# Live NEAR smoke (mainnet)

Use this before judging / recording video. **Mainnet only** — use a small invoice amount.

## Preconditions

- Plugin **0.1.30+** deployed; 1Click X-API-Key set; quote verification public key **empty** (default manager key).
- `composer install --no-dev` in `wp-content/plugins/matchflow` (PDF + autoload).
- Cron or worker: settlement monitor running (WP cron or `wp matchflow settlements-monitor`).

## Smoke checklist

1. **Dry quote** — `POST /api/v1/public/invoices/{token}/quotes` with `"dry": true` → `signatureValid: true`.
2. **Executable quote** — same with `"dry": false` → settlement `PENDING_DEPOSIT`, `deposit_address` set, `quote_signature_valid: 1`.
3. **Wallet pay** — On checkout: Connect NEAR → Get deposit address → **Pay with wNEAR** or **Pay with native NEAR** → wallet approval → `confirm-deposit` returns 200, `source_tx_hash` stored.
4. **Status** — `GET /api/v1/public/payments/{token}/status` polls 1Click → `KNOWN_DEPOSIT_TX` / `PROCESSING` → **`SUCCESS`**.
5. **Reconcile** — Invoice `status: paid`, outstanding `0`, receipt available at `/receipt/{token}`.

## Failure signals

| Symptom | Fix |
|--------|-----|
| `matchflow_invalid_quote_signature` | Deploy 0.1.29+ QuoteSignature; clear wrong key in admin |
| Wallet pay never appears | Origin asset must be `nep141:wrap.near`; connect wallet on step 1 |
| Stuck `PENDING_DEPOSIT` after tx | Confirm on-chain **deposit** matches quote `minAmountIn` (not just tx success). For `nep141:wrap.near` use **24**-decimal atomic amounts (0.1.33+ fixes server-side). Refresh status; verify 1Click API key |
| `pdfFallback: true` | Run `composer install --no-dev` on server |

## Reference

- [1Click making a request](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request)
- `docs/PAYMENT-LIFECYCLE.md`