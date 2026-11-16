<?php
/**
 * Operational subledger for validated settlements.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Ledger;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;

final class LedgerService
{
    public function writeSettlementEntry(int $org_id, array $settlement): int
    {
        global $wpdb;

        $existing = (int) $wpdb->get_var(
            $wpdb->prepare(
                'SELECT id FROM ' . $wpdb->prefix . 'mf_ledger_entries WHERE settlement_id = %d AND entry_type = %s LIMIT 1',
                (int) $settlement['id'],
                'settlement_success'
            )
        );
        if ($existing > 0) {
            return $existing;
        }

        $direction = ($settlement['purpose'] ?? '') === 'AR_COLLECTION' ? 'in' : 'out';
        $wpdb->insert(
            $wpdb->prefix . 'mf_ledger_entries',
            [
                'organization_id' => $org_id,
                'obligation_type' => (string) $settlement['subject_type'],
                'obligation_id' => (int) $settlement['subject_id'],
                'settlement_id' => (int) $settlement['id'],
                'entry_type' => 'settlement_success',
                'amount_decimal' => (string) ($settlement['destination_amount_decimal'] ?? Money::fromAtomic((string) $settlement['destination_amount_atomic'], 6)),
                'asset_id' => (string) ($settlement['destination_asset_id'] ?? ''),
                'currency' => null,
                'direction' => $direction,
                'occurred_at' => gmdate('Y-m-d H:i:s'),
                'created_at' => gmdate('Y-m-d H:i:s'),
            ]
        );

        return (int) $wpdb->insert_id;
    }

    public function writeRefundEntry(int $org_id, array $settlement): int
    {
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'mf_ledger_entries',
            [
                'organization_id' => $org_id,
                'obligation_type' => (string) $settlement['subject_type'],
                'obligation_id' => (int) $settlement['subject_id'],
                'settlement_id' => (int) $settlement['id'],
                'entry_type' => 'settlement_refund',
                'amount_decimal' => (string) ($settlement['destination_amount_decimal'] ?? '0'),
                'asset_id' => (string) ($settlement['destination_asset_id'] ?? ''),
                'currency' => null,
                'direction' => 'in',
                'occurred_at' => gmdate('Y-m-d H:i:s'),
                'created_at' => gmdate('Y-m-d H:i:s'),
            ]
        );
        return (int) $wpdb->insert_id;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listForOrg(int $org_id, int $limit = 100): array
    {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                'SELECT * FROM ' . $wpdb->prefix . 'mf_ledger_entries WHERE organization_id = %d ORDER BY id DESC LIMIT %d',
                $org_id,
                $limit
            ),
            ARRAY_A
        ) ?: [];
    }
}
