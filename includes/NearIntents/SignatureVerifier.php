<?php
/**
 * 1Click quote/status signature verification (stable JSON + SHA-256 + Base58 + Ed25519).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\NearIntents;

defined('ABSPATH') || exit;

final class SignatureVerifier
{
    /**
     * 1Click manager signing key (public), from @defuse-protocol/one-click-sdk-typescript.
     */
    public const DEFAULT_ONE_CLICK_MANAGER_PUB_KEY = 'ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc';

    private string $publicKeyBase58;

    public function __construct(?string $publicKeyBase58 = null)
    {
        $configured = $publicKeyBase58
            ?: get_option('matchflow_1click_public_key')
            ?: getenv('MATCHFLOW_1CLICK_PUBLIC_KEY')
            ?: '';

        $legacy = get_option('matchflow_near_intents_signing_key')
            ?: getenv('MATCHFLOW_NEAR_INTENTS_SIGNING_KEY')
            ?: '';
        if ($configured === '' && is_string($legacy) && self::looksLikeEd25519PublicKey($legacy)) {
            $configured = $legacy;
        }
        if ($configured === '') {
            $configured = self::DEFAULT_ONE_CLICK_MANAGER_PUB_KEY;
        }

        $this->publicKeyBase58 = is_string($configured) ? trim($configured) : '';
    }

    public function verifyQuotePayload(array $quoteResponse): bool
    {
        $quoteResponse = $this->normalizeQuoteResponse($quoteResponse);
        if (empty($quoteResponse['signature']) || empty($quoteResponse['timestamp'])) {
            return false;
        }

        $signature = $this->normalizeSignature((string) $quoteResponse['signature']);
        if ($signature === '') {
            return false;
        }
        $message = QuoteSignature::quoteHash($quoteResponse);

        return $this->verifyMessage($message, $signature);
    }

    public function verifyStatusPayload(array $statusResponse): bool
    {
        // Status responses embed quoteResponse which carries the signature.
        if (!empty($statusResponse['quoteResponse']) && is_array($statusResponse['quoteResponse'])) {
            return $this->verifyQuotePayload($statusResponse['quoteResponse']);
        }
        if (!empty($statusResponse['signature'])) {
            return $this->verifyQuotePayload($statusResponse);
        }
        return false;
    }

    public function verify(array $payload, string $signatureBase58): bool
    {
        try {
            $message = $this->base58Encode(hash('sha256', $this->stableJson($payload), true));
            return $this->verifyMessage($message, $signatureBase58);
        } catch (\Throwable) {
            return false;
        }
    }

    public function verifyMessage(string $messageUtf8, string $signatureBase58): bool
    {
        if ($this->publicKeyBase58 === '') {
            if (defined('MATCHFLOW_ALLOW_UNVERIFIED_QUOTES') && MATCHFLOW_ALLOW_UNVERIFIED_QUOTES) {
                return true;
            }
            return false;
        }

        try {
            $signature = $this->base58Decode($this->normalizeSignature($signatureBase58));
            $publicKey = $this->normalizePublicKey($this->publicKeyBase58);
            if ($signature === null || $publicKey === null || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES) {
                return false;
            }
            return sodium_crypto_sign_verify_detached($signature, $messageUtf8, $publicKey);
        } catch (\Throwable) {
            return false;
        }
    }

    public function stableJson(array $data): string
    {
        return $this->stringify($data);
    }

    private function stringify(mixed $value): string
    {
        if (is_array($value)) {
            if ($this->isList($value)) {
                $parts = [];
                foreach ($value as $item) {
                    $parts[] = $this->stringify($item);
                }
                return '[' . implode(',', $parts) . ']';
            }
            $keys = array_keys($value);
            sort($keys, SORT_STRING);
            $parts = [];
            foreach ($keys as $key) {
                $parts[] = $this->stringify((string) $key) . ':' . $this->stringify($value[$key]);
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

    private function isList(array $arr): bool
    {
        if ($arr === []) {
            return true;
        }
        return array_keys($arr) === range(0, count($arr) - 1);
    }

    /**
     * @param array<string, mixed> $quoteResponse
     * @return array<string, mixed>
     */
    private function normalizeQuoteResponse(array $quoteResponse): array
    {
        if (!empty($quoteResponse['quoteResponse']) && is_array($quoteResponse['quoteResponse'])) {
            $quoteResponse = $quoteResponse['quoteResponse'];
        }
        return $quoteResponse;
    }

    private function normalizeSignature(string $signature): string
    {
        $signature = trim($signature);
        if (str_starts_with($signature, 'ed25519:')) {
            return substr($signature, 8);
        }
        return $signature;
    }

    private static function looksLikeEd25519PublicKey(string $key): bool
    {
        $key = trim($key);
        if ($key === '') {
            return false;
        }
        if (str_starts_with($key, 'ed25519:')) {
            return true;
        }
        // Base58-encoded 32-byte Ed25519 public keys are typically 43–44 chars.
        return (bool) preg_match('/^[1-9A-HJ-NP-Za-km-z]{40,48}$/', $key);
    }

    private function normalizePublicKey(string $key): ?string
    {
        if (str_starts_with($key, 'ed25519:')) {
            $key = substr($key, 8);
        }
        $decoded = $this->base58Decode($key);
        if ($decoded === null) {
            return null;
        }
        // Some keys include a 32-byte seed only; Ed25519 verify needs 32-byte public key.
        if (strlen($decoded) === SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES) {
            return $decoded;
        }
        return null;
    }

    private function base58Encode(string $binary): string
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

    private function base58Decode(string $base58): ?string
    {
        $alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        $map = array_flip(str_split($alphabet));
        $bytes = [0];
        $zeros = 0;
        $len = strlen($base58);
        for ($i = 0; $i < $len && $base58[$i] === '1'; $i++) {
            $zeros++;
        }
        for (; $i < $len; $i++) {
            $ch = $base58[$i];
            if (!isset($map[$ch])) {
                return null;
            }
            $carry = $map[$ch];
            for ($j = 0, $l = count($bytes); $j < $l; $j++) {
                $carry += $bytes[$j] * 58;
                $bytes[$j] = $carry & 0xff;
                $carry >>= 8;
            }
            while ($carry > 0) {
                $bytes[] = $carry & 0xff;
                $carry >>= 8;
            }
        }
        $decoded = str_repeat("\x00", $zeros);
        for ($i = count($bytes) - 1; $i >= 0; $i--) {
            $decoded .= chr($bytes[$i]);
        }
        return $decoded;
    }
}
