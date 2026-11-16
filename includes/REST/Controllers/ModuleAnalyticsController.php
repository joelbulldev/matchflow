<?php
/**
 * Org-accurate module analytics (SQL aggregates, not sampled lists).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Domain\AnalyticsPeriod;
use Matchflow\Domain\FinanceAggregate;
use Matchflow\Domain\Money;
use Matchflow\Ledger\ReconciliationService;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class ModuleAnalyticsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/dashboard/analytics/(?P<module>[a-z_-]+)', [
            'methods' => 'GET',
            'permission_callback' => [self::class, 'permission'],
            'callback' => [self::class, 'show'],
            'args' => [
                'module' => ['required' => true, 'type' => 'string'],
                'context' => ['type' => 'string', 'default' => 'default'],
                'period' => ['type' => 'string', 'default' => 'all'],
            ],
        ]);
    }

    public static function permission(WP_REST_Request $request)
    {
        $module = (string) $request->get_param('module');
        if ($module === 'reconciliation') {
            return !is_wp_error(Auth::requireCapability($request, 'reconciliation.manage'))
                || !is_wp_error(Auth::requireCapability($request, 'reports.read'))
                || !is_wp_error(Auth::requireCapability($request, 'ledger.read'));
        }
        if ($module === 'finance-ai') {
            return !is_wp_error(Auth::requireCapability($request, 'ai.use'))
                || !is_wp_error(Auth::requireCapability($request, 'reports.read'));
        }
        $cap = self::capabilityForModule($module);
        return !is_wp_error(Auth::requireCapability($request, $cap));
    }

    public static function show(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $module = (string) $request->get_param('module');
        $context = (string) ($request->get_param('context') ?: 'default');
        $period = sanitize_key((string) ($request->get_param('period') ?: 'all'));

        $payload = match ($module) {
            'receivables' => self::receivables($org, $context, $period),
            'payables' => self::payables($org, $context, $period),
            'procurement' => self::procurement($org, $context, $period),
            'approvals' => self::approvals($org, $period),
            'payments' => self::payments($org, $period),
            'reconciliation' => self::reconciliation($org, $context, $period),
            'reports' => self::reports($org, $context, $period),
            'finance-ai' => self::financeAi($org, $period),
            default => null,
        };

        if ($payload === null) {
            return Response::error('unknown_module', 'Unknown analytics module.', 404);
        }

        return Response::success($payload);
    }

    private static function capabilityForModule(string $module): string
    {
        return match ($module) {
            'receivables' => 'ar.read',
            'payables' => 'ap.read',
            'procurement' => 'procurement.read',
            'approvals' => 'approvals.read',
            'payments' => 'payments.read',
            'reconciliation' => 'reconciliation.manage',
            'reports' => 'reports.read',
            'finance-ai' => 'ai.use',
            default => 'reports.read',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private static function financeSummary(int $org, string $period = 'all'): array
    {
        global $wpdb;
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

        return array_merge($rollup, [
            'pendingSettlements' => $pending,
            'exceptions' => $exceptions,
            'pendingApprovals' => $approvals,
        ]);
    }

    private static function outstandingHint(): string
    {
        return 'Open obligations (void & cancelled excluded)';
    }

    private static function flowHint(string $base, string $period): string
    {
        if ($period === '' || $period === 'all') {
            return $base;
        }

        return $base . ' · ' . AnalyticsPeriod::label($period);
    }

    /**
     * @return array<string, mixed>
     */
    private static function withPeriodMeta(array $payload, string $period): array
    {
        $payload['period'] = $period;
        $payload['periodLabel'] = AnalyticsPeriod::label($period);

        return $payload;
    }

    /**
     * @return list<array{label: string, value: int, amount?: string}>
     */
    private static function groupCounts(int $org, string $table, string $column, ?string $amountColumn = null): array
    {
        global $wpdb;
        $t = $wpdb->prefix . $table;
        $sql = "SELECT {$column} AS lbl, COUNT(*) AS cnt";
        if ($amountColumn !== null) {
            $sql .= ", SUM(CAST({$amountColumn} AS DECIMAL(24,8))) AS amt";
        }
        $sql .= " FROM {$t} WHERE organization_id = %d GROUP BY {$column} ORDER BY cnt DESC";
        $rows = $wpdb->get_results($wpdb->prepare($sql, $org), ARRAY_A) ?: [];
        $out = [];
        foreach ($rows as $row) {
            $item = [
                'label' => (string) ($row['lbl'] ?? 'unknown'),
                'value' => (int) ($row['cnt'] ?? 0),
            ];
            if ($amountColumn !== null && isset($row['amt'])) {
                $item['amount'] = (string) $row['amt'];
            }
            $out[] = $item;
        }
        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private static function receivables(int $org, string $context, string $period = 'all'): array
    {
        global $wpdb;
        $summary = self::financeSummary($org, $period);
        $issued = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_ar_invoices WHERE organization_id = %d AND status IN ('issued','partially_paid') AND public_payment_token IS NOT NULL",
            $org
        ));
        $overdue = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_ar_invoices WHERE organization_id = %d AND status = 'overdue'",
            $org
        ));
        $customers = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_counterparties WHERE organization_id = %d AND type = 'customer'",
            $org
        ));

        $metrics = match ($context) {
            'links' => [
                self::metric('active_links', 'Active pay links', (string) $issued, 'count', 'Issued with checkout token'),
                self::metric('overdue', 'Past due', (string) $overdue, 'count'),
                self::metric('receivables', 'Outstanding', $summary['receivablesOutstanding'], 'money', self::outstandingHint()),
                self::metric('pending_settlements', 'Settlements in flight', (string) $summary['pendingSettlements'], 'count'),
            ],
            'reminders' => [
                self::metric('overdue', 'Overdue invoices', (string) $overdue, 'count'),
                self::metric('receivables', 'Outstanding', $summary['receivablesOutstanding'], 'money', self::outstandingHint()),
                self::metric('collected', 'Collected', $summary['collected'], 'money', self::flowHint('Recorded on invoices', $period)),
                self::metric('pending_settlements', 'Pending settlement', (string) $summary['pendingSettlements'], 'count'),
            ],
            'customers' => [
                self::metric('customers', 'Customers', (string) $customers, 'count'),
                self::metric('receivables', 'Outstanding', $summary['receivablesOutstanding'], 'money'),
                self::metric('collected', 'Collected', $summary['collected'], 'money'),
                self::metric('overdue', 'Overdue', (string) $overdue, 'count'),
            ],
            default => [
                self::metric('receivables', 'Receivables outstanding', $summary['receivablesOutstanding'], 'money', 'Open invoices awaiting payment'),
                self::metric('collected', 'Collected', $summary['collected'], 'money', 'Verified inbound settlement'),
                self::metric('pending_settlements', 'Pending settlements', (string) $summary['pendingSettlements'], 'count', 'Quotes or deposits in flight'),
                self::metric('overdue', 'Past due', (string) $overdue, 'count', 'Invoices past due date'),
            ],
        };

        return self::withPeriodMeta([
            'module' => 'receivables',
            'context' => $context,
            'metrics' => $metrics,
            'charts' => [
                [
                    'id' => 'invoice_status',
                    'title' => 'Invoices by status',
                    'description' => 'Full organization ledger.',
                    'segments' => self::groupCounts($org, 'mf_ar_invoices', 'status', 'amount_outstanding_decimal'),
                ],
                [
                    'id' => 'settlement_pipeline',
                    'title' => 'Settlement pipeline',
                    'description' => 'Inbound and outbound settlement states.',
                    'segments' => self::groupCounts($org, 'mf_settlements', 'normalized_status'),
                ],
            ],
        ], $period);
    }

    /**
     * @return array<string, mixed>
     */
    private static function payables(int $org, string $context, string $period = 'all'): array
    {
        $summary = self::financeSummary($org, $period);
        global $wpdb;
        $billCount = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_ap_bills WHERE organization_id = %d",
            $org
        ));
        $suppliers = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_counterparties WHERE organization_id = %d AND type = 'supplier'",
            $org
        ));

        $metrics = match ($context) {
            'suppliers' => [
                self::metric('suppliers', 'Suppliers', (string) $suppliers, 'count'),
                self::metric('payables', 'Outstanding', $summary['payablesOutstanding'], 'money', self::outstandingHint()),
                self::metric('exceptions', 'Match exceptions', (string) $summary['exceptions'], 'count'),
                self::metric('pending_approvals', 'Pending approvals', (string) $summary['pendingApprovals'], 'count'),
            ],
            default => [
                self::metric('payables', 'Payables outstanding', $summary['payablesOutstanding'], 'money', self::outstandingHint()),
                self::metric('exceptions', 'Match exceptions', (string) $summary['exceptions'], 'count', 'Bills that failed three-way match'),
                self::metric('paid', 'Paid', $summary['paid'], 'money', self::flowHint('Outbound payments confirmed', $period)),
                self::metric('bills', 'Bills on file', (string) $billCount, 'count', 'All supplier bills in the ledger'),
            ],
        };

        return self::withPeriodMeta([
            'module' => 'payables',
            'context' => $context,
            'metrics' => $metrics,
            'charts' => [
                [
                    'id' => 'match_status',
                    'title' => 'Match status',
                    'segments' => self::groupCounts($org, 'mf_ap_bills', 'match_status'),
                ],
                [
                    'id' => 'bill_status',
                    'title' => 'Bill workflow status',
                    'segments' => self::groupCounts($org, 'mf_ap_bills', 'status'),
                ],
            ],
        ], $period);
    }

    /**
     * @return array<string, mixed>
     */
    private static function procurement(int $org, string $context, string $period = 'all'): array
    {
        $summary = self::financeSummary($org, $period);
        global $wpdb;
        $openPos = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_purchase_orders WHERE organization_id = %d AND status NOT IN ('closed','cancelled')",
            $org
        ));
        $grn = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_goods_receipts WHERE organization_id = %d",
            $org
        ));

        $metrics = match ($context) {
            'grn' => [
                self::metric('grn', 'Goods receipts', (string) $grn, 'count', 'Recorded against POs'),
                self::metric('open_pos', 'Open POs', (string) $openPos, 'count', 'Not closed or cancelled'),
                self::metric('exceptions', 'AP exceptions', (string) $summary['exceptions'], 'count', 'Bills that failed match'),
                self::metric('payables', 'Payables exposure', $summary['payablesOutstanding'], 'money', 'Approved, not settled'),
            ],
            default => [
                self::metric('open_pos', 'Open purchase orders', (string) $openPos, 'count', 'Commitments still in flight'),
                self::metric('grn', 'Receipts recorded', (string) $grn, 'count', 'Goods received against POs'),
                self::metric('payables', 'Payables exposure', $summary['payablesOutstanding'], 'money', 'Linked supplier balance'),
                self::metric('exceptions', 'Match exceptions', (string) $summary['exceptions'], 'count', 'Needs AP review'),
            ],
        };

        return self::withPeriodMeta([
            'module' => 'procurement',
            'context' => $context,
            'metrics' => $metrics,
            'charts' => [
                [
                    'id' => 'po_status',
                    'title' => 'Purchase orders by status',
                    'description' => 'Issued, closed, and in-progress POs.',
                    'segments' => self::groupCounts($org, 'mf_purchase_orders', 'status'),
                ],
                [
                    'id' => 'grn_status',
                    'title' => 'Goods receipts',
                    'description' => 'Delivery records in this org.',
                    'segments' => self::groupCounts($org, 'mf_goods_receipts', 'status'),
                ],
            ],
        ], $period);
    }

    /**
     * @return array<string, mixed>
     */
    private static function approvals(int $org, string $period = 'all'): array
    {
        $summary = self::financeSummary($org, $period);
        return self::withPeriodMeta([
            'module' => 'approvals',
            'context' => 'default',
            'metrics' => [
                self::metric('pending', 'Pending approvals', (string) $summary['pendingApprovals'], 'count', 'Waiting for a decision'),
                self::metric('exceptions', 'Bill exceptions', (string) $summary['exceptions'], 'count', 'Needs review before pay'),
                self::metric('payables', 'Payables outstanding', $summary['payablesOutstanding'], 'money', self::outstandingHint()),
                self::metric('pending_settlements', 'Settlements queued', (string) $summary['pendingSettlements'], 'count', 'Quotes or deposits in flight'),
            ],
            'charts' => [
                [
                    'id' => 'approval_status',
                    'title' => 'Approvals by status',
                    'description' => 'Open and completed approval items.',
                    'segments' => self::groupCounts($org, 'mf_approvals', 'status'),
                ],
                [
                    'id' => 'approval_entity',
                    'title' => 'Approvals by record type',
                    'description' => 'What teams are signing off on.',
                    'segments' => self::groupCounts($org, 'mf_approvals', 'subject_type'),
                ],
            ],
        ], $period);
    }

    /**
     * @return array<string, mixed>
     */
    private static function payments(int $org, string $period = 'all'): array
    {
        global $wpdb;
        $summary = self::financeSummary($org, $period);
        $incoming = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_settlements WHERE organization_id = %d AND purpose = 'AR_COLLECTION'",
            $org
        ));
        $outgoing = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_settlements WHERE organization_id = %d AND purpose = 'AP_SETTLEMENT'",
            $org
        ));

        return self::withPeriodMeta([
            'module' => 'payments',
            'context' => 'default',
            'metrics' => [
                self::metric('incoming', 'Incoming settlements', (string) $incoming, 'count', 'Customer collections'),
                self::metric('outgoing', 'Outgoing settlements', (string) $outgoing, 'count', 'Supplier payments'),
                self::metric('pending', 'In flight', (string) $summary['pendingSettlements'], 'count', 'Pending deposit or processing'),
                self::metric('collected', 'Collected (AR)', $summary['collected'], 'money', self::flowHint('Verified inbound totals', $period)),
            ],
            'charts' => [
                [
                    'id' => 'settlement_status',
                    'title' => 'Settlement status',
                    'description' => 'All settlement attempts in this org.',
                    'segments' => self::groupCounts($org, 'mf_settlements', 'normalized_status'),
                ],
                [
                    'id' => 'settlement_purpose',
                    'title' => 'Settlement purpose',
                    'description' => 'Collections vs disbursements.',
                    'segments' => self::groupCounts($org, 'mf_settlements', 'purpose'),
                ],
            ],
        ], $period);
    }

    /**
     * @return array<string, mixed>
     */
    private static function reconciliation(int $org, string $context, string $period = 'all'): array
    {
        if ($context === 'unmatched') {
            $stmt = (new ReconciliationService())->statementUnmatched($org);
            $openAr = count($stmt['open_receivables']);
            $openAp = count($stmt['open_payables']);
            $queue = count($stmt['unmatched_settlements']);
            $arTotal = '0';
            $apTotal = '0';
            foreach ($stmt['open_receivables'] as $row) {
                $arTotal = Money::add($arTotal, (string) ($row['amount_outstanding_decimal'] ?? '0'));
            }
            foreach ($stmt['open_payables'] as $row) {
                $apTotal = Money::add($apTotal, (string) ($row['amount_outstanding_decimal'] ?? '0'));
            }

            return self::withPeriodMeta([
                'module' => 'reconciliation',
                'context' => 'unmatched',
                'metrics' => [
                    self::metric('unmatched', 'Unmatched SUCCESS', (string) $queue, 'count', 'Settlements awaiting allocation'),
                    self::metric('receivables', 'Open AR lines', (string) $openAr, 'count', $arTotal . ' USD outstanding'),
                    self::metric('payables', 'Open AP lines', (string) $openAp, 'count', $apTotal . ' USD outstanding'),
                    self::metric('total', 'Statement rows', (string) ($openAr + $openAp + $queue), 'count'),
                ],
                'charts' => [
                    [
                        'id' => 'statement_mix',
                        'title' => 'Unmatched workspace mix',
                        'description' => 'Open obligations vs unmatched SUCCESS settlements.',
                        'segments' => [
                            ['label' => 'Unmatched settlements', 'value' => $queue],
                            ['label' => 'Open receivables', 'value' => $openAr],
                            ['label' => 'Open payables', 'value' => $openAp],
                        ],
                    ],
                ],
            ], $period);
        }

        $dash = (new ReconciliationService())->dashboard($org);
        $matched = is_array($dash['matched'] ?? null) ? count($dash['matched']) : 0;
        $unmatched = is_array($dash['unmatched'] ?? null) ? count($dash['unmatched']) : 0;
        $exceptions = is_array($dash['exceptions'] ?? null) ? count($dash['exceptions']) : 0;

        return self::withPeriodMeta([
            'module' => 'reconciliation',
            'context' => 'default',
            'metrics' => [
                self::metric('matched', 'Matched', (string) $matched, 'count', 'Lines tied to settlement'),
                self::metric('unmatched', 'Unmatched SUCCESS', (string) $unmatched, 'count', 'Needs allocation'),
                self::metric('exceptions', 'Exceptions', (string) $exceptions, 'count', 'Policy or amount mismatch'),
                self::metric('total', 'In scope', (string) ($matched + $unmatched + $exceptions), 'count', 'Items on reconciliation board'),
            ],
            'charts' => [
                [
                    'id' => 'recon_health',
                    'title' => 'Reconciliation health',
                    'description' => 'Matched vs open exceptions.',
                    'segments' => [
                        ['label' => 'Matched', 'value' => $matched],
                        ['label' => 'Unmatched', 'value' => $unmatched],
                        ['label' => 'Exceptions', 'value' => $exceptions],
                    ],
                ],
            ],
        ], $period);
    }

    /**
     * @return array<string, mixed>
     */
    private static function reports(int $org, string $context, string $period = 'all'): array
    {
        $summary = self::financeSummary($org, $period);

        return self::withPeriodMeta(match ($context) {
            'collections' => self::reportsCollections($org, $summary, $period),
            'exceptions' => self::reportsExceptions($org, $summary),
            'receivables-aging' => self::reportsAging($org, 'ar', $summary),
            'payables-aging' => self::reportsAging($org, 'ap', $summary),
            default => [
                'module' => 'reports',
                'context' => 'default',
                'metrics' => [
                    self::metric('receivables', 'Receivables', $summary['receivablesOutstanding'], 'money', self::outstandingHint()),
                    self::metric('payables', 'Payables', $summary['payablesOutstanding'], 'money', self::outstandingHint()),
                    self::metric('exceptions', 'Exceptions', (string) $summary['exceptions'], 'count', 'Match and settlement issues'),
                    self::metric('collected', 'Collected', $summary['collected'], 'money', self::flowHint('Verified inbound settlement', $period)),
                ],
                'charts' => [],
            ],
        }, $period);
    }

    /**
     * @param array<string, mixed> $summary
     * @return array<string, mixed>
     */
    private static function reportsCollections(int $org, array $summary, string $period = 'all'): array
    {
        global $wpdb;
        $total = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_settlements WHERE organization_id = %d AND purpose = 'AR_COLLECTION'",
            $org
        ));
        $success = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_settlements WHERE organization_id = %d AND purpose = 'AR_COLLECTION' AND normalized_status = 'SUCCESS'",
            $org
        ));
        $inFlight = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_settlements WHERE organization_id = %d AND purpose = 'AR_COLLECTION' AND normalized_status IN ('PENDING_DEPOSIT','KNOWN_DEPOSIT_TX','PROCESSING')",
            $org
        ));

        return [
            'module' => 'reports',
            'context' => 'collections',
            'metrics' => [
                self::metric('total', 'Collection attempts', (string) $total, 'count'),
                self::metric('matched', 'Successful', (string) $success, 'count'),
                self::metric('pending', 'In flight', (string) $inFlight, 'count'),
                self::metric('collected', 'Collected (AR)', $summary['collected'], 'money', self::flowHint('Invoice payments recorded', $period)),
            ],
            'charts' => [
                [
                    'id' => 'collection_status',
                    'title' => 'Collection settlement status',
                    'description' => 'All AR_COLLECTION settlements in this org.',
                    'segments' => self::settlementPurposeSegments($org, 'AR_COLLECTION'),
                ],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $summary
     * @return array<string, mixed>
     */
    private static function reportsExceptions(int $org, array $summary): array
    {
        global $wpdb;
        $exceptionTotal = (string) ($wpdb->get_var($wpdb->prepare(
            "SELECT COALESCE(SUM(CAST(total_decimal AS DECIMAL(24,8))), 0) FROM {$wpdb->prefix}mf_ap_bills WHERE organization_id = %d AND match_status = 'exception'",
            $org
        )) ?? '0');

        return [
            'module' => 'reports',
            'context' => 'exceptions',
            'metrics' => [
                self::metric('exceptions', 'Exception bills', (string) $summary['exceptions'], 'count'),
                self::metric('payables', 'AP exposure', $exceptionTotal, 'money', 'On exception bills only'),
                self::metric('pending_approvals', 'Pending approvals', (string) $summary['pendingApprovals'], 'count'),
                self::metric('pending_settlements', 'Settlements queued', (string) $summary['pendingSettlements'], 'count'),
            ],
            'charts' => [
                [
                    'id' => 'exception_bill_status',
                    'title' => 'Exception bills by workflow status',
                    'segments' => self::groupCountsFiltered($org, 'mf_ap_bills', 'status', "match_status = 'exception'"),
                ],
                [
                    'id' => 'exception_match',
                    'title' => 'Match flags (org-wide)',
                    'segments' => self::groupCounts($org, 'mf_ap_bills', 'match_status'),
                ],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $summary
     * @return array<string, mixed>
     */
    private static function reportsAging(int $org, string $kind, array $summary): array
    {
        $buckets = self::agingBucketTotals($org, $kind);
        $openCount = array_sum(array_map(static fn (array $s) => (int) ($s['invoice_count'] ?? 0), $buckets));
        $outstanding = $kind === 'ar' ? $summary['receivablesOutstanding'] : $summary['payablesOutstanding'];
        $label = $kind === 'ar' ? 'Customer balances by due date' : 'Supplier balances by due date';

        return [
            'module' => 'reports',
            'context' => $kind === 'ar' ? 'receivables-aging' : 'payables-aging',
            'metrics' => [
                self::metric('total', 'Open invoices', (string) $openCount, 'count'),
                self::metric($kind === 'ar' ? 'receivables' : 'payables', 'Outstanding', $outstanding, 'money'),
                self::metric('exceptions', 'AP exceptions', (string) $summary['exceptions'], 'count'),
                self::metric('collected', 'Collected', $summary['collected'], 'money'),
            ],
            'charts' => [
                [
                    'id' => 'aging_buckets',
                    'title' => $label,
                    'description' => 'Outstanding balance by due-date bucket.',
                    'segments' => array_map(static function (array $row): array {
                        return [
                            'label' => (string) $row['label'],
                            'value' => (float) $row['amount'],
                            'amount' => (string) $row['amount'],
                        ];
                    }, $buckets),
                ],
            ],
        ];
    }

    /**
     * @return list<array{label: string, value: int, amount?: string}>
     */
    private static function settlementPurposeSegments(int $org, string $purpose): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT normalized_status AS lbl, COUNT(*) AS cnt,
                    SUM(CAST(destination_amount_decimal AS DECIMAL(24,8))) AS amt
             FROM {$wpdb->prefix}mf_settlements
             WHERE organization_id = %d AND purpose = %s
             GROUP BY normalized_status ORDER BY cnt DESC",
            $org,
            $purpose
        ), ARRAY_A) ?: [];
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'label' => (string) ($row['lbl'] ?? 'unknown'),
                'value' => (int) ($row['cnt'] ?? 0),
                'amount' => (string) ($row['amt'] ?? '0'),
            ];
        }
        return $out;
    }

    /**
     * @return list<array{label: string, value: int}>
     */
    private static function groupCountsFiltered(int $org, string $table, string $column, string $whereSql): array
    {
        global $wpdb;
        $t = $wpdb->prefix . $table;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT {$column} AS lbl, COUNT(*) AS cnt FROM {$t} WHERE organization_id = %d AND {$whereSql} GROUP BY {$column} ORDER BY cnt DESC",
            $org
        ), ARRAY_A) ?: [];
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'label' => (string) ($row['lbl'] ?? 'unknown'),
                'value' => (int) ($row['cnt'] ?? 0),
            ];
        }
        return $out;
    }

    /**
     * @return list<array{label: string, amount: string, invoice_count: int}>
     */
    private static function agingBucketTotals(int $org, string $kind): array
    {
        global $wpdb;
        $table = $kind === 'ar' ? 'mf_ar_invoices' : 'mf_ap_bills';
        $open = $kind === 'ar' ? FinanceAggregate::AR_OPEN_STATUSES : FinanceAggregate::AP_OPEN_STATUSES;
        $openSql = "'" . implode("','", array_map('esc_sql', $open)) . "'";
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT due_date, amount_outstanding_decimal FROM {$wpdb->prefix}{$table}
             WHERE organization_id = %d AND status IN ({$openSql})
               AND CAST(amount_outstanding_decimal AS DECIMAL(36,8)) > 0",
            $org
        ), ARRAY_A) ?: [];
        $today = gmdate('Y-m-d');
        $summary = [
            'current' => ['amount' => '0', 'invoice_count' => 0],
            'days_1_30' => ['amount' => '0', 'invoice_count' => 0],
            'days_31_60' => ['amount' => '0', 'invoice_count' => 0],
            'days_61_90' => ['amount' => '0', 'invoice_count' => 0],
            'days_90_plus' => ['amount' => '0', 'invoice_count' => 0],
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
            $summary[$aging]['amount'] = Money::add($summary[$aging]['amount'], $outstanding);
            ++$summary[$aging]['invoice_count'];
        }
        $labels = [
            'current' => 'Current',
            'days_1_30' => '1–30 days',
            'days_31_60' => '31–60 days',
            'days_61_90' => '61–90 days',
            'days_90_plus' => '90+ days',
        ];
        $out = [];
        foreach ($labels as $key => $label) {
            $out[] = [
                'label' => $label,
                'amount' => $summary[$key]['amount'],
                'invoice_count' => $summary[$key]['invoice_count'],
            ];
        }
        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private static function financeAi(int $org, string $period = 'all'): array
    {
        $summary = self::financeSummary($org, $period);
        return self::withPeriodMeta([
            'module' => 'finance-ai',
            'context' => 'default',
            'metrics' => [
                self::metric('receivables', 'Receivables outstanding', $summary['receivablesOutstanding'], 'money', self::outstandingHint()),
                self::metric('payables', 'Payables outstanding', $summary['payablesOutstanding'], 'money', self::outstandingHint()),
                self::metric('pending_approvals', 'Approvals waiting', (string) $summary['pendingApprovals'], 'count', 'Pending policy decisions'),
                self::metric('exceptions', 'Match exceptions', (string) $summary['exceptions'], 'count', 'Bills that failed three-way match'),
            ],
            'charts' => [],
        ], $period);
    }

    /**
     * @return array{id: string, label: string, value: string, kind: string, hint?: string}
     */
    private static function metric(string $id, string $label, string $value, string $kind, ?string $hint = null): array
    {
        $row = ['id' => $id, 'label' => $label, 'value' => $value, 'kind' => $kind];
        if ($hint !== null) {
            $row['hint'] = $hint;
        }
        return $row;
    }
}
