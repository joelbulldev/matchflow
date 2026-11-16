<?php
/**
 * Membership persistence.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Organizations;

defined('ABSPATH') || exit;

final class MembershipRepository
{
    private string $table;

    public function __construct()
    {
        global $wpdb;
        $this->table = $wpdb->prefix . 'mf_memberships';
    }

    public function findActive(int $organization_id, int $user_id): ?array
    {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->table} WHERE organization_id = %d AND user_id = %d AND status = 'active' LIMIT 1",
                $organization_id,
                $user_id
            ),
            ARRAY_A
        );
        return $row ?: null;
    }

    public function listForUser(int $user_id): array
    {
        global $wpdb;
        $orgs = $wpdb->prefix . 'mf_organizations';
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT m.*, o.name, o.slug, o.reporting_currency
                 FROM {$this->table} m
                 INNER JOIN {$orgs} o ON o.id = m.organization_id
                 WHERE m.user_id = %d AND m.status = 'active'
                 ORDER BY o.name ASC",
                $user_id
            ),
            ARRAY_A
        ) ?: [];
    }

    public function create(int $organization_id, int $user_id, string $role): int
    {
        global $wpdb;
        $now = gmdate('Y-m-d H:i:s');
        $wpdb->insert(
            $this->table,
            [
                'organization_id' => $organization_id,
                'user_id' => $user_id,
                'role' => $role,
                'capabilities_json' => null,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            ['%d', '%d', '%s', '%s', '%s', '%s', '%s']
        );
        return (int) $wpdb->insert_id;
    }

    public function listForOrganization(int $organization_id): array
    {
        global $wpdb;
        $users = $wpdb->users;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT m.*, u.user_email, u.display_name
                 FROM {$this->table} m
                 INNER JOIN {$users} u ON u.ID = m.user_id
                 WHERE m.organization_id = %d
                 ORDER BY m.id ASC",
                $organization_id
            ),
            ARRAY_A
        ) ?: [];
    }

    public function updateRole(int $organization_id, int $membership_id, string $role): ?array
    {
        global $wpdb;
        $allowed = array_keys(\Matchflow\Security\Capabilities::ROLES);
        if (!in_array($role, $allowed, true)) {
            return null;
        }
        $wpdb->update(
            $this->table,
            ['role' => $role, 'updated_at' => gmdate('Y-m-d H:i:s')],
            ['id' => $membership_id, 'organization_id' => $organization_id]
        );
        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d AND organization_id = %d", $membership_id, $organization_id),
            ARRAY_A
        ) ?: null;
    }

    public function deactivate(int $organization_id, int $membership_id): ?array
    {
        global $wpdb;
        $wpdb->update(
            $this->table,
            ['status' => 'inactive', 'updated_at' => gmdate('Y-m-d H:i:s')],
            ['id' => $membership_id, 'organization_id' => $organization_id]
        );
        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d AND organization_id = %d", $membership_id, $organization_id),
            ARRAY_A
        ) ?: null;
    }

    /**
     * Invite by email: create WP user if needed, then membership.
     *
     * @return array|\WP_Error
     */
    public function invite(int $organization_id, string $email, string $role)
    {
        $email = sanitize_email($email);
        if (!$email) {
            return new \WP_Error('matchflow_invalid_email', 'Valid email required.', ['status' => 400]);
        }
        $allowed = array_keys(\Matchflow\Security\Capabilities::ROLES);
        if (!in_array($role, $allowed, true)) {
            return new \WP_Error('matchflow_invalid_role', 'Unknown role.', ['status' => 400]);
        }

        $user = get_user_by('email', $email);
        if (!$user) {
            $login = sanitize_user(strstr($email, '@', true) ?: $email, true);
            $login = $login !== '' ? $login : 'mfuser';
            $base = $login;
            $i = 1;
            while (username_exists($login)) {
                $login = $base . $i;
                $i++;
            }
            $password = wp_generate_password(20, true);
            $user_id = wp_create_user($login, $password, $email);
            if (is_wp_error($user_id)) {
                return $user_id;
            }
            $user = get_user_by('id', (int) $user_id);
        }

        $existing = $this->findActive($organization_id, (int) $user->ID);
        if ($existing) {
            return $existing;
        }

        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->table} WHERE organization_id = %d AND user_id = %d LIMIT 1",
                $organization_id,
                (int) $user->ID
            ),
            ARRAY_A
        );
        if ($row) {
            $wpdb->update(
                $this->table,
                ['status' => 'active', 'role' => $role, 'updated_at' => gmdate('Y-m-d H:i:s')],
                ['id' => (int) $row['id']]
            );
            $id = (int) $row['id'];
        } else {
            $id = $this->create($organization_id, (int) $user->ID, $role);
        }

        return $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table} WHERE id = %d", $id),
            ARRAY_A
        ) ?: [];
    }
}
