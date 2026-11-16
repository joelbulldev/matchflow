<?php
/**
 * Runtime requirements.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Core;

defined('ABSPATH') || exit;

final class Requirements
{
    public static function check(): array
    {
        $errors = [];

        if (version_compare(PHP_VERSION, '8.1.0', '<')) {
            $errors[] = 'PHP 8.1 or higher is required.';
        }
        if (!extension_loaded('bcmath')) {
            $errors[] = 'The BCMath PHP extension is required for financial calculations.';
        }
        if (!extension_loaded('sodium')) {
            $errors[] = 'The Sodium PHP extension is required for quote/status signature verification.';
        }
        if (!function_exists('curl_init') && !function_exists('wp_remote_request')) {
            $errors[] = 'HTTP client support (cURL or WordPress HTTP API) is required.';
        }
        if (!extension_loaded('fileinfo')) {
            $errors[] = 'The Fileinfo PHP extension is required for document uploads.';
        }

        return $errors;
    }

    public static function assertOrAdminNotice(): void
    {
        $errors = self::check();
        if ($errors === []) {
            return;
        }

        add_action(
            'admin_notices',
            static function () use ($errors): void {
                echo '<div class="notice notice-error"><p><strong>MATCHFLOW:</strong> ';
                echo esc_html(implode(' ', $errors));
                echo '</p></div>';
            }
        );
    }
}
