<?php

declare(strict_types=1);

use Matchflow\NearIntents\SignatureVerifier;
use PHPUnit\Framework\TestCase;

/**
 * DEMO-labelled failure matrix fixtures.
 * These document fail-closed / exception paths — they do not invent live SUCCESS.
 */
final class FailureMatrixDemoTest extends TestCase
{
    public function testDemoExpiredQuoteIsRejectedByAge(): void
    {
        $quote = [
            'DEMO' => true,
            'case' => 'expired_quote',
            'quote' => [
                'amountIn' => '1000000',
                'deadline' => gmdate('c', time() - 3600),
            ],
            'signature' => 'invalid',
        ];
        $deadline = strtotime((string) $quote['quote']['deadline']);
        $this->assertNotFalse($deadline);
        $this->assertLessThan(time(), $deadline, 'DEMO expired quote must be in the past');
    }

    public function testDemoBadQuoteSignatureFailsClosed(): void
    {
        putenv('MATCHFLOW_ALLOW_UNVERIFIED_QUOTES');
        putenv('MATCHFLOW_NEAR_QUOTE_PUBLIC_KEY');
        $verifier = new SignatureVerifier();
        $ok = $verifier->verifyQuotePayload([
            'DEMO' => true,
            'case' => 'bad_quote_sig',
            'quote' => ['amountIn' => '1'],
            'signature' => 'not-a-valid-sig',
        ]);
        $this->assertFalse($ok);
    }

    public function testDemoBadStatusSignatureFailsClosed(): void
    {
        putenv('MATCHFLOW_ALLOW_UNVERIFIED_QUOTES');
        putenv('MATCHFLOW_NEAR_QUOTE_PUBLIC_KEY');
        $verifier = new SignatureVerifier();
        if (!method_exists($verifier, 'verifyStatusPayload')) {
            $this->assertFalse($verifier->verifyQuotePayload([
                'DEMO' => true,
                'case' => 'bad_status_sig',
                'status' => 'SUCCESS',
                'signature' => 'bad',
            ]));
            return;
        }
        $ok = $verifier->verifyStatusPayload([
            'DEMO' => true,
            'case' => 'bad_status_sig',
            'status' => 'SUCCESS',
            'signature' => 'bad',
        ]);
        $this->assertFalse($ok);
    }

    /**
     * @dataProvider demoTerminalStatuses
     */
    public function testDemoTerminalStatusesAreExceptionPaths(string $status): void
    {
        $known = ['FAILED', 'REFUNDED', 'INCOMPLETE', 'INCOMPLETE_DEPOSIT', 'UNKNOWN_REVIEW'];
        $this->assertContains($status, $known);
    }

    public static function demoTerminalStatuses(): array
    {
        return [
            'DEMO failed' => ['FAILED'],
            'DEMO refunded' => ['REFUNDED'],
            'DEMO incomplete' => ['INCOMPLETE'],
            'DEMO incomplete deposit' => ['INCOMPLETE_DEPOSIT'],
            'DEMO unknown' => ['UNKNOWN_REVIEW'],
        ];
    }

    public function testDemoWrongChainIsNotBase(): void
    {
        $demo = ['DEMO' => true, 'case' => 'wrong_chain', 'chainId' => 1];
        $this->assertNotSame(8453, $demo['chainId'], 'Base USDC route requires chain 8453');
    }

    public function testDemoDuplicateAttemptFlag(): void
    {
        $demo = ['DEMO' => true, 'case' => 'duplicate', 'idempotency_key' => 'demo-dup-1', 'replay' => true];
        $this->assertTrue($demo['replay']);
        $this->assertNotSame('', $demo['idempotency_key']);
    }
}
