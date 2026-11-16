<?php
/**
 * Idempotency-Key store for mutating financial endpoints.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class Idempotency
{
    public static function keyFromRequest(): ?string
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        foreach ($headers ?: [] as $name => $value) {
            if (strtolower((string) $name) === 'idempotency-key') {
                $key = trim((string) $value);
                return $key !== '' ? $key : null;
            }
        }
        return null;
    }

    public static function remember(string $scope, string $key, array $payload, int $ttl = 86400): void
    {
        set_transient(self::transientKey($scope, $key), $payload, $ttl);
    }

    public static function recall(string $scope, string $key): ?array
    {
        $cached = get_transient(self::transientKey($scope, $key));
        return is_array($cached) ? $cached : null;
    }

    private static function transientKey(string $scope, string $key): string
    {
        return 'mf_idem_' . md5($scope . '|' . $key);
    }
}
