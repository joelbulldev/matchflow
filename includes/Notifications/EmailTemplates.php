<?php
/**
 * Transactional HTML mail layouts (Matchflow design system).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Notifications;

defined('ABSPATH') || exit;

final class EmailTemplates
{
    /**
     * @param array<string, scalar> $vars
     */
    public static function html(string $template, array $vars): string
    {
        $org = esc_html((string) ($vars['org_name'] ?? 'MATCHFLOW'));
        $accent = '#0f766e';
        $body = match ($template) {
            'invoice_issued' => self::invoiceIssued($vars, $accent),
            'invoice_reminder' => self::invoiceReminder($vars, $accent),
            default => '<p>' . esc_html(self::plain($template, $vars)) . '</p>',
        };
        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Inter,Segoe UI,system-ui,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding:0 0 16px;font-size:11px;font-weight:700;letter-spacing:.18em;color:{$accent};text-transform:uppercase;">{$org}</td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;box-shadow:0 12px 40px -24px rgba(15,118,110,.35);">
      {$body}
    </td></tr>
    <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
      Powered by MATCHFLOW · cross-chain settlement via NEAR Intents
    </td></tr>
  </table>
</body>
</html>
HTML;
    }

    /**
     * @param array<string, scalar> $vars
     */
    private static function invoiceIssued(array $vars, string $accent): string
    {
        $num = esc_html((string) ($vars['invoice_number'] ?? ''));
        $amount = esc_html((string) ($vars['amount'] ?? ''));
        $url = esc_url((string) ($vars['payment_url'] ?? ''));
        $btn = $url !== '' ? '<a href="' . $url . '" style="display:inline-block;margin-top:20px;padding:12px 22px;background:' . $accent . ';color:#fff;font-weight:600;text-decoration:none;border-radius:10px;">Pay invoice</a>' : '';
        return '<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;">Invoice ' . $num . '</h1>'
            . '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">Your invoice is ready. Outstanding balance: <strong>' . $amount . '</strong>.</p>'
            . $btn
            . ($url !== '' ? '<p style="margin:16px 0 0;font-size:12px;word-break:break-all;color:#64748b;">' . esc_html($url) . '</p>' : '');
    }

    /**
     * @param array<string, scalar> $vars
     */
    private static function invoiceReminder(array $vars, string $accent): string
    {
        $num = esc_html((string) ($vars['invoice_number'] ?? ''));
        $amount = esc_html((string) ($vars['amount'] ?? ''));
        $url = esc_url((string) ($vars['payment_url'] ?? ''));
        $btn = $url !== '' ? '<a href="' . $url . '" style="display:inline-block;margin-top:20px;padding:12px 22px;background:' . $accent . ';color:#fff;font-weight:600;text-decoration:none;border-radius:10px;">Pay now</a>' : '';
        return '<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;">Payment reminder</h1>'
            . '<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#334155;">Invoice <strong>' . $num . '</strong> is still open. Outstanding: <strong>' . $amount . '</strong>.</p>'
            . $btn;
    }

    /**
     * @param array<string, scalar> $vars
     */
    public static function plain(string $template, array $vars): string
    {
        $subjects = [
            'invoice_issued' => 'Invoice {{invoice_number}} is ready. Pay: {{payment_url}}',
            'invoice_reminder' => 'Reminder: invoice {{invoice_number}} — outstanding {{amount}}. Pay: {{payment_url}}',
        ];
        $tpl = $subjects[$template] ?? '';
        foreach ($vars as $key => $value) {
            $tpl = str_replace('{{' . $key . '}}', (string) $value, $tpl);
        }
        return $tpl;
    }
}
