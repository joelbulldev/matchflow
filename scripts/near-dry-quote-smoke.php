<?php
/**
 * Priority-gate dry quote smoke (no fake SUCCESS).
 *
 * Usage (from repo root, with env or wp-config credentials):
 *   php scripts/near-dry-quote-smoke.php
 *
 * If MATCHFLOW_NEAR_INTENTS_API_KEY / JWT are missing, prints how-to and exits 0.
 */

declare(strict_types=1);

$root = dirname(__DIR__);
$apiKey = getenv('MATCHFLOW_NEAR_INTENTS_API_KEY') ?: '';
$jwt = getenv('MATCHFLOW_NEAR_INTENTS_JWT') ?: '';
$base = rtrim(getenv('MATCHFLOW_NEAR_INTENTS_BASE_URL') ?: 'https://1click.chaindefuser.com', '/');

if ($apiKey === '' && $jwt === '') {
    fwrite(STDOUT, <<<TXT
MATCHFLOW near-dry-quote-smoke: credentials not set.

How to run a real dry quote (priority-gate):
  1. Set MATCHFLOW_NEAR_INTENTS_API_KEY (preferred) or MATCHFLOW_NEAR_INTENTS_JWT
  2. Optionally MATCHFLOW_NEAR_INTENTS_BASE_URL
  3. Re-run: php scripts/near-dry-quote-smoke.php

This script never invents SUCCESS. Live SUCCESS is a human checklist item
(see docs/LIVE-NEAR-SMOKE.md and docs/SUBMISSION.md).

TXT);
    exit(0);
}

$headers = [
    'Accept: application/json',
    'Content-Type: application/json',
];
if ($apiKey !== '') {
    $headers[] = 'X-API-Key: ' . $apiKey;
} else {
    $headers[] = 'Authorization: Bearer ' . $jwt;
}

$body = [
    'dry' => true,
    'swapType' => 'EXACT_OUTPUT',
    'originAsset' => 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
    'destinationAsset' => 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
    'amount' => '10000',
    'refundTo' => '0x0000000000000000000000000000000000000001',
    'recipient' => '0x0000000000000000000000000000000000000001',
    'slippageTolerance' => 100,
    'deadline' => gmdate('c', time() + 600),
];

$ch = curl_init($base . '/v0/quote');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => json_encode($body),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
]);
$raw = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($raw === false) {
    fwrite(STDERR, "curl error: {$err}\n");
    exit(1);
}

fwrite(STDOUT, "HTTP {$code}\n{$raw}\n");
if ($code >= 400) {
    exit(1);
}
fwrite(STDOUT, "Dry quote smoke OK (not a settlement SUCCESS).\n");
exit(0);
