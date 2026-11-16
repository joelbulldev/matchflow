<?php
/**
 * Private file upload/download API.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\REST\Response;
use Matchflow\Security\Auth;
use WP_REST_Request;

final class FilesController
{
    public static function register(string $ns): void
    {
        register_rest_route($ns, '/files', [
            'methods' => 'POST',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.write')),
            'callback' => [self::class, 'upload'],
        ]);
        register_rest_route($ns, '/files/(?P<id>\\d+)', [
            'methods' => 'GET',
            'permission_callback' => static fn(WP_REST_Request $r) => !is_wp_error(Auth::requireCapability($r, 'ap.read')),
            'callback' => [self::class, 'download'],
        ]);
    }

    public static function upload(WP_REST_Request $request)
    {
        $org = Auth::organizationId($request);
        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return Response::error('matchflow_invalid', 'file is required.', 400);
        }
        $file = $files['file'];
        $allowed = ['application/pdf', 'image/png', 'image/jpeg'];
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']) ?: '';
        if (!in_array($mime, $allowed, true)) {
            return Response::error('matchflow_invalid_file', 'Unsupported file type.', 400);
        }
        if ((int) $file['size'] > 10 * 1024 * 1024) {
            return Response::error('matchflow_invalid_file', 'File too large.', 400);
        }

        $dir = self::storageDir($org);
        if (!wp_mkdir_p($dir)) {
            return Response::error('matchflow_storage', 'Unable to create storage.', 500);
        }
        $hash = hash_file('sha256', $file['tmp_name']);
        $name = wp_unique_filename($dir, sanitize_file_name($file['name']));
        $dest = trailingslashit($dir) . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            return Response::error('matchflow_storage', 'Upload failed.', 500);
        }

        global $wpdb;
        $wpdb->insert($wpdb->prefix . 'mf_documents', [
            'organization_id' => $org,
            'owner_type' => sanitize_text_field((string) ($request->get_param('owner_type') ?: 'ap_bill')),
            'owner_id' => (int) ($request->get_param('owner_id') ?: 0),
            'storage_key' => $org . '/' . $name,
            'original_name' => sanitize_file_name($file['name']),
            'mime_type' => $mime,
            'size_bytes' => (int) $file['size'],
            'sha256' => $hash,
            'extraction_status' => 'pending',
            'created_by' => get_current_user_id(),
            'created_at' => gmdate('Y-m-d H:i:s'),
        ]);

        return Response::success(['id' => (int) $wpdb->insert_id, 'sha256' => $hash], [], 201);
    }

    public static function download(WP_REST_Request $request)
    {
        global $wpdb;
        $org = Auth::organizationId($request);
        $row = $wpdb->get_row($wpdb->prepare(
            'SELECT * FROM ' . $wpdb->prefix . 'mf_documents WHERE organization_id = %d AND id = %d',
            $org,
            (int) $request['id']
        ), ARRAY_A);
        if (!$row) {
            return Response::error('matchflow_not_found', 'File not found.', 404);
        }
        $path = trailingslashit(self::storageRoot()) . $row['storage_key'];
        if (!is_readable($path)) {
            return Response::error('matchflow_not_found', 'File missing.', 404);
        }
        header('Content-Type: ' . $row['mime_type']);
        header('Content-Disposition: attachment; filename="' . $row['original_name'] . '"');
        header('Content-Length: ' . (string) filesize($path));
        readfile($path);
        exit;
    }

    private static function storageRoot(): string
    {
        $upload = wp_upload_dir();
        return trailingslashit($upload['basedir']) . 'matchflow-private';
    }

    private static function storageDir(int $org): string
    {
        return trailingslashit(self::storageRoot()) . $org;
    }
}
