<?php
/**
 * Procurement API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;
use Matchflow\Notifications\ActivityNotifier;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class ProcurementController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/procurement/purchase-orders', [
            ['methods' => 'GET', 'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'procurement.read')), 'callback' => [self::class, 'listPo']],
            ['methods' => 'POST', 'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'procurement.write')), 'callback' => [self::class, 'createPo']],
        ]);
        register_rest_route($ns, '/procurement/purchase-orders/(?P<id>\\d+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'procurement.read')),
            'callback' => [self::class, 'showPo'],
        ]);
        register_rest_route($ns, '/procurement/goods-receipts', [
            ['methods' => 'GET', 'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'procurement.read')), 'callback' => [self::class, 'listGrn']],
            ['methods' => 'POST', 'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'procurement.write')), 'callback' => [self::class, 'createGrn']],
        ]);
        register_rest_route($ns, '/procurement/goods-receipts/(?P<id>\\d+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'procurement.read')),
            'callback' => [self::class, 'showGrn'],
        ]);
    }

    public static function listPo(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        return Response::success($wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_purchase_orders WHERE organization_id = %d ORDER BY id DESC', $org), ARRAY_A) ?: []);
    }

    public static function createPo(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $data = $request->get_json_params() ?: [];
        $items = is_array($data['items'] ?? null) ? $data['items'] : [];
        $total = '0';
        foreach ($items as $item) {
            $total = Money::add($total, Money::mul((string) ($item['quantity'] ?? '0'), (string) ($item['unit_price'] ?? '0')));
        }
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert($wpdb->prefix . 'mf_purchase_orders', [
            'organization_id' => $org,
            'supplier_id' => (int) ($data['supplier_id'] ?? 0),
            'po_number' => sanitize_text_field((string) ($data['po_number'] ?? 'PO-' . time())),
            'currency' => sanitize_text_field((string) ($data['currency'] ?? 'USD')),
            'total_decimal' => $total,
            'expected_date' => $data['expected_date'] ?? null,
            'status' => 'issued',
            'created_by' => get_current_user_id(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        foreach (array_values($items) as $i => $item) {
            $qty = (string) ($item['quantity'] ?? '0');
            $price = (string) ($item['unit_price'] ?? '0');
            $wpdb->insert($wpdb->prefix . 'mf_purchase_order_items', [
                'po_id' => $id,
                'description' => sanitize_text_field((string) ($item['description'] ?? '')),
                'normalized_item_key' => sanitize_title((string) ($item['description'] ?? '')),
                'ordered_quantity_decimal' => Money::normalize($qty),
                'unit_price_decimal' => Money::normalize($price),
                'price_tolerance_bps' => (int) ($item['price_tolerance_bps'] ?? 0),
                'line_total_decimal' => Money::mul($qty, $price),
                'sort_order' => $i,
            ]);
        }
        $po = self::po($org, $id);
        ActivityNotifier::org($org, 'po_created', [
            'po_id' => $id,
            'po_number' => $po['po_number'] ?? '',
            'message' => 'Purchase order ' . ($po['po_number'] ?? "#{$id}") . ' was issued.',
        ], get_current_user_id());
        return Response::success($po, [], 201);
    }

    public static function showPo(WP_REST_Request $request)
    {
        $row = self::po(Auth::organizationId($request), (int) $request['id']);
        return $row ? Response::success($row) : Response::error('matchflow_not_found', 'PO not found.', 404);
    }

    public static function listGrn(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        return Response::success($wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_goods_receipts WHERE organization_id = %d ORDER BY id DESC', $org), ARRAY_A) ?: []);
    }

    public static function createGrn(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $data = $request->get_json_params() ?: [];
        $po_id = (int) ($data['po_id'] ?? 0);
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert($wpdb->prefix . 'mf_goods_receipts', [
            'organization_id' => $org,
            'po_id' => $po_id,
            'receipt_reference' => sanitize_text_field((string) ($data['receipt_reference'] ?? '')),
            'received_at' => $data['received_at'] ?? $now,
            'status' => 'recorded',
            'created_by' => get_current_user_id(),
            'created_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        foreach ((array) ($data['items'] ?? []) as $item) {
            $wpdb->insert($wpdb->prefix . 'mf_goods_receipt_items', [
                'receipt_id' => $id,
                'po_item_id' => (int) ($item['po_item_id'] ?? 0),
                'received_quantity_decimal' => Money::normalize((string) ($item['received_quantity'] ?? '0')),
                'notes' => sanitize_text_field((string) ($item['notes'] ?? '')),
            ]);
        }
        $wpdb->update($wpdb->prefix . 'mf_purchase_orders', ['status' => 'partially_received', 'updated_at' => $now], ['id' => $po_id, 'organization_id' => $org]);
        ActivityNotifier::org($org, 'grn_created', [
            'receipt_id' => $id,
            'po_id' => $po_id,
            'message' => "Goods receipt #{$id} recorded against PO #{$po_id}.",
        ], get_current_user_id());
        return Response::success(['id' => $id, 'po_id' => $po_id], [], 201);
    }

    public static function showGrn(WP_REST_Request $request)
    {
        $row = self::grn(Auth::organizationId($request), (int) $request['id']);
        return $row ? Response::success($row) : Response::error('matchflow_not_found', 'Goods receipt not found.', 404);
    }

    private static function grn(int $org, int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'mf_goods_receipts WHERE organization_id = %d AND id = %d',
            $org,
            $id
        ), ARRAY_A);
        if (!$row) {
            return null;
        }
        $row['items'] = $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'mf_goods_receipt_items WHERE receipt_id = %d ORDER BY id',
            $id
        ), ARRAY_A) ?: [];
        $poId = (int) ($row['po_id'] ?? 0);
        if ($poId > 0) {
            $row['purchase_order'] = self::po($org, $poId);
        }
        return $row;
    }

    private static function po(int $org, int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_purchase_orders WHERE organization_id = %d AND id = %d', $org, $id), ARRAY_A);
        if (!$row) {
            return null;
        }
        $row['items'] = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_purchase_order_items WHERE po_id = %d ORDER BY sort_order', $id), ARRAY_A) ?: [];
        return $row;
    }
}
