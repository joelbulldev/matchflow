<?php

declare(strict_types=1);

use Matchflow\NearIntents\SignatureVerifier;
use PHPUnit\Framework\TestCase;

final class SignatureVerifierFailClosedTest extends TestCase
{
    public function testEmptyPublicKeyFailsClosed(): void
    {
        putenv('MATCHFLOW_ALLOW_UNVERIFIED_QUOTES');
        putenv('MATCHFLOW_NEAR_QUOTE_PUBLIC_KEY');
        $verifier = new SignatureVerifier();
        $ok = $verifier->verifyQuotePayload(['quote' => ['amountIn' => '1'], 'signature' => 'abc']);
        $this->assertFalse($ok);
    }
}
