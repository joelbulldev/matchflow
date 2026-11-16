<?php
/**
 * USD / USDC-denominated receivables → 1Click EXACT_OUTPUT in stablecoin units.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\NearIntents;

use Matchflow\Domain\Money;

defined('ABSPATH') || exit;

final class UsdSettlement
{
    /** Native NEAR USDC (1Click tokens API). */
    public const NEAR_USDC_ASSET_ID = 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';

    public const STABLE_DECIMALS = 6;

    public static function isUsdDenominated(string $currency): bool
    {
        $c = strtoupper(trim($currency));
        return in_array($c, ['USD', 'USDC', 'USDT', 'BUSD', 'DAI'], true);
    }

    public static function isStablecoinAsset(string $assetId): bool
    {
        $id = strtolower(trim($assetId));
        if ($id === '') {
            return false;
        }
        return (bool) preg_match('/(usdc|usdt|usd\.f|usd\.)/', $id);
    }

    public static function defaultUsdSettlementAsset(): string
    {
        $opt = trim((string) (getenv('MATCHFLOW_DEFAULT_USD_SETTLEMENT_ASSET')
            ?: get_option('matchflow_default_usd_settlement_asset', '')));
        if ($opt !== '') {
            return $opt;
        }
        $opt2 = trim((string) (get_option('matchflow_default_destination_asset', '') ?: ''));
        if ($opt2 !== '' && self::isStablecoinAsset($opt2)) {
            return $opt2;
        }
        return self::NEAR_USDC_ASSET_ID;
    }

    /**
     * @return array{
     *   quote_destination_asset_id: string,
     *   destination_amount_decimal: string,
     *   destination_amount_atomic: string,
     *   ledger_currency: string
     * }
     */
    public static function resolveQuoteAmounts(string $currency, string $outstandingDecimal, string $configuredDestAsset): array
    {
        $outstandingDecimal = Money::normalize($outstandingDecimal, 8);
        $configuredDestAsset = trim($configuredDestAsset);

        if (!self::isUsdDenominated($currency)) {
            $decimals = AssetDecimals::forAsset($configuredDestAsset);
            return [
                'quote_destination_asset_id' => $configuredDestAsset,
                'destination_amount_decimal' => $outstandingDecimal,
                'destination_amount_atomic' => Money::toAtomic($outstandingDecimal, $decimals),
                'ledger_currency' => $currency,
            ];
        }

        $quoteAsset = self::isStablecoinAsset($configuredDestAsset)
            ? $configuredDestAsset
            : self::defaultUsdSettlementAsset();
        $decimals = AssetDecimals::forAsset($quoteAsset, self::STABLE_DECIMALS);

        return [
            'quote_destination_asset_id' => $quoteAsset,
            'destination_amount_decimal' => $outstandingDecimal,
            'destination_amount_atomic' => Money::toAtomic($outstandingDecimal, $decimals),
            'ledger_currency' => $currency,
        ];
    }
}