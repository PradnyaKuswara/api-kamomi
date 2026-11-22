import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export interface Mailer {
  sendHtml(to: string, subject: string, html: string): Promise<void>;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function createMailer(env: Env, log: { info: (m: string) => void; error: (o: unknown, m: string) => void }): Mailer {
  let transport: Transporter | null = null;
  const get = () =>
    (transport ??= nodemailer.createTransport({
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: false,
      requireTLS: true, // starttls.enable=true
      auth: env.MAIL_USERNAME ? { user: env.MAIL_USERNAME, pass: env.MAIL_PASSWORD } : undefined,
    }));

  return {
    // Fire-and-forget seperti @Async: kegagalan hanya dicatat, tidak menggagalkan request.
    async sendHtml(to, subject, html) {
      get()
        .sendMail({ from: env.MAIL_FROM, to, subject, html })
        .then(() => log.info(`HTML Email sent successfully to ${to}`))
        .catch((err: unknown) => log.error({ err }, `Failed to send HTML email to ${to}`));
    },
  };
}

export function resetPasswordEmail(name: string | null, token: string): { subject: string; html: string } {
  return {
    subject: 'Reset Password - Kamomi',
    html: `<!DOCTYPE html><html><head><style>
body { font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
.container { max-width: 600px; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin: auto; }
.header { font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 10px; }
.content { font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 25px; }
.token-box { background: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 20px; font-weight: bold; text-align: center; letter-spacing: 2px; color: #2563eb; margin: 20px 0; }
.footer { font-size: 12px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
</style></head><body><div class='container'>
<div class='header'>Reset Password Request</div>
<div class='content'>
<p>Halo <strong>${esc(name ?? 'Pengguna')}</strong>,</p>
<p>Kami menerima permintaan untuk mereset password akun Anda di <strong>Kamomi App</strong>.</p>
<p>Gunakan kode reset password berikut untuk melanjutkan:</p>
<div class='token-box'>${esc(token)}</div>
<p>Kode ini berlaku selama 15 menit. Jika Anda tidak meminta permintaan reset password ini, abaikan email ini.</p>
</div>
<div class='footer'>&copy; 2026 Kamomi Application. All rights reserved.</div>
</div></body></html>`,
  };
}
