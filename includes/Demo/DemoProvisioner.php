<?php
/**
 * Built-in hackathon demo user + workspace (no wp-admin credential setup).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Demo;

defined('ABSPATH') || exit;

use Matchflow\Organizations\MembershipRepository;
use Matchflow\Organizations\OrganizationRepository;

final class DemoProvisioner
{
    public const USER_LOGIN = 'matchflow_demo';
    private const SECRET_OPTION = 'matchflow_builtin_demo_secret';
    private const ORG_SLUG = 'matchflow-demo-workspace';

    public static function ensure(): ?\WP_User
    {
        self::bootstrapSecret();

        $user = get_user_by('login', self::USER_LOGIN);
        if (!$user) {
            $id = wp_create_user(self::USER_LOGIN, self::secret(), 'demo@matchflow.local');
            if (is_wp_error($id)) {
                if (function_exists('error_log')) {
                    error_log('MATCHFLOW demo user create failed: ' . $id->get_error_message());
                }
                return null;
            }
            wp_update_user([
                'ID' => $id,
                'display_name' => 'MATCHFLOW Demo',
            ]);
            $user = get_user_by('id', (int) $id);
        }

        if (!$user instanceof \WP_User) {
            return null;
        }

        $org_id = self::ensureOrganization((int) $user->ID);
        if ($org_id > 0) {
            DemoWorkspaceSeeder::seedIfNeeded($org_id, (int) $user->ID);
        }

        return $user;
    }

    public static function organizationId(): int
    {
        global $wpdb;
        return (int) $wpdb->get_var(
            $wpdb->prepare(
                'SELECT id FROM ' . $wpdb->prefix . 'mf_organizations WHERE slug = %s LIMIT 1',
                self::ORG_SLUG
            )
        );
    }

    public static function secret(): string
    {
        self::bootstrapSecret();
        return (string) get_option(self::SECRET_OPTION, '');
    }

    private static function bootstrapSecret(): void
    {
        if ((string) get_option(self::SECRET_OPTION, '') === '') {
            update_option(self::SECRET_OPTION, wp_generate_password(32, true, true), false);
        }
    }

    private static function ensureOrganization(int $user_id): int
    {
        $members = new MembershipRepository();
        $existing = $members->listForUser($user_id);
        if ($existing !== []) {
            $org_id = (int) ($existing[0]['organization_id'] ?? 0);
            if ($org_id > 0) {
                update_user_meta($user_id, 'matchflow_current_organization_id', $org_id);
            }
            return $org_id;
        }

        global $wpdb;
        $table = $wpdb->prefix . 'mf_organizations';
        $org_id = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT id FROM {$table} WHERE slug = %s LIMIT 1", self::ORG_SLUG)
        );

        if ($org_id <= 0) {
            $org_id = (new OrganizationRepository())->create([
                'name' => 'MATCHFLOW Demo Co.',
                'slug' => self::ORG_SLUG,
                'reporting_currency' => 'USD',
                'timezone' => 'UTC',
            ]);
        }

        if ($org_id <= 0) {
            return 0;
        }

        $members->create($org_id, $user_id, 'owner');
        update_user_meta($user_id, 'matchflow_current_organization_id', $org_id);

        return $org_id;
    }
}
