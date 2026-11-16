<?php
/**
 * Always-on PSR-4 autoload for Matchflow\ (works with or without Composer vendor).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Core;

defined('ABSPATH') || exit;

final class Autoload
{
    public static function register(): void
    {
        spl_autoload_register([self::class, 'load'], true, true);
    }

    public static function load(string $class): void
    {
        if (!str_starts_with($class, 'Matchflow\\')) {
            return;
        }
        $relative = str_replace('\\', '/', substr($class, strlen('Matchflow\\')));
        $file = MATCHFLOW_PATH . 'includes/' . $relative . '.php';
        if (is_readable($file)) {
            require_once $file;
        }
    }
}
