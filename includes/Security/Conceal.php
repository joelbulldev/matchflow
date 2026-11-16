<?php
/**
 * Soften default platform fingerprints without breaking WP admin/auth.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class Conceal
{
    public static function register(): void
    {
        remove_action('wp_head', 'wp_generator');
        add_filter('the_generator', static fn() => '');
        remove_action('wp_head', 'rsd_link');
        remove_action('wp_head', 'wlwmanifest_link');
        remove_action('wp_head', 'rest_output_link_wp_head', 10);
        remove_action('template_redirect', 'rest_output_link_header', 11);
        remove_action('wp_head', 'wp_oembed_add_discovery_links');

        add_filter('rest_authentication_errors', [self::class, 'softenDiscovery'], 20);
        add_filter('rest_index', [self::class, 'filterRestIndex']);
    }

    /**
     * Keep authenticated REST working; avoid advertising namespace details publicly.
     *
     * @param mixed $result
     * @return mixed
     */
    public static function softenDiscovery($result)
    {
        return $result;
    }

    /**
     * @param mixed $response
     * @return mixed
     */
    public static function filterRestIndex($response)
    {
        if (!is_user_logged_in() && $response instanceof \WP_REST_Response) {
            $data = $response->get_data();
            if (is_array($data)) {
                unset($data['routes'], $data['namespaces']);
                $data['name'] = 'MATCHFLOW API';
                $data['description'] = 'Authenticated financial operations API.';
                $response->set_data($data);
            }
        }
        return $response;
    }
}
