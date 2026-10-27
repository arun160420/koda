# KODA — TP-01

A minimalist social listening studio for open-music discovery, live rooms, collaborative tapes, and a shared catalog. The app includes full-length Internet Archive tracks whose item metadata declares one of the supported open-license terms.

## Run it

```bash
npm install
cp .env.example .env
```

Edit `.env` and set:

- `KODA_ADMIN_PASSWORD` — a unique password of at least 12 characters.
- `KODA_SESSION_SECRET` — a random secret of at least 32 characters. Generate one with `openssl rand -hex 32`.

Then run:

```bash
npm start
```

Open `http://localhost:3000`, choose **Catalog manager** in the sidebar, and sign in with your configured admin password. Do not commit `.env`; it is excluded by `.gitignore`.

## Publish online with Render

A deployment Blueprint is included in `render.yaml`. To create the public site:

1. Push this project to a Git repository you control.
2. In Render, create a **Blueprint** and connect that repository.
3. Render prompts you for `KODA_ADMIN_PASSWORD`; choose a unique password. It generates `KODA_SESSION_SECRET` automatically.
4. Deploy. The Blueprint uses a Singapore web service, `/api/health` checks, and a 10 GB persistent disk mounted for catalog data and uploads. Render provides the generated `onrender.com` URL.

The persistent disk requires a paid Render web-service plan. The app uses a single-instance JSON/file store; back up the disk and don’t scale to multiple instances without first moving metadata and media to shared database/object storage. Render’s default filesystem is ephemeral, so keep the configured disk. Public catalog releases and their attached files are accessible to site visitors; only the publishing controls require your admin password.

## Shared catalog publishing

The catalog manager is admin-only. You can publish, edit release metadata/rights/lyrics, or remove a release and its files. To replace audio, artwork, or attachments, remove the old release and publish it again. Each published release can include:

- Full-length audio: MP3, M4A, AAC, WAV, OGG, Opus, FLAC, or AIFF (up to 200 MB).
- Cover artwork: JPG, PNG, WebP, or GIF (up to 15 MB).
- Lyrics as pasted text (up to 60,000 characters) or TXT, Markdown, or LRC files (up to 5 MB).
- Up to seven extra downloads: PDF, text/lyrics, CSV, JSON, Office documents, MP4/WebM video, or ZIP (up to 40 MB each).
- Track title, artist/attribution, release, year, genre, source URL, rights note, and a rights/license selection.

The publisher must confirm they have permission to share every uploaded file. “Authorized streaming only” is distinct from a Creative Commons license; selecting a CC or public-domain label displays the publisher’s declaration and is not independently verified by KODA. Check source records before reuse.

Admin sessions use an HTTP-only, SameSite cookie, expire after eight hours, and are rate-limited at sign-in. The old audio upload endpoint is also admin-protected. There is no public self-registration or public shared-catalog upload.

## Storage and deployment

By default, release metadata is stored in `data/store.json`, full catalog releases in `data/catalog-media/`, and legacy audio-only admin imports in `uploads/`. Set `KODA_DATA_DIR` and `KODA_UPLOADS_DIR` to persistent disk locations when deploying. Back up both directories. This prototype uses local JSON/file storage; for multi-instance or high-volume production, move metadata to a database and media to object storage, and put the app behind HTTPS.

## Other features

- Search Internet Archive Netlabels and the local catalog. Archive results are filtered to CC BY / CC BY-SA 3.0 and 4.0, CC0 1.0, and Public Domain Mark 1.0; source and license links are included.
- Live listening rooms with shared queues, votes, chat, reactions, and WebSocket updates.
- Collaborative tapes, comments, crew activity, saved tracks, profile settings, and dark/light mode.
- Social data starts empty; the app does not seed fake listeners, rooms, or posts.

## API overview

- `GET /api/bootstrap` — public catalog, rooms, tapes, and activity.
- `GET /api/search?q=...` — local catalog plus filtered Internet Archive results.
- `GET /api/admin/session`, `POST /api/admin/login`, `POST /api/admin/logout` — admin session.
- `GET /api/admin/catalog` — list admin-published releases (admin session required).
- `POST /api/admin/catalog` — publish audio, metadata, artwork, lyrics, and attachments (admin session required).
- `PATCH /api/admin/catalog/:id` — edit release details, rights, and lyrics (admin session required).
- `DELETE /api/admin/catalog/:id` — remove a release and its uploaded files (admin session required).
- `GET /api/catalog/:id/lyrics` and `GET /api/catalog/:id/assets/:assetId` — public release materials.
- Existing `/api/rooms`, `/api/playlists`, and `/api/activity` routes power the collaborative features.
