<?php
/**
 * Counterparties API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class CounterpartiesController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/counterparties', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')) || !is_wp_error(Auth::requireCapability($r, 'ap.read')),
                'callback' => [self::class, 'index'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')) || !is_wp_error(Auth::requireCapability($r, 'ap.write')),
                'callback' => [self::class, 'create'],
            ],
        ]);
        register_rest_route($ns, '/counterparties/(?P<id>\\d+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')) || !is_wp_error(Auth::requireCapability($r, 'ap.read')),
            'callback' => [self::class, 'show'],
        ]);
        register_rest_route($ns, '/counterparties/(?P<id>\\d+)/addresses', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.write')),
            'callback' => [self::class, 'addAddress'],
        ]);
    }

    public static function index(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $type = $request->get_param('type');
        $sql = 'SELECT * FROM ' . $wpdb->prefix . 'mf_counterparties WHERE organization_id = %d';
        $params = [$org];
        if ($type) {
            $sql .= ' AND type = %s';
            $params[] = $type;
        }
        $sql .= ' ORDER BY name ASC';
        return Response::success($wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) ?: []);
    }

    public static function create(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $data = $request->get_json_params() ?: [];
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert($wpdb->prefix . 'mf_counterparties', [
            'organization_id' => $org,
            'type' => sanitize_text_field((string) ($data['type'] ?? 'customer')),
            'name' => sanitize_text_field((string) ($data['name'] ?? '')),
            'email' => sanitize_email((string) ($data['email'] ?? '')),
            'country' => sanitize_text_field((string) ($data['country'] ?? '')),
            'status' => 'active',
            'approved' => !empty($data['approved']) ? 1 : 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        return Response::success(self::find($org, $id), [], 201);
    }

    public static function show(WP_REST_Request $request)
    {
        $row = self::find(Auth::organizationId($request), (int) $request['id']);
        return $row ? Response::success($row) : Response::error('matchflow_not_found', 'Not found.', 404);
    }

    public static function addAddress(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $id = (int) $request['id'];
        $cp = self::find($org, $id);
        if (!$cp) {
            return Response::error('matchflow_not_found', 'Not found.', 404);
        }
        $data = $request->get_json_params() ?: [];
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert($wpdb->prefix . 'mf_counterparty_addresses', [
            'organization_id' => $org,
            'counterparty_id' => $id,
            'chain_id' => sanitize_text_field((string) ($data['chain_id'] ?? '')),
            'asset_id' => sanitize_text_field((string) ($data['asset_id'] ?? '')),
            'address' => sanitize_text_field((string) ($data['address'] ?? '')),
            'label' => sanitize_text_field((string) ($data['label'] ?? '')),
            'verified_at' => !empty($data['verified']) ? $now : null,
            'status' => !empty($data['verified']) ? 'verified' : 'pending',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        return Response::success(self::find($org, $id), [], 201);
    }

    private static function find(int $org, int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_counterparties WHERE organization_id = %d AND id = %d', $org, $id), ARRAY_A);
        if (!$row) {
            return null;
        }
        $row['addresses'] = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_counterparty_addresses WHERE counterparty_id = %d', $id), ARRAY_A) ?: [];
        return $row;
    }
}
