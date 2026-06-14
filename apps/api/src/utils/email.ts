import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);
const FROM = env.EMAIL_FROM;
if (!FROM) console.warn('[email] WARNING: EMAIL_FROM env var not set — emails will fail. Set it in Vercel to Assaan Electronics <noreply@asaanelectronics.online>');

export async function sendOtpEmail(to: string, name: string, code: string, purpose: 'LOGIN' | 'PASSWORD_RESET') {
  const isReset   = purpose === 'PASSWORD_RESET';
  const action    = isReset ? 'password reset' : 'sign-in';
  const subject   = `${code} is your Assaan Electronics verification code`;
  const heading   = isReset ? 'Reset your password' : 'Verify your sign-in';
  const bodyText  = isReset
    ? `We received a request to reset the password for your Assaan Electronics account.`
    : `We received a sign-in request for your Assaan Electronics account.`;

  const isDev = env.NODE_ENV !== 'production';
  if (isDev) {
    console.log(`\n┌─────────────────────────────┐`);
    console.log(`│  OTP for ${to.padEnd(19)} │`);
    console.log(`│  Code: ${code}                 │`);
    console.log(`│  Purpose: ${purpose.padEnd(18)} │`);
    console.log(`└─────────────────────────────┘\n`);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

        <!-- Header bar -->
        <tr><td style="background:#1d4ed8;padding:20px 32px">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700">Assaan Electronics</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;color:#111827;font-size:16px;font-weight:600">${heading}</p>
          <p style="margin:0 0 8px;color:#6b7280;font-size:14px">Hi ${name},</p>
          <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.6">${bodyText} Use the verification code below to complete your ${action}. This code is valid for <strong>10 minutes</strong>.</p>

          <!-- Code box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td align="center" style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:10px;padding:24px">
              <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#1d4ed8;font-family:monospace">${code}</span>
            </td></tr>
          </table>

          <p style="margin:0 0 16px;color:#374151;font-size:13px;line-height:1.6">For your security, never share this code with anyone. Assaan Electronics will never ask for your verification code.</p>
          <p style="margin:0;color:#6b7280;font-size:13px">If you did not request this code, you can safely ignore this email — no action is needed.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
            This is an automated message from Assaan Electronics. Please do not reply to this email.<br>
            &copy; ${new Date().getFullYear()} Assaan Electronics. All rights reserved.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Assaan Electronics — Verification Code

Hi ${name},

${bodyText}

Your verification code: ${code}

This code expires in 10 minutes.

For your security, never share this code with anyone.
If you did not request this, ignore this email.

© ${new Date().getFullYear()} Assaan Electronics`;

  if (!FROM) throw new Error('EMAIL_FROM env var is not set. Add it in Vercel: Assaan Electronics <noreply@asaanelectronics.online>');

  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject,
    html,
    text,
    headers: {
      'X-Entity-Ref-ID': `${purpose.toLowerCase()}-${Date.now()}`,
    },
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
