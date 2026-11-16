<?php
/**
 * Shared dompdf bootstrap (invoice + receipt PDFs).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Receivables;

defined('ABSPATH') || exit;

final class DompdfFactory
{
    public static function create(): \Dompdf\Dompdf
    {
        if (!class_exists(\Dompdf\Dompdf::class)) {
            $autoload = MATCHFLOW_PATH . 'vendor/autoload.php';
            if (is_readable($autoload)) {
                require_once $autoload;
            }
        }
        if (!class_exists(\Dompdf\Dompdf::class)) {
            throw new \RuntimeException('dompdf is not installed. Run: composer install --no-dev');
        }

        $dompdf = new \Dompdf\Dompdf([
            'isRemoteEnabled' => false,
            'isHtml5ParserEnabled' => true,
            'chroot' => MATCHFLOW_PATH,
        ]);
        $dompdf->getOptions()->set('defaultFont', 'DejaVu Sans');
        $tmp = sys_get_temp_dir();
        if ($tmp !== '' && is_writable($tmp)) {
            $dompdf->getOptions()->set('tempDir', $tmp);
        }
        return $dompdf;
    }
}