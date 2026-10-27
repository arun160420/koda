const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  app,
  inspectAudioFile,
  inspectImageFile,
  sanitizeText,
  sanitizeMultiline,
  sanitizeUser
} = require('../server.js');

const http = require('http');
const net = require('net');

// Lightweight request runner using genuine Node.js http IncomingMessage & ServerResponse
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
    const ip = options.ip || '192.168.1.10';
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

describe('PHASE 1: Security & API Hardening Tests', () => {

  describe('1. Security Headers & Protection (Helmet & CORS)', () => {
    it('sets secure HTTP headers: CSP, HSTS, X-Content-Type-Options, X-Frame-Options', async () => {
      const res = await dispatch({ method: 'GET', url: '/api/health' });
      assert.equal(res.status, 200);

      // X-Content-Type-Options: nosniff
      assert.equal(res.headers['x-content-type-options'], 'nosniff');

      // X-Frame-Options: SAMEORIGIN
      assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');

      // Strict-Transport-Security (HSTS)
      assert.ok(res.headers['strict-transport-security'], 'HSTS header should be present');
      assert.ok(res.headers['strict-transport-security'].includes('max-age='));

      // Content-Security-Policy (CSP)
      const csp = res.headers['content-security-policy'];
      assert.ok(csp, 'CSP header should be present');
      assert.ok(csp.includes("default-src 'self'"), 'CSP should define default-src');
      assert.ok(csp.includes('archive.org'), 'CSP should permit archive.org for music/covers');
      assert.ok(csp.includes('fonts.googleapis.com'), 'CSP should permit Google Fonts');
    });

    it('enforces verified CORS domains and blocks untrusted cross-origin requests', async () => {
      // Untrusted cross-origin domain should NOT receive Access-Control-Allow-Origin
      const untrustedRes = await dispatch({
        method: 'GET',
        url: '/api/health',
        headers: { origin: 'https://evil-attacker.com' }
      });
      assert.notEqual(untrustedRes.headers['access-control-allow-origin'], 'https://evil-attacker.com');

      // Local development or configured origin should receive proper CORS headers
      const localRes = await dispatch({
        method: 'GET',
        url: '/api/health',
        headers: { origin: 'http://localhost:3000' }
      });
      assert.equal(localRes.headers['access-control-allow-origin'], 'http://localhost:3000');
      assert.equal(localRes.headers['access-control-allow-credentials'], 'true');
    });
  });

  describe('2. Input Validation & Anti-XSS Sanitization', () => {
    it('sanitizes text fields to strip HTML tags, script injection, and event handlers', () => {
      const dirty = '<script>alert("xss")</script><img src=x onerror=alert(1)>Hello <b>World</b>';
      const clean = sanitizeText(dirty, 100);
      assert.equal(clean, 'Hello World');
    });

    it('sanitizes multi-line inputs while preserving newlines and removing dangerous tags', () => {
      const dirtyMultiline = 'Line 1<script>alert(1)</script>\nLine 2 <img src=x onerror=evil()>\nLine 3';
      const cleanMultiline = sanitizeMultiline(dirtyMultiline, 500);
      assert.equal(cleanMultiline, 'Line 1\nLine 2\nLine 3');
    });

    it('sanitizes user profile fields (name, handle, avatar, color)', () => {
      const dirtyUser = {
        name: '<script>alert("hacked")</script>DJ Vinyl',
        handle: '<iframe src=evil.com>@djvinyl',
        avatar: '<img src=x>DJ',
        color: 'invalid-color-value'
      };
      const cleanUser = sanitizeUser(dirtyUser);
      assert.equal(cleanUser.name, 'DJ Vinyl');
      assert.equal(cleanUser.handle, '@djvinyl');
      assert.equal(cleanUser.avatar, 'DJ');
      assert.equal(cleanUser.color, '#ff5a1f'); // defaults to safe brand color
    });

    it('sanitizes room creation name and vibe via API', async () => {
      const res = await dispatch({
        method: 'POST',
        url: '/api/rooms',
        ip: '10.0.1.1',
        body: {
          name: '<script>alert("pwned")</script>Midnight Session',
          vibe: '<img src=x onerror=alert(2)>Lo-Fi Beats',
          host: { name: '<b>Alice</b>', handle: '@alice' }
        }
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.room.name, 'Midnight Session');
      assert.equal(res.body.room.vibe, 'Lo-Fi Beats');
      assert.equal(res.body.room.host.name, 'Alice');
    });

    it('sanitizes room chat messages and rejects empty/malicious-only messages', async () => {
      // First, create a room to chat in
      const roomRes = await dispatch({
        method: 'POST',
        url: '/api/rooms',
        ip: '10.0.1.2',
        body: { name: 'Chat Test Room' }
      });
      const roomId = roomRes.body.room.id;

      // Send sanitized chat message
      const chatRes = await dispatch({
        method: 'POST',
        url: `/api/rooms/${roomId}/chat`,
        ip: '10.0.1.2',
        body: {
          text: '<script>alert("hack")</script>Loving this vibe! <b onclick="boom()">test</b>',
          user: { name: 'Bob', handle: '@bob' }
        }
      });
      assert.equal(chatRes.status, 200);
      assert.equal(chatRes.body.message.text, 'Loving this vibe! test');

      // Send message with ONLY stripped tags -> resulting in empty string -> returns 400
      const emptyRes = await dispatch({
        method: 'POST',
        url: `/api/rooms/${roomId}/chat`,
        ip: '10.0.1.2',
        body: {
          text: '<script>alert(1)</script>',
          user: { name: 'Bob', handle: '@bob' }
        }
      });
      assert.equal(emptyRes.status, 400);
      assert.equal(emptyRes.body.error, 'Message required.');
    });

    it('sanitizes tape creation and tape comments', async () => {
      const tapeRes = await dispatch({
        method: 'POST',
        url: '/api/playlists',
        ip: '10.0.1.3',
        body: {
          title: '<script>alert(1)</script>Chillhop Volume 1',
          subtitle: '<marquee>Night Drive</marquee>',
          description: '<p>A tape created by <b>crew</b></p>'
        }
      });
      assert.equal(tapeRes.status, 200);
      assert.ok(tapeRes.body.playlist.title.includes('CHILLHOP VOLUME 1'));
      assert.equal(tapeRes.body.playlist.subtitle, 'Night Drive');
      assert.equal(tapeRes.body.playlist.description, 'A tape created by crew');

      const playlistId = tapeRes.body.playlist.id;
      const commentRes = await dispatch({
        method: 'POST',
        url: `/api/playlists/${playlistId}/comments`,
        ip: '10.0.1.3',
        body: {
          text: '<img src=x onerror=alert(1)>Great selection on track 2!',
          user: { name: 'Charlie', handle: '@charlie' }
        }
      });
      assert.equal(commentRes.status, 200);
      const addedComment = commentRes.body.playlist.comments.at(-1);
      assert.equal(addedComment.text, 'Great selection on track 2!');
    });
  });

  describe('3. Server-Side Audio MIME & Magic Byte Inspection', () => {
    it('accepts genuine audio file signatures (MP3, WAV, FLAC)', async () => {
      const tmpDir = path.join(__dirname, '../data');

      // Synthetic MP3 with ID3 header
      const mp3Path = path.join(tmpDir, 'test-signature.mp3');
      const mp3Buf = Buffer.alloc(512);
      mp3Buf.write('ID3', 0, 3, 'ascii');
      mp3Buf[3] = 3; mp3Buf[4] = 0; mp3Buf[5] = 0;
      mp3Buf[6] = 0; mp3Buf[7] = 0; mp3Buf[8] = 0; mp3Buf[9] = 10;
      mp3Buf[20] = 0xFF; mp3Buf[21] = 0xFB; mp3Buf[22] = 0x90; mp3Buf[23] = 0x64;
      fs.writeFileSync(mp3Path, mp3Buf);

      const mp3Inspection = await inspectAudioFile(mp3Path);
      assert.equal(mp3Inspection.valid, true);
      assert.equal(mp3Inspection.mime, 'audio/mpeg');
      fs.unlinkSync(mp3Path);

      // Synthetic WAV (RIFF....WAVE)
      const wavPath = path.join(tmpDir, 'test-signature.wav');
      const wavBuf = Buffer.alloc(64);
      wavBuf.write('RIFF', 0, 4, 'ascii');
      wavBuf.writeUInt32LE(56, 4);
      wavBuf.write('WAVE', 8, 4, 'ascii');
      wavBuf.write('fmt ', 12, 4, 'ascii');
      fs.writeFileSync(wavPath, wavBuf);

      const wavInspection = await inspectAudioFile(wavPath);
      assert.equal(wavInspection.valid, true);
      assert.equal(wavInspection.ext, 'wav');
      fs.unlinkSync(wavPath);

      // Synthetic FLAC
      const flacPath = path.join(tmpDir, 'test-signature.flac');
      const flacBuf = Buffer.alloc(64);
      flacBuf.write('fLaC', 0, 4, 'ascii');
      fs.writeFileSync(flacPath, flacBuf);

      const flacInspection = await inspectAudioFile(flacPath);
      assert.equal(flacInspection.valid, true);
      assert.equal(flacInspection.ext, 'flac');
      fs.unlinkSync(flacPath);
    });

    it('rejects malicious files disguised as audio (PHP scripts, EXE binaries, HTML files)', async () => {
      const tmpDir = path.join(__dirname, '../data');

      // Malicious PHP web shell renamed to .mp3
      const phpPath = path.join(tmpDir, 'malicious.mp3');
      fs.writeFileSync(phpPath, '<?php system($_GET["cmd"]); ?>');
      const phpInspection = await inspectAudioFile(phpPath);
      assert.equal(phpInspection.valid, false);
      fs.unlinkSync(phpPath);

      // Windows executable (MZ header) renamed to .mp3
      const exePath = path.join(tmpDir, 'malware.mp3');
      fs.writeFileSync(exePath, Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]));
      const exeInspection = await inspectAudioFile(exePath);
      assert.equal(exeInspection.valid, false);
      fs.unlinkSync(exePath);

      // HTML phishing file renamed to .mp3
      const htmlPath = path.join(tmpDir, 'phishing.mp3');
      fs.writeFileSync(htmlPath, '<html><body><h1>Login to Win</h1></body></html>');
      const htmlInspection = await inspectAudioFile(htmlPath);
      assert.equal(htmlInspection.valid, false);
      fs.unlinkSync(htmlPath);
    });

    it('inspectImageFile validates image magic bytes and rejects scripts', async () => {
      const tmpDir = path.join(__dirname, '../data');

      // Valid PNG
      const pngPath = path.join(tmpDir, 'cover.png');
      fs.writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
      const pngInspection = await inspectImageFile(pngPath);
      assert.equal(pngInspection.valid, true);
      assert.equal(pngInspection.mime, 'image/png');
      fs.unlinkSync(pngPath);

      // Fake PNG containing JavaScript
      const badImgPath = path.join(tmpDir, 'fake.png');
      fs.writeFileSync(badImgPath, 'console.log("malicious");');
      const badInspection = await inspectImageFile(badImgPath);
      assert.equal(badInspection.valid, false);
      fs.unlinkSync(badImgPath);
    });
  });

  describe('4. Rate Limiting Enforcements', () => {
    it('enforces strict room creation rate limit (Max 5 per 15 minutes per IP)', async () => {
      const testIp = '10.99.1.50';

      // Send 5 valid room creation requests
      for (let i = 0; i < 5; i++) {
        const res = await dispatch({
          method: 'POST',
          url: '/api/rooms',
          ip: testIp,
          body: { name: `Room ${i + 1}` }
        });
        assert.equal(res.status, 200, `Request ${i + 1} should succeed`);
      }

      // The 6th request from the same IP must be rejected with 429
      const blockedRes = await dispatch({
        method: 'POST',
        url: '/api/rooms',
        ip: testIp,
        body: { name: 'Room 6 should fail' }
      });
      assert.equal(blockedRes.status, 429);
      assert.ok(blockedRes.body.error.includes('Room creation limit reached'));
    });

    it('enforces strict room chat rate limit (Max 30 messages per minute)', async () => {
      const testIp = '10.99.2.60';
      const roomRes = await dispatch({
        method: 'POST',
        url: '/api/rooms',
        ip: '10.99.2.99', // use different IP for room creation so room limit is not hit
        body: { name: 'Rate Limit Chat Room' }
      });
      const roomId = roomRes.body.room.id;

      // Send 30 chat messages
      for (let i = 0; i < 30; i++) {
        const res = await dispatch({
          method: 'POST',
          url: `/api/rooms/${roomId}/chat`,
          ip: testIp,
          body: { text: `Message ${i + 1}` }
        });
        assert.equal(res.status, 200, `Message ${i + 1} should succeed`);
      }

      // The 31st chat message from the same IP must be rejected with 429
      const blockedChat = await dispatch({
        method: 'POST',
        url: `/api/rooms/${roomId}/chat`,
        ip: testIp,
        body: { text: 'Spam message 31' }
      });
      assert.equal(blockedChat.status, 429);
      assert.ok(blockedChat.body.error.includes('Chat rate limit reached'));
    });

    it('enforces playlist creation & comments rate limit (Max 10 actions per 5 minutes)', async () => {
      const testIp = '10.99.3.70';

      // Create 5 tapes
      let lastPlaylistId = '';
      for (let i = 0; i < 5; i++) {
        const res = await dispatch({
          method: 'POST',
          url: '/api/playlists',
          ip: testIp,
          body: { title: `Tape ${i + 1}` }
        });
        assert.equal(res.status, 200);
        lastPlaylistId = res.body.playlist.id;
      }

      // Add 5 comments (total 10 actions on shared limiter)
      for (let i = 0; i < 5; i++) {
        const res = await dispatch({
          method: 'POST',
          url: `/api/playlists/${lastPlaylistId}/comments`,
          ip: testIp,
          body: { text: `Comment ${i + 1}` }
        });
        assert.equal(res.status, 200);
      }

      // The 11th action from the same IP must be rejected with 429
      const blockedAction = await dispatch({
        method: 'POST',
        url: `/api/playlists/${lastPlaylistId}/comments`,
        ip: testIp,
        body: { text: 'Comment 11 should be rate limited' }
      });
      assert.equal(blockedAction.status, 429);
      assert.ok(blockedAction.body.error.includes('Playlist action limit reached'));
    });

    it('enforces media upload rate limit (Max 5 uploads per hour per user/IP)', async () => {
      const testIp = '10.99.5.90';

      // 5 requests to /api/upload
      for (let i = 0; i < 5; i++) {
        const res = await dispatch({
          method: 'POST',
          url: '/api/upload',
          ip: testIp,
          body: { rightsConfirmed: 'false' } // Hits mediaUploadLimiter before handler
        });
        // Returns 503 or 401 because admin session is checked after uploadLimiter, or 400
        assert.notEqual(res.status, 429, `Upload attempt ${i + 1} should pass rate limiter`);
      }

      // 6th upload attempt must be rate-limited with 429
      const blockedUpload = await dispatch({
        method: 'POST',
        url: '/api/upload',
        ip: testIp,
        body: { rightsConfirmed: 'false' }
      });
      assert.equal(blockedUpload.status, 429);
      assert.ok(blockedUpload.body.error.includes('Upload limit reached'));
    });

    it('enforces global API limit (Max 100 requests per minute per IP)', async () => {
      const testIp = '10.99.4.80';

      // Send 100 requests to /api/health
      for (let i = 0; i < 100; i++) {
        const res = await dispatch({
          method: 'GET',
          url: '/api/health',
          ip: testIp
        });
        assert.equal(res.status, 200);
      }

      // 101st request should be rejected with 429
      const blockedRes = await dispatch({
        method: 'GET',
        url: '/api/health',
        ip: testIp
      });
      assert.equal(blockedRes.status, 429);
      assert.ok(blockedRes.body.error.includes('Too many requests'));
    });
  });

});
