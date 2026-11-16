---
title: MATCHFLOW
subtitle: Product Requirements Document & UI/UX Implementation Specification
author: Product & Engineering Specification
date: 11 November 2026
---

**Version:** 1.0  
**Status:** Hackathon MVP + production-oriented foundation  
**Product:** MATCHFLOW  
**Tagline:** Collect smarter. Pay correctly. Move money anywhere.  
**Architecture:** WordPress plugin backend (PHP) + React SPA (Vite, TypeScript, Tailwind CSS)  
**Primary integration:** NEAR Intents 1Click API

\newpage

## Contents

1. Executive summary  
2. Product vision, goals and success measures  
3. Personas, roles and permissions  
4. Information architecture and route map  
5. WordPress plugin architecture and frontend takeover  
6. React SPA architecture and technology stack  
7. UI/UX design system and screen-by-screen mapping  
8. Domain model and database schema  
9. WordPress REST API and authorization  
10. NEAR Intents settlement integration  
11. AI and document intelligence  
12. Security, privacy and compliance posture  
13. Non-functional requirements and testing  
14. Implementation phases and Cursor execution plan  
15. Repository quality and judge readiness  
16. Architecture decisions and external references  
Appendices: required UI states, product language and demo checklist

\newpage

## Document purpose

This document is the product and engineering source of truth for MATCHFLOW. It defines the product proposition, personas, functional requirements, information architecture, route map, UI system, WordPress plugin architecture, React application architecture, domain data model, REST API contract, payment lifecycle, security expectations, acceptance criteria and Cursor implementation sequence.

The implementation must follow this document unless a deliberate change is recorded in an architecture decision record (ADR). Do not silently replace the defined PHP/WordPress backend with a Node server, or replace the React SPA with another frontend framework.

## 1. Executive summary

MATCHFLOW is an AI-powered financial operations platform for businesses that need to collect money from customers, verify supplier obligations, pay vendors and reconcile transactions across supported blockchain networks.

It unifies two connected financial workflows:

- **Receivables (AR):** create customer invoices, issue payment links, accept supported assets through NEAR Intents, confirm settlement and reconcile collections.
- **Payables (AP):** receive supplier bills, extract document data, match bills against purchase orders and goods-received records, enforce deterministic approval policies, pay approved suppliers through NEAR Intents and reconcile settlement.

Both workflows use one shared **Settlement Engine** and one **Evidence-to-Settlement** audit trail.

The core product insight is that a business should not treat documents, approvals, blockchain transfers and accounting records as disconnected objects. MATCHFLOW connects the original obligation to the evidence supporting it, the decision authorizing payment, the settlement route and the final transaction evidence.

### Product positioning

**MATCHFLOW — Intelligent Financial Operations for Global Businesses.**

**Collect smarter. Pay correctly. Move money anywhere.**

MATCHFLOW is not positioned as a generic accounting system, wallet, invoice generator or payment gateway. It is a financial operations control plane that connects commercial obligations to cross-chain money movement and reconciliation.

### Initial target customers

1. Importers and exporters.
2. Wholesale distributors.
3. Manufacturing and equipment businesses.
4. Digital agencies and consulting firms.
5. SMEs paying international contractors.
6. Businesses issuing and receiving stablecoin-denominated invoices.

The initial ideal customer has recurring invoices, several counterparties, international payment needs and manual document/reconciliation work.

## 2. Product vision, problem and value proposition

### 2.1 Problem

Businesses commonly manage receivables, payables, supplier evidence, customer payment collection and reconciliation in disconnected tools. This creates:

- Manual invoice preparation and payment follow-up.
- Difficulty accepting payment from counterparties using different chains or tokens.
- Supplier bills that do not match purchase orders or delivered quantities.
- Duplicate, inconsistent or suspicious invoices.
- Payment approvals that are hard to audit.
- Fragmented transaction references and payment states.
- Manual reconciliation after funds have moved.

### 2.2 Vision

Create one business workspace in which every incoming and outgoing payment is tied to a verified commercial obligation, governed by business rules and traceable through final settlement.

### 2.3 Value proposition

| Audience | Value |
|---|---|
| Business owner / CFO | Understand what is owed, what is due, what has settled and what needs attention. |
| Finance operator | Process invoices and supplier bills with less manual data entry and reconciliation. |
| Approver | Review evidence, policy results and exact payment details before authorizing funds. |
| Customer | Pay an invoice using a supported source asset/network without needing a MATCHFLOW account. |
| Supplier | Submit an invoice, receive payment to a preferred supported asset/address and obtain a traceable receipt. |

### 2.4 Product differentiator: Evidence-to-Settlement Engine

For every payment, MATCHFLOW should preserve a chain of evidence:

1. **Obligation:** customer invoice, supplier bill, purchase order or other commercial basis.
2. **Document evidence:** original documents, extracted fields, source locations and document hashes.
3. **Financial evaluation:** matching results, discrepancy calculations, policy version and approval decision.
4. **Settlement instruction:** source/destination asset, recipient, refund address, quote, quote expiry and payment purpose.
5. **Settlement evidence:** deposit transaction, 1Click status history, destination transaction, actual output amount and refund data where relevant.
6. **Reconciliation:** invoice/bill balance, ledger entries, receipt and final audit event.

Sensitive documents remain private offchain. Public blockchains must not contain raw invoices, customer information, supplier bank/wallet details or confidential business documents.

## 3. Product goals, non-goals and success measures

### 3.1 Hackathon MVP goals

- Deliver a functioning WordPress plugin that owns the public frontend and serves a React single-page application on all supported public routes.
- Provide a polished business workspace with Receivables and Payables.
- Create customer invoices and public payment links.
- Accept a supported cross-chain payment route through NEAR Intents 1Click.
- Upload supplier bills and extract structured data.
- Create purchase orders and goods-received records.
- Perform deterministic three-way matching and duplicate detection.
- Enforce business-defined approval rules.
- Use one settlement service for AR collections and AP supplier payments.
- Track actual 1Click status changes and only finalize obligations after validated `SUCCESS` settlement.
- Maintain an audit trail, operational ledger and receipts.
- Make the repository reproducible for hackathon judges.

### 3.2 Longer-term product goals

- Multi-user organization workspaces and advanced segregation of duties.
- Multi-chain wallet/payment method coverage based on current 1Click support.
- Scheduled invoice reminders and recurring invoices.
- Accounting platform integrations.
- Advanced cash-flow analytics and forecasting.
- Supplier/customer self-service portals.
- More sophisticated policy workflows and multi-step approvals.
- Private AI inference and stronger document privacy controls.

### 3.3 Explicit non-goals for the hackathon MVP

- Full ERP or inventory management.
- General ledger accounting certification or GAAP/IFRS compliance claims.
- Payroll, tax filing or country-specific VAT engines.
- Custodial wallet or MATCHFLOW-controlled private keys.
- Unrestricted AI-controlled payments.
- Automated supplier negotiation.
- Dozens of chain integrations without verified end-to-end routes.
- QuickBooks/Xero integrations.
- Onchain publication of invoice contents.
- Treating quote previews or simulated payments as real settlements.

### 3.4 Success measures

**Product measures**

- A business can create and share an invoice in one uninterrupted flow.
- A customer can open a public payment page without creating a MATCHFLOW account.
- A supported asset route can be quoted, signed and settled end-to-end.
- A supplier invoice can be extracted, matched and placed into an approval state.
- A mismatch is explained with exact quantities and amounts.
- A payment record links back to the obligation and evidence that created it.

**Engineering measures**

- All app routes load directly and survive refresh/back/forward navigation.
- No authenticated REST endpoint is missing a permission check.
- No payment can be marked settled from a client-side event alone.
- Payment state updates are idempotent and append-only.
- Money calculations use integer atomic units or fixed decimal arithmetic, never binary floats.
- The plugin can be installed and configured using the README on a clean WordPress site.

## 4. Personas, roles and permissions

### 4.1 Personas

**Business owner / Workspace owner**  
Creates the organization, configures wallets and policies, invites members, reviews financial health and has ultimate approval authority.

**Finance manager**  
Manages receivables/payables, counterparties, purchase orders, reconciliation and reports. May approve within assigned limits.

**Accountant / Finance operator**  
Creates invoices, uploads supplier bills, records deliveries, reviews matching and prepares payment instructions.

**Approver**  
Reviews a bill/payment package, sees the evidence and policy result, then approves or rejects. Cannot edit the underlying invoice after submission unless reassigned.

**Viewer / Auditor**  
Read-only access to authorized financial records, receipts and audit history.

**Customer (external)**  
Opens a secure invoice payment link, reviews amount and payment terms, chooses an available route, connects a wallet and pays. No workspace account required.

**Supplier (external)**  
May receive a secure bill-submission link or payment status link. No workspace account required for the MVP.

### 4.2 Role matrix

| Capability | Owner | Finance manager | Accountant |
|---|---:|---:|---:|
| View dashboard | Yes | Yes | Yes |
| Manage organization | Yes | Limited | No |
| Manage members/roles | Yes | Limited | No |
| Create/edit AR invoices | Yes | Yes | Yes |
| Void AR invoice | Yes | Yes | Policy-limited |
| Create/edit AP bills | Yes | Yes | Yes |
| Create purchase orders | Yes | Yes | Yes |
| Record goods received | Yes | Yes | Yes |
| Configure approval policies | Yes | Yes | No |
| Approve bill/payment | Yes | Within limit | No by default |
| Initiate settlement | Yes | Yes | Prepare only |
| View reports | Yes | Yes | Limited |
| View audit history | Yes | Yes | Limited |

| Capability | Approver | Viewer |
|---|---:|---:|
| View dashboard | Assigned scope | Yes |
| Manage organization | No | No |
| Manage members/roles | No | No |
| Create/edit AR invoices | No | No |
| Void AR invoice | No | No |
| Create/edit AP bills | No | No |
| Create purchase orders | No | No |
| Record goods received | No | No |
| Configure approval policies | No | No |
| Approve bill/payment | Assigned scope | No |
| Initiate settlement | Approve only | No |
| View reports | Assigned scope | Yes |
| View audit history | Assigned scope | Yes |

