<?php
/**
 * MATCHFLOW SPA document shell — full frontend takeover (no WP chrome).
 *
 * @package Matchflow
 */

defined('ABSPATH') || exit;

$brand = get_bloginfo('name') ?: 'MATCHFLOW';
?><!DOCTYPE html>
<html <?php language_attributes(); ?> class="matchflow-html">
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#138d67">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <title><?php echo esc_html($brand); ?></title>
    <?php wp_head(); ?>
    <style>
        html.matchflow-html, body.matchflow-app { margin: 0 !important; padding: 0 !important; min-height: 100%; }
        html.matchflow-html { margin-top: 0 !important; }
        #wpadminbar { display: none !important; }
        body.matchflow-app { background: #f8fafc; color: #0f172a; }
        #matchflow-root { min-height: 100dvh; }
        .mf-skeleton-root { min-height: 100dvh; position: relative; }
        .mf-app-boot {
            position: fixed; inset: 0; z-index: 200;
            display: flex; align-items: center; justify-content: center;
            background: #f8fafc;
        }
        .mf-app-boot__inner {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 0 1.5rem;
        }
        .mf-app-boot__spinner-wrap {
            position: relative; display: inline-block; margin-bottom: 1rem;
        }
        .mf-boot-glow {
            position: absolute; inset: 0; border-radius: 50%;
            background: radial-gradient(circle, hsla(168, 76%, 32%, 0.18) 0%, transparent 70%);
            animation: mf-boot-pulse 2s ease-in-out infinite;
        }
        .mf-boot-spinner {
            width: 48px; height: 48px; border: 4px solid #e2e8f0;
            border-top-color: hsl(168, 76%, 32%); border-radius: 50%;
            animation: mf-boot-spin 1s linear infinite; position: relative;
        }
        .mf-boot-spinner::after {
            content: ""; position: absolute; inset: 8px; border-radius: 50%;
            border: 4px solid transparent; border-top-color: hsl(168, 50%, 65%);
            animation: mf-boot-spin 0.8s linear reverse infinite;
        }
        .mf-app-boot__title {
            margin: 0; font-size: 1rem; line-height: 1.5rem; font-weight: 600; color: #0f172a;
            font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
        }
        @keyframes mf-boot-spin { to { transform: rotate(360deg); } }
        @keyframes mf-boot-pulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
            .mf-boot-spinner, .mf-boot-spinner::after, .mf-boot-glow { animation: none; }
        }
    </style>
</head>
<body <?php body_class('matchflow-app'); ?>>
<?php wp_body_open(); ?>
<div id="matchflow-root">
    <div id="mf-app-skeleton" class="mf-skeleton-root" role="status" aria-live="polite" aria-label="Loading MATCHFLOW">
        <div class="mf-app-boot">
            <div class="mf-app-boot__inner">
                <div class="mf-app-boot__spinner-wrap">
                    <div class="mf-boot-glow" aria-hidden="true"></div>
                    <div class="mf-boot-spinner" aria-hidden="true"></div>
                </div>
            </div>
        </div>
    </div>
</div>
<?php wp_footer(); ?>
</body>
</html>
