# MATCHFLOW hackathon production guide

Use this with `docs/deploy/production-checklist.md` and WordPress **Settings → MATCHFLOW**.

Official 1Click references:

- [1Click quickstart](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/introduction)
- [Authentication / API keys](https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication)
- Full doc index: [llms.txt](https://docs.near-intents.org/llms.txt)

## 1. Deploy the app

1. `npm run build` in `resources/app`, then `powershell -File scripts/build-plugin-zip.ps1`.
2. Upload `dist/matchflow.zip`, activate, load WP Admin once (migrations + cron).
3. On the server, install PHP deps for invoice + receipt PDFs (**required**): `cd wp-content/plugins/matchflow && composer install --no-dev` (installs `dompdf/dompdf` from `composer.json`). Verify: `php -r "require 'vendor/autoload.php'; echo class_exists('Dompdf\\Dompdf') ? 'ok' : 'missing';"`. The plugin zip may include `vendor/` when built with PHP/composer on the build machine; otherwise install on the server.
4. In **Settings → MATCHFLOW → NEAR Intents**, leave **Quote verification public key** empty unless 1Click rotates the manager key. Do **not** put your X-API-Key in that field (quotes will fail with `matchflow_invalid_quote_signature`).
5. Nginx: install `docs/deploy/aapanel-extension/matchflow-rest.conf`, flush permalinks.
6. Verify SPA assets load from **`/assets/matchflow/app.js`** and **`/assets/matchflow/app.css`** (not `wp-content/plugins/...`). After each deploy: open **WP Admin once** (publishes assets), **purge CDN/page cache**, hard-refresh pay link (Ctrl+Shift+R). Old checkout UI = stale `app.js`.
7. Verify `GET /api/v1/health` and `GET /api/v1/bootstrap` (authenticated).

### Asset URL conflicts (wp-content vs homepage 404)

If the browser still requests `wp-content/plugins/matchflow/assets/build/...`, the server is on an **older plugin build**. After **0.1.22+**:

- Scripts/styles must be **`https://matchflow.deepwhale.fun/assets/matchflow/app.js`** and **`app.css`** (manifest aliases).
- **Settings → Permalinks → Save** (flush rewrite rules for `/assets/matchflow/*`).
- Purge **full-page cache** for `/` (stale HTML can point at deleted hashed chunks like `index-DCsPfGDx.js` while `/faq` works).

Nginx must include **`location ^~ /assets/matchflow/`** (see `docs/deploy/aapanel-extension/matchflow-rest.conf`) so `.js` / `.css` are not caught by aaPanel’s static `try_files $uri =404` rule. After deploy, visit **WP Admin once** (publishes files to `{webroot}/assets/matchflow/`) or rely on PHP delivery via `index.php`.

## 2. NEAR Intents / 1Click (required for live quotes & settlement)

1Click is the execution layer MATCHFLOW uses for **firm quotes**, **deposit instructions**, and **status polling**. You describe the swap intent (assets, amount, recipient); 1Click quotes and routes settlement.

> **There is no testnet for NEAR Intents.** Use **mainnet** with **small amounts** for demo swaps. Plan your judge demo around real assets on supported chains ([chain support](https://docs.near-intents.org/resources/chain-support.md)).

### Why register as a partner?

Registering gets you a **Partner JWT** from the **Partner Dashboard** (not the same as end-user wallet login). That token is how 1Click knows you are an integrator, not anonymous traffic.

| Without partner auth | With partner JWT |
| --- | --- |
| Quotes still work but pay an extra **0.25% (25 bps)** platform fee on non-`ANY_INPUT` quotes | **Partner fee schedule** (docs cite ~20 bps; lower on stablecoin / same-asset multichain routes) |
| No distribution-channel attribution | Listed as your integration for support and limits |
| Fine for a one-off curl test | What you want for **MATCHFLOW in production and hackathon demos** |

**Main purpose of the partner form:** identify MATCHFLOW as a **distribution channel** (B2B treasury / invoice checkout), receive **authenticated API access**, and unlock the **partner fee tier** so payer quotes stay competitive. You are **not** custodying user funds in MATCHFLOW; you are **calling 1Click on behalf of payers and treasuries** with your backend credentials.

Typical fields to prepare before you apply (wording varies by dashboard):

- **Product name:** MATCHFLOW (or your deployed brand)
- **Use case:** Cross-chain AR/AP settlement for invoices and bills via NEAR Intents; quotes at checkout and treasury disbursement
- **Integration type:** Server-side API (WordPress plugin backend → `1click.chaindefuser.com`)
- **Website / demo URL:** e.g. `https://matchflow.deepwhale.fun`
- **Expected volume:** Hackathon / pilot; honest small numbers are fine
- **Contact email:** Operator who can receive the JWT

After approval, copy the **JWT token** from the Partner Dashboard. Treat it like a secret (password field, env var, never in git).

### How MATCHFLOW maps 1Click auth (WordPress admin)

MATCHFLOW’s PHP client (`OneClickClient`) calls:

- `GET /v0/tokens`
- `POST /v0/quote`
- `GET /v0/status`
- `POST /v0/deposit/submit`

Per [NEAR Intents authentication](https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication), the **same Partner JWT** is sent as:

- **`X-API-Key: <JWT>`** (preferred), or
- **`Authorization: Bearer <JWT>`**

**WP Admin → Settings → MATCHFLOW → NEAR Intents (1Click):**

| Admin field | What to paste | Notes |
| --- | --- | --- |
| **1Click API key (X-API-Key)** | Partner JWT from dashboard | **Recommended.** MATCHFLOW tries this header first. |
| **1Click JWT (Bearer)** | Same Partner JWT | Optional duplicate if you only fill Bearer; one field is enough. |
| **1Click API base URL** | `https://1click.chaindefuser.com` | Default in plugin; change only if NEAR gives another host. |
| **Quote verification public key** | 1Click manager **public** key (Ed25519) | Default built into plugin: `ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc` ([verify docs](https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature)). Used so payers only see quotes signed by 1Click. |
| **Signing key (legacy fallback)** | Same public key as above | Old field name only — **not** your Partner JWT and **not** a private key. Leave blank if you use the default or the quote verification field. |
| **NEAR network label** | `mainnet` | Intents execution is mainnet; label is for UI copy. |
| **NEAR RPC URL or dRPC key** | dRPC full URL or key segment | Example: `https://lb.drpc.live/near/YOUR_KEY` — passed to the NEAR wallet connector in the SPA. Env: `MATCHFLOW_NEAR_RPC_URL`. |

**Environment variables (optional, override WP options on server):**

- `MATCHFLOW_NEAR_INTENTS_API_KEY` — same value as Partner JWT (sent as `X-API-Key`)
- `MATCHFLOW_NEAR_INTENTS_JWT` — same JWT (sent as `Bearer`)
- `MATCHFLOW_NEAR_INTENTS_BASE_URL` — API base if non-default
- `MATCHFLOW_NEAR_RPC_URL` — NEAR JSON-RPC (full dRPC URL)
- `MATCHFLOW_1CLICK_PUBLIC_KEY` — override 1Click quote verification public key

You only need **one** of API key or JWT fields populated; filling both with the same token is harmless.

### Standard swap flow (what MATCHFLOW implements)

Matches [Making a request](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request):

1. **Query tokens** (`/v0/tokens`) — populate checkout asset picker.
2. **Request quote** (`/v0/quote`, often `dry: true` first for preview) — amount, origin/destination assets, recipient (treasury), refund address.
3. **Payer sends deposit** on origin chain per quote (wallet transaction).
4. **Track status** (`/v0/status`) — plugin cron + UI until SUCCESS / refund.
5. **Receipt** in MATCHFLOW — evidence timeline, reconciliation.

Flows you **do not** need for the hackathon core demo:

- **Confidential swaps** — privacy layer; needs User-Session tokens (`/v0/auth/authenticate`), not Partner JWT alone.
- **Signed intent execution** — off-chain signed intent instead of deposit; advanced.
- **Earn** — vault receipt token as destination; not used in invoice checkout today.

### Workspace-side (operators)

1. **Settings → Wallets:** treasury beneficiary addresses per asset/network (quote `recipient`).
2. **Settings → Settlement:** slippage and defaults.
3. **Settings → Checkout branding:** payer-facing copy.
4. **Profile:** link NEAR wallet for operator signing where the app requires it.

### Payer smoke test

1. Issue invoice → copy `/pay/{token}`.
2. Incognito checkout → pick origin asset → **Preview quote** (admin must have Partner JWT).
3. Connect wallet → pay exact quoted amount → wait for status → receipt.

### Treasury smoke test

1. Approve bill → settlement drawer → quote → confirm.
2. **Payments** + **Notifications** for pipeline state.
3. **Reconciliation → Unmatched** clears after allocation.

### Troubleshooting (from [Going live](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/going-live))

- Cross-chain can take **up to ~15 minutes**; use status polling, not instant UI assumption.
- **Exact amount** and correct **deposit address/memo** from the quote; otherwise refund.
- **Swap limits:** small quotes may be rejected per chain minimums ([swap limits](https://docs.near-intents.org/) — see current docs).
- Admin dashboard **NEAR Intents: Configured** should be green when JWT/API key is set.

## 3. Other platform secrets (non–1Click)

| WP Admin field | Purpose | Required for hackathon? |
| --- | --- | --- |
| **matchflow_ai_api_key** | Finance AI module (OpenAI-compatible chat over org data) | No — module toasts if missing |
| **SMTP** (host, user, password, …) | Invoice payment-link email, reminders | Yes for email demo; optional if judges only use copied links |
| **Demo user** | One-click **Login as demo user** (no password) | Optional — auto-provisioned |
| **Allow SPA registration** | Public signup | Recommended for judges |

**NEAR AI Cloud** is **not** required for MATCHFLOW’s Intents settlement path. It is a separate NEAR product; Finance AI in MATCHFLOW uses your own LLM API key, not NEAR AI Cloud by default.

## 4. Email & demo

See table in §3. Configure SMTP before promising “email me the invoice link” in the demo script.

## 5. Cron & background jobs

Confirm **Settlement cron** is **Scheduled** on the MATCHFLOW admin home. On production, trigger `wp-cron.php` from system cron so settlement status updates while judges watch the Payments hub.

## 6. Security checklist

- HTTPS only on production domain.
- Partner JWT only in WP options or server env — never in frontend bundle or git.
- Restrict WP admin; use org **owner** / **administrator** for settings.
- **Dual control** toggle if you demo approver ≠ payer wallets.

## 7. Judge walkthrough script (15 min)

**Marketing:** Home → Product → FAQ → Register / Open app.

**Onboarding:** Register → org → wallets → checkout branding.

**AR:** Customer → invoice → issue → pay link → (payer) quote + small mainnet payment if creds live.

**AP:** Supplier → PO → GRN → bill → match → approval → settle.

**Ops:** Overview → Payments → Reconciliation → Reports.

## 8. Known limits (say these out loud if asked)

- No Intents testnet — budget a few dollars of mainnet liquidity for demos.
- Unauthenticated 1Click calls work but cost **+25 bps**; always use Partner JWT in admin.
- Finance AI without `matchflow_ai_api_key` fails gracefully (toast).
- Confidential Intents user sessions are not implemented in MATCHFLOW v1.
