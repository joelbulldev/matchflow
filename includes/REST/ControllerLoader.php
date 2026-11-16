<?php
/**
 * Eager-load REST controllers (avoids autoload misses on partial deploys).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST;

defined('ABSPATH') || exit;

final class ControllerLoader
{
    /**
     * @return list<string> Missing controller basenames (no .php)
     */
    public static function loadAll(): array
    {
        $dir = MATCHFLOW_PATH . 'includes/REST/Controllers/';
        if (!is_dir($dir)) {
            return ['Controllers directory'];
        }

        $missing = [];
        $required = [
            'BootstrapController',
            'AuthController',
            'OrganizationsController',
            'InvoicesController',
        ];

        foreach (glob($dir . '*.php') ?: [] as $file) {
            require_once $file;
        }

        foreach ($required as $name) {
            $file = $dir . $name . '.php';
            if (!is_readable($file) || filesize($file) < 32) {
                $missing[] = $name;
                continue;
            }
            $fqcn = 'Matchflow\\REST\\Controllers\\' . $name;
            if (!class_exists($fqcn)) {
                $missing[] = $name;
            }
        }

        return $missing;
    }
}
