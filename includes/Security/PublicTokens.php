<?php
/**
 * Opaque public tokens (hashed at rest).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class PublicTokens
{
    public static function create(int $org_id, string $scope, string $subject_type, int $subject_id, int $ttl_seconds = 0): string
    {
        global $wpdb;
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $hash = hash('sha256', $token);
        $wpdb->insert($wpdb->prefix . 'mf_public_tokens', [
            'token_hash' => $hash,
            'scope' => $scope,
            'subject_type' => $subject_type,
            'subject_id' => $subject_id,
            'organization_id' => $org_id,
            'expires_at' => $ttl_seconds > 0 ? gmdate('Y-m-d H:i:s', time() + $ttl_seconds) : null,
            'revoked_at' => null,
            'last_used_at' => null,
            'created_at' => gmdate('Y-m-d H:i:s'),
        ]);
        return $token;
    }

    public static function resolve(string $token, ?string $scope = null): ?array
    {
        global $wpdb;
        $hash = hash('sha256', $token);
        $row = $wpdb->get_row(
            $wpdb->prepare(
                'SELECT * FROM ' . $wpdb->prefix . 'mf_public_tokens WHERE token_hash = %s LIMIT 1',
                $hash
            ),
            ARRAY_A
        );
        if (!$row || $row['revoked_at']) {
            return null;
        }
        if ($scope && $row['scope'] !== $scope) {
            return null;
        }
        if (!empty($row['expires_at']) && strtotime($row['expires_at'] . ' UTC') < time()) {
            return null;
        }
        $wpdb->update($wpdb->prefix . 'mf_public_tokens', ['last_used_at' => gmdate('Y-m-d H:i:s')], ['id' => $row['id']]);
        return $row;
    }

    public static function revokeBySubject(string $subject_type, int $subject_id): void
    {
        global $wpdb;
        $wpdb->query(
            $wpdb->prepare(
                'UPDATE ' . $wpdb->prefix . 'mf_public_tokens SET revoked_at = %s WHERE subject_type = %s AND subject_id = %d AND revoked_at IS NULL',
                gmdate('Y-m-d H:i:s'),
                $subject_type,
                $subject_id
            )
        );
    }
}
