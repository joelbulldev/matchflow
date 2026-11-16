<?php
/**
 * Receipt-sized PDF (A6 portrait) via dompdf.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Ledger;

use Matchflow\Receivables\DompdfFactory;

defined('ABSPATH') || exit;

final class SettlementReceiptPdfRenderer
{
    /**
     * @param array<string, mixed> $view
     */
    public function renderBinary(array $view): string
    {
        $html = (new SettlementReceiptPdf())->renderHtml($view);
        $dompdf = DompdfFactory::create();
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A6', 'portrait');
        $dompdf->render();
        return (string) $dompdf->output();
    }
}