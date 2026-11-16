<?php
/**
 * Main plugin bootstrap.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Core;

defined('ABSPATH') || exit;

use Matchflow\Admin\SettingsPage;
use Matchflow\Database\Migrator;
use Matchflow\Demo\DemoProvisioner;
use Matchflow\Frontend\AssetDelivery;
use Matchflow\Frontend\AssetPublisher;
use Matchflow\Frontend\SpaIsolation;
use Matchflow\REST\ApiRouter;
use Matchflow\Routing\FrontendRouter;
use Matchflow\Routing\RestAlias;
use Matchflow\Routing\Rewrite;
use Matchflow\Jobs\SettlementMonitor;
use Matchflow\Notifications\SmtpConfigurator;
use Matchflow\Security\Conceal;
use Matchflow\Security\ConcealDiscovery;
use Matchflow\Security\FingerprintStrip;

final class Plugin
{
    private static ?self $instance = null;

    public static function instance(): self
    {
        return self::$instance ??= new self();
    }

    private function __construct()
    {
    }

    public function boot(): void
    {
        Requirements::assertOrAdminNotice();

        (new Migrator())->maybeMigrate();

        add_action('init', [Rewrite::class, 'register']);
        AssetDelivery::register();
        AssetPublisher::register();
        RestAlias::register();
        add_action('init', [FrontendRouter::class, 'register']);
        SpaIsolation::register();
        if (class_exists(FingerprintStrip::class)) {
            add_action('init', [FingerprintStrip::class, 'register'], 20);
        }
        Conceal::register();
        ConcealDiscovery::register();
        SmtpConfigurator::register();
        add_action('rest_api_init', [ApiRouter::class, 'register']);
        add_action('rest_api_init', static function (): void {
            DemoProvisioner::ensure();
        }, 5);
        add_action('admin_menu', [SettingsPage::class, 'register']);
        add_action('matchflow_poll_settlements', [SettlementMonitor::class, 'run']);

        if (!wp_next_scheduled('matchflow_poll_settlements')) {
            wp_schedule_event(time() + 60, 'matchflow_every_minute', 'matchflow_poll_settlements');
        }

        add_filter(
            'cron_schedules',
            static function (array $schedules): array {
                $schedules['matchflow_every_minute'] = [
                    'interval' => 60,
                    'display' => __('Every minute (MATCHFLOW)', 'matchflow'),
                ];
                return $schedules;
            }
        );
    }
}
