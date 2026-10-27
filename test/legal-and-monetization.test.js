const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const {
  app,
  repository,
  registerUser,
  generateToken,
  getTermsOfService,
  getPrivacyPolicy,
  getDmcaPolicy,
  sanitizeDmcaNotice,
  TIERS
} = require('../server.js');

function dispatch(options) {
  return new Promise((resolve) => {
    const method = (options.method || 'GET').toUpperCase();
    const url = options.url || '/';
    const headers = { ...(options.headers || {}) };
    const rawBody = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : '';
    if (rawBody && !headers['content-type']) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(rawBody);
    }

    const socket = new net.Socket();
    const ip = options.ip || '192.168.1.80';
    Object.defineProperty(socket, 'remoteAddress', { value: ip, configurable: true });

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = headers;

    const res = new http.ServerResponse(req);
    const chunks = [];

    const origWrite = res.write.bind(res);
    res.write = (chunk, ...args) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return origWrite(chunk, ...args);
    };

    const origEnd = res.end.bind(res);
    res.end = (chunk, ...args) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      origEnd(chunk, ...args);
      const buffer = Buffer.concat(chunks);
      const bodyText = buffer.toString('utf8');
      let bodyJson = null;
      try { bodyJson = JSON.parse(bodyText); } catch (_) {}
      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        body: bodyJson || bodyText,
        rawBuffer: buffer
      });
    };

    app(req, res);
    if (rawBody) {
      req.push(rawBody);
    }
    req.push(null);
  });
}

// Generate valid admin cookie for testing admin moderation endpoints
function createAdminCookie() {
  const adminSecret = process.env.KODA_SESSION_SECRET || 'a8f9c1b3e7d246098123456789abcdef0123456789abcdef0123456789abcdef';
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', adminSecret).update(`${expires}.${nonce}`).digest('base64url');
  return `koda_admin_session=${expires}.${nonce}.${signature}`;
}

