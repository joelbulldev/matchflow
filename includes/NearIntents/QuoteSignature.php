<?php
/**
 * 1Click quote signature hashing (aligned with @defuse-protocol/one-click-sdk-typescript).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\NearIntents;

defined('ABSPATH') || exit;

final class QuoteSignature
{
    /** @var list<string> */
    private const REQUEST_KEYS = [
        'dry',
        'swapType',
        'slippageTolerance',
        'originAsset',
        'depositType',
        'destinationAsset',
        'amount',
        'refundTo',
        'refundType',
        'recipient',
        'recipientType',
        'deadline',
        'quoteWaitingTimeMs',
        'referral',
        'virtualChainRecipient',
        'virtualChainRefundRecipient',
        'customRecipientMsg',
    ];

    /** @var list<string> */
    private const DRY_QUOTE_KEYS = [
        'amountIn',
        'amountInFormatted',
        'amountInUsd',
        'minAmountIn',
        'amountOut',
        'amountOutFormatted',
        'amountOutUsd',
        'minAmountOut',
    ];

    public static function quoteHash(array $quoteResponse): string
    {
        $request = self::buildSignedQuoteRequest($quoteResponse);
        $quote = self::buildSignedQuote($quoteResponse);
        $timestamp = $quoteResponse['timestamp'] ?? '';
        if ($timestamp === null || $timestamp === '') {
            $timestamp = '';
        }
        $payload = array_merge($request, $quote, ['timestamp' => $timestamp]);
        $json = self::stableJson($payload);
        return self::base58Encode(hash('sha256', $json, true));
    }

    /**
     * @return array<string, mixed>
     */
    private static function buildSignedQuoteRequest(array $quoteResponse): array
    {
        $quoteRequest = is_array($quoteResponse['quoteRequest'] ?? null) ? $quoteResponse['quoteRequest'] : [];
        $optionalOnlyIfTruthy = [
            'quoteWaitingTimeMs',
            'referral',
            'virtualChainRecipient',
            'virtualChainRefundRecipient',
            'customRecipientMsg',
        ];
        $out = [];
        foreach (self::REQUEST_KEYS as $key) {
            if (!array_key_exists($key, $quoteRequest)) {
                continue;
            }
            $value = $quoteRequest[$key];
            if (in_array($key, $optionalOnlyIfTruthy, true)) {
                // Match SDK: optional request fields use truthy checks (0 / "" / false omitted).
                if ($value === null || $value === '' || $value === false || $value === [] || $value === 0) {
                    continue;
                }
            } elseif ($value === null) {
                continue;
            }
            if ($key === 'slippageTolerance' && is_numeric($value)) {
                $out[$key] = (int) $value;
                continue;
            }
            if ($key === 'dry') {
                $out[$key] = (bool) $value;
                continue;
            }
            $out[$key] = $value;
        }
        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private static function buildSignedQuote(array $quoteResponse): array
    {
        $quote = is_array($quoteResponse['quote'] ?? null) ? $quoteResponse['quote'] : [];
        $dry = (bool) ($quoteResponse['quoteRequest']['dry'] ?? true);
        $out = [];
        foreach (self::DRY_QUOTE_KEYS as $key) {
            if (!array_key_exists($key, $quote)) {
                continue;
            }
            $value = $quote[$key];
            if ($value === null) {
                continue;
            }
            $out[$key] = $value;
        }
        if ($dry) {
            return $out;
        }
        /** @var list<string> */
        $liveKeys = [
            'depositAddress',
            'depositMemo',
            'deadline',
            'timeWhenInactive',
            'timeEstimate',
            'refundFee',
            'withdrawFee',
        ];
        foreach ($liveKeys as $key) {
            if (!array_key_exists($key, $quote)) {
                continue;
            }
            $value = $quote[$key];
            if ($value === null || $value === '' || $value === false) {
                continue;
            }
            if ($key === 'timeEstimate' && $value === 0) {
                continue;
            }
            $out[$key] = $value;
        }
        return $out;
    }

    public static function stableJson(array $data): string
    {
        return self::stringify($data);
    }

    private static function stringify(mixed $value): string
    {
        if (is_array($value)) {
            if (self::isList($value)) {
                $parts = [];
                foreach ($value as $item) {
                    $parts[] = self::stringify($item);
                }
                return '[' . implode(',', $parts) . ']';
            }
            $keys = array_keys($value);
            sort($keys, SORT_STRING);
            $parts = [];
            foreach ($keys as $key) {
                $parts[] = self::stringify((string) $key) . ':' . self::stringify($value[$key]);
            }
            return '{' . implode(',', $parts) . '}';
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if ($value === null) {
            return 'null';
        }
        if (is_int($value) || is_float($value)) {
            return json_encode($value, JSON_UNESCAPED_SLASHES);
        }
        return json_encode((string) $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private static function isList(array $arr): bool
    {
        if ($arr === []) {
            return true;
        }
        return array_keys($arr) === range(0, count($arr) - 1);
    }

    private static function base58Encode(string $binary): string
    {
        $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        $bytes = array_values(unpack('C*', $binary) ?: []);
        $zeros = 0;
        foreach ($bytes as $b) {
            if ($b === 0) {
                $zeros++;
            } else {
                break;
            }
        }
        $digits = [0];
        foreach ($bytes as $byte) {
            $carry = $byte;
            for ($i = 0, $l = count($digits); $i < $l; $i++) {
                $carry += $digits[$i] << 8;
                $digits[$i] = $carry % 58;
                $carry = intdiv($carry, 58);
            }
            while ($carry > 0) {
                $digits[] = $carry % 58;
                $carry = intdiv($carry, 58);
            }
        }
        $out = str_repeat('1', $zeros);
        for ($i = count($digits) - 1; $i >= 0; $i--) {
            $out .= $alphabet[$digits[$i]];
        }
        return $out;
    }
}
