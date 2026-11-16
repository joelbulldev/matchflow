<?php
/**
 * Transient-backed rate limiter.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Security;

defined('ABSPATH') || exit;

final class RateLimiter
{
    public static function attempt(string $bucket, int $max, int $window_seconds): bool|\WP_Error
    {
        $key = 'mf_rl_' . md5($bucket);
        $state = get_transient($key);
        if (!is_array($state)) {
            $state = ['count' => 0, 'reset' => time() + $window_seconds];
        }

        if (time() > (int) $state['reset']) {
            $state = ['count' => 0, 'reset' => time() + $window_seconds];
        }

        $state['count'] = (int) $state['count'] + 1;
        set_transient($key, $state, $window_seconds);

        if ($state['count'] > $max) {
            return new \WP_Error(
                'matchflow_rate_limited',
                'Too many requests. Try again shortly.',
                [
                    'status' => 429,
                    'retry_after' => max(1, (int) $state['reset'] - time()),
                ]
            );
        }

        return true;
    }

    public static function clientBucket(string $scope): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $user = get_current_user_id();
        return $scope . '|' . $ip . '|' . $user;
    }
}
