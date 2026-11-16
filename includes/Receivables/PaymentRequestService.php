<?php
/**
 * Standalone payment requests (checkout without an invoice).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Receivables;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;
use Matchflow\Notifications\ActivityNotifier;
use Matchflow\Security\AuditLogger;
use Matchflow\Security\PublicTokens;

final class PaymentRequestService
{
    private string $table;

    public function __construct()
    {
        global $wpdb;
        $this->table = $wpdb->prefix . 'mf_payment_requests';
    }

    public function list(int $org_id, array $args = []): array
    {
        global $wpdb;
        [$where, $params] = $this->listFilters($org_id, $args);
        $limit = max(1, min(100, (int) ($args['limit'] ?? 50)));
        $offset = max(0, (int) ($args['offset'] ?? 0));
        $sql = "SELECT pr.*, c.name AS customer_name
                FROM {$this->table} pr
                LEFT JOIN {$wpdb->prefix}mf_counterparties c
                  ON c.id = pr.customer_id AND c.organization_id = pr.organization_id
                WHERE {$where}
                ORDER BY pr.id DESC
                LIMIT %d OFFSET %d";
        $params[] = $limit;
        $params[] = $offset;
        $rows = $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) ?: [];
        return array_map(fn(array $r) => $this->present($r), $rows);
    }

    public function count(int $org_id, array $args = []): int
    {
        global $wpdb;
        [$where, $params] = $this->listFilters($org_id, $args);
        return (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$this->table} pr WHERE {$where}", $params));
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function listFilters(int $org_id, array $args): array
    {
        global $wpdb;
        $where = 'pr.organization_id = %d';
        $params = [$org_id];
        if (!empty($args['status'])) {
            $where .= ' AND pr.status = %s';
            $params[] = $args['status'];
        }
        $q = trim((string) ($args['q'] ?? ''));
        if ($q !== '') {
            $like = '%' . $wpdb->esc_like($q) . '%';
            $where .= ' AND (pr.reference LIKE %s OR pr.label LIKE %s)';
            $params[] = $like;
            $params[] = $like;
        }
        return [$where, $params];
    }

    public function find(int $org_id, int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table} WHERE organization_id = %d AND id = %d", $org_id, $id),
            ARRAY_A
        );
        return $row ? $this->present($row) : null;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function present(array $row): array
    {
        $outstanding = Money::sub((string) $row['amount_decimal'], (string) $row['amount_collected_decimal']);
        if (Money::cmp($outstanding, '0') < 0) {
            $outstanding = '0';
        }
        $row['amount_outstanding_decimal'] = $outstanding;
        $url = $this->paymentUrl($row);
        if ($url !== null) {
            $row['payment_url'] = $url;
        }
        return $row;
    }

    /**
     * @param array<string, mixed> $row
     */
    private function paymentUrl(array $row): ?string
    {
        if (!in_array($row['status'] ?? '', ['open', 'partially_paid'], true)) {
            return null;
        }
        $token = (string) ($row['public_payment_token'] ?? '');
        return $token !== '' ? home_url('/pay/' . $token) : null;
    }

    public function create(int $org_id, int $user_id, array $data): array
    {
        global $wpdb;
        $org = $wpdb->get_row(
            $wpdb->prepare('SELECT preferred_destination_asset, preferred_destination_address FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d', $org_id),
            ARRAY_A
        ) ?: [];
        $amount = Money::normalize((string) ($data['amount_decimal'] ?? '0'));
        if (Money::cmp($amount, '0') <= 0) {
            return [];
        }
        $label = sanitize_text_field((string) ($data['label'] ?? 'Payment request'));
        $reference = sanitize_text_field((string) ($data['reference'] ?? $this->nextReference($org_id)));
        $now = gmdate('Y-m-d H:i:s');
        $token = PublicTokens::create($org_id, 'payment_request', 'ar_payment_request', 0, 90 * DAY_IN_SECONDS);
        $wpdb->insert($this->table, [
            'organization_id' => $org_id,
            'reference' => $reference,
            'label' => $label,
            'description' => sanitize_textarea_field((string) ($data['description'] ?? '')),
            'amount_decimal' => $amount,
            'amount_collected_decimal' => '0',
            'currency' => sanitize_text_field((string) ($data['currency'] ?? 'USD')),
            'status' => 'open',
            'customer_id' => (int) ($data['customer_id'] ?? 0) ?: null,
            'destination_asset_id' => sanitize_text_field((string) ($data['destination_asset_id'] ?? $org['preferred_destination_asset'] ?? '')),
            'destination_address' => sanitize_text_field((string) ($data['destination_address'] ?? $org['preferred_destination_address'] ?? '')),
            'public_token_hash' => hash('sha256', $token),
            'public_payment_token' => $token,
            'created_by' => $user_id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        $wpdb->update($wpdb->prefix . 'mf_public_tokens', [
            'subject_id' => $id,
        ], [
            'token_hash' => hash('sha256', $token),
        ]);
        $fresh = $this->find($org_id, $id) ?? [];
        ActivityNotifier::org($org_id, 'payment_request_created', [
            'payment_request_id' => $id,
            'reference' => $reference,
            'label' => $label,
            'amount' => $amount,
            'payment_url' => $fresh['payment_url'] ?? home_url('/pay/' . $token),
            'message' => "Payment request {$reference} ({$label}) is live — share the checkout link.",
        ], $user_id);
        AuditLogger::record($org_id, 'payment_request.created', 'ar_payment_request', $id, null, ['reference' => $reference]);
        return $fresh;
    }

    public function cancel(int $org_id, int $id): ?array
    {
        global $wpdb;
        $row = $this->find($org_id, $id);
        if (!$row || in_array($row['status'], ['paid', 'cancelled'], true)) {
            return null;
        }
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->update($this->table, [
            'status' => 'cancelled',
            'cancelled_at' => $now,
            'updated_at' => $now,
        ], ['id' => $id, 'organization_id' => $org_id]);
        PublicTokens::revokeBySubject('ar_payment_request', $id);
        ActivityNotifier::org($org_id, 'payment_request_cancelled', [
            'payment_request_id' => $id,
            'reference' => $row['reference'],
            'message' => "Payment request {$row['reference']} was cancelled.",
        ], get_current_user_id());
        AuditLogger::record($org_id, 'payment_request.cancelled', 'ar_payment_request', $id);
        return $this->find($org_id, $id);
    }

    public function applyPayment(int $org_id, int $id, string $amount): void
    {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table} WHERE organization_id = %d AND id = %d", $org_id, $id),
            ARRAY_A
        );
        if (!$row || $row['status'] === 'cancelled') {
            return;
        }
        $collected = Money::add((string) $row['amount_collected_decimal'], $amount);
        $outstanding = Money::sub((string) $row['amount_decimal'], $collected);
        $status = Money::cmp($outstanding, '0') <= 0 ? 'paid' : 'partially_paid';
        if (Money::cmp($outstanding, '0') < 0) {
            $outstanding = '0';
        }
        $wpdb->update($this->table, [
            'amount_collected_decimal' => $collected,
            'status' => $status,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id, 'organization_id' => $org_id]);
        if ($status === 'paid') {
            PublicTokens::revokeBySubject('ar_payment_request', $id);
        }
    }

    public function findByPublicToken(string $token): ?array
    {
        $record = PublicTokens::resolve($token, 'payment_request');
        if (!$record) {
            return null;
        }
        return $this->find((int) $record['organization_id'], (int) $record['subject_id']);
    }

    private function nextReference(int $org_id): string
    {
        global $wpdb;
        $n = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$this->table} WHERE organization_id = %d", $org_id));
        return 'REQ-' . str_pad((string) ($n + 1), 4, '0', STR_PAD_LEFT);
    }
}
