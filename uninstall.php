<?php
/**
 * Uninstall MATCHFLOW.
 *
 * Business data is preserved by default. Set MATCHFLOW_DELETE_DATA_ON_UNINSTALL
 * to true (constant or option) to wipe plugin tables and options.
 *
 * @package Matchflow
 */

declare(strict_types=1);

defined('WP_UNINSTALL_PLUGIN') || exit;

$delete = defined('MATCHFLOW_DELETE_DATA_ON_UNINSTALL') && MATCHFLOW_DELETE_DATA_ON_UNINSTALL;
$delete = $delete || (bool) get_option('matchflow_delete_data_on_uninstall', false);

if (!$delete) {
    delete_option('matchflow_rewrite_flushed');
    return;
}

global $wpdb;

$tables = [
    'mf_notifications',
    'mf_public_tokens',
    'mf_audit_events',
    'mf_ledger_entries',
    'mf_settlement_events',
    'mf_settlements',
    'mf_approvals',
    'mf_approval_policies',
    'mf_match_runs',
    'mf_extractions',
    'mf_documents',
    'mf_goods_receipt_items',
    'mf_goods_receipts',
    'mf_purchase_order_items',
    'mf_purchase_orders',
    'mf_ap_bill_items',
    'mf_ap_bills',
    'mf_ar_invoice_items',
    'mf_ar_invoices',
    'mf_counterparty_addresses',
    'mf_counterparties',
    'mf_memberships',
    'mf_organizations',
];

foreach ($tables as $table) {
    $wpdb->query('DROP TABLE IF EXISTS ' . $wpdb->prefix . $table); // phpcs:ignore WordPress.DB.PreparedSQL
}

$wpdb->query(
    $wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
        'matchflow_%',
        '_transient_matchflow_%'
    )
);
