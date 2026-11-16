<?php
/**
 * Human labels for 1Click asset IDs.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\NearIntents;

defined('ABSPATH') || exit;

final class AssetLabels
{
    public static function label(string $assetId): string
    {
        $id = strtolower(trim($assetId));
        if ($id === '') {
            return '—';
        }
        if ($id === 'nep141:wrap.near' || str_ends_with($id, ':wrap.near')) {
            return 'NEAR (wNEAR)';
        }
        if (str_contains($id, '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1')) {
            return 'USDC (NEAR)';
        }
        if (str_contains($id, 'base-0x833589')) {
            return 'USDC (Base)';
        }
        if (str_contains($id, 'arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831')) {
            return 'USDC (Arbitrum)';
        }
        if (preg_match('/usdc/', $id)) {
            return 'USDC';
        }
        if (preg_match('/usdt/', $id)) {
            return 'USDT';
        }
        if (strlen($assetId) > 42) {
            return substr($assetId, 0, 18) . '…';
        }
        return $assetId;
    }
}