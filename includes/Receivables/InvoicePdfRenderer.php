<?php
/**
 * Server-side PDF via dompdf (HTML from InvoicePdf).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Receivables;

defined('ABSPATH') || exit;

final class InvoicePdfRenderer
{
    public function renderBinary(array $invoice): string
    {
        $html = (new InvoicePdf())->renderHtml($invoice);
        $dompdf = DompdfFactory::create();
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        return (string) $dompdf->output();
    }
}