<?php

declare(strict_types=1);

use Matchflow\Domain\Money;
use PHPUnit\Framework\TestCase;

final class MoneyAllocationTest extends TestCase
{
    public function testPartialAndOverpayment(): void
    {
        $partial = Money::applyPayment('100.00', '0', '40.00', 2);
        $this->assertSame('40.00', $partial['amount_paid']);
        $this->assertSame('60.00', $partial['outstanding']);
        $this->assertSame('partially_paid', $partial['status']);

        $full = Money::applyPayment('100.00', '40.00', '60.00', 2);
        $this->assertSame('paid', $full['status']);
        $this->assertSame('0.00', $full['outstanding']);

        $over = Money::applyPayment('100.00', '0', '120.00', 2);
        $this->assertSame('overpaid', $over['status']);
        $this->assertSame('20.00', $over['overpayment']);
    }

    public function testAllocateAcrossInvoices(): void
    {
        $result = Money::allocate('150', [
            ['id' => 1, 'outstanding' => '100'],
            ['id' => 2, 'outstanding' => '80'],
        ], 2);
        $this->assertCount(2, $result['allocations']);
        $this->assertSame('100.00', $result['allocations'][0]['amount']);
        $this->assertSame('50.00', $result['allocations'][1]['amount']);
        $this->assertSame('0.00', $result['remainder']);
    }
}
