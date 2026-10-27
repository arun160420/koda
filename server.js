const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const {
  attachUser,
  setUserCookie,
  clearUserCookie,
  registerUser,
  loginUser,
  createGuestSession,
  generateToken,
  verifyToken,
  getGoogleAuthUrl,
  handleGoogleCallback,
  requestPasswordReset,
  completePasswordReset,
  revokeUserTokens
} = require('./auth');
const {
  isCloudStorageEnabled,
  generatePresignedUploadUrl,
  streamAudioWithByteRange
} = require('./storage');
const {
  getTermsOfService,
  getPrivacyPolicy,
  getDmcaPolicy,
  sanitizeDmcaNotice,
  renderLegalHtml,
  DMCA_AGENT_EMAIL
} = require('./legal');
const {
  TIERS,
  isStripeConfigured,
  createCheckoutSession,
  handleStripeWebhook,
  createConnectAccountLink,
  processRoomTip
} = require('./billing');
const {
  publishClusterMessage,
  subscribeClusterMessage,
  isRedisConnected
} = require('./redis');
const {
  sendPasswordResetEmail,
  sendWelcomeEmail
} = require('./mailer');

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || Object.prototype.hasOwnProperty.call(process.env, match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
loadLocalEnv();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.KODA_DATA_DIR ? path.resolve(process.env.KODA_DATA_DIR) : path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.KODA_UPLOADS_DIR ? path.resolve(process.env.KODA_UPLOADS_DIR) : path.join(__dirname, 'uploads');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const SEED_PATH = path.join(__dirname, 'data', 'seed-tracks.json');
const CATALOG_MEDIA_DIR = path.join(DATA_DIR, 'catalog-media');
const CATALOG_AUDIO_DIR = path.join(CATALOG_MEDIA_DIR, 'audio');
const CATALOG_ARTWORK_DIR = path.join(CATALOG_MEDIA_DIR, 'artwork');
const CATALOG_ASSETS_DIR = path.join(CATALOG_MEDIA_DIR, 'assets');
const ADMIN_PASSWORD = String(process.env.KODA_ADMIN_PASSWORD || '091216042005');
const SESSION_SECRET = String(process.env.KODA_SESSION_SECRET || 'a8f9c1b3e7d246098123456789abcdef0123456789abcdef0123456789abcdef');
const ADMIN_AUTH_ENABLED = ADMIN_PASSWORD.length >= 12 && SESSION_SECRET.length >= 32
  && !/^replace[-_ ]/i.test(ADMIN_PASSWORD) && !/^replace[-_ ]/i.test(SESSION_SECRET);
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_COOKIE = 'koda_admin_session';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(CATALOG_AUDIO_DIR, { recursive: true });
fs.mkdirSync(CATALOG_ARTWORK_DIR, { recursive: true });
fs.mkdirSync(CATALOG_ASSETS_DIR, { recursive: true });

function cookieValue(req, name) {
  const prefix = `${name}=`;
  for (const part of String(req.headers.cookie || '').split(';')) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      try { return decodeURIComponent(entry.slice(prefix.length)); } catch (_error) { return ''; }
    }
  }
  return '';
}

function sanitizeText(value, maxLength = 500) {
  if (value == null) return '';
  const clean = sanitizeHtml(String(value), {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  });
  return clean.replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeMultiline(value, maxLength = 60000) {
  if (value == null) return '';
  const clean = sanitizeHtml(String(value), {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  });
  return clean
    .replace(/\r\n/g, '\n')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .slice(0, maxLength)
    .trim();
}

const people = {
  you: { id: 'u-you', name: 'You', handle: '@you', avatar: 'YO', color: '#ff5a1f' }
};

function sanitizeUser(rawUser) {
  const user = rawUser && typeof rawUser === 'object' ? rawUser : people.you;
  const name = sanitizeText(user.name, 48) || 'Listener';
  const handle = sanitizeText(user.handle, 32) || '@listener';
  const avatar = sanitizeText(user.avatar, 6) || name.slice(0, 2).toUpperCase() || 'YO';
  const color = typeof user.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(user.color) ? user.color : '#ff5a1f';
  const id = sanitizeText(user.id, 64) || `u-${Date.now()}`;
  return { id, name, handle, avatar, color };
}

async function inspectAudioFile(filePath) {
  try {
    const { fileTypeFromFile } = await import('file-type');
    const detected = await fileTypeFromFile(filePath);

    const allowedAudioMimes = new Set([
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac',
      'audio/wav',
      'audio/x-wav',
      'audio/vnd.wave',
      'audio/ogg',
      'audio/opus',
      'audio/vorbis',
      'application/ogg',
      'video/ogg',
      'audio/flac',
      'audio/x-flac',
      'audio/aiff',
      'audio/x-aiff'
    ]);

    const dangerousMimes = new Set([
      'application/x-msdownload',
      'application/x-executable',
      'application/x-mach-binary',
      'application/x-elf',
      'application/javascript',
      'text/javascript',
      'text/html',
      'application/xml',
      'application/x-sh',
      'application/x-bat'
    ]);

    if (detected) {
      if (dangerousMimes.has(detected.mime)) return { valid: false, reason: detected.mime };
      if (allowedAudioMimes.has(detected.mime)) return { valid: true, mime: detected.mime, ext: detected.ext };
    }

    const buffer = Buffer.alloc(32);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 32, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) return { valid: false, reason: 'File too small' };

    // ID3v2 tag (MP3)
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return { valid: true, mime: 'audio/mpeg', ext: 'mp3' };
    }
    // MPEG frame sync (MP3 without ID3 tag)
    if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0 && (buffer[1] & 0x18) !== 0x08) {
      return { valid: true, mime: 'audio/mpeg', ext: 'mp3' };
    }
    // RIFF WAV
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') {
      return { valid: true, mime: 'audio/wav', ext: 'wav' };
    }
    // FLAC
    if (buffer.subarray(0, 4).toString('ascii') === 'fLaC') {
      return { valid: true, mime: 'audio/flac', ext: 'flac' };
    }
    // OGG
    if (buffer.subarray(0, 4).toString('ascii') === 'OggS') {
      return { valid: true, mime: 'audio/ogg', ext: 'ogg' };
    }
    // AIFF
    if (buffer.subarray(0, 4).toString('ascii') === 'FORM' && ['AIFF', 'AIFC'].includes(buffer.subarray(8, 12).toString('ascii'))) {
      return { valid: true, mime: 'audio/aiff', ext: 'aif' };
    }
    // M4A / AAC container
    if (bytesRead >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      return { valid: true, mime: 'audio/mp4', ext: 'm4a' };
    }
    // AAC ADTS
    if (buffer[0] === 0xFF && (buffer[1] & 0xF6) === 0xF0) {
      return { valid: true, mime: 'audio/aac', ext: 'aac' };
    }

    return { valid: false, reason: detected ? detected.mime : 'Unrecognized audio signature' };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

async function inspectImageFile(filePath) {
  try {
    const { fileTypeFromFile } = await import('file-type');
    const detected = await fileTypeFromFile(filePath);
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (detected && allowed.has(detected.mime)) return { valid: true, mime: detected.mime };

    const buf = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    if (bytesRead < 4) return { valid: false, reason: 'File too small' };

    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return { valid: true, mime: 'image/png' };
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { valid: true, mime: 'image/jpeg' };
    const str = buf.subarray(0, 6).toString('ascii');
    if (str === 'GIF87a' || str === 'GIF89a') return { valid: true, mime: 'image/gif' };
    if (bytesRead >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { valid: true, mime: 'image/webp' };

    return { valid: false, reason: detected ? detected.mime : 'Unrecognized image signature' };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

app.set('trust proxy', 1);

// Security Headers & Protection (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://archive.org', 'https://*.archive.org'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'https://archive.org', 'https://*.archive.org'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https://archive.org', 'https://*.archive.org'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'sameorigin' }
  })
);

// Strict CORS rules (Verified Domains)
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsMiddleware = cors((req, callback) => {
  const origin = req.headers.origin;
  if (!origin) {
    return callback(null, { origin: true, credentials: true });
  }

  const normalized = origin.replace(/\/$/, '');
  if (configuredOrigins.length > 0) {
    const isAllowed = configuredOrigins.includes(normalized);
    return callback(null, { origin: isAllowed, credentials: true });
  }

  let isAllowed = false;
  try {
    const originUrl = new URL(origin);
    if (originUrl.host === req.headers.host || ['localhost', '127.0.0.1', '::1'].includes(originUrl.hostname)) {
      isAllowed = true;
    }
  } catch (_e) {
    isAllowed = false;
  }

  callback(null, { origin: isAllowed, credentials: true });
});
app.use(corsMiddleware);

