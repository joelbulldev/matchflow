<?php
/**
 * Dashboard / analytics time windows.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Domain;

defined('ABSPATH') || exit;

final class AnalyticsPeriod
{
    public static function sinceUtc(string $period): ?string
    {
        $p = strtolower(trim($period));
        if ($p === '' || $p === 'all') {
            return null;
        }
        $map = [
            '7d' => '-7 days',
            '1m' => '-1 month',
            '3m' => '-3 months',
            '6m' => '-6 months',
        ];
        if (!isset($map[$p])) {
            return null;
        }
        return gmdate('Y-m-d H:i:s', strtotime($map[$p]));
    }

    public static function label(string $period): string
    {
        return match (strtolower($period)) {
            '7d' => 'Last 7 days',
            '1m' => 'Last month',
            '3m' => 'Last 3 months',
            '6m' => 'Last 6 months',
            default => 'All time',
        };
    }
}