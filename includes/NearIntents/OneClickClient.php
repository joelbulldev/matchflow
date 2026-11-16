<?php
/**
 * NEAR Intents 1Click HTTP client with per-endpoint auth.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\NearIntents;

defined('ABSPATH') || exit;

final class OneClickClient
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim(
            (string) (getenv('MATCHFLOW_NEAR_INTENTS_BASE_URL')
                ?: get_option('matchflow_near_intents_base_url', 'https://1click.chaindefuser.com')),
            '/'
        );
    }

    public function getTokens(): array|\WP_Error
    {
        return $this->request('GET', '/v0/tokens', null, 'tokens');
    }

    public function getQuote(array $body): array|\WP_Error
    {
        return $this->request('POST', '/v0/quote', $body, 'quote');
    }

    public function getStatus(string $depositAddress, ?string $depositMemo = null): array|\WP_Error
    {
        $query = ['depositAddress' => $depositAddress];
        if ($depositMemo) {
            $query['depositMemo'] = $depositMemo;
        }
        return $this->request('GET', '/v0/status?' . http_build_query($query), null, 'status');
    }

    public function submitDeposit(array $body): array|\WP_Error
    {
        return $this->request('POST', '/v0/deposit/submit', $body, 'deposit_submit');
    }

    private function request(string $method, string $path, ?array $body, string $operation): array|\WP_Error
    {
        $headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ];
        foreach ($this->authHeaders($operation) as $k => $v) {
            $headers[$k] = $v;
        }

        $args = [
            'method' => $method,
            'timeout' => 30,
            'headers' => $headers,
        ];
        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request($this->baseUrl . $path, $args);
        if (is_wp_error($response)) {
            return new \WP_Error(
                'matchflow_1click_unreachable',
                'Payment quote service unreachable: ' . $response->get_error_message(),
                ['status' => 503]
            );
        }
        $code = (int) wp_remote_retrieve_response_code($response);
        $raw = (string) wp_remote_retrieve_body($response);
        $json = json_decode($raw, true);
        if ($code >= 400) {
            $message = is_array($json) ? (string) ($json['message'] ?? $json['error'] ?? $raw) : $raw;
            $status = $code >= 500 ? 503 : 400;
            return new \WP_Error('matchflow_1click_error', $message ?: '1Click request failed.', ['status' => $status]);
        }
        return is_array($json) ? $json : [];
    }

    /**
     * Prefer X-API-Key when configured; fall back to Bearer JWT (legacy).
     */
    private function authHeaders(string $operation): array
    {
        $apiKey = (string) (getenv('MATCHFLOW_NEAR_INTENTS_API_KEY') ?: get_option('matchflow_near_intents_api_key', ''));
        $jwt = (string) (getenv('MATCHFLOW_NEAR_INTENTS_JWT') ?: get_option('matchflow_near_intents_jwt', ''));

        // Tokens endpoint is public in docs; still send auth when available.
        if ($apiKey !== '') {
            return ['X-API-Key' => $apiKey];
        }
        if ($jwt !== '') {
            return ['Authorization' => 'Bearer ' . $jwt];
        }
        return [];
    }
}
