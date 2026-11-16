<?php
/**
 * Serve SPA build files from /assets/matchflow/* (no wp-content URLs).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Frontend;

defined('ABSPATH') || exit;

final class AssetDelivery
{
    public const PUBLIC_PREFIX = 'assets/matchflow';

    public static function register(): void
    {
        add_filter('query_vars', static function (array $vars): array {
            $vars[] = 'matchflow_asset';
            return $vars;
        });
        add_action('parse_request', [self::class, 'maybeServeEarly'], 0);
        add_action('template_redirect', [self::class, 'maybeServe'], 0);
    }

    /** When rewrites fail but PHP still runs (some nginx stacks). */
    public static function maybeServeEarly(): void
    {
        if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
            return;
        }
        $rel = self::relativeFromRequestUri();
        if ($rel === '') {
            return;
        }
        self::serveRelative($rel);
    }

    public static function publicBaseUrl(): string
    {
        return home_url('/' . self::PUBLIC_PREFIX . '/');
    }

    public static function maybeServe(): void
    {
        $rel = get_query_var('matchflow_asset');
        if (!is_string($rel) || $rel === '') {
            $rel = self::relativeFromRequestUri();
        }
        if ($rel === '') {
            return;
        }
        self::serveRelative($rel);
    }

    private static function relativeFromRequestUri(): string
    {
        $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
        $path = wp_parse_url($uri, PHP_URL_PATH);
        if (!is_string($path) || $path === '') {
            return '';
        }
        $prefix = '/' . self::PUBLIC_PREFIX . '/';
        if (!str_starts_with($path, $prefix)) {
            return '';
        }
        return ltrim(substr($path, strlen($prefix)), '/');
    }

    private static function serveRelative(string $rel): void
    {
        $rel = str_replace('\\', '/', $rel);
        $rel = ltrim($rel, '/');

        if ($rel === 'app.js' || $rel === 'app.mjs') {
            $delivery = MATCHFLOW_PATH . 'assets/delivery/app.js';
            if (is_readable($delivery)) {
                self::streamPath($delivery, 'application/javascript', false);
            }
            $resolved = AssetManifest::entryJsRelative();
            if (!$resolved) {
                self::respondNotFound();
            }
            self::stream($resolved, self::mimeFor($resolved), false);
        }

        if ($rel === 'app.css') {
            $deliveryCss = MATCHFLOW_PATH . 'assets/delivery/app.css';
            if (is_readable($deliveryCss)) {
                self::streamPath($deliveryCss, 'text/css', false);
            }
            $css = AssetManifest::entryCssRelative();
            if ($css === []) {
                self::respondNotFound();
            }
            self::stream($css[0], 'text/css', false);
        }

        if (str_contains($rel, '..') || preg_match('#(^|/)\.#', $rel)) {
            self::respondNotFound();
        }

        // Vite lazy chunks: app.js lives at /assets/matchflow/app.js but chunks live under assets/*.js
        if (!str_contains($rel, '/') && preg_match('/\.(js|mjs|css)$/i', $rel)) {
            $nested = 'assets/' . $rel;
            if (self::assetExists($nested)) {
                $rel = $nested;
            }
        }

        self::stream($rel, self::mimeFor($rel), self::isHashedAsset($rel));
    }

    private static function assetExists(string $relative): bool
    {
        $relative = ltrim(str_replace('\\', '/', $relative), '/');
        foreach (
            [
                MATCHFLOW_PATH . 'assets/build/' . $relative,
                MATCHFLOW_PATH . 'assets/delivery/' . $relative,
                trailingslashit(ABSPATH) . self::PUBLIC_PREFIX . '/' . $relative,
            ] as $path
        ) {
            if (is_readable($path) && is_file($path)) {
                return true;
            }
        }
        return false;
    }

    private static function streamPath(string $path, string $mime, bool $immutable): void
    {
        if (!is_readable($path) || !is_file($path)) {
            self::respondNotFound();
        }

        status_header(200);
        header('Content-Type: ' . $mime . '; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        if ($immutable) {
            header('Cache-Control: public, max-age=31536000, immutable');
        } else {
            header('Cache-Control: public, max-age=0, must-revalidate');
            header('ETag: "' . md5($path . ':' . filemtime($path)) . '"');
        }

        if (str_ends_with($path, '.js') || str_ends_with($path, '.mjs')) {
            header('Service-Worker-Allowed: /');
        }

        readfile($path);
        exit;
    }

    private static function stream(string $relative, string $mime, bool $immutable): void
    {
        $path = MATCHFLOW_PATH . 'assets/build/' . $relative;
        if ((!is_readable($path) || !is_file($path)) && str_starts_with($relative, 'assets/')) {
            $alt = MATCHFLOW_PATH . 'assets/delivery/' . $relative;
            if (is_readable($alt) && is_file($alt)) {
                $path = $alt;
            }
        }
        if (!is_readable($path) || !is_file($path)) {
            $published = trailingslashit(ABSPATH) . self::PUBLIC_PREFIX . '/' . $relative;
            if (is_readable($published) && is_file($published)) {
                $path = $published;
            }
        }
        if (!is_readable($path) || !is_file($path)) {
            self::respondNotFound();
        }

        status_header(200);
        header('Content-Type: ' . $mime . '; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        if ($immutable) {
            header('Cache-Control: public, max-age=31536000, immutable');
        } else {
            header('Cache-Control: public, max-age=0, must-revalidate');
            header('ETag: "' . md5($relative . ':' . filemtime($path)) . '"');
        }

        if (str_ends_with($relative, '.js') || str_ends_with($relative, '.mjs')) {
            header('Service-Worker-Allowed: /');
        }

        readfile($path);
        exit;
    }

    private static function respondNotFound(): void
    {
        status_header(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Not found';
        exit;
    }

    private static function mimeFor(string $relative): string
    {
        $ext = strtolower(pathinfo($relative, PATHINFO_EXTENSION));
        return match ($ext) {
            'css' => 'text/css',
            'js', 'mjs' => 'application/javascript',
            'json' => 'application/json',
            'map' => 'application/json',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'woff2' => 'font/woff2',
            'woff' => 'font/woff',
            default => 'application/octet-stream',
        };
    }

    private static function isHashedAsset(string $relative): bool
    {
        return (bool) preg_match('/\.[a-f0-9]{6,12}\.(js|css|mjs)$/i', $relative);
    }
}
