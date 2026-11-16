<?php
/**
 * Organization roles and capabilities.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class Capabilities
{
    public const ROLES = [
        'owner' => ['*'],
        'administrator' => [
            'org.manage', 'members.manage', 'settings.manage', 'policies.manage', 'wallets.manage',
            'ar.read', 'ar.write', 'ap.read', 'ap.write', 'procurement.read', 'procurement.write',
            'approvals.read', 'approvals.decide', 'payments.read', 'payments.initiate', 'reports.read', 'audit.read', 'ai.use',
            'ledger.read', 'reconciliation.manage',
        ],
        'finance_manager' => [
            'ar.read', 'ar.write', 'ap.read', 'ap.write', 'procurement.read', 'procurement.write',
            'approvals.read', 'approvals.decide', 'payments.read', 'payments.initiate', 'policies.manage',
            'reports.read', 'audit.read', 'ai.use', 'settings.limited', 'ledger.read', 'reconciliation.manage',
        ],
        'ap_officer' => [
            'ap.read', 'ap.write', 'procurement.read', 'procurement.write', 'approvals.read',
            'payments.read', 'payments.prepare', 'reports.limited', 'ai.use',
        ],
        'approver' => [
            'approvals.read', 'approvals.decide', 'ap.read', 'payments.read', 'reports.limited', 'audit.read',
        ],
        'accountant' => [
            'ar.read', 'ap.read', 'payments.read', 'reports.read', 'audit.read', 'reconciliation.manage', 'ledger.read',
        ],
        'viewer' => [
            'ar.read', 'ap.read', 'payments.read', 'reports.read', 'audit.read', 'ledger.read',
        ],
    ];

    public static function roleHas(string $role, string $capability): bool
    {
        $caps = self::capabilitiesForRole($role);
        return in_array('*', $caps, true) || in_array($capability, $caps, true);
    }

    /**
     * @return list<string>
     */
    public static function capabilitiesForRole(string $role): array
    {
        return self::ROLES[$role] ?? [];
    }
}
