<?php
/**
 * Enqueue SPA entry via public /assets/matchflow/* URLs (manifest-backed).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Frontend;

defined('ABSPATH') || exit;

final class Assets
{
    public static function enqueue(): void
    {
        $dev = defined('MATCHFLOW_VITE_DEV_SERVER') ? MATCHFLOW_VITE_DEV_SERVER : getenv('MATCHFLOW_VITE_DEV_SERVER');
        if (is_string($dev) && $dev !== '') {
            wp_enqueue_script('matchflow-vite-client', rtrim($dev, '/') . '/@vite/client', [], null, true);
            wp_enqueue_script('matchflow-app', rtrim($dev, '/') . '/src/main.tsx', ['matchflow-vite-client'], null, true);
            self::bootstrap('matchflow-app');
            add_filter('script_loader_tag', [self::class, 'moduleType'], 10, 3);
            return;
        }

        if (!AssetManifest::entryJsRelative()) {
            return;
        }

        $mtime = MATCHFLOW_VERSION . '.' . (string) AssetManifest::buildMtime();
        $base = AssetDelivery::publicBaseUrl();

        if (AssetManifest::entryCssRelative() !== []) {
            wp_enqueue_style('matchflow-app-0', $base . 'app.css', [], $mtime);
        }

        wp_enqueue_script('matchflow-app', $base . 'app.js', [], $mtime, true);
        self::bootstrap('matchflow-app');
        add_filter('script_loader_tag', [self::class, 'moduleType'], 10, 3);
    }

    public static function moduleType(string $tag, string $handle, string $src): string
    {
        if (in_array($handle, ['matchflow-app', 'matchflow-vite-client'], true)) {
            return '<script type="module" src="' . esc_url($src) . '" id="' . esc_attr($handle) . '-js"></script>' . "\n";
        }
        return $tag;
    }

    private static function bootstrap(string $handle): void
    {
        $user = wp_get_current_user();
        $near = $user->ID ? (string) get_user_meta($user->ID, 'matchflow_near_account_id', true) : '';
        $nearNetwork = (string) (get_option('matchflow_near_network', 'mainnet') ?: 'mainnet');
        $data = [
            'restUrl' => esc_url_raw(home_url('/api/v1')),
            'restNonce' => wp_create_nonce('wp_rest'),
            'siteUrl' => esc_url_raw(home_url('/')),
            'assetsUrl' => esc_url_raw(AssetDelivery::publicBaseUrl()),
            'version' => MATCHFLOW_VERSION,
            'nearNetwork' => $nearNetwork,
            'nearRpcProxyPath' => '/near-rpc',
            'user' => $user->ID ? [
                'id' => (int) $user->ID,
                'email' => $user->user_email,
                'displayName' => $user->display_name,
                'nearAccountId' => $near !== '' ? $near : null,
                'hasNearWallet' => $near !== '',
            ] : null,
        ];

        wp_add_inline_script(
            $handle,
            'window.MATCHFLOW_BOOTSTRAP = ' . wp_json_encode($data) . ';',
            'before'
        );
    }
}
