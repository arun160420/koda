# KODA Studio — Production Deployment & Operator Manual

Comprehensive setup, configuration, and operational guide for KODA Studio, an open-license social music listening platform built with Node.js, WebSockets, Prisma ORM, and Cloudflare R2 / AWS S3.

---

## 1. System Architecture Overview

```
                      +-----------------------------+
                      |       Client Browser        |
                      |   (SPA + Web Audio Engine)  |
                      +--------------+--------------+
                                     |
             +-----------------------+-----------------------+
             | Range Requests (206)  | Direct PUT Upload     | WS State Sync
             v                       v                       v
+------------------------+   +-------------------+   +--------------------+
| Cloudflare R2 / S3 CDN |   | Presigned URLs    |   | Node.js Server     |
| (Zero-Egress Audio)    |   | (S3 SDK v3)       |   | (Express + WSS)    |
+------------------------+   +-------------------+   +---------+----------+
                                                               |
                                            +------------------+------------------+
                                            | Prisma ORM                          |
                                            v                                     v
                                 +--------------------+                +--------------------+
                                 | PostgreSQL DB      |                | Stripe Billing     |
                                 | (Supabase / Neon)  |                | & Webhook Handler  |
                                 +--------------------+                +--------------------+
```

---

## 2. Prerequisites

- **Node.js**: `v20.0.0` or higher (`v24.x` supported)
- **Database**: PostgreSQL `14+` (Supabase, Neon, Railway Postgres, or local Docker)
- **Cloud Storage (Optional for cloud audio)**: Cloudflare R2 (recommended for $0 egress) or AWS S3
- **Stripe (Optional for monetization)**: Stripe account with standard API keys

---

## 3. Fast Local Setup

### Step 1: Clone & Install Dependencies
```bash
git clone <repository_url> koda-studio
cd koda-studio
npm install
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and configure key variables:
```ini
# Admin credentials (minimum 12 character password, 32 character session secret)
KODA_ADMIN_PASSWORD=your_secure_admin_password_123
KODA_SESSION_SECRET=a8f9c1b3e7d246098123456789abcdef0123456789abcdef0123456789abcdef

# Database connection (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/koda_db?schema=public"

# Google OAuth 2.0 (Optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudflare R2 / AWS S3 (Optional for cloud media)
R2_ACCOUNT_ID=your_cloudflare_account_id
S3_ACCESS_KEY_ID=your_r2_or_s3_access_key
S3_SECRET_ACCESS_KEY=your_r2_or_s3_secret_key
S3_BUCKET_NAME=koda-audio-bucket
S3_PUBLIC_DOMAIN=https://cdn.yourdomain.com

# Stripe Monetization (Optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 3: Run Database Migrations
Generate Prisma client and synchronize the schema:
```bash
npx prisma generate
npx prisma db push
```

### Step 4: Start the Server
```bash
npm start
```
The application will be live at `http://localhost:3000`.

---

## 4. 1-Click Docker Deployment

Run the complete stack (KODA App + PostgreSQL database) with a single command:
```bash
docker compose up -d --build
```
- App: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

---

## 5. Cloud Platform Deployments

### Render
1. Connect your repository to Render.
2. Select **Blueprints** and point to `render.yaml`.
3. Provide your `DATABASE_URL` (e.g. Render Postgres or Supabase) and credentials.
4. Click **Apply** to deploy.

### Railway
1. Click **New Project** → **Deploy from GitHub repo**.
2. Railway detects `railway.json` and configures the Nixpacks build automatically.
3. Attach a PostgreSQL database from the Railway marketplace with 1 click.
4. Set `.env` variables in the Railway dashboard.

### Vercel
1. Import repository into Vercel.
2. Vercel utilizes `vercel.json` to deploy `server.js` as a serverless Node function.
3. Add environment variables in the project settings.

---

## 6. Authentication Architecture

- **Email & Password**: Passwords hashed with `bcryptjs` using 12 salt rounds. Secure, HTTP-only, SameSite JWT session cookies (`koda_user_session`).
- **Google OAuth 2.0**: Native OAuth callback extraction with automatic user sync into PostgreSQL.
- **Guest Access**: Temporary guest tokens permit listening, queue voting, and chat. Permanent room hosting and tape creation prompt the user to register.
- **Password Reset**: Cryptographic reset tokens with 1-hour expiration.

---

## 7. Cloud Audio Storage & Byte-Range Streaming

- **Direct Uploads**: Audio files upload directly from the user's browser to Cloudflare R2 / S3 using presigned URLs (`POST /api/upload/presign`).
- **RFC 7233 Byte-Range Streaming**: Audio seeking and scrubbing work with instant responsiveness via `206 Partial Content` requests.
- **MIME & Magic Byte Protection**: Server-side inspection validates genuine audio binary headers (`ID3`, `RIFF`, `fLaC`, `OggS`) before registration.

---

## 8. Legal, Compliance & DMCA Protection

- **Public DMCA Page**: Accessible at `/dmca` with designated compliance agent contact.
- **Automated Takedown Form**: `POST /api/dmca/takedown` collects claimant details, infringing URL, copyright work, good-faith statement, and electronic signature.
- **1-Click Admin Moderation**:
  * Takedown track: `POST /api/admin/moderation/takedown` immediately flags the track and removes it from public catalog streaming.
  * Delete room: `DELETE /api/admin/moderation/rooms/:id` closes room and disconnects clients.
  * Delete chat: `DELETE /api/admin/moderation/chat/:roomId/:messageId` removes malicious messages.
- **Terms & Privacy**: Public routes at `/terms` and `/privacy`.

---

## 9. Monetization & Stripe Integration

- **Subscription Tiers**:
  * `Free`: 5 uploads, community features.
  * `Plus` ($4.99/mo): 50 uploads, custom playlist tapes, crew badge.
  * `Pro` ($9.99/mo): Unlimited uploads, lossless streaming, custom vanity URLs, PRO badge.
- **Stripe Checkout**: Initiated via `POST /api/billing/create-checkout-session`.
- **Webhooks**: `POST /api/billing/webhook` handles `checkout.session.completed` and `customer.subscription.deleted` to update user tier automatically.
- **Creator Tipping**: `POST /api/rooms/:id/tip` enables virtual tipping in listening rooms with live WebSocket announcements.

---

## 10. Automated Test Suite

Run the full automated test suite covering all 6 phases:
```bash
npm test
```
The test suite validates security headers, CORS rules, input sanitization, database repository operations, user authentication, S3 presigned URLs, byte-range streaming, DMCA submission, admin moderation, and billing.
