<?php
/**
 * Settlement status polling worker.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Jobs;

defined('ABSPATH') || exit;

use Matchflow\Settlements\SettlementService;

final class SettlementMonitor
{
    public static function run(): void
    {
        $lock = 'matchflow_settlement_monitor_lock';
        if (get_transient($lock)) {
            return;
        }
        set_transient($lock, 1, 50);

        try {
            $service = new SettlementService();
            foreach ($service->listPending() as $row) {
                $service->refreshStatus((int) $row['organization_id'], (int) $row['id']);
            }
        } finally {
            delete_transient($lock);
        }
    }
}
