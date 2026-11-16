<?php

declare(strict_types=1);

use Matchflow\NearIntents\QuoteSignature;
use Matchflow\NearIntents\SignatureVerifier;
use PHPUnit\Framework\TestCase;

final class QuoteLiveSampleTest extends TestCase
{
    /** @return array<string, mixed> */
    private function sample(): array
    {
        $raw = (string) file_get_contents(dirname(__DIR__) . '/scripts/quote-sample.json');
        $decoded = json_decode($raw, true);
        $this->assertIsArray($decoded);
        return $decoded;
    }

    public function testLiveQuoteHashMatchesOneClickSdk026(): void
    {
        $expected = 'CboiVM67TwxER7uGG5sdNiNbqDW2d9xN8n8FaitV3nCt';
        $this->assertSame($expected, QuoteSignature::quoteHash($this->sample()));
    }

    public function testLiveQuoteSignatureVerifiesWithDefaultKey(): void
    {
        $verifier = new SignatureVerifier(SignatureVerifier::DEFAULT_ONE_CLICK_MANAGER_PUB_KEY);
        $this->assertTrue($verifier->verifyQuotePayload($this->sample()));
    }
}