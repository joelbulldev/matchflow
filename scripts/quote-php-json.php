<?php
declare(strict_types=1);
define('ABSPATH', __DIR__);
require_once dirname(__DIR__) . '/includes/NearIntents/QuoteSignature.php';

use Matchflow\NearIntents\QuoteSignature;

$sample = json_decode((string) file_get_contents(__DIR__ . '/quote-sample.json'), true, 512, JSON_THROW_ON_ERROR);

$ref = new ReflectionClass(QuoteSignature::class);
$m1 = $ref->getMethod('buildSignedQuoteRequest');
$m1->setAccessible(true);
$m2 = $ref->getMethod('buildSignedQuote');
$m2->setAccessible(true);
$req = $m1->invoke(null, $sample);
$q = $m2->invoke(null, $sample);
$payload = array_merge($req, $q, ['timestamp' => $sample['timestamp']]);
echo QuoteSignature::stableJson($payload), PHP_EOL;