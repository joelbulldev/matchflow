<?php
/**
 * Compact settlement receipt HTML (receipt / A6).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Ledger;

use Matchflow\NearIntents\AssetLabels;

defined('ABSPATH') || exit;

final class SettlementReceiptPdf
{
    /**
     * @param array<string, mixed> $view
     */
    public function renderHtml(array $view): string
    {
        $merchant = esc_html((string) ($view['merchantName'] ?? 'MATCHFLOW'));
        $invoice = esc_html((string) ($view['invoiceNumber'] ?? ''));
        $purpose = esc_html((string) ($view['purposeLabel'] ?? 'Payment'));
        $amount = esc_html((string) ($view['amountDisplay'] ?? ''));
        $asset = esc_html((string) ($view['assetLabel'] ?? ''));
        $recipient = esc_html((string) ($view['recipient'] ?? ''));
        $destTx = esc_html((string) ($view['destinationTxHash'] ?? ''));
        $sourceTx = esc_html((string) ($view['sourceTxHash'] ?? ''));
        $reconciled = esc_html((string) ($view['reconciledAt'] ?? ''));
        $settlementId = esc_html((string) ($view['settlementId'] ?? ''));
        $invoiceLine = $invoice !== '' ? '<p>Invoice ' . $invoice . '</p>' : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt {$invoice}</title>
<style>
  @page { margin: 12mm; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 10pt; color: #111; line-height: 1.45; margin: 0; }
  .hdr { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  .hdr h1 { font-size: 14pt; margin: 0 0 4px; letter-spacing: 0.04em; text-transform: uppercase; }
  .hdr p { margin: 0; font-size: 9pt; color: #444; }
  .amt { text-align: center; font-size: 20pt; font-weight: bold; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  td { padding: 5px 0; vertical-align: top; font-size: 9pt; }
  td.lbl { color: #555; width: 38%; }
  td.val { text-align: right; font-family: DejaVu Sans Mono, monospace; word-break: break-all; }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px dashed #999; font-size: 8pt; color: #666; text-align: center; }
  .ok { color: #0a6b3a; font-weight: bold; }
</style>
</head>
<body>
  <div class="hdr">
    <h1>Payment receipt</h1>
    <p>{$merchant}</p>
    {$invoiceLine}
  </div>
  <p class="amt">{$amount}</p>
  <table>
    <tr><td class="lbl">Status</td><td class="val ok">SUCCESS</td></tr>
    <tr><td class="lbl">Purpose</td><td class="val">{$purpose}</td></tr>
    <tr><td class="lbl">Settlement asset</td><td class="val">{$asset}</td></tr>
    <tr><td class="lbl">Recipient</td><td class="val">{$recipient}</td></tr>
    <tr><td class="lbl">Destination tx</td><td class="val">{$destTx}</td></tr>
    <tr><td class="lbl">Origin tx</td><td class="val">{$sourceTx}</td></tr>
    <tr><td class="lbl">Reconciled (UTC)</td><td class="val">{$reconciled}</td></tr>
    <tr><td class="lbl">Settlement ID</td><td class="val">{$settlementId}</td></tr>
  </table>
  <p class="foot">On-chain settlement verified via NEAR Intents. Keep this receipt for your records.</p>
</body>
</html>
HTML;
    }

    /**
     * @param array<string, mixed> $settlement
     * @param array<string, mixed> $context
     * @return array<string, mixed>
     */
    public static function buildView(array $settlement, array $context): array
    {
        $currency = strtoupper(trim((string) ($context['currency'] ?? 'USD')));
        $amount = trim((string) ($settlement['destination_amount_decimal'] ?? ''));
        if ($amount === '' || $amount === '0' || $amount === '0.00000000') {
            $amount = trim((string) ($context['total'] ?? $context['outstanding_paid'] ?? ''));
        }
        $symbol = in_array($currency, ['USD', 'USDC', 'USDT'], true) ? '$' : '';
        $amountDisplay = $symbol !== '' ? $symbol . number_format((float) $amount, 2, '.', ',') . ' ' . $currency : $amount . ' ' . $currency;

        $purpose = (string) ($settlement['purpose'] ?? '');
        $purposeLabel = match ($purpose) {
            'AR_COLLECTION' => 'Invoice payment',
            'AP_SETTLEMENT' => 'Supplier payment',
            default => $purpose !== '' ? $purpose : 'Payment',
        };

        return [
            'merchantName' => (string) ($context['organizationName'] ?? ''),
            'invoiceNumber' => (string) ($context['invoiceNumber'] ?? ''),
            'currency' => $currency,
            'amountDisplay' => $amountDisplay,
            'amountDecimal' => $amount,
            'purposeLabel' => $purposeLabel,
            'assetId' => (string) ($settlement['destination_asset_id'] ?? ''),
            'assetLabel' => AssetLabels::label((string) ($settlement['destination_asset_id'] ?? '')),
            'recipient' => (string) ($settlement['recipient_address'] ?? ''),
            'destinationTxHash' => (string) ($settlement['destination_tx_hash'] ?? ''),
            'sourceTxHash' => (string) ($settlement['source_tx_hash'] ?? ''),
            'reconciledAt' => (string) ($settlement['reconciled_at'] ?? $settlement['updated_at'] ?? ''),
            'settlementId' => (string) ($settlement['id'] ?? ''),
        ];
    }
}