<?php

declare(strict_types=1);

use Matchflow\Domain\Money;
use PHPUnit\Framework\TestCase;

final class MoneyTest extends TestCase
{
    public function testLineTotalAndBalances(): void
    {
        $line = Money::lineTotal('2', '10.50', '1.00', '0.50');
        $this->assertSame('21.00000000', $line);
        $this->assertSame(1, Money::cmp('21', '20'));
        $atomic = Money::toAtomic('12.34', 2);
        $this->assertSame('1234', $atomic);
        $this->assertSame('12.34', Money::fromAtomic('1234', 2));
    }
}