// Rate Limiters
// Global API limit: Max 100 requests per minute per IP address
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again in a minute.' }
});

// Room creation (/api/rooms): Max 5 per 15 minutes per IP
const roomCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Room creation limit reached. Max 5 rooms per 15 minutes.' }
});

// Room chat (/api/rooms/:id/chat): Max 30 messages per minute
const roomChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Chat rate limit reached. Max 30 messages per minute.' }
});

// Playlist creation & comments: Max 10 actions per 5 minutes
const playlistActionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Playlist action limit reached. Max 10 tape creations or comments per 5 minutes.' }
});

// Media uploads (/api/upload): Max 5 uploads per hour per user
const mediaUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Upload limit reached: maximum 5 uploads per hour.' },
  keyGenerator: (req) => {
    const adminToken = cookieValue(req, ADMIN_COOKIE);
    const userHandle = req.body?.user?.handle;
    return (adminToken ? adminToken.slice(0, 32) : '') || userHandle || req.ip || 'unknown';
  }
});

// Authentication rate limiter: Max 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' }
});

app.use('/api', globalApiLimiter);

app.use(express.json({
  limit: '3mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(attachUser);

// Legal & Compliance Public Pages
app.get('/terms', (req, res) => {
  if (req.headers.accept?.includes('application/json')) {
    return res.json(getTermsOfService());
  }
  res.send(renderLegalHtml(getTermsOfService()));
});

app.get('/privacy', (req, res) => {
  if (req.headers.accept?.includes('application/json')) {
    return res.json(getPrivacyPolicy());
  }
  res.send(renderLegalHtml(getPrivacyPolicy()));
});

app.get('/dmca', (req, res) => {
  if (req.headers.accept?.includes('application/json')) {
    return res.json(getDmcaPolicy());
  }
  const dmcaDoc = {
    title: 'Digital Millennium Copyright Act (DMCA) Policy',
    effectiveDate: 'October 2026',
    sections: [
      {
        heading: 'Designated Copyright Agent',
        body: `Notices of claimed copyright infringement should be directed to our designated compliance agent at <strong>${DMCA_AGENT_EMAIL}</strong>.`
      },
      {
        heading: 'Notice Requirements (17 U.S.C. § 512(c)(3))',
        body: 'To submit a valid DMCA takedown notice, please provide written notification including: description of the copyrighted work, exact URL or track ID, your contact information, statement of good faith, statement under penalty of perjury, and electronic signature.'
      },
      {
        heading: 'Fast Online Submission Form',
        body: 'Copyright owners may also submit takedown requests programmatically or via our portal at <code>POST /api/dmca/takedown</code> for rapid review.'
      }
    ]
  };
  res.send(renderLegalHtml(dmcaDoc));
});
const staticMediaOptions = { fallthrough: true, maxAge: '1d', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') };

// Audio Streaming Optimization with HTTP Byte-Range Serving (RFC 7233)
app.get('/media/audio/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(CATALOG_AUDIO_DIR, safeFilename);
  return streamAudioWithByteRange(filePath, req, res);
});

app.get('/uploads/:filename', (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);
  return streamAudioWithByteRange(filePath, req, res);
});

app.use('/media/audio', express.static(CATALOG_AUDIO_DIR, staticMediaOptions));
app.use('/media/artwork', express.static(CATALOG_ARTWORK_DIR, staticMediaOptions));
app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: true, maxAge: '1h', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));
app.use(express.static(path.join(__dirname, 'public')));

const allowedAudioExtensions = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.flac', '.aiff', '.aif']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase() || '.mp3';
      const safeBase = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'audio';
      cb(null, `${Date.now()}_${safeBase}${extension}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedAudioExtensions.has(ext)) return cb(null, true);
    cb(new Error('Please choose an audio file (MP3, M4A, WAV, FLAC, OGG or AAC).'));
  }
});

const catalogExtensions = {
  audio: allowedAudioExtensions,
  artwork: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']),
  lyricsFile: new Set(['.txt', '.md', '.lrc']),
  attachments: new Set(['.pdf', '.txt', '.md', '.lrc', '.csv', '.json', '.docx', '.xlsx', '.pptx', '.mp4', '.webm', '.zip'])
};
const catalogUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, file, cb) => {
      const directory = file.fieldname === 'audio' ? CATALOG_AUDIO_DIR
        : file.fieldname === 'artwork' ? CATALOG_ARTWORK_DIR : CATALOG_ASSETS_DIR;
      fs.mkdirSync(directory, { recursive: true });
      cb(null, directory);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}_${crypto.randomBytes(10).toString('hex')}${extension}`);
    }
  }),
  limits: { fileSize: 200 * 1024 * 1024, files: 10, fields: 24, fieldSize: 256 * 1024, parts: 36 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (catalogExtensions[file.fieldname]?.has(extension)) return cb(null, true);
    cb(new Error(`Unsupported file type for ${file.fieldname}. Choose a supported audio, image, lyrics, or document file.`));
  }
});

function readSeedTracks() {
  try {
    const tracks = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    return Array.isArray(tracks) ? tracks : [];
  } catch (_error) {
    return [];
  }
}

const seedTracks = readSeedTracks();

// Start with a clean, honest space. Rooms, tapes, friends, and activity appear only
// after actual visitors create them; demo names should never look like real listeners.
const StoreRepository = require('./db/storeRepository');
const repository = new StoreRepository({ dataDir: DATA_DIR });
const store = repository.localStore;

function saveStore() {
  repository._saveLocalStore();
}

