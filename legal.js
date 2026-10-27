const sanitizeHtml = require('sanitize-html');

const DMCA_AGENT_EMAIL = process.env.DMCA_AGENT_EMAIL || 'dmca@koda.fm';
const DMCA_AGENT_NAME = process.env.DMCA_AGENT_NAME || 'KODA Copyright Compliance Agent';
const COMPANY_NAME = process.env.COMPANY_NAME || 'KODA Studio Inc.';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'support@koda.fm';

function getTermsOfService() {
  return {
    title: 'Terms of Service',
    effectiveDate: 'October 2026',
    sections: [
      {
        heading: '1. User Content & Broadcast Warranties',
        body: 'Users retain ownership of any original audio and media they contribute. By uploading, streaming, or broadcasting content on KODA, you represent and warrant that: (a) you are the sole creator and copyright owner, or (b) you possess all requisite licenses, express permissions, or Creative Commons authorizations to transmit and stream the content.'
      },
      {
        heading: '2. Prohibited Content & Infringement',
        body: 'You may not upload, transmit, or perform any audio recordings, musical compositions, artwork, or lyrics that infringe upon the intellectual property, copyright, trademark, or publicity rights of any third party. KODA strictly prohibits the unauthorized distribution of commercially licensed or copyrighted recordings.'
      },
      {
        heading: '3. Platform Moderation & Takedown Rights',
        body: 'KODA reserves the right, at its sole discretion, to remove, flag, unpublish, or disable access to any room, collaborative playlist tape, chat message, or uploaded audio track that violates these Terms or is subject to a copyright complaint, without prior notice.'
      },
      {
        heading: '4. Indemnification',
        body: 'You agree to defend, indemnify, and hold harmless KODA, its operators, officers, and affiliates from and against any third-party claims, liabilities, damages, or costs (including attorneys fees) arising from content you upload or transmit through the service.'
      },
      {
        heading: '5. Account Termination & Repeat Infringers',
        body: 'In accordance with the DMCA and other applicable law, KODA has adopted a policy of terminating, in appropriate circumstances and at our sole discretion, the accounts of users who are deemed to be repeat copyright infringers.'
      }
    ]
  };
}

function getPrivacyPolicy() {
  return {
    title: 'Privacy Policy',
    effectiveDate: 'October 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect information you provide directly to us: your email address, display name, handle, and avatar when registering via email or Google OAuth 2.0. For anonymous guests, temporary session tokens are generated locally.'
      },
      {
        heading: '2. Cookies & Local Storage',
        body: 'KODA uses secure, HTTP-only, SameSite cookies (koda_user_session, koda_admin_session) strictly for authentication and session integrity. We use client-side local storage to preserve your theme preference, audio volume, and saved shelf tracks.'
      },
      {
        heading: '3. Google OAuth & Identity Data',
        body: 'When you authenticate with Google, we request access only to your basic profile (name, profile picture) and email address. We do not access contacts, drives, or personal files.'
      },
      {
        heading: '4. Cloudflare CDN & Audio Streaming',
        body: 'Audio assets are delivered via Cloudflare R2 and global edge caching nodes. Request IP addresses and standard HTTP byte-range request headers are processed at edge locations for low-latency audio delivery.'
      },
      {
        heading: '5. Your Rights & Data Deletion',
        body: `Under GDPR and CCPA, you have the right to inspect, export, or request immediate deletion of your personal account, playlists, and uploaded media. To request data deletion, contact us at ${CONTACT_EMAIL}.`
      }
    ]
  };
}

function getDmcaPolicy() {
  return {
    title: 'Digital Millennium Copyright Act (DMCA) Notice & Takedown Policy',
    agentName: DMCA_AGENT_NAME,
    agentEmail: DMCA_AGENT_EMAIL,
    instructions: [
      'Identification of the copyrighted work claimed to have been infringed.',
      'Identification of the allegedly infringing material on KODA (URL, room link, or catalog track ID).',
      'Contact information: your full legal name, mailing address, telephone number, and email address.',
      'A statement that you have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.',
      'A statement under penalty of perjury that the information in the notification is accurate and that you are authorized to act on behalf of the copyright owner.',
      'A physical or electronic digital signature of the copyright owner or authorized representative.'
    ]
  };
}

function sanitizeDmcaNotice(input = {}) {
  const clean = (val, max = 255) => sanitizeHtml(String(val || '').trim(), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, max);

  const claimantName = clean(input.claimantName, 120);
  const claimantEmail = clean(input.claimantEmail, 120);
  const copyrightWork = clean(input.copyrightWork, 500);
  const infringingUrl = clean(input.infringingUrl, 500);
  const trackId = clean(input.trackId, 100);
  const signature = clean(input.signature, 120);
  const goodFaithConfirmed = Boolean(input.goodFaithConfirmed === true || input.goodFaithConfirmed === 'true');

  if (!claimantName) throw new Error('Claimant legal name is required.');
  if (!claimantEmail || !claimantEmail.includes('@')) throw new Error('Valid claimant email address is required.');
  if (!copyrightWork) throw new Error('Description of copyrighted work is required.');
  if (!infringingUrl && !trackId) throw new Error('Infringing track URL or track ID is required.');
  if (!signature) throw new Error('Digital electronic signature is required.');
  if (!goodFaithConfirmed) throw new Error('Good-faith confirmation statement is required.');

  return {
    claimantName,
    claimantEmail,
    copyrightWork,
    infringingUrl: infringingUrl || (trackId ? `/catalog/${trackId}` : ''),
    trackId: trackId || null,
    signature,
    goodFaithConfirmed
  };
}

function renderLegalHtml(doc) {
  const sectionsHtml = (doc.sections || []).map((s) => `
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #ff683b;">${s.heading}</h3>
      <p style="font-size: 14px; line-height: 1.7; color: #d0d0d5;">${s.body}</p>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.title} — KODA Studio</title>
  <style>
    body {
      background: #0d0d0e;
      color: #ececed;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
    }
    .container {
      max-width: 780px;
      width: 100%;
      background: #141416;
      border: 1px solid #232328;
      border-radius: 14px;
      padding: 36px 40px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-top: 0;
      margin-bottom: 6px;
      color: #fff;
    }
    .meta {
      font-size: 13px;
      color: #7b7b85;
      margin-bottom: 30px;
      border-bottom: 1px solid #222226;
      padding-bottom: 16px;
    }
    a { color: #ff683b; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .back-btn {
      display: inline-block;
      margin-top: 24px;
      padding: 10px 18px;
      background: #ff683b;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${doc.title}</h1>
    <div class="meta">Effective: ${doc.effectiveDate || '2026'} · Platform: KODA Studio</div>
    ${sectionsHtml}
    <a href="/" class="back-btn">← Return to KODA Studio</a>
  </div>
</body>
</html>`;
}

module.exports = {
  getTermsOfService,
  getPrivacyPolicy,
  getDmcaPolicy,
  sanitizeDmcaNotice,
  renderLegalHtml,
  DMCA_AGENT_EMAIL,
  DMCA_AGENT_NAME
};
