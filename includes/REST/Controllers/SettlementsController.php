<?php
/**
 * Settlements API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use Matchflow\Settlements\SettlementService;
use WP_REST_Request;

final class SettlementsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/settlements/quotes', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'payments.initiate')) || !is_wp_error(Auth::requireCapability($r, 'payments.prepare')),
            'callback' => [self::class, 'quote'],
        ]);
        register_rest_route($ns, '/settlements/(?P<id>\\d+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'payments.read')),
            'callback' => [self::class, 'show'],
        ]);
        register_rest_route($ns, '/settlements/(?P<id>\\d+)/confirm-deposit', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'payments.initiate')),
            'callback' => [self::class, 'confirm'],
        ]);
        register_rest_route($ns, '/settlements/(?P<id>\\d+)/refresh', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'payments.read')),
            'callback' => [self::class, 'refresh'],
        ]);
        register_rest_route($ns, '/payments', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'payments.read')),
            'callback' => [self::class, 'listPayments'],
        ]);
    }

    public static function quote(WP_REST_Request $request)
    {
        $body = $request->get_json_params() ?: [];
        $dry = array_key_exists('dry', $body) ? (bool) $body['dry'] : true;
        $result = (new SettlementService())->createQuote(Auth::organizationId($request), $body, $dry);
        return is_wp_error($result) ? $result : Response::success($result, [], $dry ? 200 : 201);
    }

    public static function show(WP_REST_Request $request)
    {
        $row = (new SettlementService())->find(Auth::organizationId($request), (int) $request['id']);
        return $row ? Response::success($row) : Response::error('matchflow_not_found', 'Not found.', 404);
    }

    public static function confirm(WP_REST_Request $request)
    {
        $body = $request->get_json_params() ?: [];
        $tx = (string) ($body['txHash'] ?? $request->get_param('txHash') ?? '');
        $near = (string) ($body['nearSenderAccount'] ?? $body['near_sender_account'] ?? '');
        $result = (new SettlementService())->confirmDeposit(
            Auth::organizationId($request),
            (int) $request['id'],
            $tx,
            $near !== '' ? $near : null
        );
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function refresh(WP_REST_Request $request)
    {
        $result = (new SettlementService())->refreshStatus(Auth::organizationId($request), (int) $request['id']);
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function listPayments(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $rows = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_settlements WHERE organization_id = %d ORDER BY id DESC LIMIT 100', $org), ARRAY_A) ?: [];
        return Response::success($rows);
    }
}
