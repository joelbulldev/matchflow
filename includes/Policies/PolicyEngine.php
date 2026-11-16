<?php
/**
 * Versioned settlement and approval policy checks.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Policies;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;

final class PolicyEngine
{
    public const DEFAULT_RULES = [
        'require_approved_supplier' => true,
        'require_match_passed' => true,
        'block_exact_duplicates' => true,
        'auto_approve_cap_decimal' => '0',
        'daily_settlement_cap_decimal' => '0',
        'allowed_assets' => [],
        'dual_control' => true,
        'kill_switch' => false,
    ];

    /**
     * @return array{ok:bool,checks:array<int,array{code:string,passed:bool,message:string}>,rules:array}
     */
    public function evaluate(int $org_id, array $context): array
    {
        $rules = $this->activeRules($org_id);
        $checks = [];

        if (!empty($rules['kill_switch'])) {
            $checks[] = $this->check('kill_switch', false, 'Settlement kill-switch is enabled.');
            return ['ok' => false, 'checks' => $checks, 'rules' => $rules];
        }
        $checks[] = $this->check('kill_switch', true, 'Kill-switch off.');

        if (!empty($rules['require_approved_supplier']) && ($context['purpose'] ?? '') === 'AP_SETTLEMENT') {
            $approved = !empty($context['supplier_approved']);
            $checks[] = $this->check('approved_supplier', $approved, $approved ? 'Supplier approved.' : 'Supplier is not approved.');
        }

        if (!empty($rules['require_match_passed']) && ($context['purpose'] ?? '') === 'AP_SETTLEMENT') {
            $match = (string) ($context['match_status'] ?? '');
            $ok = in_array($match, ['passed', 'passed_with_variance'], true);
            $checks[] = $this->check('required_match', $ok, $ok ? 'Match requirements satisfied.' : 'Three-way match has not passed.');
        }

        if (!empty($rules['block_exact_duplicates']) && !empty($context['is_exact_duplicate'])) {
            $checks[] = $this->check('duplicate_block', false, 'Exact duplicate bill blocked by policy.');
        }

        $amount = (string) ($context['amount_decimal'] ?? '0');
        $auto_cap = (string) ($rules['auto_approve_cap_decimal'] ?? '0');
        if (Money::cmp($auto_cap, '0') > 0) {
            $within = Money::cmp($amount, $auto_cap) <= 0;
            $checks[] = $this->check('auto_cap', true, $within ? 'Within auto-approve cap.' : 'Above auto-approve cap — human approval required.');
            $context['requires_human_approval'] = !$within;
        }

        $daily_cap = (string) ($rules['daily_settlement_cap_decimal'] ?? '0');
        if (Money::cmp($daily_cap, '0') > 0) {
            $spent = (string) ($context['daily_settled_decimal'] ?? '0');
            $projected = Money::add($spent, $amount);
            $ok = Money::cmp($projected, $daily_cap) <= 0;
            $checks[] = $this->check('daily_cap', $ok, $ok ? 'Within daily settlement cap.' : 'Daily settlement cap exceeded.');
        }

        $allowed = $rules['allowed_assets'] ?? [];
        if (is_array($allowed) && $allowed !== [] && !empty($context['asset_id'])) {
            $ok = in_array((string) $context['asset_id'], $allowed, true);
            $checks[] = $this->check('allowed_asset', $ok, $ok ? 'Asset allowed.' : 'Asset not in allowed settlement list.');
        }

        if (!empty($rules['dual_control']) && !empty($context['requester_is_approver'])) {
            $checks[] = $this->check('dual_control', false, 'Dual-control prevents self-approval.');
        } elseif (!empty($rules['dual_control'])) {
            $checks[] = $this->check('dual_control', true, 'Dual-control satisfied.');
        }

        $ok = true;
        foreach ($checks as $check) {
            if (!$check['passed']) {
                $ok = false;
                break;
            }
        }

        return ['ok' => $ok, 'checks' => $checks, 'rules' => $rules];
    }

    /**
     * @return array<string, mixed>
     */
    public function activeRules(int $org_id): array
    {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare(
                'SELECT rules_json FROM ' . $wpdb->prefix . 'mf_approval_policies WHERE organization_id = %d AND active = 1 ORDER BY version DESC LIMIT 1',
                $org_id
            ),
            ARRAY_A
        );
        if (!$row) {
            return self::DEFAULT_RULES;
        }
        $decoded = json_decode((string) $row['rules_json'], true);
        if (!is_array($decoded)) {
            return self::DEFAULT_RULES;
        }
        return array_merge(self::DEFAULT_RULES, $decoded);
    }

    public function savePolicy(int $org_id, string $name, array $rules): array
    {
        global $wpdb;
        $now = gmdate('Y-m-d H:i:s');
        $version = (int) $wpdb->get_var(
            $wpdb->prepare(
                'SELECT COALESCE(MAX(version), 0) FROM ' . $wpdb->prefix . 'mf_approval_policies WHERE organization_id = %d',
                $org_id
            )
        ) + 1;

        $wpdb->query(
            $wpdb->prepare(
                'UPDATE ' . $wpdb->prefix . 'mf_approval_policies SET active = 0, updated_at = %s WHERE organization_id = %d AND active = 1',
                $now,
                $org_id
            )
        );

        $merged = array_merge(self::DEFAULT_RULES, $rules);
        $wpdb->insert(
            $wpdb->prefix . 'mf_approval_policies',
            [
                'organization_id' => $org_id,
                'name' => $name,
                'rules_json' => wp_json_encode($merged),
                'version' => $version,
                'active' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        return [
            'id' => (int) $wpdb->insert_id,
            'name' => $name,
            'version' => $version,
            'rules' => $merged,
        ];
    }

    /**
     * @return array{code:string,passed:bool,message:string}
     */
    private function check(string $code, bool $passed, string $message): array
    {
        return ['code' => $code, 'passed' => $passed, 'message' => $message];
    }
}
