<?php
/**
 * AR/AP rollups — open obligations only (void/cancelled/draft excluded).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Domain;

defined('ABSPATH') || exit;

final class FinanceAggregate
{
    /** @var list<string> */
    public const AR_OPEN_STATUSES = ['issued', 'partially_paid', 'overdue'];

    /** @var list<string> */
    public const AP_OPEN_STATUSES = ['approved', 'ready_to_pay', 'matched', 'partially_paid'];

    /**
     * @return array{receivablesOutstanding: string, payablesOutstanding: string, collected: string, paid: string}
     */
    public static function summary(int $org, ?string $collectedSinceUtc = null, ?string $paidSinceUtc = null): array
    {
        global $wpdb;
        $arOpen = "'" . implode("','", array_map('esc_sql', self::AR_OPEN_STATUSES)) . "'";
        $apOpen = "'" . implode("','", array_map('esc_sql', self::AP_OPEN_STATUSES)) . "'";

        $receivables = (string) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(CAST(amount_outstanding_decimal AS DECIMAL(36,8))), 0)
             FROM {$wpdb->prefix}mf_ar_invoices
             WHERE organization_id = %d AND status IN ({$arOpen})",
            $org
        ));
        $payables = (string) $wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(CAST(amount_outstanding_decimal AS DECIMAL(36,8))), 0)
             FROM {$wpdb->prefix}mf_ap_bills
             WHERE organization_id = %d AND status IN ({$apOpen})",
            $org
        ));

        $collectedSql = "SELECT COALESCE(SUM(CAST(amount_paid_decimal AS DECIMAL(36,8))), 0)
             FROM {$wpdb->prefix}mf_ar_invoices
             WHERE organization_id = %d AND status NOT IN ('void','cancelled','draft')";
        $collectedParams = [$org];
        if ($collectedSinceUtc !== null) {
            $collectedSql .= ' AND updated_at >= %s';
            $collectedParams[] = $collectedSinceUtc;
        }
        $collected = (string) $wpdb->get_var($wpdb->prepare($collectedSql, $collectedParams));

        $paidSql = "SELECT COALESCE(SUM(CAST(amount_paid_decimal AS DECIMAL(36,8))), 0)
             FROM {$wpdb->prefix}mf_ap_bills
             WHERE organization_id = %d AND status NOT IN ('void','cancelled','draft')";
        $paidParams = [$org];
        if ($paidSinceUtc !== null) {
            $paidSql .= ' AND updated_at >= %s';
            $paidParams[] = $paidSinceUtc;
        }
        $paid = (string) $wpdb->get_var($wpdb->prepare($paidSql, $paidParams));

        return [
            'receivablesOutstanding' => Money::normalize($receivables, 8),
            'payablesOutstanding' => Money::normalize($payables, 8),
            'collected' => Money::normalize($collected, 8),
            'paid' => Money::normalize($paid, 8),
        ];
    }
}