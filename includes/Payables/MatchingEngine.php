<?php
/**
 * Deterministic three-way matching.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Payables;

defined('ABSPATH') || exit;

use Matchflow\Domain\Money;

final class MatchingEngine
{
    public const RULE_VERSION = '1.0.0';

    public function run(int $org_id, int $bill_id): array
    {
        global $wpdb;
        $bill = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bills WHERE organization_id = %d AND id = %d', $org_id, $bill_id), ARRAY_A);
        if (!$bill) {
            return ['result' => 'missing_bill', 'discrepancies' => [['code' => 'missing_bill', 'message' => 'Bill not found.']]];
        }

        $bill_items = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_ap_bill_items WHERE bill_id = %d', $bill_id), ARRAY_A) ?: [];
        $po_id = (int) ($bill['purchase_order_id'] ?? 0);
        $discrepancies = [];

        if ($po_id <= 0) {
            $result = 'missing_po';
            $discrepancies[] = ['code' => 'missing_po', 'message' => 'No purchase order linked to this bill.'];
        } else {
            $po_items = $wpdb->get_results($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_purchase_order_items WHERE po_id = %d', $po_id), ARRAY_A) ?: [];
            $receipt_qty = $this->receivedQuantities($po_id);

            if ($receipt_qty === []) {
                $discrepancies[] = ['code' => 'missing_receipt', 'message' => 'No goods receipt recorded for the purchase order.'];
            }

            foreach ($bill_items as $item) {
                $key = $item['normalized_item_key'] ?: strtolower(trim((string) $item['description']));
                $po_item = $this->findItem($po_items, $key, (string) $item['description']);
                $ordered = $po_item ? (string) $po_item['ordered_quantity_decimal'] : '0';
                $received = $receipt_qty[$po_item['id'] ?? ''] ?? ($receipt_qty[$key] ?? '0');
                $invoiced = (string) $item['quantity_decimal'];
                $unit = (string) $item['unit_price_decimal'];
                $po_unit = $po_item ? (string) $po_item['unit_price_decimal'] : '0';
                $tolerance = $po_item ? (int) $po_item['price_tolerance_bps'] : 0;

                if (Money::cmp($invoiced, $received) > 0) {
                    $extra_qty = Money::sub($invoiced, $received);
                    $impact = Money::mul($extra_qty, $unit);
                    $discrepancies[] = [
                        'code' => 'quantity_over_received',
                        'message' => sprintf('Invoiced quantity %s exceeds received %s (ordered %s). Unjustified amount %s.', $invoiced, $received, $ordered, $impact),
                        'invoiced_qty' => $invoiced,
                        'received_qty' => $received,
                        'ordered_qty' => $ordered,
                        'financial_impact' => $impact,
                        'item' => $item['description'],
                    ];
                }

                if ($po_item && $tolerance >= 0) {
                    $diff = Money::sub($unit, $po_unit);
                    $abs = Money::cmp($diff, '0') < 0 ? Money::mul($diff, '-1') : $diff;
                    $allowed = Money::mul($po_unit, (string) ($tolerance / 10000));
                    if (Money::cmp($abs, $allowed) > 0) {
                        $discrepancies[] = [
                            'code' => 'price_variance',
                            'message' => sprintf('Unit price %s outside tolerance versus PO price %s.', $unit, $po_unit),
                            'item' => $item['description'],
                        ];
                    }
                }
            }

            $dup = $this->duplicateCheck($org_id, $bill);
            if ($dup) {
                $discrepancies[] = $dup;
            }

            $result = $discrepancies === [] ? 'passed' : 'exception';
            if ($discrepancies !== [] && $this->onlySoft($discrepancies)) {
                $result = 'passed_with_variance';
            }
            if ($this->hasCode($discrepancies, 'missing_receipt') && count($discrepancies) === 1) {
                $result = 'missing_goods_receipt';
            }
        }

        $wpdb->insert($wpdb->prefix . 'mf_match_runs', [
            'bill_id' => $bill_id,
            'organization_id' => $org_id,
            'rule_version' => self::RULE_VERSION,
            'result' => $result,
            'discrepancies_json' => wp_json_encode($discrepancies),
            'calculated_at' => gmdate('Y-m-d H:i:s'),
        ]);

        $match_status = in_array($result, ['passed', 'passed_with_variance'], true) ? 'matched' : 'exception';
        $wpdb->update(
            $wpdb->prefix . 'mf_ap_bills',
            [
                'match_status' => $match_status,
                'status' => $match_status === 'matched' ? 'matched' : 'exception',
                'updated_at' => gmdate('Y-m-d H:i:s'),
            ],
            ['id' => $bill_id, 'organization_id' => $org_id]
        );

        return [
            'result' => $result,
            'rule_version' => self::RULE_VERSION,
            'discrepancies' => $discrepancies,
            'match_status' => $match_status,
        ];
    }

    private function receivedQuantities(int $po_id): array
    {
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                'SELECT gri.po_item_id, SUM(gri.received_quantity_decimal) AS qty
                 FROM ' . $wpdb->prefix . 'mf_goods_receipt_items gri
                 INNER JOIN ' . $wpdb->prefix . 'mf_goods_receipts gr ON gr.id = gri.receipt_id
                 WHERE gr.po_id = %d
                 GROUP BY gri.po_item_id',
                $po_id
            ),
            ARRAY_A
        ) ?: [];
        $map = [];
        foreach ($rows as $row) {
            $map[(string) $row['po_item_id']] = (string) $row['qty'];
        }
        return $map;
    }

    private function findItem(array $items, string $key, string $description): ?array
    {
        foreach ($items as $item) {
            $item_key = $item['normalized_item_key'] ?: strtolower(trim((string) $item['description']));
            if ($item_key === $key || strcasecmp((string) $item['description'], $description) === 0) {
                return $item;
            }
        }
        return $items[0] ?? null;
    }

    private function duplicateCheck(int $org_id, array $bill): ?array
    {
        global $wpdb;
        if (empty($bill['invoice_number']) || empty($bill['supplier_id'])) {
            return null;
        }
        $fingerprint = hash('sha256', strtolower($bill['supplier_id'] . '|' . $bill['invoice_number'] . '|' . $bill['total_decimal']));
        $existing = $wpdb->get_var($wpdb->prepare(
            'SELECT id FROM ' . $wpdb->prefix . 'mf_ap_bills WHERE organization_id = %d AND duplicate_fingerprint = %s AND id <> %d LIMIT 1',
            $org_id,
            $fingerprint,
            (int) $bill['id']
        ));
        $wpdb->update($wpdb->prefix . 'mf_ap_bills', ['duplicate_fingerprint' => $fingerprint], ['id' => (int) $bill['id']]);
        if ($existing) {
            return [
                'code' => 'duplicate_invoice',
                'message' => 'A bill with the same supplier, invoice number and total already exists.',
                'existing_bill_id' => (int) $existing,
            ];
        }
        return null;
    }

    private function onlySoft(array $discrepancies): bool
    {
        foreach ($discrepancies as $d) {
            if (($d['code'] ?? '') !== 'price_variance') {
                return false;
            }
        }
        return $discrepancies !== [];
    }

    private function hasCode(array $discrepancies, string $code): bool
    {
        foreach ($discrepancies as $d) {
            if (($d['code'] ?? '') === $code) {
                return true;
            }
        }
        return false;
    }
}