**Implementation rule:** permissions must be evaluated from organization membership and capability records in PHP domain services. Do not authorize based only on a WordPress role name or a React route guard.

### 4.3 WordPress identity model

Use WordPress users (`wp_users`) for authentication. MATCHFLOW adds organization membership and product permissions in its own tables. A WordPress user may belong to more than one MATCHFLOW organization. A current organization is selected in the React workspace and validated on every API request.

External customers/suppliers may use high-entropy, scoped, expiring public tokens rather than WordPress accounts.

## 5. Information architecture and route map

### 5.1 Routing principles

- The WordPress plugin owns the public frontend rendering layer.
- In full takeover mode, TanStack Router uses the site root as its base path (`/`), because authenticated workspace routes and public payment routes share one origin (`/app/...`, `/pay/...`, `/receipt/...`). Do not set the router base path to `/app` in this mode.
- In scoped mode, keep the router root-based if public checkout/receipt routes remain at `/pay` and `/receipt`; the PHP layer decides which routes are intercepted. A `/app` router base path is appropriate only if every route, including public checkout, is deliberately nested below `/app`.
- PHP returns the same SPA shell for recognized MATCHFLOW public paths and, in full takeover mode, all ordinary public frontend requests.
- TanStack Router resolves the actual screen in React.
- WordPress REST routes remain under `/wp-json/matchflow/v1/...` and are never handled by the SPA router.
- WordPress administration (`/wp-admin`), login, cron, REST, AJAX, XML-RPC and static assets remain excluded from frontend takeover.
- All public URLs must support direct navigation, reload, browser history and deep links.

### 5.2 Route groups

| Route | Access | Shell | Purpose |
|---|---|---|---|
| `/` | Public | Marketing/public | Product landing or configured app entry |
| `/login` | Public | Auth | WordPress-backed login |
| `/register` | Public/configurable | Auth | Optional account registration/onboarding |
| `/forgot-password` | Public | Auth | Password reset request |
| `/reset-password` | Public | Auth | Password reset completion |
| `/onboarding/business` | Authenticated | Onboarding | Create/select business workspace |
| `/app` | Authenticated | Workspace | Redirect to `/app/overview` |
| `/app/overview` | Workspace | Workspace | Financial overview |
| `/app/receivables/invoices` | AR read | Workspace | Invoice list |
| `/app/receivables/invoices/new` | AR create | Workspace | Invoice creation wizard/editor |
| `/app/receivables/invoices/$invoiceId` | AR read | Workspace | Invoice detail |
| `/app/receivables/invoices/$invoiceId/edit` | AR edit | Workspace | Edit eligible draft invoice |
| `/app/receivables/customers` | AR read | Workspace | Customer directory |
| `/app/receivables/customers/new` | AR create | Workspace | New customer |
| `/app/receivables/payment-links` | AR read | Workspace | Payment link library |
| `/app/receivables/reminders` | AR read | Workspace | Due/overdue reminders |
| `/app/payables/inbox` | AP read | Workspace | Supplier bill inbox |
| `/app/payables/bills/new` | AP create | Workspace | Upload/create supplier bill |
| `/app/payables/bills/$billId` | AP read | Workspace | Supplier bill detail |
| `/app/payables/bills/$billId/review` | AP edit | Workspace | Extraction and bill review |
| `/app/payables/bills/$billId/match` | AP edit | Workspace | Three-way match workspace |
| `/app/payables/suppliers` | AP read | Workspace | Supplier directory |
| `/app/payables/suppliers/new` | AP create | Workspace | New supplier |
| `/app/procurement/purchase-orders` | Procurement read | Workspace | PO list |
| `/app/procurement/purchase-orders/new` | Procurement create | Workspace | PO creation |
| `/app/procurement/purchase-orders/$poId` | Procurement read | Workspace | PO detail |
| `/app/procurement/receipts` | Procurement read | Workspace | Goods receipt list |
| `/app/procurement/receipts/new` | Procurement create | Workspace | Record goods received |
| `/app/approvals` | Approval read | Workspace | Approval queue |
| `/app/approvals/$approvalId` | Approval read | Workspace | Approval package and decision |
| `/app/payments` | Payment read | Workspace | Incoming/outgoing payment history |
| `/app/payments/$paymentId` | Payment read | Workspace | Payment detail/timeline |
| `/app/reconciliation` | Ledger read | Workspace | Reconciliation workspace |
| `/app/finance-ai` | Finance AI | Workspace | Finance copilot |
| `/app/reports` | Reports | Workspace | Financial reports and exports |
| `/app/settings/profile` | Settings | Workspace | Organization profile |
| `/app/settings/members` | Settings | Workspace | Members and roles |
| `/app/settings/wallets` | Settings | Workspace | Wallets and addresses |
| `/app/settings/settlement` | Settings | Workspace | Preferred assets, chains and payment defaults |
| `/app/settings/policies` | Settings | Workspace | Approval and payment policies |
| `/app/settings/notifications` | Settings | Workspace | Notification preferences |
| `/app/settings/security` | Settings | Workspace | Session and security settings |
| `/pay/$publicToken` | Public token | Checkout | Customer invoice checkout |
| `/pay/$publicToken/status` | Public token | Checkout | Payment progress |
| `/receipt/$receiptToken` | Public token | Receipt | Publicly shareable receipt |
| `/supplier/submit/$publicToken` | Public token | Supplier portal | Supplier bill upload (optional MVP) |
| `/404` / not found | Public/auth as relevant | Contextual | Route not found |

### 5.3 Route access rules

- React route guards improve user experience but do not replace PHP authorization.
- On first app load, call a bootstrap endpoint to obtain current user, organizations, selected organization and effective capabilities.
- If logged out, workspace routes redirect to `/login?returnTo=<safe-relative-path>`.
- If authenticated but no organization exists, redirect to onboarding.
- If the user lacks a module capability, show a branded 403 screen, not an infinite redirect.
- Public payment/receipt tokens are opaque random tokens. Store only a hash where practical; never use sequential IDs.
- Token scopes are narrow: a payment token may read one invoice and initiate payment, but cannot expose the entire customer record or workspace.

## 6. WordPress plugin architecture and frontend takeover

### 6.1 Principle

MATCHFLOW is one installable WordPress plugin. PHP is the application backend and front controller. React is the browser application compiled into static assets. There is no separate Node.js production backend and no requirement to install a separate React server.

Vite/Node are development and build tools only. The production server runs WordPress/PHP and serves the compiled CSS/JS assets.

### 6.2 Plugin responsibilities

The plugin owns:

- Activation, deactivation and uninstall lifecycle.
- Database schema creation and migrations.
- WordPress user integration and organization membership.
- Frontend takeover and SPA shell delivery.
- React asset manifest loading and cache busting.
- REST API registration and permissions.
- Business domain services.
- NEAR Intents HTTP integration and quote verification.
- AI provider calls (server-side only).
- Document storage/access control.
- Payment polling jobs and reconciliation.
- Admin settings, diagnostics and logs.

### 6.3 Frontend takeover modes

Provide a plugin setting with two modes:

**A. Full frontend takeover (recommended for a dedicated MATCHFLOW site).** Every normal public frontend request is served through the MATCHFLOW SPA shell. React resolves `/`, `/login`, `/app/...`, `/pay/...` and all other public screens. WordPress admin and technical endpoints remain WordPress-owned.

**B. Scoped application mode.** Only configured prefixes (for example `/app/*`, `/pay/*`, `/receipt/*`) are intercepted. Existing WordPress marketing pages and posts continue to render normally.

The user has requested full takeover as the default product architecture, but scoped mode is valuable for development, staging and future marketing-site coexistence.

### 6.4 PHP routing strategy

Use WordPress's supported template pipeline:

1. Register explicit rewrite rules and query vars for MATCHFLOW route families where useful (`app`, `pay`, `receipt`, `supplier`).
2. Use `template_include` to return the plugin's SPA shell template for MATCHFLOW paths or all eligible public requests when full takeover is enabled.
3. Do not include a template and call `exit` inside `template_redirect`; WordPress documents `template_include` as the template replacement mechanism.
4. In full takeover mode, prevent inappropriate canonical redirects from rewriting valid React routes.
5. Preserve the original request path in a safely encoded bootstrap variable; do not pre-render user-controlled HTML.
6. Use TanStack Router to resolve the route after React mounts.
7. Return a React not-found screen for unknown frontend routes.

**Do not add a broad catch-all rewrite rule above all WordPress rules unless a tested reason requires it.** A blanket rule can shadow WordPress pages, REST routes and other plugins. Prefer `template_include` for full frontend takeover and explicit rewrite rules for reserved route families.

### 6.5 Technical routes that must never be taken over

Exclude at minimum:

- `/wp-admin/*`
- `/wp-login.php`
- `/wp-json/*`
- `/wp-admin/admin-ajax.php`
- `/wp-cron.php`
- `/xmlrpc.php`
- `/wp-content/*`
- `/wp-includes/*`
- existing static files and plugin build assets
- `/robots.txt`, sitemap endpoints and `/.well-known/*`
- WP-CLI, cron and REST requests

The exact exclusion matcher must be tested against subdirectory installs, multisite if supported, and reverse-proxy HTTPS deployments.

### 6.6 SPA shell template

A plugin-owned PHP template should output the document shell and a single React mount point, for example `#matchflow-root`. It should:

- Set the document title and language appropriately.
- Call `wp_head()`, `wp_body_open()` and `wp_footer()` where appropriate so required WordPress/plugin hooks continue to run.
- In strict takeover mode, prevent active-theme CSS/JS from overriding the app; dequeue only known theme handles and do not indiscriminately remove third-party plugin assets. Keep all MATCHFLOW styling under a stable root boundary.
- Enqueue only the compiled MATCHFLOW bundle and required runtime configuration.
- Provide a stable app root and root-specific CSS boundary.
- Avoid echoing secrets or full user records into HTML.
- Include a safe loading shell so users do not see a blank page while JS loads.

