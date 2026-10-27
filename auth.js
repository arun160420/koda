const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma, isConnected } = require('./db');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('./mailer');

const USER_COOKIE = 'koda_user_session';
const JWT_SECRET = process.env.KODA_SESSION_SECRET || process.env.JWT_SECRET || 'koda_default_jwt_secret_change_in_prod_32char';
const BCRYPT_ROUNDS = 12;

// In-memory fallback user store when database is not connected
const memoryUsers = new Map();
// Stateful JWT revocation tracker
const userTokenVersions = new Map();

function revokeUserTokens(userId) {
  const nextVersion = (userTokenVersions.get(userId) || 1) + 1;
  userTokenVersions.set(userId, nextVersion);
  return nextVersion;
}

function isTokenRevoked(payload) {
  if (!payload || !payload.id || payload.isGuest) return false;
  const currentVersion = userTokenVersions.get(payload.id);
  if (currentVersion && payload.tokenVersion && payload.tokenVersion < currentVersion) {
    return true;
  }
  return false;
}

// Seed initial default user
memoryUsers.set('u-you', {
  id: 'u-you',
  email: 'you@koda.studio',
  password_hash: null,
  name: 'You',
  handle: '@you',
  avatar_url: 'YO',
  color: '#ff5a1f',
  role: 'ADMIN',
  created_at: new Date()
});

function generateToken(user, isGuest = false) {
  const currentVersion = user.id ? (userTokenVersions.get(user.id) || 1) : 1;
  const payload = {
    id: user.id,
    email: user.email || null,
    name: user.name,
    handle: user.handle,
    avatar: user.avatar_url || user.avatar || 'YO',
    color: user.color || '#ff5a1f',
    role: user.role || (isGuest ? 'GUEST' : 'LISTENER'),
    isGuest: Boolean(isGuest),
    tokenVersion: currentVersion
  };
  const expiresIn = isGuest ? '24h' : '7d';
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (isTokenRevoked(payload)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function setUserCookie(res, token, req) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const cookieParts = [
    `${USER_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 60 * 60}`
  ];
  if (isSecure) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearUserCookie(res, req) {
  const isSecure = req && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  const cookieParts = [
    `${USER_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (isSecure) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function extractToken(req) {
  // 1. From cookie
  const prefix = `${USER_COOKIE}=`;
  for (const part of String(req.headers.cookie || '').split(';')) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) {
      try { return decodeURIComponent(entry.slice(prefix.length)); } catch (_) { return ''; }
    }
  }

  // 2. From Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

function attachUser(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
      return next();
    }
  }
  req.user = null;
  next();
}

function requireRegisteredUser(req, res, next) {
  if (!req.user || req.user.isGuest) {
    return res.status(403).json({
      error: 'Account required: Please create a free account or sign in to perform this action.',
      requiresAuth: true
    });
  }
  next();
}

// ---------- Authentication Operations ----------
async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (isConnected() && prisma) {
    try {
      return await prisma.user.findUnique({ where: { email: normalized } });
    } catch (err) {
      console.warn('[Auth] DB lookup error:', err.message);
    }
  }
  for (const u of memoryUsers.values()) {
    if (u.email && u.email.toLowerCase() === normalized) return u;
  }
  return null;
}

async function findUserByHandle(handle) {
  const normalized = String(handle || '').trim().toLowerCase();
  if (isConnected() && prisma) {
    try {
      return await prisma.user.findUnique({ where: { handle: normalized } });
    } catch (err) {
      console.warn('[Auth] DB lookup error:', err.message);
    }
  }
  for (const u of memoryUsers.values()) {
    if (u.handle && u.handle.toLowerCase() === normalized) return u;
  }
  return null;
}

async function registerUser({ email, password, name, handle }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const existingEmail = await findUserByEmail(cleanEmail);
  if (existingEmail) {
    throw new Error('An account with this email already exists.');
  }

  const cleanHandle = (handle ? String(handle) : `@${cleanEmail.split('@')[0]}`)
    .trim()
    .replace(/^@*/, '@')
    .slice(0, 24);

  const cleanName = String(name || cleanEmail.split('@')[0]).trim().slice(0, 32);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const userId = `u-${crypto.randomUUID()}`;
  const avatar = cleanName.slice(0, 2).toUpperCase() || 'YO';

  const userRecord = {
    id: userId,
    email: cleanEmail,
    password_hash: passwordHash,
    name: cleanName,
    handle: cleanHandle,
    avatar_url: avatar,
    color: '#ff5a1f',
    role: 'LISTENER',
    created_at: new Date()
  };

  if (isConnected() && prisma) {
    try {
      const created = await prisma.user.create({
        data: {
          id: userRecord.id,
          email: userRecord.email,
          password_hash: userRecord.password_hash,
          name: userRecord.name,
          handle: userRecord.handle,
          avatar_url: userRecord.avatar_url,
          color: userRecord.color,
          role: userRecord.role
        }
      });
      memoryUsers.set(created.id, created);
    } catch (err) {
      console.warn('[Auth] DB create user failed, saving to memory:', err.message);
      memoryUsers.set(userRecord.id, userRecord);
    }
  } else {
    memoryUsers.set(userRecord.id, userRecord);
  }

  const token = generateToken(userRecord, false);
  return {
    user: {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      handle: userRecord.handle,
      avatar: userRecord.avatar_url,
      color: userRecord.color,
      role: userRecord.role
    },
    token
  };
}

async function loginUser({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);
  if (!user || !user.password_hash) {
    throw new Error('Incorrect email or password.');
  }

  const isValid = await bcrypt.compare(String(password || ''), user.password_hash);
  if (!isValid) {
    throw new Error('Incorrect email or password.');
  }

  const token = generateToken(user, false);
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: user.handle,
      avatar: user.avatar_url,
      color: user.color || '#ff5a1f',
      role: user.role
    },
    token
  };
}

function createGuestSession() {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const guestUser = {
    id: `guest-${crypto.randomUUID().slice(0, 8)}`,
    email: null,
    name: `Listener ${randomSuffix}`,
    handle: `@guest_${randomSuffix}`,
    avatar_url: 'GS',
    color: '#8e8e93',
    role: 'GUEST'
  };

  const token = generateToken(guestUser, true);
  return { user: guestUser, token };
}

// Google OAuth 2.0 Integration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

function getGoogleAuthUrl(req) {
  if (!GOOGLE_CLIENT_ID) {
    return null;
  }
  const host = req.get('host');
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function handleGoogleCallback(code, req) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth is not configured on this server.');
  }

  const host = req.get('host');
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`;

  // Exchange code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Retrieve user info from Google
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!userRes.ok) {
    throw new Error('Failed to retrieve user profile from Google.');
  }

  const googleProfile = await userRes.json();
  const email = String(googleProfile.email).toLowerCase();
  const name = googleProfile.name || googleProfile.given_name || 'Listener';
  const avatar = name.slice(0, 2).toUpperCase() || 'GO';

  // Check if user already exists
  let user = await findUserByEmail(email);
  if (!user) {
    const handle = `@${email.split('@')[0]}_${Math.floor(100 + Math.random() * 900)}`;
    const userId = `u-google-${crypto.randomUUID().slice(0, 8)}`;
    user = {
      id: userId,
      email,
      name,
      handle,
      avatar_url: avatar,
      color: '#4285F4',
      role: 'LISTENER',
      created_at: new Date()
    };

    if (isConnected() && prisma) {
      try {
        user = await prisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            name: user.name,
            handle: user.handle,
            avatar_url: user.avatar_url,
            color: user.color,
            role: user.role
          }
        });
      } catch (err) {
        console.warn('[Auth] Google user DB create failed:', err.message);
      }
    }
    memoryUsers.set(user.id, user);
  }

  const sessionToken = generateToken(user, false);
  return { user, token: sessionToken };
}

