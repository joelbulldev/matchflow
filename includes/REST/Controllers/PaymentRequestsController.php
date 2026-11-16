<?php
/**
 * Standalone payment request API (no invoice).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Receivables\PaymentRequestService;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class PaymentRequestsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/receivables/payment-requests', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'index'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')),
                'callback' => [self::class, 'create'],
            ],
        ]);
        register_rest_route($ns, '/receivables/payment-requests/(?P<id>\\d+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
            'callback' => [self::class, 'show'],
        ]);
        register_rest_route($ns, '/receivables/payment-requests/(?P<id>\\d+)/cancel', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')),
            'callback' => [self::class, 'cancel'],
        ]);
    }

    public static function index(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $service = new PaymentRequestService();
        $args = [
            'status' => $request->get_param('status'),
            'q' => $request->get_param('q'),
            'limit' => (int) ($request->get_param('limit') ?: 50),
            'offset' => (int) ($request->get_param('offset') ?: 0),
        ];
        return Response::success([
            'items' => $service->list($org, $args),
            'total' => $service->count($org, $args),
            'limit' => $args['limit'],
            'offset' => $args['offset'],
        ]);
    }

    public static function create(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $body = $request->get_json_params() ?: [];
        $created = (new PaymentRequestService())->create($org, get_current_user_id(), $body);
        if ($created === []) {
            return Response::error('matchflow_invalid', 'amount_decimal must be greater than zero.', 400);
        }
        return Response::success($created, [], 201);
    }

    public static function show(WP_REST_Request $request)
    {
        $row = (new PaymentRequestService())->find(Auth::organizationId($request), (int) $request['id']);
        return $row ? Response::success($row) : Response::error('matchflow_not_found', 'Payment request not found.', 404);
    }

    public static function cancel(WP_REST_Request $request)
    {
        $row = (new PaymentRequestService())->cancel(Auth::organizationId($request), (int) $request['id']);
        return $row ? Response::success($row) : Response::error('matchflow_invalid_state', 'Payment request cannot be cancelled.', 409);
    }
}
