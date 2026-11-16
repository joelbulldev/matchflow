<?php
/**
 * Auth and organization context helpers.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

use Matchflow\Organizations\MembershipRepository;
use WP_Error;
use WP_REST_Request;

final class Auth
{
    public static function requireUser(): int|WP_Error
    {
        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return new WP_Error('matchflow_unauthorized', 'Authentication required.', ['status' => 401]);
        }
        return $user_id;
    }

    public static function organizationId(WP_REST_Request $request): int
    {
        $header = $request->get_header('X-Matchflow-Organization');
        if ($header) {
            return (int) $header;
        }
        $param = $request->get_param('organization_id');
        if ($param) {
            return (int) $param;
        }
        $user_id = get_current_user_id();
        $org_id = $user_id > 0
            ? (int) get_user_meta($user_id, 'matchflow_current_organization_id', true)
            : 0;
        if ($org_id <= 0 && $user_id > 0) {
            $memberships = (new MembershipRepository())->listForUser($user_id);
            if ($memberships !== []) {
                $org_id = (int) $memberships[0]['organization_id'];
                update_user_meta($user_id, 'matchflow_current_organization_id', $org_id);
            }
        }
        return $org_id;
    }

    /**
     * REST permission_callback — return WP_Error with real status (not a bare false → 403).
     */
    public static function permit(string $capability): callable
    {
        return static function (WP_REST_Request $request) use ($capability) {
            $check = self::requireCapability($request, $capability);
            return is_wp_error($check) ? $check : true;
        };
    }

    public static function requireCapability(WP_REST_Request $request, string $capability): true|WP_Error
    {
        $user = self::requireUser();
        if (is_wp_error($user)) {
            return $user;
        }

        $org_id = self::organizationId($request);
        if ($org_id <= 0) {
            return new WP_Error('matchflow_org_required', 'Organization context required.', ['status' => 400]);
        }

        $membership = (new MembershipRepository())->findActive($org_id, (int) $user);
        if (!$membership) {
            return new WP_Error('matchflow_forbidden', 'You are not a member of this organization.', ['status' => 403]);
        }

        if (!Capabilities::roleHas((string) $membership['role'], $capability)) {
            return new WP_Error('matchflow_forbidden', 'Missing required capability.', ['status' => 403]);
        }

        return true;
    }

    public static function publicTokenOk(): true
    {
        return true;
    }
}
