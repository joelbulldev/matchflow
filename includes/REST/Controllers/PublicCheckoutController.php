<?php
/**
 * Public checkout/status/receipt APIs.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Ledger\SettlementReceiptPdf;
use Matchflow\Ledger\SettlementReceiptPdfRenderer;
use Matchflow\Organizations\CheckoutBranding;
use Matchflow\Receivables\InvoiceService;
use Matchflow\Receivables\PaymentRequestService;
use Matchflow\REST\Response;
use Matchflow\Settlements\SettlementService;
use WP_REST_Request;

final class PublicCheckoutController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/public/invoices/(?P<token>[A-Za-z0-9_-]+)', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'invoice'],
        ]);
        register_rest_route($ns, '/public/invoices/(?P<token>[A-Za-z0-9_-]+)/quotes', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'quote'],
        ]);
        register_rest_route($ns, '/public/payments/(?P<token>[A-Za-z0-9_-]+)/status', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'status'],
        ]);
        register_rest_route($ns, '/public/payments/(?P<token>[A-Za-z0-9_-]+)/settlements/(?P<settlement_id>\\d+)/confirm-deposit', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'confirmDeposit'],
        ]);
        register_rest_route($ns, '/public/payments/(?P<token>[A-Za-z0-9_-]+)/settlements/(?P<settlement_id>\\d+)/refresh', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'refreshSettlement'],
        ]);
        register_rest_route($ns, '/public/receipts/(?P<token>[A-Za-z0-9_-]+)', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'receipt'],
        ]);
        register_rest_route($ns, '/public/receipts/(?P<token>[A-Za-z0-9_-]+)/pdf', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'receiptPdf'],
        ]);
        register_rest_route($ns, '/supported-assets', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'assets'],
        ]);
        register_rest_route($ns, '/public/config', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'config'],
        ]);
    }

    public static function config()
    {
        $near_ok = (bool) (
            get_option('matchflow_near_intents_jwt', '')
            || get_option('matchflow_near_intents_api_key', '')
            || getenv('MATCHFLOW_NEAR_INTENTS_JWT')
            || getenv('MATCHFLOW_NEAR_INTENTS_API_KEY')
        );
        $popular_raw = (string) get_option('matchflow_popular_origin_assets', '');
        $popular = array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $popular_raw) ?: [])));

        return Response::success([
            'nearIntentsConfigured' => $near_ok,
            'nearNetwork' => (string) (get_option('matchflow_near_network', 'mainnet') ?: 'mainnet'),
            'defaultOriginAssetId' => (string) (get_option('matchflow_default_origin_asset', 'nep141:wrap.near') ?: 'nep141:wrap.near'),
            'checkoutBrandName' => (string) (get_option('matchflow_checkout_brand_name', '') ?: ''),
            'checkoutMessage' => (string) (get_option('matchflow_checkout_message', '') ?: ''),
            'popularOriginAssets' => $popular !== [] ? $popular : [
                'nep141:wrap.near',
                'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
                'nep141:ethereum.omft.near',
            ],
        ]);
    }

    public static function invoice(WP_REST_Request $request)
    {
        $ctx = self::resolvePayToken((string) $request['token']);
        if (!$ctx) {
            return Response::error('matchflow_invalid_token', 'Payment link is invalid or expired.', 404);
        }
        return Response::success($ctx['public']);
    }

    public static function quote(WP_REST_Request $request)
    {
        $ctx = self::resolvePayToken((string) $request['token']);
        if (!$ctx) {
            return Response::error('matchflow_invalid_token', 'Payment link is invalid or expired.', 404);
        }
        $body = $request->get_json_params() ?: [];
        $dry = array_key_exists('dry', $body) ? (bool) $body['dry'] : true;
        $origin = strtolower((string) ($body['origin_asset_id'] ?? ''));
        $refund = trim((string) ($body['refund_address'] ?? ''));
        if (!$dry && $refund !== '') {
            $evmOrigin = str_contains($origin, 'base-0x') || str_contains($origin, 'eth-0x') || str_contains($origin, 'arb-0x') || str_contains($origin, 'ethereum.omft');
            if ($evmOrigin && !preg_match('/^0x[a-fA-F0-9]{40}$/', $refund)) {
                return Response::error(
                    'matchflow_invalid_refund',
                    'Use an Ethereum wallet address (0x…) as the refund address for this payment method.',
                    400
                );
            }
            if (!$evmOrigin && str_starts_with($refund, '0x')) {
                return Response::error(
                    'matchflow_invalid_refund',
                    'Connect your NEAR wallet — refunds for this payment method must be a .near account.',
                    400
                );
            }
        }
        $service = new SettlementService();
        $result = $service->createQuote((int) $ctx['org_id'], [
            'purpose' => 'AR_COLLECTION',
            'subject_type' => $ctx['subject_type'],
            'subject_id' => (int) $ctx['subject_id'],
            'origin_asset_id' => $body['origin_asset_id'] ?? '',
            'destination_asset_id' => $ctx['destination_asset_id'],
            'refund_address' => $body['refund_address'] ?? '',
            'destination_decimals' => (int) ($body['destination_decimals'] ?? 6),
            'swapType' => $body['swapType'] ?? 'EXACT_OUTPUT',
        ], $dry);
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function status(WP_REST_Request $request)
    {
        global $wpdb;
        $ctx = self::resolvePayToken((string) $request['token']);
        if (!$ctx) {
            return Response::error('matchflow_invalid_token', 'Payment link is invalid or expired.', 404);
        }
        $service = new SettlementService();
        $settlement = $wpdb->get_row($wpdb->prepare(
            'SELECT id, normalized_status, destination_tx_hash, deposit_address, source_tx_hash, updated_at FROM ' . $wpdb->prefix . 'mf_settlements
             WHERE organization_id = %d AND subject_type = %s AND subject_id = %d ORDER BY id DESC LIMIT 1',
            (int) $ctx['org_id'],
            $ctx['subject_type'],
            (int) $ctx['subject_id']
        ), ARRAY_A);
        if (is_array($settlement) && !empty($settlement['id']) && !empty($settlement['deposit_address'])) {
            $terminal = in_array((string) ($settlement['normalized_status'] ?? ''), ['SUCCESS', 'FAILED', 'REFUNDED'], true);
            if (!$terminal) {
                $refreshed = $service->refreshStatus((int) $ctx['org_id'], (int) $settlement['id']);
                if (!is_wp_error($refreshed)) {
                    $settlement = [
                        'id' => $refreshed['id'] ?? $settlement['id'],
                        'normalized_status' => $refreshed['normalized_status'] ?? $settlement['normalized_status'],
                        'destination_tx_hash' => $refreshed['destination_tx_hash'] ?? $settlement['destination_tx_hash'],
                        'deposit_address' => $refreshed['deposit_address'] ?? $settlement['deposit_address'],
                        'source_tx_hash' => $refreshed['source_tx_hash'] ?? $settlement['source_tx_hash'],
                        'updated_at' => $refreshed['updated_at'] ?? $settlement['updated_at'],
                    ];
                }
            }
        }
        if ($ctx['subject_type'] === 'ar_invoice') {
            $invoice = (new InvoiceService())->find((int) $ctx['org_id'], (int) $ctx['subject_id']);
            if (is_array($invoice)) {
                $ctx['public']['status'] = $invoice['status'];
                $ctx['public']['outstanding'] = $invoice['amount_outstanding_decimal'];
            }
        }
        return Response::success([
            'kind' => $ctx['kind'],
            'invoiceStatus' => $ctx['public']['status'],
            'outstanding' => $ctx['public']['outstanding'],
            'settlement' => $settlement,
            'receiptReady' => is_array($settlement) && ($settlement['normalized_status'] ?? '') === 'SUCCESS',
        ]);
    }

    public static function confirmDeposit(WP_REST_Request $request)
    {
        $ctx = self::resolvePayToken((string) $request['token']);
        if (!$ctx) {
            return Response::error('matchflow_invalid_token', 'Payment link is invalid or expired.', 404);
        }
        $settlement_id = (int) $request['settlement_id'];
        if (!self::settlementBelongsToContext($ctx, $settlement_id)) {
            return Response::error('matchflow_not_found', 'Settlement not found for this payment link.', 404);
        }
        $body = $request->get_json_params() ?: [];
        $tx = (string) ($body['txHash'] ?? '');
        $near = (string) ($body['nearSenderAccount'] ?? $body['near_sender_account'] ?? '');
        $result = (new SettlementService())->confirmDeposit(
            (int) $ctx['org_id'],
            $settlement_id,
            $tx,
            $near !== '' ? $near : null
        );
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function refreshSettlement(WP_REST_Request $request)
    {
        $ctx = self::resolvePayToken((string) $request['token']);
        if (!$ctx) {
            return Response::error('matchflow_invalid_token', 'Payment link is invalid or expired.', 404);
        }
        $settlement_id = (int) $request['settlement_id'];
        if (!self::settlementBelongsToContext($ctx, $settlement_id)) {
            return Response::error('matchflow_not_found', 'Settlement not found for this payment link.', 404);
        }
        $result = (new SettlementService())->refreshStatus((int) $ctx['org_id'], $settlement_id);
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function receipt(WP_REST_Request $request)
    {
        $ctx = self::resolvePayToken((string) $request['token']);
        if (!$ctx) {
            return Response::error('matchflow_invalid_token', 'Payment link is invalid or expired.', 404);
        }
        $bundle = self::successSettlementBundle($ctx);
        if (is_wp_error($bundle)) {
            return $bundle;
        }
        ['settlement' => $settlement, 'context' => $context] = $bundle;
        $view = SettlementReceiptPdf::buildView($settlement, $context);
        return Response::success([
            'status' => 'SUCCESS',
            'purpose' => $settlement['purpose'] ?? null,
            'purposeLabel' => $view['purposeLabel'],
            'amount' => $view['amountDecimal'],
            'currency' => $view['currency'],
            'assetId' => $view['assetId'],
            'assetLabel' => $view['assetLabel'],
            'recipient' => $view['recipient'],
            'destinationTxHash' => $view['destinationTxHash'],
            'sourceTxHash' => $view['sourceTxHash'],
            'reconciledAt' => $view['reconciledAt'],
            'settlementId' => (int) ($settlement['id'] ?? 0),
            'invoiceNumber' => $context['invoiceNumber'] ?? null,
            'organizationName' => $context['organizationName'] ?? null,
        ]);
    }

    public static function receiptPdf(WP_REST_Request $request)
    {
        $ctx = self::resolvePayToken((string) $request['token']);
        if (!$ctx) {
            return Response::error('matchflow_invalid_token', 'Payment link is invalid or expired.', 404);
        }
        $bundle = self::successSettlementBundle($ctx);
        if (is_wp_error($bundle)) {
            return $bundle;
        }
        ['settlement' => $settlement, 'context' => $context] = $bundle;
        $view = SettlementReceiptPdf::buildView($settlement, $context);
        $basename = sanitize_file_name(
            'receipt-' . ($context['invoiceNumber'] ?? (string) ($settlement['id'] ?? 'payment'))
        );
        try {
            $binary = (new SettlementReceiptPdfRenderer())->renderBinary($view);
            return Response::success([
                'pdfBase64' => base64_encode($binary),
                'filename' => $basename . '.pdf',
            ]);
        } catch (\Throwable $e) {
            $html = (new SettlementReceiptPdf())->renderHtml($view);
            return Response::success([
                'html' => $html,
                'filename' => $basename . '.pdf',
                'pdfFallback' => true,
                'message' => $e->getMessage() ?: 'PDF engine unavailable.',
            ]);
        }
    }

    /**
     * @param array<string, mixed> $ctx
     * @return array{settlement: array<string, mixed>, context: array<string, mixed>}|\WP_Error
     */
    private static function successSettlementBundle(array $ctx): array|\WP_Error
    {
        global $wpdb;
        $settlement = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'mf_settlements
             WHERE organization_id = %d AND subject_type = %s AND subject_id = %d AND normalized_status = %s
             ORDER BY id DESC LIMIT 1',
            (int) $ctx['org_id'],
            $ctx['subject_type'],
            (int) $ctx['subject_id'],
            'SUCCESS'
        ), ARRAY_A);
        if (!$settlement) {
            return new \WP_Error('matchflow_not_found', 'Receipt is available after settlement SUCCESS.', ['status' => 404]);
        }
        $public = is_array($ctx['public'] ?? null) ? $ctx['public'] : [];
        $context = [
            'currency' => (string) ($public['currency'] ?? 'USD'),
            'total' => (string) ($public['total'] ?? ''),
            'invoiceNumber' => (string) ($public['invoiceNumber'] ?? ($public['label'] ?? '')),
            'organizationName' => (string) ($public['organizationName'] ?? ''),
        ];
        return ['settlement' => $settlement, 'context' => $context];
    }

    public static function assets()
    {
        $cached = get_transient('matchflow_supported_assets');
        if (is_array($cached)) {
            return Response::success($cached);
        }
        $client = new \Matchflow\NearIntents\OneClickClient();
        $tokens = $client->getTokens();
        if (is_wp_error($tokens)) {
            return $tokens;
        }
        set_transient('matchflow_supported_assets', $tokens, 5 * MINUTE_IN_SECONDS);
        return Response::success($tokens);
    }

    /**
     * @return ?array{org_id: int, kind: string, subject_type: string, subject_id: int, destination_asset_id: string, public: array<string, mixed>}
     */
    private static function resolvePayToken(string $token): ?array
    {
        global $wpdb;
        $invoice = (new InvoiceService())->findByPublicToken($token);
        if ($invoice) {
            $org = (int) $invoice['organization_id'];
            $orgRow = $wpdb->get_row($wpdb->prepare('SELECT name, checkout_display_name, checkout_tagline, checkout_accent_color, checkout_logo_url, checkout_support_email, checkout_message FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d', $org), ARRAY_A) ?: [];
            return [
                'org_id' => $org,
                'kind' => 'invoice',
                'subject_type' => 'ar_invoice',
                'subject_id' => (int) $invoice['id'],
                'destination_asset_id' => (string) ($invoice['destination_asset_id'] ?? ''),
                'public' => [
                    'kind' => 'invoice',
                    'invoiceNumber' => $invoice['invoice_number'],
                    'currency' => $invoice['currency'],
                    'total' => $invoice['total_decimal'],
                    'outstanding' => $invoice['amount_outstanding_decimal'],
                    'status' => $invoice['status'],
                    'dueDate' => $invoice['due_date'],
                    'paymentTerms' => $invoice['payment_terms'],
                    'destinationAssetId' => $invoice['destination_asset_id'],
                    'brandTheme' => $invoice['brand_theme'] ?? 'classic',
                    'organizationName' => $orgRow['checkout_display_name'] ?: $orgRow['name'] ?? '',
                    'checkoutTagline' => $orgRow['checkout_tagline'] ?? null,
                    'checkoutAccentColor' => self::normalizeAccentPublic($orgRow['checkout_accent_color'] ?? null),
                    'checkoutLogoUrl' => $orgRow['checkout_logo_url'] ?? null,
                    'checkoutSupportEmail' => $orgRow['checkout_support_email'] ?? null,
                    'checkoutMessage' => $orgRow['checkout_message'] ?? null,
                    'notes' => $invoice['notes'] ?? null,
                ],
            ];
        }

        $request = (new PaymentRequestService())->findByPublicToken($token);
        if (!$request) {
            return null;
        }
        $org = (int) $request['organization_id'];
        $orgRow = $wpdb->get_row($wpdb->prepare('SELECT name, checkout_display_name, checkout_tagline, checkout_accent_color, checkout_logo_url, checkout_support_email, checkout_message FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d', $org), ARRAY_A) ?: [];
        return [
            'org_id' => $org,
            'kind' => 'payment_request',
            'subject_type' => 'ar_payment_request',
            'subject_id' => (int) $request['id'],
            'destination_asset_id' => (string) ($request['destination_asset_id'] ?? ''),
            'public' => [
                'kind' => 'payment_request',
                'invoiceNumber' => $request['reference'],
                'label' => $request['label'],
                'description' => $request['description'],
                'currency' => $request['currency'],
                'total' => $request['amount_decimal'],
                'outstanding' => $request['amount_outstanding_decimal'],
                'status' => $request['status'],
                'destinationAssetId' => $request['destination_asset_id'],
                'brandTheme' => 'classic',
                'organizationName' => $orgRow['checkout_display_name'] ?: $orgRow['name'] ?? '',
                'checkoutTagline' => $orgRow['checkout_tagline'] ?? null,
                'checkoutAccentColor' => self::normalizeAccentPublic($orgRow['checkout_accent_color'] ?? null),
                'checkoutLogoUrl' => $orgRow['checkout_logo_url'] ?? null,
                'checkoutSupportEmail' => $orgRow['checkout_support_email'] ?? null,
                'checkoutMessage' => $request['description'] ?: ($orgRow['checkout_message'] ?? null),
            ],
        ];
    }

    private static function normalizeAccentPublic(mixed $color): ?string
    {
        return CheckoutBranding::normalizeAccent($color);
    }

    /**
     * @param array{org_id: int, subject_type: string, subject_id: int} $ctx
     */
    private static function settlementBelongsToContext(array $ctx, int $settlement_id): bool
    {
        global $wpdb;
        $id = $wpdb->get_var($wpdb->prepare(
            'SELECT id FROM ' . $wpdb->prefix . 'mf_settlements WHERE id = %d AND organization_id = %d AND subject_type = %s AND subject_id = %d',
            $settlement_id,
            (int) $ctx['org_id'],
            $ctx['subject_type'],
            (int) $ctx['subject_id']
        ));
        return $id !== null && (int) $id === $settlement_id;
    }
}
