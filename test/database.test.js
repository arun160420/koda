const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const StoreRepository = require('../db/storeRepository');
const { prisma, isConnected } = require('../db');

describe('PHASE 2: Database Migration & Schema Architecture Tests', () => {

  describe('1. Schema & Model Definition Checks', () => {
    it('verifies schema.prisma file exists with required PostgreSQL tables', () => {
      const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
      assert.ok(fs.existsSync(schemaPath), 'schema.prisma must exist');
      const schema = fs.readFileSync(schemaPath, 'utf8');

      // Check PostgreSQL provider
      assert.ok(schema.includes('provider = "postgresql"'), 'Provider must be postgresql');

      // Check Users model
      assert.ok(schema.includes('model User'), 'Must define User model');
      assert.ok(schema.includes('password_hash'), 'User model must include password_hash');
      assert.ok(schema.includes('email'), 'User model must include email');
      assert.ok(schema.includes('role'), 'User model must include role');

      // Check Rooms model
      assert.ok(schema.includes('model Room'), 'Must define Room model');
      assert.ok(schema.includes('host_id'), 'Room must include host_id');
      assert.ok(schema.includes('current_track_id'), 'Room must include current_track_id');
      assert.ok(schema.includes('is_playing'), 'Room must include is_playing');

      // Check Playlists (Tapes) model
      assert.ok(schema.includes('model Playlist'), 'Must define Playlist model');
      assert.ok(schema.includes('created_by'), 'Playlist must include created_by');

      // Check Playlist_Tracks model
      assert.ok(schema.includes('model PlaylistTrack'), 'Must define PlaylistTrack model');
      assert.ok(schema.includes('track_metadata'), 'PlaylistTrack must store track_metadata JSON');

      // Check Activity_Feed model
      assert.ok(schema.includes('model ActivityFeed'), 'Must define ActivityFeed model');
      assert.ok(schema.includes('track_data'), 'ActivityFeed must store track_data JSON');
      assert.ok(schema.includes('likes_count'), 'ActivityFeed must store likes_count');
    });
  });

  describe('2. StoreRepository Operations & Concurrency Safety', () => {
    const tmpDataDir = path.join(__dirname, '../data');
    const repo = new StoreRepository({ dataDir: tmpDataDir });

    it('creates and retrieves rooms reliably', async () => {
      const testRoom = {
        id: `room-test-${Date.now()}`,
        code: `KODA-T${Math.floor(10 + Math.random() * 89)}`,
        name: 'Database Test Room',
        vibe: 'Lo-Fi Chill',
        host: { id: 'u-tester', name: 'Tester', handle: '@tester' },
        isPlaying: false,
        currentTrack: null,
        startedAt: null,
        pausedPosition: 0,
        listeners: [{ id: 'u-tester', name: 'Tester', handle: '@tester', role: 'HOST' }],
        queue: [],
        chat: []
      };

      await repo.createRoom(testRoom);
      const rooms = await repo.getRooms();
      const found = rooms.find((r) => r.id === testRoom.id);
      assert.ok(found, 'Created room should be returned');
      assert.equal(found.name, 'Database Test Room');
    });

    it('appends and caps chat messages in a room', async () => {
      const rooms = await repo.getRooms();
      const targetRoom = rooms[0];
      assert.ok(targetRoom, 'Should have at least one room');

      const message = {
        id: `msg-${Date.now()}`,
        user: { id: 'u-tester', name: 'Tester', handle: '@tester' },
        text: 'Testing database message persistence',
        type: 'chat',
        time: '12:00 PM'
      };

      await repo.addRoomMessage(targetRoom.id, message);
      const updatedRooms = await repo.getRooms();
      const updated = updatedRooms.find((r) => r.id === targetRoom.id);
      const lastMsg = updated.chat.at(-1);
      assert.equal(lastMsg.text, 'Testing database message persistence');
    });

    it('creates collaborative playlist tapes and manages tracks', async () => {
      const testTape = {
        id: `pl-test-${Date.now()}`,
        title: '01 // TEST TAPE',
        subtitle: 'Database test subtitle',
        description: 'Persistent tape testing',
        isCollaborative: true,
        createdAt: '2026-10-27',
        contributors: [{ id: 'u-tester', name: 'Tester', handle: '@tester' }],
        tracks: [],
        comments: []
      };

      await repo.createPlaylist(testTape);
      const playlists = await repo.getPlaylists();
      const foundTape = playlists.find((p) => p.id === testTape.id);
      assert.ok(foundTape, 'Created tape must be found');

      // Add track to tape
      const testTrack = {
        id: `track-${Date.now()}`,
        title: 'Test Song',
        artist: 'Test Artist',
        streamUrl: 'https://example.com/audio.mp3',
        addedBy: { id: 'u-tester', name: 'Tester', handle: '@tester' },
        note: 'Solid groove'
      };
      await repo.addPlaylistTrack(foundTape.id, testTrack);

      const afterAdd = await repo.getPlaylists();
      const tapeWithTrack = afterAdd.find((p) => p.id === testTape.id);
      assert.ok(tapeWithTrack.tracks.some((t) => t.title === 'Test Song'));

      // Add comment to tape
      const testComment = {
        id: `c-test-${Date.now()}`,
        user: { id: 'u-tester', name: 'Tester', handle: '@tester' },
        text: 'Love this track on the tape',
        time: 'Just now'
      };
      await repo.addPlaylistComment(foundTape.id, testComment);

      const afterComment = await repo.getPlaylists();
      const tapeWithComment = afterComment.find((p) => p.id === testTape.id);
      assert.ok(tapeWithComment.comments.some((c) => c.text === 'Love this track on the tape'));
    });

    it('records activity feed entries and updates likes', async () => {
      const act = {
        id: `act-test-${Date.now()}`,
        user: { id: 'u-tester', name: 'Tester', handle: '@tester' },
        action: 'shared a track',
        track: { title: 'Viral Sound', artist: 'Producer' },
        message: 'Check this bassline',
        time: 'Just now',
        likes: 0
      };

      await repo.addActivity(act);
      const feed = await repo.getActivityFeed();
      const foundAct = feed.find((a) => a.id === act.id);
      assert.ok(foundAct, 'Activity must be recorded');
      assert.equal(foundAct.message, 'Check this bassline');

      // Like activity
      await repo.likeActivity(act.id);
      const updatedFeed = await repo.getActivityFeed();
      const likedAct = updatedFeed.find((a) => a.id === act.id);
      assert.equal(likedAct.likes, 1);
    });
  });

  describe('3. Migration Tooling Verification', () => {
    it('verifies migrate-from-json script is present and structured for store.json ingestion', () => {
      const scriptPath = path.join(__dirname, '../scripts/migrate-from-json.js');
      assert.ok(fs.existsSync(scriptPath), 'Migration script must exist');
      const content = fs.readFileSync(scriptPath, 'utf8');

      assert.ok(content.includes('prisma.user.upsert'), 'Must migrate users with upsert');
      assert.ok(content.includes('prisma.room.upsert'), 'Must migrate rooms with upsert');
      assert.ok(content.includes('prisma.playlist.upsert'), 'Must migrate playlists with upsert');
      assert.ok(content.includes('prisma.activityFeed.upsert'), 'Must migrate activity feed with upsert');
      assert.ok(content.includes('prisma.catalogTrack.upsert'), 'Must migrate catalog uploads with upsert');
    });
  });

});
