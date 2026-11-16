<?php
/**
 * Exact decimal money helpers (BCMath).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Domain;

defined('ABSPATH') || exit;

final class Money
{
    public static function normalize(string $amount, int $scale = 8): string
    {
        if (!is_numeric($amount)) {
            throw new \InvalidArgumentException('Invalid monetary amount.');
        }
        return bcadd($amount, '0', $scale);
    }

    public static function add(string $a, string $b, int $scale = 8): string
    {
        return bcadd(self::normalize($a, $scale), self::normalize($b, $scale), $scale);
    }

    public static function sub(string $a, string $b, int $scale = 8): string
    {
        return bcsub(self::normalize($a, $scale), self::normalize($b, $scale), $scale);
    }

    public static function mul(string $a, string $b, int $scale = 8): string
    {
        return bcmul(self::normalize($a, $scale), self::normalize($b, $scale), $scale);
    }

    public static function cmp(string $a, string $b, int $scale = 8): int
    {
        return bccomp(self::normalize($a, $scale), self::normalize($b, $scale), $scale);
    }

    public static function lineTotal(string $qty, string $unitPrice, string $tax = '0', string $discount = '0', int $scale = 8): string
    {
        $base = self::mul($qty, $unitPrice, $scale);
        $base = self::sub($base, $discount, $scale);
        return self::add($base, $tax, $scale);
    }

    public static function toAtomic(string $amount, int $decimals): string
    {
        $normalized = self::normalize($amount, $decimals);
        $factor = bcpow('10', (string) $decimals, 0);
        return bcmul($normalized, $factor, 0);
    }

    public static function fromAtomic(string $atomic, int $decimals): string
    {
        $factor = bcpow('10', (string) $decimals, 0);
        return bcdiv($atomic, $factor, $decimals);
    }

    /**
     * Apply a payment against an outstanding balance.
     *
     * @return array{amount_paid:string,outstanding:string,status:string,overpayment:string}
     */
    public static function applyPayment(string $total, string $already_paid, string $payment, int $scale = 8): array
    {
        $paid = self::add($already_paid, $payment, $scale);
        $outstanding = self::sub($total, $paid, $scale);
        $overpayment = '0';
        if (self::cmp($outstanding, '0', $scale) < 0) {
            $overpayment = self::mul($outstanding, '-1', $scale);
            $outstanding = self::normalize('0', $scale);
        }
        $status = 'partially_paid';
        if (self::cmp($outstanding, '0', $scale) === 0) {
            $status = self::cmp($overpayment, '0', $scale) > 0 ? 'overpaid' : 'paid';
        } elseif (self::cmp($paid, '0', $scale) === 0) {
            $status = 'unpaid';
        }
        return [
            'amount_paid' => $paid,
            'outstanding' => $outstanding,
            'status' => $status,
            'overpayment' => $overpayment,
        ];
    }

    /**
     * Allocate one payment across obligation outstanding amounts in order.
     *
     * @param list<array{id:int|string,outstanding:string}> $obligations
     * @return array{allocations:list<array{id:int|string,amount:string}>,remainder:string}
     */
    public static function allocate(string $payment, array $obligations, int $scale = 8): array
    {
        $remaining = self::normalize($payment, $scale);
        $allocations = [];
        foreach ($obligations as $row) {
            if (self::cmp($remaining, '0', $scale) <= 0) {
                break;
            }
            $due = self::normalize((string) $row['outstanding'], $scale);
            if (self::cmp($due, '0', $scale) <= 0) {
                continue;
            }
            $take = self::cmp($remaining, $due, $scale) >= 0 ? $due : $remaining;
            $allocations[] = ['id' => $row['id'], 'amount' => $take];
            $remaining = self::sub($remaining, $take, $scale);
        }
        return ['allocations' => $allocations, 'remainder' => $remaining];
    }
}