### 6.7 Vite asset pipeline

- React source lives inside the plugin source tree (for example `resources/app/`).
- Vite outputs production assets into `assets/build/` with hashed filenames and a manifest.
- PHP reads the Vite manifest and enqueues the correct CSS and JS entry files.
- In local development, the plugin may detect a configured Vite dev server and enqueue its HMR client and source entry; this must be disabled in production.
- Do not hardcode hashed bundle names.
- Use WordPress enqueue APIs rather than hardcoding script/link tags in the PHP template.
- Enqueue the app only on frontend takeover routes; do not load the SPA bundle in wp-admin.

### 6.8 WordPress admin integration

Provide a compact `Settings → MATCHFLOW` admin area for:

- Frontend takeover mode and route base.
- Plugin/database schema version and health.
- NEAR Intents API credential configuration status (never display secret values).
- AI provider configuration status.
- Asset build status and current manifest version.
- Background job/settlement monitor health.
- Safe diagnostic logs with secrets and personal data redacted.

The business workspace itself is React on the public frontend, not a large WordPress admin dashboard.

### 6.9 Activation and migrations

On activation:

- Check supported PHP and WordPress environment.
- Create/update custom tables using `$wpdb` and `dbDelta()`.
- Store schema version.
- Register required rewrite rules and flush rewrites once.
- Create default plugin options.

On normal requests:

- Never flush rewrite rules.
- Check schema version and run versioned migrations only when required.

On deactivation:

- Remove scheduled jobs and rewrite rules as appropriate; do not delete business data.

On uninstall:

- Preserve data by default. Destructive removal should require explicit opt-in and a documented uninstall policy.

### 6.10 WordPress compatibility and hosting

- Use standard WordPress HTTP API (`wp_remote_request`) for external API calls.
- Use `$wpdb` for custom tables and prepared statements for all variable SQL.
- Use WordPress APIs for users, roles/capabilities, nonces, uploads and scheduling where appropriate.
- Require pretty permalinks for clean deep links, or document the query-string fallback.
- Ensure the host's rewrite configuration sends non-file/non-directory requests to WordPress `index.php` as standard WordPress routing requires.
- Production plugin does not require Node.js, a Node daemon or a separate API server.

## 7. React SPA architecture

### 7.1 Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript |
| Build tool | Vite |
| CSS | Tailwind CSS v4 |
| Component foundation | shadcn/ui |
| Advanced component registry | ReUI (compatible variants only) |
| Icons | lucide-react |
| Routing | TanStack Router (file-based routes) |
| Server state | TanStack Query |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod (or a single selected form stack) |
| HTTP | Small typed `fetch` client for WP REST |
| Local state | React state/context; avoid redundant global stores |
| Charts | Recharts or a selected accessible chart library |
| Testing | Vitest + Testing Library + Playwright |

Use the current stable compatible package versions when scaffolding and commit the lockfile. Do not pin versions from old examples. ReUI currently documents React 19 and Tailwind CSS v4 and provides both Base UI and Radix-based component variants. Choose one primitive foundation consistently for shadcn and ReUI components; do not mix incompatible implementations casually.

### 7.2 TanStack responsibilities

**TanStack Router** owns route matching, nested layouts, route parameters, query-string validation, route loaders and navigation. Prefer file-based routes generated by the Vite router plugin.

**TanStack Query** owns server state: list/detail queries, query caching, mutations, optimistic updates only where safe, retries, invalidation and polling for payment states. Do not duplicate API records in ad hoc global state.

**TanStack Table** owns complex tabular state: sorting, filtering, pagination, column visibility, row selection and server-side query parameters. Use ReUI Data Grid or shadcn table styling around it; never create a second competing table state system.

### 7.3 API client

Create a single `wpApi` client that:

- Reads the REST root and nonce from the PHP bootstrap object.
- Uses same-origin requests with credentials.
- Adds `X-WP-Nonce` for authenticated REST mutations/requests when required.
- Normalizes WordPress REST errors into a typed application error.
- Supports `AbortSignal` for route changes and query cancellation.
- Does not expose the NEAR Intents JWT or AI provider API keys.
- Does not allow arbitrary endpoint concatenation from user input.

Create a typed `window.MATCHFLOW_BOOTSTRAP` declaration. PHP should inject it before the Vite entry script using `wp_add_inline_script()` or an equivalent WordPress enqueue mechanism. It may contain REST root, nonce, site/app URLs, locale, user summary and organization/capability summary. It must never contain Intents JWT, AI provider keys, private tokens or unfiltered user meta.

### 7.4 React application providers

Root provider composition:

1. Theme provider.
2. QueryClientProvider.
3. RouterProvider.
4. Toast/notification provider.
5. Dialog/command palette provider where global.
6. Auth/organization bootstrap context (derived from server response).

Keep business data in TanStack Query. Keep only transient UI state in React context/state: sidebar open state, active command menu, temporary form progress and theme preference.

### 7.5 File structure

```text
matchflow/
├── matchflow.php
├── uninstall.php
├── readme.txt
├── composer.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── components.json
├── includes/
│   ├── Core/
│   ├── Activation/
│   ├── Database/
│   ├── Routing/
│   ├── Frontend/
│   ├── Rest/
│   ├── Auth/
│   ├── Organizations/
│   ├── Receivables/
│   ├── Payables/
│   ├── Procurement/
│   ├── Approvals/
│   ├── Settlements/
│   ├── NearIntents/
│   ├── FinanceAI/
│   ├── Ledger/
│   ├── Documents/
│   ├── Reports/
│   ├── Jobs/
│   ├── Security/
│   └── Admin/
├── templates/
│   └── frontend-shell.php
├── resources/
│   └── app/
│       ├── src/
│       │   ├── app/
│       │   ├── routes/
│       │   ├── shells/
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── shared/
│       │   │   ├── data-display/
│       │   │   └── feedback/
│       │   ├── features/
│       │   │   ├── auth/
│       │   │   ├── dashboard/
│       │   │   ├── receivables/
│       │   │   ├── payables/
│       │   │   ├── procurement/
│       │   │   ├── approvals/
│       │   │   ├── payments/
│       │   │   ├── reconciliation/
│       │   │   ├── finance-ai/
│       │   │   ├── reports/
│       │   │   └── settings/
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── api/
│       │   ├── stores/
│       │   ├── styles/
│       │   └── types/
│       └── index.html
└── assets/
    └── build/
        ├── .vite/manifest.json
        └── assets/...
```

`includes/` is PHP source. `resources/app/` is the React source. `assets/build/` contains compiled files only. Do not ship `node_modules`.

## 8. UI/UX design system

### 8.1 Design direction

The product should feel like premium enterprise fintech software: calm, precise, high-trust, data-dense but readable. Avoid crypto casino aesthetics, token price tickers, excessive gradients, glassmorphism, glow effects and decorative AI imagery.

### 8.2 Proposed visual tokens

| Token | Direction |
|---|---|
| Primary | Deep emerald/teal used for primary actions and successful financial states |
| Text | Dark ink/navy for headings and key figures |
| Background | Soft neutral gray-white |
| Surface | White cards and panels |
| Border | Subtle cool gray |
| Info | Muted blue |
| Warning | Amber used only for review/action-needed states |
| Danger | Restrained red for blocked, failed or destructive states |
| Success | Green for verified/settled states |
| Typography | Inter or Geist Sans; use tabular numerals for amounts |
| Radius | Consistent 8–12px for controls/cards; avoid excessive pill UI |
| Elevation | Minimal, functional shadows only |

The precise colors are design tokens to be finalized in the first UI pass. Status color must never be the only signal: pair it with an icon and text.

### 8.3 Layout grid

**Desktop workspace**

- Sidebar: 248px expanded; 72px collapsed.
- Top bar: 64px high.
- Main content max-width: approximately 1440px with responsive gutters.
- Primary content: one main column with contextual side panel or two-column inspector where useful.
- Dense tables: sticky headers, saved filters and clear empty states.

**Tablet**

- Collapsible sidebar becomes a drawer.
- Two-column cards collapse to one or two depending on width.
- Tables retain horizontal scroll or convert to list cards for narrow screens.

**Mobile**

- Compact top bar and bottom/mobile navigation or slide-out nav.
- Critical tasks remain possible: invoice review, payment status, approvals and public checkout.
- Complex document comparison may use stacked comparison panels rather than side-by-side columns.

### 8.4 Component source strategy

**shadcn/ui:** primary source for foundational controls and accessible primitives. Use local copied components so the product can customize them.

**ReUI:** use for higher-order data grid, filters, file upload, stepper, timeline, kanban and other complex interaction patterns. Confirm licensing for paid blocks/templates before using them in the submission or shipped product.

**Lucide React:** consistent outline icon set. Import named icons, provide accessible labels for icon-only buttons and avoid decorative icon clutter.

**TanStack Table:** data model and table behaviour; styling can come from shadcn or ReUI.

### 8.5 Global component inventory

