<?php
/**
 * In-app notification feed for the SPA drawer.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Notifications\NotificationService;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class NotificationsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/notifications', [
            'methods' => 'GET',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'list'],
        ]);
        register_rest_route($ns, '/notifications/(?P<id>\d+)/read', [
            'methods' => 'POST',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'markRead'],
        ]);
        register_rest_route($ns, '/notifications/read-all', [
            'methods' => 'POST',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'markAllRead'],
        ]);
    }

    public static function list(WP_REST_Request $request)
    {
        $org_id = Auth::organizationId($request);
        if ($org_id <= 0) {
            return Response::success(['items' => [], 'unread' => 0]);
        }
        $user_id = get_current_user_id();
        $items = (new NotificationService())->listForUser($org_id, $user_id, 50);
        $mapped = array_map(static function (array $row): array {
            $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true);
            return [
                'id' => (int) $row['id'],
                'type' => (string) $row['type'],
                'title' => self::titleFor((string) $row['type'], is_array($payload) ? $payload : []),
                'body' => self::bodyFor((string) $row['type'], is_array($payload) ? $payload : []),
                'payload' => is_array($payload) ? $payload : [],
                'readAt' => $row['read_at'],
                'createdAt' => $row['created_at'],
            ];
        }, $items);
        $unread = count(array_filter($mapped, static fn(array $n) => empty($n['readAt'])));
        return Response::success(['items' => $mapped, 'unread' => $unread]);
    }

    public static function markRead(WP_REST_Request $request)
    {
        $org_id = Auth::organizationId($request);
        $id = (int) $request['id'];
        (new NotificationService())->markRead($org_id, get_current_user_id(), $id);
        return Response::success(['read' => true]);
    }

    public static function markAllRead(WP_REST_Request $request)
    {
        $org_id = Auth::organizationId($request);
        if ($org_id <= 0) {
            return Response::success(['read' => 0]);
        }
        $user_id = get_current_user_id();
        $service = new NotificationService();
        $items = $service->listForUser($org_id, $user_id, 100);
        $n = 0;
        foreach ($items as $row) {
            if (empty($row['read_at'])) {
                $service->markRead($org_id, $user_id, (int) $row['id']);
                $n++;
            }
        }
        return Response::success(['read' => $n]);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function titleFor(string $type, array $payload): string
    {
        return match ($type) {
            'settlement_success' => 'Settlement completed',
            'settlement_failed' => 'Settlement failed',
            'settlement_started' => 'Settlement started',
            'approval_requested', 'approval_submitted' => 'Approval needed',
            'approval_decided' => 'Approval updated',
            'invoice_issued' => 'Invoice issued',
            'invoice_voided' => 'Invoice voided',
            'invoice_reminder' => 'Payment reminder',
            'payment_request_created' => 'Payment link created',
            'payment_request_cancelled' => 'Payment link cancelled',
            'bill_created' => 'Bill captured',
            'bill_matched' => 'Match completed',
            'po_created' => 'PO issued',
            'grn_created' => 'Delivery recorded',
            default => ucwords(str_replace('_', ' ', $type)),
        };
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function bodyFor(string $type, array $payload): string
    {
        if (!empty($payload['message']) && is_string($payload['message'])) {
            return $payload['message'];
        }
        if (!empty($payload['settlement_id'])) {
            return 'Settlement #' . $payload['settlement_id'];
        }
        if (!empty($payload['subject']) && is_string($payload['subject'])) {
            return $payload['subject'];
        }
        return 'Open MATCHFLOW for details.';
    }
}
