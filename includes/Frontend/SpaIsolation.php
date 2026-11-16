<?php
/**
 * Prevent the active WordPress theme from injecting CSS/JS into the Matchflow SPA shell.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Frontend;

defined('ABSPATH') || exit;

use Matchflow\Routing\FrontendRouter;

final class SpaIsolation
{
    public static function register(): void
    {
        add_action('wp_enqueue_scripts', [self::class, 'stripForeignAssets'], 9999);
        add_action('wp_print_styles', [self::class, 'stripForeignAssets'], 9999);
        add_filter('show_admin_bar', [self::class, 'hideAdminBar'], 999);
        add_filter('body_class', [self::class, 'bodyClass'], 20);
    }

    public static function stripForeignAssets(): void
    {
        if (!self::servesSpa()) {
            return;
        }

        global $wp_styles, $wp_scripts;

        if ($wp_styles instanceof \WP_Styles) {
            foreach ((array) $wp_styles->queue as $handle) {
                if (!self::keepStyleHandle((string) $handle)) {
                    wp_dequeue_style($handle);
                }
            }
        }

        if ($wp_scripts instanceof \WP_Scripts) {
            foreach ((array) $wp_scripts->queue as $handle) {
                if (!self::keepScriptHandle((string) $handle)) {
                    wp_dequeue_script($handle);
                }
            }
        }
    }

    public static function hideAdminBar(bool $show): bool
    {
        return self::servesSpa() ? false : $show;
    }

    /**
     * @param list<string> $classes
     * @return list<string>
     */
    public static function bodyClass(array $classes): array
    {
        if (self::servesSpa()) {
            $classes[] = 'matchflow-app';
            $classes[] = 'mf-theme-isolated';
        }
        return $classes;
    }

    private static function servesSpa(): bool
    {
        if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
            return false;
        }
        if ((defined('REST_REQUEST') && REST_REQUEST) || (defined('XMLRPC_REQUEST') && XMLRPC_REQUEST)) {
            return false;
        }
        return FrontendRouter::shouldTakeOver();
    }

    private static function keepStyleHandle(string $handle): bool
    {
        return str_starts_with($handle, 'matchflow');
    }

    private static function keepScriptHandle(string $handle): bool
    {
        return str_starts_with($handle, 'matchflow');
    }
}