// Password Reset Flow
const resetTokens = new Map();

async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);
  if (!user) {
    // For security, return success message even if email not registered
    return { ok: true, message: 'If an account with that email exists, reset instructions have been sent.' };
  }

  const resetToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

  resetTokens.set(resetToken, { email: cleanEmail, expiresAt });

  if (isConnected() && prisma) {
    try {
      await prisma.user.update({
        where: { email: cleanEmail },
        data: {
          reset_token: resetToken,
          reset_token_expires: new Date(expiresAt)
        }
      });
    } catch (_) {}
  }

  // In production, integrate email provider (Resend, SendGrid, SES).
  // Here we log the reset link for development and return status.
  const resetUrl = `/reset-password?token=${resetToken}`;
  console.log(`[Auth:PasswordReset] Reset requested for ${cleanEmail}. Link: ${resetUrl}`);
  sendPasswordResetEmail({ to: cleanEmail, resetUrl, name: user.name }).catch(() => {});

  return {
    ok: true,
    message: 'If an account with that email exists, reset instructions have been sent.',
    devResetUrl: process.env.NODE_ENV !== 'production' ? resetUrl : undefined
  };
}

async function completePasswordReset({ token, newPassword }) {
  if (!token || typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('Valid token and password of at least 8 characters required.');
  }

  let emailToReset = null;

  if (isConnected() && prisma) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          reset_token: token,
          reset_token_expires: { gt: new Date() }
        }
      });
      if (user) {
        emailToReset = user.email;
        revokeUserTokens(user.id);
      }
    } catch (_) {}
  }

  if (!emailToReset) {
    const memoryRecord = resetTokens.get(token);
    if (memoryRecord && memoryRecord.expiresAt > Date.now()) {
      emailToReset = memoryRecord.email;
      const memUser = [...memoryUsers.values()].find((u) => u.email === emailToReset);
      if (memUser) revokeUserTokens(memUser.id);
    }
  }

  if (!emailToReset) {
    throw new Error('This password reset link is invalid or has expired.');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  if (isConnected() && prisma) {
    try {
      await prisma.user.update({
        where: { email: emailToReset },
        data: {
          password_hash: passwordHash,
          reset_token: null,
          reset_token_expires: null
        }
      });
    } catch (_) {}
  }

  for (const u of memoryUsers.values()) {
    if (u.email === emailToReset) {
      u.password_hash = passwordHash;
    }
  }

  resetTokens.delete(token);
  return { ok: true, message: 'Password has been successfully updated. You may now sign in.' };
}

module.exports = {
  USER_COOKIE,
  generateToken,
  verifyToken,
  setUserCookie,
  clearUserCookie,
  attachUser,
  requireRegisteredUser,
  registerUser,
  loginUser,
  createGuestSession,
  getGoogleAuthUrl,
  handleGoogleCallback,
  requestPasswordReset,
  completePasswordReset,
  revokeUserTokens
};
