<?php
/**
 * Organizations API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Organizations\MembershipRepository;
use Matchflow\Organizations\OrganizationRepository;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use Matchflow\Security\Capabilities;
use WP_REST_Request;

final class OrganizationsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/organizations', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn() => is_user_logged_in(),
                'callback' => [self::class, 'index'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn() => is_user_logged_in(),
                'callback' => [self::class, 'create'],
            ],
        ]);
        register_rest_route($ns, '/organizations/(?P<id>\\d+)', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'show'],
            ],
            [
                'methods' => 'PATCH',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'org.manage')),
                'callback' => [self::class, 'update'],
            ],
        ]);
        register_rest_route($ns, '/organizations/select', [
            'methods' => 'POST',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'select'],
        ]);
        register_rest_route($ns, '/organizations/members', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'org.manage')),
                'callback' => [self::class, 'membersIndex'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'org.manage')),
                'callback' => [self::class, 'membersInvite'],
            ],
        ]);
    }

    public static function index()
    {
        return Response::success((new MembershipRepository())->listForUser(get_current_user_id()));
    }

    public static function create(WP_REST_Request $request)
    {
        $payload = $request->get_json_params();
        if (!is_array($payload) || $payload === []) {
            $payload = $request->get_params();
        }

        $name = sanitize_text_field((string) ($payload['name'] ?? ''));
        if ($name === '') {
            return Response::error('matchflow_invalid', 'Organization name is required.', 400);
        }

        $orgs = new OrganizationRepository();
        $members = new MembershipRepository();
        $id = $orgs->create($payload);
        if ($id <= 0) {
            return Response::error(
                'matchflow_org_create_failed',
                'Could not create organization. Run plugin migrations (deactivate and reactivate MATCHFLOW) if this persists.',
                500
            );
        }

        $member_id = $members->create($id, get_current_user_id(), 'owner');
        if ($member_id <= 0 && function_exists('error_log')) {
            error_log('MATCHFLOW: membership insert failed for org ' . $id);
        }

        update_user_meta(get_current_user_id(), 'matchflow_current_organization_id', $id);

        $org = $orgs->find($id);
        if (!$org) {
            $org = [
                'id' => $id,
                'name' => $name,
                'slug' => sanitize_title($name),
                'reporting_currency' => sanitize_text_field((string) ($payload['reporting_currency'] ?? 'USD')),
                'timezone' => sanitize_text_field((string) ($payload['timezone'] ?? 'UTC')),
                'status' => 'active',
            ];
        }

        return Response::success($org, [], 201);
    }

    public static function show(WP_REST_Request $request)
    {
        $id = (int) $request['id'];
        $check = Auth::requireCapability($request, 'ar.read');
        if (is_wp_error($check)) {
            return $check;
        }
        if (Auth::organizationId($request) !== $id) {
            $membership = (new MembershipRepository())->findActive($id, get_current_user_id());
            if (!$membership) {
                return Response::error('matchflow_forbidden', 'Forbidden.', 403);
            }
        }
        $org = (new OrganizationRepository())->find($id);
        return $org ? Response::success($org) : Response::error('matchflow_not_found', 'Organization not found.', 404);
    }

    public static function update(WP_REST_Request $request)
    {
        $id = (int) $request['id'];
        $check = Auth::requireCapability($request, 'org.manage');
        if (is_wp_error($check)) {
            return $check;
        }
        (new OrganizationRepository())->update($id, $request->get_json_params() ?: []);
        return Response::success((new OrganizationRepository())->find($id));
    }

    public static function select(WP_REST_Request $request)
    {
        $id = (int) $request->get_param('organization_id');
        $membership = (new MembershipRepository())->findActive($id, get_current_user_id());
        if (!$membership) {
            return Response::error('matchflow_forbidden', 'Forbidden.', 403);
        }
        update_user_meta(get_current_user_id(), 'matchflow_current_organization_id', $id);
        return Response::success([
            'organizationId' => $id,
            'role' => $membership['role'],
            'capabilities' => Capabilities::ROLES[$membership['role']] ?? [],
        ]);
    }

    public static function membersIndex(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        if ($org <= 0) {
            return Response::error('matchflow_no_org', 'No organization selected.', 400);
        }
        $rows = (new MembershipRepository())->listForOrganization($org);
        return Response::success($rows);
    }

    public static function membersInvite(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        if ($org <= 0) {
            return Response::error('matchflow_no_org', 'No organization selected.', 400);
        }
        $payload = $request->get_json_params();
        if (!is_array($payload)) {
            $payload = [];
        }
        $email = sanitize_email((string) ($payload['email'] ?? ''));
        $role = sanitize_text_field((string) ($payload['role'] ?? 'viewer'));
        if ($email === '') {
            return Response::error('matchflow_invalid_email', 'Valid email required.', 400);
        }
        $result = (new MembershipRepository())->invite($org, $email, $role);
        if (is_wp_error($result)) {
            return $result;
        }
        return Response::success($result, [], 201);
    }
}