| Component | Responsibility | Used on |
|---|---|---|
| `AppShell` | Workspace frame and responsive layout | All authenticated routes |
| `AppSidebar` | Primary navigation and module groups | Workspace |
| `SidebarNavItem` | Active/hover/disabled navigation item | Sidebar |
| `WorkspaceSwitcher` | Switch organization/workspace | Top bar |
| `Topbar` | Breadcrumbs, search, quick create, profile | Workspace |
| `Breadcrumbs` | Current route context | Detail screens |
| `GlobalSearch` | Search invoices, bills, counterparties, payments | Workspace |
| `CommandPalette` | Keyboard-first navigation/actions | Workspace |
| `QuickCreateMenu` | Create invoice, bill, PO or receipt | Workspace |
| `PageHeader` | Title, description, actions | All list/detail pages |
| `MetricCard` | KPI and delta | Overview/reports |
| `StatusBadge` | Consistent domain status | Lists/details |
| `AmountDisplay` | Currency-aware amount with tabular digits | Financial surfaces |
| `AssetBadge` | Token/network identification | Payments/checkout |
| `DataTable` | TanStack Table wrapper | Lists |
| `FilterBar` | Search, status, date, amount, counterparty | Lists |
| `DateRangeFilter` | Period filters | Lists/reports |
| `EmptyState` | Contextual empty state with CTA | Lists |
| `SkeletonState` | Loading placeholders | All data screens |
| `ErrorState` | Retryable and terminal error feedback | All data screens |
| `ConfirmDialog` | Destructive/financial confirmation | Void, reject, cancel |
| `FormField` | Label, input, helper, validation | Forms |
| `CurrencyInput` | Exact decimal/currency input | Invoices/bills/payments |
| `AddressField` | Wallet/network-aware address display/input | Counterparties/settings |
| `CopyButton` | Copy address, ID, transaction hash | Payment screens |
| `FileDropzone` | Drag/drop and choose file | Bill upload |
| `DocumentViewer` | Preview PDF/image and pages | Bill review |
| `EvidencePanel` | Source documents and extracted fields | Bill review/matching |
| `ApprovalTimeline` | Who approved/rejected and when | Bill/payment detail |
| `SettlementTimeline` | Quote/deposit/processing/success/refund events | Payment detail |
| `QuoteSummary` | Input, output, fees, route, expiry, slippage | Checkout/payment confirmation |
| `WalletConnectButton` | Connect/disconnect supported wallet | Checkout/settings |
| `PaymentStatusPanel` | Human-readable payment progress | Checkout/payment detail |
| `ReceiptCard` | Shareable settlement proof | Receipt/detail |
| `FinanceAssistantPanel` | AI question/answer and action proposals | Finance AI/contextual panels |
| `ToastCenter` | Non-blocking feedback | Global |

### 8.6 Interaction principles

- Destructive and financial actions require a clear summary before confirmation.
- Show the exact currency, amount, recipient, network and asset before wallet signing.
- Never hide route fees, slippage, minimum output or quote expiry.
- Use progressive disclosure: show essential information first, detailed technical metadata on demand.
- Keep row actions contextual and keyboard accessible.
- Every async action has loading, success, error and retry states.
- Every list has loading, empty, populated and failure states.
- For financial actions, disable duplicate submission while the request is in flight and enforce idempotency server-side.

## 9. UI/UX workflow and screen-by-screen mapping

### 9.1 Public landing / entry (`/`)

**Purpose:** explain MATCHFLOW, establish trust and route users into login or onboarding.

**Sections:** headline/value proposition; Receivables and Payables feature split; Evidence-to-Settlement illustration; NEAR Intents-supported settlement explanation; security/controls section; CTA; footer.

**Components:** MarketingShell, SiteHeader, Hero, FeatureGrid, WorkflowDiagram, TrustStrip, CTASection, Footer.

**Primary actions:** `Sign in`, `Create workspace`, `Explore demo` if a demo mode is shipped.

**States:** normal, maintenance banner, authenticated user sees `Open workspace`.

### 9.2 Login (`/login`)

**Purpose:** authenticate WordPress user and return to intended app route.

**Fields:** email/username, password, remember me.

**Actions:** sign in, show/hide password, forgot password.

**Validation:** required fields; generic invalid-credentials message; rate-limit response; preserve safe relative return path only.

**States:** idle, submitting, invalid credentials, locked/rate-limited, success redirect.

**Components:** AuthShell, AuthCard, Input, PasswordInput, Checkbox, Button, InlineAlert.

### 9.3 Business onboarding (`/onboarding/business`)

**Purpose:** create the first organization and configure the minimum finance profile.

**Steps:**
1. Business identity: legal/display name, business type, country, timezone.
2. Financial preferences: base reporting currency, preferred receiving asset (from live supported token list where configured), preferred settlement address.
3. Wallet setup: connect or enter a verified address for a supported route; explain that this is a destination address, not a private key.
4. Review and create workspace.

**Components:** OnboardingShell, Stepper, BusinessProfileForm, CountrySelect, CurrencySelect, AssetSelect, WalletAddressField, ReviewCard.

**Completion:** create organization/membership records, select it and navigate to `/app/overview`.

### 9.4 Workspace shell

**Purpose:** persistent frame across authenticated routes.

**Structure:** left sidebar; top bar; breadcrumbs/page header; main content region; optional right-side contextual panel; global toast/dialog layer.

**Sidebar groups:** Overview; Receivables; Payables; Procurement; Approvals; Payments; Reconciliation; Finance AI; Reports; Settings.

**Top bar:** workspace switcher; global search; quick create; notifications; help; profile menu.

**Responsive:** sidebar drawer on tablet/mobile; top bar remains available; page actions collapse into overflow menu.

### 9.5 Overview (`/app/overview`)

**Purpose:** answer “What is happening with the business's money?” immediately.

**Sections:**
- KPI cards: receivables outstanding, payables outstanding, collected this period, paid this period.
- Cash movement/settlement activity chart (only from actual stored records).
- Action-required queue: unmatched bills, pending approvals, incomplete payments, overdue invoices.
- Recent activity feed with AR/AP classification.
- Upcoming receivables/payables.
- Quick actions: create invoice, upload bill, create purchase order.

**Components:** MetricCard, TrendIndicator, PeriodSelect, ChartCard, ActionQueue, ActivityFeed, UpcomingObligations, QuickActionCard.

**Empty state:** explain how to create first invoice or upload first bill; never show fake metrics.

**Data:** dashboard summary endpoint; queries scoped to selected organization.

### 9.6 Receivables invoice list (`/app/receivables/invoices`)

**Purpose:** manage customer invoices and collection progress.

**Toolbar:** title/description; `New invoice`; search; status filter; date range; customer filter; amount range; export.

**Columns:** invoice number; customer; issue date; due date; total; paid; outstanding; status; latest payment; row actions.

**Filters:** draft, issued, partially paid, paid, overdue, void; date; customer; amount.

**Row actions:** view; edit draft; duplicate; copy payment link; send reminder; download PDF; void (permission/policy controlled).

**Components:** DataTable, FilterBar, StatusBadge, AmountDisplay, RowActionMenu, Pagination, EmptyState.

### 9.7 Create invoice (`/app/receivables/invoices/new`)

**Purpose:** create a professional invoice and optionally publish a payment link.

**Layout:** two-column editor + live invoice preview on desktop; stacked on mobile.

**Sections/fields:**
- Customer selector or quick create.
- Invoice number (generated by server, editable if allowed and unique within organization).
- Issue date and due date.
- Currency.
- Line items: description, quantity, unit price, discount/tax where configured.
- Notes/payment terms.
- Preferred destination asset/address inherited from organization defaults, with explicit override permission.
- Review totals and save state.

**Actions:** save draft; issue invoice; issue and copy payment link; cancel.

**Validation:** positive quantities; valid currency; decimal precision; due date rules; no duplicate invoice number; totals computed by PHP using exact decimal logic.

**Important:** the frontend may preview totals, but PHP recalculates and stores the authoritative totals.

### 9.8 Invoice detail (`/app/receivables/invoices/$invoiceId`)

**Header:** invoice number, customer, status, total, outstanding balance, primary action.

**Tabs/sections:** Overview; line items; payment attempts; activity/audit; documents.

**Actions:** copy link; resend; record offline payment (if enabled and clearly labelled); create payment quote; download/print; edit draft; void.

**Components:** InvoiceSummary, LineItemsTable, PaymentAttemptsTable, Timeline, ReceiptList, ActivityPanel.

**States:** draft, issued/unpaid, partially paid, fully paid, overdue, void, payment pending, refund/exception.

### 9.9 Public customer checkout (`/pay/$publicToken`)

**Purpose:** let a customer pay a specific invoice without a MATCHFLOW account.

**Layout:** brand/business header; invoice summary; amount due; payment method selector; route quote; wallet action; help/security footer.

**Steps:**
1. Resolve public token server-side; validate scope, expiry and invoice status.
2. Display merchant, invoice reference, amount due, due date and payment terms.
3. Select a source network/token from current supported assets.
4. Connect compatible wallet.
5. Select or confirm the business's destination asset/address (usually fixed by invoice/business policy).
6. Request a fresh executable quote.
7. Verify quote signature server-side before returning executable deposit details to the client.
8. Display source amount, destination amount, fees, slippage/minimum, expiry and deposit details.
9. Customer confirms and signs source-chain transfer.
10. Track status; show success only after destination settlement validation.

**Components:** CheckoutShell, MerchantHeader, InvoiceDueCard, AssetNetworkPicker, WalletConnectButton, QuoteSummary, DepositInstruction, PaymentStatusPanel, SupportFooter.

**Critical states:** token invalid/expired; invoice already paid; invoice void; no supported route; wallet missing; quote expired; signature invalid; awaiting deposit; deposit detected; processing; incomplete deposit; success; refunded; failed.

**Safety:** do not reveal internal invoice notes, supplier data or organization records from the public token.

### 9.10 Payment status (`/pay/$publicToken/status`)

**Purpose:** show a persistent transaction status after the customer begins payment.

**Display:** invoice reference; expected output; source deposit status; settlement timeline; estimated time if returned; refresh/status update timestamp; help/refund notice when relevant.

**Polling:** TanStack Query polls a public status endpoint at a sensible interval while the state is non-terminal. PHP also runs background status checks. Stop aggressive polling on terminal state.

**Rule:** client polling is display-only; PHP settlement state is authoritative.

### 9.11 Receipt (`/receipt/$receiptToken`)

**Purpose:** share verified proof of a completed settlement.

**Display:** merchant; payer/customer label if safe; invoice reference; settled amount and asset; destination network; actual settlement transaction; date/time; payment reference; status.

**Actions:** download/print receipt; open block explorer; copy receipt link.

**Privacy:** only fields intentionally designated safe for public receipt are exposed.

### 9.12 Payables inbox (`/app/payables/inbox`)

**Purpose:** triage supplier invoices and exceptions.

