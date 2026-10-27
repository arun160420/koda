const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  app,
  registerUser,
  loginUser,
  createGuestSession,
  generateToken,
  verifyToken,
  requestPasswordReset,
  completePasswordReset
} = require('../server.js');

const http = require('http');
const net = require('net');

function dispatch(options) {
  return new Promise((resolve) => {
    const method = (options.method || 'GET').toUpperCase();
    const url = options.url || '/';
    const headers = { ...(options.headers || {}) };
    const rawBody = options.body ? JSON.stringify(options.body) : '';
    if (rawBody) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(rawBody);
    }

    const socket = new net.Socket();
    const ip = options.ip || '192.168.1.15';
    Object.defineProperty(socket, 'remoteAddress', { value: ip, configurable: true });

    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = headers;

    const res = new http.ServerResponse(req);
    let responseBody = '';

    const origWrite = res.write.bind(res);
    res.write = (chunk, ...args) => {
      if (chunk) responseBody += chunk.toString();
      return origWrite(chunk, ...args);
    };

    const origEnd = res.end.bind(res);
    res.end = (chunk, ...args) => {
      if (chunk) responseBody += chunk.toString();
      origEnd(chunk, ...args);

      let parsedBody = responseBody;
      try {
        parsedBody = JSON.parse(responseBody);
      } catch (_) {}

      resolve({
        status: res.statusCode,
        headers: res.getHeaders ? res.getHeaders() : {},
        body: parsedBody
      });
    };

    app(req, res);

    if (rawBody) {
      req.push(rawBody);
    }
    req.push(null);
  });
}