function sendLocalClients(event, payload, ts = Date.now()) {
  const message = JSON.stringify({ event, payload, ts });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

function broadcast(event, payload) {
  const ts = Date.now();
  sendLocalClients(event, payload, ts);
  publishClusterMessage('cluster_broadcast', { event, payload, ts }).catch(() => {});
}

subscribeClusterMessage('cluster_broadcast', (msg) => {
  if (msg && msg.event) {
    sendLocalClients(msg.event, msg.payload, msg.ts);
  }
});

function getRoomPosition(room) {
  const duration = Number(room.currentTrack && room.currentTrack.duration) || 3600;
  if (room.isPlaying && room.startedAt) return Math.floor((Date.now() - room.startedAt) / 1000) % duration;
  return Number(room.pausedPosition) || 0;
}

function getRooms() {
  return store.rooms.map((room) => ({ ...room, currentPosition: getRoomPosition(room) }));
}

function broadcastRooms(event = 'rooms_updated') {
  broadcast(event, getRooms());
}

const OPEN_LICENSES = [
  'http://creativecommons.org/licenses/by/4.0/',
  'http://creativecommons.org/licenses/by-sa/4.0/',
  'http://creativecommons.org/licenses/by/3.0/',
  'http://creativecommons.org/licenses/by-sa/3.0/',
  'http://creativecommons.org/publicdomain/zero/1.0/',
  'http://creativecommons.org/publicdomain/mark/1.0/',
  'https://creativecommons.org/licenses/by/4.0/',
  'https://creativecommons.org/licenses/by-sa/4.0/',
  'https://creativecommons.org/licenses/by/3.0/',
  'https://creativecommons.org/licenses/by-sa/3.0/',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/publicdomain/mark/1.0/'
];
const ARCHIVE_UA = 'KodaStudio/1.0 (open-license music browser)';

function parseArchiveDuration(value) {
  if (typeof value === 'number') return Math.round(value);
  if (value == null) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  if (text.includes(':')) {
    const parts = text.split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return 0;
    return Math.round(parts.reduce((total, part) => total * 60 + part, 0));
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function licenseName(url = '') {
  const value = String(url).toLowerCase();
  if (value.includes('/publicdomain/zero/')) return 'CC0 1.0';
  if (value.includes('/publicdomain/mark/')) return 'Public Domain Mark 1.0';
  const sa = value.match(/\/by-sa\/(\d+\.\d+)\//);
  if (sa) return `CC BY-SA ${sa[1]}`;
  const by = value.match(/\/by\/(\d+\.\d+)\//);
  if (by) return `CC BY ${by[1]}`;
  return 'Open license';
}

function isAllowedLicense(url = '') {
  const normalized = String(url).replace(/^https:/i, 'http:');
  return OPEN_LICENSES.some((license) => license.replace(/^https:/i, 'http:') === normalized);
}

function archiveDownloadUrl(identifier, filename) {
  const id = encodeURIComponent(identifier);
  const file = String(filename).split('/').map((part) => encodeURIComponent(part)).join('/');
  return `https://archive.org/download/${id}/${file}`;
}

function fallbackFileTitle(filename = '') {
  return decodeURIComponent(String(filename).split('/').pop() || '')
    .replace(/\.[^.]+$/, '')
    .replace(/^(?:\d+[_ .-]*)+/, '')
    .replace(/[_-]+/g, ' ')
    .trim() || 'Untitled track';
}

function formatArchiveItem(identifier, itemMetadata) {
  const metadata = itemMetadata?.metadata || {};
  const itemLicense = metadata.licenseurl || itemMetadata?.licenseurl || '';
  if (!isAllowedLicense(itemLicense)) return null;
  const files = Array.isArray(itemMetadata.files) ? itemMetadata.files : [];
  const groups = new Map();

  for (const file of files) {
    const filename = String(file.name || '');
    if (!filename.toLowerCase().endsWith('.mp3') || file.private === 'true') continue;
    const title = String(file.title || fallbackFileTitle(filename)).trim();
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const previous = groups.get(key);
    const rank = (candidate) => (candidate.source === 'original' ? 5 : 0)
      + (candidate.format === 'VBR MP3' ? 2 : 0)
      + (!String(candidate.name || '').toLowerCase().includes('_vbr') ? 1 : 0);
    if (!previous || rank(file) > rank(previous)) groups.set(key, { ...file, title });
  }

  const allCreators = metadata.creator || metadata.artist || '';
  const baseArtist = Array.isArray(allCreators) ? allCreators.join(', ') : String(allCreators || 'Independent artist').trim();
  const itemTitle = String(metadata.title || identifier).trim();
  const cover = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
  const sourceUrl = `https://archive.org/details/${encodeURIComponent(identifier)}`;
  const cleanLicense = String(itemLicense).replace(/^http:/i, 'https:');
  const year = String(metadata.year || metadata.date || metadata.publicdate || '').slice(0, 4);

  const tracks = [...groups.values()].map((file) => {
    const duration = parseArchiveDuration(file.length);
    if (duration < 30 || duration > 3600) return null;
    const title = String(file.title || fallbackFileTitle(file.name)).trim();
    const artist = String(file.artist || baseArtist || 'Independent artist').trim();
    const streamUrl = archiveDownloadUrl(identifier, file.name);
    return {
      id: `ia_${identifier}_${Buffer.from(file.name).toString('base64url')}`,
      archiveId: identifier,
      title,
      artist,
      album: itemTitle,
      duration,
      fullDuration: duration,
      cover,
      streamUrl,
      downloadUrl: streamUrl,
      linkUrl: sourceUrl,
      licenseUrl: cleanLicense,
      licenseName: licenseName(itemLicense),
      year,
      kbps: 0,
      language: 'music',
      source: 'internet-archive',
      provider: 'Internet Archive · Netlabels',
      tag: 'open',
      isPreview: false
    };
  }).filter(Boolean);

  tracks.sort((a, b) => a.title.localeCompare(b.title));
  return {
    id: identifier,
    title: itemTitle,
    artist: baseArtist || 'Independent artist',
    year,
    cover,
    linkUrl: sourceUrl,
    licenseUrl: cleanLicense,
    licenseName: licenseName(itemLicense),
    tracks
  };
}

async function getArchiveMetadata(identifier) {
  const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
    headers: { 'User-Agent': ARCHIVE_UA },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Internet Archive returned ${response.status}`);
  return response.json();
}

async function archiveSearch(term, broaden = false) {
  const safePhrase = String(term).replace(/["\\]/g, ' ').replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  const allowedTerms = OPEN_LICENSES.filter((license) => license.startsWith('http://'))
    .map((license) => `licenseurl:"${license}"`);
  const licenseQuery = `(${allowedTerms.join(' OR ')})`;
  let textQuery = `(title:"${safePhrase}" OR creator:"${safePhrase}")`;
  if (broaden) {
    const tokens = safePhrase.split(/\s+/).map((word) => word.replace(/[^\p{L}\p{N}_-]/gu, '')).filter(Boolean).slice(0, 4);
    if (tokens.length) textQuery = `title:(${tokens.map((word) => `"${word}"`).join(' OR ')})`;
  }
  const query = `mediatype:audio AND collection:netlabels AND ${licenseQuery} AND ${textQuery}`;
  const params = new URLSearchParams();
  params.set('q', query);
  ['identifier', 'title', 'creator', 'licenseurl', 'year'].forEach((field) => params.append('fl[]', field));
  params.set('rows', '20');
  params.set('output', 'json');
  const response = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`, {
    headers: { 'User-Agent': ARCHIVE_UA, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Open music catalog returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.response?.docs || [];
}

function publicCatalogTrack(track) {
  if (!track || track.source !== 'admin-catalog') return track;
  const { lyricsText = '', assets = [], audioFilename, artworkFilename, legacyUpload, ...record } = track;
  const lyricAsset = assets.find((asset) => asset.kind === 'lyrics-file');
  const id = encodeURIComponent(track.id);
  return {
    ...record,
    lyricsUrl: lyricsText ? `/api/catalog/${id}/lyrics` : lyricAsset ? `/api/catalog/${id}/assets/${encodeURIComponent(lyricAsset.id)}` : '',
    attachments: assets.filter((asset) => asset.kind !== 'lyrics-file').map((asset) => ({
      id: asset.id, name: asset.name, contentType: asset.contentType, size: asset.size,
      downloadUrl: `/api/catalog/${id}/assets/${encodeURIComponent(asset.id)}`
    }))
  };
}

function adminCatalogTrack(track) {
  return { ...publicCatalogTrack(track), lyricsText: String(track?.lyricsText || '') };
}

function getPublicTracks() {
  const baseTracks = Array.isArray(store.tracks) ? store.tracks : seedTracks;
  const catalogTracks = (Array.isArray(store.catalogUploads) ? store.catalogUploads : []).filter((t) => !t.isFlagged);
  const unique = new Map();
  for (const track of [...baseTracks, ...catalogTracks]) if (track?.id) unique.set(String(track.id), track);
  return [...unique.values()].map(publicCatalogTrack);
}

function matchesLocalTrack(track, query) {
  const needle = String(query || '').toLowerCase();
  return [track.title, track.artist, track.album, track.tag, track.licenseName]
    .some((value) => String(value || '').toLowerCase().includes(needle));
}

function adminSessionValid(req) {
  if (!ADMIN_AUTH_ENABLED) return false;
  const parts = cookieValue(req, ADMIN_COOKIE).split('.');
  if (parts.length !== 3) return false;
  const [expiresText, nonce, signature] = parts;
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires <= Date.now() || !/^[a-f0-9]{32}$/.test(nonce || '')) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${expiresText}.${nonce}`).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch (_error) { return false; }
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function setAdminCookie(res, token, req, clear = false) {
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${ADMIN_COOKIE}=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${clear ? 0 : Math.floor(ADMIN_SESSION_MS / 1000)}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function requireAdmin(req, res, next) {
  if (!ADMIN_AUTH_ENABLED) return res.status(503).json({ error: 'Admin access is not configured. Set KODA_ADMIN_PASSWORD and KODA_SESSION_SECRET in .env.' });
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin admin requests are not allowed.' });
    } catch (_error) { return res.status(403).json({ error: 'Invalid request origin.' }); }
  }
  if (!adminSessionValid(req)) return res.status(401).json({ error: 'Admin sign-in required.' });
  next();
}

function requireUploaderOrAdmin(req, res, next) {
  if (adminSessionValid(req)) return next();
  if (req.user && !req.user.isGuest) return next();
  return res.status(401).json({ error: 'Please sign in or create an account to upload audio.' });
}

const loginAttempts = new Map();
function limitAdminLogin(req, res, next) {
  const key = String(req.ip || req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  let attempt = loginAttempts.get(key);
  if (!attempt || now >= attempt.resetAt) attempt = { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (attempt.count >= 8) return res.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' });
  attempt.count += 1;
  loginAttempts.set(key, attempt);
  req.adminAttemptKey = key;
  next();
}

const ADMIN_LICENSES = {
  authorized: { name: 'Authorized streaming only · no public reuse license', url: '' },
  'cc-by-4.0': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-sa-4.0': { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  'cc-by-3.0': { name: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
  'cc-by-sa-3.0': { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  cc0: { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  pdm: { name: 'Public Domain Mark 1.0', url: 'https://creativecommons.org/publicdomain/mark/1.0/' }
};
const ALLOWED_GENRES = new Set(['ambient', 'acoustic', 'electronic', 'experimental', 'indie', 'jazz', 'rock', 'folk', 'world', 'piano', 'soul', 'house', 'disco', 'dub', 'other']);
const ATTACHMENT_LIMIT = 40 * 1024 * 1024;
const ARTWORK_LIMIT = 15 * 1024 * 1024;
const LYRICS_FILE_LIMIT = 5 * 1024 * 1024;

function cleanText(value, maxLength) {
  return sanitizeText(value, maxLength);
}

function safeDisplayFilename(value) {
  return path.basename(String(value || 'file')).replace(/[\x00-\x1f<>:"\/\\|?*]/g, '_').slice(0, 140) || 'file';
}

function secureExternalUrl(value, fieldName) {
  const text = cleanText(value, 500);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:') throw new Error('https only');
    return url.toString();
  } catch (_error) {
    throw new Error(`${fieldName} must be a valid HTTPS URL.`);
  }
}

function uploadedFilesList(files = {}) {
  return Object.values(files).flat().filter(Boolean);
}

function removeUploadedFiles(files = {}) {
  for (const file of uploadedFilesList(files)) fs.unlink(file.path, () => {});
}

function sendCatalogAsset(res, asset) {
  const filePath = path.join(CATALOG_ASSETS_DIR, path.basename(asset.diskName || ''));
  if (!asset.diskName || !filePath.startsWith(`${CATALOG_ASSETS_DIR}${path.sep}`)) return res.status(404).json({ error: 'Attachment not found.' });
  res.download(filePath, safeDisplayFilename(asset.name), (error) => {
    if (error && !res.headersSent) res.status(error.code === 'ENOENT' ? 404 : 500).json({ error: 'Could not deliver this attachment.' });
  });
}

// ==================== USER AUTHENTICATION ENDPOINTS (PHASE 3) ====================
app.get('/api/auth/me', (req, res) => {
  if (!req.user) {
    return res.json({ authenticated: false, isGuest: false, user: null });
  }
  res.json({
    authenticated: !req.user.isGuest,
    isGuest: Boolean(req.user.isGuest),
    user: req.user
  });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name, handle } = req.body;
    const result = await registerUser({
      email: sanitizeText(email, 120),
      password: String(password || ''),
      name: sanitizeText(name, 32),
      handle: sanitizeText(handle, 24)
    });
    setUserCookie(res, result.token, req);
    res.status(201).json({ ok: true, user: result.user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser({
      email: sanitizeText(email, 120),
      password: String(password || '')
    });
    setUserCookie(res, result.token, req);
    res.json({ ok: true, user: result.user });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/guest', (req, res) => {
  const result = createGuestSession();
  setUserCookie(res, result.token, req);
  res.json({ ok: true, isGuest: true, user: result.user });
});

app.post('/api/auth/logout', (req, res) => {
  clearUserCookie(res, req);
  res.json({ ok: true });
});

app.get('/api/auth/google', (req, res) => {
  const authUrl = getGoogleAuthUrl(req);
  if (!authUrl) {
    return res.status(503).json({
      error: 'Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
    });
  }
  res.redirect(authUrl);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.redirect('/?error=google_auth_failed');
  }
  try {
    const result = await handleGoogleCallback(code, req);
    setUserCookie(res, result.token, req);
    res.redirect('/');
  } catch (error) {
    console.error('[Google OAuth error]:', error.message);
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const email = sanitizeText(req.body.email, 120);
    const result = await requestPasswordReset(email);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await completePasswordReset({
      token: sanitizeText(token, 64),
      newPassword: String(newPassword || '')
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/session', (req, res) => {
  const isAuth = ADMIN_AUTH_ENABLED && adminSessionValid(req);
  res.json({
    enabled: ADMIN_AUTH_ENABLED,
    authenticated: isAuth
  });
});

app.post('/api/admin/login', limitAdminLogin, (req, res) => {
  if (!ADMIN_AUTH_ENABLED) return res.status(503).json({ error: 'Admin access is not configured. Set KODA_ADMIN_PASSWORD and KODA_SESSION_SECRET in .env.' });
  const supplied = Buffer.from(String(req.body.password || ''));
  const expected = Buffer.from(ADMIN_PASSWORD);
  const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (!valid) return res.status(401).json({ error: 'That admin password did not match.' });
  loginAttempts.delete(req.adminAttemptKey);
  const expires = String(Date.now() + ADMIN_SESSION_MS);
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(`${expires}.${nonce}`).digest('base64url');
  setAdminCookie(res, `${expires}.${nonce}.${signature}`, req);
  res.json({ ok: true, authenticated: true, expiresAt: Number(expires) });
});

app.post('/api/admin/logout', (_req, res) => {
  setAdminCookie(res, '', _req, true);
  res.json({ ok: true });
});

app.get('/api/admin/catalog', requireAdmin, (_req, res) => {
  res.json({ items: (store.catalogUploads || []).map(adminCatalogTrack) });
});

app.patch('/api/admin/catalog/:id', requireAdmin, (req, res) => {
  const track = (store.catalogUploads || []).find((item) => item.id === req.params.id);
  if (!track) return res.status(404).json({ error: 'Shared catalog track not found.' });
  if (req.body.rightsConfirmed !== true && req.body.rightsConfirmed !== 'true') return res.status(400).json({ error: 'Confirm that the updated rights and attribution details are accurate.' });
  const title = cleanText(req.body.title, 100);
  const artist = cleanText(req.body.artist, 100);
  if (!title || !artist) return res.status(400).json({ error: 'Track title and artist are required.' });
  const license = ADMIN_LICENSES[String(req.body.license || '')];
  if (!license) return res.status(400).json({ error: 'Choose a valid rights / license option.' });
  let sourceUrl;
  try { sourceUrl = secureExternalUrl(req.body.sourceUrl, 'Source URL'); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const yearText = cleanText(req.body.year, 4);
  if (yearText && (!/^\d{4}$/.test(yearText) || Number(yearText) < 1900 || Number(yearText) > new Date().getFullYear() + 1)) return res.status(400).json({ error: 'Enter a valid four-digit release year.' });
  const requestedGenre = cleanText(req.body.genre, 24).toLowerCase();
  track.title = title;
  track.artist = artist;
  track.album = cleanText(req.body.album, 100) || 'KODA shared catalog';
  track.year = yearText;
  track.tag = ALLOWED_GENRES.has(requestedGenre) ? requestedGenre : 'other';
  track.licenseName = license.name;
  track.licenseUrl = license.url;
  track.sourceUrl = sourceUrl;
  track.linkUrl = sourceUrl;
  track.rightsStatement = cleanText(req.body.rightsStatement, 1000);
  track.updatedAt = new Date().toISOString();
  if (Object.prototype.hasOwnProperty.call(req.body, 'lyricsText')) track.lyricsText = sanitizeMultiline(req.body.lyricsText, 60000);
  const publicVersion = publicCatalogTrack(track);
  const updateEmbedded = (entry) => { if (entry?.id === track.id) Object.assign(entry, publicVersion); };
  for (const item of store.tracks || []) updateEmbedded(item);
  for (const room of store.rooms || []) {
    updateEmbedded(room.currentTrack);
    for (const queued of room.queue || []) updateEmbedded(queued.track);
  }
  for (const playlist of store.playlists || []) for (const item of playlist.tracks || []) updateEmbedded(item);
  for (const activity of store.activityFeed || []) updateEmbedded(activity.track);
  saveStore();
  broadcast('catalog_updated', getPublicTracks());
  broadcastRooms();
  broadcast('playlists_updated', store.playlists);
  broadcast('activity_updated', store.activityFeed);
  res.json({ track: publicVersion, tracks: getPublicTracks(), items: (store.catalogUploads || []).map(adminCatalogTrack) });
});

app.post('/api/admin/catalog', mediaUploadLimiter, requireAdmin, catalogUpload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'artwork', maxCount: 1 },
  { name: 'lyricsFile', maxCount: 1 },
  { name: 'attachments', maxCount: 7 }
]), async (req, res) => {
  const files = req.files || {};
  const audioFile = files.audio?.[0];
  const artworkFile = files.artwork?.[0];
  const lyricsFile = files.lyricsFile?.[0];
  const attachmentFiles = files.attachments || [];
  const fail = (status, message) => { removeUploadedFiles(files); return res.status(status).json({ error: message }); };
  if (req.body.rightsConfirmed !== 'true') return fail(400, 'Confirm that you have the right to share every uploaded item.');
  if (!audioFile) return fail(400, 'Choose an audio file for the shared catalog track.');
  if (artworkFile && artworkFile.size > ARTWORK_LIMIT) return fail(413, 'Cover artwork must be 15 MB or smaller.');
  if (lyricsFile && lyricsFile.size > LYRICS_FILE_LIMIT) return fail(413, 'Lyrics files must be 5 MB or smaller.');
  if (attachmentFiles.some((file) => file.size > ATTACHMENT_LIMIT)) return fail(413, 'Each attachment must be 40 MB or smaller.');

  // Enforce server-side MIME type inspection (magic byte checks) for uploaded audio
  const audioInspection = await inspectAudioFile(audioFile.path);
  if (!audioInspection.valid) {
    return fail(400, 'Invalid audio file format. Server-side magic byte inspection failed.');
  }

  // Enforce server-side MIME inspection for artwork if provided
  if (artworkFile) {
    const artworkInspection = await inspectImageFile(artworkFile.path);
    if (!artworkInspection.valid) {
      return fail(400, 'Invalid cover artwork format. Only genuine image files (JPEG, PNG, WebP, GIF) are allowed.');
    }
  }

  let title = cleanText(req.body.title, 100);
  const artist = cleanText(req.body.artist, 100);
  if (!title) title = path.basename(audioFile.originalname, path.extname(audioFile.originalname)).slice(0, 100);
  if (!title || !artist) return fail(400, 'Track title and artist are required.');

  let license;
  let sourceUrl;
  try {
    license = ADMIN_LICENSES[String(req.body.license || 'authorized')];
    if (!license) throw new Error('Choose a valid rights / license option.');
    sourceUrl = secureExternalUrl(req.body.sourceUrl, 'Source URL');
  } catch (error) {
    return fail(400, error.message);
  }

  const yearText = cleanText(req.body.year, 4);
  if (yearText && (!/^\d{4}$/.test(yearText) || Number(yearText) < 1900 || Number(yearText) > new Date().getFullYear() + 1)) {
    return fail(400, 'Enter a valid four-digit release year.');
  }
  const requestedGenre = cleanText(req.body.genre, 24).toLowerCase();
  const tag = ALLOWED_GENRES.has(requestedGenre) ? requestedGenre : 'other';
  const lyricsText = sanitizeMultiline(req.body.lyricsText, 60000);
  const assets = [];
  for (const file of [lyricsFile, ...attachmentFiles].filter(Boolean)) {
    assets.push({
      id: crypto.randomUUID(),
      kind: file.fieldname === 'lyricsFile' ? 'lyrics-file' : 'attachment',
      name: safeDisplayFilename(file.originalname),
      diskName: file.filename,
      contentType: file.mimetype || 'application/octet-stream',
      size: file.size
    });
  }
  const trackId = `catalog_${crypto.randomUUID()}`;
  const streamUrl = `/media/audio/${encodeURIComponent(audioFile.filename)}`;
  const coverUrl = artworkFile ? `/media/artwork/${encodeURIComponent(artworkFile.filename)}` : '';
  const track = {
    id: trackId,
    title,
    artist,
    album: cleanText(req.body.album, 100) || 'KODA shared catalog',
    duration: 0,
    fullDuration: 0,
    cover: coverUrl,
    streamUrl,
    downloadUrl: streamUrl,
    linkUrl: sourceUrl,
    sourceUrl,
    licenseUrl: license.url,
    licenseName: license.name,
    rightsStatement: cleanText(req.body.rightsStatement, 1000),
    year: yearText,
    tag,
    language: 'music',
    source: 'admin-catalog',
    provider: 'KODA shared catalog',
    isPreview: false,
    fileSize: audioFile.size,
    uploadedAt: new Date().toISOString(),
    lyricsText,
    assets,
    audioFilename: audioFile.filename,
    artworkFilename: artworkFile?.filename || ''
  };
  store.catalogUploads = store.catalogUploads || [];
  store.tracks = store.tracks || seedTracks.slice();
  await repository.addCatalogUpload(track);
  broadcast('catalog_updated', getPublicTracks());
  res.status(201).json({ track: publicCatalogTrack(track), tracks: getPublicTracks(), items: store.catalogUploads.map(adminCatalogTrack) });
});

app.delete('/api/admin/catalog/:id', requireAdmin, async (req, res) => {
  const track = (store.catalogUploads || []).find((item) => item.id === req.params.id);
  if (!track) return res.status(404).json({ error: 'Shared catalog track not found.' });
  await repository.deleteCatalogUpload(track.id);
  store.tracks = (store.tracks || []).filter((item) => item.id !== track.id);
  for (const room of store.rooms || []) {
    if (room.currentTrack?.id === track.id) { room.currentTrack = null; room.isPlaying = false; room.pausedPosition = 0; }
    room.queue = (room.queue || []).filter((item) => item.track?.id !== track.id);
  }
  for (const playlist of store.playlists || []) playlist.tracks = (playlist.tracks || []).filter((item) => item.id !== track.id);
  store.activityFeed = (store.activityFeed || []).filter((item) => item.track?.id !== track.id);
  const filesToRemove = [
    [track.legacyUpload ? UPLOADS_DIR : CATALOG_AUDIO_DIR, track.audioFilename],
    [CATALOG_ARTWORK_DIR, track.artworkFilename],
    ...(track.assets || []).map((asset) => [CATALOG_ASSETS_DIR, asset.diskName])
  ];
  for (const [directory, filename] of filesToRemove) {
    if (filename) fs.unlink(path.join(directory, path.basename(filename)), () => {});
  }
  saveStore();
  broadcast('catalog_updated', getPublicTracks());
  broadcastRooms();
  broadcast('playlists_updated', store.playlists);
  broadcast('activity_updated', store.activityFeed);
  res.json({ ok: true, tracks: getPublicTracks(), items: store.catalogUploads.map(adminCatalogTrack) });
});

app.get('/api/catalog/:id/lyrics', (req, res) => {
  const track = (store.catalogUploads || []).find((item) => item.id === req.params.id);
  if (!track || !track.lyricsText) return res.status(404).json({ error: 'Lyrics not found.' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type('text/plain; charset=utf-8').send(track.lyricsText);
});

app.get('/api/catalog/:id/assets/:assetId', (req, res) => {
  const track = (store.catalogUploads || []).find((item) => item.id === req.params.id);
  const asset = track?.assets?.find((item) => item.id === req.params.assetId);
  if (!asset) return res.status(404).json({ error: 'Attachment not found.' });
  sendCatalogAsset(res, asset);
});

app.get('/api/bootstrap', (_req, res) => {
  res.json({
    tracks: getPublicTracks(),
    uploads: (store.uploads || []).map(publicCatalogTrack),
    rooms: getRooms(),
    playlists: store.playlists,
    friends: store.friends,
    activityFeed: store.activityFeed
  });
});

// Search the Internet Archive Netlabels collection, keeping only explicit CC/PD licenses.
app.get('/api/search', async (req, res) => {
  const term = sanitizeText(req.query.q, 100);
  if (!term) return res.json({ songs: getPublicTracks(), albums: [], query: '' });
  const localTracks = getPublicTracks().filter((track) => matchesLocalTrack(track, term));

  try {
    let docs = await archiveSearch(term, false);
    if (!docs.length && term.includes(' ')) docs = await archiveSearch(term, true);
    const seen = new Set();
    const candidates = docs.filter((doc) => doc.identifier && isAllowedLicense(doc.licenseurl) && !seen.has(doc.identifier) && seen.add(doc.identifier)).slice(0, 14);
    const results = await Promise.allSettled(candidates.map(async (doc) => {
      const metadata = await getArchiveMetadata(doc.identifier);
      const item = formatArchiveItem(doc.identifier, metadata);
      if (!item) return null;
      return { item, tracks: item.tracks };
    }));

    const albums = [];
    const songs = [];
    const seenTracks = new Set();
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const { item, tracks } = result.value;
      albums.push({ id: item.id, title: item.title, artist: item.artist, year: item.year, cover: item.cover, linkUrl: item.linkUrl, licenseUrl: item.licenseUrl, licenseName: item.licenseName });
      for (const track of tracks) {
        if (seenTracks.has(track.id)) continue;
        seenTracks.add(track.id);
        songs.push(track);
      }
    }
    const merged = [];
    const mergedIds = new Set();
    for (const track of [...localTracks, ...songs]) {
      if (!track?.id || mergedIds.has(track.id)) continue;
      mergedIds.add(track.id);
      merged.push(track);
    }
    res.json({ songs: merged.slice(0, 60), albums, query: term, provider: 'KODA catalog + Internet Archive Netlabels · open licenses' });
  } catch (error) {
    if (localTracks.length) return res.json({ songs: localTracks, albums: [], query: term, provider: 'KODA local catalog', warning: 'Internet Archive search is unavailable; showing local catalog matches.' });
    res.status(502).json({ error: 'The open music catalog is unavailable right now.', details: error.message, songs: [], albums: [] });
  }
});

app.get('/api/album/:identifier', async (req, res) => {
  const identifier = String(req.params.identifier || '');
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(identifier)) return res.status(400).json({ error: 'Invalid archive item id.' });
  try {
    const metadata = await getArchiveMetadata(identifier);
    const item = formatArchiveItem(identifier, metadata);
    if (!item) return res.status(403).json({ error: 'This item does not have a supported open license.' });
    res.json(item);
  } catch (error) {
    res.status(502).json({ error: 'Could not load this open release.', details: error.message });
  }
});

app.post('/api/rooms', roomCreationLimiter, async (req, res) => {
  if (req.user && req.user.isGuest) {
    return res.status(403).json({
      error: 'Account required: Please create a free account or sign in to host permanent rooms.',
      requiresAuth: true
    });
  }
  const name = sanitizeText(req.body.name, 48) || 'Untitled room';
  const vibe = sanitizeText(req.body.vibe, 64) || 'Open format';
  const host = req.user ? sanitizeUser(req.user) : sanitizeUser(req.body.host);
  const room = {
    id: `room-${Date.now()}`, code: `KODA-${String(Math.floor(10 + Math.random() * 90))}`,
    name, subtitle: 'New listening room', vibe, host,
    isPlaying: Boolean(req.body.track), currentTrack: req.body.track || getPublicTracks()[0] || null,
    startedAt: Date.now(), pausedPosition: 0,
    listeners: [{ ...host, role: 'HOST' }], queue: [], chat: [
      { id: `msg-${Date.now()}`, user: host, text: `${name} is open. Welcome in.`, time: 'now', type: 'system' }
    ]
  };
  await repository.createRoom(room);
  broadcastRooms();
  res.json({ room, rooms: getRooms() });
});

app.post(['/api/rooms/:roomId/join', '/api/rooms/:id/join'], async (req, res) => {
  const roomId = req.params.roomId || req.params.id;
  const room = store.rooms.find((item) => item.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const user = sanitizeUser(req.body.user);
  if (!room.listeners.some((listener) => listener.handle === user.handle)) {
    const joinMsg = { id: `msg-${Date.now()}`, user, text: `${user.name || 'A listener'} joined the room.`, time: 'now', type: 'system' };
    await repository.updateRoom(roomId, (r) => {
      r.listeners.push({ ...user, role: 'LISTENING' });
    });
    await repository.addRoomMessage(roomId, joinMsg);
  }
  broadcastRooms();
  res.json({ room: { ...room, currentPosition: getRoomPosition(room) }, rooms: getRooms() });
});

app.post(['/api/rooms/:roomId/sync', '/api/rooms/:id/sync'], async (req, res) => {
  const roomId = req.params.roomId || req.params.id;
  const room = store.rooms.find((item) => item.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { isPlaying, track, position, action } = req.body;
  const user = req.body.user ? sanitizeUser(req.body.user) : null;

  await repository.updateRoom(roomId, (r) => {
    if (action === 'next_in_queue') {
      const next = r.queue.shift();
      if (next) {
        r.currentTrack = next.track;
        r.isPlaying = true;
        r.startedAt = Date.now();
        r.pausedPosition = 0;
      }
    } else if (action === 'previous') {
      r.pausedPosition = 0;
      r.startedAt = Date.now();
    } else {
      if (typeof position === 'number') {
        const duration = Number(r.currentTrack?.duration) || 3600;
        const safePosition = Math.max(0, Math.min(position, duration));
        r.pausedPosition = safePosition;
        r.startedAt = Date.now() - safePosition * 1000;
      }
      if (track) {
        r.currentTrack = track;
        const duration = Number(track.duration) || 3600;
        r.pausedPosition = Math.max(0, Math.min(Number(position) || 0, duration));
        r.startedAt = Date.now() - r.pausedPosition * 1000;
      }
      if (typeof isPlaying === 'boolean') {
        if (isPlaying && !r.isPlaying) r.startedAt = Date.now() - (r.pausedPosition || 0) * 1000;
        if (!isPlaying && r.isPlaying) r.pausedPosition = getRoomPosition(r);
        r.isPlaying = isPlaying;
      }
    }

    if (user && user.handle && !r.listeners.some((listener) => listener.handle === user.handle)) {
      r.listeners.push({ ...user, role: 'LISTENING' });
    }
  });

  broadcastRooms('room_synced');
  res.json({ rooms: getRooms() });
});

app.post(['/api/rooms/:roomId/queue', '/api/rooms/:id/queue'], async (req, res) => {
  const roomId = req.params.roomId || req.params.id;
  const room = store.rooms.find((item) => item.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const track = req.body.track;
  if (!track || !track.streamUrl) return res.status(400).json({ error: 'A playable track is required.' });
  const user = sanitizeUser(req.body.user);
  const note = sanitizeText(req.body.note, 140) || 'Added to the shared queue';
  const trackTitle = sanitizeText(track.title, 100) || 'track';
  const item = {
    qid: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    track, addedBy: user, note,
    votes: 1, voters: [user.handle || user.id || 'u-you']
  };
  const queueMsg = { id: `msg-${Date.now()}`, user, text: `Added “${trackTitle}” to the queue.`, time: 'now', type: 'queue_event' };

  await repository.updateRoom(roomId, (r) => {
    r.queue.push(item);
  });
  await repository.addRoomMessage(roomId, queueMsg);

  broadcastRooms();
  res.json({ rooms: getRooms(), item });
});

app.post(['/api/rooms/:roomId/queue/:qid/vote', '/api/rooms/:id/queue/:qid/vote'], async (req, res) => {
  const roomId = req.params.roomId || req.params.id;
  const room = store.rooms.find((item) => item.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const user = sanitizeUser(req.body.user);
  const key = user.handle || user.id || 'u-you';

  await repository.updateRoom(roomId, (r) => {
    const item = r.queue.find((entry) => entry.qid === req.params.qid);
    if (!item) return;
    item.voters = item.voters || [];
    const alreadyVoted = item.voters.includes(key);
    if (alreadyVoted) {
      item.voters = item.voters.filter((voter) => voter !== key);
      item.votes = Math.max(0, (item.votes || 0) - 1);
    } else {
      item.voters.push(key);
      item.votes = (item.votes || 0) + 1;
    }
    r.queue.sort((a, b) => b.votes - a.votes);
  });

  broadcastRooms();
  res.json({ rooms: getRooms() });
});

app.delete(['/api/rooms/:roomId/queue/:qid', '/api/rooms/:id/queue/:qid'], async (req, res) => {
  const roomId = req.params.roomId || req.params.id;
  const room = store.rooms.find((item) => item.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  await repository.updateRoom(roomId, (r) => {
    r.queue = r.queue.filter((entry) => entry.qid !== req.params.qid);
  });

  broadcastRooms();
  res.json({ rooms: getRooms() });
});

app.post(['/api/rooms/:roomId/chat', '/api/rooms/:id/chat'], roomChatLimiter, async (req, res) => {
  const roomId = req.params.roomId || req.params.id;
  const room = store.rooms.find((item) => item.id === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const text = sanitizeText(req.body.text, 500);
  if (!text) return res.status(400).json({ error: 'Message required.' });
  const user = req.user ? sanitizeUser(req.user) : sanitizeUser(req.body.user);
  const message = {
    id: `msg-${Date.now()}`, user, text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type: 'chat'
  };
  await repository.addRoomMessage(roomId, message);
  broadcast('rooms_updated', getRooms());
  res.json({ rooms: getRooms(), message });
});

app.post(['/api/rooms/:roomId/react', '/api/rooms/:id/react'], (req, res) => {
  const roomId = req.params.roomId || req.params.id;
  const emoji = sanitizeText(req.body.emoji, 8) || '✨';
  const user = req.user ? sanitizeUser(req.user) : sanitizeUser(req.body.user);
  const reaction = { id: `rx-${Date.now()}`, roomId, emoji, user };
  broadcast('room_reaction', reaction);
  res.json({ ok: true, reaction });
});

app.post('/api/playlists', playlistActionLimiter, async (req, res) => {
  if (req.user && req.user.isGuest) {
    return res.status(403).json({
      error: 'Account required: Please create a free account or sign in to save collaborative tapes.',
      requiresAuth: true
    });
  }
  const user = req.user ? sanitizeUser(req.user) : sanitizeUser(req.body.user);
  const title = sanitizeText(req.body.title, 64) || 'Untitled tape';
  if (!title) return res.status(400).json({ error: 'Give your tape a name.' });
  const subtitle = sanitizeText(req.body.subtitle, 90) || 'A collaborative crew tape';
  const description = sanitizeMultiline(req.body.description, 240) || 'A shared tape. Add a song and leave a note for the crew.';
  const playlist = {
    id: `pl-${Date.now()}`, title: `${String(store.playlists.length + 1).padStart(2, '0')} // ${title.toUpperCase()}`,
    subtitle,
    description,
    isCollaborative: true, createdAt: new Date().toISOString().slice(0, 10), contributors: [user], tracks: [], comments: []
  };
  await repository.createPlaylist(playlist);
  broadcast('playlists_updated', store.playlists);
  res.json({ playlist, playlists: store.playlists });
});

app.post(['/api/playlists/:playlistId/tracks', '/api/playlists/:id/tracks'], async (req, res) => {
  const playlistId = req.params.playlistId || req.params.id;
  const playlist = store.playlists.find((item) => item.id === playlistId);
  if (!playlist) return res.status(404).json({ error: 'Tape not found.' });
  const track = req.body.track;
  if (!track || !track.streamUrl) return res.status(400).json({ error: 'A playable track is required.' });
  const user = sanitizeUser(req.body.user);
  const note = sanitizeText(req.body.note, 140) || 'Added from the catalog';
  const trackItem = { ...track, addedBy: user, note, addedAt: 'Just now' };
  const activity = { id: `act-${Date.now()}`, user, action: `added a song to ${playlist.title}`, track, message: sanitizeText(req.body.note || `Added “${track.title}” to the tape.`, 220), time: 'Just now', likes: 0 };
  
  await repository.addPlaylistTrack(playlistId, trackItem);
  await repository.addActivity(activity);

  broadcast('playlists_updated', store.playlists);
  broadcast('activity_updated', store.activityFeed);
  res.json({ playlist, playlists: store.playlists, activityFeed: store.activityFeed });
});

app.delete(['/api/playlists/:playlistId/tracks/:index', '/api/playlists/:id/tracks/:index'], async (req, res) => {
  const playlistId = req.params.playlistId || req.params.id;
  const playlist = store.playlists.find((item) => item.id === playlistId);
  if (!playlist) return res.status(404).json({ error: 'Tape not found.' });
  const index = Number(req.params.index);
  await repository.removePlaylistTrack(playlistId, index);
  broadcast('playlists_updated', store.playlists);
  res.json({ playlist, playlists: store.playlists });
});

app.post(['/api/playlists/:playlistId/comments', '/api/playlists/:id/comments'], playlistActionLimiter, async (req, res) => {
  const playlistId = req.params.playlistId || req.params.id;
  const playlist = store.playlists.find((item) => item.id === playlistId);
  if (!playlist) return res.status(404).json({ error: 'Tape not found.' });
  const text = sanitizeText(req.body.text, 360);
  if (!text) return res.status(400).json({ error: 'Write a note first.' });
  const user = req.user ? sanitizeUser(req.user) : sanitizeUser(req.body.user);
  const comment = { id: `c-${Date.now()}`, user, text, time: 'Just now' };
  await repository.addPlaylistComment(playlistId, comment);
  broadcast('playlists_updated', store.playlists);
  res.json({ playlist, playlists: store.playlists });
});

app.post('/api/activity/share', async (req, res) => {
  const track = req.body.track;
  if (!track || !track.streamUrl) return res.status(400).json({ error: 'Pick a playable track first.' });
  const user = sanitizeUser(req.body.user);
  const message = sanitizeText(req.body.message, 220) || 'A track for the group chat.';
  const item = {
    id: `act-${Date.now()}`, user, action: 'shared a crew pick', track,
    message, time: 'Just now', likes: 0
  };
  await repository.addActivity(item);
  broadcast('activity_updated', store.activityFeed);
  res.json({ activityFeed: store.activityFeed });
});

app.post('/api/activity/:id/like', async (req, res) => {
  await repository.likeActivity(req.params.id);
  broadcast('activity_updated', store.activityFeed);
  res.json({ activityFeed: store.activityFeed || [] });
});

// Direct-to-cloud presigned upload URL endpoint (Cloudflare R2 / AWS S3)
app.post('/api/upload/presign', mediaUploadLimiter, requireUploaderOrAdmin, async (req, res) => {
  const filename = String(req.body?.filename || 'track.mp3');
  const contentType = String(req.body?.contentType || 'audio/mpeg');
  const kind = String(req.body?.kind || 'audio');

  try {
    const presignData = await generatePresignedUploadUrl({ filename, contentType, kind });
    res.json({ ok: true, ...presignData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate cloud upload URL: ' + error.message });
  }
});

// Complete direct-to-cloud upload and register track into catalog
app.post('/api/upload/complete', mediaUploadLimiter, requireUploaderOrAdmin, async (req, res) => {
  if (req.body?.rightsConfirmed !== 'true' && req.body?.rightsConfirmed !== true) {
    return res.status(400).json({ error: 'Confirm that you have the rights to share this audio.' });
  }

  const { key, publicUrl, title, artist, album, duration } = req.body || {};
  if (!publicUrl) {
    return res.status(400).json({ error: 'Audio publicUrl is required.' });
  }

  const parsedDuration = Math.max(1, parseInt(duration, 10) || 210);
  const track = {
    id: `catalog_${crypto.randomUUID()}`,
    title: cleanText(title, 100) || path.basename(publicUrl, path.extname(publicUrl)).slice(0, 100) || 'Untitled Audio',
    artist: cleanText(artist, 100) || (req.user?.name || 'KODA Creator'),
    album: cleanText(album, 100) || 'Cloud Vault',
    duration: parsedDuration,
    fullDuration: parsedDuration,
    cover: '',
    streamUrl: publicUrl,
    downloadUrl: publicUrl,
    linkUrl: '',
    sourceUrl: '',
    licenseUrl: '',
    licenseName: ADMIN_LICENSES.authorized.name,
    rightsStatement: 'Published by authenticated creator; streaming permission attested.',
    year: new Date().getFullYear().toString(),
    tag: 'cloud',
    language: 'music',
    source: 'cloud-catalog',
    provider: isCloudStorageEnabled() ? 'Cloudflare R2 / AWS S3' : 'KODA Vault',
    isPreview: false,
    fileSize: 0,
    uploadedAt: new Date().toISOString(),
    assets: [],
    audioFilename: key || path.basename(publicUrl),
    artworkFilename: '',
    legacyUpload: false
  };

  store.catalogUploads = store.catalogUploads || [];
  store.tracks = store.tracks || seedTracks.slice();
  await repository.addCatalogUpload(track);
  broadcast('catalog_updated', getPublicTracks());
  res.status(201).json({
    ok: true,
    track: publicCatalogTrack(track),
    tracks: getPublicTracks(),
    items: store.catalogUploads.map(publicCatalogTrack)
  });
});

app.post('/api/upload', mediaUploadLimiter, requireUploaderOrAdmin, upload.single('audio'), async (req, res) => {
  if (req.body.rightsConfirmed !== 'true') {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Confirm that you have the rights to share this audio.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Choose an audio file to add.' });

  // Enforce server-side MIME type inspection (magic byte checks) for uploaded audio
  const inspection = await inspectAudioFile(req.file.path);
  if (!inspection.valid) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Invalid audio file format. Server-side magic byte inspection failed.' });
  }
  const track = {
    id: `catalog_${crypto.randomUUID()}`,
    title: cleanText(req.body.title, 100) || path.basename(req.file.originalname, path.extname(req.file.originalname)).slice(0, 100),
    artist: cleanText(req.body.artist, 100) || 'KODA Studio',
    album: cleanText(req.body.album, 100) || 'KODA shared catalog',
    duration: 210,
    fullDuration: 210,
    cover: '',
    streamUrl: `/uploads/${req.file.filename}`,
    downloadUrl: `/uploads/${req.file.filename}`,
    linkUrl: '',
    sourceUrl: '',
    licenseUrl: '',
    licenseName: ADMIN_LICENSES.authorized.name,
    rightsStatement: 'Published by the KODA administrator; streaming permission attested.',
    year: new Date().getFullYear().toString(),
    tag: 'other',
    language: 'music',
    source: 'admin-catalog',
    provider: 'KODA shared catalog',
    isPreview: false,
    fileSize: req.file.size,
    uploadedAt: new Date().toISOString(),
    assets: [],
    audioFilename: req.file.filename,
    artworkFilename: '',
    legacyUpload: true
  };
  store.catalogUploads = store.catalogUploads || [];
  store.tracks = store.tracks || seedTracks.slice();
  await repository.addCatalogUpload(track);
  broadcast('catalog_updated', getPublicTracks());
  res.status(201).json({ track: publicCatalogTrack(track), tracks: getPublicTracks(), items: store.catalogUploads.map(publicCatalogTrack) });
});

// ============================================================================
// PHASE 5: LEGAL, COMPLIANCE & DMCA PROTECTION
// ============================================================================

// Public DMCA Notice & Takedown Submission
app.post('/api/dmca/takedown', async (req, res) => {
  try {
    const noticeData = sanitizeDmcaNotice(req.body);
    const notice = {
      id: `dmca_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      ...noticeData,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await repository.addDmcaNotice(notice);
    res.status(201).json({
      ok: true,
      noticeId: notice.id,
      message: 'DMCA takedown notice received. Our designated compliance agent will review within 24-48 hours.'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Moderation: Overview of notices, flagged uploads, rooms
app.get('/api/admin/moderation', requireAdmin, async (_req, res) => {
  const dmcaNotices = await repository.getDmcaNotices();
  const rooms = (store.rooms || []).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    vibe: r.vibe,
    host: r.host,
    listenersCount: Array.isArray(r.listeners) ? r.listeners.length : 0,
    chatMessagesCount: Array.isArray(r.chat) ? r.chat.length : 0
  }));
  const flaggedTracks = (store.catalogUploads || []).filter((t) => t.isFlagged);

  res.json({
    dmcaNotices,
    flaggedTracks,
    rooms,
    totalUploads: (store.catalogUploads || []).length
  });
});

// Admin Moderation: 1-Click Track Takedown
app.post('/api/admin/moderation/takedown', requireAdmin, async (req, res) => {
  const { trackId, reason } = req.body || {};
  if (!trackId) return res.status(400).json({ error: 'trackId is required.' });

  const track = await repository.takedownTrack(trackId, reason || 'DMCA takedown notice');
  if (!track) return res.status(404).json({ error: 'Track not found.' });

  broadcast('catalog_updated', getPublicTracks());
  res.json({ ok: true, track, message: 'Track taken down from public streaming.' });
});

// Admin Moderation: 1-Click Room Delete / Purge
app.delete('/api/admin/moderation/rooms/:id', requireAdmin, async (req, res) => {
  const room = await repository.deleteRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  broadcast('room_closed', { roomId: req.params.id, reason: 'Room closed by platform administrator.' });
  res.json({ ok: true, message: 'Room purged successfully.' });
});

// Admin Moderation: 1-Click Chat Message Purge
app.delete('/api/admin/moderation/chat/:roomId/:messageId', requireAdmin, async (req, res) => {
  await repository.deleteRoomMessage(req.params.roomId, req.params.messageId);
  broadcast('chat_deleted', { roomId: req.params.roomId, messageId: req.params.messageId });
  res.json({ ok: true, message: 'Message removed.' });
});

// Admin Moderation: Action DMCA Notice
app.post('/api/admin/moderation/dmca/:id/action', requireAdmin, async (req, res) => {
  const { status = 'actioned', adminNotes = '' } = req.body || {};
  const notice = await repository.actionDmcaNotice(req.params.id, { status, adminNotes });
  if (!notice) return res.status(404).json({ error: 'DMCA notice not found.' });
  res.json({ ok: true, notice });
});

// ============================================================================
// PHASE 6: MONETIZATION & COMMERCIAL PACKAGING
// ============================================================================

// Subscription Tiers & Benefits
app.get('/api/billing/tiers', (_req, res) => {
  res.json({
    tiers: TIERS,
    isStripeConfigured: isStripeConfigured()
  });
});

// Create Stripe Checkout Session
app.post('/api/billing/create-checkout-session', async (req, res) => {
  if (!req.user || req.user.isGuest) {
    return res.status(401).json({ error: 'Sign in to upgrade your subscription.' });
  }

  const { tier = 'pro', successUrl, cancelUrl } = req.body || {};
  try {
    const session = await createCheckoutSession({
      userId: req.user.id,
      userEmail: req.user.email,
      tier,
      successUrl: successUrl || `${req.headers.origin || 'http://localhost:3000'}/?billing=success`,
      cancelUrl: cancelUrl || `${req.headers.origin || 'http://localhost:3000'}/?billing=cancel`
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe Webhook Endpoint
app.post('/api/billing/webhook', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  try {
    const result = await handleStripeWebhook({
      rawBody: req.rawBody || req.body,
      signature,
      repository
    });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Virtual Tipping in Creator Rooms
app.post('/api/rooms/:id/tip', async (req, res) => {
  const { amountCents = 500, senderName, message } = req.body || {};
  const user = req.user && !req.user.isGuest ? req.user : null;

  try {
    const tip = await processRoomTip({
      roomId: req.params.id,
      senderName: senderName || user?.name || 'Anonymous Fan',
      senderUserId: user?.id || null,
      amountCents,
      message,
      repository
    });

    broadcast('room_tip', {
      roomId: req.params.id,
      tip,
      announcement: `${tip.senderName} tipped $${(tip.amountCents / 100).toFixed(2)}: "${tip.message || 'Keep the vibes going!'}"`
    });

    res.status(201).json({ ok: true, tip });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Creator Stripe Connect onboarding for direct tip disbursements
app.post('/api/creator/connect-link', async (req, res) => {
  if (!req.user || req.user.isGuest) {
    return res.status(401).json({ error: 'Sign in to configure creator payout settings.' });
  }
  try {
    const link = await createConnectAccountLink({
      userId: req.user.id,
      userEmail: req.user.email,
      returnUrl: `${req.headers.origin || 'http://localhost:3000'}/?connect=success`,
      refreshUrl: `${req.headers.origin || 'http://localhost:3000'}/?connect=refresh`
    });
    res.json(link);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stateful session invalidation across all devices
app.post('/api/auth/logout-all', (req, res) => {
  if (req.user && !req.user.isGuest) {
    revokeUserTokens(req.user.id);
  }
  clearUserCookie(res);
  res.json({ ok: true, message: 'All active sessions have been revoked.' });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'KODA', version: '1.0.0' }));

app.use((error, req, res, _next) => {
  if (req.files) removeUploadedFiles(req.files);
  if (req.file?.path) fs.unlink(req.file.path, () => {});
  const limitCodes = new Set(['LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'LIMIT_FIELD_COUNT', 'LIMIT_PART_COUNT', 'LIMIT_FIELD_VALUE']);
  const status = limitCodes.has(error?.code) ? 413 : Number(error?.status) || 400;
  res.status(status).json({ error: error.message || 'Request could not be completed.' });
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ event: 'connected', payload: { online: true }, ts: Date.now() }));

  // NTP-style clock drift synchronization protocol
  socket.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg && msg.type === 'sync_ping') {
        socket.send(JSON.stringify({
          type: 'sync_pong',
          clientTime: msg.clientTime,
          serverTime: Date.now()
        }));
      }
    } catch (_) {}
  });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`KODA listening on http://0.0.0.0:${PORT}`);
  });
}

module.exports = {
  app,
  server,
  repository,
  inspectAudioFile,
  inspectImageFile,
  sanitizeText,
  sanitizeMultiline,
  sanitizeUser,
  cleanText,
  registerUser,
  loginUser,
  createGuestSession,
  generateToken,
  verifyToken,
  requestPasswordReset,
  completePasswordReset,
  generatePresignedUploadUrl,
  streamAudioWithByteRange,
  isCloudStorageEnabled,
  getTermsOfService,
  getPrivacyPolicy,
  getDmcaPolicy,
  sanitizeDmcaNotice,
  TIERS,
  createCheckoutSession,
  handleStripeWebhook,
  createConnectAccountLink,
  processRoomTip,
  publishClusterMessage,
  subscribeClusterMessage,
  revokeUserTokens
};
