<?php
/**
 * Resolve 1Click asset decimal scale for atomic amounts.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\NearIntents;

defined('ABSPATH') || exit;

final class AssetDecimals
{
    public static function isStablecoinAsset(string $assetId): bool
    {
        return UsdSettlement::isStablecoinAsset($assetId);
    }

    /**
     * Decimals for EXACT_OUTPUT amount passed to 1Click (smallest unit of destination asset).
     */
    public static function forAsset(string $assetId, ?int $clientHint = null): int
    {
        $assetId = trim($assetId);
        if ($assetId === '') {
            return $clientHint ?? 6;
        }

        $fromList = self::fromCachedTokenList($assetId);
        if ($fromList !== null) {
            return $fromList;
        }

        $heuristic = self::heuristic($assetId);
        if ($heuristic !== null) {
            return $heuristic;
        }

        return $clientHint ?? 6;
    }

    private static function fromCachedTokenList(string $assetId): ?int
    {
        $cached = get_transient('matchflow_supported_assets');
        if (!is_array($cached)) {
            return null;
        }
        $needle = strtolower($assetId);
        foreach ($cached as $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = strtolower((string) ($row['assetId'] ?? ''));
            if ($id !== $needle) {
                continue;
            }
            $decimals = (int) ($row['decimals'] ?? 0);
            return $decimals > 0 ? $decimals : null;
        }
        return null;
    }

    private static function heuristic(string $assetId): ?int
    {
        $id = strtolower($assetId);
        if (str_ends_with($id, ':wrap.near') || $id === 'nep141:wrap.near') {
            return 24;
        }
        if (preg_match('/(usdc|usdt|usd\.|usd\.f)/', $id)) {
            return 6;
        }
        if (str_contains($id, 'btc')) {
            return 8;
        }
        if (preg_match('/eth-0x|\.omft\.near/', $id) && !preg_match('/(usdc|usdt)/', $id)) {
            return 18;
        }
        return null;
    }
}