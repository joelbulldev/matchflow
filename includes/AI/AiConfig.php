<?php
/**
 * Finance AI provider URLs and defaults.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\AI;

defined('ABSPATH') || exit;

final class AiConfig
{
    /** @return array<string, array{label: string, base_url: string, default_model: string}> */
    public static function providers(): array
    {
        return [
            'openrouter' => [
                'label' => 'OpenRouter',
                'base_url' => 'https://openrouter.ai/api/v1',
                'default_model' => 'openai/gpt-4o-mini',
            ],
            'openai' => [
                'label' => 'OpenAI',
                'base_url' => 'https://api.openai.com/v1',
                'default_model' => 'gpt-4o-mini',
            ],
            'grok' => [
                'label' => 'xAI (Grok)',
                'base_url' => 'https://api.x.ai/v1',
                'default_model' => 'grok-2-1212',
            ],
            'anthropic' => [
                'label' => 'Anthropic',
                'base_url' => 'https://api.anthropic.com/v1',
                'default_model' => 'claude-3-5-haiku-20241022',
            ],
            'google' => [
                'label' => 'Google Gemini',
                'base_url' => 'https://generativelanguage.googleapis.com/v1beta/openai',
                'default_model' => 'gemini-2.0-flash',
            ],
            'custom' => [
                'label' => 'Custom (OpenAI-compatible)',
                'base_url' => '',
                'default_model' => '',
            ],
        ];
    }

    public static function activeProvider(): string
    {
        $fromEnv = getenv('MATCHFLOW_AI_PROVIDER');
        if (is_string($fromEnv) && $fromEnv !== '') {
            return $fromEnv;
        }
        $opt = get_option('matchflow_ai_provider', 'openrouter');
        return is_string($opt) ? $opt : 'openrouter';
    }

    public static function apiKey(): string
    {
        $fromEnv = getenv('MATCHFLOW_AI_API_KEY');
        if (is_string($fromEnv) && $fromEnv !== '') {
            return $fromEnv;
        }
        $opt = get_option('matchflow_ai_api_key', '');
        return is_string($opt) ? trim($opt) : '';
    }

    public static function baseUrl(): string
    {
        $custom = get_option('matchflow_ai_base_url', '');
        if (is_string($custom) && trim($custom) !== '') {
            return rtrim(trim($custom), '/');
        }
        $fromEnv = getenv('MATCHFLOW_AI_BASE_URL');
        if (is_string($fromEnv) && trim($fromEnv) !== '') {
            return rtrim(trim($fromEnv), '/');
        }
        $provider = self::activeProvider();
        $def = self::providers()[$provider] ?? self::providers()['openrouter'];
        return rtrim($def['base_url'], '/');
    }

    public static function model(): string
    {
        $fromEnv = getenv('MATCHFLOW_AI_MODEL');
        if (is_string($fromEnv) && trim($fromEnv) !== '') {
            return trim($fromEnv);
        }
        $opt = get_option('matchflow_ai_model', '');
        if (is_string($opt) && trim($opt) !== '') {
            return trim($opt);
        }
        $provider = self::activeProvider();
        $def = self::providers()[$provider] ?? self::providers()['openrouter'];
        return (string) $def['default_model'];
    }

    public static function dailyUserLimit(): int
    {
        $raw = get_option('matchflow_ai_daily_user_limit', '50');
        if (!is_numeric($raw)) {
            return 50;
        }
        return max(0, (int) $raw);
    }

    public static function configured(): bool
    {
        return self::apiKey() !== '' && self::baseUrl() !== '';
    }
}
