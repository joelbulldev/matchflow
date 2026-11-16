<?php
/**
 * Optional WordPress generator / RSD / wlwmanifest fingerprint softening.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class FingerprintStrip
{
    public static function register(): void
    {
        // Only strip when explicitly enabled (keeps stock WP management intact by default).
        $enabled = filter_var(
            getenv('MATCHFLOW_STRIP_FINGERPRINTS') ?: get_option('matchflow_strip_fingerprints', false),
            FILTER_VALIDATE_BOOLEAN
        );
        if (!$enabled) {
            return;
        }

        remove_action('wp_head', 'wp_generator');
        remove_action('wp_head', 'rsd_link');
        remove_action('wp_head', 'wlwmanifest_link');
        remove_action('wp_head', 'wp_shortlink_wp_head');
        remove_action('wp_head', 'rest_output_link_wp_head', 10);
        remove_action('template_redirect', 'rest_output_link_header', 11);
        remove_action('wp_head', 'wp_oembed_add_discovery_links');

        add_filter('the_generator', static fn(): string => '');
    }
}
