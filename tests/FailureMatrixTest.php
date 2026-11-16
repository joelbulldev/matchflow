<?php

declare(strict_types=1);

use Matchflow\Domain\Money;
use Matchflow\NearIntents\SignatureVerifier;
use Matchflow\Policies\PolicyEngine;
use PHPUnit\Framework\TestCase;

/**
 * DEMO-labelled failure matrix fixtures (not live mainnet proofs).
 */
final class FailureMatrixTest extends TestCase
{
    public function testBadQuoteSignatureFailsClosed(): void
    {
        $verifier = new SignatureVerifier('');
        $this->assertFalse($verifier->verifyQuotePayload([
            'signature' => 'not-valid',
            'timestamp' => time(),
            'quote' => ['amountIn' => '1'],
            'quoteRequest' => [],
        ]));
    }

    public function testDuplicateFinancialImpactDemo(): void
    {
        // DEMO: invoiced beyond received creates measurable exception amount.
        $impact = Money::mul(Money::sub('120', '100'), '20', 2);
        $this->assertSame('400.00', $impact);
    }

    public function testKillSwitchDemo(): void
    {
        $engine = new class extends PolicyEngine {
            public function activeRules(int $org_id): array
            {
                return array_merge(self::DEFAULT_RULES, ['kill_switch' => true]);
            }
        };
        $result = $engine->evaluate(1, ['purpose' => 'AP_SETTLEMENT', 'amount_decimal' => '1']);
        $this->assertFalse($result['ok']);
    }
}
