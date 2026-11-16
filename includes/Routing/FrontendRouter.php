<?php
/**
 * SPA frontend takeover via template_include (history routing).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Routing;

defined('ABSPATH') || exit;

use Matchflow\Frontend\Assets;

final class FrontendRouter
{
    public static function register(): void
    {
        add_filter('template_include', [self::class, 'templateInclude'], 99);
        add_action('redirect_canonical', [self::class, 'disableCanonical'], 10, 2);
        add_action('template_redirect', [self::class, 'prepareTakeover'], 0);
        add_action('send_headers', [self::class, 'documentCacheHeaders']);
    }

    public static function documentCacheHeaders(): void
    {
        if (!self::shouldTakeOver()) {
            return;
        }
        if (headers_sent()) {
            return;
        }
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
    }

    public static function shouldTakeOver(): bool
    {
        if (is_admin() || wp_doing_ajax() || wp_doing_cron() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return false;
        }

        $uri = self::requestPath();
        if (self::isTechnicalPath($uri)) {
            return false;
        }

        $mode = get_option('matchflow_takeover_mode', 'full');
        if ($mode === 'full') {
            return true;
        }

        return (bool) get_query_var('matchflow_app') || self::isMatchflowPath($uri);
    }

    public static function prepareTakeover(): void
    {
        if (!self::shouldTakeOver()) {
            return;
        }

        add_filter('show_admin_bar', '__return_false', 99);
        show_admin_bar(false);

        remove_action('wp_head', 'wp_generator');
        remove_action('wp_head', 'wlwmanifest_link');
        remove_action('wp_head', 'rsd_link');
        remove_action('wp_head', 'wp_shortlink_wp_head', 10);
        remove_action('wp_head', 'adjacent_posts_rel_link_wp_head', 10);
        remove_action('wp_head', 'print_emoji_detection_script', 7);
        remove_action('wp_print_styles', 'print_emoji_styles');
        remove_action('wp_head', 'rest_output_link_wp_head', 10);
        remove_action('wp_head', 'wp_oembed_add_discovery_links');
        remove_action('template_redirect', 'rest_output_link_header', 11);
    }

    public static function templateInclude(string $template): string
    {
        if (!self::shouldTakeOver()) {
            return $template;
        }

        Assets::enqueue();
        $shell = MATCHFLOW_PATH . 'templates/frontend-shell.php';
        return is_readable($shell) ? $shell : $template;
    }

    public static function disableCanonical(?string $redirect, string $requested): ?string
    {
        if (self::shouldTakeOver()) {
            return $requested;
        }
        return $redirect;
    }

    private static function requestPath(): string
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = (string) wp_parse_url($uri, PHP_URL_PATH);
        $home_path = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
        if ($home_path && $home_path !== '/' && str_starts_with($path, $home_path)) {
            $path = substr($path, strlen(rtrim($home_path, '/'))) ?: '/';
        }
        return $path === '' ? '/' : $path;
    }

    private static function isMatchflowPath(string $path): bool
    {
        $prefixes = [
            '/',
            '/app',
            '/faq',
            '/product',
            '/security',
            '/pay',
            '/receipt',
            '/supplier',
            '/overview',
            '/receivables',
            '/payables',
            '/procurement',
            '/approvals',
            '/payments',
            '/reconciliation',
            '/finance-ai',
            '/reports',
            '/settings',
            '/login',
            '/register',
            '/forgot-password',
            '/reset-password',
            '/onboarding',
        ];
        foreach ($prefixes as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                return true;
            }
        }
        return false;
    }

    private static function isTechnicalPath(string $path): bool
    {
        $blocked = [
            '/api/v1',
            '/assets/matchflow',
            '/wp-admin',
            '/wp-json',
            '/wp-content',
            '/wp-includes',
            '/wp-login.php',
            '/wp-cron.php',
            '/xmlrpc.php',
            '/wp-admin/admin-ajax.php',
        ];
        foreach ($blocked as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                return true;
            }
        }
        return false;
    }
}
