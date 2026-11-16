# MATCHFLOW — full system overview (for analysis)

Use this document to explain the entire product to a reviewer, judge, or external analyst.

## One-liner

**MATCHFLOW** is a self-hosted **financial operations platform** (React workspace + PHP API) for multi-org **AR/AP finance** (invoices, bills, procurement, approvals), with **NEAR Intents 1Click** as the shared settlement rail: quote → wallet deposit → signed status → ledger reconciliation → public receipt. WordPress is the current production host adapter.

Production demo: `https://matchflow.deepwhale.fun` (EarnFi deployment).

## Problem

SMEs run invoices in spreadsheets, pay suppliers on disparate chains, and have no single audit trail from “customer owes $X” to “we proved $X settled on-chain.” MATCHFLOW ties **accounting obligation (USD)** to **Intents execution (any origin asset)** without custodial wallets on the server.

## Architecture

| Layer | Technology |
|--------|------------|
| Host | WordPress 6.4+, PHP 8.1 (BCMath, Sodium) |
| API | Custom REST `matchflow/v1`, public alias `/api/v1` |
| UI | React 18, Vite, TanStack Router/Query, shadcn-style components |
| Settlement | NEAR Intents 1Click (`quote`, `status`, `deposit/submit`) |
| Wallet (payer) | HOT Labs NEAR Connect; Wagmi for Base USDC assist |
| PDF | dompdf via Composer (`vendor/`) |
| DB | MySQL tables prefixed `mf_*` |

## Multi-organization model

- Each **organization** has reporting currency (USD), settlement destination (USDC on NEAR default), branded checkout (logo, accent, tagline).
- **Roles**: Owner, Administrator, Finance Manager, AP Officer, Approver, Accountant, Viewer — capability gates on REST.
- All business rows scoped by `organization_id`.

## Accounts receivable

- **Invoices**: draft → issue → `paid` / `partially_paid` / `overdue` / `void`.
- Line items, PDF export (A4), customer email notify.
- **Opaque pay link** `/pay/{token}` — no login for payer.
- **Checkout**: connect NEAR or EVM wallet, dry-quote preview (~NEAR for $USD total), one-click pay, status polling.
- **USD semantics**: invoice `currency=USD` maps to **USDC EXACT_OUTPUT** (6 decimals); payer funds in NEAR; 1Click prices `amountInUsd`.

## Accounts payable & procurement

- **Suppliers**, **bills** (ingest / manual), **purchase orders**, **goods receipts**.
- **Three-way match** (PO ↔ GRN ↔ bill): deterministic rules, discrepancy codes, exception workflow.
- **Approvals**: submit → dual-control approve/reject (policy engine).
- AP settlement uses same `SettlementService` as AR (`AP_SETTLEMENT`).

## Settlement engine (core differentiator)

1. **Trusted instruction** from invoice/bill (amount, recipient, destination asset).
2. **1Click quote** (verified Ed25519 signature unless sandbox override).
3. Persist **settlement** + deposit address.
4. Payer signs **on-chain deposit** (NEAR: native transfer to implicit 1Click address; Base: USDC ERC-20).
5. **confirm-deposit** → `POST /v0/deposit/submit`.
6. Poll **status**; verify status signature; on **SUCCESS** reconcile once (idempotent).
7. **Ledger** + **public receipt** token.

Statuses: `PENDING_DEPOSIT`, `KNOWN_DEPOSIT_TX`, `PROCESSING`, `SUCCESS`, `FAILED`, `REFUNDED`, etc.

## Security posture

- No private keys on server.
- Quote/status **fail-closed** without valid 1Click signature (production).
- Public tokens hashed at rest; rate-limited pay APIs.
- Settlement never marks paid without signed `SUCCESS`.

## Public surfaces

| Route | Purpose |
|--------|---------|
| `/pay/{token}` | Branded checkout |
| `/pay/{token}/status` | Live settlement + invoice state |
| `/receipt/{token}` | Success receipt + PDF download |
| `/supplier/{token}` | Supplier invoice upload (creates bill draft) |

## Integrations

- **1Click API** + optional X-API-Key.
- **NEAR RPC proxy** (no public RPC URL in frontend bootstrap).
- Optional **Finance AI** (allowlisted prompts, org-scoped).
- **Reports / CSV** with formula-injection hardening.

## What is intentionally not built (gaps vs “win” projects)

- No autonomous trading agents / portfolio AI (cf. IntenX, Nero).
- No chain-wide swap reliability observatory (cf. Intents Desk).
- No confidential intents / advanced intent types in UI.
- Finance AI is assistant-tier, not a named agent on NEAR AI Cloud.
- Mobile-native wallet apps (web checkout only).
- Full accounting GL / tax engine (operational finance, not ERP replacement).

## Hackathon angles to emphasize

1. **B2B finance + Intents** — rare vs DEX/agents; judges see payables + receivables + proof.
2. **USD invoice → cross-asset pay** — payer uses NEAR; merchant receives USDC; amount tied to fiat.
3. **Evidence chain** — PO → match → approve → quote → tx hash → receipt (demo script in `docs/demo/JUDGE-DEMO-SCRIPT.md`).
4. **WordPress distribution** — any agency can host; not a single-tenant SaaS only.

## Stats & reports (v0.1.37+)

- **Void / cancelled invoices** are not open obligations: void sets `amount_outstanding_decimal` to zero, migration clears legacy rows, and rollups use `FinanceAggregate` (status filters on AR/AP).
- **Outstanding KPIs** are point-in-time; **Collected / Paid** respect the workspace period tabs (7D, 1M, 3M, 6M, All) on overview and module analytics.
- **Reports hub** exposes per-report CSV export, collections date range + period, and aging excludes voided lines.

## Version & deploy

- Plugin version in `matchflow.php`; ship `dist/matchflow.zip`.
- Server: `composer install --no-dev` in plugin directory for dompdf.
- Purge cache after UI deploy; pay links need hard refresh.

## Key file map

| Area | Path |
|--------|------|
| Settlement | `includes/Settlements/SettlementService.php` |
| USD quoting | `includes/NearIntents/UsdSettlement.php` |
| Public checkout API | `includes/REST/Controllers/PublicCheckoutController.php` |
| Quote crypto | `includes/NearIntents/QuoteSignature.php` |
| Checkout UI | `resources/app/src/pages/public/InvoiceCheckoutPage.tsx` |
| Wallet pay | `resources/app/src/lib/near-intents-deposit.ts`, `checkout-pay-now.ts` |
| Receipt PDF | `includes/Ledger/SettlementReceiptPdf*.php` |
| Invoice PDF | `includes/Receivables/InvoicePdf*.php` |

## Live test checklist

See `docs/demo/LIVE-NEAR-SMOKE.md` and `docs/PAYMENT-LIFECYCLE.md`.