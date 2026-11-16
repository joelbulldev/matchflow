<?php
/**
 * Plugin activation.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Core;

defined('ABSPATH') || exit;

use Matchflow\Database\Migrator;
use Matchflow\Demo\DemoProvisioner;
use Matchflow\Frontend\AssetPublisher;
use Matchflow\Routing\Rewrite;

final class Activator
{
    public static function activate(): void
    {
        $errors = Requirements::check();
        if ($errors !== []) {
            deactivate_plugins(MATCHFLOW_BASENAME);
            wp_die(
                esc_html(implode(' ', $errors)),
                esc_html__('MATCHFLOW activation failed', 'matchflow'),
                ['back_link' => true]
            );
        }

        (new Migrator())->migrate();
        Rewrite::register();
        flush_rewrite_rules(false);
        update_option('matchflow_rewrite_flushed', MATCHFLOW_VERSION);
        update_option('matchflow_activated_at', gmdate('c'));

        if (!wp_next_scheduled('matchflow_poll_settlements')) {
            wp_schedule_event(time() + 60, 'matchflow_every_minute', 'matchflow_poll_settlements');
        }

        DemoProvisioner::ensure();
        AssetPublisher::publishAndMarkVersion();
    }
}
