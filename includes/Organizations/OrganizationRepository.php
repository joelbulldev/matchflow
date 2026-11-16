<?php
/**
 * Organization persistence.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Organizations;

defined('ABSPATH') || exit;

final class OrganizationRepository
{
    private string $table;

    public function __construct()
    {
        global $wpdb;
        $this->table = $wpdb->prefix . 'mf_organizations';
    }

    public function find(int $id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d", $id), ARRAY_A);
        return $row ?: null;
    }

    public function create(array $data): int
    {
        global $wpdb;
        $now = gmdate('Y-m-d H:i:s');
        $name = sanitize_text_field((string) ($data['name'] ?? ''));
        if ($name === '') {
            return 0;
        }

        $slug = sanitize_title((string) ($data['slug'] ?? $name));
        if ($slug === '') {
            $slug = 'org-' . wp_generate_password(8, false, false);
        }
        $slug = self::uniqueSlug($slug);

        $inserted = $wpdb->insert(
            $this->table,
            [
                'name' => $name,
                'slug' => $slug,
                'country' => isset($data['country']) ? sanitize_text_field((string) $data['country']) : null,
                'timezone' => sanitize_text_field((string) ($data['timezone'] ?? 'UTC')),
                'reporting_currency' => sanitize_text_field((string) ($data['reporting_currency'] ?? 'USD')),
                'preferred_destination_asset' => $data['preferred_destination_asset'] ?? null,
                'preferred_destination_address' => $data['preferred_destination_address'] ?? null,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        if ($inserted === false) {
            if (function_exists('error_log')) {
                error_log('MATCHFLOW: organization insert failed — ' . (string) $wpdb->last_error);
            }
            return 0;
        }

        return (int) $wpdb->insert_id;
    }

    private static function uniqueSlug(string $base): string
    {
        global $wpdb;
        $table = $wpdb->prefix . 'mf_organizations';
        $slug = $base;
        $n = 2;
        while ($wpdb->get_var($wpdb->prepare("SELECT id FROM {$table} WHERE slug = %s LIMIT 1", $slug))) {
            $slug = $base . '-' . $n;
            ++$n;
        }
        return $slug;
    }

    public function update(int $id, array $data): bool
    {
        global $wpdb;
        $fields = ['updated_at' => gmdate('Y-m-d H:i:s')];
        foreach (['name', 'country', 'timezone', 'reporting_currency', 'preferred_destination_asset', 'preferred_destination_address', 'status'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[$key] = is_string($data[$key]) ? sanitize_text_field($data[$key]) : $data[$key];
            }
        }
        return false !== $wpdb->update($this->table, $fields, ['id' => $id]);
    }
}