**Views:** All bills; Needs review; Ready for approval; Awaiting approval; Scheduled/ready to pay; Paid; Rejected/void.

**Columns:** supplier; invoice number; invoice date; due date; amount; match result; approval state; payment state; owner.

**Actions:** upload bill; create bill manually; open review; assign reviewer; reject/mark duplicate; export.

**Components:** DataTable, FilterBar, MatchStatusBadge, ApprovalStatusBadge, FileDropzoneModal, BulkActionBar (only for safe actions).

### 9.13 Supplier bill upload and extraction (`/app/payables/bills/new`)

**Purpose:** ingest a supplier invoice.

**Upload types:** PDF, PNG, JPEG; enforce size, MIME and file-signature checks.

**Flow:** choose file; upload privately; create bill record; queue extraction; show extraction progress; display extracted fields with confidence and page/source location; user confirms/corrects fields; match supplier; save.

**Extracted fields:** supplier name, supplier reference, invoice number, invoice date, due date, currency, subtotal, tax, total, line items, quantities, unit prices, payment address if explicitly present.

**Review rules:** low-confidence fields highlighted; totals recalculated; extracted wallet address never becomes a trusted recipient automatically. Supplier payment address must be verified through a separate supplier profile/confirmation process.

### 9.14 Supplier bill detail/review (`/app/payables/bills/$billId` and `/review`)

**Layout:** document preview on left; extracted field editor on right; status and actions at top.

**Sections:** supplier/invoice header; line items; tax/total; linked PO; goods receipts; extraction evidence; match result; approvals; settlement history; audit log.

**Actions:** correct extraction; link/create PO; run match; submit for approval; reject; mark duplicate; request supplier correction; prepare payment after approval.

### 9.15 Three-way match workspace (`/app/payables/bills/$billId/match`)

**Purpose:** compare invoice, PO and received goods line by line.

**Layout:** summary banner; comparison table; discrepancy panel; policy outcome; evidence tabs.

**Comparison columns:** item/normalized description; PO quantity; received quantity; invoiced quantity; PO unit price; invoiced unit price; allowed tolerance; line amount variance; result.

**Outcomes:** Passed; Passed with allowed variance; Exception; Missing PO; Missing goods receipt; Duplicate suspected.

**Actions:** accept match; request correction; create exception; escalate to approver. An override must require a reason, actor identity and audit entry; no silent bypass.

### 9.16 Suppliers (`/app/payables/suppliers`)

**List fields:** supplier name; contact; country; approved status; default payment asset; verified destination address indicator; open balance; last payment.

**Supplier detail:** identity; contacts; addresses by network; verification history; bills; purchase orders; payments; documents; audit events.

**Critical rule:** changes to destination addresses trigger a verification workflow and risk warning. Do not trust an address extracted from a newly uploaded invoice.

### 9.17 Purchase orders (`/app/procurement/purchase-orders`)

**Purpose:** create and manage purchase commitments.

**List columns:** PO number; supplier; created date; expected date; total; received amount/quantity; status; linked bills.

**Create PO fields:** supplier; PO number; date; delivery address/details; currency; line items; quantity; unit price; tolerance; expected delivery; terms; attachments.

**Detail sections:** overview; line items; goods receipts; linked bills; activity/audit.

**Statuses:** Draft; Issued; Partially received; Fully received; Closed; Cancelled.

### 9.18 Goods receipts (`/app/procurement/receipts`)

**Purpose:** record what was actually received.

**Flow:** select PO; display open quantities; enter received quantity per line; attach delivery evidence; record receipt date/reference; submit.

**Controls:** received quantity cannot silently exceed ordered quantity. Over-delivery is captured as an exception. Multiple partial receipts are supported.

### 9.19 Approvals queue (`/app/approvals`)

**Purpose:** provide one queue for decisions requiring authorized human review.

**Views:** Pending my approval; All pending; Approved; Rejected; Escalated.

**Columns:** obligation type; reference; counterparty; amount; match status; requested by; age; required approver.

**Actions:** open review; approve; reject; request changes; reassign (permission-controlled).

### 9.20 Approval detail (`/app/approvals/$approvalId`)

**Layout:** financial summary; evidence tabs; match result; policy evaluation; payment destination; audit timeline.

**Before approval:** display exact amount, currency, recipient, chain/asset intent, policy result, outstanding exceptions and whether the supplier destination is verified.

**Decision actions:** Approve; Reject; Request correction. Require confirmation dialog and reason for rejection/override.

**Separation of duties:** a creator should not approve their own payable when the selected policy requires dual control.

### 9.21 Payments list (`/app/payments`)

**Tabs:** All; Incoming; Outgoing; Pending; Successful; Refunded; Failed.

**Columns:** date; payment reference; purpose; obligation; counterparty; source asset/chain; destination asset/chain; amount; status.

**Filters:** date, purpose, status, asset, chain, counterparty and amount.

### 9.22 Payment detail (`/app/payments/$paymentId`)

**Sections:** payment summary; quote details; source deposit; settlement timeline; destination transaction; refund details; linked invoice/bill; receipt; audit events.

**Technical detail drawer:** correlation ID, 1Click state, quote timestamp, quote expiry, deposit address/memo (masked where appropriate), transaction hashes, API errors (redacted).

### 9.23 Reconciliation (`/app/reconciliation`)

**Purpose:** identify settled payments that have not yet been matched to a business obligation and obligations with unmatched payments.

**Views:** Reconciled; Needs matching; Partial; Exceptions; Refunds.

**Matching suggestions:** exact obligation reference; amount; counterparty; payment time; payment token metadata. AI may suggest matches, but user confirmation or deterministic rules are required.

**Actions:** confirm match; split allocation; mark external/offline payment (if enabled); investigate; export.

### 9.24 Finance AI (`/app/finance-ai`)

**Purpose:** grounded finance operations assistant.

**Layout:** chat/prompt panel; suggested questions; result cards; source record citations; proposed action confirmation cards.

**Allowed read tools:** summarize AR/AP; get overdue invoices; list pending approvals; explain a match exception; report settlement status; summarize period totals.

**Action tools:** create draft invoice; extract bill; run match; prepare quote; prepare payment for human approval. All actions must call PHP domain services and pass policy checks.

**Never allowed:** invent balances; alter recipient address; bypass policies; approve a user's own payment outside policy; sign a wallet transaction or hold private keys.

### 9.25 Reports (`/app/reports`)

**MVP reports:** receivables aging; payables aging; collections by period; supplier payments by period; settlement exceptions; reconciliation status.

**Filters:** date range, counterparty, currency, module, status.

**Exports:** CSV generated server-side with organization scope and audit event. Clearly label the reporting currency and whether amounts are converted or native.

### 9.26 Settings

**Organization profile:** legal/display name, country, timezone, base reporting currency, logo.

**Members:** invite user, assign role, deactivate membership.

**Wallets:** supported wallet connections/addresses, network, label, verified status, default AR destination, default refund address.

**Settlement:** allowed source/destination assets, preferred destination asset, slippage policy, minimum payment size, quote expiry handling.

**Policies:** automatic approval cap; daily limits; supplier allowlist; required match; dual control; allowed asset/network; emergency pause.

**Notifications:** payment success/failure, overdue invoice, pending approval, exception and security events.

**Security:** sessions, recent activity, public links, API/integration status where relevant.

## 10. Domain model and database schema

### 10.1 Storage strategy

Use WordPress users for identity and custom plugin tables for MATCHFLOW transactional data. Do not model the transactional core as a large collection of custom post types. Use `$wpdb` and indexed relational tables because invoices, line items, settlements, events, ledger records and organization scoping require predictable joins and transactional updates.

Use the current site's table prefix: `$wpdb->prefix . 'mf_'` for single-site tables. If multisite is not explicitly implemented and tested, state that the MVP supports single-site WordPress only.

### 10.2 Core tables

| Table | Important fields |
|---|---|
| `mf_organizations` | id, name, slug, country, timezone, reporting_currency, status, created_at |
| `mf_memberships` | id, organization_id, user_id, role, capabilities_json, status, created_at |
| `mf_counterparties` | id, organization_id, type, name, email, country, status, created_at |
| `mf_counterparty_addresses` | id, counterparty_id, chain_id, asset/address metadata, address, verified_at, status |
| `mf_ar_invoices` | id, organization_id, customer_id, invoice_number, currency, totals_atomic/decimal, issue_date, due_date, status, public_token_hash |
| `mf_ar_invoice_items` | id, invoice_id, description, quantity_decimal, unit_price_decimal, tax/discount fields, line_total_decimal |
| `mf_ap_bills` | id, organization_id, supplier_id, invoice_number, currency, totals, due_date, status, match_status, approval_status |
| `mf_ap_bill_items` | id, bill_id, description, normalized_item_key, quantity, unit_price, tax, line_total |
| `mf_purchase_orders` | id, organization_id, supplier_id, po_number, currency, total, expected_date, status |
| `mf_purchase_order_items` | id, po_id, description, normalized_item_key, ordered_quantity, unit_price, tolerance |
| `mf_goods_receipts` | id, organization_id, po_id, receipt_reference, received_at, created_by, status |
| `mf_goods_receipt_items` | id, receipt_id, po_item_id, received_quantity, notes |
| `mf_documents` | id, organization_id, owner_type, owner_id, storage_key, mime_type, size, sha256, extraction_status, created_at |
| `mf_extractions` | id, document_id, model/provider, schema_version, extracted_json, confidence_json, reviewed_by, reviewed_at |
| `mf_match_runs` | id, bill_id, rule_version, result, discrepancies_json, calculated_at |
| `mf_approval_policies` | id, organization_id, name, rules_json, version, active |
| `mf_approvals` | id, organization_id, subject_type, subject_id, requested_by, approver_id, status, reason, decided_at |
| `mf_settlements` | id, organization_id, purpose, subject_type, subject_id, 1click_ref, quote_json, status, source/destination asset, amounts, recipient, refund address, deposit address/memo, tx hashes, expiry |
| `mf_settlement_events` | id, settlement_id, provider_status, normalized_status, payload_hash, event_json_redacted, observed_at |
| `mf_ledger_entries` | id, organization_id, obligation_type, obligation_id, settlement_id, entry_type, amount_atomic, asset_id, direction, occurred_at |
| `mf_audit_events` | id, organization_id, actor_user_id, action, subject_type, subject_id, before_hash, after_hash, metadata_redacted, created_at |
| `mf_public_tokens` | id, token_hash, scope, subject_type, subject_id, expires_at, revoked_at, last_used_at |
| `mf_notifications` | id, organization_id, user_id, type, payload, read_at, created_at |

