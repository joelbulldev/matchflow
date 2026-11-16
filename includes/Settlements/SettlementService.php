<?php
/**
 * Shared AR/AP settlement engine.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Settlements;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;
use Matchflow\Ledger\LedgerService;
use Matchflow\Ledger\ReceiptsService;
use Matchflow\NearIntents\AssetDecimals;
use Matchflow\NearIntents\OneClickClient;
use Matchflow\NearIntents\UsdSettlement;
use Matchflow\NearIntents\SignatureVerifier;
use Matchflow\Notifications\NotificationService;
use Matchflow\Policies\PolicyEngine;
use Matchflow\Notifications\ActivityNotifier;
use Matchflow\Receivables\InvoiceService;
use Matchflow\Receivables\PaymentRequestService;
use Matchflow\Security\AuditLogger;
use Matchflow\Security\Idempotency;

final class SettlementService
{
    public function __construct(
        private OneClickClient $client = new OneClickClient(),
        private SignatureVerifier $verifier = new SignatureVerifier(),
        private PolicyEngine $policies = new PolicyEngine(),
        private LedgerService $ledger = new LedgerService(),
        private ReceiptsService $receipts = new ReceiptsService(),
        private NotificationService $notifications = new NotificationService()
    ) {
    }

    public function createQuote(int $org_id, array $input, bool $dry = true): array|\WP_Error
    {
        global $wpdb;
        $purpose = (string) ($input['purpose'] ?? '');
        if (!in_array($purpose, ['AR_COLLECTION', 'AP_SETTLEMENT'], true)) {
            return new \WP_Error('matchflow_invalid', 'Invalid settlement purpose.', ['status' => 400]);
        }

        $idem = (string) ($input['idempotency_key'] ?? Idempotency::keyFromRequest() ?? '');
        if ($idem !== '' && !$dry) {
            $cached = Idempotency::recall('settlement_quote:' . $org_id, $idem);
            if ($cached !== null) {
                return $cached;
            }
        }

        $trusted = $this->resolveTrustedInstruction($org_id, $purpose, $input);
        if (is_wp_error($trusted)) {
            return $trusted;
        }

        if (!$dry) {
            $policy = $this->policies->evaluate($org_id, $this->policyContext($org_id, $purpose, $trusted, $input));
            if (!$policy['ok']) {
                AuditLogger::record($org_id, 'settlement.policy_denied', $trusted['subject_type'], $trusted['subject_id'], null, null, $policy);
                return new \WP_Error('matchflow_policy_denied', 'Settlement blocked by policy.', ['status' => 403, 'checks' => $policy['checks']]);
            }
        }

        $body = [
            'dry' => $dry,
            'swapType' => $input['swapType'] ?? 'EXACT_OUTPUT',
            'originAsset' => $trusted['origin_asset_id'],
            'depositType' => $input['depositType'] ?? 'ORIGIN_CHAIN',
            'destinationAsset' => $trusted['destination_asset_id'],
            'amount' => $trusted['destination_amount_atomic'],
            'recipient' => $trusted['recipient_address'],
            'recipientType' => $input['recipientType'] ?? 'DESTINATION_CHAIN',
            'refundTo' => $trusted['refund_address'],
            'refundType' => $input['refundType'] ?? 'ORIGIN_CHAIN',
            'slippageTolerance' => (int) ($input['slippageTolerance'] ?? 100),
            'deadline' => $input['deadline'] ?? gmdate('c', time() + 3600),
        ];

        $quote = $this->client->getQuote($body);
        if (is_wp_error($quote)) {
            return $quote;
        }

        $valid = $this->verifier->verifyQuotePayload($quote);
        $allowUnverified = (bool) get_option('matchflow_allow_unverified_quotes', false)
            || (defined('MATCHFLOW_ALLOW_UNVERIFIED_QUOTES') && MATCHFLOW_ALLOW_UNVERIFIED_QUOTES);
        if (!$valid && !$dry && !$allowUnverified) {
            return new \WP_Error(
                'matchflow_invalid_quote_signature',
                'Quote signature verification failed. Confirm the 1Click verification public key in WordPress admin, or enable unverified quotes for sandbox testing.',
                ['status' => 400]
            );
        }

        if ($dry) {
            return [
                'dry' => true,
                'signatureValid' => $valid,
                'quote' => $quote,
            ];
        }

        $q = $quote['quote'] ?? [];
        $now = gmdate('Y-m-d H:i:s');
        if ($idem === '') {
            $idem = wp_generate_uuid4();
        }
        $wpdb->insert($wpdb->prefix . 'mf_settlements', [
            'organization_id' => $org_id,
            'purpose' => $purpose,
            'subject_type' => $trusted['subject_type'],
            'subject_id' => $trusted['subject_id'],
            'correlation_id' => $quote['correlationId'] ?? null,
            'quote_json' => wp_json_encode($quote),
            'quote_signature_valid' => $valid ? 1 : 0,
            'status' => 'PENDING_DEPOSIT',
            'normalized_status' => 'PENDING_DEPOSIT',
            'origin_asset_id' => $trusted['origin_asset_id'],
            'destination_asset_id' => $trusted['destination_asset_id'],
            'source_amount_atomic' => $q['amountIn'] ?? null,
            'destination_amount_atomic' => $trusted['destination_amount_atomic'],
            'destination_amount_decimal' => $trusted['destination_amount_decimal'],
            'recipient_address' => $trusted['recipient_address'],
            'refund_address' => $trusted['refund_address'],
            'deposit_address' => $q['depositAddress'] ?? null,
            'deposit_memo' => $q['depositMemo'] ?? ($q['memo'] ?? null),
            'quote_expires_at' => isset($q['deadline']) ? gmdate('Y-m-d H:i:s', strtotime((string) $q['deadline'])) : null,
            'idempotency_key' => $idem,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $id = (int) $wpdb->insert_id;
        $this->appendEvent($id, 'PENDING_DEPOSIT', 'PENDING_DEPOSIT', $quote, $valid);
        $row = $this->find($org_id, $id) ?? [];
        ActivityNotifier::org($org_id, 'settlement_started', [
            'settlement_id' => $id,
            'purpose' => $purpose,
            'subject_type' => $trusted['subject_type'],
            'subject_id' => (int) $trusted['subject_id'],
            'message' => "Settlement #{$id} is awaiting deposit.",
        ], null);
        AuditLogger::record($org_id, 'settlement.quoted', $trusted['subject_type'], $trusted['subject_id'], null, ['settlement_id' => $id]);
        if ($idem !== '') {
            Idempotency::remember('settlement_quote:' . $org_id, $idem, $row);
        }
        return $row;
    }

    public function retryFailed(int $org_id, int $settlement_id, array $input = []): array|\WP_Error
    {
        $prior = $this->find($org_id, $settlement_id);
        if (!$prior) {
            return new \WP_Error('matchflow_not_found', 'Settlement not found.', ['status' => 404]);
        }
        if (($prior['normalized_status'] ?? '') === 'SUCCESS') {
            return new \WP_Error('matchflow_already_success', 'Cannot retry a successful settlement.', ['status' => 409]);
        }
        if (!in_array(($prior['normalized_status'] ?? ''), ['FAILED', 'REFUNDED', 'INCOMPLETE', 'UNKNOWN_REVIEW'], true)) {
            return new \WP_Error('matchflow_invalid_state', 'Settlement is not in a retryable state.', ['status' => 409]);
        }

        $body = array_merge($input, [
            'purpose' => $prior['purpose'],
            'subject_id' => (int) $prior['subject_id'],
            'origin_asset_id' => $prior['origin_asset_id'],
            'refund_address' => $prior['refund_address'],
            'idempotency_key' => wp_generate_uuid4(),
        ]);
        AuditLogger::record($org_id, 'settlement.retry', (string) $prior['subject_type'], (int) $prior['subject_id'], ['from' => $settlement_id], null);
        return $this->createQuote($org_id, $body, false);
    }

    public function confirmDeposit(int $org_id, int $settlement_id, string $txHash, ?string $nearSenderAccount = null): array|\WP_Error
    {
        global $wpdb;
        $settlement = $this->find($org_id, $settlement_id);
        if (!$settlement || empty($settlement['deposit_address'])) {
            return new \WP_Error('matchflow_not_found', 'Settlement not found.', ['status' => 404]);
        }
        $txHash = trim($txHash);
        if ($txHash === '') {
            return new \WP_Error('matchflow_invalid', 'Transaction hash is required.', ['status' => 400]);
        }
        $body = [
            'txHash' => $txHash,
            'depositAddress' => $settlement['deposit_address'],
        ];
        if (!empty($settlement['deposit_memo'])) {
            $body['memo'] = $settlement['deposit_memo'];
        }
        if ($nearSenderAccount !== null && $nearSenderAccount !== '') {
            $body['nearSenderAccount'] = $nearSenderAccount;
        }
        $result = $this->client->submitDeposit($body);
        $wpdb->update($wpdb->prefix . 'mf_settlements', [
            'source_tx_hash' => $txHash,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $settlement_id]);
        if (!is_wp_error($result)) {
            $this->ingestStatus($org_id, $settlement_id, $result);
        }
        return $this->find($org_id, $settlement_id) ?? [];
    }

    public function refreshStatus(int $org_id, int $settlement_id): array|\WP_Error
    {
        $settlement = $this->find($org_id, $settlement_id);
        if (!$settlement || empty($settlement['deposit_address'])) {
            return new \WP_Error('matchflow_not_found', 'Settlement not found.', ['status' => 404]);
        }
        $status = $this->client->getStatus((string) $settlement['deposit_address'], $settlement['deposit_memo'] ?: null);
        if (is_wp_error($status)) {
            return $status;
        }
        return $this->ingestStatus($org_id, $settlement_id, $status);
    }

    public function ingestStatus(int $org_id, int $settlement_id, array $statusPayload): array|\WP_Error
    {
        global $wpdb;
        $settlement = $this->find($org_id, $settlement_id);
        if (!$settlement) {
            return new \WP_Error('matchflow_not_found', 'Settlement not found.', ['status' => 404]);
        }

        $sigValid = $this->verifier->verifyStatusPayload($statusPayload);
        $provider = (string) ($statusPayload['status'] ?? 'UNKNOWN');
        $normalized = $this->normalizeStatus($provider);

        if (!$sigValid && $normalized === 'SUCCESS') {
            $normalized = 'UNKNOWN_REVIEW';
            $this->appendEvent($settlement_id, $provider, $normalized, $statusPayload, false);
            return new \WP_Error('matchflow_invalid_status_signature', 'Status signature invalid; settlement not reconciled.', ['status' => 502]);
        }

        $this->appendEvent($settlement_id, $provider, $normalized, $statusPayload, $sigValid);

        $destTx = null;
        $swap = $statusPayload['swapDetails'] ?? [];
        if (!empty($swap['destinationChainTxHashes'][0]['hash'])) {
            $destTx = $swap['destinationChainTxHashes'][0]['hash'];
        }

        $wpdb->update($wpdb->prefix . 'mf_settlements', [
            'status' => $provider,
            'normalized_status' => $normalized,
            'destination_tx_hash' => $destTx ?: $settlement['destination_tx_hash'],
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $settlement_id]);

        if ($normalized === 'SUCCESS' && $sigValid && empty($settlement['reconciled_at'])) {
            $this->reconcile($org_id, $settlement_id, $statusPayload);
        } elseif (in_array($normalized, ['FAILED', 'REFUNDED', 'INCOMPLETE'], true)) {
            if ($normalized === 'REFUNDED') {
                $this->ledger->writeRefundEntry($org_id, $this->find($org_id, $settlement_id) ?? $settlement);
            }
            $this->notifications->notify($org_id, null, 'settlement_failed', [
                'settlement_id' => $settlement_id,
                'status' => $normalized,
            ]);
            AuditLogger::record($org_id, 'settlement.' . strtolower($normalized), (string) $settlement['subject_type'], (int) $settlement['subject_id'], null, ['settlement_id' => $settlement_id]);
        }

        return $this->find($org_id, $settlement_id) ?? [];
    }

    public function find(int $org_id, int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_settlements WHERE organization_id = %d AND id = %d', $org_id, $id), ARRAY_A);
        if (!$row) {
            return null;
        }
        $row['events'] = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_settlement_events WHERE settlement_id = %d ORDER BY id ASC', $id), ARRAY_A) ?: [];
        return $row;
    }

    public function listPending(): array
    {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}mf_settlements WHERE normalized_status IN ('PENDING_DEPOSIT','KNOWN_DEPOSIT_TX','INCOMPLETE_DEPOSIT','PROCESSING') ORDER BY id ASC LIMIT 100",
            ARRAY_A
        ) ?: [];
    }

    private function reconcile(int $org_id, int $settlement_id, array $statusPayload): void
    {
        global $wpdb;
        $settlement = $this->find($org_id, $settlement_id);
        if (!$settlement || $settlement['reconciled_at']) {
            return;
        }

        // Validate destination basics when present.
        $amount = (string) $settlement['destination_amount_decimal'];
        if ($settlement['purpose'] === 'AR_COLLECTION' && $settlement['subject_type'] === 'ar_invoice') {
            (new InvoiceService())->applyPayment($org_id, (int) $settlement['subject_id'], $amount);
        }
        if ($settlement['purpose'] === 'AR_COLLECTION' && $settlement['subject_type'] === 'ar_payment_request') {
            (new PaymentRequestService())->applyPayment($org_id, (int) $settlement['subject_id'], $amount);
        }
        if ($settlement['purpose'] === 'AP_SETTLEMENT' && $settlement['subject_type'] === 'ap_bill') {
            $bill = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bills WHERE id = %d AND organization_id = %d', (int) $settlement['subject_id'], $org_id), ARRAY_A);
            if ($bill) {
                $paid = Money::add((string) $bill['amount_paid_decimal'], $amount);
                $outstanding = Money::sub((string) $bill['total_decimal'], $paid);
                $status = Money::cmp($outstanding, '0') <= 0 ? 'paid' : 'partially_paid';
                $wpdb->update($wpdb->prefix . 'mf_ap_bills', [
                    'amount_paid_decimal' => $paid,
                    'amount_outstanding_decimal' => Money::cmp($outstanding, '0') < 0 ? '0' : $outstanding,
                    'status' => $status,
                    'updated_at' => gmdate('Y-m-d H:i:s'),
                ], ['id' => (int) $bill['id']]);
            }
        }

        $fresh = $this->find($org_id, $settlement_id) ?? $settlement;
        $this->ledger->writeSettlementEntry($org_id, $fresh);
        $this->receipts->issueForSettlement($org_id, $settlement_id);
        $this->notifications->notify($org_id, null, 'settlement_success', [
            'settlement_id' => $settlement_id,
            'amount' => $amount,
        ]);
        AuditLogger::record($org_id, 'settlement.reconciled', (string) $settlement['subject_type'], (int) $settlement['subject_id'], null, ['settlement_id' => $settlement_id]);

        $wpdb->update($wpdb->prefix . 'mf_settlements', [
            'reconciled_at' => gmdate('Y-m-d H:i:s'),
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ], ['id' => $settlement_id]);
    }

    /**
     * @param array<string, mixed> $trusted
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    private function policyContext(int $org_id, string $purpose, array $trusted, array $input): array
    {
        global $wpdb;
        $ctx = [
            'purpose' => $purpose,
            'amount_decimal' => $trusted['destination_amount_decimal'],
            'asset_id' => $trusted['destination_asset_id'],
            'requester_is_approver' => !empty($input['requester_is_approver']),
        ];
        if ($purpose === 'AP_SETTLEMENT') {
            $bill = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bills WHERE organization_id = %d AND id = %d', $org_id, (int) $trusted['subject_id']), ARRAY_A);
            $supplier = $bill ? $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_counterparties WHERE id = %d', (int) $bill['supplier_id']), ARRAY_A) : null;
            $ctx['supplier_approved'] = !empty($supplier['approved']);
            $ctx['match_status'] = (string) ($bill['match_status'] ?? '');
            $ctx['is_exact_duplicate'] = ($bill['match_status'] ?? '') === 'duplicate';
        }
        $spent = (string) ($wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(destination_amount_decimal),0) FROM {$wpdb->prefix}mf_settlements WHERE organization_id = %d AND normalized_status = 'SUCCESS' AND reconciled_at >= %s",
            $org_id,
            gmdate('Y-m-d 00:00:00')
        )) ?: '0');
        $ctx['daily_settled_decimal'] = $spent;
        return $ctx;
    }

    /**
     * @return array{asset: string, address: string}
     */
    private function orgSettlementDefaults(int $org_id): array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT preferred_destination_asset, preferred_destination_address, reporting_currency FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d',
            $org_id
        ), ARRAY_A) ?: [];
        $asset = trim((string) ($row['preferred_destination_asset'] ?? ''));
        $address = trim((string) ($row['preferred_destination_address'] ?? ''));
        $reporting = strtoupper(trim((string) ($row['reporting_currency'] ?? 'USD')));
        if ($asset === '') {
            $fallback = trim((string) (get_option('matchflow_default_destination_asset', '') ?: ''));
            if ($fallback !== '') {
                $asset = $fallback;
            } elseif (UsdSettlement::isUsdDenominated($reporting)) {
                $asset = UsdSettlement::defaultUsdSettlementAsset();
            } else {
                $asset = 'nep141:wrap.near';
            }
        } elseif (UsdSettlement::isUsdDenominated($reporting) && !UsdSettlement::isStablecoinAsset($asset)) {
            $asset = UsdSettlement::defaultUsdSettlementAsset();
        }
        return ['asset' => $asset, 'address' => $address];
    }

    private function resolveTrustedInstruction(int $org_id, string $purpose, array $input): array|\WP_Error
    {
        global $wpdb;
        if ($purpose === 'AR_COLLECTION') {
            $subjectType = sanitize_key((string) ($input['subject_type'] ?? 'ar_invoice'));
            if ($subjectType === 'ar_payment_request') {
                $pr = (new PaymentRequestService())->find($org_id, (int) ($input['subject_id'] ?? 0));
                if (!$pr || !in_array($pr['status'], ['open', 'partially_paid'], true)) {
                    return new \WP_Error('matchflow_invalid', 'Payment request is not open.', ['status' => 409]);
                }
                $defaults = $this->orgSettlementDefaults($org_id);
                $amount = (string) $pr['amount_outstanding_decimal'];
                $destAsset = trim((string) ($pr['destination_asset_id'] ?: ($input['destination_asset_id'] ?? '') ?: $defaults['asset']));
                $amounts = UsdSettlement::resolveQuoteAmounts((string) ($pr['currency'] ?? 'USD'), $amount, $destAsset);
                $recipient = trim((string) ($pr['destination_address'] ?: ($input['recipient_address'] ?? '') ?: $defaults['address']));
                if ($destAsset === '' || $recipient === '') {
                    return new \WP_Error(
                        'matchflow_no_recipient',
                        'Merchant has not configured a settlement destination. Set Settings → Settlement before accepting payments.',
                        ['status' => 409]
                    );
                }
                return [
                    'subject_type' => 'ar_payment_request',
                    'subject_id' => (int) $pr['id'],
                    'origin_asset_id' => (string) ($input['origin_asset_id'] ?? ''),
                    'destination_asset_id' => $amounts['quote_destination_asset_id'],
                    'destination_amount_decimal' => $amounts['destination_amount_decimal'],
                    'destination_amount_atomic' => $amounts['destination_amount_atomic'],
                    'recipient_address' => $recipient,
                    'refund_address' => (string) ($input['refund_address'] ?? ''),
                ];
            }

            $invoice = (new InvoiceService())->find($org_id, (int) ($input['subject_id'] ?? 0));
            if (!$invoice || !in_array($invoice['status'], ['issued', 'partially_paid', 'overdue'], true)) {
                return new \WP_Error('matchflow_invalid', 'Invoice not payable.', ['status' => 409]);
            }
            $defaults = $this->orgSettlementDefaults($org_id);
            $amount = (string) $invoice['amount_outstanding_decimal'];
            $destAsset = trim((string) ($invoice['destination_asset_id'] ?: ($input['destination_asset_id'] ?? '') ?: $defaults['asset']));
            $amounts = UsdSettlement::resolveQuoteAmounts((string) ($invoice['currency'] ?? 'USD'), $amount, $destAsset);
            $recipient = trim((string) ($invoice['destination_address'] ?: ($input['recipient_address'] ?? '') ?: $defaults['address']));
            if ($destAsset === '' || $recipient === '') {
                return new \WP_Error(
                    'matchflow_no_recipient',
                    'Merchant has not configured a settlement destination. Set Settings → Settlement before accepting payments.',
                    ['status' => 409]
                );
            }
            return [
                'subject_type' => 'ar_invoice',
                'subject_id' => (int) $invoice['id'],
                'origin_asset_id' => (string) ($input['origin_asset_id'] ?? ''),
                'destination_asset_id' => $amounts['quote_destination_asset_id'],
                'destination_amount_decimal' => $amounts['destination_amount_decimal'],
                'destination_amount_atomic' => $amounts['destination_amount_atomic'],
                'recipient_address' => $recipient,
                'refund_address' => (string) ($input['refund_address'] ?? ''),
            ];
        }

        $bill = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bills WHERE organization_id = %d AND id = %d', $org_id, (int) ($input['subject_id'] ?? 0)), ARRAY_A);
        if (!$bill || !in_array($bill['status'], ['approved', 'ready_to_pay', 'matched'], true)) {
            return new \WP_Error('matchflow_invalid', 'Bill not eligible for payment.', ['status' => 409]);
        }
        if (($bill['match_status'] ?? '') === 'exception') {
            return new \WP_Error('matchflow_match_failed', 'Cannot pay a bill with match exceptions.', ['status' => 409]);
        }
        $addr = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'mf_counterparty_addresses WHERE organization_id = %d AND counterparty_id = %d AND status = %s ORDER BY verified_at DESC LIMIT 1',
            $org_id,
            (int) $bill['supplier_id'],
            'verified'
        ), ARRAY_A);
        if (!$addr) {
            return new \WP_Error('matchflow_no_recipient', 'Supplier has no verified settlement address.', ['status' => 409]);
        }
        $amount = (string) $bill['amount_outstanding_decimal'];
        $destAsset = (string) ($addr['asset_id']);
        $amounts = UsdSettlement::resolveQuoteAmounts((string) ($bill['currency'] ?? 'USD'), $amount, $destAsset);
        return [
            'subject_type' => 'ap_bill',
            'subject_id' => (int) $bill['id'],
            'origin_asset_id' => (string) ($input['origin_asset_id'] ?? ''),
            'destination_asset_id' => $amounts['quote_destination_asset_id'],
            'destination_amount_decimal' => $amounts['destination_amount_decimal'],
            'destination_amount_atomic' => $amounts['destination_amount_atomic'],
            'recipient_address' => (string) $addr['address'],
            'refund_address' => (string) ($input['refund_address'] ?? ''),
        ];
    }

    private function normalizeStatus(string $provider): string
    {
        $known = ['PENDING_DEPOSIT', 'KNOWN_DEPOSIT_TX', 'INCOMPLETE_DEPOSIT', 'PROCESSING', 'SUCCESS', 'REFUNDED', 'FAILED'];
        return in_array($provider, $known, true) ? $provider : 'UNKNOWN_REVIEW';
    }

    private function appendEvent(int $settlement_id, string $provider, string $normalized, array $payload, ?bool $sigValid): void
    {
        global $wpdb;
        $redacted = $payload;
        unset($redacted['raw']);
        $hash = hash('sha256', wp_json_encode($redacted));
        $exists = $wpdb->get_var($wpdb->prepare(
            'SELECT id FROM ' . $wpdb->prefix . 'mf_settlement_events WHERE settlement_id = %d AND payload_hash = %s LIMIT 1',
            $settlement_id,
            $hash
        ));
        if ($exists) {
            return;
        }
        $wpdb->insert($wpdb->prefix . 'mf_settlement_events', [
            'settlement_id' => $settlement_id,
            'provider_status' => $provider,
            'normalized_status' => $normalized,
            'payload_hash' => $hash,
            'signature_valid' => $sigValid === null ? null : ($sigValid ? 1 : 0),
            'event_json_redacted' => wp_json_encode($redacted),
            'observed_at' => gmdate('Y-m-d H:i:s'),
        ]);
    }
}
