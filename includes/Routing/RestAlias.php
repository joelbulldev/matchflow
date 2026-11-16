<?php
/**
 * Bind /api/v1/* to WordPress REST when the request reaches PHP (nginx try_files → index.php).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Routing;

defined('ABSPATH') || exit;

final class RestAlias
{
    public static function register(): void
    {
        add_action('init', [self::class, 'bindFromRequestUri'], 0);
    }

    public static function bindFromRequestUri(): void
    {
        if (is_admin() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }
        if (!empty($_GET['rest_route'])) {
            return;
        }

        $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $home_path = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
        if ($home_path && $home_path !== '/' && str_starts_with($path, $home_path)) {
            $path = substr($path, strlen(rtrim($home_path, '/'))) ?: '/';
        }

        if (!preg_match('#^/api/v1/?(.*)$#', $path, $m)) {
            return;
        }

        $tail = trim((string) ($m[1] ?? ''), '/');
        $_GET['rest_route'] = '/matchflow/v1' . ($tail !== '' ? '/' . $tail : '');
        $_REQUEST['rest_route'] = $_GET['rest_route'];
    }
}
