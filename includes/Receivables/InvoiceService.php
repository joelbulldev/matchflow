<?php
/**
 * Receivables invoice domain service.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Receivables;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;
use Matchflow\NearIntents\UsdSettlement;
use Matchflow\Notifications\ActivityNotifier;
use Matchflow\Notifications\NotificationService;
use Matchflow\Security\AuditLogger;
use Matchflow\Security\PublicTokens;

final class InvoiceService
{
    private string $invoices;
    private string $items;
    private string $versions;

    public function __construct()
    {
        global $wpdb;
        $this->invoices = $wpdb->prefix . 'mf_ar_invoices';
        $this->items = $wpdb->prefix . 'mf_ar_invoice_items';
        $this->versions = $wpdb->prefix . 'mf_ar_invoice_versions';
    }

    public function list(int $org_id, array $args = []): array
    {
        global $wpdb;
        [$where, $params] = $this->listFilters($org_id, $args);
        $limit = (int) ($args['limit'] ?? 50);
        $offset = (int) ($args['offset'] ?? 0);
        $sql = "SELECT i.*, c.name AS customer_name, c.email AS customer_email
                FROM {$this->invoices} i
                LEFT JOIN {$wpdb->prefix}mf_counterparties c
                  ON c.id = i.customer_id AND c.organization_id = i.organization_id
                WHERE {$where}
                ORDER BY i.id DESC
                LIMIT %d OFFSET %d";
        $params[] = $limit;
        $params[] = $offset;
        return $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) ?: [];
    }

    public function count(int $org_id, array $args = []): int
    {
        global $wpdb;
        [$where, $params] = $this->listFilters($org_id, $args);
        $sql = "SELECT COUNT(*) FROM {$this->invoices} i
                LEFT JOIN {$wpdb->prefix}mf_counterparties c
                  ON c.id = i.customer_id AND c.organization_id = i.organization_id
                WHERE {$where}";
        return (int) $wpdb->get_var($wpdb->prepare($sql, $params));
    }

    /**
     * @return array{0: string, 1: list<mixed>}
     */
    private function listFilters(int $org_id, array $args): array
    {
        global $wpdb;
        $where = 'i.organization_id = %d';
        $params = [$org_id];
        if (!empty($args['status'])) {
            $where .= ' AND i.status = %s';
            $params[] = $args['status'];
        }
        if (!empty($args['customer_id'])) {
            $where .= ' AND i.customer_id = %d';
            $params[] = (int) $args['customer_id'];
        }
        $q = trim((string) ($args['q'] ?? ''));
        if ($q !== '') {
            $like = '%' . $wpdb->esc_like($q) . '%';
            $where .= ' AND (i.invoice_number LIKE %s OR c.name LIKE %s OR c.email LIKE %s)';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }
        return [$where, $params];
    }

    public function enrichCustomerFields(int $org_id, array $invoice): array
    {
        global $wpdb;
        if (empty($invoice['customer_name']) && !empty($invoice['customer_id'])) {
            $customer = $wpdb->get_row(
                $wpdb->prepare(
                    'SELECT name, email FROM ' . $wpdb->prefix . 'mf_counterparties WHERE organization_id = %d AND id = %d',
                    $org_id,
                    (int) $invoice['customer_id']
                ),
                ARRAY_A
            );
            if ($customer) {
                $invoice['customer_name'] = (string) ($customer['name'] ?? '');
                $invoice['customer_email'] = (string) ($customer['email'] ?? '');
            }
        }
        return $invoice;
    }

    /**
     * @return array<string, mixed>|\WP_Error
     */
    public function notifyCustomer(int $org_id, int $id, string $template): array|\WP_Error
    {
        $invoice = $this->find($org_id, $id);
        if (!$invoice) {
            return new \WP_Error('matchflow_not_found', 'Invoice not found.', ['status' => 404]);
        }
        if (!in_array($template, ['invoice_issued', 'invoice_reminder'], true)) {
            return new \WP_Error('matchflow_invalid', 'Unknown notification template.', ['status' => 400]);
        }
        if ($template === 'invoice_issued' && $invoice['status'] === 'draft') {
            return new \WP_Error('matchflow_invalid_state', 'Issue the invoice before sending the payment link.', ['status' => 409]);
        }
        if ($template === 'invoice_reminder' && !in_array($invoice['status'], ['issued', 'overdue', 'partially_paid'], true)) {
            return new \WP_Error('matchflow_invalid_state', 'Reminders apply only to open invoices.', ['status' => 409]);
        }

        $invoice = $this->enrichCustomerFields($org_id, $invoice);
        $email = (string) ($invoice['customer_email'] ?? '');
        if ($email === '' || !is_email($email)) {
            return new \WP_Error('matchflow_invalid', 'Customer email is missing. Add an email on the customer profile first.', ['status' => 422]);
        }

        global $wpdb;
        $org_name = (string) $wpdb->get_var($wpdb->prepare(
            'SELECT name FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d',
            $org_id
        ));
        $url = $this->paymentUrl($invoice) ?? '';
        $vars = [
            'invoice_number' => (string) $invoice['invoice_number'],
            'org_name' => $org_name ?: get_bloginfo('name'),
            'payment_url' => $url,
            'amount' => (string) ($invoice['amount_outstanding_decimal'] ?? $invoice['total_decimal']),
        ];
        $mailer = new NotificationService();
        $sent = $mailer->sendMailTemplate($template, $email, $vars);
        $mailer->notify($org_id, null, $template, [
            'invoice_id' => $id,
            'invoice_number' => $vars['invoice_number'],
            'message' => $template === 'invoice_issued'
                ? "Payment link sent to {$email}."
                : "Reminder sent to {$email} for {$vars['invoice_number']}.",
            'payment_url' => $url,
        ]);
        AuditLogger::record($org_id, 'invoice.notify', 'ar_invoice', $id, null, [
            'template' => $template,
            'email' => $email,
            'mail_sent' => $sent,
        ]);

        return [
            'sent' => $sent,
            'template' => $template,
            'email' => $email,
            'payment_url' => $url,
        ];
    }

    public function find(int $org_id, int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->invoices} WHERE organization_id = %d AND id = %d", $org_id, $id),
            ARRAY_A
        );
        if (!$row) {
            return null;
        }
        $row['items'] = $wpdb->get_results(
            $wpdb->prepare("SELECT * FROM {$this->items} WHERE invoice_id = %d ORDER BY sort_order ASC, id ASC", $id),
            ARRAY_A
        ) ?: [];
        $row = $this->enrichCustomerFields($org_id, $row);
        return $this->present($row);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function present(array $row): array
    {
        $url = $this->paymentUrl($row);
        if ($url !== null) {
            $row['payment_url'] = $url;
        }
        return $row;
    }

    public function create(int $org_id, int $user_id, array $data): array
    {
        global $wpdb;
        $items = is_array($data['items'] ?? null) ? $data['items'] : [];
        $totals = $this->calculateTotals($items, (string) ($data['tax_decimal'] ?? '0'), (string) ($data['discount_decimal'] ?? '0'));
        $now = gmdate('Y-m-d H:i:s');
        $number = sanitize_text_field((string) ($data['invoice_number'] ?? $this->nextNumber($org_id)));

        $wpdb->insert($this->invoices, [
            'organization_id' => $org_id,
            'customer_id' => (int) ($data['customer_id'] ?? 0),
            'invoice_number' => $number,
            'currency' => sanitize_text_field((string) ($data['currency'] ?? 'USD')),
            'subtotal_decimal' => $totals['subtotal'],
            'tax_decimal' => $totals['tax'],
            'discount_decimal' => $totals['discount'],
            'total_decimal' => $totals['total'],
            'amount_paid_decimal' => '0',
            'amount_outstanding_decimal' => $totals['total'],
            'issue_date' => $data['issue_date'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'status' => 'draft',
            'payment_terms' => $data['payment_terms'] ?? null,
            'notes' => $data['notes'] ?? null,
            'brand_theme' => $this->sanitizeBrandTheme($data['brand_theme'] ?? 'classic'),
            'destination_asset_id' => $data['destination_asset_id'] ?? null,
            'destination_address' => $data['destination_address'] ?? null,
            'created_by' => $user_id,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        $this->replaceItems($id, $items);
        return $this->find($org_id, $id) ?? [];
    }

    public function update(int $org_id, int $id, array $data): ?array
    {
        global $wpdb;
        $existing = $this->find($org_id, $id);
        if (!$existing || $existing['status'] !== 'draft') {
            return null;
        }
        $items = is_array($data['items'] ?? null) ? $data['items'] : $existing['items'];
        $totals = $this->calculateTotals($items, (string) ($data['tax_decimal'] ?? $existing['tax_decimal']), (string) ($data['discount_decimal'] ?? $existing['discount_decimal']));
        $wpdb->update($this->invoices, [
            'customer_id' => (int) ($data['customer_id'] ?? $existing['customer_id']),
            'currency' => sanitize_text_field((string) ($data['currency'] ?? $existing['currency'])),
            'subtotal_decimal' => $totals['subtotal'],
            'tax_decimal' => $totals['tax'],
            'discount_decimal' => $totals['discount'],
            'total_decimal' => $totals['total'],
            'amount_outstanding_decimal' => Money::sub($totals['total'], (string) $existing['amount_paid_decimal']),
            'issue_date' => $data['issue_date'] ?? $existing['issue_date'],
            'due_date' => $data['due_date'] ?? $existing['due_date'],
            'payment_terms' => $data['payment_terms'] ?? $existing['payment_terms'],
            'notes' => $data['notes'] ?? $existing['notes'],
            'brand_theme' => isset($data['brand_theme']) ? $this->sanitizeBrandTheme($data['brand_theme']) : ($existing['brand_theme'] ?? 'classic'),
            'destination_asset_id' => $data['destination_asset_id'] ?? $existing['destination_asset_id'],
            'destination_address' => $data['destination_address'] ?? $existing['destination_address'],
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id, 'organization_id' => $org_id]);
        if (isset($data['items'])) {
            $this->replaceItems($id, $items);
        }
        $wpdb->query($wpdb->prepare(
            "UPDATE {$this->invoices} SET version = version + 1, updated_at = %s WHERE id = %d AND organization_id = %d",
            gmdate('Y-m-d H:i:s'),
            $id,
            $org_id
        ));
        $fresh = $this->find($org_id, $id);
        AuditLogger::record($org_id, 'invoice.updated', 'ar_invoice', $id, $existing, $fresh);
        return $fresh;
    }

    public function issue(int $org_id, int $id): array|\WP_Error
    {
        global $wpdb;
        $invoice = $this->find($org_id, $id);
        if (!$invoice) {
            return new \WP_Error('matchflow_not_found', 'Invoice not found.', ['status' => 404]);
        }
        if ($invoice['status'] !== 'draft') {
            return new \WP_Error('matchflow_invalid_state', 'Only draft invoices can be issued.', ['status' => 409]);
        }
        $org = $wpdb->get_row($wpdb->prepare(
            'SELECT preferred_destination_asset, preferred_destination_address FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d',
            $org_id
        ), ARRAY_A) ?: [];
        $defaultAsset = trim((string) ($org['preferred_destination_asset'] ?? ''));
        $defaultAddress = trim((string) ($org['preferred_destination_address'] ?? ''));
        $invoiceCurrency = (string) ($invoice['currency'] ?? 'USD');
        if ($defaultAsset === '') {
            $fallback = trim((string) (get_option('matchflow_default_destination_asset', '') ?: ''));
            if ($fallback !== '') {
                $defaultAsset = $fallback;
            } elseif (UsdSettlement::isUsdDenominated($invoiceCurrency)) {
                $defaultAsset = UsdSettlement::defaultUsdSettlementAsset();
            } else {
                $defaultAsset = 'nep141:wrap.near';
            }
        } elseif (UsdSettlement::isUsdDenominated($invoiceCurrency) && !UsdSettlement::isStablecoinAsset($defaultAsset)) {
            $defaultAsset = UsdSettlement::defaultUsdSettlementAsset();
        }
        $destAsset = trim((string) ($invoice['destination_asset_id'] ?? '')) ?: $defaultAsset;
        if (UsdSettlement::isUsdDenominated($invoiceCurrency) && !UsdSettlement::isStablecoinAsset($destAsset)) {
            $destAsset = UsdSettlement::defaultUsdSettlementAsset();
        }
        $destAddress = trim((string) ($invoice['destination_address'] ?? '')) ?: $defaultAddress;

        $token = PublicTokens::create($org_id, 'invoice_pay', 'ar_invoice', $id, 60 * DAY_IN_SECONDS);
        $wpdb->update($this->invoices, [
            'status' => 'issued',
            'issue_date' => $invoice['issue_date'] ?: gmdate('Y-m-d'),
            'destination_asset_id' => $destAsset !== '' ? $destAsset : null,
            'destination_address' => $destAddress !== '' ? $destAddress : null,
            'public_token_hash' => hash('sha256', $token),
            'public_payment_token' => $token,
            'version' => 1,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id, 'organization_id' => $org_id]);
        $fresh = $this->find($org_id, $id) ?? [];
        $this->snapshotVersion($org_id, $id, $fresh, 'issued', get_current_user_id());
        $fresh['payment_token'] = $token;
        $fresh['payment_url'] = home_url('/pay/' . $token);
        ActivityNotifier::org($org_id, 'invoice_issued', [
            'invoice_id' => $id,
            'invoice_number' => $fresh['invoice_number'] ?? $invoice['invoice_number'],
            'payment_url' => $fresh['payment_url'],
            'message' => 'Invoice ' . ($fresh['invoice_number'] ?? '') . ' was issued with a live pay link.',
        ], get_current_user_id());
        return $fresh;
    }

    public function void(int $org_id, int $id, string $reason = ''): array|\WP_Error
    {
        global $wpdb;
        $invoice = $this->find($org_id, $id);
        if (!$invoice) {
            return new \WP_Error('matchflow_not_found', 'Invoice not found.', ['status' => 404]);
        }
        if (in_array($invoice['status'], ['paid', 'void'], true)) {
            return new \WP_Error('matchflow_invalid_state', 'Paid or void invoices cannot be voided.', ['status' => 409]);
        }
        if (Money::cmp((string) $invoice['amount_paid_decimal'], '0') > 0) {
            return new \WP_Error('matchflow_invalid_state', 'Partially paid invoices cannot be voided; refund/reconcile first.', ['status' => 409]);
        }
        $this->snapshotVersion($org_id, $id, $invoice, $reason !== '' ? $reason : 'void', get_current_user_id());
        ActivityNotifier::org($org_id, 'invoice_voided', [
            'invoice_id' => $id,
            'invoice_number' => $invoice['invoice_number'],
            'message' => 'Invoice ' . $invoice['invoice_number'] . ' was voided.',
        ], get_current_user_id());
        $wpdb->update($this->invoices, [
            'status' => 'void',
            'amount_outstanding_decimal' => '0',
            'notes' => trim((string) ($invoice['notes'] ?? '') . ($reason !== '' ? "\nVoid: {$reason}" : '')),
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id, 'organization_id' => $org_id]);
        if (!empty($invoice['public_token_hash'])) {
            PublicTokens::revokeBySubject('ar_invoice', $id);
        }
        $wpdb->update($this->invoices, ['public_payment_token' => null], ['id' => $id, 'organization_id' => $org_id]);
        AuditLogger::record($org_id, 'invoice.voided', 'ar_invoice', $id, $invoice, ['status' => 'void']);
        return $this->find($org_id, $id) ?? [];
    }

    public function paymentUrl(array $invoice): ?string
    {
        $token = (string) ($invoice['public_payment_token'] ?? '');
        if ($token === '') {
            return null;
        }
        return home_url('/pay/' . $token);
    }

    /**
     * Correct an issued invoice without silent overwrite: snapshot then apply.
     */
    public function correct(int $org_id, int $id, array $data, string $reason = ''): array|\WP_Error
    {
        global $wpdb;
        $existing = $this->find($org_id, $id);
        if (!$existing) {
            return new \WP_Error('matchflow_not_found', 'Invoice not found.', ['status' => 404]);
        }
        if (!in_array($existing['status'], ['issued', 'partially_paid', 'overdue', 'review_required'], true)) {
            return new \WP_Error('matchflow_invalid_state', 'Only open issued invoices can be corrected.', ['status' => 409]);
        }
        $this->snapshotVersion($org_id, $id, $existing, $reason !== '' ? $reason : 'correction', get_current_user_id());
        $items = is_array($data['items'] ?? null) ? $data['items'] : $existing['items'];
        $totals = $this->calculateTotals(
            $items,
            (string) ($data['tax_decimal'] ?? $existing['tax_decimal']),
            (string) ($data['discount_decimal'] ?? $existing['discount_decimal'])
        );
        $paid = (string) $existing['amount_paid_decimal'];
        $outstanding = Money::sub($totals['total'], $paid);
        if (Money::cmp($outstanding, '0') < 0) {
            $outstanding = '0';
        }
        $next_version = (int) ($existing['version'] ?? 1) + 1;
        $wpdb->update($this->invoices, [
            'customer_id' => (int) ($data['customer_id'] ?? $existing['customer_id']),
            'currency' => sanitize_text_field((string) ($data['currency'] ?? $existing['currency'])),
            'subtotal_decimal' => $totals['subtotal'],
            'tax_decimal' => $totals['tax'],
            'discount_decimal' => $totals['discount'],
            'total_decimal' => $totals['total'],
            'amount_outstanding_decimal' => $outstanding,
            'due_date' => $data['due_date'] ?? $existing['due_date'],
            'payment_terms' => $data['payment_terms'] ?? $existing['payment_terms'],
            'notes' => $data['notes'] ?? $existing['notes'],
            'destination_asset_id' => $data['destination_asset_id'] ?? $existing['destination_asset_id'],
            'destination_address' => $data['destination_address'] ?? $existing['destination_address'],
            'version' => $next_version,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id, 'organization_id' => $org_id]);
        if (isset($data['items'])) {
            $this->replaceItems($id, $items);
        }
        $fresh = $this->find($org_id, $id) ?? [];
        $this->snapshotVersion($org_id, $id, $fresh, 'corrected_v' . $next_version, get_current_user_id());
        return $fresh;
    }

    public function listVersions(int $org_id, int $id): array
    {
        global $wpdb;
        $invoice = $this->find($org_id, $id);
        if (!$invoice) {
            return [];
        }
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, invoice_id, version, change_reason, created_by, created_at, snapshot_json
                 FROM {$this->versions}
                 WHERE organization_id = %d AND invoice_id = %d
                 ORDER BY version ASC",
                $org_id,
                $id
            ),
            ARRAY_A
        ) ?: [];
    }

    private function snapshotVersion(int $org_id, int $invoice_id, array $snapshot, string $reason, int $user_id): void
    {
        global $wpdb;
        $version = (int) ($snapshot['version'] ?? 1);
        $wpdb->replace($this->versions, [
            'organization_id' => $org_id,
            'invoice_id' => $invoice_id,
            'version' => $version,
            'snapshot_json' => wp_json_encode($snapshot),
            'change_reason' => sanitize_text_field($reason),
            'created_by' => $user_id ?: null,
            'created_at' => gmdate('Y-m-d H:i:s'),
        ]);
    }

    public function applyPayment(int $org_id, int $id, string $amount): void
    {
        global $wpdb;
        $invoice = $this->find($org_id, $id);
        if (!$invoice) {
            return;
        }
        $paid = Money::add((string) $invoice['amount_paid_decimal'], $amount);
        $outstanding = Money::sub((string) $invoice['total_decimal'], $paid);
        $status = Money::cmp($outstanding, '0') <= 0 ? 'paid' : 'partially_paid';
        if (Money::cmp($outstanding, '0') < 0) {
            $outstanding = '0';
        }
        $wpdb->update($this->invoices, [
            'amount_paid_decimal' => $paid,
            'amount_outstanding_decimal' => $outstanding,
            'status' => $status,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $id, 'organization_id' => $org_id]);
    }

    public function findByPublicToken(string $token): ?array
    {
        $record = PublicTokens::resolve($token, 'invoice_pay');
        if (!$record) {
            return null;
        }
        return $this->find((int) $record['organization_id'], (int) $record['subject_id']);
    }

    public function pdfHtml(int $org_id, int $id): array|\WP_Error
    {
        $invoice = $this->find($org_id, $id);
        if (!$invoice) {
            return new \WP_Error('matchflow_not_found', 'Invoice not found.', ['status' => 404]);
        }
        $lines = '';
        foreach ($invoice['items'] as $item) {
            $lines .= '<tr><td>' . esc_html((string) $item['description']) . '</td><td>' . esc_html((string) $item['quantity_decimal']) . '</td><td>' . esc_html((string) $item['unit_price_decimal']) . '</td><td>' . esc_html((string) $item['line_total_decimal']) . '</td></tr>';
        }
        $html = '<!doctype html><html><head><meta charset="utf-8"><title>Invoice ' . esc_html((string) $invoice['invoice_number']) . '</title>'
            . '<style>body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}.brand{color:#0f766e;font-weight:700;letter-spacing:.12em}</style></head><body>'
            . '<div class="brand">MATCHFLOW</div><h1>Invoice ' . esc_html((string) $invoice['invoice_number']) . '</h1>'
            . '<p>Status: ' . esc_html((string) $invoice['status']) . '<br>Currency: ' . esc_html((string) $invoice['currency']) . '</p>'
            . '<table><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Line</th></tr></thead><tbody>' . $lines . '</tbody></table>'
            . '<p style="margin-top:24px"><strong>Total:</strong> ' . esc_html((string) $invoice['total_decimal']) . '<br><strong>Outstanding:</strong> ' . esc_html((string) $invoice['amount_outstanding_decimal']) . '</p>'
            . '<script>window.print()</script></body></html>';
        AuditLogger::record($org_id, 'invoice.pdf_exported', 'ar_invoice', $id);
        return ['html' => $html, 'invoice_number' => $invoice['invoice_number']];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function versions(int $org_id, int $id): array
    {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                'SELECT id, action, before_hash, after_hash, metadata_redacted, created_at, actor_user_id
                 FROM ' . $wpdb->prefix . 'mf_audit_events
                 WHERE organization_id = %d AND subject_type = %s AND subject_id = %d
                 AND action LIKE %s
                 ORDER BY id DESC LIMIT 50',
                $org_id,
                'ar_invoice',
                $id,
                'invoice.%'
            ),
            ARRAY_A
        ) ?: [];
    }

    private function calculateTotals(array $items, string $invoice_tax, string $invoice_discount): array
    {
        $subtotal = '0';
        $line_tax = '0';
        foreach ($items as $item) {
            $qty = (string) ($item['quantity'] ?? $item['quantity_decimal'] ?? '0');
            $price = (string) ($item['unit_price'] ?? $item['unit_price_decimal'] ?? '0');
            $tax = (string) ($item['tax'] ?? $item['tax_decimal'] ?? '0');
            $discount = (string) ($item['discount'] ?? $item['discount_decimal'] ?? '0');
            $line = Money::lineTotal($qty, $price, '0', $discount);
            $subtotal = Money::add($subtotal, $line);
            $line_tax = Money::add($line_tax, $tax);
        }
        $tax = Money::add($line_tax, $invoice_tax);
        $total = Money::sub(Money::add($subtotal, $tax), $invoice_discount);
        if (Money::cmp($total, '0') < 0) {
            $total = '0';
        }
        return [
            'subtotal' => $subtotal,
            'tax' => $tax,
            'discount' => Money::normalize($invoice_discount),
            'total' => $total,
        ];
    }

    private function replaceItems(int $invoice_id, array $items): void
    {
        global $wpdb;
        $wpdb->delete($this->items, ['invoice_id' => $invoice_id]);
        foreach (array_values($items) as $i => $item) {
            $qty = (string) ($item['quantity'] ?? $item['quantity_decimal'] ?? '0');
            $price = (string) ($item['unit_price'] ?? $item['unit_price_decimal'] ?? '0');
            $tax = (string) ($item['tax'] ?? $item['tax_decimal'] ?? '0');
            $discount = (string) ($item['discount'] ?? $item['discount_decimal'] ?? '0');
            $wpdb->insert($this->items, [
                'invoice_id' => $invoice_id,
                'description' => sanitize_text_field((string) ($item['description'] ?? '')),
                'quantity_decimal' => Money::normalize($qty),
                'unit_price_decimal' => Money::normalize($price),
                'tax_decimal' => Money::normalize($tax),
                'discount_decimal' => Money::normalize($discount),
                'line_total_decimal' => Money::lineTotal($qty, $price, $tax, $discount),
                'sort_order' => $i,
            ]);
        }
    }

    private function nextNumber(int $org_id): string
    {
        global $wpdb;
        $count = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$this->invoices} WHERE organization_id = %d", $org_id));
        return 'INV-' . str_pad((string) ($count + 1), 5, '0', STR_PAD_LEFT);
    }

    private function sanitizeBrandTheme(mixed $theme): string
    {
        $key = strtolower(sanitize_key((string) $theme));
        return in_array($key, ['classic', 'minimal', 'bold'], true) ? $key : 'classic';
    }
}
