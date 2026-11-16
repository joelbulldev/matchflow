<?php
/**
 * Reports API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Domain\AnalyticsPeriod;
use Matchflow\Domain\FinanceAggregate;
use Matchflow\Ledger\ReconciliationService;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class ReportsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/reports/(?P<reportKey>[a-z0-9-]+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'reports.read')),
            'callback' => [self::class, 'show'],
        ]);
        register_rest_route($ns, '/reports/(?P<reportKey>[a-z0-9-]+)/export', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'reports.read')),
            'callback' => [self::class, 'export'],
        ]);
        register_rest_route($ns, '/reconciliation', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'reconciliation.manage')) || !is_wp_error(Auth::requireCapability($r, 'reports.read')),
            'callback' => [self::class, 'reconciliation'],
        ]);
        register_rest_route($ns, '/reconciliation/statement', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'reconciliation.manage')) || !is_wp_error(Auth::requireCapability($r, 'reports.read')),
            'callback' => [self::class, 'statement'],
        ]);
        register_rest_route($ns, '/reconciliation/statements', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'reconciliation.manage')) || !is_wp_error(Auth::requireCapability($r, 'reports.read')),
            'callback' => [self::class, 'statements'],
        ]);
    }

    public static function show(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $key = (string) $request['reportKey'];
        $bucket = sanitize_key((string) ($request->get_param('bucket') ?: 'all'));
        $q = sanitize_text_field((string) ($request->get_param('q') ?: ''));

        if ($key === 'receivables-aging') {
            return Response::success(self::receivablesAging($org, $bucket, $q));
        }
        if ($key === 'payables-aging') {
            return Response::success(self::payablesAging($org, $bucket, $q));
        }
        if ($key === 'collections') {
            [$from, $to] = self::reportWindow($request);

            return Response::success(self::collections($org, $from, $to));
        }
        if ($key === 'exceptions') {
            return Response::success(self::exceptions($org, $q));
        }
        return Response::success(['report' => $key, 'rows' => [], 'summary' => []]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function receivablesAging(int $org, string $bucket, string $q): array
    {
        global $wpdb;
        $open = "'" . implode("','", array_map('esc_sql', FinanceAggregate::AR_OPEN_STATUSES)) . "'";
        $sql = "SELECT i.id, i.invoice_number, i.customer_id, c.name AS party_name, i.due_date,
                       i.amount_outstanding_decimal, i.status, i.currency
                FROM {$wpdb->prefix}mf_ar_invoices i
                LEFT JOIN {$wpdb->prefix}mf_counterparties c ON c.id = i.customer_id AND c.organization_id = i.organization_id
                WHERE i.organization_id = %d AND i.status IN ({$open})
                  AND CAST(i.amount_outstanding_decimal AS DECIMAL(36,8)) > 0";
        $params = [$org];
        if ($q !== '') {
            $like = '%' . $wpdb->esc_like($q) . '%';
            $sql .= ' AND (i.invoice_number LIKE %s OR c.name LIKE %s)';
            $params[] = $like;
            $params[] = $like;
        }
        $sql .= ' ORDER BY i.due_date ASC';
        $rows = $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) ?: [];
        return self::withAgingBuckets('receivables-aging', $rows, $bucket, 'customer_id', '/receivables/invoices/');
    }

    /**
     * @return array<string, mixed>
     */
    private static function payablesAging(int $org, string $bucket, string $q): array
    {
        global $wpdb;
        $open = "'" . implode("','", array_map('esc_sql', FinanceAggregate::AP_OPEN_STATUSES)) . "'";
        $sql = "SELECT b.id, b.invoice_number, b.supplier_id, s.name AS party_name, b.due_date,
                       b.amount_outstanding_decimal, b.status, b.currency
                FROM {$wpdb->prefix}mf_ap_bills b
                LEFT JOIN {$wpdb->prefix}mf_counterparties s ON s.id = b.supplier_id AND s.organization_id = b.organization_id
                WHERE b.organization_id = %d AND b.status IN ({$open})
                  AND CAST(b.amount_outstanding_decimal AS DECIMAL(36,8)) > 0";
        $params = [$org];
        if ($q !== '') {
            $like = '%' . $wpdb->esc_like($q) . '%';
            $sql .= ' AND (b.invoice_number LIKE %s OR s.name LIKE %s)';
            $params[] = $like;
            $params[] = $like;
        }
        $sql .= ' ORDER BY b.due_date ASC';
        $rows = $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) ?: [];
        return self::withAgingBuckets('payables-aging', $rows, $bucket, 'supplier_id', '/payables/bills/');
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    private static function withAgingBuckets(string $report, array $rows, string $bucket, string $partyKey, string $linkPrefix): array
    {
        $today = gmdate('Y-m-d');
        $enriched = [];
        $summary = [
            'current' => '0',
            'days_1_30' => '0',
            'days_31_60' => '0',
            'days_61_90' => '0',
            'days_90_plus' => '0',
        ];
        foreach ($rows as $row) {
            $due = (string) ($row['due_date'] ?? $today);
            $outstanding = (string) ($row['amount_outstanding_decimal'] ?? '0');
            $days = (int) floor((strtotime($today) - strtotime($due)) / DAY_IN_SECONDS);
            $aging = 'current';
            if ($days > 90) {
                $aging = 'days_90_plus';
            } elseif ($days > 60) {
                $aging = 'days_61_90';
            } elseif ($days > 30) {
                $aging = 'days_31_60';
            } elseif ($days > 0) {
                $aging = 'days_1_30';
            }
            $row['aging_bucket'] = $aging;
            $row['days_past_due'] = max(0, $days);
            $row['record_url'] = home_url($linkPrefix . (int) $row['id']);
            $row['party_id'] = $row[$partyKey] ?? null;
            $summary[$aging] = self::moneyAdd($summary[$aging], $outstanding);
            if ($bucket === 'all' || $bucket === $aging) {
                $enriched[] = $row;
            }
        }
        return [
            'report' => $report,
            'rows' => $enriched,
            'summary' => $summary,
            'bucket' => $bucket,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function collections(int $org, string $from = '', string $to = ''): array
    {
        global $wpdb;
        $sql = "SELECT s.id, s.subject_id AS invoice_id, i.invoice_number, c.name AS party_name,
                    s.destination_amount_decimal, s.normalized_status, s.reconciled_at, s.receipt_url
             FROM {$wpdb->prefix}mf_settlements s
             LEFT JOIN {$wpdb->prefix}mf_ar_invoices i ON i.id = s.subject_id AND s.subject_type = 'ar_invoice'
             LEFT JOIN {$wpdb->prefix}mf_counterparties c ON c.id = i.customer_id AND c.organization_id = s.organization_id
             WHERE s.organization_id = %d AND s.purpose = 'AR_COLLECTION'";
        $params = [$org];
        if ($from !== '') {
            $sql .= ' AND s.reconciled_at >= %s';
            $params[] = $from . ' 00:00:00';
        }
        if ($to !== '') {
            $sql .= ' AND s.reconciled_at <= %s';
            $params[] = $to . ' 23:59:59';
        }
        $sql .= ' ORDER BY s.id DESC LIMIT 500';
        $rows = $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) ?: [];
        foreach ($rows as &$row) {
            $row['record_url'] = $row['invoice_id'] ? home_url('/receivables/invoices/' . (int) $row['invoice_id']) : null;
        }
        return [
            'report' => 'collections',
            'rows' => $rows,
            'summary' => ['count' => count($rows), 'from' => $from, 'to' => $to],
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    private static function reportWindow(WP_REST_Request $request): array
    {
        $from = sanitize_text_field((string) ($request->get_param('from') ?? ''));
        $to = sanitize_text_field((string) ($request->get_param('to') ?? ''));
        $period = sanitize_key((string) ($request->get_param('period') ?? ''));
        if ($from === '' && $period !== '') {
            $since = AnalyticsPeriod::sinceUtc($period);
            if ($since !== null) {
                $from = substr($since, 0, 10);
            }
        }
        if ($to === '') {
            $to = gmdate('Y-m-d');
        }

        return [$from, $to];
    }

    /**
     * @return array<string, mixed>
     */
    private static function exceptions(int $org, string $q): array
    {
        global $wpdb;
        $sql = "SELECT b.id, b.invoice_number, b.supplier_id, s.name AS party_name, b.match_status, b.status, b.total_decimal
                FROM {$wpdb->prefix}mf_ap_bills b
                LEFT JOIN {$wpdb->prefix}mf_counterparties s ON s.id = b.supplier_id AND s.organization_id = b.organization_id
                WHERE b.organization_id = %d AND b.match_status = 'exception'";
        $params = [$org];
        if ($q !== '') {
            $like = '%' . $wpdb->esc_like($q) . '%';
            $sql .= ' AND (b.invoice_number LIKE %s OR s.name LIKE %s)';
            $params[] = $like;
            $params[] = $like;
        }
        $rows = $wpdb->get_results($wpdb->prepare($sql, $params), ARRAY_A) ?: [];
        foreach ($rows as &$row) {
            $row['record_url'] = home_url('/payables/bills/' . (int) $row['id'] . '/match');
        }
        return ['report' => 'exceptions', 'rows' => $rows, 'summary' => ['count' => count($rows)]];
    }

    private static function moneyAdd(string $a, string $b): string
    {
        if (function_exists('bcadd')) {
            return bcadd($a, $b, 8);
        }
        return (string) ((float) $a + (float) $b);
    }

    public static function export(WP_REST_Request $request)
    {
        $data = self::show($request);
        if ($data instanceof \WP_Error) {
            return $data;
        }
        $payload = $data->get_data();
        $rows = $payload['data']['rows'] ?? [];
        $csv = '';
        if ($rows) {
            $headers = array_keys($rows[0]);
            $csv .= self::csvLine($headers);
            foreach ($rows as $row) {
                $csv .= self::csvLine(array_map(static fn($v) => self::csvSafe((string) $v), array_values($row)));
            }
        }
        return Response::success(['csv' => $csv, 'filename' => ($request['reportKey'] ?? 'report') . '.csv']);
    }

    public static function reconciliation(WP_REST_Request $request)
    {
        return Response::success((new ReconciliationService())->dashboard(Auth::organizationId($request)));
    }

    public static function statements(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $type = sanitize_key((string) ($request->get_param('type') ?: 'customer'));
        $apOpen = "'" . implode("','", array_map('esc_sql', FinanceAggregate::AP_OPEN_STATUSES)) . "'";
        $arOpen = "'" . implode("','", array_map('esc_sql', FinanceAggregate::AR_OPEN_STATUSES)) . "'";
        if ($type === 'supplier') {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT id, invoice_number, supplier_id AS party_id, amount_outstanding_decimal, status, due_date
                 FROM {$wpdb->prefix}mf_ap_bills
                 WHERE organization_id = %d AND status IN ({$apOpen})
                   AND CAST(amount_outstanding_decimal AS DECIMAL(36,8)) > 0
                 ORDER BY due_date ASC",
                $org
            ), ARRAY_A) ?: [];
        } else {
            $rows = $wpdb->get_results($wpdb->prepare(
                "SELECT id, invoice_number, customer_id AS party_id, amount_outstanding_decimal, status, due_date
                 FROM {$wpdb->prefix}mf_ar_invoices
                 WHERE organization_id = %d AND status IN ({$arOpen})
                   AND CAST(amount_outstanding_decimal AS DECIMAL(36,8)) > 0
                 ORDER BY due_date ASC",
                $org
            ), ARRAY_A) ?: [];
        }
        return Response::success(['type' => $type, 'open_obligations' => $rows]);
    }

    public static function statement(WP_REST_Request $request)
    {
        $cp = $request->get_param('counterparty_id');
        return Response::success(
            (new ReconciliationService())->statementUnmatched(
                Auth::organizationId($request),
                $cp !== null && $cp !== '' ? (int) $cp : null
            )
        );
    }

    private static function csvSafe(string $value): string
    {
        if ($value !== '' && in_array($value[0], ['=', '+', '-', '@'], true)) {
            return "'" . $value;
        }
        return $value;
    }

    private static function csvLine(array $fields): string
    {
        $escaped = array_map(static function ($v) {
            $v = (string) $v;
            if (str_contains($v, ',') || str_contains($v, '"') || str_contains($v, "\n")) {
                return '"' . str_replace('"', '""', $v) . '"';
            }
            return $v;
        }, $fields);
        return implode(',', $escaped) . "\n";
    }
}
