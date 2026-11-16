<?php
/**
 * Registers health + bootstrap if BootstrapController fails to load (deploy safety).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST;

defined('ABSPATH') || exit;

use Matchflow\REST\Controllers\BootstrapController;

final class MatchflowBootstrap
{
    public static function register(string $ns): void
    {
        if (class_exists(BootstrapController::class)) {
            BootstrapController::register($ns);
            return;
        }

        register_rest_route(
            $ns,
            '/health',
            [
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => static function () {
                    return new \WP_REST_Response([
                        'success' => true,
                        'data' => [
                            'status' => 'ok',
                            'version' => MATCHFLOW_VERSION,
                            'schema' => get_option('matchflow_schema_version', '0'),
                        ],
                    ], 200);
                },
            ]
        );
    }
}
