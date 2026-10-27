const fs = require('fs');
const path = require('path');
const { prisma, isConnected } = require('../db');

class StoreRepository {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '../data');
    this.storePath = path.join(this.dataDir, 'store.json');
    this.seedPath = path.join(__dirname, '../data/seed-tracks.json');
    this.seedTracks = this._readSeedTracks();
    this.localStore = this._loadLocalStore();
  }

  _readSeedTracks() {
    try {
      const data = JSON.parse(fs.readFileSync(this.seedPath, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  }

  _loadLocalStore() {
    const defaultStore = {
      tracks: this.seedTracks.slice(),
      uploads: [],
      catalogUploads: [],
      rooms: [],
      playlists: [],
      friends: [],
      activityFeed: []
    };

    if (fs.existsSync(this.storePath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
        if (saved && Array.isArray(saved.rooms) && Array.isArray(saved.playlists)) {
          return {
            ...defaultStore,
            ...saved,
            tracks: Array.isArray(saved.tracks) ? saved.tracks : this.seedTracks.slice(),
            uploads: Array.isArray(saved.uploads) ? saved.uploads : [],
            catalogUploads: Array.isArray(saved.catalogUploads) ? saved.catalogUploads : [],
            friends: Array.isArray(saved.friends) ? saved.friends : [],
            activityFeed: Array.isArray(saved.activityFeed) ? saved.activityFeed : []
          };
        }
      } catch (err) {
        console.error('[Store] Failed to load store.json, using defaults:', err.message);
      }
    }
    return defaultStore;
  }

  _saveLocalStore() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.localStore, null, 2));
    } catch (err) {
      console.error('[Store] Local store save failed:', err.message);
    }
  }

  // ---------- Users ----------
  async upsertUser(user) {
    if (!user || !user.id) return user;
    if (isConnected() && prisma) {
      try {
        return await prisma.user.upsert({
          where: { id: String(user.id) },
          update: {
            name: user.name,
            handle: user.handle,
            avatar_url: user.avatar,
            role: user.role || 'LISTENER'
          },
          create: {
            id: String(user.id),
            name: user.name || 'Listener',
            handle: user.handle || `@user_${user.id}`,
            avatar_url: user.avatar || 'YO',
            role: user.role || 'LISTENER'
          }
        });
      } catch (err) {
        console.warn('[DB] User upsert error, falling back:', err.message);
      }
    }
    return user;
  }

  // ---------- Rooms ----------
  async getRooms() {
    if (isConnected() && prisma) {
      try {
        const rooms = await prisma.room.findMany({
          orderBy: { created_at: 'desc' },
          include: {
            messages: {
              orderBy: { created_at: 'asc' },
              take: 80
            }
          }
        });

        return rooms.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          subtitle: r.subtitle,
          vibe: r.vibe,
          host: { id: r.host_id, name: 'Host', handle: '@host' },
          isPlaying: r.is_playing,
          currentTrack: r.current_track,
          startedAt: r.started_at ? Number(r.started_at) : null,
          pausedPosition: r.paused_position,
          listeners: Array.isArray(r.listeners) ? r.listeners : [],
          queue: Array.isArray(r.queue) ? r.queue : [],
          chat: (r.messages || []).map((m) => ({
            id: m.id,
            user: m.user_data || { id: m.user_id || 'unknown', name: 'Listener' },
            text: m.text,
            type: m.type,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }))
        }));
      } catch (err) {
        console.warn('[DB] getRooms error, using local store:', err.message);
      }
    }
    return this.localStore.rooms;
  }

  async getRoom(id) {
    if (isConnected() && prisma) {
      try {
        const room = await prisma.room.findUnique({
          where: { id },
          include: { messages: { orderBy: { created_at: 'asc' } } }
        });
        if (room) {
          return {
            id: room.id,
            code: room.code,
            name: room.name,
            subtitle: room.subtitle,
            vibe: room.vibe,
            hostId: room.host_id,
            currentTrackId: room.current_track_id,
            currentTrack: room.current_track,
            isPlaying: room.is_playing,
            startedAt: room.started_at ? Number(room.started_at) : null,
            pausedPosition: room.paused_position,
            queue: room.queue || [],
            listeners: room.listeners || [],
            chat: (room.messages || []).map((m) => ({
              id: m.id,
              user: m.user_data,
              text: m.text,
              type: m.type,
              time: m.created_at.toISOString()
            }))
          };
        }
      } catch (err) {
        console.warn('[DB] getRoom error, using local store:', err.message);
      }
    }
    return (this.localStore.rooms || []).find((r) => r.id === id);
  }

  async createRoom(roomData) {
    if (!roomData.id) {
      roomData.id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
    if (!roomData.code) {
      roomData.code = `KODA-${String(Math.floor(10 + Math.random() * 90))}`;
    }
    if (isConnected() && prisma) {
      try {
        await this.upsertUser(roomData.host);
        const created = await prisma.room.create({
          data: {
            id: roomData.id,
            code: roomData.code,
            name: roomData.name,
            subtitle: roomData.subtitle || 'New listening room',
            vibe: roomData.vibe || 'Open format',
            host_id: roomData.host?.id || 'u-you',
            current_track_id: roomData.currentTrack?.id || null,
            current_track: roomData.currentTrack || null,
            is_playing: Boolean(roomData.isPlaying),
            started_at: roomData.startedAt ? BigInt(roomData.startedAt) : null,
            paused_position: Number(roomData.pausedPosition || 0),
            queue: roomData.queue || [],
            listeners: roomData.listeners || []
          }
        });

        if (Array.isArray(roomData.chat) && roomData.chat.length > 0) {
          const firstMsg = roomData.chat[0];
          await prisma.roomMessage.create({
            data: {
              id: firstMsg.id,
              room_id: created.id,
              user_id: firstMsg.user?.id || null,
              user_data: firstMsg.user || null,
              text: firstMsg.text,
              type: firstMsg.type || 'system'
            }
          });
        }
      } catch (err) {
        console.warn('[DB] createRoom error, updating local store:', err.message);
      }
    }

    this.localStore.rooms.unshift(roomData);
    this._saveLocalStore();
    return roomData;
  }

  async updateRoom(roomId, updateFn) {
    const localRoom = this.localStore.rooms.find((item) => item.id === roomId);
    if (!localRoom) return null;

    updateFn(localRoom);
    this._saveLocalStore();

    if (isConnected() && prisma) {
      try {
        await prisma.room.update({
          where: { id: roomId },
          data: {
            is_playing: Boolean(localRoom.isPlaying),
            current_track_id: localRoom.currentTrack?.id || null,
            current_track: localRoom.currentTrack || null,
            started_at: localRoom.startedAt ? BigInt(localRoom.startedAt) : null,
            paused_position: Number(localRoom.pausedPosition || 0),
            listeners: localRoom.listeners || [],
            queue: localRoom.queue || []
          }
        });
      } catch (err) {
        console.warn('[DB] updateRoom error:', err.message);
      }
    }

    return localRoom;
  }

  async addRoomMessage(roomId, message) {
    const localRoom = this.localStore.rooms.find((item) => item.id === roomId);
    if (localRoom) {
      localRoom.chat.push(message);
      localRoom.chat = localRoom.chat.slice(-80);
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        await this.upsertUser(message.user);
        await prisma.roomMessage.create({
          data: {
            id: message.id,
            room_id: roomId,
            user_id: message.user?.id || null,
            user_data: message.user || null,
            text: message.text,
            type: message.type || 'chat'
          }
        });
      } catch (err) {
        console.warn('[DB] addRoomMessage error:', err.message);
      }
    }

    return message;
  }

  // ---------- Playlists (Tapes) ----------
  async getPlaylists() {
    if (isConnected() && prisma) {
      try {
        const playlists = await prisma.playlist.findMany({
          orderBy: { created_at: 'desc' },
          include: {
            tracks: {
              orderBy: { position: 'asc' }
            }
          }
        });

        return playlists.map((p) => ({
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          description: p.description,
          isCollaborative: p.is_collaborative,
          createdAt: p.created_at.toISOString().slice(0, 10),
          contributors: Array.isArray(p.contributors) ? p.contributors : [],
          comments: Array.isArray(p.comments) ? p.comments : [],
          tracks: (p.tracks || []).map((t) => ({
            ...(typeof t.track_metadata === 'object' ? t.track_metadata : {}),
            addedBy: t.added_by_data || { id: t.added_by || 'unknown' },
            note: t.note || '',
            addedAt: t.added_at.toISOString()
          }))
        }));
      } catch (err) {
        console.warn('[DB] getPlaylists error, using local store:', err.message);
      }
    }
    return this.localStore.playlists;
  }

  async createPlaylist(playlistData) {
    if (isConnected() && prisma) {
      try {
        const creator = playlistData.contributors?.[0];
        if (creator) await this.upsertUser(creator);

        await prisma.playlist.create({
          data: {
            id: playlistData.id,
            title: playlistData.title,
            subtitle: playlistData.subtitle || '',
            description: playlistData.description || '',
            is_collaborative: playlistData.isCollaborative ?? true,
            created_by: creator?.id || 'u-you',
            contributors: playlistData.contributors || [],
            comments: playlistData.comments || []
          }
        });
      } catch (err) {
        console.warn('[DB] createPlaylist error:', err.message);
      }
    }

    this.localStore.playlists.unshift(playlistData);
    this._saveLocalStore();
    return playlistData;
  }

  async addPlaylistTrack(playlistId, trackItem) {
    const localPlaylist = this.localStore.playlists.find((item) => item.id === playlistId);
    if (localPlaylist) {
      localPlaylist.tracks.push(trackItem);
      if (trackItem.addedBy && !localPlaylist.contributors.some((c) => c.handle === trackItem.addedBy.handle)) {
        localPlaylist.contributors.push(trackItem.addedBy);
      }
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        if (trackItem.addedBy) await this.upsertUser(trackItem.addedBy);
        const count = await prisma.playlistTrack.count({ where: { playlist_id: playlistId } });

        await prisma.playlistTrack.create({
          data: {
            id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            playlist_id: playlistId,
            track_id: trackItem.id || `tr-${count}`,
            track_metadata: trackItem,
            note: trackItem.note || '',
            added_by: trackItem.addedBy?.id || null,
            added_by_data: trackItem.addedBy || null,
            position: count
          }
        });

        if (localPlaylist?.contributors) {
          await prisma.playlist.update({
            where: { id: playlistId },
            data: { contributors: localPlaylist.contributors }
          });
        }
      } catch (err) {
        console.warn('[DB] addPlaylistTrack error:', err.message);
      }
    }

    return localPlaylist;
  }

  async removePlaylistTrack(playlistId, index) {
    const localPlaylist = this.localStore.playlists.find((item) => item.id === playlistId);
    if (!localPlaylist) return null;

    if (Number.isInteger(index) && index >= 0 && index < localPlaylist.tracks.length) {
      localPlaylist.tracks.splice(index, 1);
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        const tracks = await prisma.playlistTrack.findMany({
          where: { playlist_id: playlistId },
          orderBy: { position: 'asc' }
        });
        if (tracks[index]) {
          await prisma.playlistTrack.delete({ where: { id: tracks[index].id } });
        }
      } catch (err) {
        console.warn('[DB] removePlaylistTrack error:', err.message);
      }
    }

    return localPlaylist;
  }

  async addPlaylistComment(playlistId, comment) {
    const localPlaylist = this.localStore.playlists.find((item) => item.id === playlistId);
    if (localPlaylist) {
      localPlaylist.comments.push(comment);
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        if (comment.user) await this.upsertUser(comment.user);
        await prisma.playlist.update({
          where: { id: playlistId },
          data: { comments: localPlaylist.comments }
        });
      } catch (err) {
        console.warn('[DB] addPlaylistComment error:', err.message);
      }
    }

    return localPlaylist;
  }

  // ---------- Activity Feed ----------
  async getActivityFeed() {
    if (isConnected() && prisma) {
      try {
        const activities = await prisma.activityFeed.findMany({
          orderBy: { created_at: 'desc' },
          take: 50
        });

        return activities.map((a) => ({
          id: a.id,
          user: a.user_data || { id: a.user_id || 'u-you', name: 'User' },
          action: a.action,
          track: a.track_data,
          message: a.message,
          time: 'Just now',
          likes: a.likes_count
        }));
      } catch (err) {
        console.warn('[DB] getActivityFeed error, using local store:', err.message);
      }
    }
    return this.localStore.activityFeed;
  }

  async addActivity(activity) {
    if (isConnected() && prisma) {
      try {
        if (activity.user) await this.upsertUser(activity.user);
        await prisma.activityFeed.create({
          data: {
            id: activity.id,
            user_id: activity.user?.id || null,
            user_data: activity.user || null,
            action: activity.action || 'shared a song',
            track_id: activity.track?.id || null,
            track_data: activity.track || null,
            message: activity.message || '',
            likes_count: Number(activity.likes || 0)
          }
        });
      } catch (err) {
        console.warn('[DB] addActivity error:', err.message);
      }
    }

    this.localStore.activityFeed.unshift(activity);
    this._saveLocalStore();
    return activity;
  }

  async likeActivity(id) {
    const item = this.localStore.activityFeed.find((entry) => entry.id === id);
    if (item) {
      item.likes = (item.likes || 0) + 1;
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        await prisma.activityFeed.update({
          where: { id },
          data: { likes_count: { increment: 1 } }
        });
      } catch (err) {
        console.warn('[DB] likeActivity error:', err.message);
      }
    }

    return this.localStore.activityFeed;
  }

  // ---------- Catalog Tracks ----------
  async getCatalogUploads() {
    if (isConnected() && prisma) {
      try {
        const tracks = await prisma.catalogTrack.findMany({
          orderBy: { created_at: 'desc' }
        });

        return tracks.map((t) => ({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          fullDuration: t.full_duration,
          cover: t.cover,
          streamUrl: t.stream_url,
          downloadUrl: t.download_url,
          linkUrl: t.link_url,
          sourceUrl: t.source_url,
          licenseUrl: t.license_url,
          licenseName: t.license_name,
          rightsStatement: t.rights_statement,
          year: t.year,
          tag: t.tag,
          language: t.language,
          source: t.source,
          provider: t.provider,
          isPreview: t.is_preview,
          fileSize: t.file_size ? Number(t.file_size) : 0,
          lyricsText: t.lyrics_text,
          assets: Array.isArray(t.assets) ? t.assets : [],
          audioFilename: t.audio_filename,
          artworkFilename: t.artwork_filename,
          legacyUpload: t.legacy_upload,
          uploadedAt: t.created_at.toISOString()
        }));
      } catch (err) {
        console.warn('[DB] getCatalogUploads error, using local store:', err.message);
      }
    }
    return this.localStore.catalogUploads;
  }

  async addCatalogUpload(track) {
    if (isConnected() && prisma) {
      try {
        await prisma.catalogTrack.create({
          data: {
            id: track.id,
            title: track.title,
            artist: track.artist,
            album: track.album || '',
            duration: Number(track.duration || 0),
            full_duration: Number(track.fullDuration || 0),
            cover: track.cover || '',
            stream_url: track.streamUrl,
            download_url: track.downloadUrl || track.streamUrl,
            link_url: track.linkUrl || '',
            source_url: track.sourceUrl || '',
            license_url: track.licenseUrl || '',
            license_name: track.licenseName || '',
            rights_statement: track.rightsStatement || '',
            year: track.year || '',
            tag: track.tag || 'other',
            language: track.language || 'music',
            source: track.source || 'admin-catalog',
            provider: track.provider || 'KODA shared catalog',
            is_preview: Boolean(track.isPreview),
            file_size: track.fileSize ? BigInt(track.fileSize) : null,
            lyrics_text: track.lyricsText || '',
            assets: track.assets || [],
            audio_filename: track.audioFilename || '',
            artwork_filename: track.artworkFilename || '',
            legacy_upload: Boolean(track.legacyUpload)
          }
        });
      } catch (err) {
        console.warn('[DB] addCatalogUpload error:', err.message);
      }
    }

    this.localStore.catalogUploads = this.localStore.catalogUploads || [];
    this.localStore.catalogUploads.unshift(track);
    this._saveLocalStore();
    return track;
  }

  async updateCatalogUpload(id, updatedFields) {
    const item = (this.localStore.catalogUploads || []).find((t) => t.id === id);
    if (item) {
      Object.assign(item, updatedFields);
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        await prisma.catalogTrack.update({
          where: { id },
          data: {
            title: updatedFields.title,
            artist: updatedFields.artist,
            album: updatedFields.album,
            year: updatedFields.year,
            tag: updatedFields.tag,
            license_name: updatedFields.licenseName,
            license_url: updatedFields.licenseUrl,
            source_url: updatedFields.sourceUrl,
            link_url: updatedFields.linkUrl,
            rights_statement: updatedFields.rightsStatement,
            lyrics_text: updatedFields.lyricsText
          }
        });
      } catch (err) {
        console.warn('[DB] updateCatalogUpload error:', err.message);
      }
    }

    return item;
  }

  async deleteCatalogUpload(id) {
    const item = (this.localStore.catalogUploads || []).find((t) => t.id === id);
    this.localStore.catalogUploads = (this.localStore.catalogUploads || []).filter((t) => t.id !== id);
    this._saveLocalStore();

    if (isConnected() && prisma) {
      try {
        await prisma.catalogTrack.delete({ where: { id } });
      } catch (err) {
        console.warn('[DB] deleteCatalogUpload error:', err.message);
      }
    }

    return item;
  }

  // DMCA Notice & Takedown
  async addDmcaNotice(notice) {
    this.localStore.dmcaNotices = this.localStore.dmcaNotices || [];
    this.localStore.dmcaNotices.unshift(notice);
    this._saveLocalStore();

    if (isConnected() && prisma) {
      try {
        await prisma.dmcaNotice.create({
          data: {
            id: notice.id,
            claimant_name: notice.claimantName,
            claimant_email: notice.claimantEmail,
            copyright_work: notice.copyrightWork,
            infringing_url: notice.infringingUrl,
            track_id: notice.trackId || null,
            good_faith_confirmed: notice.goodFaithConfirmed ?? true,
            signature: notice.signature,
            status: notice.status || 'pending',
            admin_notes: notice.adminNotes || null
          }
        });
      } catch (err) {
        console.warn('[DB] addDmcaNotice error:', err.message);
      }
    }
    return notice;
  }

  async getDmcaNotices() {
    if (isConnected() && prisma) {
      try {
        const rows = await prisma.dmcaNotice.findMany({ orderBy: { created_at: 'desc' } });
        return rows.map((r) => ({
          id: r.id,
          claimantName: r.claimant_name,
          claimantEmail: r.claimant_email,
          copyrightWork: r.copyright_work,
          infringingUrl: r.infringing_url,
          trackId: r.track_id,
          goodFaithConfirmed: r.good_faith_confirmed,
          signature: r.signature,
          status: r.status,
          adminNotes: r.admin_notes,
          createdAt: r.created_at.toISOString(),
          actionedAt: r.actioned_at ? r.actioned_at.toISOString() : null
        }));
      } catch (err) {
        console.warn('[DB] getDmcaNotices error:', err.message);
      }
    }
    return this.localStore.dmcaNotices || [];
  }

  async actionDmcaNotice(id, { status = 'actioned', adminNotes = '' } = {}) {
    this.localStore.dmcaNotices = this.localStore.dmcaNotices || [];
    const notice = this.localStore.dmcaNotices.find((n) => n.id === id);
    if (notice) {
      notice.status = status;
      notice.adminNotes = adminNotes;
      notice.actionedAt = new Date().toISOString();
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        await prisma.dmcaNotice.update({
          where: { id },
          data: {
            status,
            admin_notes: adminNotes,
            actioned_at: new Date()
          }
        });
      } catch (err) {
        console.warn('[DB] actionDmcaNotice error:', err.message);
      }
    }
    return notice;
  }

  // 1-Click Moderation Takedowns
  async takedownTrack(id, reason = 'DMCA takedown notice') {
    const track = (this.localStore.catalogUploads || []).find((t) => t.id === id);
    if (track) {
      track.isFlagged = true;
      track.flagReason = reason;
      track.takedownAt = new Date().toISOString();
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        await prisma.catalogTrack.update({
          where: { id },
          data: {
            is_flagged: true,
            flag_reason: reason,
            takedown_at: new Date()
          }
        });
      } catch (err) {
        console.warn('[DB] takedownTrack error:', err.message);
      }
    }
    return track;
  }

  async deleteRoom(id) {
    const room = (this.localStore.rooms || []).find((r) => r.id === id);
    this.localStore.rooms = (this.localStore.rooms || []).filter((r) => r.id !== id);
    this._saveLocalStore();

    if (isConnected() && prisma) {
      try {
        await prisma.room.delete({ where: { id } });
      } catch (err) {
        console.warn('[DB] deleteRoom error:', err.message);
      }
    }
    return room;
  }

  async deleteRoomMessage(roomId, messageId) {
    const room = (this.localStore.rooms || []).find((r) => r.id === roomId);
    if (room && Array.isArray(room.chat)) {
      room.chat = room.chat.filter((m) => m.id !== messageId);
      this._saveLocalStore();
    }

    if (isConnected() && prisma) {
      try {
        await prisma.roomMessage.delete({ where: { id: messageId } });
      } catch (err) {
        console.warn('[DB] deleteRoomMessage error:', err.message);
      }
    }
    return { ok: true };
  }

  // Virtual Tipping
  async addTipTransaction(tip) {
    this.localStore.tips = this.localStore.tips || [];
    this.localStore.tips.unshift(tip);
    this._saveLocalStore();

    if (isConnected() && prisma) {
      try {
        await prisma.tipTransaction.create({
          data: {
            id: tip.id,
            room_id: tip.roomId,
            sender_name: tip.senderName,
            sender_user_id: tip.senderUserId || null,
            amount_cents: tip.amountCents,
            currency: tip.currency || 'usd',
            message: tip.message || null,
            status: tip.status || 'completed'
          }
        });
      } catch (err) {
        console.warn('[DB] addTipTransaction error:', err.message);
      }
    }
    return tip;
  }

  async getRoomTips(roomId) {
    if (isConnected() && prisma) {
      try {
        const rows = await prisma.tipTransaction.findMany({
          where: { room_id: roomId },
          orderBy: { created_at: 'desc' }
        });
        return rows.map((r) => ({
          id: r.id,
          roomId: r.room_id,
          senderName: r.sender_name,
          senderUserId: r.sender_user_id,
          amountCents: r.amount_cents,
          currency: r.currency,
          message: r.message,
          status: r.status,
          createdAt: r.created_at.toISOString()
        }));
      } catch (err) {
        console.warn('[DB] getRoomTips error:', err.message);
      }
    }
    return (this.localStore.tips || []).filter((t) => t.roomId === roomId);
  }

  // User Tier Upgrades (Stripe / Subscription)
  async updateUserTier(userId, tier, proExpiresAt = null) {
    if (isConnected() && prisma) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            tier,
            pro_expires_at: proExpiresAt ? new Date(proExpiresAt) : null
          }
        });
      } catch (err) {
        console.warn('[DB] updateUserTier error:', err.message);
      }
    }
    return { id: userId, tier, proExpiresAt };
  }
}

module.exports = StoreRepository;
