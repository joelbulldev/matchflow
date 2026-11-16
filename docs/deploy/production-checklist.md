# MATCHFLOW production deploy

## Plugin upload

1. From repo root: `powershell -File scripts/build-plugin-zip.ps1`
2. Upload `dist/matchflow.zip` to WordPress **Plugins → Add New → Upload**, or copy `dist/matchflow/` to `wp-content/plugins/matchflow/` **replacing the whole folder**.
3. Verify this file exists on the server:
   - `wp-content/plugins/matchflow/includes/REST/Controllers/BootstrapController.php`
4. Load WP Admin once (migrations + rewrite flush).
5. Upload fresh `assets/build/` from `npm run build`.

## API base URL (aaPanel / nginx)

The SPA calls **`/api/v1`** (nginx alias for namespace `matchflow/v1`). Do not use `wp-json` in the app.

1. Copy `docs/deploy/aapanel-extension/matchflow-rest.conf` into  
   `/www/server/panel/vhost/nginx/extension/matchflow.deepwhale.fun/`
2. Reload nginx.
3. WordPress **Settings → Permalinks → Post name** → Save.

Quick checks:

- `https://YOUR-SITE/wp-json/matchflow/v1/health` → JSON
- (optional) `https://YOUR-SITE/api/v1/health` → JSON after nginx snippet

## If `/api/v1/bootstrap` returns 500

PHP error `Class BootstrapController not found` means the plugin on disk is **incomplete**. Do not upload single files only — replace the full `matchflow` plugin directory or install from `dist/matchflow.zip`.

## Nginx `.well-known` log noise

Bots scan `/.well-known/*`, `stripe.txt`, etc. See `nginx-well-known.conf` for snippets that return 404 without `open() failed` errors.
