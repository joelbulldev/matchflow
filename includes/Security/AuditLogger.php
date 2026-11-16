<?php
/**
 * Append-only audit event writer.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class AuditLogger
{
    public static function record(
        ?int $organization_id,
        string $action,
        ?string $subject_type = null,
        ?int $subject_id = null,
        ?array $before = null,
        ?array $after = null,
        ?array $metadata = null
    ): void {
        global $wpdb;

        $wpdb->insert(
            $wpdb->prefix . 'mf_audit_events',
            [
                'organization_id' => $organization_id,
                'actor_user_id' => get_current_user_id() ?: null,
                'action' => $action,
                'subject_type' => $subject_type,
                'subject_id' => $subject_id,
                'before_hash' => $before !== null ? hash('sha256', (string) wp_json_encode($before)) : null,
                'after_hash' => $after !== null ? hash('sha256', (string) wp_json_encode($after)) : null,
                'metadata_redacted' => $metadata !== null ? wp_json_encode(self::redact($metadata)) : null,
                'created_at' => gmdate('Y-m-d H:i:s'),
            ]
        );
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private static function redact(array $data): array
    {
        $sensitive = ['password', 'password_hash', 'secret', 'api_key', 'token', 'authorization', 'private_key'];
        $out = [];
        foreach ($data as $key => $value) {
            $lk = strtolower((string) $key);
            if (in_array($lk, $sensitive, true) || str_contains($lk, 'secret') || str_contains($lk, 'password')) {
                $out[$key] = '[redacted]';
                continue;
            }
            if (is_array($value)) {
                $out[$key] = self::redact($value);
                continue;
            }
            $out[$key] = $value;
        }
        return $out;
    }
}
