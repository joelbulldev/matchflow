<?php
/**
 * Approvals API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Notifications\ActivityNotifier;
use Matchflow\Policies\PolicyEngine;
use Matchflow\REST\Response;
use Matchflow\Security\AuditLogger;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class ApprovalsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/approvals', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'approvals.read')),
                'callback' => [self::class, 'index'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.write')) || !is_wp_error(Auth::requireCapability($r, 'approvals.decide')),
                'callback' => [self::class, 'submit'],
            ],
        ]);
        register_rest_route($ns, '/approvals/(?P<id>\\d+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'approvals.read')),
            'callback' => [self::class, 'show'],
        ]);
        register_rest_route($ns, '/approvals/(?P<id>\\d+)/decide', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'approvals.decide')),
            'callback' => [self::class, 'decide'],
        ]);
    }

    public static function index(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $status = $request->get_param('status') ?: 'pending';
        $sql = 'SELECT * FROM ' . $wpdb->prefix . 'mf_approvals WHERE organization_id = %d';
        $args = [$org];
        if ($status !== 'all') {
            $sql .= ' AND status = %s';
            $args[] = $status;
        }
        $sql .= ' ORDER BY id DESC LIMIT 100';
        $rows = $wpdb->get_results($wpdb->prepare($sql, ...$args), ARRAY_A) ?: [];
        return Response::success($rows);
    }

    public static function show(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'mf_approvals WHERE organization_id = %d AND id = %d',
            $org,
            (int) $request['id']
        ), ARRAY_A);
        if (!$row) {
            return Response::error('matchflow_not_found', 'Not found.', 404);
        }
        $policy = (new PolicyEngine())->evaluate($org, [
            'purpose' => 'AP_SETTLEMENT',
            'requester_is_approver' => (int) $row['requested_by'] === get_current_user_id(),
            'amount_decimal' => '0',
        ]);
        $row['policy_checks'] = $policy['checks'];
        return Response::success($row);
    }

    public static function submit(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $body = $request->get_json_params() ?: [];
        $subject_type = sanitize_key((string) ($body['subject_type'] ?? 'ap_bill'));
        $subject_id = (int) ($body['subject_id'] ?? 0);
        if ($subject_id <= 0) {
            return Response::error('matchflow_invalid', 'subject_id required.', 400);
        }
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert($wpdb->prefix . 'mf_approvals', [
            'organization_id' => $org,
            'subject_type' => $subject_type,
            'subject_id' => $subject_id,
            'requested_by' => get_current_user_id(),
            'approver_id' => null,
            'status' => 'pending',
            'reason' => sanitize_textarea_field((string) ($body['reason'] ?? '')),
            'decided_at' => null,
            'created_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        if ($subject_type === 'ap_bill') {
            $wpdb->update($wpdb->prefix . 'mf_ap_bills', [
                'approval_status' => 'pending',
                'updated_at' => $now,
            ], ['id' => $subject_id, 'organization_id' => $org]);
        }
        AuditLogger::record($org, 'approval.submitted', $subject_type, $subject_id, null, ['approval_id' => $id]);
        ActivityNotifier::org($org, 'approval_submitted', [
            'approval_id' => $id,
            'subject_type' => $subject_type,
            'subject_id' => $subject_id,
            'message' => "Approval #{$id} submitted for {$subject_type} #{$subject_id}.",
        ], get_current_user_id());
        return Response::success(['id' => $id, 'status' => 'pending'], [], 201);
    }

    public static function decide(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'mf_approvals WHERE organization_id = %d AND id = %d',
            $org,
            (int) $request['id']
        ), ARRAY_A);
        if (!$row || $row['status'] !== 'pending') {
            return Response::error('matchflow_invalid_state', 'Approval not pending.', 409);
        }

        $body = $request->get_json_params() ?: [];
        $decision = sanitize_key((string) ($body['decision'] ?? ''));
        if (!in_array($decision, ['approve', 'reject', 'request_changes'], true)) {
            return Response::error('matchflow_invalid', 'decision must be approve|reject|request_changes.', 400);
        }

        $rules = (new PolicyEngine())->activeRules($org);
        if (!empty($rules['dual_control']) && (int) $row['requested_by'] === get_current_user_id()) {
            AuditLogger::record($org, 'approval.self_denied', (string) $row['subject_type'], (int) $row['subject_id']);
            return Response::error('matchflow_dual_control', 'Dual-control prevents self-approval.', 403);
        }

        $status = match ($decision) {
            'approve' => 'approved',
            'reject' => 'rejected',
            default => 'changes_requested',
        };
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->update($wpdb->prefix . 'mf_approvals', [
            'status' => $status,
            'approver_id' => get_current_user_id(),
            'reason' => sanitize_textarea_field((string) ($body['reason'] ?? $row['reason'])),
            'decided_at' => $now,
        ], ['id' => (int) $row['id']]);

        if ($row['subject_type'] === 'ap_bill') {
            $bill_status = $status === 'approved' ? 'approved' : ($status === 'rejected' ? 'rejected' : 'received');
            $wpdb->update($wpdb->prefix . 'mf_ap_bills', [
                'approval_status' => $status,
                'status' => $status === 'approved' ? 'ready_to_pay' : $bill_status,
                'updated_at' => $now,
            ], ['id' => (int) $row['subject_id'], 'organization_id' => $org]);
        }

        AuditLogger::record($org, 'approval.' . $status, (string) $row['subject_type'], (int) $row['subject_id'], null, [
            'approval_id' => (int) $row['id'],
            'reason' => $body['reason'] ?? null,
        ]);
        ActivityNotifier::org($org, 'approval_decided', [
            'approval_id' => (int) $row['id'],
            'decision' => $status,
            'subject_type' => $row['subject_type'],
            'subject_id' => (int) $row['subject_id'],
            'message' => "Approval #{$row['id']} was {$status}.",
        ], get_current_user_id());

        return self::show($request);
    }
}
