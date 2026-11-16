<?php
/**
 * Public receipt generation from successful settlements.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Ledger;

defined('ABSPATH') || exit;

use Matchflow\Security\PublicTokens;

final class ReceiptsService
{
    public function issueForSettlement(int $org_id, int $settlement_id): array|\WP_Error
    {
        global $wpdb;
        $settlement = $wpdb->get_row(
            $wpdb->prepare(
                'SELECT * FROM ' . $wpdb->prefix . 'mf_settlements WHERE organization_id = %d AND id = %d',
                $org_id,
                $settlement_id
            ),
            ARRAY_A
        );
        if (!$settlement) {
            return new \WP_Error('matchflow_not_found', 'Settlement not found.', ['status' => 404]);
        }
        if (($settlement['normalized_status'] ?? '') !== 'SUCCESS') {
            return new \WP_Error('matchflow_invalid_state', 'Receipts require SUCCESS settlement.', ['status' => 409]);
        }

        $existing = (string) ($settlement['receipt_url'] ?? '');
        if ($existing !== '') {
            return [
                'url' => $existing,
                'settlement_id' => $settlement_id,
            ];
        }

        $token = PublicTokens::create($org_id, 'receipt', 'settlement', $settlement_id, 0);
        $url = home_url('/receipt/' . $token);
        $wpdb->update(
            $wpdb->prefix . 'mf_settlements',
            ['receipt_url' => $url, 'updated_at' => gmdate('Y-m-d H:i:s')],
            ['id' => $settlement_id, 'organization_id' => $org_id]
        );
        return [
            'token' => $token,
            'url' => $url,
            'settlement_id' => $settlement_id,
        ];
    }

    public function publicView(string $raw_token): array|\WP_Error
    {
        global $wpdb;
        $resolved = PublicTokens::resolve($raw_token, 'receipt');
        if (!$resolved) {
            return new \WP_Error('matchflow_invalid_token', 'Invalid or expired receipt token.', ['status' => 404]);
        }

        $settlement = $wpdb->get_row(
            $wpdb->prepare(
                'SELECT id, purpose, destination_amount_decimal, destination_asset_id, destination_tx_hash, recipient_address, reconciled_at, normalized_status
                 FROM ' . $wpdb->prefix . 'mf_settlements WHERE id = %d AND organization_id = %d',
                (int) $resolved['subject_id'],
                (int) $resolved['organization_id']
            ),
            ARRAY_A
        );
        if (!$settlement || ($settlement['normalized_status'] ?? '') !== 'SUCCESS') {
            return new \WP_Error('matchflow_not_found', 'Receipt unavailable.', ['status' => 404]);
        }

        return [
            'settlementId' => (int) $settlement['id'],
            'purpose' => $settlement['purpose'],
            'amount' => $settlement['destination_amount_decimal'],
            'assetId' => $settlement['destination_asset_id'],
            'destinationTxHash' => $settlement['destination_tx_hash'],
            'recipient' => $this->maskAddress((string) $settlement['recipient_address']),
            'reconciledAt' => $settlement['reconciled_at'],
            'status' => 'SUCCESS',
        ];
    }

    private function maskAddress(string $address): string
    {
        if (strlen($address) < 10) {
            return $address;
        }
        return substr($address, 0, 6) . '…' . substr($address, -4);
    }
}
