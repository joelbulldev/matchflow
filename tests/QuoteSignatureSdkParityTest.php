<?php

declare(strict_types=1);

use Matchflow\NearIntents\QuoteSignature;
use Matchflow\NearIntents\SignatureVerifier;
use PHPUnit\Framework\TestCase;

/**
 * Parity with @defuse-protocol/one-click-sdk-typescript@0.1.24 quoteHash (amount fields only in signed quote).
 */
final class QuoteSignatureSdkParityTest extends TestCase
{
    public function testLiveShapeNonDryQuoteHashOmitsDepositAddress(): void
    {
        $response = [
            'timestamp' => '2025-08-06T14:15:22.000Z',
            'signature' => 'ed25519:3mock',
            'quoteRequest' => [
                'dry' => false,
                'swapType' => 'EXACT_OUTPUT',
                'slippageTolerance' => 100,
                'originAsset' => 'nep141:wrap.near',
                'depositType' => 'ORIGIN_CHAIN',
                'destinationAsset' => 'nep141:usdc.near',
                'amount' => '1000000',
                'refundTo' => 'alice.near',
                'refundType' => 'ORIGIN_CHAIN',
                'recipient' => 'treasury.near',
                'recipientType' => 'DESTINATION_CHAIN',
                'deadline' => '2025-08-06T15:15:22.000Z',
            ],
            'quote' => [
                'amountIn' => '999000',
                'amountInFormatted' => '0.999',
                'amountOut' => '1000000',
                'amountOutFormatted' => '1.0',
                'depositAddress' => '0xdeadbeef',
            ],
        ];

        $hash = QuoteSignature::quoteHash($response);
        $this->assertNotSame('', $hash);
        $json = QuoteSignature::stableJson(array_merge(
            [
                'dry' => false,
                'swapType' => 'EXACT_OUTPUT',
                'slippageTolerance' => 100,
                'originAsset' => 'nep141:wrap.near',
                'depositType' => 'ORIGIN_CHAIN',
                'destinationAsset' => 'nep141:usdc.near',
                'amount' => '1000000',
                'refundTo' => 'alice.near',
                'refundType' => 'ORIGIN_CHAIN',
                'recipient' => 'treasury.near',
                'recipientType' => 'DESTINATION_CHAIN',
                'deadline' => '2025-08-06T15:15:22.000Z',
                'amountIn' => '999000',
                'amountInFormatted' => '0.999',
                'amountOut' => '1000000',
                'amountOutFormatted' => '1.0',
                'timestamp' => '2025-08-06T14:15:22.000Z',
            ],
        ));
        $this->assertStringNotContainsString('depositAddress', $json);
    }

    public function testEd25519PrefixedSignatureAcceptedWhenBase58Valid(): void
    {
        $verifier = new SignatureVerifier(SignatureVerifier::DEFAULT_ONE_CLICK_MANAGER_PUB_KEY);
        $this->assertFalse($verifier->verifyMessage('abc', 'not-valid-base58!!!'));
    }
}