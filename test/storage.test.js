const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const {
  app,
  generatePresignedUploadUrl,
  registerUser,
  generateToken
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
    const ip = options.ip || '192.168.1.55';
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

describe('PHASE 4: Cloud Audio Storage & Global CDN Tests', () => {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const dummyAudioFilename = 'test_stream.mp3';
  const dummyAudioPath = path.join(uploadsDir, dummyAudioFilename);
  const dummyFileSize = 2048; // 2 KB test payload

  before(() => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    // Write 2KB of dummy audio bytes ('A's)
    const buf = Buffer.alloc(dummyFileSize, 0x41);
    fs.writeFileSync(dummyAudioPath, buf);
  });

  after(() => {
    if (fs.existsSync(dummyAudioPath)) {
      try { fs.unlinkSync(dummyAudioPath); } catch (_) {}
    }
  });

  describe('1. Direct-to-Cloud Uploads & Presigned URLs', () => {
    it('generates presigned upload URL structure with valid key and fallbacks', async () => {
      const presign = await generatePresignedUploadUrl({
        filename: 'my_beat_2026.mp3',
        contentType: 'audio/mpeg',
        kind: 'audio'
      });

      assert.ok(presign.uploadUrl, 'Must provide an uploadUrl');
      assert.ok(presign.publicUrl, 'Must provide a publicUrl');
      assert.ok(presign.key, 'Must generate a unique object storage key');
      assert.ok(presign.key.startsWith('audio/'), 'Key must be prefixed with kind');
      assert.ok(presign.key.endsWith('.mp3'), 'Key must preserve audio extension');
    });

    it('rejects presigned URL generation for unauthenticated users (401)', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/upload/presign',
        body: { filename: 'unauthorized_track.mp3', contentType: 'audio/mpeg' }
      });

      assert.equal(res.status, 401);
      assert.ok(res.body.error.includes('Sign in') || res.body.error.includes('upload'));
    });

    it('allows registered creators to request presigned upload URLs', async () => {
      const user = await registerUser({
        name: 'Producer Dan',
        email: `producer_${Date.now()}@koda.fm`,
        password: 'Password123!'
      });
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      const res = await dispatch({
        method: 'POST',
        url: '/api/upload/presign',
        headers: { cookie: `koda_user_session=${token}` },
        body: { filename: 'cloud_groove.mp3', contentType: 'audio/mpeg', kind: 'audio' }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.uploadUrl);
      assert.ok(res.body.key.includes('cloud_groove'));
    });

    it('rejects /api/upload/complete if rights are not confirmed', async () => {
      const user = await registerUser({
        name: 'Producer Alice',
        email: `alice_${Date.now()}@koda.fm`,
        password: 'Password123!'
      });
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      const res = await dispatch({
        method: 'POST',
        url: '/api/upload/complete',
        headers: { cookie: `koda_user_session=${token}` },
        body: {
          key: 'audio/alice_track.mp3',
          publicUrl: 'https://cdn.koda.fm/audio/alice_track.mp3',
          rightsConfirmed: 'false'
        }
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('rights'));
    });

    it('registers cloud-uploaded audio track via /api/upload/complete', async () => {
      const user = await registerUser({
        name: 'Producer Max',
        email: `max_${Date.now()}@koda.fm`,
        password: 'Password123!'
      });
      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      const res = await dispatch({
        method: 'POST',
        url: '/api/upload/complete',
        headers: { cookie: `koda_user_session=${token}` },
        body: {
          key: 'audio/max_synth_loop.mp3',
          publicUrl: 'https://cdn.koda.fm/audio/max_synth_loop.mp3',
          title: 'Neon Nights',
          artist: 'Max Skyline',
          album: 'Electronic Horizons',
          rightsConfirmed: 'true'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.track.title, 'Neon Nights');
      assert.equal(res.body.track.streamUrl, 'https://cdn.koda.fm/audio/max_synth_loop.mp3');
      assert.equal(res.body.track.downloadUrl, 'https://cdn.koda.fm/audio/max_synth_loop.mp3');
    });
  });

  describe('2. HTTP Byte-Range Audio Streaming (RFC 7233)', () => {
    it('serves full audio file with 200 OK and Accept-Ranges when no Range header is sent', async () => {
      const res = await dispatch({
        method: 'GET',
        url: `/uploads/${dummyAudioFilename}`
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers['accept-ranges'], 'bytes');
      assert.equal(res.headers['content-type'], 'audio/mpeg');
      assert.equal(Number(res.headers['content-length']), dummyFileSize);
      assert.ok(res.headers['cache-control'].includes('public'));
      assert.ok(res.headers['cache-control'].includes('immutable'));
      assert.equal(res.rawBuffer.length, dummyFileSize);
    });

    it('serves 206 Partial Content for byte-range request (e.g. Range: bytes=0-499)', async () => {
      const res = await dispatch({
        method: 'GET',
        url: `/uploads/${dummyAudioFilename}`,
        headers: { range: 'bytes=0-499' }
      });

      assert.equal(res.status, 206);
      assert.equal(res.headers['accept-ranges'], 'bytes');
      assert.equal(res.headers['content-range'], `bytes 0-499/${dummyFileSize}`);
      assert.equal(Number(res.headers['content-length']), 500);
      assert.equal(res.rawBuffer.length, 500);
    });

    it('serves 206 Partial Content for open-ended seeking request (e.g. Range: bytes=1000-)', async () => {
      const res = await dispatch({
        method: 'GET',
        url: `/uploads/${dummyAudioFilename}`,
        headers: { range: 'bytes=1000-' }
      });

      assert.equal(res.status, 206);
      assert.equal(res.headers['accept-ranges'], 'bytes');
      assert.equal(res.headers['content-range'], `bytes 1000-${dummyFileSize - 1}/${dummyFileSize}`);
      assert.equal(Number(res.headers['content-length']), dummyFileSize - 1000);
      assert.equal(res.rawBuffer.length, dummyFileSize - 1000);
    });

    it('returns 416 Range Not Satisfiable when range start exceeds file size', async () => {
      const res = await dispatch({
        method: 'GET',
        url: `/uploads/${dummyAudioFilename}`,
        headers: { range: `bytes=${dummyFileSize + 500}-${dummyFileSize + 1000}` }
      });

      assert.equal(res.status, 416);
      assert.equal(res.headers['content-range'], `bytes */${dummyFileSize}`);
    });

    it('returns 404 Not Found when requested audio file does not exist', async () => {
      const res = await dispatch({
        method: 'GET',
        url: '/uploads/nonexistent_sample_track.mp3'
      });

      assert.equal(res.status, 404);
    });
  });
});
