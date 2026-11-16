# aaPanel nginx for matchflow.deepwhale.fun

## `duplicate location "/"` fix

The file `include .../rewrite/matchflow.deepwhale.fun.conf` **already** contains WordPress `location / { try_files ... }`.

**Do not** add another `location /` in the main vhost — nginx will refuse to reload (`duplicate location "/"`).

## What to add

**Option A — extension snippet (recommended)**

Create **only one** of these (extension **or** main vhost — not both):

`/www/server/panel/vhost/nginx/extension/matchflow.deepwhale.fun/matchflow-rest.conf`

```nginx
location ^~ /api/v1/ {
    try_files $uri $uri/ /index.php$is_args$args;
}

location ^~ /assets/matchflow/ {
    try_files $uri $uri/ /index.php$is_args$args;
}
```

Without the **`/assets/matchflow/`** block, many aaPanel vhosts return **HTML 404** for `app.js` / `app.css` because a global `location ~ \.(js|css)$ { try_files $uri =404; }` runs before WordPress.

The plugin maps `/api/v1/*` → `matchflow/v1` in PHP (`RestAlias` + rewrite rules). No `rewrite … last` is required.

**Option B — main vhost only**

Add the same `location ^~ /api/v1/` block once in the server `{ }` block. Remove any duplicate from the extension folder.

## Remove broken rewrite (if present)

Delete this pattern if you added it earlier — on many aaPanel installs it never reaches PHP and returns the panel HTML 404 page:

```nginx
rewrite ^/api/v1/?(.*)$ /index.php?rest_route=/matchflow/v1/$1 last;
```

## Optional: JSON 404 from WordPress

If `fastcgi_intercept_errors` is on and `error_page 404 /404.html` is set, a missing REST route can look like a “site 404” instead of JSON. After routes work, `/api/v1/health` should return **200** + JSON. A bad path should return JSON `rest_no_route`, not HTML.

## Reload

```bash
nginx -t && nginx -s reload
```

`protocol options redefined` on other vhosts is a warning only (TLS 1.1/1.2 on multiple sites).

## Verify (in order)

1. `https://matchflow.deepwhale.fun/api/v1/health` → **200**, `Content-Type: application/json`, body includes `"status":"ok"`. Response headers should include `x-cache` / WordPress — **not** the aaPanel green-logo HTML 404.
2. `https://matchflow.deepwhale.fun/wp-json/matchflow/v1/health` → same JSON (optional alias).
3. WordPress **Settings → Permalinks → Post name → Save** (flush rewrite rules).
4. Plugin **MATCHFLOW 0.1.10+** with non-empty `includes/REST/Controllers/BootstrapController.php`.
5. WP Admin → Plugins → confirm **MATCHFLOW** is active.

If step 1 still shows aaPanel HTML 404: nginx change did not apply or `/api/v1/` is defined twice with conflicting rules.

If step 1 returns JSON `rest_no_route`: plugin inactive, incomplete upload, or PHP error — check `matchflow.deepwhale.fun.error.log` and re-upload `dist/matchflow.zip`.
