<?php
/**
 * NEAR JSON-RPC endpoint resolution (dRPC URL, key-only, or defaults).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Near;

defined('ABSPATH') || exit;

final class NearRpc
{
    public static function defaultMainnet(): string
    {
        return 'https://rpc.mainnet.fastnear.com';
    }

    public static function defaultTestnet(): string
    {
        return 'https://rpc.testnet.fastnear.com';
    }

    /**
     * Raw value from env or WP option (URL, dRPC path, or key segment).
     */
    public static function configuredRaw(): string
    {
        $fromEnv = getenv('MATCHFLOW_NEAR_RPC_URL') ?: getenv('MATCHFLOW_NEAR_API_KEY');
        if (is_string($fromEnv) && trim($fromEnv) !== '') {
            return trim($fromEnv);
        }
        $opt = get_option('matchflow_near_api_key', '');
        return is_string($opt) ? trim($opt) : '';
    }

    public static function isCustomConfigured(): bool
    {
        return self::configuredRaw() !== '';
    }

    public static function resolveUrl(?string $network = null): string
    {
        $network = $network ?? (string) (get_option('matchflow_near_network', 'mainnet') ?: 'mainnet');
        $raw = self::configuredRaw();
        if ($raw !== '') {
            return self::normalizeToUrl($raw);
        }
        return $network === 'testnet' ? self::defaultTestnet() : self::defaultMainnet();
    }

    /**
     * @return list<string>
     */
    public static function providersForNetwork(string $network): array
    {
        return [self::resolveUrl($network)];
    }

    private static function normalizeToUrl(string $raw): string
    {
        if (str_contains($raw, '://')) {
            return $raw;
        }
        if (str_starts_with($raw, 'lb.drpc.live/')) {
            return 'https://' . $raw;
        }
        return 'https://lb.drpc.live/near/' . ltrim($raw, '/');
    }
}
