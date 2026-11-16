<?php
/**
 * API response helpers.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST;

defined('ABSPATH') || exit;

use WP_Error;
use WP_REST_Response;

final class Response
{
    public static function success(mixed $data, array $meta = [], int $status = 200): WP_REST_Response
    {
        return new WP_REST_Response(
            [
                'success' => true,
                'data' => $data,
                'meta' => array_merge(
                    ['request_id' => self::requestId()],
                    $meta
                ),
            ],
            $status
        );
    }

    public static function error(string $code, string $message, int $status = 400, array $data = []): WP_Error
    {
        return new WP_Error(
            $code,
            $message,
            array_merge(['status' => $status, 'request_id' => self::requestId()], $data)
        );
    }

    private static function requestId(): string
    {
        return wp_generate_uuid4();
    }
}
