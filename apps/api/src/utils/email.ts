import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);
const FROM = env.EMAIL_FROM ?? 'Assaan Electronics <onboarding@resend.dev>';

export async function sendOtpEmail(to: string, name: string, code: string, purpose: 'LOGIN' | 'PASSWORD_RESET') {
  const subject = purpose === 'LOGIN' ? 'Your login code' : 'Reset your password';
  const heading = purpose === 'LOGIN' ? 'Login Verification' : 'Password Reset';
  const body    = purpose === 'LOGIN'
    ? `Use the code below to complete your login. It expires in 10 minutes.`
    : `Use the code below to reset your password. It expires in 10 minutes.`;

  const isDev = process.env['NODE_ENV'] !== 'production';

  if (isDev) {
    console.log(`\n┌─────────────────────────────┐`);
    console.log(`│  OTP for ${to.padEnd(19)} │`);
    console.log(`│  Code: ${code}                 │`);
    console.log(`│  Purpose: ${purpose.padEnd(18)} │`);
    console.log(`└─────────────────────────────┘\n`);
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `${code} — ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9fafb;border-radius:12px">
        <h2 style="margin:0 0 4px;color:#1f2937;font-size:20px">${heading}</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:14px">Hi ${name},</p>
        <p style="margin:0 0 24px;color:#374151;font-size:14px">${body}</p>
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1d4ed8">${code}</span>
        </div>
        <p style="margin:0;color:#9ca3af;font-size:12px">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
