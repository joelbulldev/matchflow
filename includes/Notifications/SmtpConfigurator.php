<?php
/**
 * Optional SMTP for transactional mail (wp_mail).
 *
 * @package Matchflow
 */

declare(strict_types=1);

namespace Matchflow\Notifications;

defined('ABSPATH') || exit;

final class SmtpConfigurator
{
    public static function register(): void
    {
        add_action('phpmailer_init', [self::class, 'configure']);
        add_filter('wp_mail_from', [self::class, 'fromAddress']);
        add_filter('wp_mail_from_name', [self::class, 'fromName']);
    }

    public static function configure(\PHPMailer\PHPMailer\PHPMailer $mailer): void
    {
        $host = (string) get_option('matchflow_smtp_host', '');
        if ($host === '') {
            return;
        }
        $mailer->isSMTP();
        $mailer->Host = $host;
        $mailer->Port = (int) get_option('matchflow_smtp_port', 587);
        $mailer->SMTPAuth = (bool) get_option('matchflow_smtp_auth', true);
        $user = (string) get_option('matchflow_smtp_user', '');
        $pass = (string) get_option('matchflow_smtp_password', '');
        if ($user !== '') {
            $mailer->Username = $user;
        }
        if ($pass !== '') {
            $mailer->Password = $pass;
        }
        $enc = (string) get_option('matchflow_smtp_encryption', 'tls');
        if ($enc === 'ssl') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($enc === 'tls') {
            $mailer->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mailer->SMTPSecure = '';
            $mailer->SMTPAutoTLS = false;
        }
    }

    public static function fromAddress(string $email): string
    {
        $from = (string) get_option('matchflow_mail_from', '');
        return is_email($from) ? $from : $email;
    }

    public static function fromName(string $name): string
    {
        $custom = (string) get_option('matchflow_mail_from_name', '');
        return $custom !== '' ? $custom : $name;
    }
}
