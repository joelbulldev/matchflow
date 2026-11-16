<?php
/**
 * Settlement-to-obligation reconciliation helpers.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Ledger;

defined('ABSPATH') || exit;

final class ReconciliationService
{
    /**
     * @return array{matched:list<array>,unmatched:list<array>,exceptions:list<array>}
     */
    public function dashboard(int $org_id): array
    {
        global $wpdb;
        $p = $wpdb->prefix;

        $matched = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, purpose, subject_type, subject_id, destination_amount_decimal, destination_tx_hash, reconciled_at
                 FROM {$p}mf_settlements
                 WHERE organization_id = %d AND normalized_status = 'SUCCESS' AND reconciled_at IS NOT NULL
                 ORDER BY reconciled_at DESC LIMIT 50",
                $org_id
            ),
            ARRAY_A
        ) ?: [];

        $unmatched = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, purpose, subject_type, subject_id, destination_amount_decimal, normalized_status, updated_at
                 FROM {$p}mf_settlements
                 WHERE organization_id = %d AND normalized_status = 'SUCCESS' AND reconciled_at IS NULL
                 ORDER BY id DESC LIMIT 50",
                $org_id
            ),
            ARRAY_A
        ) ?: [];

        $exceptions = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, purpose, subject_type, subject_id, destination_amount_decimal, normalized_status, updated_at
                 FROM {$p}mf_settlements
                 WHERE organization_id = %d AND normalized_status IN ('FAILED','REFUNDED','INCOMPLETE','UNKNOWN_REVIEW')
                 ORDER BY id DESC LIMIT 50",
                $org_id
            ),
            ARRAY_A
        ) ?: [];

        return [
            'matched' => $matched,
            'unmatched' => $unmatched,
            'exceptions' => $exceptions,
        ];
    }

    /**
     * Statement-style unmatched obligations (open AR/AP without SUCCESS reconcile).
     *
     * @return array{counterparty_id:?int,open_receivables:list<array>,open_payables:list<array>,unmatched_settlements:list<array>}
     */
    public function statementUnmatched(int $org_id, ?int $counterparty_id = null): array
    {
        global $wpdb;
        $p = $wpdb->prefix;

        $ar_sql = "SELECT id, invoice_number, customer_id, due_date, amount_outstanding_decimal, status, currency
                   FROM {$p}mf_ar_invoices
                   WHERE organization_id = %d
                     AND status NOT IN ('draft','void','paid')
                     AND amount_outstanding_decimal > 0";
        $ar_params = [$org_id];
        if ($counterparty_id) {
            $ar_sql .= ' AND customer_id = %d';
            $ar_params[] = $counterparty_id;
        }
        $ar_sql .= ' ORDER BY due_date ASC, id ASC LIMIT 200';

        $ap_sql = "SELECT id, invoice_number, supplier_id, due_date, amount_outstanding_decimal, status, currency, match_status
                   FROM {$p}mf_ap_bills
                   WHERE organization_id = %d
                     AND status NOT IN ('paid','void','rejected')
                     AND amount_outstanding_decimal > 0";
        $ap_params = [$org_id];
        if ($counterparty_id) {
            $ap_sql .= ' AND supplier_id = %d';
            $ap_params[] = $counterparty_id;
        }
        $ap_sql .= ' ORDER BY due_date ASC, id ASC LIMIT 200';

        $dash = $this->dashboard($org_id);

        return [
            'counterparty_id' => $counterparty_id,
            'open_receivables' => $wpdb->get_results($wpdb->prepare($ar_sql, $ar_params), ARRAY_A) ?: [],
            'open_payables' => $wpdb->get_results($wpdb->prepare($ap_sql, $ap_params), ARRAY_A) ?: [],
            'unmatched_settlements' => $dash['unmatched'],
        ];
    }
}
