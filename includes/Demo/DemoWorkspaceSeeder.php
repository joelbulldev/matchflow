<?php
/**
 * Rich read/write sample data for the shared demo organization.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Demo;

defined('ABSPATH') || exit;

use Matchflow\Payables\MatchingEngine;
use Matchflow\Policies\PolicyEngine;
use Matchflow\Receivables\InvoiceService;
use Matchflow\Receivables\PaymentRequestService;

final class DemoWorkspaceSeeder
{
    private const SEED_VERSION = 3;

    public static function seedIfNeeded(int $org_id, int $user_id): void
    {
        if ($org_id <= 0 || $user_id <= 0) {
            return;
        }

        global $wpdb;
        $marker = (int) get_option('matchflow_demo_seed_version_' . $org_id, 0);
        $invoice_count = (int) $wpdb->get_var(
            $wpdb->prepare(
                'SELECT COUNT(*) FROM ' . $wpdb->prefix . 'mf_ar_invoices WHERE organization_id = %d',
                $org_id
            )
        );
        if ($marker >= self::SEED_VERSION && $invoice_count >= 4) {
            return;
        }

        $previous = get_current_user_id();
        wp_set_current_user($user_id);

        try {
            self::configureOrganization($org_id);
            [$customer_a, $customer_b, $supplier] = self::seedCounterparties($org_id);
            self::seedPolicies($org_id);
            self::seedReceivables($org_id, $user_id, $customer_a, $customer_b);
            self::seedProcurementAndPayables($org_id, $user_id, $supplier);
            update_option('matchflow_demo_seed_version_' . $org_id, self::SEED_VERSION, false);
        } finally {
            wp_set_current_user($previous);
        }
    }

    private static function configureOrganization(int $org_id): void
    {
        global $wpdb;
        $dest_asset = trim((string) (get_option('matchflow_default_destination_asset', 'nep141:wrap.near') ?: 'nep141:wrap.near'));
        $dest_address = trim((string) (get_option('matchflow_default_destination_address', '') ?: ''));
        if ($dest_address === '') {
            $dest_address = 'matchflow-demo.near';
        }
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->update(
            $wpdb->prefix . 'mf_organizations',
            [
                'checkout_display_name' => 'MATCHFLOW Demo Co.',
                'checkout_tagline' => 'Hackathon treasury workspace',
                'checkout_message' => 'Pay from any supported chain. Funds settle to our configured treasury address.',
                'checkout_support_email' => 'demo@matchflow.local',
                'preferred_destination_asset' => $dest_asset,
                'preferred_destination_address' => $dest_address,
                'updated_at' => $now,
            ],
            ['id' => $org_id]
        );
    }

    /**
     * @return array{0:int,1:int,2:int}
     */
    private static function seedCounterparties(int $org_id): array
    {
        global $wpdb;
        $table = $wpdb->prefix . 'mf_counterparties';
        $now = gmdate('Y-m-d H:i:s');

        $customer_a = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE organization_id = %d AND email = %s LIMIT 1",
            $org_id,
            'atlas@example.com'
        ));
        if ($customer_a <= 0) {
            $wpdb->insert($table, [
                'organization_id' => $org_id,
                'type' => 'customer',
                'name' => 'Atlas Ventures',
                'email' => 'atlas@example.com',
                'country' => 'US',
                'status' => 'active',
                'approved' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $customer_a = (int) $wpdb->insert_id;
        }

        $customer_b = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE organization_id = %d AND email = %s LIMIT 1",
            $org_id,
            'orbit@example.com'
        ));
        if ($customer_b <= 0) {
            $wpdb->insert($table, [
                'organization_id' => $org_id,
                'type' => 'customer',
                'name' => 'Orbit Labs',
                'email' => 'orbit@example.com',
                'country' => 'GB',
                'status' => 'active',
                'approved' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $customer_b = (int) $wpdb->insert_id;
        }

        $supplier = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$table} WHERE organization_id = %d AND name = %s LIMIT 1",
            $org_id,
            'Northwind Components'
        ));
        if ($supplier <= 0) {
            $wpdb->insert($table, [
                'organization_id' => $org_id,
                'type' => 'supplier',
                'name' => 'Northwind Components',
                'email' => 'ap@northwind.example',
                'country' => 'US',
                'status' => 'active',
                'approved' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $supplier = (int) $wpdb->insert_id;
        }

        return [$customer_a, $customer_b, $supplier];
    }

    private static function seedPolicies(int $org_id): void
    {
        global $wpdb;
        $exists = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . $wpdb->prefix . 'mf_policies WHERE organization_id = %d',
            $org_id
        ));
        if ($exists > 0) {
            return;
        }
        (new PolicyEngine())->savePolicy($org_id, 'Demo policy', [
            ...PolicyEngine::DEFAULT_RULES,
            'dual_control' => false,
            'auto_approve_cap_decimal' => '10000',
        ]);
    }

    private static function seedReceivables(int $org_id, int $user_id, int $customer_a, int $customer_b): void
    {
        global $wpdb;
        $invoices = new InvoiceService();
        $payReq = new PaymentRequestService();

        if (!(int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}mf_ar_invoices WHERE organization_id = %d AND invoice_number = %s",
            $org_id,
            'INV-DEMO-2500'
        ))) {
            $draft = $invoices->create($org_id, $user_id, [
                'customer_id' => $customer_a,
                'invoice_number' => 'INV-DEMO-DRAFT',
                'currency' => 'USD',
                'due_date' => gmdate('Y-m-d', strtotime('+30 days')),
                'payment_terms' => 'Net 30',
                'notes' => 'Editable draft — issue when ready.',
                'items' => [
                    ['description' => 'Advisory retainer', 'quantity' => '1', 'unit_price' => '1200'],
                ],
            ]);
            unset($draft);

            $hero = $invoices->create($org_id, $user_id, [
                'customer_id' => $customer_a,
                'invoice_number' => 'INV-DEMO-2500',
                'currency' => 'USD',
                'due_date' => gmdate('Y-m-d', strtotime('+30 days')),
                'payment_terms' => 'Net 30',
                'brand_theme' => 'classic',
                'items' => [
                    ['description' => 'Platform integration', 'quantity' => '1', 'unit_price' => '2500'],
                ],
            ]);
            if (!empty($hero['id'])) {
                $invoices->issue($org_id, (int) $hero['id']);
            }

            $overdue = $invoices->create($org_id, $user_id, [
                'customer_id' => $customer_b,
                'invoice_number' => 'INV-DEMO-OVERDUE',
                'currency' => 'USD',
                'due_date' => gmdate('Y-m-d', strtotime('-14 days')),
                'items' => [
                    ['description' => 'Compute services', 'quantity' => '1', 'unit_price' => '8900'],
                ],
            ]);
            if (!empty($overdue['id'])) {
                $issued = $invoices->issue($org_id, (int) $overdue['id']);
                if (!is_wp_error($issued)) {
                    $wpdb->update($wpdb->prefix . 'mf_ar_invoices', [
                        'status' => 'overdue',
                        'updated_at' => gmdate('Y-m-d H:i:s'),
                    ], ['id' => (int) $overdue['id'], 'organization_id' => $org_id]);
                }
            }

            $partial = $invoices->create($org_id, $user_id, [
                'customer_id' => $customer_b,
                'invoice_number' => 'INV-DEMO-PARTIAL',
                'currency' => 'USD',
                'due_date' => gmdate('Y-m-d', strtotime('+7 days')),
                'items' => [
                    ['description' => 'Support plan', 'quantity' => '1', 'unit_price' => '4000'],
                ],
            ]);
            if (!empty($partial['id'])) {
                $invoices->issue($org_id, (int) $partial['id']);
                $invoices->applyPayment($org_id, (int) $partial['id'], '1500');
            }

            $paid = $invoices->create($org_id, $user_id, [
                'customer_id' => $customer_a,
                'invoice_number' => 'INV-DEMO-PAID',
                'currency' => 'USD',
                'due_date' => gmdate('Y-m-d', strtotime('-3 days')),
                'items' => [
                    ['description' => 'Workshop fee', 'quantity' => '2', 'unit_price' => '750'],
                ],
            ]);
            if (!empty($paid['id'])) {
                $invoices->issue($org_id, (int) $paid['id']);
                $invoices->applyPayment($org_id, (int) $paid['id'], '1500');
            }
        }

        $pr_exists = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}mf_payment_requests WHERE organization_id = %d",
            $org_id
        ));
        if ($pr_exists === 0) {
            $payReq->create($org_id, $user_id, [
                'label' => 'Conference booth deposit',
                'reference' => 'PR-DEMO-001',
                'amount_decimal' => '500',
                'currency' => 'USD',
                'customer_id' => $customer_a,
                'description' => 'Share this checkout link without creating an invoice.',
            ]);
        }
    }

    private static function seedProcurementAndPayables(int $org_id, int $user_id, int $supplier): void
    {
        global $wpdb;
        $po_table = $wpdb->prefix . 'mf_purchase_orders';
        $po_id = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$po_table} WHERE organization_id = %d LIMIT 1",
            $org_id
        ));

        if ($po_id <= 0) {
            $now = gmdate('Y-m-d H:i:s');
            $wpdb->insert($po_table, [
                'organization_id' => $org_id,
                'supplier_id' => $supplier,
                'po_number' => 'PO-DEMO-1001',
                'currency' => 'USD',
                'total_decimal' => '3200',
                'expected_date' => gmdate('Y-m-d', strtotime('+5 days')),
                'status' => 'issued',
                'created_by' => $user_id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $po_id = (int) $wpdb->insert_id;
            $wpdb->insert($wpdb->prefix . 'mf_purchase_order_items', [
                'po_id' => $po_id,
                'description' => 'Sensor modules',
                'normalized_item_key' => 'sensor-modules',
                'ordered_quantity_decimal' => '40',
                'unit_price_decimal' => '80',
                'price_tolerance_bps' => 100,
                'line_total_decimal' => '3200',
                'sort_order' => 0,
            ]);

            $wpdb->insert($wpdb->prefix . 'mf_goods_receipts', [
                'organization_id' => $org_id,
                'po_id' => $po_id,
                'receipt_reference' => 'GRN-DEMO-001',
                'received_at' => gmdate('Y-m-d H:i:s'),
                'status' => 'recorded',
                'created_by' => $user_id,
                'created_at' => $now,
            ]);
        }

        $bill_table = $wpdb->prefix . 'mf_ap_bills';
        $bill_pending = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$bill_table} WHERE organization_id = %d AND invoice_number = %s",
            $org_id,
            'BILL-DEMO-PENDING'
        ));
        if ($bill_pending <= 0) {
            $now = gmdate('Y-m-d H:i:s');
            $wpdb->insert($bill_table, [
                'organization_id' => $org_id,
                'supplier_id' => $supplier,
                'invoice_number' => 'BILL-DEMO-PENDING',
                'currency' => 'USD',
                'subtotal_decimal' => '3200',
                'tax_decimal' => '0',
                'total_decimal' => '3200',
                'amount_paid_decimal' => '0',
                'amount_outstanding_decimal' => '3200',
                'invoice_date' => gmdate('Y-m-d'),
                'due_date' => gmdate('Y-m-d', strtotime('+21 days')),
                'status' => 'pending_approval',
                'match_status' => 'passed',
                'approval_status' => 'pending',
                'purchase_order_id' => $po_id,
                'created_by' => $user_id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $bill_pending = (int) $wpdb->insert_id;
            $wpdb->insert($wpdb->prefix . 'mf_ap_bill_items', [
                'bill_id' => $bill_pending,
                'description' => 'Sensor modules',
                'normalized_item_key' => 'sensor-modules',
                'quantity_decimal' => '40',
                'unit_price_decimal' => '80',
                'tax_decimal' => '0',
                'line_total_decimal' => '3200',
                'sort_order' => 0,
            ]);
            $wpdb->insert($wpdb->prefix . 'mf_approvals', [
                'organization_id' => $org_id,
                'subject_type' => 'ap_bill',
                'subject_id' => $bill_pending,
                'requested_by' => $user_id,
                'status' => 'pending',
                'created_at' => $now,
            ]);
        }

        $bill_review = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$bill_table} WHERE organization_id = %d AND invoice_number = %s",
            $org_id,
            'BILL-DEMO-REVIEW'
        ));
        if ($bill_review <= 0) {
            $now = gmdate('Y-m-d H:i:s');
            $wpdb->insert($bill_table, [
                'organization_id' => $org_id,
                'supplier_id' => $supplier,
                'invoice_number' => 'BILL-DEMO-REVIEW',
                'currency' => 'USD',
                'subtotal_decimal' => '1800',
                'tax_decimal' => '0',
                'total_decimal' => '1800',
                'amount_paid_decimal' => '0',
                'amount_outstanding_decimal' => '1800',
                'invoice_date' => gmdate('Y-m-d'),
                'due_date' => gmdate('Y-m-d', strtotime('+10 days')),
                'status' => 'needs_review',
                'match_status' => 'pending',
                'approval_status' => 'not_required',
                'created_by' => $user_id,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $bill_review = (int) $wpdb->insert_id;
            $wpdb->insert($wpdb->prefix . 'mf_ap_bill_items', [
                'bill_id' => $bill_review,
                'description' => 'Freight charges',
                'normalized_item_key' => 'freight-charges',
                'quantity_decimal' => '1',
                'unit_price_decimal' => '1800',
                'tax_decimal' => '0',
                'line_total_decimal' => '1800',
                'sort_order' => 0,
            ]);
            (new MatchingEngine())->run($org_id, $bill_review);
        }

        self::seedNotifications($org_id, $user_id);
    }

    private static function seedNotifications(int $org_id, int $user_id): void
    {
        global $wpdb;
        $count = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT COUNT(*) FROM ' . $wpdb->prefix . 'mf_notifications WHERE organization_id = %d',
            $org_id
        ));
        if ($count > 0) {
            return;
        }
        $now = gmdate('Y-m-d H:i:s');
        $items = [
            ['type' => 'invoice_issued', 'message' => 'Invoice INV-DEMO-2500 is live — payment link ready.'],
            ['type' => 'approval_submitted', 'message' => 'Bill BILL-DEMO-PENDING is waiting for approval.'],
            ['type' => 'po_created', 'message' => 'Purchase order PO-DEMO-1001 issued to Northwind Components.'],
        ];
        foreach ($items as $item) {
            $wpdb->insert($wpdb->prefix . 'mf_notifications', [
                'organization_id' => $org_id,
                'user_id' => $user_id,
                'type' => $item['type'],
                'payload_json' => wp_json_encode(['message' => $item['message']]),
                'created_at' => $now,
            ]);
        }
    }
}
