# Plugin ZIP clean-install acceptance

## Build

```powershell
npm run build
npm run zip
# → dist/matchflow.zip
```

`scripts/build-plugin-zip.ps1` stages `matchflow.php`, `includes/`, `assets/`, `templates/`, `docs/`, `LICENSE`, etc. under `dist/matchflow/` and zips them. It excludes `node_modules`, `.git`, and test tooling.

## Clean stock WordPress acceptance checklist

1. Fresh WordPress 6.4+ (local, Docker, or host). No custom Nginx required.
2. Upload **Plugins → Add New → Upload** `dist/matchflow.zip` (or copy `dist/matchflow` into `wp-content/plugins/`).
3. Activate **MATCHFLOW**.
4. Confirm Settings → MATCHFLOW shows schema version and diagnostics (secrets redacted).
5. Open `/` or `/app/overview` — SPA shell loads (hashed assets from `assets/build`).
6. Deep-link `/app/receivables/invoices` — Matchflow shell, not theme 404.
7. `GET /api/v1/health` returns JSON success envelope.
8. Create org via onboarding; issue a draft invoice (no live SUCCESS required for ZIP gate).

Optional hardened proxy: [proxy/README.md](proxy/README.md) — not part of ZIP acceptance.