Fields above are logical requirements, not a command to create every table before the first running vertical slice. Use migrations with `dbDelta()` and a schema-version option.

### 10.3 Database rules

- Every business-owned record includes `organization_id` and is always queried with it.
- Use foreign-key-like integrity in the domain layer; WordPress hosting varies, so do not assume every install enforces DB constraints as expected.
- Add indexes for organization + status + date, unique invoice/PO references within the appropriate scope, payment status, public-token hash, settlement deposit address, and event timestamps.
- Store exact money values as integer atomic units plus asset decimals for chain transfers. For fiat invoice calculations use canonical decimal strings and a fixed decimal/money library or PHP BCMath where available; define an explicit fallback or declare BCMath as a requirement. Never use float.
- Keep settlement events append-only; update a summary status separately.
- Use database transactions for multi-record payment/ledger transitions where supported (InnoDB).
- Store raw external payloads only when needed, redact secrets and personal information, and apply retention rules.

### 10.4 Status models

**AR invoice:** `draft`, `issued`, `partially_paid`, `paid`, `overdue`, `void`, `review_required`.

**AP bill:** `received`, `extracting`, `needs_review`, `matched`, `exception`, `pending_approval`, `approved`, `rejected`, `ready_to_pay`, `partially_paid`, `paid`, `overdue`, `void`.

**Purchase order:** `draft`, `issued`, `partially_received`, `fully_received`, `closed`, `cancelled`.

**Payment settlement:** provider state plus internal state. Do not overload invoice/bill status with 1Click status.

**Approval:** `not_required`, `pending`, `approved`, `rejected`, `changes_requested`, `cancelled`.

## 11. WordPress REST API specification

### 11.1 Namespace

`/wp-json/matchflow/v1/`

All routes are registered on `rest_api_init` using `register_rest_route()`. Every route must declare `permission_callback`. Authenticated routes use WordPress cookie authentication plus `X-WP-Nonce` and capability/organization authorization. Public token routes use their own narrowly scoped token validation and rate limiting.

