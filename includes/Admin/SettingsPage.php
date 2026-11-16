<?php
/**
 * WordPress admin — MATCHFLOW platform configuration.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Admin;

defined('ABSPATH') || exit;

final class SettingsPage
{
    /** @var array<string, list<string>> */
    private const TAB_KEYS = [
        'general' => [
            'matchflow_takeover_mode',
            'matchflow_allow_register',
            'matchflow_strip_fingerprints',
        ],
        'intents' => [
            'matchflow_near_intents_jwt',
            'matchflow_near_intents_api_key',
            'matchflow_near_intents_base_url',
            'matchflow_1click_public_key',
            'matchflow_near_intents_signing_key',
            'matchflow_allow_unverified_quotes',
            'matchflow_near_network',
            'matchflow_near_api_key',
        ],
        'checkout' => [
            'matchflow_checkout_brand_name',
            'matchflow_checkout_message',
            'matchflow_default_origin_asset',
            'matchflow_popular_origin_assets',
        ],
        'finance_ai' => [
            'matchflow_ai_provider',
            'matchflow_ai_api_key',
            'matchflow_ai_model',
            'matchflow_ai_base_url',
            'matchflow_ai_daily_user_limit',
        ],
        'email' => [
            'matchflow_smtp_host',
            'matchflow_smtp_port',
            'matchflow_smtp_encryption',
            'matchflow_smtp_auth',
            'matchflow_smtp_user',
            'matchflow_smtp_password',
            'matchflow_mail_from',
            'matchflow_mail_from_name',
        ],
        'auth' => [
            'matchflow_require_dual_control',
            'matchflow_demo_user',
            'matchflow_demo_password',
        ],
    ];

  /** @var list<string> */
    private const CHECKBOX_KEYS = [
        'matchflow_allow_register',
        'matchflow_require_dual_control',
        'matchflow_strip_fingerprints',
        'matchflow_smtp_auth',
        'matchflow_allow_unverified_quotes',
    ];

    public static function register(): void
    {
        add_options_page(
            'MATCHFLOW',
            'MATCHFLOW',
            'manage_options',
            'matchflow',
            [self::class, 'render']
        );

        foreach (self::TAB_KEYS as $tab => $keys) {
            $group = self::optionGroup($tab);
            foreach ($keys as $key) {
                register_setting($group, $key, [
                    'type' => 'string',
                    'sanitize_callback' => static function ($value) use ($key) {
                        if (in_array($key, self::CHECKBOX_KEYS, true)) {
                            return $value ? '1' : '';
                        }
                        if ($value === null) {
                            return (string) get_option($key, '');
                        }
                        return is_string($value) ? $value : (string) $value;
                    },
                ]);
            }
        }

        add_action('admin_init', [self::class, 'preserveCheckboxDefaults'], 20);
        add_filter('whitelist_options', [self::class, 'whitelistTabOptions']);
    }

    /**
     * @param array<string, list<string>> $whitelist
     * @return array<string, list<string>>
     */
    public static function whitelistTabOptions(array $whitelist): array
    {
        foreach (self::TAB_KEYS as $tab => $keys) {
            $whitelist[self::optionGroup($tab)] = $keys;
        }
        return $whitelist;
    }

    /**
     * Unchecked checkboxes are omitted from POST — only adjust values submitted on this tab.
     */
    public static function preserveCheckboxDefaults(): void
    {
        if (!is_admin() || !isset($_POST['option_page'])) {
            return;
        }
        $page = (string) $_POST['option_page'];
        $tab = self::tabFromOptionGroup($page);
        if ($tab === null) {
            return;
        }
        foreach (self::TAB_KEYS[$tab] as $key) {
            if (!in_array($key, self::CHECKBOX_KEYS, true)) {
                continue;
            }
            if (!isset($_POST[$key])) {
                $_POST[$key] = '';
            }
        }
    }

    private static function optionGroup(string $tab): string
    {
        return 'matchflow_settings_' . $tab;
    }

    private static function tabFromOptionGroup(string $group): ?string
    {
        if (!str_starts_with($group, 'matchflow_settings_')) {
            return null;
        }
        $tab = substr($group, strlen('matchflow_settings_'));
        return isset(self::TAB_KEYS[$tab]) ? $tab : null;
    }

    public static function render(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $nearOk = (bool) (
            get_option('matchflow_near_intents_jwt', '')
            || get_option('matchflow_near_intents_api_key', '')
            || getenv('MATCHFLOW_NEAR_INTENTS_JWT')
            || getenv('MATCHFLOW_NEAR_INTENTS_API_KEY')
        );
        $cron = wp_next_scheduled('matchflow_poll_settlements');
        $healthUrl = esc_url(home_url('/api/v1/health'));

        echo '<div class="wrap"><h1>MATCHFLOW</h1>';
        echo '<p>Configure settlement, checkout, SPA takeover, and integrations. Workspace operators manage org destinations in the app; site-wide secrets belong here.</p>';

        echo '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0;">';
        self::statCard('Schema', (string) get_option('matchflow_schema_version', '0'));
        self::statCard('Plugin', MATCHFLOW_VERSION);
        self::statCard('NEAR Intents', $nearOk ? 'Configured' : 'Missing credentials');
        self::statCard('Settlement cron', $cron ? 'Scheduled' : 'Not scheduled');
        echo '</div>';

        echo '<p><a class="button button-secondary" href="' . esc_url(admin_url('options-permalink.php')) . '">Flush permalinks</a> ';
        echo '<a class="button button-secondary" href="' . $healthUrl . '" target="_blank" rel="noopener">Health check</a></p>';

        $tab = isset($_GET['tab']) ? sanitize_key((string) $_GET['tab']) : 'general';
        $tabs = [
            'general' => 'General',
            'intents' => 'Settlement API',
            'checkout' => 'Checkout',
            'finance_ai' => 'Finance AI',
            'email' => 'Email',
            'auth' => 'Auth & policies',
        ];
        if (!isset($tabs[$tab])) {
            $tab = 'general';
        }

        echo '<nav class="nav-tab-wrapper wp-clearfix" style="margin:16px 0;">';
        foreach ($tabs as $id => $label) {
            $url = esc_url(add_query_arg(['page' => 'matchflow', 'tab' => $id], admin_url('options-general.php')));
            $active = $tab === $id ? ' nav-tab-active' : '';
            echo '<a href="' . $url . '" class="nav-tab' . $active . '">' . esc_html($label) . '</a>';
        }
        echo '</nav>';

        echo '<form method="post" action="options.php">';
        settings_fields(self::optionGroup($tab));
        echo '<input type="hidden" name="matchflow_settings_active_tab" value="' . esc_attr($tab) . '" />';

        if ($tab === 'general') {
            echo '<h2 class="title">Frontend</h2><table class="form-table">';
            self::selectRow('Frontend takeover', 'matchflow_takeover_mode', [
                'full' => 'Full SPA takeover (recommended)',
                'scoped' => 'Scoped routes only',
            ], (string) get_option('matchflow_takeover_mode', 'full'));
            self::checkboxRow('Allow SPA registration', 'matchflow_allow_register', (bool) get_option('matchflow_allow_register', true));
            self::checkboxRow('Strip WordPress fingerprints on takeover', 'matchflow_strip_fingerprints', (bool) get_option('matchflow_strip_fingerprints', false));
            echo '</table>';
        }

        if ($tab === 'intents') {
            echo '<h2 class="title">NEAR Intents (1Click) — required for live quotes &amp; settlement</h2>';
            echo '<p class="description">Obtain JWT or API key from the NEAR Intents / 1Click operator. Without these, checkout shows preview-only errors.</p>';
            echo '<table class="form-table">';
            self::passwordRow('1Click JWT (Bearer)', 'matchflow_near_intents_jwt', (string) get_option('matchflow_near_intents_jwt', ''));
            self::passwordRow('1Click API key (X-API-Key)', 'matchflow_near_intents_api_key', (string) get_option('matchflow_near_intents_api_key', ''));
            self::textRow('1Click API base URL', 'matchflow_near_intents_base_url', (string) get_option('matchflow_near_intents_base_url', 'https://1click.chaindefuser.com'));
            self::textRow('Quote verification public key', 'matchflow_1click_public_key', (string) get_option('matchflow_1click_public_key', ''));
            echo '<tr><td colspan="2"><p class="description">Leave empty to use the default 1Click manager public key. Do not paste your X-API-Key or JWT here.</p></td></tr>';
            echo '<p class="description">1Click manager <strong>public</strong> key (Ed25519, Base58). Default in plugin: <code>ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc</code> — same as <a href="https://docs.near-intents.org/integration/distribution-channels/1click-api/verify-quote-signature" target="_blank" rel="noopener">NEAR Intents verify-quote docs</a>. Leave blank to use the default.</p>';
            self::textRow('Signing key (legacy fallback)', 'matchflow_near_intents_signing_key', (string) get_option('matchflow_near_intents_signing_key', ''));
            echo '<p class="description">Legacy option name — same value as quote verification public key. Not your Partner JWT and not a private key.</p>';
            self::checkboxRow(
                'Allow unverified quotes (sandbox only)',
                'matchflow_allow_unverified_quotes',
                (bool) get_option('matchflow_allow_unverified_quotes', false)
            );
            echo '<p class="description">When enabled, live quotes may proceed even if Ed25519 verification fails. Leave off in production.</p>';
            self::selectRow('NEAR network label (UI)', 'matchflow_near_network', [
                'mainnet' => 'mainnet',
                'testnet' => 'testnet',
            ], (string) get_option('matchflow_near_network', 'mainnet'));
            self::passwordRow('NEAR RPC URL or dRPC key', 'matchflow_near_api_key', (string) get_option('matchflow_near_api_key', ''));
            echo '<p class="description">Full JSON-RPC URL (e.g. dRPC <code>https://lb.drpc.live/near/…</code>) or key segment only. Used only on the server via <code>/api/v1/near-rpc</code> — never exposed to browsers. Env: <code>MATCHFLOW_NEAR_RPC_URL</code>.</p>';
            echo '</table>';
        }

        if ($tab === 'checkout') {
            echo '<h2 class="title">Public invoice checkout (payer experience)</h2>';
            echo '<table class="form-table">';
            self::textRow('Checkout brand override', 'matchflow_checkout_brand_name', (string) get_option('matchflow_checkout_brand_name', ''));
            self::textareaRow('Checkout message (shown on /pay/…)', 'matchflow_checkout_message', (string) get_option('matchflow_checkout_message', 'Pay from any supported chain. Wallet activity alone is not settlement proof.'));
            self::textRow('Default origin asset ID', 'matchflow_default_origin_asset', (string) get_option(
                'matchflow_default_origin_asset',
                'nep141:wrap.near'
            ));
            self::textareaRow(
                'Popular origin assets (one asset ID per line)',
                'matchflow_popular_origin_assets',
                (string) get_option('matchflow_popular_origin_assets', "nep141:wrap.near\nnep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near\nnep141:ethereum.omft.near")
            );
            echo '</table>';
        }

        if ($tab === 'finance_ai') {
            echo '<h2 class="title">Finance AI</h2>';
            echo '<p class="description">OpenAI-compatible chat. Provider selection sets the default API base URL; override with Custom if needed.</p>';
            echo '<table class="form-table">';
            self::selectRow('Provider', 'matchflow_ai_provider', [
                'openrouter' => 'OpenRouter',
                'openai' => 'OpenAI',
                'grok' => 'xAI (Grok)',
                'anthropic' => 'Anthropic',
                'google' => 'Google Gemini',
                'custom' => 'Custom (OpenAI-compatible)',
            ], (string) get_option('matchflow_ai_provider', 'openrouter'));
            self::passwordRow('API key', 'matchflow_ai_api_key', (string) get_option('matchflow_ai_api_key', ''));
            self::textRow('Model', 'matchflow_ai_model', (string) get_option('matchflow_ai_model', ''));
            echo '<p class="description">Leave blank to use the provider default model.</p>';
            self::textRow('API base URL (custom only)', 'matchflow_ai_base_url', (string) get_option('matchflow_ai_base_url', ''));
            self::textRow('Daily requests per user (0 = unlimited)', 'matchflow_ai_daily_user_limit', (string) get_option('matchflow_ai_daily_user_limit', '50'));
            echo '</table>';
        }

        if ($tab === 'email') {
            echo '<h2 class="title">Outbound email (SMTP)</h2>';
            echo '<p class="description">Invoice payment links and reminders use <code>wp_mail</code>. Leave host empty to use the server default mail transport.</p>';
            echo '<table class="form-table">';
            self::textRow('SMTP host', 'matchflow_smtp_host', (string) get_option('matchflow_smtp_host', ''));
            self::textRow('SMTP port', 'matchflow_smtp_port', (string) get_option('matchflow_smtp_port', '587'));
            self::selectRow('Encryption', 'matchflow_smtp_encryption', ['tls' => 'TLS (STARTTLS)', 'ssl' => 'SSL', 'none' => 'None'], (string) get_option('matchflow_smtp_encryption', 'tls'));
            self::checkboxRow('SMTP authentication', 'matchflow_smtp_auth', (bool) get_option('matchflow_smtp_auth', true));
            self::textRow('SMTP username', 'matchflow_smtp_user', (string) get_option('matchflow_smtp_user', ''));
            self::passwordRow('SMTP password', 'matchflow_smtp_password', (string) get_option('matchflow_smtp_password', ''));
            self::textRow('From email', 'matchflow_mail_from', (string) get_option('matchflow_mail_from', ''));
            self::textRow('From name', 'matchflow_mail_from_name', (string) get_option('matchflow_mail_from_name', 'MATCHFLOW'));
            echo '</table>';
        }

        if ($tab === 'auth') {
            echo '<h2 class="title">Auth &amp; policies</h2><table class="form-table">';
            self::checkboxRow('Require dual control on bill approval', 'matchflow_require_dual_control', (bool) get_option('matchflow_require_dual_control', true));
            self::textRow('Demo username', 'matchflow_demo_user', (string) get_option('matchflow_demo_user', 'matchflow_demo'));
            self::passwordRow('Demo password', 'matchflow_demo_password', (string) get_option('matchflow_demo_password', ''));
            echo '</table>';
        }

        submit_button('Save MATCHFLOW settings');
        echo '</form></div>';
    }

    private static function statCard(string $label, string $value): void
    {
        echo '<div style="background:#fff;border:1px solid #c3c4c7;border-radius:8px;padding:12px 16px;">';
        echo '<div style="font-size:11px;text-transform:uppercase;color:#646970;">' . esc_html($label) . '</div>';
        echo '<div style="font-size:18px;font-weight:600;margin-top:4px;">' . esc_html($value) . '</div></div>';
    }

    private static function textRow(string $label, string $name, string $value): void
    {
        echo '<tr><th scope="row"><label for="' . esc_attr($name) . '">' . esc_html($label) . '</label></th>';
        echo '<td><input type="text" class="regular-text" id="' . esc_attr($name) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '" /></td></tr>';
    }

    private static function passwordRow(string $label, string $name, string $value): void
    {
        echo '<tr><th scope="row"><label for="' . esc_attr($name) . '">' . esc_html($label) . '</label></th>';
        echo '<td><input type="password" class="regular-text" id="' . esc_attr($name) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '" autocomplete="off" />';
        echo $value !== '' ? ' <em>configured</em>' : ' <em style="color:#b32d2e;">empty</em>';
        echo '</td></tr>';
    }

    private static function textareaRow(string $label, string $name, string $value): void
    {
        echo '<tr><th scope="row"><label for="' . esc_attr($name) . '">' . esc_html($label) . '</label></th>';
        echo '<td><textarea class="large-text code" rows="4" id="' . esc_attr($name) . '" name="' . esc_attr($name) . '">' . esc_textarea($value) . '</textarea></td></tr>';
    }

    private static function selectRow(string $label, string $name, array $options, string $current): void
    {
        echo '<tr><th scope="row">' . esc_html($label) . '</th><td><select name="' . esc_attr($name) . '">';
        foreach ($options as $val => $text) {
            printf('<option value="%s"%s>%s</option>', esc_attr($val), selected($current, $val, false), esc_html($text));
        }
        echo '</select></td></tr>';
    }

    private static function checkboxRow(string $label, string $name, bool $checked): void
    {
        echo '<tr><th scope="row">' . esc_html($label) . '</th><td>';
        printf(
            '<label><input type="checkbox" name="%s" value="1"%s /> Enabled</label>',
            esc_attr($name),
            checked($checked, true, false)
        );
        echo '</td></tr>';
    }
}