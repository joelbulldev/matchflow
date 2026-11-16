<?php
/**
 * Org-wide in-app activity feed helpers.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Notifications;

defined('ABSPATH') || exit;

final class ActivityNotifier
{
    /**
     * @param array<string, mixed> $payload
     */
    public static function org(int $org_id, string $type, array $payload, ?int $user_id = null): void
    {
        if (empty($payload['message']) || !is_string($payload['message'])) {
            $payload['message'] = self::defaultMessage($type, $payload);
        }
        (new NotificationService())->notify($org_id, $user_id, $type, $payload);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private static function defaultMessage(string $type, array $payload): string
    {
        return match ($type) {
            'approval_submitted' => 'A new approval was submitted.',
            'approval_decided' => 'An approval decision was recorded.',
            'bill_created' => isset($payload['invoice_number'])
                ? "Bill {$payload['invoice_number']} was captured in the payables inbox."
                : 'A supplier bill was added to the inbox.',
            'bill_matched' => isset($payload['invoice_number'])
                ? "Three-way match ran for bill {$payload['invoice_number']}."
                : 'Three-way match completed for a bill.',
            'po_created' => isset($payload['po_number'])
                ? "Purchase order {$payload['po_number']} was issued."
                : 'A purchase order was created.',
            'grn_created' => 'A goods receipt was recorded against a PO.',
            'invoice_issued' => isset($payload['invoice_number'])
                ? "Invoice {$payload['invoice_number']} was issued with a live pay link."
                : 'An invoice was issued.',
            'invoice_voided' => 'An invoice was voided.',
            'settlement_started' => isset($payload['settlement_id'])
                ? "Settlement #{$payload['settlement_id']} is awaiting deposit."
                : 'A new settlement is awaiting deposit.',
            default => 'Activity recorded in MATCHFLOW.',
        };
    }
}