### 11.2 API groups

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/bootstrap` | Current user, organizations, capabilities, app config |
| POST | `/auth/login` | Optional custom login bridge if not using native WP login |
| GET/POST | `/organizations` | List/create organization |
| GET/PATCH | `/organizations/{id}` | Read/update organization |
| GET/POST | `/counterparties` | List/create customers and suppliers |
| GET/PATCH | `/counterparties/{id}` | Counterparty detail/update |
| GET/POST | `/receivables/invoices` | List/create invoices |
| GET/PATCH | `/receivables/invoices/{id}` | Read/update invoice |
| POST | `/receivables/invoices/{id}/issue` | Issue invoice and create public link |
| POST | `/receivables/invoices/{id}/payment-link` | Create/rotate public link |
| GET | `/public/invoices/{token}` | Read limited public invoice data |
| POST | `/public/invoices/{token}/quotes` | Create public checkout quote |
| GET | `/public/payments/{token}/status` | Read limited payment status |
| GET | `/public/receipts/{token}` | Read public receipt fields |
| GET/POST | `/payables/bills` | List/create bill |
| POST | `/payables/bills/{id}/upload` | Upload document |
| POST | `/payables/bills/{id}/extract` | Queue/run extraction |
| POST | `/payables/bills/{id}/match` | Run deterministic matching |
| POST | `/payables/bills/{id}/submit-approval` | Submit for approval |
| POST | `/payables/bills/{id}/approve` | Approve with policy/capability check |
| POST | `/payables/bills/{id}/reject` | Reject/request correction |
| GET/POST | `/procurement/purchase-orders` | List/create POs |
| GET/PATCH | `/procurement/purchase-orders/{id}` | Read/update PO |
| GET/POST | `/procurement/goods-receipts` | List/create goods receipts |
| GET | `/approvals` | Approval queue |
| GET | `/approvals/{id}` | Approval detail |
| GET | `/payments` | Payment history |
| GET | `/payments/{id}` | Payment detail |
| POST | `/settlements/quotes` | Create authenticated settlement quote |
| GET | `/settlements/{id}` | Internal settlement detail |
| POST | `/settlements/{id}/confirm-deposit` | Record client-submitted source tx reference if required by flow |
| POST | `/settlements/{id}/refresh` | Safe on-demand status refresh |
| GET | `/supported-assets` | Cached supported token metadata |
| GET | `/reconciliation` | Reconciliation records |
| POST | `/reconciliation/{id}/confirm` | Confirm allocation/match |
| GET | `/dashboard/summary` | KPI summary |
| GET | `/reports/{reportKey}` | Report data |
| POST | `/reports/{reportKey}/export` | Generate CSV export |
| POST | `/finance-ai/query` | Grounded AI query/action proposal |
| GET/PATCH | `/settings/policies` | Read/update policy rules |
| GET/POST | `/settings/members` | List/invite members |

### 11.3 API response conventions

Success responses should use a consistent envelope, for example:

```json
{
  "success": true,
  "data": {},
  "meta": { "request_id": "..." }
}
```

Errors should have a stable code and human-readable message without leaking stack traces:

```json
{
  "code": "matchflow_permission_denied",
  "message": "You do not have permission to perform this action.",
  "data": { "status": 403 }
}
```

Use WordPress REST response/error objects and correct HTTP status codes. Do not return raw exception messages to the browser.

### 11.4 Permission model

- `permission_callback` on every registered endpoint.
- Use `current_user_can()` for WordPress-level capability checks.
- Then verify membership in the requested organization and product-specific capability.
- Public routes must validate token scope, expiry, revocation and subject ownership.
- Validate all path IDs and request schemas server-side.
- Rate-limit login, public token lookup, quote generation, file upload and AI calls.
- Enforce idempotency keys for create-payment and payment-trigger endpoints.

### 11.5 WordPress authentication and nonces

Use WordPress cookie authentication for same-origin SPA requests. For a fully React login screen, implement a narrowly scoped `POST /auth/login` bridge that calls `wp_signon()` and sets WordPress auth cookies. Protect it with HTTPS, same-origin/Origin validation, login throttling, generic failure messages and safe relative redirect validation. Password reset should delegate to WordPress core password-reset primitives and route the user back into the React reset screen. Do not create a second password store. PHP bootstraps a REST nonce and REST root into a minimal global config object. React sends the nonce through `X-WP-Nonce` where required.

A WordPress nonce is a CSRF mitigation, not authentication, authorization or a one-time token. Always check user identity, role/capability and organization membership separately. Guest login endpoints need their own abuse/rate-limit controls; a logged-out WordPress nonce is not a substitute for login security.

## 12. NEAR Intents settlement integration

### 12.1 Integration boundaries

The PHP plugin owns all 1Click API communication. The browser must never receive the partner JWT/API key. Use WordPress HTTP API with timeouts, bounded retries and sanitized logs.

Required 1Click capabilities:

- Fetch supported token/network metadata dynamically.
- Request dry quote previews.
- Request executable (`dry: false`) quotes only after a user/business action.
- Verify signed quote payloads before consuming executable fields.
- Provide wallet-compatible deposit instructions.
- Monitor execution status using the unique deposit address and deposit memo when present.
- Store source and destination transaction details.

### 12.2 PHP signature verification decision

The official NEAR documentation recommends `verifyQuoteSignature()` from the TypeScript SDK. MATCHFLOW's production backend is PHP-only, so do not quietly introduce a permanent Node server just for this function.

Implement a small, isolated PHP verifier that mirrors the documented official verification algorithm, using stable JSON serialization, SHA-256, Base58 decoding and Ed25519 verification through PHP's Sodium extension. Pin the currently documented 1Click manager public key as configuration/code with a clear rotation process. Validate the PHP implementation against official TypeScript SDK fixtures/test vectors before it is trusted. If byte-for-byte parity cannot be demonstrated, do not use quote deposit details; stop the payment flow and surface a verification error. A TypeScript verifier may be used in a temporary test harness only, not as the production backend.

### 12.3 Quote creation

A quote request is built from trusted server-side invoice/bill data:

- `purpose` (`AR_COLLECTION` or `AP_SETTLEMENT`).
- `originAsset` and `destinationAsset` from the live supported asset registry.
- `amount` as an atomic integer string.
- `swapType`/quote mode based on the fixed amount requirement and route support.
- `recipient` from a verified organization/supplier destination.
- `refundTo` from a verified source-chain wallet address.
- `slippageTolerance` from business policy or customer confirmation.
- `deadline`/quote expiry where required.
- Any required `depositType`, `recipientType`, `refundType` and memo/chain-specific details according to the latest API schema.

Never accept an arbitrary recipient address from the React browser for an already-created payable. Resolve the recipient from the approved supplier/payment instruction and verify that it has not changed since approval.

### 12.4 Exact amount handling

For a fixed invoice/bill settlement, use the appropriate exact-output flow where supported so the intended destination amount is specified. Explain the input buffer/minimum and refund behaviour. If the route or business flow requires a different swap type, show the quote's actual input/output/minimum values and require explicit acceptance.

### 12.5 Payment states

The current documented 1Click status enum includes:

- `PENDING_DEPOSIT`
- `KNOWN_DEPOSIT_TX`
- `INCOMPLETE_DEPOSIT`
- `PROCESSING`
- `SUCCESS`
- `REFUNDED`
- `FAILED`

Map unknown provider states to `UNKNOWN_REVIEW` (or equivalent internal safe state) and do not mark the obligation as paid.

### 12.6 Status monitoring

- Poll from PHP background jobs, not only from a browser tab.
- Use a scheduled event/worker with a bounded polling cadence and backoff.
- WordPress WP-Cron is traffic-triggered; production deployment should configure a real system cron or WP-CLI invocation to run due events reliably.
- On payment detail pages, React may request a status refresh, but the backend owns the state transition.
- Store every meaningful provider status transition in an append-only event table.
- Validate destination asset, destination recipient, amount and transaction reference before reconciling.

### 12.7 No false settlement

A wallet's transaction prompt closing, a source-chain transaction hash existing, a deposit being detected or a quote returning successfully does not prove destination delivery. Only validated 1Click `SUCCESS` plus transaction detail checks can close an obligation. Refunded/failed/unknown states must enter exception workflows.

### 12.8 Wallet adapter strategy

Keep wallet logic behind a `WalletAdapter` interface in React. The adapter exposes supported chain detection, connection, address retrieval, token transfer/signing and transaction link. Start with one verified source chain/wallet route for the hackathon; add other networks only after route-specific deposit/memo/address handling has been tested.

Do not assume every 1Click-supported chain is supported by every wallet library. Query live 1Click assets, then intersect with implemented wallet adapters.

## 13. AI and document intelligence

### 13.1 Architecture

AI calls originate from PHP, with provider keys held server-side. Inputs are minimized and documents are sent only to configured providers under the product's privacy disclosures. The model returns a strict JSON schema; PHP validates it before storage.

### 13.2 Extraction contract

Each extracted field should include:

- `value`.
- `confidence` (bounded numeric value).
- `source_document_id`.
- `page_number` where available.
- `source_text` or bounding box if supported.
- `requires_review`.

### 13.3 Matching engine

The deterministic matching service compares:

- Supplier identity and approval status.
- Invoice number and duplicate fingerprints.
- PO reference.
- Item descriptions/normalized keys.
- Ordered quantity.
- Received quantity (sum of valid receipt lines).
- Invoiced quantity.
- Unit price and allowed tolerance.
- Tax and total arithmetic.
- Currency compatibility.

A configurable match policy may allow partial receipts and price tolerances. All results must explain which exact rule passed or failed.

### 13.4 Finance AI tools

Read tools:

- `get_receivables`
- `get_payables`
- `get_overdue_invoices`
- `get_pending_approvals`
- `get_payment_status`
- `explain_match_result`
- `summarize_financial_period`

Draft/action tools:

- `create_invoice_draft`
- `extract_supplier_bill`
- `run_three_way_match`
- `prepare_settlement_quote`
- `request_approval`
- `generate_report`

High-impact tools must produce a preview and require explicit human confirmation. AI never signs transactions, modifies verified payout addresses or bypasses policy.

## 14. Security, privacy and compliance posture

### 14.1 WordPress security

- Sanitize and validate all input; escape all output.
- Use prepared SQL statements.
- Use capability and organization checks on every protected request.
- Use REST nonces for CSRF protection, not as auth.
- Avoid direct file execution; protect plugin PHP files with `defined('ABSPATH') || exit`.
- Keep secrets in environment/config constants where possible; never commit `.env` or production keys.
- Do not place partner JWTs or AI API keys in HTML/JS/localized script data.
- Apply secure cookie/HTTPS deployment and safe redirect validation.

### 14.2 Organization isolation

Every read/write service receives an authenticated actor and organization context. Every SQL query for business data must include organization scoping. Add tests that attempt cross-organization access by changing IDs.

### 14.3 Public access tokens

- Use high-entropy random values.
- Store a hash, not the raw token, where possible.
- Scope token to one invoice/receipt/upload action.
- Support expiry and revocation.
- Rate-limit and avoid revealing whether arbitrary invoice IDs exist.
- Do not place PII in token payloads.

### 14.4 File security

- Validate extension, MIME and actual file signature.
- Enforce size and page limits.
- Store supplier/customer documents privately; do not rely on ordinary public Media Library URLs.
- Deliver document content through an authorization-checked endpoint or secure private storage.
- Prevent SVG/HTML/script uploads unless explicitly sanitized and required.
- Apply malware scanning when available; mark scan status.
- Record SHA-256 hash for evidence integrity.

### 14.5 Financial security

- Server calculates totals.
- Use integer atomic units/decimal-safe arithmetic.
- Re-read obligation and policy state immediately before issuing payment quote.
- Lock or otherwise guard transitions to prevent concurrent duplicate settlements.
- Use idempotency keys and unique constraints.
- Verify recipient address and asset against approved records.
- Revalidate approval remains valid and unrevoked.
- Require explicit confirmation for fees, source amount and route.
- Support emergency settlement pause.

### 14.6 Privacy

- Minimize AI document data.
- Redact provider logs and diagnostics.
- Keep invoice documents offchain.
- Expose only intended fields in public invoice/receipt endpoints.
- Provide data export and deletion/retention controls as the product matures.
- Do not claim regulatory certification or financial-services licensing unless independently obtained.

## 15. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Dashboard first usable render should be fast on ordinary broadband; paginate lists server-side. |
| Reliability | Payment monitoring continues even if the customer closes their browser. |
| Security | No public access to organization records; all tenant-scoped reads are authorized. |
| Accessibility | Keyboard navigable; visible focus; labelled controls; contrast; reduced-motion support. |
| Responsiveness | Critical workflows work on desktop/tablet/mobile. |
| Compatibility | Current supported WordPress/PHP/MySQL combinations documented and tested. |
| Maintainability | Domain services separated from REST controllers and UI components. |
| Observability | Correlation IDs, redacted logs, clear error codes and payment event history. |
| Portability | No mandatory Node runtime in production. |
| Reproducibility | Clean plugin install and documented build process. |

## 16. Testing strategy and acceptance criteria

### 16.1 PHP unit/integration tests

- Organization access isolation.
- Role/capability rules.
- Invoice totals and rounding.
- Duplicate invoice fingerprints.
- Three-way match: full, partial, over-delivery, price variance, missing PO, missing receipt.
- Approval policy thresholds and dual control.
- Settlement state transition matrix.
- Idempotent quote and settlement operations.
- Quote signature verification fixtures.
- Public token expiry/revocation/scope.
- File validation and private file delivery.
- Database migration from previous schema version.

### 16.2 React tests

- Route matching and direct deep-link loading.
- Authenticated route redirect and no-access page.
- Invoice builder calculations (display only; backend authoritative).
- Table sorting/filtering/pagination.
- Checkout state transitions.
- Payment timeline rendering.
- Bill extraction review states.
- Matching discrepancy visualizations.
- Approval confirmation and error states.
- Responsive sidebar and mobile navigation.

### 16.3 End-to-end tests

**AR scenario:** create invoice → issue public link → open in logged-out browser → choose supported asset → get quote → wallet transfer in controlled environment → track settlement → validate SUCCESS → mark paid → receipt.

**AP scenario:** create PO → record partial goods receipt → upload supplier bill → extract → detect mismatch → request correction → match → approve → prepare quote → sign transfer → validate settlement → mark bill paid.

**Failure scenario:** quote expires; quote signature fails; deposit is incomplete; status is failed/refunded; customer revisits link; duplicate transaction event arrives; user loses permission mid-workflow.

### 16.4 Hackathon acceptance criteria

- Plugin installs and activates without PHP fatal errors.
- Frontend takeover works for all MATCHFLOW deep links on direct load and refresh.
- `/wp-admin` and `/wp-json/matchflow/v1` remain accessible.
- React bundle loads via manifest and assets are cache-busted.
- The core AR and AP workflows work with actual backend data.
- At least one small real 1Click settlement is recorded and independently inspectable.
- Simulated fixtures are visibly labelled DEMO.
- README provides reproducible installation and testing steps.
- No payment shows as settled before validated `SUCCESS`.

## 17. Implementation phases and Cursor execution plan

### Phase 0 — Repository inspection and architecture lock

- Inspect existing repository and WordPress environment.
- Confirm plugin slug, URL base, site takeover requirement and build tooling.
- Create ADRs for full takeover, custom tables, route base, PHP quote signature verification and wallet adapter.
- Define domain types and REST contracts.

**Exit:** documented route map, schema, REST contract and payment lifecycle.

### Phase 1 — WordPress plugin foundation

- Main plugin bootstrap and autoloading.
- Activation/deactivation hooks.
- Schema/migration manager.
- Frontend takeover router.
- SPA shell and Vite manifest loader.
- WordPress admin diagnostics.
- REST namespace and bootstrap endpoint.

**Exit:** React app loads at direct deep links; WP admin and REST still work.

### Phase 2 — React design system and shells

- Vite React TypeScript app.
- Tailwind v4.
- shadcn/ui initialization.
- ReUI registry integration after choosing Base UI or Radix variant.
- lucide-react.
- TanStack Router, Query and Table.
- AuthShell, MarketingShell, WorkspaceShell, CheckoutShell and ReceiptShell.
- Tokens, typography, spacing and component inventory.

**Exit:** every route renders its correct shell and placeholder page; no broken links.

### Phase 3 — Core business domain

- Organization/membership.
- Counterparties.
- AR invoices and line items.
- AP bills and line items.
- Purchase orders and receipts.
- Audit events.

**Exit:** AR/AP records can be created, listed and opened from real WP REST endpoints.

### Phase 4 — AR workflow

- Invoice creation.
- Invoice issue.
- Public payment token.
- Public checkout page.
- Quote preview and payment request integration.

**Exit:** invoice can be issued and checkout can request a live quote.

### Phase 5 — AP workflow

- Private document upload.
- AI extraction and review.
- PO and goods-received matching.
- Duplicate detection.
- Approval policy and queue.

**Exit:** a bill mismatch is detected and a valid bill can pass to approval.

### Phase 6 — Settlement and reconciliation

- PHP 1Click client.
- Signature verifier.
- Wallet adapter integration.
- Quote issuance and status polling.
- Payment events, receipts and ledger updates.
- AR/AP shared settlement adapter.

**Exit:** at least one real route is completed; both AR/AP call the same settlement service.

### Phase 7 — Finance AI, reports and polish

- Finance copilot with tool allowlist.
- CSV reports.
- Global search, notifications and activity feed.
- Responsive/accessibility polish.
- Error, empty and loading states.

**Exit:** polished hackathon demo and test suite.

### Phase 8 — Submission hardening

- Clean install test.
- Route refresh test.
- PHP debug log review.
- Payment lifecycle regression.
- Secrets scan.
- README, architecture and security docs.
- Demo video and submission.

## 18. Repository quality and README requirements

README must include:

1. Product summary and screenshots.
2. Features that are actually implemented.
3. WordPress/PHP requirements.
4. Local setup and plugin activation.
5. Frontend build commands.
6. Environment/configuration constants.
7. Database migration behavior.
8. NEAR Intents API credential setup.
9. Supported live route actually tested.
10. How to run tests.
11. Known limitations.
12. Demo flow with real vs simulated actions clearly distinguished.
13. Security model and no-custody statement.
14. Architecture diagram and data/payment lifecycle.

Do not claim every blockchain, token, wallet, accounting platform or automation is supported unless it has been implemented and tested.

## 19. Cursor master build instruction

Use this as the project-wide instruction for the Cursor coding agent:

> You are the principal WordPress plugin architect and senior React engineer building MATCHFLOW. MATCHFLOW is a single installable WordPress plugin. PHP is the complete production backend and routing layer. React is the frontend SPA compiled with Vite. Do not introduce a Node.js production API server, Laravel, Vue or a separate frontend host.
>
> Frontend stack: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, ReUI, lucide-react, TanStack Router, TanStack Query and TanStack Table. Use React Hook Form and Zod for complex forms. Keep dependency versions compatible and commit the lockfile.
>
> Backend: WordPress plugin PHP, WordPress REST API under `/wp-json/matchflow/v1`, `$wpdb` custom tables, versioned migrations, WordPress users/cookies and organization membership authorization. Do not use Node, Prisma or PostgreSQL in production.
>
> The plugin takes over the WordPress public frontend. In full takeover mode, all normal public frontend URLs must return the same PHP-rendered SPA shell, and TanStack Router resolves the route. Preserve `/wp-admin`, `/wp-login.php`, `/wp-json`, `/wp-admin/admin-ajax.php`, `/wp-cron.php`, `/xmlrpc.php`, `/wp-content`, `/wp-includes`, existing static assets and `/.well-known` routes. Use `template_include` for template replacement; do not include a template and `exit` inside `template_redirect`. Add explicit rewrite rules only for reserved routes where useful. Never flush rewrite rules on normal requests.
>
> React must support deep links and refresh for `/`, `/login`, `/app/*`, `/pay/:token`, `/pay/:token/status`, `/receipt/:token` and `/supplier/submit/:token`. PHP enqueues production Vite manifest assets and provides a minimal safe bootstrap object containing REST root, REST nonce, current user/organization context and app URL. Never put external API credentials in the browser.
>
> The product has Receivables and Payables modules, connected through one shared NEAR Intents Settlement Engine and one Evidence-to-Settlement audit trail. Implement customer invoices/payment links; supplier bills/document extraction; purchase orders; goods receipts; deterministic three-way matching; duplicate detection; approval policies; shared AR/AP settlement; payment status events; ledger; receipts and reconciliation.
>
> NEAR Intents API calls run in PHP using the WordPress HTTP API. Use the official 1Click documentation and live supported token metadata. The 1Click partner JWT stays server-side. Quote signature verification must be performed server-side before executable quote fields are trusted. Implement the documented stable-JSON + SHA-256 + Base58 + Ed25519 verification in PHP using Sodium and test byte-for-byte against official TypeScript SDK fixtures. If parity cannot be proven, stop the payment flow; never skip verification silently.
>
> Use documented 1Click status values and fail safely on unknown values. Only a validated `SUCCESS` settlement can mark an invoice/bill fully paid. A wallet signature, transaction hash, deposit detection or dry-run quote is not settlement. `dry: true` is a quote preview only. Poll status server-side using the required deposit address and memo. Use append-only payment events, idempotency, expiry handling, refund/failure flows and exact atomic amounts. Never use floating-point money.
>
> AI extracts and explains; deterministic PHP rules calculate totals, perform matching, enforce policy and authorize payment preparation. AI cannot modify recipients, bypass policies, or sign transactions. Business records are tenant-scoped by organization ID on every query. Public tokens must be high entropy, scoped, expiring and revocable. Store private documents outside public URLs and serve them only after authorization.
>
> Before implementing a phase, inspect the current code and write down affected files, schema changes, API changes, acceptance tests and risks. Implement small vertical slices, run PHP/JS tests, and do not leave non-functional buttons, fake metrics or unlabelled simulations. Prefer reuse of existing components from shadcn/ReUI after checking their actual APIs and licensing. Keep the design premium, restrained, accessible and responsive.

## 20. Architecture decisions (ADRs)

### ADR-001: Single WordPress plugin

**Decision:** production backend, routing, data and API live inside one PHP plugin.  
**Reason:** user requires WordPress-hosted product and one deployable plugin.  
**Consequence:** Node is build-only; server features must be PHP-compatible.

### ADR-002: React SPA with Vite

**Decision:** React + TypeScript + Vite compiled to plugin assets.  
**Reason:** ecosystem access to shadcn/ReUI, reusable component systems and strong Cursor support.  
**Consequence:** PHP must reliably serve the SPA shell for deep links.

### ADR-003: TanStack Router/Query/Table

**Decision:** Router for URL state, Query for server state, Table for complex tabular UX.  
**Reason:** type-safe navigation and explicit server-data lifecycles.  
**Consequence:** avoid duplicate router/query/table state implementations.

### ADR-004: WordPress custom tables

**Decision:** custom relational tables for transactional data; WordPress users for identity.  
**Reason:** predictable tenant-scoped queries and relational financial operations.  
**Consequence:** versioned migrations and indexes are mandatory.

### ADR-005: Server-side quote verification in PHP

**Decision:** port the documented 1Click signature verification to PHP/Sodium and verify against official SDK vectors.  
**Reason:** no production Node service and no trust in client-only verification.  
**Consequence:** verification parity is a payment-launch blocker.

### ADR-006: Shared settlement engine

**Decision:** one settlement service supports `AR_COLLECTION` and `AP_SETTLEMENT`.  
**Reason:** one payment lifecycle, security model and audit history.  
**Consequence:** purpose and obligation references must be explicit on every settlement.

## 21. External technical references

Use these as the implementation source, and re-check them before locking dependency versions or payment payloads:

- WordPress REST API: https://developer.wordpress.org/rest-api/
- Register REST routes: https://developer.wordpress.org/reference/functions/register_rest_route/
- REST endpoint permissions: https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/
- REST cookie authentication: https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- WordPress nonces: https://developer.wordpress.org/apis/security/nonces/
- Rewrite rules: https://developer.wordpress.org/reference/functions/add_rewrite_rule/
- Activation/deactivation hooks: https://developer.wordpress.org/plugins/plugin-basics/activation-deactivation-hooks/
- Template include filter: https://developer.wordpress.org/reference/hooks/template_include/
- WordPress script enqueuing: https://developer.wordpress.org/plugins/javascript/enqueuing/
- TanStack Router: https://tanstack.com/router/latest/docs/overview
- TanStack file-based routing: https://tanstack.com/router/latest/docs/routing/file-based-routing
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/quick-start
- Tailwind CSS Vite: https://tailwindcss.com/docs/installation/using-vite
- shadcn/ui installation: https://ui.shadcn.com/docs/installation
- ReUI: https://reui.io/docs
- ReUI getting started: https://reui.io/docs/get-started
- Lucide React: https://lucide.dev/guide/react/
- NEAR Intents 1Click quote: https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote
- NEAR Intents status: https://docs.near-intents.org/api-reference/oneclick/check-swap-execution-status
- NEAR Intents quote signature verification: https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature
- Official 1Click TypeScript SDK source: https://github.com/defuse-protocol/one-click-sdk-typescript

---

## Appendix A. Required UI states checklist

Every data-driven page must define:

- Initial loading skeleton.
- Empty state with a meaningful next action.
- Populated state.
- Filtered-empty state.
- API/network error with retry.
- Permission-denied state.
- Record-not-found state.
- Stale-data/refresh affordance where relevant.
- Mobile layout.
- Keyboard and focus behaviour.

Every financial action must define:

- Pre-confirmation summary.
- Pending/submitting state.
- Success acknowledgement.
- Recoverable failure.
- Non-recoverable failure.
- Duplicate submission behaviour.
- Audit event.
- Permission/policy denial.

## Appendix B. Product language and status copy

Use plain business language first; technical chain details are secondary.

| Internal state | Customer/business wording |
|---|---|
| `PENDING_DEPOSIT` | Awaiting payment |
| `KNOWN_DEPOSIT_TX` | Payment detected |
| `INCOMPLETE_DEPOSIT` | Payment amount incomplete |
| `PROCESSING` | Settlement processing |
| `SUCCESS` | Successfully settled |
| `REFUNDED` | Payment refunded |
| `FAILED` | Settlement failed — review required |
| Unknown provider state | Status needs review |

Never show “Paid” for a quote, wallet connection or deposit detection.

## Appendix C. Hackathon demo checklist

1. Start from clean plugin activation and documented setup.
2. Open MATCHFLOW at a direct nested route and refresh to prove PHP SPA routing works.
3. Show an actual organization dashboard backed by stored data.
4. Show a customer invoice and public checkout.
5. Show supplier bill extraction and a three-way mismatch.
6. Correct the bill and show the deterministic match result.
7. Show business policy and approval.
8. Prepare and execute a small real supported NEAR Intents settlement.
9. Show the 1Click status history and destination transaction.
10. Show reconciliation and receipt.
11. Explicitly label any test fixture or simulated state.
12. Provide the repository, install steps and test results.
