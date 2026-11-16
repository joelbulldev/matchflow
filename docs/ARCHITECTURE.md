# Architecture

MATCHFLOW is a **financial operations platform** delivered as a monorepo:

- **Application UI** — React SPA (`resources/app/`), compiled to `assets/build/`
- **Platform API** — PHP under `includes/`, REST namespace `matchflow/v1`, public alias `/api/v1`
- **Persistence** — MySQL `mf_*` InnoDB tables via `$wpdb`
- **Host adapter** — `matchflow.php` boots the platform on WordPress (users, HTTP, cron, options)

The host layer is replaceable in principle; the product boundary is the workspace, API, and settlement engine.

```text
Browser SPA → /api/v1 → matchflow/v1 REST → Domain → $wpdb
                      ↘ NearIntents OneClickClient
Worker cron → SettlementService.refreshStatus
```

## Domain modules

- **Ledger & settlements** — quotes, deposits, status refresh, reconciliation, receipts
- **AR** — customers, invoices, payment links, public checkout
- **AP** — suppliers, bills, matching engine, approvals
- **Procurement** — purchase orders, goods receipts
- **Reporting** — aging-style balances, collections, exceptions, CSV export
- **Security** — capabilities, audit events, public tokens

## Frontend delivery

Built assets are published to `/assets/matchflow/` on the web root (see `includes/Frontend/AssetPublisher.php`) so nginx can serve `app.js` / chunks without exposing `wp-content` paths.