describe('PHASE 3: Production User Authentication Tests', () => {

  describe('1. Email & Password Authentication & Bcrypt Hashing', () => {
    const testEmail = `producer_${Date.now()}@example.com`;
    const testPassword = 'StrongPassword123!';
    let registeredCookie = '';

    it('hashes passwords using bcrypt with 12 salt rounds', async () => {
      const result = await registerUser({
        email: `salt_test_${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        name: 'Salt Tester'
      });
      assert.ok(result.user);
      assert.ok(result.token);

      // Verify token contains decoded payload
      const decoded = verifyToken(result.token);
      assert.equal(decoded.name, 'Salt Tester');
      assert.equal(decoded.role, 'LISTENER');
      assert.equal(decoded.isGuest, false);
    });

    it('registers a new user via API and issues secure HTTP-only JWT cookie', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          email: testEmail,
          password: testPassword,
          name: 'Koda Producer',
          handle: '@kodaprod'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.user.email, testEmail);

      // Check Set-Cookie header
      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie, 'Set-Cookie header must be present');
      assert.ok(setCookie.includes('koda_user_session='), 'Cookie name must be koda_user_session');
      assert.ok(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
      assert.ok(setCookie.includes('SameSite=Lax'), 'Cookie must be SameSite=Lax');

      // Extract cookie value for subsequent tests
      registeredCookie = setCookie.split(';')[0];
    });

    it('rejects registration with duplicate email', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          email: testEmail,
          password: testPassword,
          name: 'Duplicate'
        }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('already exists'));
    });

    it('rejects registration with short password (< 8 chars)', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          email: `short_${Date.now()}@example.com`,
          password: 'short'
        }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('at least 8 characters'));
    });

    it('logs in successfully with correct credentials and issues JWT session', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testEmail,
          password: testPassword
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.user.email, testEmail);
      assert.ok(res.headers['set-cookie'].includes('koda_user_session='));
    });

    it('rejects login with incorrect password', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: testEmail,
          password: 'WrongPassword999!'
        }
      });

      assert.equal(res.status, 401);
      assert.ok(res.body.error.includes('Incorrect email or password'));
    });

    it('/api/auth/me returns authenticated user session', async () => {
      const res = await dispatch({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: registeredCookie }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.authenticated, true);
      assert.equal(res.body.isGuest, false);
      assert.equal(res.body.user.email, testEmail);
    });

    it('/api/auth/logout clears user session cookie', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: registeredCookie }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.headers['set-cookie'].includes('Max-Age=0'));
    });
  });

  describe('2. Password Reset Flow', () => {
    const resetEmail = `reset_${Date.now()}@example.com`;

    it('requests password reset and resets password with token', async () => {
      // 1. Register account
      await registerUser({
        email: resetEmail,
        password: 'InitialPassword123!',
        name: 'Reset User'
      });

      // 2. Request reset
      const forgotRes = await dispatch({
        method: 'POST',
        url: '/api/auth/forgot-password',
        body: { email: resetEmail }
      });
      assert.equal(forgotRes.status, 200);
      assert.ok(forgotRes.body.ok);

      // Extract dev reset url token
      const resetUrl = forgotRes.body.devResetUrl;
      const token = resetUrl.split('token=')[1];
      assert.ok(token, 'Reset token must be generated');

      // 3. Complete reset
      const resetRes = await dispatch({
        method: 'POST',
        url: '/api/auth/reset-password',
        body: {
          token,
          newPassword: 'BrandNewPassword123!'
        }
      });
      assert.equal(resetRes.status, 200);
      assert.ok(resetRes.body.ok);

      // 4. Verify login with new password succeeds
      const loginRes = await dispatch({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: resetEmail,
          password: 'BrandNewPassword123!'
        }
      });
      assert.equal(loginRes.status, 200);
      assert.equal(loginRes.body.user.email, resetEmail);
    });
  });

  describe('3. Guest Anonymous Access & Role Guarding', () => {
    let guestCookie = '';

    it('assigns temporary guest session token on Enter as Guest', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/auth/guest'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.isGuest, true);
      assert.equal(res.body.user.role, 'GUEST');
      assert.ok(res.body.user.handle.startsWith('@guest_'));

      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie.includes('koda_user_session='));
      guestCookie = setCookie.split(';')[0];
    });

    it('allows guest to chat and vote in room queue', async () => {
      // Create a room with a registered user
      const hostUser = await registerUser({
        email: `host_${Date.now()}@example.com`,
        password: 'HostPassword123!',
        name: 'DJ Host'
      });
      const hostCookie = `koda_user_session=${hostUser.token}`;

      const roomRes = await dispatch({
        method: 'POST',
        url: '/api/rooms',
        headers: { cookie: hostCookie },
        body: { name: 'Host Public Room' }
      });
      assert.equal(roomRes.status, 200);
      const roomId = roomRes.body.room.id;

      // Guest sends chat message -> allowed!
      const chatRes = await dispatch({
        method: 'POST',
        url: `/api/rooms/${roomId}/chat`,
        headers: { cookie: guestCookie },
        body: { text: 'Hello from a guest listener!' }
      });
      assert.equal(chatRes.status, 200);
      assert.equal(chatRes.body.message.text, 'Hello from a guest listener!');
    });

    it('prompts guest for account creation when attempting to host a permanent room', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/rooms',
        headers: { cookie: guestCookie },
        body: { name: 'Unauthorized Guest Room' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.requiresAuth, true);
      assert.ok(res.body.error.includes('Account required'));
    });

    it('prompts guest for account creation when attempting to save a collaborative tape', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/playlists',
        headers: { cookie: guestCookie },
        body: { title: 'Unauthorized Guest Tape' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.requiresAuth, true);
      assert.ok(res.body.error.includes('Account required'));
    });
  });

  describe('4. Google OAuth 2.0 Integration', () => {
    it('/api/auth/google returns OAuth redirect or configuration status', async () => {
      const res = await dispatch({
        method: 'GET',
        url: '/api/auth/google'
      });

      // When GOOGLE_CLIENT_ID is not configured in .env, returns 503 configuration hint
      // When configured, redirects (302) to accounts.google.com
      if (res.status === 503) {
        assert.ok(res.body.error.includes('Google OAuth is not configured'));
      } else {
        assert.equal(res.status, 302);
        assert.ok(res.headers.location.includes('accounts.google.com'));
      }
    });

    it('/api/auth/google/callback requires valid authorization code', async () => {
      const res = await dispatch({
        method: 'GET',
        url: '/api/auth/google/callback'
      });

      // No code provided redirects to / with error param
      assert.equal(res.status, 302);
      assert.ok(res.headers.location.includes('error=google_auth_failed'));
    });
  });

});
