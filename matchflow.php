<?php
/**
 * Plugin Name: MATCHFLOW
 * Plugin URI: https://github.com/matchflow/matchflow
 * Description: Intelligent Financial Operations for Global Businesses — receivables, payables, and cross-chain settlement via NEAR Intents.
 * Version: 0.1.40
 * Requires at least: 6.4
 * Requires PHP: 8.1
 * Author: MATCHFLOW
 * License: MIT
 * Text Domain: matchflow
 *
 * @package Matchflow
 */

declare(strict_types=1);

defined('ABSPATH') || exit;

define('MATCHFLOW_VERSION', '0.1.40');
define('MATCHFLOW_FILE', __FILE__);
define('MATCHFLOW_PATH', plugin_dir_path(__FILE__));
define('MATCHFLOW_URL', plugin_dir_url(__FILE__));
define('MATCHFLOW_BASENAME', plugin_basename(__FILE__));
define('MATCHFLOW_SCHEMA_VERSION', '8');

require_once MATCHFLOW_PATH . 'includes/Core/Autoload.php';
Matchflow\Core\Autoload::register();

$matchflow_autoload = MATCHFLOW_PATH . 'vendor/autoload.php';
if (is_readable($matchflow_autoload)) {
    require_once $matchflow_autoload;
}

/** Critical REST classes — survives partial Composer classmaps on shared hosting. */
foreach (
    [
        'includes/REST/ControllerLoader.php',
        'includes/REST/MatchflowBootstrap.php',
        'includes/REST/Controllers/BootstrapController.php',
        'includes/REST/Controllers/AuthController.php',
    ] as $rel
) {
    $path = MATCHFLOW_PATH . $rel;
    if (is_readable($path)) {
        require_once $path;
    }
}

register_activation_hook(__FILE__, ['Matchflow\\Core\\Activator', 'activate']);
register_deactivation_hook(__FILE__, ['Matchflow\\Core\\Deactivator', 'deactivate']);

add_action(
    'plugins_loaded',
    static function (): void {
        Matchflow\Core\Plugin::instance()->boot();
    }
);
