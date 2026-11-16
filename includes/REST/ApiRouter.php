<?php
/**
 * Registers MATCHFLOW REST routes under matchflow/v1 (aliased as /api/v1).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST;

defined('ABSPATH') || exit;

use Matchflow\REST\MatchflowBootstrap;
use Matchflow\REST\Controllers\ApprovalsController;
use Matchflow\REST\Controllers\AuthController;
use Matchflow\REST\Controllers\BillsController;
use Matchflow\REST\Controllers\BootstrapController;
use Matchflow\REST\Controllers\CounterpartiesController;
use Matchflow\REST\Controllers\DashboardController;
use Matchflow\REST\Controllers\ModuleAnalyticsController;
use Matchflow\REST\Controllers\NearRpcProxyController;
use Matchflow\REST\Controllers\FilesController;
use Matchflow\REST\Controllers\FinanceAiController;
use Matchflow\REST\Controllers\InvoicesController;
use Matchflow\REST\Controllers\PaymentRequestsController;
use Matchflow\REST\Controllers\NotificationsController;
use Matchflow\REST\Controllers\OrganizationsController;
use Matchflow\REST\Controllers\ProcurementController;
use Matchflow\REST\Controllers\PublicCheckoutController;
use Matchflow\REST\Controllers\ReportsController;
use Matchflow\REST\Controllers\SettlementsController;
use Matchflow\REST\Controllers\SettingsController;

final class ApiRouter
{
    public static function register(): void
    {
        $missing = ControllerLoader::loadAll();
        $ns = 'matchflow/v1';

        if (class_exists(BootstrapController::class)) {
            BootstrapController::register($ns);
        } else {
            MatchflowBootstrap::register($ns);
            if (function_exists('error_log')) {
                error_log(
                    'MATCHFLOW: BootstrapController unreadable; only /health registered. '
                    . 'Replace includes/REST/Controllers/BootstrapController.php'
                );
            }
        }

        if (class_exists(NearRpcProxyController::class)) {
            NearRpcProxyController::register($ns);
        }

        if (class_exists(AuthController::class)) {
            AuthController::register($ns);
        }

        $fatalMissing = array_values(array_diff($missing, ['BootstrapController', 'AuthController']));
        if ($fatalMissing !== []) {
            if (is_admin()) {
                add_action(
                    'admin_notices',
                    static function () use ($fatalMissing): void {
                        $list = implode(', ', $fatalMissing);
                        echo '<div class="notice notice-error"><p><strong>MATCHFLOW</strong> install is incomplete. Missing: '
                            . esc_html($list)
                            . '. Re-upload the full plugin (run <code>scripts/build-plugin-zip.ps1</code> or copy the entire <code>includes/</code> tree).</p></div>';
                    }
                );
            }
            if (function_exists('error_log')) {
                error_log('MATCHFLOW: REST partially loaded; missing controllers: ' . implode(', ', $fatalMissing));
            }
            return;
        }

        OrganizationsController::register($ns);
        CounterpartiesController::register($ns);
        InvoicesController::register($ns);
        PaymentRequestsController::register($ns);
        PublicCheckoutController::register($ns);
        BillsController::register($ns);
        ProcurementController::register($ns);
        ApprovalsController::register($ns);
        SettlementsController::register($ns);
        DashboardController::register($ns);
        ModuleAnalyticsController::register($ns);
        FilesController::register($ns);
        ReportsController::register($ns);
        FinanceAiController::register($ns);
        SettingsController::register($ns);
        NotificationsController::register($ns);
    }
}
