const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const net = require('net');
const {
  app,
  generateToken,
  verifyToken,
  registerUser,
  revokeUserTokens,
  publishClusterMessage,
  subscribeClusterMessage,
  createConnectAccountLink,
  TIERS
} = require('../server.js');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../mailer.js');

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
    const ip = options.ip || '192.168.1.99';
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

describe('ADDITIONAL HARDENING: Flaw Remediation & Scaling Tests', () => {
  describe('1. Multi-Node Cluster Scaling & Redis Pub/Sub', () => {
    it('publishes and receives cluster-wide broadcast messages through pub/sub bus', async () => {
      const receivedMessages = [];
      const unsubscribe = subscribeClusterMessage('test_channel', (payload) => {
        receivedMessages.push(payload);
      });

      await publishClusterMessage('test_channel', { room: 'ambient-lounge', event: 'track_change' });

      // Allow brief async event dispatch
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(receivedMessages.length, 1);
      assert.equal(receivedMessages[0].room, 'ambient-lounge');

      unsubscribe();
    });
  });

  describe('2. Stateful JWT Revocation & Logout All Devices', () => {
    it('revoking user tokens invalidates previously issued JWT tokens', async () => {
      const user = { id: `u_revocation_${Date.now()}`, name: 'Alice Revoke', role: 'LISTENER' };
      const tokenBefore = generateToken(user, false);

      // Verify token is initially valid
      const verifiedInitial = verifyToken(tokenBefore);
      assert.ok(verifiedInitial);
      assert.equal(verifiedInitial.id, user.id);

      // Invalidate all tokens for this user
      revokeUserTokens(user.id);

      // Previously issued token must now be rejected
      const verifiedAfter = verifyToken(tokenBefore);
      assert.equal(verifiedAfter, null, 'Revoked token must fail verification');

      // Newly generated token must be accepted
      const tokenAfter = generateToken(user, false);
      const verifiedNew = verifyToken(tokenAfter);
      assert.ok(verifiedNew);
      assert.equal(verifiedNew.id, user.id);
    });

    it('/api/auth/logout-all revokes user sessions across all devices', async () => {
      const reg = await registerUser({
        name: 'Device User',
        email: `device_${Date.now()}@koda.fm`,
        password: 'Password123!'
      });
      const user = reg.user;
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/logout-all',
        headers: { cookie: `koda_user_session=${token}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);

      // Token must now be rejected
      const verified = verifyToken(token);
      assert.equal(verified, null);
    });
  });

  describe('3. Stripe Connect Creator Onboarding & Tip Disbursements', () => {
    it('generates Stripe Connect onboarding link for creator payouts', async () => {
      const link = await createConnectAccountLink({
        userId: 'u_creator_42',
        userEmail: 'dj@koda.fm'
      });

      assert.ok(link.accountId);
      assert.ok(link.url);
    });

    it('/api/creator/connect-link generates connect onboarding link for authenticated creator', async () => {
      const user = await registerUser({
        name: 'Host Alex',
        email: `alex_host_${Date.now()}@koda.fm`,
        password: 'Password123!'
      });
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      const res = await dispatch({
        method: 'POST',
        url: '/api/creator/connect-link',
        headers: { cookie: `koda_user_session=${token}` }
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.url);
    });

    it('calculates 85/15 creator payout split on room tips', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/rooms/test-room-payout/tip',
        body: {
          amountCents: 1000, // $10.00
          senderName: 'Generous Fan',
          message: 'Love the selection!'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.tip.amountCents, 1000);
      assert.equal(res.body.tip.creatorPayoutCents, 850); // $8.50 to host
      assert.equal(res.body.tip.platformFeeCents, 150); // $1.50 platform commission
    });
  });

  describe('4. Transactional Email Delivery (Resend / HTML Templates)', () => {
    it('dispatches password reset email with formatted link and recipient', async () => {
      const result = await sendPasswordResetEmail({
        to: 'dj_reset@koda.fm',
        resetUrl: 'http://localhost:3000/reset-password?token=mock123',
        name: 'Alex'
      });

      assert.ok(result);
      assert.ok(result.resetUrl || result.id);
    });

    it('dispatches welcome email for newly registered creator', async () => {
      const result = await sendWelcomeEmail({
        to: 'new_creator@koda.fm',
        name: 'Taylor'
      });

      assert.ok(result);
    });
  });
});
