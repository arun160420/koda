const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Cloudflare R2 / AWS S3 Configuration
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.R2_BUCKET_NAME || '';
const S3_REGION = process.env.S3_REGION || 'auto';
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const S3_ENDPOINT = process.env.S3_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);
const S3_PUBLIC_DOMAIN = (process.env.S3_PUBLIC_DOMAIN || process.env.CDN_URL || '').replace(/\/$/, '');

const isCloudStorageEnabled = Boolean(
  S3_ACCESS_KEY_ID &&
  S3_SECRET_ACCESS_KEY &&
  S3_BUCKET_NAME &&
  !S3_ACCESS_KEY_ID.startsWith('replace')
);

let s3Client = null;
if (isCloudStorageEnabled) {
  s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY
    }
  });
}

/**
 * Generate a direct-to-cloud presigned upload URL for S3 / Cloudflare R2
 */
async function generatePresignedUploadUrl({ filename, contentType, kind = 'audio' }) {
  const extension = path.extname(filename || '').toLowerCase() || (kind === 'audio' ? '.mp3' : '.jpg');
  const safeBase = path.basename(filename || 'file', extension)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 32);
  const key = `${kind}/${Date.now()}_${crypto.randomBytes(6).toString('hex')}_${safeBase}${extension}`;

  if (!isCloudStorageEnabled || !s3Client) {
    // Development fallback when S3/R2 credentials are not set
    return {
      isCloud: false,
      uploadUrl: `/api/upload`,
      publicUrl: `/uploads/${encodeURIComponent(path.basename(key))}`,
      key,
      method: 'POST',
      headers: {},
      fallback: true
    };
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType || 'application/octet-stream'
  });

  // Presigned URL valid for 15 minutes
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  const publicDomain = S3_PUBLIC_DOMAIN || (S3_ENDPOINT ? `${S3_ENDPOINT}/${S3_BUCKET_NAME}` : '');
  const publicUrl = publicDomain ? `${publicDomain}/${key}` : uploadUrl.split('?')[0];

  return {
    isCloud: true,
    uploadUrl,
    publicUrl,
    key,
    method: 'PUT',
    headers: {
      'Content-Type': contentType || 'application/octet-stream'
    }
  };
}

/**
 * Audio Streaming Optimization with HTTP Byte-Range Serving (RFC 7233)
 * Enables instant seeking/scrubbing and low-latency audio buffering
 */
function streamAudioWithByteRange(filePath, req, res) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found.' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/opus',
    '.flac': 'audio/flac',
    '.aiff': 'audio/aiff',
    '.aif': 'audio/aiff'
  };
  const contentType = mimeMap[ext] || 'audio/mpeg';

  // Base streaming and caching headers
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('ETag', `"${stat.mtimeMs.toString(16)}-${fileSize.toString(16)}"`);

  // If HTTP Range header is present, serve 206 Partial Content
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).end();
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    const stream = fs.createReadStream(filePath, { start, end });
    req.on('close', () => stream.destroy());
    return stream.pipe(res);
  }

  // No range header: stream full file (200 OK)
  res.status(200);
  res.setHeader('Content-Length', fileSize);
  const stream = fs.createReadStream(filePath);
  req.on('close', () => stream.destroy());
  return stream.pipe(res);
}

module.exports = {
  isCloudStorageEnabled: () => isCloudStorageEnabled,
  generatePresignedUploadUrl,
  streamAudioWithByteRange,
  S3_BUCKET_NAME,
  S3_PUBLIC_DOMAIN
};
