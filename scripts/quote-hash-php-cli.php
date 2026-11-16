<?php
declare(strict_types=1);

define('ABSPATH', __DIR__);

require_once dirname(__DIR__) . '/includes/NearIntents/QuoteSignature.php';
require_once dirname(__DIR__) . '/includes/NearIntents/SignatureVerifier.php';

use Matchflow\NearIntents\QuoteSignature;
use Matchflow\NearIntents\SignatureVerifier;

$sample = json_decode((string) file_get_contents(__DIR__ . '/quote-sample.json'), true, 512, JSON_THROW_ON_ERROR);

$hash = QuoteSignature::quoteHash($sample);
$verifier = new SignatureVerifier(SignatureVerifier::DEFAULT_ONE_CLICK_MANAGER_PUB_KEY);
$valid = $verifier->verifyQuotePayload($sample);

echo 'hash: ' . $hash . PHP_EOL;
echo 'valid: ' . ($valid ? 'true' : 'false') . PHP_EOL;
echo 'expected hash: CboiVM67TwxER7uGG5sdNiNbqDW2d9xN8n8FaitV3nCt' . PHP_EOL;