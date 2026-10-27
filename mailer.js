const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'KODA Studio <noreply@koda.fm>';
const SUPPORT_EMAIL = process.env.CONTACT_EMAIL || 'support@koda.fm';

const isResendConfigured = Boolean(
  RESEND_API_KEY &&
  !RESEND_API_KEY.startsWith('replace') &&
  RESEND_API_KEY.startsWith('re_')
);

/**
 * Dispatch an email via Resend HTTP API (Zero extra dependencies)
 */
function sendViaResend({ to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    });

    const req = https.request(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (_) {
              resolve({ ok: true });
            }
          } else {
            reject(new Error(`Resend API error (${res.statusCode}): ${body}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send Password Reset Email
 */
async function sendPasswordResetEmail({ to, resetUrl, name = 'Listener' }) {
  const subject = 'Reset your KODA Studio password';
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#0d0d0e;color:#ececed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 20px;">
      <div style="max-width:540px;margin:0 auto;background:#141416;border:1px solid #232328;border-radius:12px;padding:32px 36px;">
        <h2 style="color:#fff;margin-top:0;">Reset Your Password</h2>
        <p style="font-size:14px;line-height:1.6;color:#c0c0c8;">Hello ${name},</p>
        <p style="font-size:14px;line-height:1.6;color:#c0c0c8;">We received a request to reset your password for your KODA Studio account. Click the button below to choose a new password:</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}" style="background:#ff683b;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;display:inline-block;">Reset Password</a>
        </div>
        <p style="font-size:12px;line-height:1.6;color:#70707a;">This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #222226;margin:24px 0;" />
        <p style="font-size:11px;color:#555560;">KODA Studio · Open-Music Listening Platform · <a href="mailto:${SUPPORT_EMAIL}" style="color:#ff683b;">${SUPPORT_EMAIL}</a></p>
      </div>
    </body>
    </html>
  `;
  const text = `Hello ${name},\n\nWe received a request to reset your KODA Studio password. Use the link below to set a new password:\n\n${resetUrl}\n\nThis link is valid for 1 hour.\n\nKODA Studio`;

  if (isResendConfigured) {
    try {
      const res = await sendViaResend({ to, subject, html, text });
      return { delivered: true, provider: 'resend', id: res.id };
    } catch (err) {
      console.warn('[Mailer] Resend dispatch failed, logging fallback link:', err.message);
    }
  }

  // Fallback for development & staging
  console.log(`[Mailer:Mock] Password reset email queued for ${to}. Reset link: ${resetUrl}`);
  return { delivered: false, mock: true, resetUrl };
}

/**
 * Send Welcome Email to Newly Registered Users
 */
async function sendWelcomeEmail({ to, name = 'Listener' }) {
  const subject = 'Welcome to KODA Studio // Open-Music Listening';
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background:#0d0d0e;color:#ececed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px 20px;">
      <div style="max-width:540px;margin:0 auto;background:#141416;border:1px solid #232328;border-radius:12px;padding:32px 36px;">
        <h2 style="color:#ff683b;margin-top:0;">Welcome to KODA, ${name}!</h2>
        <p style="font-size:14px;line-height:1.6;color:#c0c0c8;">Your creator account is active. Here is what you can do right now:</p>
        <ul style="font-size:14px;line-height:1.8;color:#c0c0c8;padding-left:20px;">
          <li><b>Host Live Listening Rooms</b>: Broadcast open-license tracks with real-time synchronized playback.</li>
          <li><b>Build Collaborative Tapes</b>: Create shared playlists and curate with your crew.</li>
          <li><b>Upload Audio</b>: Store your original music in the vault with zero-egress Cloudflare R2 streaming.</li>
        </ul>
        <div style="text-align:center;margin:32px 0;">
          <a href="http://localhost:3000" style="background:#ff683b;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;display:inline-block;">Enter Studio</a>
        </div>
      </div>
    </body>
    </html>
  `;
  const text = `Welcome to KODA, ${name}!\n\nYour creator account is ready. Host live listening rooms, curate collaborative tapes, and share open music.\n\nKODA Studio`;

  if (isResendConfigured) {
    try {
      const res = await sendViaResend({ to, subject, html, text });
      return { delivered: true, provider: 'resend', id: res.id };
    } catch (_) {}
  }

  return { delivered: false, mock: true };
}

module.exports = {
  isResendConfigured: () => isResendConfigured,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
