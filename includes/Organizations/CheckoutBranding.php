<?php
/**
 * Checkout branding helpers (accent color semantics).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Organizations;

defined('ABSPATH') || exit;

final class CheckoutBranding
{
    /** Legacy schema default — treated as “merchant did not set accent”. */
    public const LEGACY_INDIGO = '#4f46e5';

    public static function normalizeAccent(mixed $color): ?string
    {
        $raw = trim((string) $color);
        if ($raw === '' || !preg_match('/^#?[a-f0-9]{6}$/i', $raw)) {
            return null;
        }
        $hex = str_starts_with($raw, '#') ? strtolower($raw) : '#' . strtolower($raw);
        if ($hex === self::LEGACY_INDIGO) {
            return null;
        }
        return $hex;
    }
}
