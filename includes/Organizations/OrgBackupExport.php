<?php
/**
 * Organization-level financial JSON backup export.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Organizations;

defined('ABSPATH') || exit;

final class OrgBackupExport
{
    public function export(int $org_id): array
    {
        global $wpdb;
        $p = $wpdb->prefix;

        $org = (new OrganizationRepository())->find($org_id);

        return [
            'exported_at' => gmdate('c'),
            'schema_version' => defined('MATCHFLOW_SCHEMA_VERSION') ? MATCHFLOW_SCHEMA_VERSION : '0',
            'organization' => $org,
            'memberships' => (new MembershipRepository())->listForOrganization($org_id),
            'counterparties' => $wpdb->get_results($wpdb->prepare("SELECT * FROM {$p}mf_counterparties WHERE organization_id = %d", $org_id), ARRAY_A) ?: [],
            'ar_invoices' => $wpdb->get_results($wpdb->prepare("SELECT * FROM {$p}mf_ar_invoices WHERE organization_id = %d", $org_id), ARRAY_A) ?: [],
            'ap_bills' => $wpdb->get_results($wpdb->prepare("SELECT * FROM {$p}mf_ap_bills WHERE organization_id = %d", $org_id), ARRAY_A) ?: [],
            'purchase_orders' => $wpdb->get_results($wpdb->prepare("SELECT * FROM {$p}mf_purchase_orders WHERE organization_id = %d", $org_id), ARRAY_A) ?: [],
            'settlements' => $wpdb->get_results($wpdb->prepare("SELECT * FROM {$p}mf_settlements WHERE organization_id = %d", $org_id), ARRAY_A) ?: [],
            'ledger_entries' => $wpdb->get_results($wpdb->prepare("SELECT * FROM {$p}mf_ledger_entries WHERE organization_id = %d", $org_id), ARRAY_A) ?: [],
            'audit_events' => $wpdb->get_results($wpdb->prepare("SELECT * FROM {$p}mf_audit_events WHERE organization_id = %d ORDER BY id DESC LIMIT 5000", $org_id), ARRAY_A) ?: [],
        ];
    }
}
