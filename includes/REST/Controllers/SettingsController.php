<?php
/**
 * Settings / policies API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

use Matchflow\Organizations\CheckoutBranding;

use Matchflow\Near\NearRpc;

defined('ABSPATH') || exit;

use Matchflow\Notifications\NotificationService;
use Matchflow\Policies\PolicyEngine;
use Matchflow\REST\Response;
use Matchflow\Security\AuditLogger;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class SettingsController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/settings/policies', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'policies.manage')) || !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'getPolicies'],
            ],
            [
                'methods' => 'PATCH',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'policies.manage')),
                'callback' => [self::class, 'updatePolicies'],
            ],
        ]);
        register_rest_route($ns, '/settings/organization', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'settings.manage')) || !is_wp_error(Auth::requireCapability($r, 'settings.limited')) || !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'getOrg'],
            ],
            [
                'methods' => 'PATCH',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'org.manage')) || !is_wp_error(Auth::requireCapability($r, 'settings.manage')),
                'callback' => [self::class, 'updateOrg'],
            ],
        ]);
        register_rest_route($ns, '/settings/notifications', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => is_user_logged_in(),
            'callback' => [self::class, 'notifications'],
        ]);
        register_rest_route($ns, '/settings/ops', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'settings.manage')) || current_user_can('manage_options'),
            'callback' => [self::class, 'ops'],
        ]);
        register_rest_route($ns, '/settings/checkout-logo', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'org.manage')) || !is_wp_error(Auth::requireCapability($r, 'settings.manage')),
            'callback' => [self::class, 'uploadCheckoutLogo'],
        ]);
    }

    public static function getPolicies(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $engine = new PolicyEngine();
        $rules = $engine->activeRules($org);
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT id, name, version, active, updated_at FROM ' . $wpdb->prefix . 'mf_approval_policies WHERE organization_id = %d AND active = 1 ORDER BY version DESC LIMIT 1',
            $org
        ), ARRAY_A);
        return Response::success([
            'id' => $row['id'] ?? null,
            'name' => $row['name'] ?? 'Default',
            'version' => (int) ($row['version'] ?? 1),
            'active' => 1,
            'rules' => $rules,
            'updated_at' => $row['updated_at'] ?? null,
        ]);
    }

    public static function updatePolicies(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $body = $request->get_json_params() ?: [];
        $rules = is_array($body['rules'] ?? null) ? $body['rules'] : [];
        $saved = (new PolicyEngine())->savePolicy($org, (string) ($body['name'] ?? 'Policy'), $rules);
        AuditLogger::record($org, 'policy.updated', 'approval_policy', (int) $saved['id'], null, $saved['rules']);
        return Response::success($saved);
    }

    public static function getOrg(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $row = $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . $wpdb->prefix . 'mf_organizations WHERE id = %d', $org), ARRAY_A);
        if (!$row) {
            return Response::error('matchflow_not_found', 'Organization not found.', 404);
        }
        $normalized = CheckoutBranding::normalizeAccent($row['checkout_accent_color'] ?? null);
        $row['checkout_accent_color'] = $normalized ?? '';
        return Response::success($row);
    }

    public static function updateOrg(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $body = $request->get_json_params() ?: [];
        $fields = [];
        $allowed = [
            'name',
            'country',
            'timezone',
            'reporting_currency',
            'preferred_destination_asset',
            'preferred_destination_address',
            'checkout_display_name',
            'checkout_tagline',
            'checkout_accent_color',
            'checkout_logo_url',
            'checkout_support_email',
            'checkout_message',
        ];
        foreach ($allowed as $key) {
            if (!array_key_exists($key, $body)) {
                continue;
            }
            if ($key === 'checkout_message') {
                $fields[$key] = sanitize_textarea_field((string) $body[$key]);
            } else {
                $fields[$key] = sanitize_text_field((string) $body[$key]);
            }
        }
        if ($fields === []) {
            return Response::error('matchflow_invalid', 'No fields to update.', 400);
        }
        $fields['updated_at'] = gmdate('Y-m-d H:i:s');
        $wpdb->update($wpdb->prefix . 'mf_organizations', $fields, ['id' => $org]);
        AuditLogger::record($org, 'org.updated', 'organization', $org, null, $fields);
        return self::getOrg($request);
    }

    public static function uploadCheckoutLogo(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return Response::error('matchflow_invalid', 'file is required.', 400);
        }
        $file = $files['file'];
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']) ?: '';
        if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'], true)) {
            return Response::error('matchflow_invalid_file', 'Logo must be PNG, JPEG, WebP, or SVG.', 400);
        }
        if ((int) $file['size'] > 2 * 1024 * 1024) {
            return Response::error('matchflow_invalid_file', 'Logo must be under 2 MB.', 400);
        }

        $uploads = wp_upload_dir();
        $subdir = 'matchflow/checkout/' . $org;
        $dir = trailingslashit($uploads['basedir']) . $subdir;
        if (!wp_mkdir_p($dir)) {
            return Response::error('matchflow_storage', 'Unable to create storage.', 500);
        }
        $name = wp_unique_filename($dir, sanitize_file_name($file['name']));
        $dest = trailingslashit($dir) . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            return Response::error('matchflow_storage', 'Upload failed.', 500);
        }

        $url = trailingslashit($uploads['baseurl']) . $subdir . '/' . $name;
        global $wpdb;
        $wpdb->update(
            $wpdb->prefix . 'mf_organizations',
            [
                'checkout_logo_url' => esc_url_raw($url),
                'updated_at' => gmdate('Y-m-d H:i:s'),
            ],
            ['id' => $org]
        );

        return Response::success(['url' => $url], [], 201);
    }

    public static function notifications(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $rows = (new NotificationService())->listForUser($org, get_current_user_id());
        return Response::success($rows);
    }

    public static function ops(WP_REST_Request $request)
    {
        return Response::success([
            'schemaVersion' => get_option('matchflow_schema_version', '0'),
            'pluginVersion' => defined('MATCHFLOW_VERSION') ? MATCHFLOW_VERSION : '0',
            'nearRpcProxy' => true,
            'allowUnverifiedQuotes' => (bool) getenv('MATCHFLOW_ALLOW_UNVERIFIED_QUOTES'),
            'php' => PHP_VERSION,
            'extensions' => [
                'bcmath' => extension_loaded('bcmath'),
                'sodium' => extension_loaded('sodium'),
                'curl' => extension_loaded('curl'),
                'fileinfo' => extension_loaded('fileinfo'),
            ],
        ]);
    }
}
