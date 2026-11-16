<?php
/**
 * Mirror built SPA files to the web root so nginx static .js/.css rules can serve them.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Frontend;

defined('ABSPATH') || exit;

final class AssetPublisher
{
    private const OPTION_PUBLISHED = 'matchflow_assets_published_version';

    public static function register(): void
    {
        add_action('init', [self::class, 'maybePublishOnUpgrade'], 1);
        add_action('admin_init', [self::class, 'maybePublishOnUpgrade']);
    }

    public static function publishAndMarkVersion(): bool
    {
        if (!self::publishToWebRoot()) {
            return false;
        }
        update_option(self::OPTION_PUBLISHED, MATCHFLOW_VERSION, false);
        return true;
    }

    public static function maybePublishOnUpgrade(): void
    {
        if (get_option(self::OPTION_PUBLISHED, '') === MATCHFLOW_VERSION) {
            return;
        }
        self::publishAndMarkVersion();
    }

    public static function publishToWebRoot(): bool
    {
        $source = MATCHFLOW_PATH . 'assets/delivery/';
        if (!is_dir($source)) {
            if (!self::publishFromBuildFallback()) {
                return false;
            }
        } else {
            $dest = trailingslashit(ABSPATH) . AssetDelivery::PUBLIC_PREFIX . '/';
            if (!wp_mkdir_p($dest)) {
                return false;
            }
            self::copyTree($source, $dest);
        }

        return self::verifyAliases(trailingslashit(ABSPATH) . AssetDelivery::PUBLIC_PREFIX . '/');
    }

    private static function publishFromBuildFallback(): bool
    {
        $js = AssetManifest::entryJsRelative();
        if (!$js) {
            return false;
        }
        $dest = trailingslashit(ABSPATH) . AssetDelivery::PUBLIC_PREFIX . '/';
        if (!wp_mkdir_p($dest)) {
            return false;
        }
        $build = MATCHFLOW_PATH . 'assets/build/';
        if (!copy($build . $js, $dest . 'app.js')) {
            return false;
        }
        foreach (AssetManifest::entryCssRelative() as $css) {
            if (copy($build . $css, $dest . 'app.css')) {
                break;
            }
        }
        $assets = $build . 'assets/';
        if (is_dir($assets)) {
            self::copyTree($assets, $dest . 'assets/');
        }

        return self::verifyAliases($dest);
    }

    private static function verifyAliases(string $dest): bool
    {
        return is_readable($dest . 'app.js');
    }

    private static function copyTree(string $source, string $dest): void
    {
        $source = wp_normalize_path(trailingslashit($source));
        $dest = wp_normalize_path(trailingslashit($dest));
        if (!wp_mkdir_p($dest)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            /** @var \SplFileInfo $item */
            $sub = $source . $iterator->getSubPathName();
            $target = $dest . $iterator->getSubPathName();
            if ($item->isDir()) {
                wp_mkdir_p($target);
                continue;
            }
            wp_mkdir_p(dirname($target));
            copy($sub, $target);
        }
    }
}
