<?php
/**
 * Receivables invoices API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Receivables\InvoicePdf;
use Matchflow\Receivables\InvoicePdfRenderer;
use Matchflow\Receivables\InvoiceService;
use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class InvoicesController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/receivables/invoices', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'index'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')),
                'callback' => [self::class, 'create'],
            ],
        ]);
        register_rest_route($ns, '/receivables/invoices/(?P<id>\\d+)', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'show'],
            ],
            [
                'methods' => 'PATCH',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')),
                'callback' => [self::class, 'update'],
            ],
        ]);
        register_rest_route($ns, '/receivables/invoices/(?P<id>\\d+)/issue', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')),
            'callback' => [self::class, 'issue'],
        ]);
        register_rest_route($ns, '/receivables/invoices/(?P<id>\\d+)/void', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')),
            'callback' => [self::class, 'void'],
        ]);
        register_rest_route($ns, '/receivables/invoices/(?P<id>\\d+)/notify', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.write')),
            'callback' => [self::class, 'notify'],
        ]);
        register_rest_route($ns, '/receivables/invoices/(?P<id>\\d+)/pdf', [
            [
                'methods' => 'GET',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'pdf'],
            ],
            [
                'methods' => 'POST',
                'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ar.read')),
                'callback' => [self::class, 'pdf'],
            ],
        ]);
    }

    public static function index(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.read');
        if (is_wp_error($check)) {
            return $check;
        }
        $org = Auth::organizationId($request);
        $service = new InvoiceService();
        $args = [
            'status' => $request->get_param('status'),
            'customer_id' => $request->get_param('customer_id'),
            'q' => $request->get_param('q'),
            'limit' => (int) ($request->get_param('limit') ?: 50),
            'offset' => (int) ($request->get_param('offset') ?: 0),
        ];
        $rows = $service->list($org, $args);
        foreach ($rows as &$row) {
            $row = $service->present($row);
        }
        unset($row);
        $total = $service->count($org, $args);
        return Response::success([
            'items' => $rows,
            'total' => $total,
            'limit' => $args['limit'],
            'offset' => $args['offset'],
        ]);
    }

    public static function create(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.write');
        if (is_wp_error($check)) {
            return $check;
        }
        $invoice = (new InvoiceService())->create(Auth::organizationId($request), get_current_user_id(), $request->get_json_params() ?: []);
        return Response::success($invoice, [], 201);
    }

    public static function show(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.read');
        if (is_wp_error($check)) {
            return $check;
        }
        $invoice = (new InvoiceService())->find(Auth::organizationId($request), (int) $request['id']);
        return $invoice ? Response::success($invoice) : Response::error('matchflow_not_found', 'Invoice not found.', 404);
    }

    public static function update(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.write');
        if (is_wp_error($check)) {
            return $check;
        }
        $invoice = (new InvoiceService())->update(Auth::organizationId($request), (int) $request['id'], $request->get_json_params() ?: []);
        return $invoice ? Response::success($invoice) : Response::error('matchflow_invalid_state', 'Invoice cannot be updated.', 409);
    }

    public static function issue(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.write');
        if (is_wp_error($check)) {
            return $check;
        }
        $result = (new InvoiceService())->issue(Auth::organizationId($request), (int) $request['id']);
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function void(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.write');
        if (is_wp_error($check)) {
            return $check;
        }
        $data = $request->get_json_params() ?: [];
        $reason = sanitize_text_field((string) ($data['reason'] ?? ''));
        $result = (new InvoiceService())->void(Auth::organizationId($request), (int) $request['id'], $reason);
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function notify(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.write');
        if (is_wp_error($check)) {
            return $check;
        }
        $data = $request->get_json_params() ?: [];
        $type = sanitize_text_field((string) ($data['type'] ?? 'invoice_issued'));
        $template = $type === 'invoice_reminder' ? 'invoice_reminder' : 'invoice_issued';
        $result = (new InvoiceService())->notifyCustomer(Auth::organizationId($request), (int) $request['id'], $template);
        return is_wp_error($result) ? $result : Response::success($result);
    }

    public static function pdf(WP_REST_Request $request)
    {
        $check = Auth::requireCapability($request, 'ar.read');
        if (is_wp_error($check)) {
            return $check;
        }
        $org = Auth::organizationId($request);
        $id = (int) $request['id'];
        $service = new InvoiceService();
        $invoice = $service->find($org, $id);
        if (!$invoice) {
            return Response::error('matchflow_not_found', 'Invoice not found.', 404);
        }
        $format = sanitize_key((string) ($request->get_param('format') ?: 'pdf'));
        $pdf = new InvoicePdf();
        $html = $pdf->renderHtml($invoice);
        $basename = sanitize_file_name((string) ($invoice['invoice_number'] ?? 'invoice'));
        if ($format === 'html') {
            return Response::success([
                'html' => $html,
                'filename' => $basename . '.html',
                'invoice_number' => $invoice['invoice_number'] ?? '',
            ]);
        }
        try {
            $binary = (new InvoicePdfRenderer())->renderBinary($invoice);
            return Response::success([
                'pdfBase64' => base64_encode($binary),
                'filename' => $basename . '.pdf',
                'invoice_number' => $invoice['invoice_number'] ?? '',
            ]);
        } catch (\Throwable $e) {
            return Response::success([
                'html' => $html,
                'filename' => $basename . '.pdf',
                'invoice_number' => $invoice['invoice_number'] ?? '',
                'pdfFallback' => true,
                'message' => $e->getMessage() ?: 'PDF engine unavailable.',
            ]);
        }
    }
}
