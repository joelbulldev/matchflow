<?php
/**
 * Read Vite build manifest for hashed filenames.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Frontend;

defined('ABSPATH') || exit;

final class AssetManifest
{
    /** @var ?array<string, mixed> */
    private static ?array $cache = null;

    /**
     * @return ?array<string, mixed>
     */
    public static function manifest(): ?array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        foreach (
            [
                MATCHFLOW_PATH . 'assets/build/.vite/manifest.json',
                MATCHFLOW_PATH . 'assets/build/manifest.json',
            ] as $manifest_path
        ) {
            if (!is_readable($manifest_path)) {
                continue;
            }
            $data = json_decode((string) file_get_contents($manifest_path), true);
            if (is_array($data)) {
                self::$cache = $data;
                return self::$cache;
            }
        }

        self::$cache = null;
        return null;
    }

    /**
     * @return ?array{file: string, css?: list<string>}
     */
    public static function entry(): ?array
    {
        $manifest = self::manifest();
        if (!$manifest) {
            return null;
        }

        $entry = $manifest['src/main.tsx'] ?? $manifest['index.html'] ?? null;
        if (!is_array($entry)) {
            foreach ($manifest as $item) {
                if (is_array($item) && !empty($item['isEntry'])) {
                    $entry = $item;
                    break;
                }
            }
        }
        if (!is_array($entry) || empty($entry['file'])) {
            return null;
        }

        return $entry;
    }

    public static function entryJsRelative(): ?string
    {
        $entry = self::entry();
        return $entry ? ltrim((string) $entry['file'], '/') : null;
    }

  /**
   * @return list<string>
   */
    public static function entryCssRelative(): array
    {
        $entry = self::entry();
        if (!$entry || empty($entry['css']) || !is_array($entry['css'])) {
            return [];
        }
        return array_values(array_map(static fn($c) => ltrim((string) $c, '/'), $entry['css']));
    }

    public static function buildMtime(): int
    {
        return self::cacheBustToken();
    }

    /** Cache-bust query param for enqueued app.js / app.css (version + bundle mtime). */
    public static function cacheBustToken(): int
    {
        $times = [];
        foreach (
            [
                MATCHFLOW_PATH . 'assets/delivery/app.js',
                MATCHFLOW_PATH . 'assets/delivery/app.css',
            ] as $path
        ) {
            if (is_readable($path)) {
                $times[] = (int) filemtime($path);
            }
        }
        $entry = self::entryJsRelative();
        if ($entry) {
            $path = MATCHFLOW_PATH . 'assets/build/' . $entry;
            if (is_readable($path)) {
                $times[] = (int) filemtime($path);
            }
        }
        if ($times === []) {
            return (int) crc32((string) MATCHFLOW_VERSION);
        }
        return (int) max($times);
    }
}
