# Optional reverse-proxy allowlist

MATCHFLOW installs as a normal WordPress plugin. Clean ZIP acceptance does **not** require custom Nginx.

When you terminate TLS in front of Docker or a hardened host, use:

- [`docker/nginx/matchflow-proxy.conf`](../../docker/nginx/matchflow-proxy.conf) — sample TLS terminator + static asset caching + `/api/v1` proxy

Allowlist intent:

1. Serve hashed files under `wp-content/plugins/matchflow/assets/build/` as static (long cache).
2. Forward `/api/v1/*` with cookies and `X-WP-Nonce` intact.
3. Forward SPA routes so the plugin shell handles deep links.
4. Optionally block `/xmlrpc.php` at the edge.

Stock Apache in `docker-compose.yml` remains the default local path.
