<?php
/**
 * Versioned schema migrations.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Database;

defined('ABSPATH') || exit;

final class Migrator
{
    public function maybeMigrate(): void
    {
        $current = (string) get_option('matchflow_schema_version', '0');
        if (version_compare($current, MATCHFLOW_SCHEMA_VERSION, '<')) {
            $this->migrate();
        }
    }

    public function migrate(): void
    {
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        global $wpdb;

        $charset = $wpdb->get_charset_collate();
        $p = $wpdb->prefix;

        $sql = [];

        $sql[] = "CREATE TABLE {$p}mf_organizations (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(191) NOT NULL,
            slug VARCHAR(191) NOT NULL,
            country VARCHAR(2) NULL,
            timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
            reporting_currency VARCHAR(16) NOT NULL DEFAULT 'USD',
            preferred_destination_asset VARCHAR(191) NULL,
            preferred_destination_address VARCHAR(191) NULL,
            checkout_display_name VARCHAR(191) NULL,
            checkout_tagline VARCHAR(255) NULL,
            checkout_accent_color VARCHAR(32) NULL,
            checkout_logo_url VARCHAR(512) NULL,
            checkout_support_email VARCHAR(191) NULL,
            checkout_message TEXT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY slug (slug),
            KEY status (status)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_memberships (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            role VARCHAR(64) NOT NULL,
            capabilities_json LONGTEXT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY org_user (organization_id, user_id),
            KEY user_id (user_id),
            KEY role (role)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_counterparties (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            type VARCHAR(32) NOT NULL,
            name VARCHAR(191) NOT NULL,
            email VARCHAR(191) NULL,
            country VARCHAR(2) NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            approved TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY org_type (organization_id, type),
            KEY org_status (organization_id, status)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_counterparty_addresses (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            counterparty_id BIGINT UNSIGNED NOT NULL,
            chain_id VARCHAR(64) NOT NULL,
            asset_id VARCHAR(191) NOT NULL,
            address VARCHAR(191) NOT NULL,
            label VARCHAR(191) NULL,
            verified_at DATETIME NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY counterparty (counterparty_id),
            KEY org (organization_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_ar_invoices (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            customer_id BIGINT UNSIGNED NOT NULL,
            invoice_number VARCHAR(64) NOT NULL,
            currency VARCHAR(16) NOT NULL,
            subtotal_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            tax_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            discount_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            total_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            amount_paid_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            amount_outstanding_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            issue_date DATE NULL,
            due_date DATE NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            payment_terms TEXT NULL,
            notes TEXT NULL,
            brand_theme VARCHAR(32) NOT NULL DEFAULT 'classic',
            destination_asset_id VARCHAR(191) NULL,
            destination_address VARCHAR(191) NULL,
            public_token_hash CHAR(64) NULL,
            public_payment_token VARCHAR(96) NULL,
            version INT UNSIGNED NOT NULL DEFAULT 1,
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY org_invoice_number (organization_id, invoice_number),
            KEY org_status (organization_id, status),
            KEY public_token_hash (public_token_hash),
            KEY due_date (due_date)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_payment_requests (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            reference VARCHAR(64) NOT NULL,
            label VARCHAR(191) NOT NULL,
            description TEXT NULL,
            amount_decimal VARCHAR(64) NOT NULL,
            amount_collected_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            currency VARCHAR(16) NOT NULL DEFAULT 'USD',
            status VARCHAR(32) NOT NULL DEFAULT 'open',
            customer_id BIGINT UNSIGNED NULL,
            destination_asset_id VARCHAR(191) NULL,
            destination_address VARCHAR(191) NULL,
            public_token_hash CHAR(64) NULL,
            public_payment_token VARCHAR(96) NULL,
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            cancelled_at DATETIME NULL,
            PRIMARY KEY (id),
            UNIQUE KEY org_reference (organization_id, reference),
            KEY org_status (organization_id, status),
            KEY public_token_hash (public_token_hash)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_ar_invoice_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            invoice_id BIGINT UNSIGNED NOT NULL,
            description VARCHAR(255) NOT NULL,
            quantity_decimal VARCHAR(64) NOT NULL,
            unit_price_decimal VARCHAR(64) NOT NULL,
            tax_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            discount_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            line_total_decimal VARCHAR(64) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY invoice_id (invoice_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_ap_bills (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            supplier_id BIGINT UNSIGNED NULL,
            invoice_number VARCHAR(64) NULL,
            currency VARCHAR(16) NOT NULL DEFAULT 'USD',
            subtotal_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            tax_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            total_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            amount_paid_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            amount_outstanding_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            invoice_date DATE NULL,
            due_date DATE NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'received',
            match_status VARCHAR(32) NOT NULL DEFAULT 'pending',
            approval_status VARCHAR(32) NOT NULL DEFAULT 'not_required',
            purchase_order_id BIGINT UNSIGNED NULL,
            duplicate_fingerprint VARCHAR(128) NULL,
            dispute_reason TEXT NULL,
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY org_status (organization_id, status),
            KEY match_status (organization_id, match_status),
            KEY duplicate_fingerprint (organization_id, duplicate_fingerprint)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_ap_bill_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            bill_id BIGINT UNSIGNED NOT NULL,
            description VARCHAR(255) NOT NULL,
            normalized_item_key VARCHAR(191) NULL,
            quantity_decimal VARCHAR(64) NOT NULL,
            unit_price_decimal VARCHAR(64) NOT NULL,
            tax_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            line_total_decimal VARCHAR(64) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY bill_id (bill_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_purchase_orders (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            supplier_id BIGINT UNSIGNED NOT NULL,
            po_number VARCHAR(64) NOT NULL,
            currency VARCHAR(16) NOT NULL,
            total_decimal VARCHAR(64) NOT NULL DEFAULT '0',
            expected_date DATE NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY org_po (organization_id, po_number),
            KEY org_status (organization_id, status)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_purchase_order_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            po_id BIGINT UNSIGNED NOT NULL,
            description VARCHAR(255) NOT NULL,
            normalized_item_key VARCHAR(191) NULL,
            ordered_quantity_decimal VARCHAR(64) NOT NULL,
            unit_price_decimal VARCHAR(64) NOT NULL,
            price_tolerance_bps INT NOT NULL DEFAULT 0,
            line_total_decimal VARCHAR(64) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY po_id (po_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_goods_receipts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            po_id BIGINT UNSIGNED NOT NULL,
            receipt_reference VARCHAR(64) NULL,
            received_at DATETIME NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'recorded',
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY org_po (organization_id, po_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_goods_receipt_items (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            receipt_id BIGINT UNSIGNED NOT NULL,
            po_item_id BIGINT UNSIGNED NOT NULL,
            received_quantity_decimal VARCHAR(64) NOT NULL,
            notes TEXT NULL,
            PRIMARY KEY (id),
            KEY receipt_id (receipt_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_documents (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            owner_type VARCHAR(64) NOT NULL,
            owner_id BIGINT UNSIGNED NOT NULL,
            storage_key VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(128) NOT NULL,
            size_bytes BIGINT UNSIGNED NOT NULL,
            sha256 CHAR(64) NOT NULL,
            extraction_status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY owner (owner_type, owner_id),
            KEY org (organization_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_extractions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            document_id BIGINT UNSIGNED NOT NULL,
            provider VARCHAR(64) NULL,
            model VARCHAR(128) NULL,
            schema_version VARCHAR(32) NOT NULL DEFAULT '1',
            extracted_json LONGTEXT NOT NULL,
            confidence_json LONGTEXT NULL,
            reviewed_by BIGINT UNSIGNED NULL,
            reviewed_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY document_id (document_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_match_runs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            bill_id BIGINT UNSIGNED NOT NULL,
            organization_id BIGINT UNSIGNED NOT NULL,
            rule_version VARCHAR(32) NOT NULL,
            result VARCHAR(32) NOT NULL,
            discrepancies_json LONGTEXT NULL,
            calculated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY bill_id (bill_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_approval_policies (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            name VARCHAR(191) NOT NULL,
            rules_json LONGTEXT NOT NULL,
            version INT UNSIGNED NOT NULL DEFAULT 1,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY org_active (organization_id, active)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_approvals (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            subject_type VARCHAR(64) NOT NULL,
            subject_id BIGINT UNSIGNED NOT NULL,
            requested_by BIGINT UNSIGNED NOT NULL,
            approver_id BIGINT UNSIGNED NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            reason TEXT NULL,
            decided_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY org_status (organization_id, status),
            KEY subject (subject_type, subject_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_settlements (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            purpose VARCHAR(32) NOT NULL,
            subject_type VARCHAR(64) NOT NULL,
            subject_id BIGINT UNSIGNED NOT NULL,
            correlation_id VARCHAR(128) NULL,
            quote_json LONGTEXT NULL,
            quote_signature_valid TINYINT(1) NULL,
            status VARCHAR(64) NOT NULL DEFAULT 'PENDING_DEPOSIT',
            normalized_status VARCHAR(64) NOT NULL DEFAULT 'PENDING_DEPOSIT',
            origin_asset_id VARCHAR(191) NOT NULL,
            destination_asset_id VARCHAR(191) NOT NULL,
            source_amount_atomic VARCHAR(64) NULL,
            destination_amount_atomic VARCHAR(64) NOT NULL,
            destination_amount_decimal VARCHAR(64) NULL,
            recipient_address VARCHAR(191) NOT NULL,
            refund_address VARCHAR(191) NOT NULL,
            deposit_address VARCHAR(191) NULL,
            deposit_memo VARCHAR(191) NULL,
            quote_expires_at DATETIME NULL,
            source_tx_hash VARCHAR(191) NULL,
            destination_tx_hash VARCHAR(191) NULL,
            idempotency_key VARCHAR(128) NULL,
            reconciled_at DATETIME NULL,
            receipt_url VARCHAR(512) NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY idempotency_key (idempotency_key),
            KEY org_status (organization_id, normalized_status),
            KEY deposit_address (deposit_address),
            KEY subject (subject_type, subject_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_settlement_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            settlement_id BIGINT UNSIGNED NOT NULL,
            provider_status VARCHAR(64) NOT NULL,
            normalized_status VARCHAR(64) NOT NULL,
            payload_hash CHAR(64) NULL,
            signature_valid TINYINT(1) NULL,
            event_json_redacted LONGTEXT NULL,
            observed_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY settlement_id (settlement_id),
            KEY payload_hash (settlement_id, payload_hash)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_ledger_entries (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            obligation_type VARCHAR(64) NOT NULL,
            obligation_id BIGINT UNSIGNED NOT NULL,
            settlement_id BIGINT UNSIGNED NULL,
            entry_type VARCHAR(64) NOT NULL,
            amount_decimal VARCHAR(64) NOT NULL,
            asset_id VARCHAR(191) NULL,
            currency VARCHAR(16) NULL,
            direction VARCHAR(16) NOT NULL,
            occurred_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY org (organization_id),
            KEY obligation (obligation_type, obligation_id),
            KEY settlement_id (settlement_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_audit_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NULL,
            actor_user_id BIGINT UNSIGNED NULL,
            action VARCHAR(128) NOT NULL,
            subject_type VARCHAR(64) NULL,
            subject_id BIGINT UNSIGNED NULL,
            before_hash CHAR(64) NULL,
            after_hash CHAR(64) NULL,
            metadata_redacted LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY org_created (organization_id, created_at),
            KEY subject (subject_type, subject_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_public_tokens (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            token_hash CHAR(64) NOT NULL,
            scope VARCHAR(64) NOT NULL,
            subject_type VARCHAR(64) NOT NULL,
            subject_id BIGINT UNSIGNED NOT NULL,
            organization_id BIGINT UNSIGNED NOT NULL,
            expires_at DATETIME NULL,
            revoked_at DATETIME NULL,
            last_used_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY token_hash (token_hash),
            KEY subject (subject_type, subject_id)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_notifications (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NULL,
            type VARCHAR(64) NOT NULL,
            payload_json LONGTEXT NULL,
            read_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_read (user_id, read_at)
        ) ENGINE=InnoDB {$charset};";

        $sql[] = "CREATE TABLE {$p}mf_ar_invoice_versions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            organization_id BIGINT UNSIGNED NOT NULL,
            invoice_id BIGINT UNSIGNED NOT NULL,
            version INT UNSIGNED NOT NULL,
            snapshot_json LONGTEXT NOT NULL,
            change_reason VARCHAR(255) NULL,
            created_by BIGINT UNSIGNED NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY invoice_version (invoice_id, version),
            KEY org_invoice (organization_id, invoice_id)
        ) ENGINE=InnoDB {$charset};";

        foreach ($sql as $statement) {
            dbDelta($statement);
        }

        $wpdb->query(
            "UPDATE {$p}mf_organizations SET checkout_accent_color = NULL
             WHERE checkout_accent_color IN ('#4f46e5', '4f46e5', '#4F46E5')"
        );

        $wpdb->query(
            "UPDATE {$p}mf_ar_invoices SET amount_outstanding_decimal = '0'
             WHERE status = 'void' AND CAST(amount_outstanding_decimal AS DECIMAL(36,8)) > 0"
        );

        update_option('matchflow_schema_version', MATCHFLOW_SCHEMA_VERSION);

        if (class_exists(\Matchflow\Demo\DemoProvisioner::class)) {
            \Matchflow\Demo\DemoProvisioner::ensure();
        }
    }
}
