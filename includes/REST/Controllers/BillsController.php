<?php
/**
 * Payables bills API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;
use Matchflow\Notifications\ActivityNotifier;
use Matchflow\Payables\MatchingEngine;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class BillsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/payables/bills', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.read')),
                'callback' => [self::class, 'index'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.write')),
                'callback' => [self::class, 'create'],
            ],
        ]);
        register_rest_route($ns, '/payables/bills/(?P<id>\\d+)', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.read')),
                'callback' => [self::class, 'show'],
            ],
            [
                'methods' => 'PATCH',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.write')),
                'callback' => [self::class, 'update'],
            ],
        ]);
        register_rest_route($ns, '/payables/bills/(?P<id>\\d+)/match', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.write')),
            'callback' => [self::class, 'match'],
        ]);
        register_rest_route($ns, '/payables/bills/(?P<id>\\d+)/submit-approval', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.write')),
            'callback' => [self::class, 'submitApproval'],
        ]);
        register_rest_route($ns, '/payables/bills/(?P<id>\\d+)/approve', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'approvals.decide')),
            'callback' => [self::class, 'approve'],
        ]);
        register_rest_route($ns, '/payables/bills/(?P<id>\\d+)/reject', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'approvals.decide')),
            'callback' => [self::class, 'reject'],
        ]);
    }

    public static function index(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $rows = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bills WHERE organization_id = %d ORDER BY id DESC LIMIT 100', $org), ARRAY_A) ?: [];
        return Response::success($rows);
    }

    public static function create(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $data = $request->get_json_params() ?: [];
        $items = is_array($data['items'] ?? null) ? $data['items'] : [];
        $subtotal = '0';
        foreach ($items as $item) {
            $subtotal = Money::add($subtotal, Money::lineTotal((string) ($item['quantity'] ?? '0'), (string) ($item['unit_price'] ?? '0')));
        }
        $tax = Money::normalize((string) ($data['tax_decimal'] ?? '0'));
        $total = Money::add($subtotal, $tax);
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert($wpdb->prefix . 'mf_ap_bills', [
            'organization_id' => $org,
            'supplier_id' => (int) ($data['supplier_id'] ?? 0) ?: null,
            'invoice_number' => sanitize_text_field((string) ($data['invoice_number'] ?? '')),
            'currency' => sanitize_text_field((string) ($data['currency'] ?? 'USD')),
            'subtotal_decimal' => $subtotal,
            'tax_decimal' => $tax,
            'total_decimal' => $total,
            'amount_paid_decimal' => '0',
            'amount_outstanding_decimal' => $total,
            'invoice_date' => $data['invoice_date'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'status' => 'needs_review',
            'match_status' => 'pending',
            'approval_status' => 'not_required',
            'purchase_order_id' => (int) ($data['purchase_order_id'] ?? 0) ?: null,
            'created_by' => get_current_user_id(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        foreach (array_values($items) as $i => $item) {
            $qty = (string) ($item['quantity'] ?? '0');
            $price = (string) ($item['unit_price'] ?? '0');
            $wpdb->insert($wpdb->prefix . 'mf_ap_bill_items', [
                'bill_id' => $id,
                'description' => sanitize_text_field((string) ($item['description'] ?? '')),
                'normalized_item_key' => sanitize_title((string) ($item['description'] ?? '')),
                'quantity_decimal' => Money::normalize($qty),
                'unit_price_decimal' => Money::normalize($price),
                'tax_decimal' => Money::normalize((string) ($item['tax'] ?? '0')),
                'line_total_decimal' => Money::lineTotal($qty, $price, (string) ($item['tax'] ?? '0')),
                'sort_order' => $i,
            ]);
        }
        $bill = self::find($org, $id);
        ActivityNotifier::org($org, 'bill_created', [
            'bill_id' => $id,
            'invoice_number' => $bill['invoice_number'] ?? '',
            'message' => 'Bill ' . ($bill['invoice_number'] ?? "#{$id}") . ' added to the payables inbox.',
        ], get_current_user_id());
        return Response::success($bill, [], 201);
    }

    public static function show(WP_REST_Request $request)
    {
        $row = self::find(Auth::organizationId($request), (int) $request['id']);
        return $row ? Response::success($row) : Response::error('matchflow_not_found', 'Bill not found.', 404);
    }

    public static function update(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $id = (int) $request['id'];
        $bill = self::find($org, $id);
        if (!$bill) {
            return Response::error('matchflow_not_found', 'Bill not found.', 404);
        }
        $data = $request->get_json_params() ?: [];
        $items = is_array($data['items'] ?? null) ? $data['items'] : null;
        if ($items === null) {
            return Response::error('matchflow_invalid', 'items array required.', 400);
        }

        $subtotal = '0';
        foreach (array_values($items) as $i => $item) {
            $itemId = (int) ($item['id'] ?? 0);
            $qty = Money::normalize((string) ($item['quantity'] ?? $item['quantity_decimal'] ?? '0'));
            $price = Money::normalize((string) ($item['unit_price'] ?? $item['unit_price_decimal'] ?? '0'));
            $description = sanitize_text_field((string) ($item['description'] ?? ''));
            $line = Money::lineTotal($qty, $price, (string) ($item['tax'] ?? $item['tax_decimal'] ?? '0'));
            $subtotal = Money::add($subtotal, $line);
            if ($itemId > 0) {
                $wpdb->update($wpdb->prefix . 'mf_ap_bill_items', [
                    'description' => $description !== '' ? $description : null,
                    'normalized_item_key' => sanitize_title($description !== '' ? $description : 'line'),
                    'quantity_decimal' => $qty,
                    'unit_price_decimal' => $price,
                    'line_total_decimal' => $line,
                    'sort_order' => $i,
                ], ['id' => $itemId, 'bill_id' => $id]);
            }
        }

        $tax = Money::normalize((string) ($bill['tax_decimal'] ?? '0'));
        $total = Money::add($subtotal, $tax);
        $paid = Money::normalize((string) ($bill['amount_paid_decimal'] ?? '0'));
        $outstanding = Money::sub($total, $paid);
        $wpdb->update($wpdb->prefix . 'mf_ap_bills', [
            'subtotal_decimal' => $subtotal,
            'total_decimal' => $total,
            'amount_outstanding_decimal' => Money::cmp($outstanding, '0') < 0 ? '0' : $outstanding,
            'match_status' => 'pending',
            'status' => 'needs_review',
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id, 'organization_id' => $org]);

        return Response::success(self::find($org, $id));
    }

    public static function match(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $billId = (int) $request['id'];
        $bill = self::find($org, $billId);
        $result = (new MatchingEngine())->run($org, $billId);
        ActivityNotifier::org($org, 'bill_matched', [
            'bill_id' => $billId,
            'invoice_number' => $bill['invoice_number'] ?? '',
            'match_status' => $result['match_status'] ?? ($bill['match_status'] ?? ''),
            'message' => isset($bill['invoice_number'])
                ? "Three-way match ran for bill {$bill['invoice_number']}."
                : "Three-way match ran for bill #{$billId}.",
        ], get_current_user_id());
        return Response::success($result);
    }

    public static function submitApproval(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $id = (int) $request['id'];
        $bill = self::find($org, $id);
        if (!$bill) {
            return Response::error('matchflow_not_found', 'Bill not found.', 404);
        }
        if (($bill['match_status'] ?? '') === 'exception') {
            return Response::error('matchflow_match_failed', 'Resolve matching exceptions before approval.', 409);
        }
        $wpdb->insert($wpdb->prefix . 'mf_approvals', [
            'organization_id' => $org,
            'subject_type' => 'ap_bill',
            'subject_id' => $id,
            'requested_by' => get_current_user_id(),
            'status' => 'pending',
            'created_at' => gmdate('Y-m-d H:i:s'),
        ]);
        $wpdb->update($wpdb->prefix . 'mf_ap_bills', [
            'approval_status' => 'pending',
            'status' => 'pending_approval',
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id]);
        ActivityNotifier::org($org, 'approval_submitted', [
            'subject_type' => 'ap_bill',
            'subject_id' => $id,
            'invoice_number' => $bill['invoice_number'] ?? '',
            'message' => 'Bill ' . ($bill['invoice_number'] ?? "#{$id}") . ' was submitted for approval.',
        ], get_current_user_id());
        return Response::success(self::find($org, $id));
    }

    public static function approve(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $id = (int) $request['id'];
        $bill = self::find($org, $id);
        if (!$bill) {
            return Response::error('matchflow_not_found', 'Bill not found.', 404);
        }
        if ((int) $bill['created_by'] === get_current_user_id()) {
            // Dual-control default: creator cannot approve own bill.
            $policy = get_option('matchflow_require_dual_control', true);
            if ($policy) {
                return Response::error('matchflow_dual_control', 'Creator cannot approve their own bill.', 403);
            }
        }
        if (($bill['match_status'] ?? '') === 'exception') {
            return Response::error('matchflow_match_failed', 'Cannot approve unmatched bill.', 409);
        }
        $wpdb->update($wpdb->prefix . 'mf_approvals', [
            'approver_id' => get_current_user_id(),
            'status' => 'approved',
            'decided_at' => gmdate('Y-m-d H:i:s'),
        ], ['organization_id' => $org, 'subject_type' => 'ap_bill', 'subject_id' => $id, 'status' => 'pending']);
        $wpdb->update($wpdb->prefix . 'mf_ap_bills', [
            'approval_status' => 'approved',
            'status' => 'ready_to_pay',
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id]);
        return Response::success(self::find($org, $id));
    }

    public static function reject(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $id = (int) $request['id'];
        $reason = sanitize_text_field((string) ($request->get_param('reason') ?? ''));
        $wpdb->update($wpdb->prefix . 'mf_approvals', [
            'approver_id' => get_current_user_id(),
            'status' => 'rejected',
            'reason' => $reason,
            'decided_at' => gmdate('Y-m-d H:i:s'),
        ], ['organization_id' => $org, 'subject_type' => 'ap_bill', 'subject_id' => $id, 'status' => 'pending']);
        $wpdb->update($wpdb->prefix . 'mf_ap_bills', [
            'approval_status' => 'rejected',
            'status' => 'rejected',
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id]);
        return Response::success(self::find($org, $id));
    }

    private static function find(int $org, int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bills WHERE organization_id = %d AND id = %d', $org, $id), ARRAY_A);
        if (!$row) {
            return null;
        }
        $row['items'] = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bill_items WHERE bill_id = %d ORDER BY sort_order', $id), ARRAY_A) ?: [];
        $row['match_runs'] = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_match_runs WHERE bill_id = %d ORDER BY id DESC', $id), ARRAY_A) ?: [];
        $row['documents'] = $wpdb->get_results($wpdb->prepare(
            'SELECT id, original_name, mime_type, size_bytes, sha256, extraction_status, created_at FROM ' . $wpdb->prefix . 'mf_documents WHERE organization_id = %d AND owner_type = %s AND owner_id = %d ORDER BY id DESC',
            $org,
            'ap_bill',
            $id
        ), ARRAY_A) ?: [];
        return $row;
    }
}
