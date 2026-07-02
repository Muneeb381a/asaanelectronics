import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);
const FROM = env.EMAIL_FROM;
if (!FROM) console.warn('[email] WARNING: EMAIL_FROM env var not set — emails will fail. Set it in Vercel to Assaan Electronics <noreply@asaanelectronics.online>');

export async function sendRenewalReminderEmail(opts: {
  to: string;
  ownerName: string;
  shopName: string;
  plan: string;
  expiresAt: Date | null;
  isExpired: boolean;
  daysLeft: number;   // negative = days overdue
}) {
  const { to, ownerName, shopName, plan, expiresAt, isExpired, daysLeft } = opts;

  const isDev = env.NODE_ENV !== 'production';
  if (isDev) {
    console.log(`\n[email] RENEWAL REMINDER → ${to} (${shopName}, ${plan}, isExpired=${isExpired}, daysLeft=${daysLeft})\n`);
  }

  const planLabel: Record<string, string> = {
    TRIAL: 'Free Trial', BASIC: 'Basic (Rs 2,999/mo)',
    PRO: 'Pro (Rs 7,999/mo)', ENTERPRISE: 'Enterprise',
  };

  const expDate = expiresAt
    ? new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(expiresAt))
    : 'N/A';

  const urgencyColor  = isExpired ? '#dc2626' : daysLeft <= 3 ? '#d97706' : '#2563eb';
  const urgencyBg     = isExpired ? '#fef2f2' : daysLeft <= 3 ? '#fffbeb' : '#eff6ff';
  const urgencyBorder = isExpired ? '#fecaca' : daysLeft <= 3 ? '#fde68a' : '#bfdbfe';

  const subject = isExpired
    ? `⚠️ ${shopName} — Assaan Electronics plan expire ho gaya hai`
    : daysLeft <= 3
      ? `🔴 ${shopName} — Sirf ${daysLeft} din bache hain! Plan renew karein`
      : `📅 ${shopName} — Plan ${daysLeft} din mein expire ho raha hai`;

  const statusHeading = isExpired
    ? `Plan expire ho chuka hai — service band ho sakti hai`
    : `Plan ${daysLeft} din${daysLeft === 1 ? '' : ''} mein expire hoga`;

  const statusBody = isExpired
    ? `Aapka <strong>${planLabel[plan] ?? plan}</strong> plan <strong>${Math.abs(daysLeft)} din pehle</strong> expire ho gaya tha (${expDate}). Abhi renew karein taake aapki service continue ho sake.`
    : daysLeft <= 3
      ? `Aapka <strong>${planLabel[plan] ?? plan}</strong> plan sirf <strong>${daysLeft} din mein</strong> expire ho raha hai (${expDate}). Fauran renew karein taake koi interruption na ho.`
      : `Aapka <strong>${planLabel[plan] ?? plan}</strong> plan <strong>${expDate}</strong> ko expire hoga — ${daysLeft} din baad. Apni business continuity ensure karne ke liye renew kar lein.`;

  const html = `<!DOCTYPE html>
<html lang="ur" dir="ltr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:#1d4ed8;padding:20px 32px">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700">Assaan Electronics</p>
          <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px">Subscription Management</p>
        </td></tr>

        <!-- Urgency banner -->
        <tr><td style="background:${urgencyBg};border-bottom:2px solid ${urgencyBorder};padding:14px 32px">
          <p style="margin:0;color:${urgencyColor};font-size:14px;font-weight:700">${statusHeading}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 6px;color:#6b7280;font-size:14px">Assalam o Alaikum <strong style="color:#111827">${ownerName}</strong>,</p>
          <p style="margin:0 0 24px;color:#374151;font-size:14px;line-height:1.7">${statusBody}</p>

          <!-- Shop detail card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:24px">
            <tr><td style="padding:18px 20px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:5px 0">
                    <span style="color:#6b7280;font-size:12px">Shop</span><br>
                    <span style="color:#111827;font-size:14px;font-weight:600">${shopName}</span>
                  </td>
                  <td style="padding:5px 0;text-align:right">
                    <span style="color:#6b7280;font-size:12px">Plan</span><br>
                    <span style="color:#1d4ed8;font-size:14px;font-weight:600">${planLabel[plan] ?? plan}</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top:10px;border-top:1px solid #e5e7eb;margin-top:10px">
                    <span style="color:#6b7280;font-size:12px">Expiry date</span><br>
                    <span style="color:${urgencyColor};font-size:13px;font-weight:600">${expDate}</span>
                    ${isExpired
                      ? `<span style="margin-left:8px;display:inline-block;background:${urgencyBg};border:1px solid ${urgencyBorder};color:${urgencyColor};font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">EXPIRED</span>`
                      : daysLeft <= 3
                        ? `<span style="margin-left:8px;display:inline-block;background:${urgencyBg};border:1px solid ${urgencyBorder};color:${urgencyColor};font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">${daysLeft} DIN BAAD</span>`
                        : `<span style="margin-left:8px;display:inline-block;background:#dbeafe;border:1px solid #bfdbfe;color:#1d4ed8;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">${daysLeft} DAYS LEFT</span>`
                    }
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td align="center">
              <a href="https://asaanelectronics.online/billing"
                style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px">
                Abhi Renew Karein →
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;color:#6b7280;font-size:13px;line-height:1.6">Koi sawal ho toh apne admin se rabta karein. Hum aapki madad ke liye hamesha haazir hain.</p>
          <p style="margin:0;color:#9ca3af;font-size:13px">Shukriya,<br><strong style="color:#374151">Assaan Electronics Team</strong></p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
            Yeh ek automated reminder hai. Please reply mat karein.<br>
            &copy; ${new Date().getFullYear()} Assaan Electronics. All rights reserved.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Assaan Electronics — Plan Renewal Reminder

Assalam o Alaikum ${ownerName},

${statusHeading}

Shop: ${shopName}
Plan: ${planLabel[plan] ?? plan}
Expiry: ${expDate}

${isExpired ? `Aapka plan ${Math.abs(daysLeft)} din pehle expire ho gaya. Fauran renew karein.` : `Aapka plan ${daysLeft} din mein expire ho raha hai.`}

Renew karne ke liye visit karein: https://asaanelectronics.online/billing

© ${new Date().getFullYear()} Assaan Electronics`;

  if (!FROM) throw new Error('EMAIL_FROM env var is not set');

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
    headers: { 'X-Entity-Ref-ID': `renewal-reminder-${Date.now()}` },
  });

  if (error) {
    console.error('[email] Resend error:', error);
    throw new Error(`Failed to send renewal reminder: ${error.message}`);
  }
}

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
