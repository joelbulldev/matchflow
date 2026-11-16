# Live NEAR Intents smoke (human)

Do **not** invent fake SUCCESS in CI or docs screenshots.

## Dry quote (priority gate)

```bash
# PowerShell
$env:MATCHFLOW_NEAR_INTENTS_API_KEY="…"
php scripts/near-dry-quote-smoke.php
```

Without credentials the script documents this how-to and exits 0.

## Executable mainnet path (human)

1. Configure JWT/API key in Settings → MATCHFLOW or env.
2. Confirm quote + status signature verification fixtures pass (`composer test` / PHPUnit).
3. Fund a Base wallet with a small USDC amount.
4. Run AP hero (or AR checkout) through deposit → poll until provider `SUCCESS`.
5. Record explorer links for origin and destination txs.
6. Only then mark `live-near-smoke` / `live-hero-demo-payment` complete.

## Related

- [DEMO-SCRIPT.md](DEMO-SCRIPT.md)
- [SUBMISSION.md](SUBMISSION.md)
- [PAYMENT-LIFECYCLE.md](PAYMENT-LIFECYCLE.md)
