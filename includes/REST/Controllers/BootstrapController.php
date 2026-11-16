<?php
/**
 * Bootstrap + health REST routes.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\AI\AiConfig;
use Matchflow\Organizations\MembershipRepository;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use Matchflow\Security\Capabilities;
use WP_REST_Request;
use WP_User;

final class BootstrapController
{
    public static function register(string $ns): void
    {
        register_rest_route(
            $ns,
            '/health',
            [
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => static fn() => Response::success([
                    'status' => 'ok',
                    'version' => MATCHFLOW_VERSION,
                    'schema' => get_option('matchflow_schema_version', '0'),
                ]),
            ]
        );

        register_rest_route(
            $ns,
            '/bootstrap',
            [
                'methods' => 'GET',
                'permission_callback' => '__return_true',
                'callback' => [self::class, 'bootstrap'],
            ]
        );
    }

    public static function bootstrap(WP_REST_Request $request)
    {
        $user_id = get_current_user_id();
        $user = $user_id ? wp_get_current_user() : null;
        $memberships = $user_id ? (new MembershipRepository())->listForUser($user_id) : [];
        $current_org = Auth::organizationId($request);
        if ($current_org <= 0 && $memberships !== []) {
            $current_org = (int) $memberships[0]['organization_id'];
        }

        $currentRole = null;
        $currentCaps = [];
        if ($current_org > 0 && $user_id > 0) {
            foreach ($memberships as $m) {
                if ((int) $m['organization_id'] === $current_org) {
                    $currentRole = (string) $m['role'];
                    $currentCaps = Capabilities::capabilitiesForRole($currentRole);
                    break;
                }
            }
        }

        return Response::success([
            'authenticated' => (bool) $user_id,
            'restNonce' => wp_create_nonce('wp_rest'),
            'user' => $user_id && $user instanceof WP_User ? self::userPayload($user) : null,
            'organizations' => array_map(
                static fn(array $m) => [
                    'id' => (int) $m['organization_id'],
                    'name' => $m['name'],
                    'slug' => $m['slug'],
                    'role' => $m['role'],
                    'reportingCurrency' => $m['reporting_currency'],
                ],
                $memberships
            ),
            'currentOrganizationId' => $current_org > 0 ? $current_org : null,
            'currentRole' => $currentRole,
            'capabilities' => $currentCaps,
            'features' => [
                'financeAi' => AiConfig::configured(),
                'nearIntents' => (bool) (get_option('matchflow_near_intents_jwt', getenv('MATCHFLOW_NEAR_INTENTS_JWT') ?: '')
                    || get_option('matchflow_near_intents_api_key', getenv('MATCHFLOW_NEAR_INTENTS_API_KEY') ?: '')),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function userPayload(WP_User $user): array
    {
        if (class_exists(AuthController::class)) {
            return AuthController::userPayload($user);
        }

        return [
            'id' => (int) $user->ID,
            'email' => (string) $user->user_email,
            'displayName' => (string) $user->display_name,
            'username' => (string) $user->user_login,
        ];
    }
}
