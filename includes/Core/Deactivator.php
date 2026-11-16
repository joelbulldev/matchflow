<?php
/**
 * Plugin deactivation.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Core;

defined('ABSPATH') || exit;

final class Deactivator
{
    public static function deactivate(): void
    {
        $timestamp = wp_next_scheduled('matchflow_poll_settlements');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'matchflow_poll_settlements');
        }

        flush_rewrite_rules(false);
        delete_option('matchflow_rewrite_flushed');
    }
}
