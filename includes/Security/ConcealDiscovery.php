<?php
/**
 * Soften public REST index / discovery for unauthenticated clients.
 * Cookie + nonce auth for logged-in Matchflow SPA remains unchanged.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class ConcealDiscovery
{
    public static function register(): void
    {
        add_filter('rest_index', [self::class, 'softenIndex'], 20);
        add_filter('rest_endpoints', [self::class, 'softenEndpoints'], 20);
        add_filter('rest_authentication_errors', [self::class, 'keepCookieAuth'], 99);
    }

    /**
     * @param mixed $response
     * @return mixed
     */
    public static function softenIndex($response)
    {
        if (is_user_logged_in()) {
            return $response;
        }

        if ($response instanceof \WP_REST_Response) {
            $data = $response->get_data();
            if (is_array($data)) {
                $data['name'] = 'MATCHFLOW API';
                $data['description'] = 'Authenticated Matchflow API. Sign in to use the application.';
                unset($data['routes'], $data['namespaces'], $data['_links']);
                $response->set_data($data);
            }
            return $response;
        }

        return $response;
    }

    /**
     * Hide non-Matchflow route catalog from anonymous discovery listings.
     * Registered callbacks still work when called directly with auth.
     *
     * @param array<string, mixed> $endpoints
     * @return array<string, mixed>
     */
    public static function softenEndpoints(array $endpoints): array
    {
        if (is_user_logged_in() || self::isMatchflowRequest()) {
            return $endpoints;
        }

        // Keep health + bootstrap discoverable; strip the rest of the catalog noise.
        $keep = [];
        foreach ($endpoints as $route => $handlers) {
            if (
                $route === '/'
                || str_starts_with((string) $route, '/matchflow/v1/health')
                || str_starts_with((string) $route, '/matchflow/v1/bootstrap')
                || str_starts_with((string) $route, '/matchflow/v1/public')
            ) {
                $keep[$route] = $handlers;
            }
        }
        return $keep ?: $endpoints;
    }

    /**
     * Never block WP cookie authentication used by the SPA.
     *
     * @param mixed $result
     * @return mixed
     */
    public static function keepCookieAuth($result)
    {
        if (true === $result || is_wp_error($result)) {
            return $result;
        }
        if (is_user_logged_in()) {
            return true;
        }
        return $result;
    }

    private static function isMatchflowRequest(): bool
    {
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        return is_string($uri) && (
            str_contains($uri, '/wp-json/matchflow/')
            || str_contains($uri, '/api/v1/')
        );
    }
}
