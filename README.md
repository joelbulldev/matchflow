# MATCHFLOW

**Intelligent financial operations for global businesses.**

Collect smarter. Pay correctly. Move money anywhere.

MATCHFLOW is a **self-hosted financial operations platform**: multi-organization receivables and payables, procurement and three-way match, approvals, reconciliation, and cross-chain settlement on a single evidence-to-settlement ledger. Organizations interact through a React application; the API and domain logic are PHP services backed by MySQL.

WordPress is the **supported runtime host** (authentication, cron, options, file storage) — not the product identity. The platform is the MATCHFLOW workspace, API (`/api/v1`), and settlement engine.

**Repository:** [github.com/joelbulldev/matchflow](https://github.com/joelbulldev/matchflow)

## Platform capabilities

- Multi-organization workspaces with role-based access (Owner through Viewer)
- Accounts receivable: invoices, branded payment links, public checkout, settlement receipts
- Accounts payable: supplier bills, three-way match (PO / goods receipt / invoice), exceptions and approvals
- Shared settlement rail: NEAR Intents 1Click (quote, deposit, signed status, ledger reconciliation)
- Finance AI (grounded, org-scoped), reports and CSV export, audit trail
- No custodial wallets on the server; settlement proof is on-chain status + signed 1Click payloads

## Monorepo layout

| Path | Role |
|------|------|
| `resources/app/` | React SPA (Vite, TanStack Router/Query) |
| `includes/` | Domain services, REST controllers, settlement engine |
| `matchflow.php` | Host bootstrap (activates platform on WordPress) |
| `assets/build/` | Compiled frontend (run `npm run build`) |
| `docs/` | Architecture, deployment, acceptance criteria |

```text
Browser SPA → /api/v1 → Matchflow REST → Domain → mf_* tables
                      ↘ NEAR Intents 1Click
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/MATCHFLOW_SYSTEM_OVERVIEW_FOR_ANALYSIS.md](docs/MATCHFLOW_SYSTEM_OVERVIEW_FOR_ANALYSIS.md).

## Requirements

- **Host:** WordPress 6.4+ (current shipping adapter)
- **PHP:** 8.1+ (BCMath, Sodium, Fileinfo)
- **Database:** MySQL/MariaDB (InnoDB)
- **Build:** Node 20+ for frontend (`npm install` / `npm run build`)

## Development

```bash
composer install
npm install
npm run dev          # Vite against local WP or MATCHFLOW_VITE_DEV_SERVER
npm run build        # → assets/build
npm run test         # Vitest
vendor/bin/phpunit   # PHP tests
```

### Local stack (Docker)

```bash
docker compose up -d
npm run build
# Activate the host package in WordPress, then open the site URL.
```

Copy secrets from [.env.example](.env.example) into `wp-config.php` or Settings → MATCHFLOW (NEAR Intents JWT/API key, signing key, optional AI).

### Production build (host package)

```bash
npm run build
npm run zip          # → dist/matchflow.zip for WordPress upload
```

## Configuration (settlement)

- `MATCHFLOW_NEAR_INTENTS_JWT` and/or `MATCHFLOW_NEAR_INTENTS_API_KEY`
- `MATCHFLOW_NEAR_INTENTS_SIGNING_KEY` for quote/status signature verification
- Optional local only: `MATCHFLOW_ALLOW_UNVERIFIED_QUOTES` (never in production)

Public API base: **`/api/v1`** (alias to `matchflow/v1` REST).

## Security

- Organization-scoped data and object-level authorization
- Private document storage outside public media URLs
- Settlement recorded only after verified `SUCCESS` status
- Business APIs do not use `admin-ajax`

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md)
- [SUBMISSION.md](docs/SUBMISSION.md)
- [deploy/hackathon-production-guide.md](docs/deploy/hackathon-production-guide.md)

## License

MIT — see [LICENSE](LICENSE).