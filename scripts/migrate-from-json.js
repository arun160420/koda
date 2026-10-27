const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const storePath = path.join(__dirname, '../data/store.json');
  if (!fs.existsSync(storePath)) {
    console.log('[Migration] No store.json found to migrate.');
    return;
  }

  const raw = fs.readFileSync(storePath, 'utf8');
  let store;
  try {
    store = JSON.parse(raw);
  } catch (err) {
    console.error('[Migration] Failed to parse store.json:', err.message);
    return;
  }

  const prisma = new PrismaClient();
  console.log('[Migration] Connecting to database...');

  try {
    await prisma.$connect();
    console.log('[Migration] Connected to PostgreSQL. Beginning data transfer...');

    // 1. Migrate Users
    const usersMap = new Map();
    // Default user
    usersMap.set('u-you', {
      id: 'u-you',
      name: 'You',
      handle: '@you',
      avatar_url: 'YO',
      role: 'ADMIN'
    });

    // Collect users from rooms
    for (const room of store.rooms || []) {
      if (room.host && room.host.id) {
        usersMap.set(room.host.id, {
          id: String(room.host.id),
          name: String(room.host.name || 'Host'),
          handle: String(room.host.handle || `@user_${room.host.id}`),
          avatar_url: String(room.host.avatar || 'YO'),
          role: room.host.role || 'HOST'
        });
      }
      for (const listener of room.listeners || []) {
        if (listener.id && !usersMap.has(listener.id)) {
          usersMap.set(listener.id, {
            id: String(listener.id),
            name: String(listener.name || 'Listener'),
            handle: String(listener.handle || `@user_${listener.id}`),
            avatar_url: String(listener.avatar || 'YO'),
            role: listener.role || 'LISTENER'
          });
        }
      }
    }

    // Collect users from playlists
    for (const pl of store.playlists || []) {
      for (const contrib of pl.contributors || []) {
        if (contrib.id && !usersMap.has(contrib.id)) {
          usersMap.set(contrib.id, {
            id: String(contrib.id),
            name: String(contrib.name || 'Creator'),
            handle: String(contrib.handle || `@user_${contrib.id}`),
            avatar_url: String(contrib.avatar || 'YO'),
            role: 'LISTENER'
          });
        }
      }
    }

    // Upsert users
    for (const user of usersMap.values()) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: { name: user.name, handle: user.handle, avatar_url: user.avatar_url, role: user.role },
        create: user
      });
    }
    console.log(`[Migration] Migrated ${usersMap.size} users.`);

    // 2. Migrate Rooms
    for (const room of store.rooms || []) {
      const hostId = room.host?.id && usersMap.has(room.host.id) ? room.host.id : 'u-you';
      const createdRoom = await prisma.room.upsert({
        where: { id: room.id },
        update: {
          name: room.name || 'Untitled Room',
          subtitle: room.subtitle || 'New listening room',
          vibe: room.vibe || 'Open format',
          current_track_id: room.currentTrack?.id || null,
          current_track: room.currentTrack || null,
          is_playing: Boolean(room.isPlaying),
          started_at: room.startedAt ? BigInt(room.startedAt) : null,
          paused_position: Number(room.pausedPosition || 0),
          queue: room.queue || [],
          listeners: room.listeners || []
        },
        create: {
          id: room.id,
          code: room.code || `KODA-${Math.floor(10 + Math.random() * 90)}`,
          name: room.name || 'Untitled Room',
          subtitle: room.subtitle || 'New listening room',
          vibe: room.vibe || 'Open format',
          host_id: hostId,
          current_track_id: room.currentTrack?.id || null,
          current_track: room.currentTrack || null,
          is_playing: Boolean(room.isPlaying),
          started_at: room.startedAt ? BigInt(room.startedAt) : null,
          paused_position: Number(room.pausedPosition || 0),
          queue: room.queue || [],
          listeners: room.listeners || []
        }
      });

      // Migrate chat messages
      for (const msg of room.chat || []) {
        const msgId = msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const userId = msg.user?.id && usersMap.has(msg.user.id) ? msg.user.id : null;
        await prisma.roomMessage.upsert({
          where: { id: msgId },
          update: {},
          create: {
            id: msgId,
            room_id: createdRoom.id,
            user_id: userId,
            user_data: msg.user || null,
            text: msg.text || '',
            type: msg.type || 'chat'
          }
        });
      }
    }
    console.log(`[Migration] Migrated ${(store.rooms || []).length} rooms.`);

    // 3. Migrate Playlists (Tapes) & Tracks
    for (const pl of store.playlists || []) {
      const creatorId = pl.contributors?.[0]?.id && usersMap.has(pl.contributors[0].id)
        ? pl.contributors[0].id : 'u-you';

      const playlist = await prisma.playlist.upsert({
        where: { id: pl.id },
        update: {
          title: pl.title,
          subtitle: pl.subtitle || '',
          description: pl.description || '',
          is_collaborative: pl.isCollaborative ?? true,
          contributors: pl.contributors || [],
          comments: pl.comments || []
        },
        create: {
          id: pl.id,
          title: pl.title,
          subtitle: pl.subtitle || '',
          description: pl.description || '',
          is_collaborative: pl.isCollaborative ?? true,
          created_by: creatorId,
          contributors: pl.contributors || [],
          comments: pl.comments || []
        }
      });

      // Migrate tracks
      let pos = 0;
      for (const track of pl.tracks || []) {
        const trackId = track.id || `tr-${pos}`;
        const addedById = track.addedBy?.id && usersMap.has(track.addedBy.id) ? track.addedBy.id : null;
        await prisma.playlistTrack.create({
          data: {
            playlist_id: playlist.id,
            track_id: trackId,
            track_metadata: track,
            note: track.note || '',
            added_by: addedById,
            added_by_data: track.addedBy || null,
            position: pos++
          }
        });
      }
    }
    console.log(`[Migration] Migrated ${(store.playlists || []).length} playlists.`);

    // 4. Migrate Activity Feed
    for (const act of store.activityFeed || []) {
      const userId = act.user?.id && usersMap.has(act.user.id) ? act.user.id : null;
      await prisma.activityFeed.upsert({
        where: { id: act.id },
        update: {
          likes_count: Number(act.likes || 0)
        },
        create: {
          id: act.id,
          user_id: userId,
          user_data: act.user || null,
          action: act.action || 'shared music',
          track_id: act.track?.id || null,
          track_data: act.track || null,
          message: act.message || '',
          likes_count: Number(act.likes || 0)
        }
      });
    }
    console.log(`[Migration] Migrated ${(store.activityFeed || []).length} activity feed entries.`);

    // 5. Migrate Catalog Uploads
    for (const cat of store.catalogUploads || []) {
      await prisma.catalogTrack.upsert({
        where: { id: cat.id },
        update: {},
        create: {
          id: cat.id,
          title: cat.title,
          artist: cat.artist,
          album: cat.album || '',
          duration: Number(cat.duration || 0),
          full_duration: Number(cat.fullDuration || 0),
          cover: cat.cover || '',
          stream_url: cat.streamUrl,
          download_url: cat.downloadUrl || cat.streamUrl,
          link_url: cat.linkUrl || '',
          source_url: cat.sourceUrl || '',
          license_url: cat.licenseUrl || '',
          license_name: cat.licenseName || '',
          rights_statement: cat.rightsStatement || '',
          year: cat.year || '',
          tag: cat.tag || 'other',
          language: cat.language || 'music',
          source: cat.source || 'admin-catalog',
          provider: cat.provider || 'KODA shared catalog',
          is_preview: Boolean(cat.isPreview),
          file_size: cat.fileSize ? BigInt(cat.fileSize) : null,
          lyrics_text: cat.lyricsText || '',
          assets: cat.assets || [],
          audio_filename: cat.audioFilename || '',
          artwork_filename: cat.artworkFilename || '',
          legacy_upload: Boolean(cat.legacyUpload)
        }
      });
    }
    console.log(`[Migration] Migrated ${(store.catalogUploads || []).length} catalog upload tracks.`);

    console.log('[Migration] Database migration completed successfully!');
  } catch (error) {
    console.error('[Migration] Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
