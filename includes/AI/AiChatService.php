<?php
/**
 * OpenAI-compatible chat completions for Finance AI.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\AI;

defined('ABSPATH') || exit;

final class AiChatService
{
    public static function withinDailyLimit(int $user_id): bool
    {
        $limit = AiConfig::dailyUserLimit();
        if ($limit <= 0) {
            return true;
        }
        $key = 'matchflow_ai_req_' . $user_id . '_' . gmdate('Y-m-d');
        $count = (int) get_transient($key);
        return $count < $limit;
    }

    public static function recordUse(int $user_id): void
    {
        $limit = AiConfig::dailyUserLimit();
        if ($limit <= 0) {
            return;
        }
        $key = 'matchflow_ai_req_' . $user_id . '_' . gmdate('Y-m-d');
        $count = (int) get_transient($key);
        set_transient($key, $count + 1, DAY_IN_SECONDS);
    }

    /**
     * @param list<array{role: string, content: string}> $messages
     */
    public static function complete(array $messages): string|\WP_Error
    {
        if (!AiConfig::configured()) {
            return new \WP_Error('matchflow_ai_unconfigured', 'Finance AI is not configured on this site.', ['status' => 503]);
        }

        $url = AiConfig::baseUrl() . '/chat/completions';
        $body = [
            'model' => AiConfig::model(),
            'messages' => $messages,
            'temperature' => 0.2,
            'max_tokens' => 900,
        ];

        $headers = [
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . AiConfig::apiKey(),
        ];
        if (AiConfig::activeProvider() === 'openrouter') {
            $headers['Referer'] = home_url('/');
            $headers['X-Title'] = 'MATCHFLOW';
        }

        $response = wp_remote_post($url, [
            'timeout' => 60,
            'headers' => $headers,
            'body' => wp_json_encode($body),
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $code = (int) wp_remote_retrieve_response_code($response);
        $raw = (string) wp_remote_retrieve_body($response);
        $json = json_decode($raw, true);
        if ($code < 200 || $code >= 300 || !is_array($json)) {
            $msg = is_array($json) && isset($json['error']['message'])
                ? (string) $json['error']['message']
                : 'Upstream AI request failed.';
            return new \WP_Error('matchflow_ai_upstream', $msg, ['status' => $code ?: 502]);
        }

        $content = $json['choices'][0]['message']['content'] ?? '';
        return is_string($content) ? trim($content) : '';
    }
}
