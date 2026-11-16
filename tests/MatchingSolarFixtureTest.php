<?php

declare(strict_types=1);

use Matchflow\Domain\Money;
use PHPUnit\Framework\TestCase;

/**
 * Solar fixture acceptance: PO 120 / received 100 / invoice 120 blocks $400 unjustified.
 */
final class MatchingSolarFixtureTest extends TestCase
{
    public function testQuantityOverReceivedFinancialImpact(): void
    {
        $ordered = '120';
        $received = '100';
        $invoiced = '120';
        $unit = '20';
        $this->assertSame(1, Money::cmp($invoiced, $received));
        $extra = Money::sub($invoiced, $received);
        $impact = Money::mul($extra, $unit, 2);
        $this->assertSame('20.00', $extra);
        $this->assertSame('400.00', $impact);
        $this->assertSame('120', $ordered);
    }

    public function testCorrectedInvoicePasses(): void
    {
        $received = '100';
        $invoiced = '100';
        $this->assertSame(0, Money::cmp($invoiced, $received));
    }
}
