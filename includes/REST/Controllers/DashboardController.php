<?php
/**
 * Dashboard summary.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Domain\AnalyticsPeriod;
use Matchflow\Domain\FinanceAggregate;
use Matchflow\Domain\Money;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class DashboardController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/dashboard/summary', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
            'callback' => [self::class, 'summary'],
            'args' => [
                'period' => ['type' => 'string', 'default' => 'all'],
            ],
        ]);
    }

    public static function summary(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $period = (string) ($request->get_param('period') ?: 'all');
        $since = AnalyticsPeriod::sinceUtc($period);
        $rollup = FinanceAggregate::summary($org, $since, $since);

        $pending = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_settlements WHERE organization_id = %d AND normalized_status IN ('PENDING_DEPOSIT','KNOWN_DEPOSIT_TX','PROCESSING')",
            $org
        ));
        $exceptions = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_ap_bills WHERE organization_id = %d AND match_status = 'exception'",
            $org
        ));
        $approvals = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_approvals WHERE organization_id = %d AND status = 'pending'",
            $org
        ));

        return Response::success([
            'receivablesOutstanding' => $rollup['receivablesOutstanding'],
            'payablesOutstanding' => $rollup['payablesOutstanding'],
            'collected' => $rollup['collected'],
            'paid' => $rollup['paid'],
            'pendingSettlements' => $pending,
            'exceptions' => $exceptions,
            'pendingApprovals' => $approvals,
            'period' => $period,
            'periodLabel' => AnalyticsPeriod::label($period),
        ]);
    }
}
