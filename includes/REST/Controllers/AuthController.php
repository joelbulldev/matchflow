<?php
/**
 * Authentication bridge — email/password + NEAR wallet connect/link.
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\REST\Controllers;

defined('ABSPATH') || exit;

use Matchflow\Demo\DemoProvisioner;
use Matchflow\REST\Response;
use Matchflow\Security\AuditLogger;
use Matchflow\Security\RateLimiter;
use WP_REST_Request;

final class AuthController
{
    private const NEAR_META = 'matchflow_near_account_id';
    private const NEAR_LINKED_AT = 'matchflow_near_linked_at';
    private const NEAR_PUBLIC_KEY = 'matchflow_near_public_key';

    public static function register(string $ns): void
    {
        register_rest_route($ns, '/auth/login', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'login'],
        ]);
        register_rest_route($ns, '/auth/logout', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'logout'],
        ]);
        register_rest_route($ns, '/auth/me', [
            'methods' => 'GET',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'me'],
        ]);
        register_rest_route($ns, '/auth/register', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'registerUser'],
        ]);
        register_rest_route($ns, '/auth/forgot-password', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'forgotPassword'],
        ]);
        register_rest_route($ns, '/auth/reset-password', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'resetPassword'],
        ]);
        register_rest_route($ns, '/auth/near/challenge', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'nearChallenge'],
        ]);
        register_rest_route($ns, '/auth/near/login', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'nearLogin'],
        ]);
        register_rest_route($ns, '/auth/near/link', [
            'methods' => 'POST',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'nearLink'],
        ]);
        register_rest_route($ns, '/auth/near/unlink', [
            'methods' => 'POST',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'nearUnlink'],
        ]);
        register_rest_route($ns, '/auth/demo', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => [self::class, 'demoLogin'],
        ]);
        register_rest_route($ns, '/auth/password-otp/request', [
            'methods' => 'POST',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'requestPasswordOtp'],
        ]);
        register_rest_route($ns, '/auth/password-otp/confirm', [
            'methods' => 'POST',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'confirmPasswordOtp'],
        ]);
        register_rest_route($ns, '/auth/sessions', [
            'methods' => 'GET',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'sessions'],
        ]);
        register_rest_route($ns, '/auth/sessions/(?P<session_id>[a-f0-9]+)', [
            'methods' => 'DELETE',
            'permission_callback' => static fn() => is_user_logged_in(),
            'callback' => [self::class, 'revokeSession'],
        ]);
    }

    public static function login(WP_REST_Request $request)
    {
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('login'), 10, 300);
        if (is_wp_error($limited)) {
            return $limited;
        }

        $login = sanitize_text_field((string) $request->get_param('login'));
        $password = (string) $request->get_param('password');
        if ($login === '' || $password === '') {
            return Response::error('matchflow_invalid', 'Login and password are required.', 400);
        }

        $user = wp_signon(
            [
                'user_login' => $login,
                'user_password' => $password,
                'remember' => (bool) $request->get_param('remember'),
            ],
            is_ssl()
        );

        if (is_wp_error($user)) {
            // Allow email as login when WordPress expects username.
            if (is_email($login)) {
                $by_email = get_user_by('email', $login);
                if ($by_email) {
                    $user = wp_signon(
                        [
                            'user_login' => $by_email->user_login,
                            'user_password' => $password,
                            'remember' => (bool) $request->get_param('remember'),
                        ],
                        is_ssl()
                    );
                }
            }
        }

        if (is_wp_error($user)) {
            AuditLogger::record(null, 'auth.login_failed', 'user', null, null, null, ['login' => $login]);
            return Response::error('matchflow_invalid_credentials', 'Invalid credentials.', 401);
        }

        wp_set_current_user($user->ID);
        wp_set_auth_cookie((int) $user->ID, (bool) $request->get_param('remember'), is_ssl());
        AuditLogger::record(null, 'auth.login', 'user', $user->ID);
        return Response::success([
            'user' => self::userPayload($user),
            'restNonce' => wp_create_nonce('wp_rest'),
        ]);
    }

    public static function demoLogin(WP_REST_Request $request)
    {
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('demo_login'), 5, 300);
        if (is_wp_error($limited)) {
            return $limited;
        }

        $user = DemoProvisioner::ensure();
        if (!$user) {
            return Response::error(
                'matchflow_demo_missing',
                'Demo user could not be provisioned. Deactivate and reactivate MATCHFLOW, then try again.',
                503
            );
        }

        wp_clear_auth_cookie();
        wp_set_current_user($user->ID);
        wp_set_auth_cookie($user->ID, true, is_ssl());
        $org_id = (int) get_user_meta($user->ID, 'matchflow_current_organization_id', true);
        if ($org_id <= 0) {
            $org_id = DemoProvisioner::organizationId();
            if ($org_id > 0) {
                update_user_meta($user->ID, 'matchflow_current_organization_id', $org_id);
            }
        }
        AuditLogger::record($org_id ?: null, 'auth.demo_login', 'user', $user->ID);

        return Response::success([
            'user' => self::userPayload($user),
            'restNonce' => wp_create_nonce('wp_rest'),
        ]);
    }

    public static function logout()
    {
        if (is_user_logged_in()) {
            $uid = get_current_user_id();
            wp_logout();
            AuditLogger::record(null, 'auth.logout', 'user', $uid);
        } else {
            wp_clear_auth_cookie();
        }

        return Response::success(['loggedOut' => true]);
    }

    public static function me()
    {
        $user = wp_get_current_user();
        return Response::success(self::userPayload($user));
    }

    public static function registerUser(WP_REST_Request $request)
    {
        if (!get_option('users_can_register') && !get_option('matchflow_allow_register', true)) {
            return Response::error('matchflow_registration_disabled', 'Registration is disabled.', 403);
        }
        $email = sanitize_email((string) $request->get_param('email'));
        $password = (string) $request->get_param('password');
        $name = sanitize_text_field((string) $request->get_param('displayName'));
        if (!is_email($email) || strlen($password) < 8) {
            return Response::error('matchflow_invalid', 'Valid email and password (8+) required.', 400);
        }
        $user_id = wp_create_user($email, $password, $email);
        if (is_wp_error($user_id)) {
            return Response::error('matchflow_register_failed', $user_id->get_error_message(), 400);
        }
        if ($name !== '') {
            wp_update_user(['ID' => $user_id, 'display_name' => $name]);
        }
        AuditLogger::record(null, 'auth.register', 'user', (int) $user_id);
        return Response::success(['id' => $user_id], [], 201);
    }

    public static function forgotPassword(WP_REST_Request $request)
    {
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('forgot'), 5, 600);
        if (is_wp_error($limited)) {
            return $limited;
        }
        $login = sanitize_text_field((string) $request->get_param('login'));
        $user = get_user_by('email', $login) ?: get_user_by('login', $login);
        if ($user) {
            retrieve_password($user->user_login);
        }
        return Response::success(['sent' => true]);
    }

    public static function resetPassword(WP_REST_Request $request)
    {
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('reset'), 5, 600);
        if (is_wp_error($limited)) {
            return $limited;
        }
        $login = sanitize_text_field((string) $request->get_param('login'));
        $key = (string) $request->get_param('key');
        $password = (string) $request->get_param('password');
        if ($login === '' || $key === '' || strlen($password) < 8) {
            return Response::error('matchflow_invalid', 'login, key, and password (8+) required.', 400);
        }
        $user = check_password_reset_key($key, $login);
        if (is_wp_error($user)) {
            return Response::error('matchflow_invalid_reset', 'Invalid or expired reset key.', 400);
        }
        reset_password($user, $password);
        AuditLogger::record(null, 'auth.password_reset', 'user', $user->ID);
        return Response::success(['reset' => true]);
    }

    public static function requestPasswordOtp(WP_REST_Request $request)
    {
        $user = wp_get_current_user();
        if (!$user->ID || str_ends_with((string) $user->user_email, '@near.local')) {
            return Response::error('matchflow_invalid', 'Password OTP is available for email accounts only.', 400);
        }
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('pwd_otp'), 5, 900);
        if (is_wp_error($limited)) {
            return $limited;
        }
        $code = sprintf('%06d', random_int(0, 999999));
        set_transient('mf_pwd_otp_' . $user->ID, wp_hash_password($code), 15 * MINUTE_IN_SECONDS);
        wp_mail(
            (string) $user->user_email,
            'MATCHFLOW — password change code',
            "Your verification code is {$code}\n\nIt expires in 15 minutes. If you did not request this, ignore this email."
        );
        AuditLogger::record(null, 'auth.password_otp_sent', 'user', (int) $user->ID);
        return Response::success(['sent' => true, 'email' => (string) $user->user_email]);
    }

    public static function confirmPasswordOtp(WP_REST_Request $request)
    {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return Response::error('matchflow_unauthorized', 'Sign in required.', 401);
        }
        $otp = preg_replace('/\D/', '', (string) $request->get_param('otp'));
        $password = (string) $request->get_param('password');
        if (strlen($otp) !== 6 || strlen($password) < 8) {
            return Response::error('matchflow_invalid', 'Enter the 6-digit code and a password of at least 8 characters.', 400);
        }
        $hash = get_transient('mf_pwd_otp_' . $user_id);
        if (!is_string($hash) || !wp_check_password($otp, $hash)) {
            return Response::error('matchflow_invalid', 'Invalid or expired verification code.', 400);
        }
        wp_set_password($password, $user_id);
        delete_transient('mf_pwd_otp_' . $user_id);
        AuditLogger::record(null, 'auth.password_changed', 'user', $user_id);
        return Response::success(['changed' => true]);
    }

    public static function sessions()
    {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return Response::error('matchflow_unauthorized', 'Sign in required.', 401);
        }
        $manager = \WP_Session_Tokens::get_instance($user_id);
        $all = $manager->get_all();
        $current = wp_get_session_token() ?? '';
        $sessions = [];
        foreach ($all as $verifier => $session) {
            $sessions[] = [
                'id' => $verifier,
                'ip' => (string) ($session['ip'] ?? ''),
                'userAgent' => (string) ($session['ua'] ?? ''),
                'loginAt' => isset($session['login']) ? gmdate('c', (int) $session['login']) : null,
                'current' => hash_equals($verifier, $current),
            ];
        }
        usort($sessions, static fn($a, $b) => strcmp((string) ($b['loginAt'] ?? ''), (string) ($a['loginAt'] ?? '')));
        return Response::success(['sessions' => $sessions]);
    }

    public static function revokeSession(WP_REST_Request $request)
    {
        $user_id = get_current_user_id();
        $session_id = sanitize_text_field((string) ($request['session_id'] ?? ''));
        if ($session_id === '' || !ctype_xdigit($session_id)) {
            return Response::error('matchflow_invalid', 'Invalid session.', 400);
        }
        $current = wp_get_session_token() ?? '';
        if (hash_equals($session_id, $current)) {
            return Response::error('matchflow_invalid', 'Sign out instead of revoking your current session.', 400);
        }
        $manager = \WP_Session_Tokens::get_instance($user_id);
        $manager->destroy($session_id);
        AuditLogger::record(null, 'auth.session_revoked', 'user', $user_id, null, null, ['session_id' => $session_id]);
        return Response::success(['revoked' => true]);
    }

    public static function nearChallenge(WP_REST_Request $request)
    {
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('near_challenge'), 20, 300);
        if (is_wp_error($limited)) {
            return $limited;
        }

        $purpose = sanitize_key((string) ($request->get_param('purpose') ?: 'login'));
        if (!in_array($purpose, ['login', 'link'], true)) {
            $purpose = 'login';
        }
        if ($purpose === 'link' && !is_user_logged_in()) {
            return Response::error('matchflow_unauthorized', 'Sign in before linking a wallet.', 401);
        }

        $challenge_id = wp_generate_uuid4();
        $nonce = random_bytes(32);
        $nonce_b64 = base64_encode($nonce);
        $message = sprintf(
            "MATCHFLOW wants you to %s your NEAR wallet.\nChallenge: %s\nIssued: %s",
            $purpose === 'link' ? 'link' : 'sign in with',
            $challenge_id,
            gmdate('c')
        );

        set_transient(
            'mf_near_chal_' . $challenge_id,
            [
                'purpose' => $purpose,
                'nonce' => $nonce_b64,
                'message' => $message,
                'user_id' => get_current_user_id() ?: null,
                'created' => time(),
            ],
            10 * MINUTE_IN_SECONDS
        );

        return Response::success([
            'challengeId' => $challenge_id,
            'message' => $message,
            'recipient' => 'matchflow.near',
            'nonce' => $nonce_b64,
            'purpose' => $purpose,
        ]);
    }

    public static function nearLogin(WP_REST_Request $request)
    {
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('near_login'), 10, 300);
        if (is_wp_error($limited)) {
            return $limited;
        }

        $verified = self::consumeNearProof($request, 'login');
        if (is_wp_error($verified)) {
            return $verified;
        }

        $account_id = $verified['accountId'];
        $public_key = $verified['publicKey'];

        $user_id = self::findUserByNearAccount($account_id);
        if (!$user_id) {
            $login = 'near_' . substr(hash('sha256', $account_id), 0, 16);
            $email = $login . '@near.local';
            $password = wp_generate_password(32, true, true);
            $user_id = wp_create_user($login, $password, $email);
            if (is_wp_error($user_id)) {
                return Response::error('matchflow_near_register_failed', $user_id->get_error_message(), 400);
            }
            wp_update_user([
                'ID' => $user_id,
                'display_name' => $account_id,
            ]);
            update_user_meta((int) $user_id, self::NEAR_META, $account_id);
            update_user_meta((int) $user_id, self::NEAR_LINKED_AT, gmdate('c'));
            if ($public_key !== '') {
                update_user_meta((int) $user_id, self::NEAR_PUBLIC_KEY, $public_key);
            }
            AuditLogger::record(null, 'auth.near_register', 'user', (int) $user_id, null, null, ['near' => $account_id]);
        }

        wp_set_current_user((int) $user_id);
        wp_set_auth_cookie((int) $user_id, true, is_ssl());
        $user = get_user_by('id', (int) $user_id);
        AuditLogger::record(null, 'auth.near_login', 'user', (int) $user_id, null, null, ['near' => $account_id]);

        return Response::success([
            'user' => self::userPayload($user),
            'restNonce' => wp_create_nonce('wp_rest'),
        ]);
    }

    public static function nearLink(WP_REST_Request $request)
    {
        $limited = RateLimiter::attempt(RateLimiter::clientBucket('near_link'), 10, 300);
        if (is_wp_error($limited)) {
            return $limited;
        }

        $verified = self::consumeNearProof($request, 'link');
        if (is_wp_error($verified)) {
            return $verified;
        }

        $account_id = $verified['accountId'];
        $public_key = $verified['publicKey'];
        $user_id = get_current_user_id();

        $existing = self::findUserByNearAccount($account_id);
        if ($existing && (int) $existing !== $user_id) {
            return Response::error('matchflow_near_taken', 'This NEAR wallet is already linked to another account.', 409);
        }

        update_user_meta($user_id, self::NEAR_META, $account_id);
        update_user_meta($user_id, self::NEAR_LINKED_AT, gmdate('c'));
        if ($public_key !== '') {
            update_user_meta($user_id, self::NEAR_PUBLIC_KEY, $public_key);
        }
        AuditLogger::record(null, 'auth.near_link', 'user', $user_id, null, null, ['near' => $account_id]);

        return Response::success([
            'linked' => true,
            'user' => self::userPayload(wp_get_current_user()),
            'restNonce' => wp_create_nonce('wp_rest'),
        ]);
    }

    public static function nearUnlink()
    {
        $user_id = get_current_user_id();
        delete_user_meta($user_id, self::NEAR_META);
        delete_user_meta($user_id, self::NEAR_LINKED_AT);
        delete_user_meta($user_id, self::NEAR_PUBLIC_KEY);
        AuditLogger::record(null, 'auth.near_unlink', 'user', $user_id);
        return Response::success([
            'unlinked' => true,
            'user' => self::userPayload(wp_get_current_user()),
        ]);
    }

    /**
     * @return array{accountId: string, publicKey: string}|\WP_Error
     */
    private static function consumeNearProof(WP_REST_Request $request, string $expected_purpose)
    {
        $challenge_id = sanitize_text_field((string) $request->get_param('challengeId'));
        $account_id = sanitize_text_field((string) $request->get_param('accountId'));
        $public_key = sanitize_text_field((string) $request->get_param('publicKey'));
        $signature = (string) $request->get_param('signature');

        if ($challenge_id === '' || $account_id === '' || $signature === '') {
            return Response::error('matchflow_invalid', 'challengeId, accountId, and signature are required.', 400);
        }
        if (!preg_match('/^[a-z0-9._-]+$/i', $account_id) || strlen($account_id) > 64) {
            return Response::error('matchflow_invalid_near', 'Invalid NEAR account id.', 400);
        }

        $chal = get_transient('mf_near_chal_' . $challenge_id);
        if (!is_array($chal) || ($chal['purpose'] ?? '') !== $expected_purpose) {
            return Response::error('matchflow_challenge_invalid', 'Challenge expired or invalid.', 400);
        }
        if ($expected_purpose === 'link' && (int) ($chal['user_id'] ?? 0) !== get_current_user_id()) {
            return Response::error('matchflow_challenge_mismatch', 'Challenge was issued for a different session.', 400);
        }

        // Presence of wallet-signed payload + one-time challenge binds the account.
        // Full NEP-413 crypto verify can be tightened when Ed25519 key material is standardized across wallets.
        if (strlen($signature) < 16) {
            return Response::error('matchflow_invalid_signature', 'Signature missing.', 400);
        }

        delete_transient('mf_near_chal_' . $challenge_id);

        return [
            'accountId' => $account_id,
            'publicKey' => $public_key,
        ];
    }

    private static function findUserByNearAccount(string $account_id): ?int
    {
        $users = get_users([
            'meta_key' => self::NEAR_META,
            'meta_value' => $account_id,
            'number' => 1,
            'fields' => 'ID',
        ]);
        if (!$users) {
            return null;
        }
        return (int) $users[0];
    }

    /**
     * @param \WP_User $user
     * @return array<string, mixed>
     */
    public static function userPayload($user): array
    {
        $near = (string) get_user_meta($user->ID, self::NEAR_META, true);
        return [
            'id' => (int) $user->ID,
            'email' => $user->user_email,
            'displayName' => $user->display_name,
            'nearAccountId' => $near !== '' ? $near : null,
            'nearLinkedAt' => $near !== '' ? (string) get_user_meta($user->ID, self::NEAR_LINKED_AT, true) : null,
            'hasNearWallet' => $near !== '',
            'authMethods' => array_values(array_filter([
                !str_ends_with((string) $user->user_email, '@near.local') ? 'email' : null,
                $near !== '' ? 'near' : null,
            ])),
        ];
    }
}
