<?php
/**
 * In-app notifications and mail template stubs.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Notifications;

defined('ABSPATH') || exit;

final class NotificationService
{
    public function notify(int $org_id, ?int $user_id, string $type, array $payload): int
    {
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'mf_notifications',
            [
                'organization_id' => $org_id,
                'user_id' => $user_id,
                'type' => $type,
                'payload_json' => wp_json_encode($payload),
                'read_at' => null,
                'created_at' => gmdate('Y-m-d H:i:s'),
            ]
        );
        return (int) $wpdb->insert_id;
    }

    public function sendMailTemplate(string $template, string $to, array $vars): bool
    {
        $subjects = [
            'invoice_issued' => 'Invoice {{invoice_number}} from {{org_name}}',
            'invoice_reminder' => 'Reminder: invoice {{invoice_number}} is due',
            'receipt' => 'Payment receipt {{settlement_id}}',
            'approval_requested' => 'Approval needed: {{subject}}',
            'settlement_success' => 'Settlement SUCCESS {{settlement_id}}',
            'settlement_failed' => 'Settlement failed {{settlement_id}}',
        ];
        $bodies = [
            'invoice_issued' => "Your invoice {{invoice_number}} is ready.\nPay: {{payment_url}}",
            'invoice_reminder' => "Invoice {{invoice_number}} is overdue. Outstanding: {{amount}}",
            'receipt' => "Settlement {{settlement_id}} completed successfully.",
            'approval_requested' => "Please review {{subject}} in MATCHFLOW.",
            'settlement_success' => "Settlement {{settlement_id}} reached SUCCESS.",
            'settlement_failed' => "Settlement {{settlement_id}} failed. Review exceptions in MATCHFLOW.",
        ];

        if (!isset($subjects[$template])) {
            return false;
        }

        $subject = $this->render($subjects[$template], $vars);
        $body = $this->render($bodies[$template], $vars);
        $html = EmailTemplates::html($template, $vars);
        $headers = ['Content-Type: text/html; charset=UTF-8'];
        return (bool) wp_mail($to, $subject, $html, $headers);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listForUser(int $org_id, int $user_id, int $limit = 50): array
    {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                'SELECT * FROM ' . $wpdb->prefix . 'mf_notifications WHERE organization_id = %d AND (user_id = %d OR user_id IS NULL) ORDER BY id DESC LIMIT %d',
                $org_id,
                $user_id,
                $limit
            ),
            ARRAY_A
        ) ?: [];
    }

    public function markRead(int $org_id, int $user_id, int $notification_id): bool
    {
        global $wpdb;
        // Allow personal rows and org-wide (user_id NULL) notifications.
        $sql = $wpdb->prepare(
            'UPDATE ' . $wpdb->prefix . 'mf_notifications
             SET read_at = %s
             WHERE id = %d AND organization_id = %d AND (user_id = %d OR user_id IS NULL)',
            gmdate('Y-m-d H:i:s'),
            $notification_id,
            $org_id,
            $user_id
        );
        return false !== $wpdb->query($sql);
    }

    /**
     * @param array<string, scalar> $vars
     */
    private function render(string $template, array $vars): string
    {
        $out = $template;
        foreach ($vars as $key => $value) {
            $out = str_replace('{{' . $key . '}}', (string) $value, $out);
        }
        return $out;
    }
}
