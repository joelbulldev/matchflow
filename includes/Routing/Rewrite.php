<?php
/**
 * Rewrite rules and API alias.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Routing;

defined('ABSPATH') || exit;

final class Rewrite
{
    public static function register(): void
    {
        add_rewrite_rule('^api/v1/(.*)?', 'index.php?rest_route=/matchflow/v1/$matches[1]', 'top');
        add_rewrite_rule('^assets/matchflow/(.*)?$', 'index.php?matchflow_asset=$matches[1]', 'top');
        add_rewrite_tag('%matchflow_app%', '1');
        add_rewrite_tag('%matchflow_asset%', '(.+)');

        add_rewrite_rule('^app(/.*)?$', 'index.php?matchflow_app=1', 'top');
        $marketing_roots = [
            'faq',
            'product',
            'security',
        ];
        foreach ($marketing_roots as $root) {
            add_rewrite_rule('^' . preg_quote($root, '/') . '(/.*)?$', 'index.php?matchflow_app=1', 'top');
        }
        add_rewrite_rule('^pay(/.*)?$', 'index.php?matchflow_app=1', 'top');
        add_rewrite_rule('^receipt(/.*)?$', 'index.php?matchflow_app=1', 'top');
        add_rewrite_rule('^supplier(/.*)?$', 'index.php?matchflow_app=1', 'top');
        add_rewrite_rule('^$', 'index.php?matchflow_app=1', 'top');

        $flushed = get_option('matchflow_rewrite_flushed');
        if ($flushed !== MATCHFLOW_VERSION) {
            flush_rewrite_rules(false);
            update_option('matchflow_rewrite_flushed', MATCHFLOW_VERSION);
        }
    }
}
