<?php

declare(strict_types=1);

use Matchflow\Domain\Money;
use Matchflow\NearIntents\UsdSettlement;
use PHPUnit\Framework\TestCase;

final class UsdSettlementTest extends TestCase
{
    public function testUsdInvoiceMapsToUsdcAtomicNotNearUnits(): void
    {
        $out = UsdSettlement::resolveQuoteAmounts(
            'USD',
            '0.05',
            'nep141:wrap.near',
        );
        $this->assertSame(UsdSettlement::NEAR_USDC_ASSET_ID, $out['quote_destination_asset_id']);
        $this->assertSame('0.05000000', $out['destination_amount_decimal']);
        $this->assertSame('50000', $out['destination_amount_atomic']);
        $this->assertSame('50000', Money::toAtomic('0.05', 6));
    }

    public function testStableDestinationUsesConfiguredAsset(): void
    {
        $usdc = 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near';
        $out = UsdSettlement::resolveQuoteAmounts('USD', '2500.00', $usdc);
        $this->assertSame($usdc, $out['quote_destination_asset_id']);
        $this->assertSame('2500000000', $out['destination_amount_atomic']);
    }
}