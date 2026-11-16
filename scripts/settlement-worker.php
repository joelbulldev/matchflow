<?php
/**
 * CLI settlement monitor. Run via: wp eval-file scripts/settlement-worker.php
 * or: php scripts/settlement-worker.php (requires WordPress bootstrap).
 *
 * @package Matchflow
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    $wp_load = dirname(__DIR__, 4) . '/wp-load.php';
    if (is_readable($wp_load)) {
        require_once $wp_load;
    } else {
        fwrite(STDERR, "WordPress bootstrap not found. Use: wp eval-file scripts/settlement-worker.php\n");
        exit(1);
    }
}

$monitor = new Matchflow\Jobs\SettlementMonitor();
$monitor->run();
echo "Settlement monitor pass complete.\n";
