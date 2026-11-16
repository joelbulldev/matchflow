<?php
/**
 * Branded invoice HTML for live preview & print-to-PDF (classic, minimal, bold).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Receivables;

defined('ABSPATH') || exit;

final class InvoicePdf
{
    public function renderHtml(array $invoice): string
    {
        $theme = strtolower((string) ($invoice['brand_theme'] ?? 'classic'));
        if (!in_array($theme, ['classic', 'minimal', 'bold'], true)) {
            $theme = 'classic';
        }

        $ctx = $this->buildContext($invoice);

        return match ($theme) {
            'minimal' => $this->renderMinimalLayout($ctx),
            'bold' => $this->renderBoldLayout($ctx),
            default => $this->renderClassicLayout($ctx),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function buildContext(array $invoice): array
    {
        global $wpdb;
        $orgId = (int) ($invoice['organization_id'] ?? 0);
        $orgName = $orgId > 0
            ? (string) $wpdb->get_var($wpdb->prepare(
                'SELECT name FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d',
                $orgId
            ))
            : '';
        if ($orgName === '') {
            $orgName = get_bloginfo('name') ?: 'MATCHFLOW';
        }

        $linesHtml = '';
        $subtotal = 0.0;
        $tax = 0.0;
        foreach (($invoice['items'] ?? []) as $item) {
            $qty = (float) ($item['quantity_decimal'] ?? 0);
            $unit = (float) ($item['unit_price_decimal'] ?? 0);
            $line = (float) ($item['line_total_decimal'] ?? ($qty * $unit));
            $rate = (float) ($item['tax_rate_decimal'] ?? 0);
            $lineSub = $qty * $unit;
            $lineTax = $lineSub * ($rate / 100);
            $subtotal += $lineSub;
            $tax += $lineTax;
            $linesHtml .= sprintf(
                '<tr><td>%s</td><td class="num">%s</td><td class="num">%s</td><td class="num">%s</td></tr>',
                esc_html((string) ($item['description'] ?? '')),
                esc_html(rtrim(rtrim(sprintf('%.4f', $qty), '0'), '.')),
                esc_html(number_format($unit, 2)),
                esc_html(number_format($line, 2))
            );
        }

        $total = (float) ($invoice['total_decimal'] ?? ($subtotal + $tax));
        $paid = (float) ($invoice['amount_paid_decimal'] ?? 0);
        $outstanding = (float) ($invoice['amount_outstanding_decimal'] ?? max(0, $total - $paid));
        $currency = esc_html((string) ($invoice['currency'] ?? 'USD'));

        return [
            'orgName' => esc_html($orgName),
            'number' => esc_html((string) ($invoice['invoice_number'] ?? '')),
            'status' => esc_html((string) ($invoice['status'] ?? '')),
            'issue' => esc_html((string) ($invoice['issue_date'] ?? '')),
            'due' => esc_html((string) ($invoice['due_date'] ?? '')),
            'customer' => esc_html((string) ($invoice['customer_name'] ?? 'Customer')),
            'customerEmail' => esc_html((string) ($invoice['customer_email'] ?? '')),
            'notes' => esc_html((string) ($invoice['notes'] ?? '')),
            'currency' => $currency,
            'linesHtml' => $linesHtml,
            'subtotal' => number_format($subtotal, 2),
            'tax' => number_format($tax, 2),
            'total' => number_format($total, 2),
            'paid' => number_format($paid, 2),
            'outstanding' => number_format($outstanding, 2),
        ];
    }

    private function sharedHead(string $title): string
    {
        return <<<HTML
<meta charset="utf-8" />
<title>{$title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, sans-serif; color: #0f172a; margin: 0; background: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: #64748b; }
  td { font-size: 13px; }
  @media print { body { background: #fff; } .sheet { margin: 0 !important; box-shadow: none !important; } }
</style>
HTML;
    }

    /**
     * @param array<string, mixed> $c
     */
    private function renderClassicLayout(array $c): string
    {
        $notes = $c['notes'] !== '' ? '<p class="notes">' . $c['notes'] . '</p>' : '';
        $billEmail = $c['customerEmail'] !== '' ? '<div>' . $c['customerEmail'] . '</div>' : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
{$this->sharedHead('Invoice ' . $c['number'])}
<style>
  .sheet { max-width: 800px; margin: 28px auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 24px 60px -32px rgba(15,23,42,.25); }
  .bar { height: 8px; background: linear-gradient(90deg,#0d9488,#14b8a6); }
  .head { display: flex; justify-content: space-between; gap: 24px; padding: 28px 36px 22px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .brand { font-size: 10px; font-weight: 700; letter-spacing: 0.28em; color: #0d9488; }
  h1 { margin: 8px 0 0; font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
  .meta { color: #64748b; font-size: 13px; line-height: 1.6; }
  .body { padding: 28px 36px 36px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; margin-bottom: 6px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 11px 8px; }
  thead th { border-bottom: 1px solid #cbd5e1; }
  .totals { margin-top: 20px; max-width: 280px; margin-left: auto; font-size: 14px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; color: #475569; }
  .totals .grand { color: #0f172a; font-weight: 700; font-size: 17px; border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; }
  .notes { margin-top: 24px; font-size: 13px; color: #64748b; white-space: pre-wrap; }
  .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="sheet">
  <div class="bar"></div>
  <div class="head">
    <div>
      <p class="brand">{$c['orgName']}</p>
      <h1>Invoice</h1>
      <p class="meta"><strong>{$c['number']}</strong></p>
    </div>
    <div class="meta" style="text-align:right">
      <div>Status: {$c['status']}</div>
      <div>Issued {$c['issue']}</div>
      <div>Due {$c['due']}</div>
      <div>{$c['currency']}</div>
    </div>
  </div>
  <div class="body">
    <div class="grid2">
      <div><p class="label">Bill to</p><strong>{$c['customer']}</strong>{$billEmail}</div>
      <div><p class="label">Pay online</p><p class="meta">Use your MATCHFLOW payment link for Intents checkout.</p></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>{$c['linesHtml']}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span class="num">{$c['subtotal']}</span></div>
      <div><span>Tax</span><span class="num">{$c['tax']}</span></div>
      <div><span>Paid</span><span class="num">{$c['paid']}</span></div>
      <div class="grand"><span>Total due</span><span class="num">{$c['outstanding']}</span></div>
    </div>
    {$notes}
    <p class="footer">Generated by MATCHFLOW · Settlement proof is on-chain receipt, not this document alone.</p>
  </div>
</div>
</body>
</html>
HTML;
    }

    /**
     * @param array<string, mixed> $c
     */
    private function renderMinimalLayout(array $c): string
    {
        $notes = $c['notes'] !== '' ? '<p class="notes">' . $c['notes'] . '</p>' : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
{$this->sharedHead('Invoice ' . $c['number'])}
<style>
  .sheet { max-width: 760px; margin: 40px auto; background: #fff; padding: 48px 52px; border: 1px solid #e2e8f0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  h1 { margin: 0; font-size: 22px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: #334155; }
  .org { font-size: 13px; color: #64748b; margin-top: 8px; }
  .id { font-size: 13px; color: #0f172a; font-weight: 600; }
  .rule { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }
  .bill { font-size: 14px; margin-bottom: 28px; }
  th, td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  thead th { border-bottom-color: #e2e8f0; }
  .totals { margin-top: 24px; text-align: right; font-size: 14px; }
  .totals div { display: flex; justify-content: flex-end; gap: 48px; padding: 4px 0; color: #64748b; }
  .totals .grand { color: #0f172a; font-weight: 600; font-size: 16px; margin-top: 8px; }
  .notes { font-size: 12px; color: #94a3b8; margin-top: 32px; white-space: pre-wrap; }
</style>
</head>
<body>
<div class="sheet">
  <div class="top">
    <div><h1>Invoice</h1><p class="org">{$c['orgName']}</p></div>
    <div style="text-align:right"><p class="id">#{$c['number']}</p><p class="org">Due {$c['due']}</p></div>
  </div>
  <hr class="rule" />
  <p class="bill"><span style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.1em">Bill to</span><br/><strong>{$c['customer']}</strong></p>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>{$c['linesHtml']}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span class="num">{$c['subtotal']}</span></div>
    <div><span>Tax</span><span class="num">{$c['tax']}</span></div>
    <div class="grand"><span>Total</span><span class="num">{$c['total']}</span></div>
  </div>
  {$notes}
</div>
</body>
</html>
HTML;
    }

    /**
     * @param array<string, mixed> $c
     */
    private function renderBoldLayout(array $c): string
    {
        $notes = $c['notes'] !== '' ? '<p class="notes">' . $c['notes'] . '</p>' : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
{$this->sharedHead('Invoice ' . $c['number'])}
<style>
  .sheet { max-width: 860px; margin: 24px auto; display: grid; grid-template-columns: 220px 1fr; min-height: 640px; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 32px 80px -40px rgba(15,23,42,.45); }
  .rail { background: linear-gradient(165deg,#0f172a 0%,#134e4a 100%); color: #fff; padding: 36px 28px; }
  .rail h1 { margin: 0; font-size: 34px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
  .rail .org { margin-top: 12px; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.85; }
  .rail .num { margin-top: 32px; font-size: 13px; opacity: 0.9; line-height: 1.6; }
  .main { padding: 36px 40px; }
  .bill { margin-bottom: 28px; }
  .bill .label { font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #0d9488; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 6px; }
  thead th { color: #0f172a; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .totals { margin-top: 24px; display: grid; gap: 6px; max-width: 260px; margin-left: auto; }
  .totals div { display: flex; justify-content: space-between; font-size: 14px; color: #475569; }
  .totals .grand { font-size: 18px; font-weight: 700; color: #0f172a; padding-top: 10px; border-top: 2px solid #0f172a; }
  .notes { margin-top: 24px; font-size: 12px; color: #64748b; white-space: pre-wrap; }
</style>
</head>
<body>
<div class="sheet">
  <aside class="rail">
    <h1>INVOICE</h1>
    <p class="org">{$c['orgName']}</p>
    <p class="num">#{$c['number']}<br/>Due {$c['due']}<br/>{$c['currency']}</p>
  </aside>
  <div class="main">
    <div class="bill"><p class="label">Bill to</p><p style="font-size:16px;font-weight:600;margin:6px 0 0">{$c['customer']}</p></div>
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>{$c['linesHtml']}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span class="num">{$c['subtotal']}</span></div>
      <div><span>Tax</span><span class="num">{$c['tax']}</span></div>
      <div><span>Paid</span><span class="num">{$c['paid']}</span></div>
      <div class="grand"><span>Balance due</span><span class="num">{$c['outstanding']}</span></div>
    </div>
    {$notes}
  </div>
</div>
</body>
</html>
HTML;
    }

    /** @deprecated Use renderHtml + browser print; kept for backward compatibility. */
    public function renderMinimalPdf(array $invoice): string
    {
        return $this->renderHtml($invoice);
    }
}