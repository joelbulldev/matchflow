<?php
/**
 * Finance AI (allowlisted tools, grounded answers).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\AI\AiChatService;
use Matchflow\AI\AiConfig;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class FinanceAiController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/finance-ai/query', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ai.use')),
            'callback' => [self::class, 'query'],
        ]);
    }

    public static function query(WP_REST_Request $request)
    {
        $user_id = get_current_user_id();
        if ($user_id > 0 && !AiChatService::withinDailyLimit($user_id)) {
            return Response::error('matchflow_ai_limit', 'Daily Finance AI limit reached for your account.', 429);
        }

        $prompt = sanitize_text_field((string) ($request->get_param('prompt') ?? ''));
        $tool = sanitize_key((string) ($request->get_param('tool') ?? 'summarize'));

        $allowed = [
            'get_receivables',
            'get_payables',
            'get_pending_approvals',
            'get_overdue_invoices',
            'explain_match_result',
            'summarize',
        ];
        if (!in_array($tool, $allowed, true)) {
            return Response::error('matchflow_tool_denied', 'Tool not allowlisted.', 403);
        }

        $dashboard = DashboardController::summary($request);
        $summary = method_exists($dashboard, 'get_data') ? ($dashboard->get_data()['data'] ?? []) : [];

        $snapshot = sprintf(
            "Organization financial snapshot (ground truth only):\n"
            . "- Receivables outstanding: %s\n"
            . "- Payables outstanding: %s\n"
            . "- Pending approvals: %d\n"
            . "- Pending settlements: %d\n"
            . "- Reconciliation exceptions: %d\n",
            (string) ($summary['receivablesOutstanding'] ?? '0'),
            (string) ($summary['payablesOutstanding'] ?? '0'),
            (int) ($summary['pendingApprovals'] ?? 0),
            (int) ($summary['pendingSettlements'] ?? 0),
            (int) ($summary['exceptions'] ?? 0)
        );

        $answer = match ($tool) {
            'get_pending_approvals' => sprintf('There are %d supplier approvals waiting.', (int) ($summary['pendingApprovals'] ?? 0)),
            'get_overdue_invoices', 'get_receivables' => sprintf('Outstanding receivables total %s.', (string) ($summary['receivablesOutstanding'] ?? '0')),
            'get_payables' => sprintf('Outstanding payables total %s. %d bills have match exceptions.', (string) ($summary['payablesOutstanding'] ?? '0'), (int) ($summary['exceptions'] ?? 0)),
            'explain_match_result' => 'Open the bill match workspace for line-level discrepancy explanations. MATCHFLOW never invents financial figures.',
            default => $snapshot,
        };

        if (AiConfig::configured() && $prompt !== '') {
            $system = 'You are Finance AI for MATCHFLOW, a treasury operations product. '
                . 'Answer using only the snapshot data provided. Never invent balances, rates, or settlement status. '
                . 'If data is missing, say so. Do not execute transactions or change policies.';
            $completed = AiChatService::complete([
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $snapshot . "\n\nUser question: " . $prompt],
            ]);
            if (!is_wp_error($completed) && $completed !== '') {
                $answer = $completed;
                if ($user_id > 0) {
                    AiChatService::recordUse($user_id);
                }
            }
        }

        return Response::success([
            'answer' => $answer,
            'grounded' => true,
            'sources' => ['dashboard.summary'],
            'proposals' => [],
            'note' => 'AI cannot change recipients, bypass policies, or sign transactions.',
        ]);
    }
}
