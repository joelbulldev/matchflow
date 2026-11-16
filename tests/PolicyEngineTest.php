<?php

declare(strict_types=1);

use Matchflow\Policies\PolicyEngine;
use PHPUnit\Framework\TestCase;

final class PolicyEngineTest extends TestCase
{
    public function testKillSwitchBlocks(): void
    {
        $engine = new class extends PolicyEngine {
            public function activeRules(int $org_id): array
            {
                return array_merge(self::DEFAULT_RULES, ['kill_switch' => true]);
            }
        };
        $result = $engine->evaluate(1, ['purpose' => 'AP_SETTLEMENT', 'amount_decimal' => '10']);
        $this->assertFalse($result['ok']);
        $this->assertSame('kill_switch', $result['checks'][0]['code']);
    }

    public function testDualControlBlocksSelfApproval(): void
    {
        $engine = new class extends PolicyEngine {
            public function activeRules(int $org_id): array
            {
                return self::DEFAULT_RULES;
            }
        };
        $result = $engine->evaluate(1, [
            'purpose' => 'AP_SETTLEMENT',
            'amount_decimal' => '10',
            'supplier_approved' => true,
            'match_status' => 'passed',
            'requester_is_approver' => true,
        ]);
        $this->assertFalse($result['ok']);
        $codes = array_column($result['checks'], 'code');
        $this->assertContains('dual_control', $codes);
    }
}
