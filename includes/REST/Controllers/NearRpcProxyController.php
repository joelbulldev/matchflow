<?php
/**
 * Proxies NEAR JSON-RPC so dRPC keys never ship to the browser.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

use Matchflow\Near\NearRpc;
use Matchflow\REST\Response;
use WP_REST_Request;
use WP_REST_Response;

defined('ABSPATH') || exit;

final class NearRpcProxyController
{
    private const MAX_BODY_BYTES = 65536;

    public static function register(string $ns): void
    {
        register_rest_route(
            $ns,
            '/near-rpc',
            [
                'methods' => 'POST',
                'permission_callback' => '__return_true',
                'callback' => [self::class, 'proxy'],
            ]
        );
    }

    public static function proxy(WP_REST_Request $request): WP_REST_Response|\WP_Error
    {
        $body = (string) $request->get_body();
        if ($body === '') {
            return Response::error('matchflow_invalid', 'Empty JSON-RPC body.', 400);
        }
        if (strlen($body) > self::MAX_BODY_BYTES) {
            return Response::error('matchflow_invalid', 'JSON-RPC payload too large.', 413);
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            return Response::error('matchflow_invalid', 'Body must be JSON.', 400);
        }

        $method = isset($decoded['method']) ? (string) $decoded['method'] : '';
        if ($method === '' || !preg_match('/^[a-z_][a-z0-9_]*$/i', $method)) {
            return Response::error('matchflow_invalid', 'Invalid JSON-RPC method.', 400);
        }

        $upstream = NearRpc::resolveUrl();
        $response = wp_remote_post(
            $upstream,
            [
                'timeout' => 45,
                'headers' => [
                    'Content-Type' => 'application/json',
                ],
                'body' => $body,
            ]
        );

        if (is_wp_error($response)) {
            return Response::error('matchflow_rpc_unavailable', 'NEAR RPC upstream unreachable.', 502);
        }

        $status = (int) wp_remote_retrieve_response_code($response);
        $raw = (string) wp_remote_retrieve_body($response);
        $json = json_decode($raw, true);

        if (!is_array($json)) {
            return new WP_REST_Response([
                'jsonrpc' => '2.0',
                'error' => ['code' => -32603, 'message' => 'Invalid upstream response'],
                'id' => $decoded['id'] ?? null,
            ], $status > 0 ? $status : 502);
        }

        return new WP_REST_Response($json, $status > 0 ? $status : 200);
    }
}