describe('PHASE 5: Legal, Compliance & DMCA Protection Tests', () => {
  describe('1. Terms of Service, Privacy Policy & DMCA Documents', () => {
    it('returns Terms of Service document with broadcast warranties and user indemnity', async () => {
      const terms = getTermsOfService();
      assert.ok(terms.title.includes('Terms of Service'));
      assert.ok(terms.sections.some((s) => (s.heading + ' ' + s.body).includes('represent and warrant')));
      assert.ok(terms.sections.some((s) => (s.heading + ' ' + s.body).includes('Indemnification')));

      const res = await dispatch({
        method: 'GET',
        url: '/terms',
        headers: { accept: 'application/json' }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'Terms of Service');
    });

    it('returns Privacy Policy document with cookie, OAuth, and GDPR disclosures', async () => {
      const privacy = getPrivacyPolicy();
      assert.ok(privacy.title.includes('Privacy Policy'));
      assert.ok(privacy.sections.some((s) => (s.heading + ' ' + s.body).includes('Cookies & Local Storage')));
      assert.ok(privacy.sections.some((s) => (s.heading + ' ' + s.body).includes('GDPR and CCPA')));

      const res = await dispatch({
        method: 'GET',
        url: '/privacy',
        headers: { accept: 'application/json' }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.title, 'Privacy Policy');
    });

    it('returns DMCA policy with designated agent email and 512(c)(3) notice criteria', async () => {
      const dmca = getDmcaPolicy();
      assert.ok(dmca.agentEmail.includes('@'));
      assert.ok(dmca.instructions.some((i) => i.includes('Identification of the copyrighted work')));
      assert.ok(dmca.instructions.some((i) => i.includes('penalty of perjury')));

      const res = await dispatch({
        method: 'GET',
        url: '/dmca',
        headers: { accept: 'application/json' }
      });
      assert.equal(res.status, 200);
      assert.ok(res.body.agentEmail);
    });
  });

  describe('2. DMCA Notice Submission & Input Sanitization', () => {
    it('validates and sanitizes DMCA notice fields, stripping malicious scripts', () => {
      const dirty = {
        claimantName: 'John Doe <script>alert("hacked")</script>',
        claimantEmail: 'john@records.com',
        copyrightWork: 'Master Recording <b>Track 1</b>',
        infringingUrl: 'https://koda.fm/catalog/track_99',
        signature: 'John Doe <iframe src="evil.com"></iframe>',
        goodFaithConfirmed: true
      };

      const clean = sanitizeDmcaNotice(dirty);
      assert.equal(clean.claimantName, 'John Doe');
      assert.equal(clean.signature, 'John Doe');
      assert.equal(clean.goodFaithConfirmed, true);
    });

    it('rejects DMCA submission if good-faith confirmation is absent', () => {
      assert.throws(() => {
        sanitizeDmcaNotice({
          claimantName: 'Alice',
          claimantEmail: 'alice@music.com',
          copyrightWork: 'Song A',
          infringingUrl: 'https://koda.fm/1',
          signature: 'Alice',
          goodFaithConfirmed: false
        });
      }, /Good-faith confirmation/);
    });

    it('accepts public DMCA notice via /api/dmca/takedown and stores in repository', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/dmca/takedown',
        body: {
          claimantName: 'Sony Copyright Rep',
          claimantEmail: 'dmca-agent@sony-records-mock.com',
          copyrightWork: 'Acoustic Sunrise (ISRC US-S1Z-26-00001)',
          infringingUrl: 'https://koda.fm/catalog/catalog_123',
          signature: 'Jane Smith, Esq.',
          goodFaithConfirmed: true
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.noticeId);
    });
  });

  describe('3. Admin Moderation Tools (1-Click Takedowns & Purges)', () => {
    it('blocks non-admin access to moderation endpoints (401)', async () => {
      const res = await dispatch({
        method: 'GET',
        url: '/api/admin/moderation'
      });
      assert.equal(res.status, 401);
    });

    it('allows admin to list moderation overview (notices, flagged tracks, active rooms)', async () => {
      const adminCookie = createAdminCookie();
      const res = await dispatch({
        method: 'GET',
        url: '/api/admin/moderation',
        headers: { cookie: adminCookie }
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.dmcaNotices));
      assert.ok(Array.isArray(res.body.rooms));
    });

    it('performs 1-click takedown of an infringing track and removes from public streaming', async () => {
      // Add track to catalog
      const testTrack = {
        id: `catalog_infringing_${Date.now()}`,
        title: 'Infringing Upload Track',
        artist: 'Bootleg Artist',
        streamUrl: '/uploads/bootleg.mp3',
        licenseName: 'Authorized streaming only'
      };
      await repository.addCatalogUpload(testTrack);

      const adminCookie = createAdminCookie();
      const res = await dispatch({
        method: 'POST',
        url: '/api/admin/moderation/takedown',
        headers: { cookie: adminCookie },
        body: {
          trackId: testTrack.id,
          reason: 'DMCA Takedown Notice received'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.track.isFlagged, true);

      // Verify track is excluded from public catalog tracks
      const catalogRes = await dispatch({ method: 'GET', url: '/api/tracks' });
      const publicIds = (catalogRes.body.tracks || []).map((t) => t.id);
      assert.ok(!publicIds.includes(testTrack.id), 'Flagged track must not appear in public streaming');
    });

    it('performs 1-click room purge via /api/admin/moderation/rooms/:id', async () => {
      const room = await repository.createRoom({
        name: 'Spam Room To Purge',
        vibe: 'Spam',
        host: { id: 'u_spam', name: 'Spammer' }
      });

      const adminCookie = createAdminCookie();
      const res = await dispatch({
        method: 'DELETE',
        url: `/api/admin/moderation/rooms/${room.id}`,
        headers: { cookie: adminCookie }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      // Verify room is deleted
      const retrieved = await repository.getRoom(room.id);
      assert.equal(retrieved, undefined);
    });
  });
});

describe('PHASE 6: Monetization & Commercial Packaging Tests', () => {
  describe('1. Subscription Tiers & Checkout Session Generation', () => {
    it('returns subscription tiers with feature limits (free, plus, pro)', async () => {
      const res = await dispatch({
        method: 'GET',
        url: '/api/billing/tiers'
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.tiers.free);
      assert.ok(res.body.tiers.plus);
      assert.ok(res.body.tiers.pro);
      assert.equal(res.body.tiers.pro.priceMonthly, 9.99);
      assert.equal(res.body.tiers.pro.losslessStreaming, true);
    });

    it('rejects checkout session creation for anonymous/guest users (401)', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/billing/create-checkout-session',
        body: { tier: 'pro' }
      });
      assert.equal(res.status, 401);
    });

    it('creates Stripe checkout session for registered user', async () => {
      const user = await registerUser({
        name: 'Artist Jane',
        email: `jane_${Date.now()}@koda.fm`,
        password: 'Password123!'
      });
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      const res = await dispatch({
        method: 'POST',
        url: '/api/billing/create-checkout-session',
        headers: { cookie: `koda_user_session=${token}` },
        body: { tier: 'pro' }
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.sessionId);
      assert.ok(res.body.url);
      assert.equal(res.body.tier.id, 'pro');
    });

    it('handles checkout.session.completed webhook and activates Pro subscription', async () => {
      const user = await registerUser({
        name: 'Subscriber Bob',
        email: `bob_${Date.now()}@koda.fm`,
        password: 'Password123!'
      });

      const webhookPayload = {
        id: `evt_${Date.now()}`,
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: user.id,
            metadata: {
              userId: user.id,
              tier: 'pro'
            }
          }
        }
      };

      const res = await dispatch({
        method: 'POST',
        url: '/api/billing/webhook',
        body: webhookPayload
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.handled, true);
      assert.equal(res.body.userId, user.id);
      assert.equal(res.body.tier, 'pro');
    });
  });

  describe('2. Virtual Creator Room Tipping', () => {
    it('records creator room tip and returns receipt', async () => {
      const room = await repository.createRoom({
        name: 'Vibe Lounge',
        vibe: 'Lo-Fi Chill',
        host: { id: 'u_producer', name: 'DJ Chill' }
      });

      const res = await dispatch({
        method: 'POST',
        url: `/api/rooms/${room.id}/tip`,
        body: {
          amountCents: 500, // $5.00
          senderName: 'Top Supporter',
          message: 'Incredible track selection!'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.tip.amountCents, 500);
      assert.equal(res.body.tip.senderName, 'Top Supporter');
    });

    it('rejects invalid tip amounts (<= 0 or non-numeric)', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/rooms/any_room/tip',
        body: { amountCents: -50 }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('Valid tip amount'));
    });
  });

  describe('3. Commercial Packaging & Deployment Files Validation', () => {
    it('verifies Dockerfile exists and includes multi-stage node configuration', () => {
      const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
      assert.ok(fs.existsSync(dockerfilePath));
      const content = fs.readFileSync(dockerfilePath, 'utf8');
      assert.ok(content.includes('FROM node:'));
      assert.ok(content.includes('prisma generate'));
      assert.ok(content.includes('USER node'));
    });

    it('verifies docker-compose.yml defines app and postgres services with healthchecks', () => {
      const composePath = path.join(__dirname, '..', 'docker-compose.yml');
      assert.ok(fs.existsSync(composePath));
      const content = fs.readFileSync(composePath, 'utf8');
      assert.ok(content.includes('postgres:16-alpine'));
      assert.ok(content.includes('DATABASE_URL'));
      assert.ok(content.includes('healthcheck'));
    });

    it('verifies railway.json, vercel.json, and render.yaml deployment descriptors exist', () => {
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'railway.json')));
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'vercel.json')));
      assert.ok(fs.existsSync(path.join(__dirname, '..', 'render.yaml')));
    });

    it('verifies SETUP_GUIDE.md provides comprehensive installation documentation', () => {
      const setupPath = path.join(__dirname, '..', 'SETUP_GUIDE.md');
      assert.ok(fs.existsSync(setupPath));
      const content = fs.readFileSync(setupPath, 'utf8');
      assert.ok(content.includes('System Architecture'));
      assert.ok(content.includes('1-Click Docker Deployment'));
      assert.ok(content.includes('Cloudflare R2'));
      assert.ok(content.includes('Legal, Compliance & DMCA'));
      assert.ok(content.includes('Monetization & Stripe Integration'));
    });
  });
});
