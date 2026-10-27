/* KODA // TP-01 — social listening, collaborative tapes, and an open-license music catalog. */
(() => {
  'use strict';

  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');
  const audio = document.getElementById('studio-audio');
  const fallbackArt = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#202026"/><circle cx="200" cy="200" r="112" fill="none" stroke="#ff5a1f" stroke-width="2" opacity=".65"/><circle cx="200" cy="200" r="76" fill="none" stroke="#ff5a1f" stroke-width="1" opacity=".45"/><path d="M200 88v224M88 200h224" stroke="#ff5a1f" stroke-width="1" opacity=".3"/><circle cx="200" cy="200" r="9" fill="#ff5a1f"/></svg>');
  const storageKeys = { theme: 'koda-theme', profile: 'koda-profile', saved: 'koda-saved', recent: 'koda-recent', volume: 'koda-volume' };
  const adminLicenseOptions = [
    ['authorized', 'Authorized streaming only · no public reuse license'], ['cc-by-4.0', 'CC BY 4.0'],
    ['cc-by-sa-4.0', 'CC BY-SA 4.0'], ['cc-by-3.0', 'CC BY 3.0'], ['cc-by-sa-3.0', 'CC BY-SA 3.0'],
    ['cc0', 'CC0 1.0'], ['pdm', 'Public Domain Mark 1.0']
  ];
  const adminGenreOptions = ['ambient','acoustic','electronic','experimental','indie','jazz','rock','folk','world','piano','soul','house','disco','dub','other'];

  const iconPaths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8"/>',
    room: '<path d="M4 5h16v12H8l-4 3z"/><path d="M8 9h8M8 13h5"/>',
    playlist: '<path d="M4 6h16M4 11h10M4 16h8"/><circle cx="18" cy="16" r="3"/><path d="m18 13 4-2"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    library: '<path d="M4 4h3v16H4zM10 4h3v16h-3zM16 4h4v16h-4z"/>',
    upload: '<path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    play: '<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5h3v14H8zM15 5h3v14h-3z" fill="currentColor" stroke="none"/>',
    next: '<path d="M5 5v14l10-7zM19 5v14" fill="currentColor" stroke="none"/>',
    prev: '<path d="M19 5v14L9 12zM5 5v14" fill="currentColor" stroke="none"/>',
    volume: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12"/>',
    mute: '<path d="M4 10v4h4l5 4V6l-5 4zM17 9l5 6m0-6-5 6"/>',
    heart: '<path d="M20.8 8.7c0 5.1-8.8 10.1-8.8 10.1S3.2 13.8 3.2 8.7A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.3z"/>',
    share: '<path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M5 12v7h14v-7"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3.9l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>',
    note: '<path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/>',
    radioSmall: '<circle cx="12" cy="12" r="2"/><path d="M5 5a10 10 0 0 0 0 14m14-14a10 10 0 0 1 0 14"/>',
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3"/><path d="M3 14v5a2 2 0 0 0 2 2h2v-7H5a2 2 0 0 0-2 2zm18 0v5a2 2 0 0 1-2 2h-2v-7h2a2 2 0 0 1 2 2z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>',
    shuffle: '<path d="m18 14 4 4-4 4M18 2l4 4-4 4M2 18h2.5c2.3 0 3.6-1.3 5.3-4l4.4-7c1.2-1.9 2.2-3 4.3-3H22M2 6h2.5c1.9 0 3.1.9 4.5 3"/>',
    repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
    expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/>',
    earth: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
  };

  const state = {
    data: { tracks: [], uploads: [], rooms: [], playlists: [], friends: [], activityFeed: [] },
    page: 'home',
    searchQuery: '', searchResults: null, searchAlbums: [], searchLoading: false, searchError: '',
    selectedGenre: 'all', rightTab: 'queue', activeRoomId: null, selectedRoomId: null,
    currentTrack: null, isPlaying: false, position: 0, duration: 30,
    playbackQueue: [], queueIndex: -1, localQueue: [],
    currentPlaylistId: null, currentAlbum: null, pendingPlaylistId: null, pendingTrackId: null,
    saved: loadJSON(storageKeys.saved, []), recent: loadJSON(storageKeys.recent, []),
    profile: loadJSON(storageKeys.profile, { id: 'u-you', name: 'You', handle: '@you', avatar: 'YO', color: '#ff5a1f' }),
    theme: localStorage.getItem(storageKeys.theme) || 'dark',
    volume: Number(localStorage.getItem(storageKeys.volume) || 0.82),
    isMuted: false, isShuffle: false, repeat: false,
    socketConnected: false, socket: null, toastTimer: null, searchTimer: null, updatingFromRoom: false,
    admin: { enabled: false, authenticated: false, items: [], setupHint: '', loading: false, error: '' }
  };

  function loadJSON(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value == null ? fallback : value; }
    catch (_error) { return fallback; }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_error) {}
  }

  function icon(name, size = 16, extra = '') {
    return `<svg class="icon ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.music}</svg>`;
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function safeCover(value) {
    if (!value || typeof value !== 'string') return fallbackArt;
    if (value.startsWith('data:image/') || value.startsWith('/uploads/') || value.startsWith('/media/artwork/') || /^https:\/\//i.test(value)) return escapeHTML(value);
    return fallbackArt;
  }

  function safeExternal(value) {
    return typeof value === 'string' && /^https:\/\//i.test(value) ? value : '';
  }

  function safeLocalAsset(value) {
    return typeof value === 'string' && /^\/(?:media\/(?:audio|artwork)\/[A-Za-z0-9_.-]+|api\/catalog\/[A-Za-z0-9_-]+\/(?:lyrics|assets\/[A-Za-z0-9_-]+))$/.test(value) ? value : '';
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  }

  function formatDuration(track) {
    if (!track) return '—';
    if (track.isPreview) return '0:30';
    const duration = Number(track.duration || track.fullDuration || 0);
    return duration > 0 ? formatTime(duration) : '—';
  }

  function allTracks() {
    const sources = [state.data.tracks || [], state.data.uploads || [], state.searchResults || [], state.currentAlbum?.tracks || [], state.saved || []];
    for (const playlist of state.data.playlists || []) sources.push(playlist.tracks || []);
    for (const room of state.data.rooms || []) {
      if (room.currentTrack) sources.push([room.currentTrack]);
      sources.push((room.queue || []).map((item) => item.track));
    }
    const map = new Map();
    sources.flat().filter(Boolean).forEach((track) => { if (track.id) map.set(String(track.id), track); });
    return [...map.values()];
  }

  function getTrack(id) {
    return allTracks().find((track) => String(track.id) === String(id));
  }

  function getRoom(roomId = state.activeRoomId || state.selectedRoomId) {
    return (state.data.rooms || []).find((room) => room.id === roomId) || null;
  }

  function getPlaylist(playlistId = state.currentPlaylistId) {
    return (state.data.playlists || []).find((playlist) => playlist.id === playlistId) || null;
  }

  function getSavedTracks() { return state.saved || []; }

  /* ===== Landing / Welcome Gate ===== */
  const LANDING_KEY = 'koda-entered';
  let landingEmailMode = false;

  function hasEntered() {
    return localStorage.getItem(LANDING_KEY) === '1';
  }

  function renderLanding() {
    const wrapper = document.createElement('div');
    wrapper.className = 'landing-wrapper';
    wrapper.id = 'landing-gate';

    const emailSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/></svg>`;
    const googleSVG = `<svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;
    const arrowSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`;

    wrapper.innerHTML = `
      <div class="landing-orb landing-orb-1"></div>
      <div class="landing-orb landing-orb-2"></div>
      <div class="landing-orb landing-orb-3"></div>
      <div class="landing-noise"></div>
      <div class="landing-grid"></div>
      <div class="landing-scanline"></div>

      <div class="landing-notes">
        <span class="landing-note">♪</span>
        <span class="landing-note">♫</span>
        <span class="landing-note">♩</span>
        <span class="landing-note">♬</span>
        <span class="landing-note">♪</span>
        <span class="landing-note">♫</span>
        <span class="landing-note">♩</span>
        <span class="landing-note">♬</span>
      </div>

      <div class="landing-card">
        <div class="landing-logo">
          <div class="landing-logo-mark"><span></span><span></span><span></span></div>
          <div class="landing-logo-name">KODA</div>
          <div class="landing-logo-tag">TP — 01 · Open Music Studio</div>
        </div>

        <p class="landing-tagline">
          <strong>Listen together.</strong> Discover open-license music,
          create collaborative tapes, and vibe in real-time rooms.
        </p>

        <div class="landing-auth-group" id="landing-auth-main">
          <button class="landing-btn landing-btn-email" id="landing-email-btn">
            <span class="landing-btn-icon">${emailSVG}</span>
            Continue with Email
          </button>
          <button class="landing-btn landing-btn-google" id="landing-google-btn">
            <span class="landing-btn-icon">${googleSVG}</span>
            Continue with Google
          </button>

          <div class="landing-divider"><span>or</span></div>

          <button class="landing-btn landing-btn-guest" id="landing-guest-btn">
            <span class="landing-btn-icon">${arrowSVG}</span>
            Enter as Guest
          </button>
        </div>

        <div class="landing-footer">
          By continuing, you agree to KODA's<br />
          <a href="/terms" target="_blank">Terms of Service</a> & <a href="/privacy" target="_blank">Privacy Policy</a>
        </div>
      </div>

      <div class="landing-wave">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0 40 Q 180 0 360 40 T 720 40 T 1080 40 T 1440 40 V80 H0z" fill="currentColor"/>
        </svg>
      </div>
    `;

    document.body.appendChild(wrapper);

    const authMain = wrapper.querySelector('#landing-auth-main');
    setupAuthActions(authMain, wrapper);
  }

  function setupAuthActions(container, wrapper) {
    const emailSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m2 7 10 6 10-6"/></svg>`;
    const googleSVG = `<svg viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;
    const arrowSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`;

    const emailBtn = container.querySelector('#landing-email-btn');
    const googleBtn = container.querySelector('#landing-google-btn');
    const guestBtn = container.querySelector('#landing-guest-btn');

    emailBtn?.addEventListener('click', () => {
      let isSignUp = false;
      function renderForm() {
        container.innerHTML = `
          <div class="landing-email-form">
            <div style="display:flex;gap:12px;margin-bottom:12px;font-size:0.85rem;justify-content:center;">
              <button type="button" class="text-button ${!isSignUp ? 'active-toggle' : ''}" id="toggle-signin" style="font-weight:600;padding:4px 8px;cursor:pointer;opacity:${!isSignUp ? '1' : '0.6'};">Sign In</button>
              <span style="opacity:0.4;">·</span>
              <button type="button" class="text-button ${isSignUp ? 'active-toggle' : ''}" id="toggle-signup" style="font-weight:600;padding:4px 8px;cursor:pointer;opacity:${isSignUp ? '1' : '0.6'};">Create Account</button>
            </div>
            <input type="email" class="landing-input" id="landing-email-input" placeholder="you@example.com" autocomplete="email" required />
            <input type="password" class="landing-input" id="landing-pass-input" placeholder="Password (min 8 chars)" autocomplete="current-password" required />
            ${isSignUp ? '<input type="text" class="landing-input" id="landing-name-input" placeholder="Display name (optional)" />' : ''}
            <div id="landing-auth-error" style="color:#ff683b;font-size:0.8rem;margin-bottom:8px;display:none;text-align:center;"></div>
            <button class="landing-submit-btn" id="landing-email-submit">${isSignUp ? 'Create Account' : 'Sign In'}</button>
            <button class="landing-back-btn" id="landing-back-btn">← Back to options</button>
          </div>
        `;

        container.querySelector('#toggle-signin').addEventListener('click', () => { isSignUp = false; renderForm(); });
        container.querySelector('#toggle-signup').addEventListener('click', () => { isSignUp = true; renderForm(); });
        container.querySelector('#landing-back-btn').addEventListener('click', () => {
          renderLandingButtons(container, emailSVG, googleSVG, arrowSVG, wrapper);
        });

        const errEl = container.querySelector('#landing-auth-error');
        const submitBtn = container.querySelector('#landing-email-submit');
        const emailInput = container.querySelector('#landing-email-input');
        const passInput = container.querySelector('#landing-pass-input');

        async function submitAuth() {
          errEl.style.display = 'none';
          submitBtn.disabled = true;
          submitBtn.textContent = 'Authenticating...';
          const email = emailInput.value.trim();
          const password = passInput.value;
          const name = container.querySelector('#landing-name-input')?.value.trim();
          const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';

          try {
            const res = await api(endpoint, {
              method: 'POST',
              body: JSON.stringify({ email, password, name })
            });
            if (res.user) {
              state.profile = res.user;
              saveJSON(storageKeys.profile, state.profile);
            }
            showToast(`Welcome ${res.user?.name || 'in'}!`);
            enterApp(wrapper);
          } catch (err) {
            errEl.textContent = err.message || 'Authentication failed.';
            errEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = isSignUp ? 'Create Account' : 'Sign In';
          }
        }

        submitBtn.addEventListener('click', submitAuth);
        passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });
        setTimeout(() => emailInput?.focus(), 80);
      }

      renderForm();
    });

    googleBtn?.addEventListener('click', () => {
      window.location.href = '/api/auth/google';
    });

    guestBtn?.addEventListener('click', async () => {
      try {
        const res = await api('/api/auth/guest', { method: 'POST', body: JSON.stringify({}) });
        if (res.user) {
          state.profile = res.user;
          saveJSON(storageKeys.profile, state.profile);
        }
        showToast(`Entered as ${res.user?.name || 'Guest'} (Guest mode)`);
        enterApp(wrapper);
      } catch (_) {
        enterApp(wrapper);
      }
    });
  }

  function renderLandingButtons(container, emailSVG, googleSVG, arrowSVG, wrapper) {
    container.innerHTML = `
      <button class="landing-btn landing-btn-email" id="landing-email-btn">
        <span class="landing-btn-icon">${emailSVG}</span>
        Continue with Email
      </button>
      <button class="landing-btn landing-btn-google" id="landing-google-btn">
        <span class="landing-btn-icon">${googleSVG}</span>
        Continue with Google
      </button>
      <div class="landing-divider"><span>or</span></div>
      <button class="landing-btn landing-btn-guest" id="landing-guest-btn">
        <span class="landing-btn-icon">${arrowSVG}</span>
        Enter as Guest
      </button>
    `;
    setupAuthActions(container, wrapper);
  }

  function enterApp(wrapper) {
    localStorage.setItem(LANDING_KEY, '1');
    wrapper.classList.add('landing-exit');
    setTimeout(() => {
      wrapper.remove();
      bootApp();
    }, 650);
  }

  function logoutApp() {
    api('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
    if (audio) {
      try { audio.pause(); } catch (_e) {}
      audio.src = '';
      state.isPlaying = false;
      state.position = 0;
    }
    if (state.activeRoomId) {
      state.activeRoomId = null;
      state.selectedRoomId = null;
    }
    localStorage.removeItem(LANDING_KEY);
    closeModal();
    root.innerHTML = '';
    showToast('Signed out of KODA studio.');
    renderLanding();
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function bootApp() {
    applyTheme();
    if (audio) audio.volume = state.volume;

    // Show a premium loading screen while bootstrapping
    root.innerHTML = `
      <div style="width:100vw;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:var(--canvas);">
        <div style="display:flex;gap:5px;align-items:flex-end;">
          <span style="width:8px;height:20px;border-radius:4px;background:var(--accent);opacity:.65;animation:barPulse 1.2s ease-in-out infinite alternate;"></span>
          <span style="width:8px;height:30px;border-radius:4px;background:var(--accent);animation:barPulse 1.2s .2s ease-in-out infinite alternate;"></span>
          <span style="width:8px;height:16px;border-radius:4px;background:var(--accent);opacity:.8;animation:barPulse 1.2s .4s ease-in-out infinite alternate;"></span>
        </div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;letter-spacing:5px;color:var(--text);">
          KODA
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);letter-spacing:2px;margin-top:-8px;">LOADING STUDIO…</div>
      </div>`;

    try {
      state.data = await api('/api/bootstrap');
      state.currentTrack = state.data.tracks?.[0] || null;
      state.duration = state.currentTrack?.duration || 30;
      const sharedTape = location.hash.match(/^#tape\/(.+)$/);
      const sharedRoom = location.hash.match(/^#room\/(.+)$/);
      if (sharedTape) { state.currentPlaylistId = sharedTape[1]; state.page = 'playlist'; }
      else if (sharedRoom) { state.selectedRoomId = sharedRoom[1]; state.page = 'room'; }
      render();
      connectSocket();
      await refreshAdminSession(false);
      checkSecretHash();
      // Polling is a fallback for environments which do not proxy WebSockets.
      setInterval(refreshBootstrap, 18000);

      // Show welcome toast for new users
      const hasSeenWelcome = localStorage.getItem('koda-welcomed');
      if (!hasSeenWelcome) {
        localStorage.setItem('koda-welcomed', '1');
        setTimeout(() => showToast('Welcome to KODA! Start by exploring the catalog or creating a listening room.'), 800);
      }
    } catch (error) {
      renderFatal(error.message);
    }
  }

  function checkSecretHash() {
    if (location.hash === '#studio-control' || location.hash === '#manage-desk') {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch (_) {
        location.hash = '';
      }
      if (state.admin.authenticated) {
        openAdminPage();
      } else {
        showSecretAdminModal();
      }
      return true;
    }
    return false;
  }

  function showSecretAdminModal() {
    showModal('Studio Desk', `
      <p class="modal-intro">Private management desk. Enter master key to unlock publishing controls.</p>
      <form data-form="admin-login" class="admin-login-modal-form" style="display:flex;flex-direction:column;gap:14px;">
        <label class="form-field">
          <span>Master Key</span>
          <input class="form-input" type="password" name="password" autocomplete="current-password" placeholder="Enter admin password" required autofocus />
        </label>
        <div class="modal-actions" style="margin-top:10px;">
          <button type="button" class="button button-ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="button button-primary">Unlock Studio Desk ${icon('arrow', 14)}</button>
        </div>
      </form>
    `);
  }

  async function loadApp() {
    applyTheme();
    try {
      const authData = await api('/api/auth/me');
      if (authData?.authenticated || authData?.isGuest) {
        state.profile = authData.user;
        state.isGuest = Boolean(authData.isGuest);
        saveJSON(storageKeys.profile, state.profile);
        localStorage.setItem(LANDING_KEY, '1');
      }
    } catch (_) {}

    if (hasEntered()) {
      bootApp();
    } else {
      renderLanding();
      checkSecretHash();
    }
  }


  async function refreshAdminSession(renderAfter = false) {
    try {
      const session = await api('/api/admin/session');
      state.admin.enabled = Boolean(session.enabled);
      state.admin.authenticated = Boolean(session.authenticated);
      state.admin.setupHint = session.setupHint || '';
      state.admin.error = '';
      if (state.admin.authenticated) {
        const catalog = await api('/api/admin/catalog');
        state.admin.items = catalog.items || [];
      } else {
        state.admin.items = [];
      }
    } catch (error) {
      state.admin.error = error.message;
    }
    if (renderAfter && state.page === 'admin') render();
  }

  async function openAdminPage() {
    state.page = 'admin';
    state.admin.loading = true;
    render();
    await refreshAdminSession(false);
    state.admin.loading = false;
    render();
  }

  async function loginAdmin(form) {
    const password = new FormData(form).get('password');
    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying…'; }
    state.admin.loading = true;
    state.admin.error = '';
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      await refreshAdminSession(false);
      if (!state.admin.authenticated) throw new Error('Sign-in could not be verified.');
      state.admin.loading = false;
      closeModal();
      localStorage.setItem(LANDING_KEY, '1');
      if (!state.data) {
        await bootApp();
      }
      await openAdminPage();
      showToast('Studio Desk unlocked. Welcome back.');
    } catch (error) {
      state.admin.loading = false;
      state.admin.error = error.message;
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Unlock Studio Desk'; }
      showToast(error.message || 'Invalid admin credentials', true);
    }
  }

  async function logoutAdmin() {
    try { await api('/api/admin/logout', { method: 'POST', body: JSON.stringify({}) }); }
    catch (_error) { /* Clearing the local admin view still signs this device out. */ }
    state.admin.authenticated = false;
    state.admin.items = [];
    state.admin.error = '';
    if (state.page === 'admin') {
      state.page = 'home';
    }
    render();
    showToast('Studio Desk locked & signed out.');
  }

  async function refreshAdminCatalog() {
    try {
      const data = await api('/api/admin/catalog');
      state.admin.items = data.items || [];
      if (state.page === 'admin') render();
    } catch (error) {
      state.admin.error = error.message;
      if (state.page === 'admin') render();
    }
  }

  async function submitAdminCatalog(form) {
    const button = form.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Publishing…'; }
    try {
      const data = await api('/api/admin/catalog', { method: 'POST', body: new FormData(form) });
      state.data.tracks = data.tracks || state.data.tracks;
      state.admin.items = data.items || state.admin.items;
      state.admin.error = '';
      form.reset();
      render();
      showToast(`Published “${data.track.title}” to the shared catalog.`);
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Publish shared release'; }
      state.admin.error = error.message;
      render();
      showToast(error.message, true);
    }
  }

  async function deleteAdminCatalogTrack(id) {
    const track = state.admin.items.find((item) => item.id === id);
    if (!track || !window.confirm(`Remove “${track.title}” and its uploaded files from the shared catalog?`)) return;
    try {
      const data = await api(`/api/admin/catalog/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.data.tracks = data.tracks || state.data.tracks;
      state.admin.items = data.items || [];
      render();
      showToast('Track and attachments removed.');
    } catch (error) {
      state.admin.error = error.message;
      render();
    }
  }

  function showAdminEditModal(id) {
    const track = state.admin.items.find((item) => item.id === id);
    if (!track || !state.admin.authenticated) return;
    const licenseValue = adminLicenseOptions.find(([, label]) => label === track.licenseName)?.[0] || 'authorized';
    const genreValue = adminGenreOptions.includes(track.tag) ? track.tag : 'other';
    showModal('Edit shared release', `<p class="modal-intro">Update the release details, rights note, or lyrics. To replace audio, artwork, or attached files, remove the release and publish it again.</p><form data-form="admin-edit" data-id="${escapeHTML(track.id)}"><div class="form-grid"><div class="form-field"><label>Track title</label><input class="form-input" name="title" maxlength="100" value="${escapeHTML(track.title)}" required /></div><div class="form-field"><label>Artist / attribution</label><input class="form-input" name="artist" maxlength="100" value="${escapeHTML(track.artist)}" required /></div></div><div class="form-grid"><div class="form-field"><label>Release / album</label><input class="form-input" name="album" maxlength="100" value="${escapeHTML(track.album || '')}" /></div><div class="form-field"><label>Year</label><input class="form-input" name="year" type="number" min="1900" max="${new Date().getFullYear() + 1}" value="${escapeHTML(track.year || '')}" placeholder="YYYY" /></div></div><div class="form-grid"><div class="form-field"><label>Genre</label><select class="form-input" name="genre">${adminGenreOptions.map((genre) => `<option value="${genre}" ${genre === genreValue ? 'selected' : ''}>${genre.charAt(0).toUpperCase() + genre.slice(1)}</option>`).join('')}</select></div><div class="form-field"><label>Rights / license</label><select class="form-input" name="license">${adminLicenseOptions.map(([value, label]) => `<option value="${value}" ${value === licenseValue ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('')}</select></div></div><div class="form-field"><label>Original source URL (HTTPS)</label><input class="form-input" name="sourceUrl" type="url" value="${escapeHTML(track.sourceUrl || track.linkUrl || '')}" placeholder="https://…" /></div><div class="form-field"><label>Attribution / rights note</label><textarea class="form-input form-textarea" name="rightsStatement" maxlength="1000">${escapeHTML(track.rightsStatement || '')}</textarea></div><div class="form-field"><label>Lyrics / liner notes</label><textarea class="form-input form-textarea" name="lyricsText" maxlength="60000" placeholder="Paste lyrics or notes…">${escapeHTML(track.lyricsText || '')}</textarea></div><label class="rights-check"><input type="checkbox" name="rightsConfirmed" value="true" required /><span>I confirm these updated credits, rights details, and lyrics are accurate and that I have permission to share them.</span></label><div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save release details</button></div></form>`);
  }

  async function updateAdminCatalogTrack(form) {
    const button = form.querySelector('[type="submit"]');
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'Saving…'; }
    const values = new FormData(form);
    const body = {
      title: values.get('title'), artist: values.get('artist'), album: values.get('album'), year: values.get('year'),
      genre: values.get('genre'), license: values.get('license'), sourceUrl: values.get('sourceUrl'),
      rightsStatement: values.get('rightsStatement'), lyricsText: values.get('lyricsText'), rightsConfirmed: values.has('rightsConfirmed')
    };
    try {
      const data = await api(`/api/admin/catalog/${encodeURIComponent(form.dataset.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
      state.data.tracks = data.tracks || state.data.tracks;
      state.admin.items = data.items || state.admin.items;
      state.admin.error = '';
      closeModal();
      await refreshBootstrap();
      if (state.page === 'admin') render();
      showToast(`Updated “${data.track.title}”.`);
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'Save release details'; }
      showToast(error.message, true);
    }
  }

  async function refreshBootstrap() {
    try {
      const data = await api('/api/bootstrap');
      state.data = { ...state.data, ...data };
      render();
    } catch (_error) { /* Keep the last good view while offline. */ }
  }

  function connectSocket() {
    if (!('WebSocket' in window)) return;
    try {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/ws`);
      state.socket = socket;
      socket.addEventListener('open', () => {
        state.socketConnected = true;
        updateConnectionDot();
        sendSyncPing();
      });
      socket.addEventListener('close', () => { state.socketConnected = false; updateConnectionDot(); setTimeout(() => { if (state.socket === socket) connectSocket(); }, 3500); });
      socket.addEventListener('error', () => { state.socketConnected = false; updateConnectionDot(); });
      socket.addEventListener('message', (event) => {
        try { handleSocketMessage(JSON.parse(event.data)); } catch (_error) { /* Ignore malformed messages. */ }
      });

      if (!state.syncInterval) {
        state.syncInterval = setInterval(() => {
          if (state.socket && state.socket.readyState === 1) sendSyncPing();
        }, 12000);
      }
    } catch (_error) { state.socketConnected = false; }
  }

  function sendSyncPing() {
    if (state.socket && state.socket.readyState === 1) {
      state.socket.send(JSON.stringify({ type: 'sync_ping', clientTime: Date.now() }));
    }
  }

  function updateMediaSession(track) {
    if (!('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'KODA Studio',
        artist: track.artist || 'Open Music',
        album: track.album || 'Live Listening Room',
        artwork: track.cover ? [{ src: track.cover, sizes: '512x512', type: 'image/jpeg' }] : []
      });
      navigator.mediaSession.playbackState = state.isPlaying ? 'playing' : 'paused';
      navigator.mediaSession.setActionHandler('play', () => { if (audio.paused) audio.play(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (!audio.paused) audio.pause(); });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && audio) audio.currentTime = details.seekTime;
      });
    } catch (_) {}
  }

  function handleSocketMessage(message) {
    const { event, payload } = message || {};
    if (message?.type === 'sync_pong') {
      const rtt = Date.now() - Number(message.clientTime || 0);
      state.serverClockOffset = Number(message.serverTime || 0) + (rtt / 2) - Date.now();
      return;
    }
    if (event === 'connected') { state.socketConnected = true; updateConnectionDot(); return; }
    if (event === 'rooms_updated' || event === 'room_synced') {
      state.data.rooms = Array.isArray(payload) ? payload : payload?.rooms || state.data.rooms;
      if (state.activeRoomId) followRoomSync(getRoom(state.activeRoomId));
      render();
      return;
    }
    if (event === 'playlists_updated') { state.data.playlists = payload; render(); return; }
    if (event === 'activity_updated') { state.data.activityFeed = payload; render(); return; }
    if (event === 'uploads_updated') { state.data.uploads = payload; render(); return; }
    if (event === 'catalog_updated') {
      state.data.tracks = Array.isArray(payload) ? payload : state.data.tracks;
      if (state.page === 'admin' && state.admin.authenticated) { refreshAdminCatalog(); return; }
      render();
      return;
    }
    if (event === 'room_tip') {
      showToast(payload.announcement || 'A listener tipped the room! 🪙');
      return;
    }
    if (event === 'room_reaction') { showReaction(payload); return; }
  }

  function followRoomSync(room) {
    if (!room || !state.activeRoomId || state.updatingFromRoom) return;
    if (room.currentTrack && room.currentTrack.id !== state.currentTrack?.id) {
      state.updatingFromRoom = true;
      state.currentTrack = room.currentTrack;
      const nowAdjusted = Date.now() + (state.serverClockOffset || 0);
      const targetPos = room.startedAt ? Math.max(0, (nowAdjusted - Number(room.startedAt)) / 1000) : (Number(room.currentPosition) || 0);
      state.position = targetPos;
      state.duration = state.currentTrack.duration || 30;
      audio.src = state.currentTrack.streamUrl || '';
      audio.currentTime = targetPos;
      if (room.isPlaying) {
        audio.play().then(() => { state.isPlaying = true; updateMediaSession(state.currentTrack); }).catch(() => { state.isPlaying = false; });
      } else {
        audio.pause(); state.isPlaying = false;
      }
      updateMediaSession(state.currentTrack);
      setTimeout(() => { state.updatingFromRoom = false; }, 800);
      return;
    }

    if (!room.currentTrack || !state.currentTrack) return;

    // Smooth NTP Micro-Adjustment Drift Compensation (prevents echoing & audio clicks)
    if (room.isPlaying && room.startedAt && !audio.paused && audio.duration) {
      const nowAdjusted = Date.now() + (state.serverClockOffset || 0);
      const targetPos = Math.max(0, (nowAdjusted - Number(room.startedAt)) / 1000) % (audio.duration || 3600);
      const drift = targetPos - audio.currentTime;
      if (Math.abs(drift) > 1.2) {
        audio.currentTime = targetPos;
        audio.playbackRate = 1.0;
      } else if (drift > 0.08) {
        audio.playbackRate = 1.03; // Smooth micro-speedup
      } else if (drift < -0.08) {
        audio.playbackRate = 0.97; // Smooth micro-slowdown
      } else {
        audio.playbackRate = 1.0; // In sync
      }
    }

    if (room.isPlaying && audio.paused && state.currentTrack.id === room.currentTrack.id) {
      audio.play().then(() => { state.isPlaying = true; updateMediaSession(state.currentTrack); }).catch(() => {});
    } else if (!room.isPlaying && !audio.paused) {
      audio.pause();
      state.isPlaying = false;
    }
  }

  function updateConnectionDot() {
    document.querySelectorAll('[data-connection-dot]').forEach((node) => {
      node.classList.toggle('connected', state.socketConnected);
      node.title = state.socketConnected ? 'Live sync connected' : 'Reconnecting…';
    });
  }

  function renderFatal(message) {
    root.innerHTML = `<div class="fatal-screen"><div class="fatal-card"><div class="brand-lockup">${icon('radio', 22)} KODA</div><h1>The studio is warming up.</h1><p>${escapeHTML(message || 'Could not connect to KODA.')}</p><button class="button button-primary" data-action="retry">Try again</button></div></div>`;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem(storageKeys.theme, state.theme);
  }

  function navPage(page) {
    if (page === 'admin' && !state.admin.authenticated) {
      page = 'home';
    }
    state.page = page;
    if (page !== 'room') state.selectedRoomId = null;
    if (page !== 'playlist') state.currentPlaylistId = page === 'playlists' ? state.currentPlaylistId : state.currentPlaylistId;
    if (page === 'discover' && !state.searchQuery) { state.searchResults = null; state.searchAlbums = []; state.searchError = ''; }
    render();
    document.querySelector('.studio-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    if (!state.data || !Array.isArray(state.data.rooms)) return;
    const focused = document.activeElement?.dataset?.focusKey;
    const selectionStart = document.activeElement?.selectionStart;
    const selectionEnd = document.activeElement?.selectionEnd;
    root.innerHTML = `
      <div class="studio-shell">
        ${renderSidebar()}
        ${renderTopbar()}
        <main class="studio-main" id="main-content">${renderPage()}</main>
        ${renderRightbar()}
        ${renderPlayer()}
      </div>`;
    if (focused) {
      const next = root.querySelector(`[data-focus-key="${CSS.escape(focused)}"]`);
      if (next) {
        next.focus({ preventScroll: true });
        if (typeof selectionStart === 'number' && next.setSelectionRange) next.setSelectionRange(selectionStart, selectionEnd);
      }
    }
    updateConnectionDot();
    updatePlayerProgress();
  }

  function renderSidebar() {
    const active = (page) => state.page === page || (page === 'rooms' && state.page === 'room') || (page === 'playlists' && state.page === 'playlist');
    const nav = [
      ['home', 'Home', 'home'], ['discover', 'Discover', 'search'], ['rooms', 'Listening rooms', 'radio'],
      ['playlists', 'Crew tapes', 'playlist'], ['activity', 'Crew activity', 'activity']
    ];
    const roomRows = (state.data.rooms || []).slice(0, 3).map((room) => `
      <button class="sidebar-room" data-action="open-room" data-id="${escapeHTML(room.id)}">
        <span class="sidebar-room-art"><img src="${safeCover(room.currentTrack?.cover)}" alt="" /></span>
        <span class="sidebar-room-copy"><b>${escapeHTML(room.name)}</b><small>${escapeHTML(room.vibe || 'Open room')}</small></span>
        <span class="sidebar-room-count">${(room.listeners || []).length}</span>
      </button>`).join('');
    const friendsOnline = (state.data.friends || []).filter((friend) => friend.status === 'online').length;

    return `<aside class="studio-sidebar">
      <div class="brand-box">
        <button class="brand-logo" data-action="navigate" data-page="home" aria-label="KODA home"><span class="brand-mark"><span></span><span></span><span></span></span><span class="brand-name">KODA</span><span class="brand-tag">TP—01</span></button>
        <button class="icon-button quiet" data-action="profile" title="Your profile">${avatarHTML(state.profile, 'small')}</button>
      </div>
      <div class="sidebar-scroll">
        <div class="nav-section">
          <div class="nav-label">Studio</div>
          ${nav.map(([page, label, symbol]) => `<button class="nav-btn ${active(page) ? 'active' : ''}" data-action="navigate" data-page="${page}"><span class="nav-btn-left">${icon(symbol, 16)}<span>${label}</span></span>${page === 'rooms' ? '<span class="nav-live-count"><i></i>' + (state.data.rooms || []).length + '</span>' : ''}</button>`).join('')}
        </div>
        <div class="nav-section sidebar-room-section">
          <div class="nav-label"><span>On air</span><button class="mini-plus" data-action="create-room" title="Create a room">${icon('plus', 13)}</button></div>
          ${roomRows || '<div class="sidebar-empty">No rooms yet</div>'}
          <button class="sidebar-link" data-action="navigate" data-page="rooms">See all rooms ${icon('arrow', 13)}</button>
        </div>
        <div class="nav-section">
          <div class="nav-label"><span>Your library</span></div>
          <button class="nav-btn ${active('library') ? 'active' : ''}" data-action="navigate" data-page="library"><span class="nav-btn-left">${icon('library', 16)}<span>Saved music</span></span><span class="nav-count">${state.saved.length || ''}</span></button>
          <button class="nav-btn ${active('vault') ? 'active' : ''}" data-action="navigate" data-page="vault"><span class="nav-btn-left">${icon('upload', 16)}<span>Shared uploads</span></span><span class="nav-count">${(state.data.tracks || []).filter((track) => track.source === 'admin-catalog').length || ''}</span></button>
        </div>
        ${state.admin.authenticated ? `
        <div class="nav-section" style="border-top:1px solid var(--border);padding-top:10px;margin-top:10px;">
          <div class="nav-label"><span>Master Console</span><span class="online-count" style="background:var(--accent);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;">ADMIN</span></div>
          <button class="nav-btn ${active('admin') ? 'active' : ''}" data-action="navigate" data-page="admin"><span class="nav-btn-left">${icon('spark', 16)}<span>Studio Desk</span></span></button>
        </div>` : ''}

        <div class="sidebar-friends">
          <div class="nav-label"><span>Crew online</span><span class="online-count">${friendsOnline}</span></div>
          ${(state.data.friends || []).length ? (state.data.friends || []).slice(0, 4).map((friend) => `<button class="friend-mini" data-action="join-room" data-id="${escapeHTML(friend.roomId || '')}"><span class="presence-avatar" style="--avatar-color:${escapeHTML(friend.color || '#777')}">${escapeHTML(friend.avatar || initials(friend.name))}<i class="presence-dot ${friend.status === 'online' ? 'is-online' : ''}"></i></span><span><b>${escapeHTML(friend.name)}</b><small>${escapeHTML(friend.roomName || friend.note || 'Listening')}</small></span></button>`).join('') : '<div class="sidebar-empty">No real listeners yet.<br />Start a room and invite a friend.</div>'}
        </div>
      </div>
      <div class="sidebar-profile">
        <button class="sidebar-pro-btn" data-action="open-pro" style="display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin:10px 0;padding:8px 12px;background:rgba(255,104,59,0.12);border:1px solid var(--accent);color:var(--accent);border-radius:8px;font-weight:700;font-size:12px;cursor:pointer;">⚡ Upgrade to Pro</button>
        <button class="profile-row" data-action="profile"><span class="avatar avatar-medium" style="--avatar-color:${escapeHTML(state.profile.color)}">${escapeHTML(state.profile.avatar || initials(state.profile.name))}</span><span class="profile-copy"><b>${escapeHTML(state.profile.name)}</b><small>${escapeHTML(state.profile.handle)}</small></span><span class="profile-settings">${icon('settings', 16)}</span></button>
        <button class="sidebar-logout-btn" data-action="logout" title="Sign out / Exit to login page">${icon('logout', 14)} <span>Sign out</span></button>
        <div class="sidebar-footer"><span><i class="connection-dot ${state.socketConnected ? 'connected' : ''}" data-connection-dot></i> ${state.socketConnected ? 'Live sync on' : 'Sync connecting'}</span><span class="mono">v1.0.0</span></div>
        <div class="sidebar-legal-links" style="display:flex;justify-content:center;gap:6px;font-size:11px;color:var(--muted);margin-top:6px;"><a href="/terms" target="_blank" style="color:var(--muted);text-decoration:none;">Terms</a> · <a href="/privacy" target="_blank" style="color:var(--muted);text-decoration:none;">Privacy</a> · <button data-action="open-dmca" style="background:none;border:none;padding:0;color:var(--muted);font-size:11px;cursor:pointer;">DMCA</button></div>
      </div>
    </aside>`;
  }

  function renderTopbar() {
    return `<header class="studio-topbar">
      <div class="breadcrumb"><span class="breadcrumb-slash">/</span><span>${escapeHTML(pageTitle())}</span>${state.page === 'room' && getRoom(state.selectedRoomId) ? `<span class="breadcrumb-sep">/</span><b>${escapeHTML(getRoom(state.selectedRoomId).name)}</b>` : ''}</div>
      <div class="topbar-center"><label class="search-bar-wrap">${icon('search', 16, 'search-icon')}<input class="search-input" type="search" autocomplete="off" placeholder="Search songs, artists, albums…" value="${escapeHTML(state.searchQuery)}" data-role="search" data-focus-key="global-search" /><kbd class="search-kbd">⌘ K</kbd><button class="search-clear ${state.searchQuery ? 'visible' : ''}" data-action="clear-search" title="Clear search">${icon('close', 13)}</button></label></div>
      <div class="topbar-actions"><span class="catalog-label"><span class="catalog-dot"></span> OPEN-LICENSE CATALOG</span><button class="button button-secondary top-action" data-action="create-room">${icon('plus', 14)}<span>New room</span></button><button class="icon-button theme-switch" data-action="toggle-theme" title="Toggle theme">${icon(state.theme === 'dark' ? 'sun' : 'moon', 16)}</button><button class="icon-button logout-button" data-action="logout" title="Sign out / Exit to login page">${icon('logout', 15)}</button></div>
    </header>`;
  }

  function pageTitle() {
    return ({ home: 'Home', discover: 'Discover', search: 'Search', rooms: 'Listening rooms', room: 'Listening room', playlists: 'Crew tapes', playlist: 'Tape detail', activity: 'Crew activity', library: 'Your library', vault: 'Shared uploads', stage: 'Now playing', album: 'Album' })[state.page] || 'Studio';
  }

  function renderPage() {
    switch (state.page) {
      case 'discover': return renderDiscover();
      case 'search': return renderSearchPage();
      case 'rooms': return renderRoomsPage();
      case 'room': return renderRoomPage();
      case 'playlists': return renderPlaylistsPage();
      case 'playlist': return renderPlaylistPage();
      case 'activity': return renderActivityPage();
      case 'library': return renderLibraryPage();
      case 'vault': return renderVaultPage();

      case 'stage': return renderStagePage();
      case 'album': return renderAlbumPage();
      default: return renderHome();
    }
  }

  function renderHome() {
    const tracks = (state.data.tracks || []).slice(0, 7);
    const rooms = state.data.rooms || [];
    const tapes = state.data.playlists || [];
    return `<section class="home-hero hero-strip">
      <div class="hero-copy"><div class="hero-eyebrow"><span class="hero-live-dot"></span> A SOCIAL LISTENING STUDIO</div><h1 class="hero-title display-font">Good music gets<br /><em>better together.</em></h1><p class="hero-sub">Find your people, make a room, and build a tape together. No algorithm between you and the song.</p><div class="hero-actions"><button class="button button-primary" data-action="navigate" data-page="discover">${icon('search', 15)} Explore the catalog</button><button class="button button-ghost" data-action="create-room">${icon('radio', 15)} Start a listening room</button></div><div class="hero-footnote"><span>${icon('spark', 13)} Independent by design</span><span class="hero-footnote-sep">·</span><span>Open-licensed music · full length</span></div></div>
      <div class="hero-art-wrap"><div class="hero-art-orbit orbit-one"></div><div class="hero-art-orbit orbit-two"></div><div class="hero-disc"><div class="hero-disc-groove"></div><div class="hero-disc-label">K<br /><small>01</small></div></div><div class="hero-sticker sticker-a">ROOM<br />FOR<br />EVERYONE</div><div class="hero-sticker sticker-b">LISTEN<br />CLOSER ↗</div><div class="hero-art-caption mono">SIDE A · SHARED FREQUENCY</div></div>
    </section>
    <div class="trust-strip"><div class="trust-item"><span class="trust-icon">${icon('headphones', 16)}</span><span><b>Your music, your call</b><small>Upload audio you have permission to share</small></span></div><div class="trust-divider"></div><div class="trust-item"><span class="trust-icon">${icon('people', 16)}</span><span><b>Listen in sync</b><small>Live rooms with shared queues & chat</small></span></div><div class="trust-divider"></div><div class="trust-item"><span class="trust-icon">${icon('earth', 16)}</span><span><b>Open catalog</b><small>Full tracks with source + license shown</small></span></div></div>
    ${sectionHead('On air, right now', 'A room is better with company', 'rooms', 'View all')}
    ${renderRoomCards(rooms.slice(0, 3))}
    <div class="home-two-col">
      <section class="home-music-section">${sectionHead('First listens', 'A few things worth hearing', 'discover', 'Browse all')}
        <div class="track-intro-line"><span class="tiny-led"></span><span>Full-length songs from open-license collections, with source and license credits.</span></div>
        ${renderTrackTable(tracks, { compact: true })}
      </section>
      <section class="home-tape-section">${sectionHead('Made by the crew', 'Collaborative tapes, not playlists from a machine', 'playlists', 'See tapes')}
        ${renderTapeList(tapes.slice(0, 3))}
        <div class="tiny-note-card"><span class="tiny-note-icon">${icon('note', 15)}</span><p><b>Leave a liner note.</b><br />Tell your friends why this song matters.</p></div>
      </section>
    </div>
    ${renderActivityPreview()}`;
  }

  function renderDiscover() {
    const genre = state.selectedGenre;
    const filtered = genre === 'all' ? (state.data.tracks || []) : (state.data.tracks || []).filter((track) => track.tag === genre);
    const currentTracks = state.searchQuery ? (state.searchResults || []) : filtered;
    return `<section class="page-hero compact-hero"><div><div class="hero-eyebrow">${icon('search', 13)} DISCOVER</div><h1 class="display-font">Find a new <em>favorite.</em></h1><p>Search open-licensed music from around the world and play the full track here.</p></div><div class="hero-side-note mono">FULL-TRACK MODE<br /><span>ARCHIVE · OPEN LICENSES</span></div></section>
      ${state.pendingPlaylistId ? `<div class="target-banner"><span>${icon('playlist', 15)} Adding to <b>${escapeHTML(getPlaylist(state.pendingPlaylistId)?.title || 'a crew tape')}</b></span><button class="button button-small button-ghost" data-action="cancel-playlist-target">Cancel</button></div>` : ''}
      ${state.activeRoomId ? `<div class="target-banner room-target-banner"><span><i class="live-dot"></i> Listening together in <b>${escapeHTML(getRoom()?.name || 'your room')}</b> — queue any open track for the crew.</span><button class="button button-small button-ghost" data-action="navigate" data-page="room">Open room</button></div>` : ''}
      <div class="filter-row"><div class="genre-filters">${[['all','All sounds'],['ambient','Ambient'],['acoustic','Acoustic'],['electronic','Electronic'],['experimental','Experimental'],['indie','Indie'],['jazz','Jazz'],['rock','Rock'],['folk','Folk'],['world','World'],['piano','Piano'],['soul','Soul'],['house','House'],['disco','Disco'],['dub','Dub']].map(([key,label]) => `<button class="filter-pill ${genre === key ? 'active' : ''}" data-action="set-genre" data-id="${key}">${label}</button>`).join('')}</div><span class="catalog-inline">${icon('external', 12)} Source + license on every track</span></div>
      ${state.searchQuery ? `<div class="search-results-label"><div><span class="mono small-label">CATALOG SEARCH</span><h2>Results for “${escapeHTML(state.searchQuery)}”</h2></div>${state.searchLoading ? '<span class="loading-caption"><i class="spinner"></i> Searching</span>' : `<span class="result-count">${(state.searchResults || []).length} songs · ${(state.searchAlbums || []).length} albums</span>`}</div>` : sectionHead('The edit', 'A small selection to start with', 'discover', '')}
      ${state.searchError ? `<div class="inline-error">${icon('note', 15)} ${escapeHTML(state.searchError)}</div>` : ''}
      ${state.searchLoading && !state.searchResults ? '<div class="loading-panel"><i class="spinner"></i> Searching the catalog…</div>' : ''}
      ${!state.searchLoading && currentTracks.length ? renderTrackTable(currentTracks) : ''}
      ${!state.searchLoading && !currentTracks.length ? emptyState('No open tracks found for that search.', 'Try another title, artist, or genre. Search only returns tracks with supported open licenses.') : ''}
      ${(state.searchAlbums || []).length ? `<section class="album-search-section">${sectionHead('Albums', 'More from the catalog', '', '')}<div class="album-grid">${state.searchAlbums.map(renderAlbumCard).join('')}</div></section>` : ''}
      <div class="catalog-disclaimer"><span>${icon('spark', 14)}</span><span><b>Open tracks, credited properly.</b> KODA streams full-length music whose Archive item declares CC BY, CC BY-SA, CC0, or Public Domain Mark terms. Each track links to its source and license; check the source record for exact attribution.</span></div>`;
  }

  function renderSearchPage() {
    if (!state.searchQuery) return renderDiscover();
    return renderDiscover();
  }

  function renderRoomsPage() {
    return `<section class="page-hero room-page-hero"><div><div class="hero-eyebrow"><span class="hero-live-dot"></span> LISTEN TOGETHER</div><h1 class="display-font">Rooms with a <em>shared pulse.</em></h1><p>One track, one queue, one group chat. Join an open room or start your own listening session.</p></div><button class="button button-primary" data-action="create-room">${icon('plus', 15)} Make a room</button></section>
      <div class="room-feature-note"><span class="mono">ROOM PROTOCOL · 01</span><span>Playback sync is shared across connected listeners. Open-licensed catalog tracks play in full; uploads should be audio you can share.</span><span class="connection-pill"><i class="connection-dot ${state.socketConnected ? 'connected' : ''}" data-connection-dot></i>${state.socketConnected ? 'LIVE SYNC' : 'CONNECTING'}</span></div>
      ${sectionHead('Open studios', `${(state.data.rooms || []).length} rooms in the room list`, 'rooms', '')}
      ${renderRoomCards(state.data.rooms || [])}
      <section class="room-how"><div class="room-how-title"><span class="mono small-label">HOW IT WORKS</span><h2>Less broadcasting.<br /><em>More hanging out.</em></h2></div><div class="room-how-steps"><div><span>01</span><b>Start a room</b><p>Give the session a name and invite the people you want to hear from.</p></div><div><span>02</span><b>Set the queue</b><p>Everyone can add tracks and vote on what comes up next.</p></div><div><span>03</span><b>Stay in sync</b><p>Play, pause, chat, and send a reaction together.</p></div></div></section>`;
  }

  function renderRoomPage() {
    const room = getRoom(state.selectedRoomId || state.activeRoomId);
    if (!room) return `<section class="page-hero compact-hero"><div><div class="hero-eyebrow">LISTEN TOGETHER</div><h1 class="display-font">Every room starts with a song.</h1><p>Pick an open room or start one for your crew.</p></div><button class="button button-primary" data-action="create-room">${icon('plus', 15)} New room</button></section>${renderRoomCards(state.data.rooms || [])}`;
    const joined = state.activeRoomId === room.id;
    const track = room.currentTrack;
    return `<section class="room-detail-hero"><div class="room-cover-plate"><img src="${safeCover(track?.cover)}" alt="" /><div class="room-cover-overlay"><span class="room-cover-onair"><i></i> ${room.isPlaying ? 'ON AIR' : 'ROOM OPEN'}</span><span class="room-cover-code mono">${escapeHTML(room.code || 'KODA')}</span></div></div><div class="room-detail-copy"><div class="hero-eyebrow"><span class="hero-live-dot"></span> LISTENING ROOM <span class="room-code-tag mono">${escapeHTML(room.code || '')}</span></div><h1 class="display-font">${escapeHTML(room.name)}</h1><p class="room-detail-subtitle">${escapeHTML(room.subtitle || 'A room for the music.')}</p><div class="room-vibe-row">${escapeHTML(room.vibe || 'Open format')}<span>·</span>${(room.listeners || []).length} listening</div><div class="room-host-row"><span class="avatar avatar-small" style="--avatar-color:${escapeHTML(room.host?.color || '#ff5a1f')}">${escapeHTML(room.host?.avatar || 'K')}</span><span>Hosted by <b>${escapeHTML(room.host?.name || 'A friend')}</b></span></div><div class="hero-actions">${joined ? `<button class="button button-primary" data-action="navigate" data-page="discover">${icon('search', 14)} Add a song</button><button class="button button-secondary" data-action="leave-room">Leave room</button>` : `<button class="button button-primary" data-action="join-room" data-id="${escapeHTML(room.id)}">${icon('headphones', 15)} Join room</button>`}<button class="button button-ghost" data-action="copy-room" data-id="${escapeHTML(room.code || '')}">${icon('link', 14)} Copy room code</button></div></div></section>
      <div class="room-now-panel"><div class="room-now-track">${track ? trackMini(track) : '<span class="empty-cover"></span><span>Nothing playing yet</span>'}<span class="room-now-caption">${room.isPlaying ? 'PLAYING NOW' : 'UP NEXT, WHEN YOU ARE'}</span></div><div class="room-now-actions"><button class="button button-small button-secondary" data-action="${joined ? 'player-toggle' : 'join-room'}" ${joined ? '' : `data-id="${escapeHTML(room.id)}"`}>${icon(room.isPlaying ? 'pause' : 'play', 13)} ${room.isPlaying ? 'Pause together' : 'Play together'}</button><div class="avatar-stack">${(room.listeners || []).slice(0, 5).map((person) => avatarHTML(person, 'stack')).join('')}<span class="listener-count">+${(room.listeners || []).length}</span></div></div></div>
      <div class="room-main-columns"><section>${sectionHead('The shared queue', `${(room.queue || []).length} tracks waiting`, '', '')}<div class="room-queue-list">${(room.queue || []).length ? room.queue.map((item, index) => `<div class="room-queue-row"><span class="mono queue-rank">${String(index + 1).padStart(2, '0')}</span>${trackMini(item.track)}<span class="queue-added">Added by <b>${escapeHTML(item.addedBy?.name || 'A friend')}</b></span><button class="vote-button" data-action="vote" data-room="${escapeHTML(room.id)}" data-id="${escapeHTML(item.qid)}">↑ ${item.votes || 0}</button></div>`).join('') : `<div class="queue-empty">No songs in line. Be the first to add one.</div>`}</div></section><section class="room-chat-preview">${sectionHead('Room notes', 'Little messages while we listen', '', '')}<div class="room-chat-list">${(room.chat || []).slice(-5).map(renderChatMessage).join('')}</div><form class="chat-input-row room-inline-chat" data-form="chat" data-id="${escapeHTML(room.id)}"><input class="chat-input" name="text" placeholder="Message the room…" maxlength="500" autocomplete="off" data-focus-key="chat-input"/><button class="send-button" type="submit" title="Send">${icon('send', 14)}</button></form></section></div>
      <div class="reaction-row"><span class="mono small-label">SEND A ROOM REACTION</span>${['✨','🧡','🔥','🪩','🫶'].map((emoji) => `<button class="emoji-button" data-action="react" data-id="${emoji}" data-room="${escapeHTML(room.id)}">${emoji}</button>`).join('')}</div>`;
  }

  function renderPlaylistsPage() {
    return `<section class="page-hero tapes-hero"><div><div class="hero-eyebrow">COLLABORATIVE PLAYLISTS</div><h1 class="display-font">A tape made by <em>all of us.</em></h1><p>Shared collections with liner notes, contributors, and a little bit of history behind every pick.</p></div><button class="button button-primary" data-action="create-playlist">${icon('plus', 15)} Start a crew tape</button></section>
      <div class="tape-rules"><span class="tape-rules-mark">✳</span><span>Anyone in the crew can add a track, leave a note, and shape the listening order.</span><span class="mono">COLLAB ON</span></div>
      ${(state.data.playlists || []).length ? `<div class="tape-grid">${state.data.playlists.map(renderTapeCard).join('')}</div>` : `<div class="empty-state"><span class="empty-state-icon">${icon('playlist', 19)}</span><h3>No crew tapes yet.</h3><p>Start with an empty shared tape. Friends can add songs and notes when they join.</p><button class="button button-primary button-small" data-action="create-playlist">${icon('plus', 13)} Make a tape</button></div>`}`;
  }

  function renderPlaylistPage() {
    const playlist = getPlaylist();
    if (!playlist) return renderPlaylistsPage();
    const coverTrack = playlist.tracks?.[0];
    return `<section class="tape-detail-hero"><div class="tape-detail-cover"><img src="${safeCover(coverTrack?.cover)}" alt=""/><div class="cover-collage">${(playlist.tracks || []).slice(0, 4).map((track) => `<img src="${safeCover(track.cover)}" alt="" />`).join('')}</div></div><div class="tape-detail-info"><div class="hero-eyebrow">${icon('playlist', 13)} COLLABORATIVE TAPE <span class="collab-pill">OPEN COLLAB</span></div><h1 class="display-font">${escapeHTML(playlist.title)}</h1><p class="tape-detail-subtitle">${escapeHTML(playlist.subtitle || '')}</p><p class="tape-detail-description">${escapeHTML(playlist.description || '')}</p><div class="tape-contributors">${(playlist.contributors || []).slice(0, 6).map((person) => avatarHTML(person, 'stack')).join('')}<span>${(playlist.contributors || []).length} contributors · ${(playlist.tracks || []).length} tracks</span></div><div class="hero-actions"><button class="button button-primary" data-action="play-list" data-id="${escapeHTML(playlist.id)}">${icon('play', 14)} Play the tape</button><button class="button button-secondary" data-action="add-to-playlist" data-id="${escapeHTML(playlist.id)}">${icon('plus', 14)} Add a song</button><button class="button button-ghost" data-action="share-playlist" data-id="${escapeHTML(playlist.id)}">${icon('share', 14)} Share</button></div></div></section>
      <div class="tape-track-header">${sectionHead('The tracklist', 'Every pick has a person behind it', '', '')}<span class="mono small-label">${String(playlist.tracks.length).padStart(2, '0')} CUTS</span></div>
      ${playlist.tracks?.length ? renderTrackTable(playlist.tracks, { showNotes: true }) : emptyState('This tape is still blank.', 'Add the first track from Discover.')}
      <section class="liner-notes-section"><div class="liner-notes-heading"><div><span class="mono small-label">LINER NOTES</span><h2>Words between the songs.</h2></div><span class="mono small-label">${(playlist.comments || []).length} NOTES</span></div><div class="comments-list">${(playlist.comments || []).map(renderComment).join('') || '<p class="muted-copy">No notes yet. Start the conversation.</p>'}</div><form class="comment-form" data-form="comment" data-id="${escapeHTML(playlist.id)}"><input class="form-input" name="text" maxlength="360" placeholder="Leave a note for the crew…" data-focus-key="comment-input" required /><button class="button button-primary button-small" type="submit">Post note ${icon('send', 13)}</button></form></section>`;
  }

  function renderActivityPage() {
    return `<section class="page-hero activity-hero"><div><div class="hero-eyebrow">THE CREW FEED</div><h1 class="display-font">A good song is a <em>good message.</em></h1><p>See what your people are playing, share a dedication, and make a little noise for their picks.</p></div><button class="button button-secondary" data-action="share-current">${icon('share', 14)} Share what I’m playing</button></section>
      <div class="activity-layout"><section class="feed-column">${sectionHead('Latest from your crew', 'Songs, rooms, and little notes', '', '')}${(state.data.activityFeed || []).map(renderActivityCard).join('') || emptyState('The feed is quiet.', 'Share a track or join a room to get things moving.')}</section><aside class="activity-side"><div class="side-card crew-online-card"><div class="side-card-head"><span class="mono small-label">YOUR CREW</span><span class="online-count">${(state.data.friends || []).filter((f) => f.status === 'online').length} online</span></div>${(state.data.friends || []).length ? (state.data.friends || []).map((friend) => `<button class="crew-person" data-action="join-room" data-id="${escapeHTML(friend.roomId || '')}"><span class="avatar avatar-small" style="--avatar-color:${escapeHTML(friend.color || '#777')}">${escapeHTML(friend.avatar || initials(friend.name))}<i class="presence-dot ${friend.status === 'online' ? 'is-online' : ''}"></i></span><span><b>${escapeHTML(friend.name)}</b><small>${escapeHTML(friend.note || friend.roomName || 'Listening now')}</small></span>${friend.roomId ? icon('chevron', 13) : ''}</button>`).join('') : '<p class="crew-empty-copy">No friends have joined yet. Start a room and send them an invite link.</p>'}</div><div class="side-card no-algo-card"><span class="mono small-label">A SMALL PROMISE</span><h3>No feed-ranking tricks.</h3><p>Posts stay in the order they arrive. The people who make the music should get the attention.</p></div></aside></div>`;
  }

  function renderLibraryPage() {
    const saved = getSavedTracks();
    const recent = state.recent || [];
    return `<section class="page-hero library-hero"><div><div class="hero-eyebrow">YOUR COLLECTION</div><h1 class="display-font">Keep the things <em>that stay.</em></h1><p>A personal shelf for saved picks, recent spins, and collaborative tapes you care about.</p></div><div class="library-stat mono"><b>${String(saved.length).padStart(2, '0')}</b><span>SAVED PICKS</span></div></section>
      <section class="library-block">${sectionHead('Saved music', `${saved.length} tracks`, '', '')}${saved.length ? renderTrackTable(saved) : emptyState('Your shelf is waiting.', 'Tap the heart beside a track to keep it here.')}</section>
      <section class="library-block">${sectionHead('Recently played', `${recent.length} recent`, '', '')}${recent.length ? renderTrackTable(recent.slice(0, 8), { compact: true }) : emptyState('Nothing played yet.', 'Choose an open full-length track or play something from your own uploads.')}</section>
      <section class="library-block">${sectionHead('Crew tapes', `${(state.data.playlists || []).length} shared`, 'playlists', 'Open tapes')}${renderTapeList((state.data.playlists || []).slice(0, 3))}</section>`;
  }

  function renderVaultPage() {
    const uploads = (state.data.tracks || []).filter((track) => track.source === 'admin-catalog');
    return `<section class="page-hero vault-hero"><div><div class="hero-eyebrow">KODA SHARED RELEASES</div><h1 class="display-font">A catalog built <em>with care.</em></h1><p>Tracks published by the KODA administrator are shared with every listener, with their rights and release materials attached.</p></div></section>
      <div class="rights-banner"><span class="rights-icon">${icon('check', 15)}</span><span><b>Rights stay visible.</b> Each shared release carries the rights status selected by its publisher. Creative Commons and public-domain labels are not independently verified; check any linked source before reuse.</span></div>
      ${sectionHead('Shared uploads', `${uploads.length} ${uploads.length === 1 ? 'release' : 'releases'}`, '', '')}
      ${uploads.length ? renderTrackTable(uploads) : `<div class="upload-dropzone"><div class="upload-drop-icon">${icon('upload', 22)}</div><h3>The shared catalog is ready to grow.</h3><p>Tracks published by the KODA administrator will appear here for every listener.</p><span class="mono">ADMIN PUBLISHING ONLY</span></div>`}`;
  }

  function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderAdminCatalogItem(track) {
    const files = [
      track.lyricsUrl ? `<a href="${escapeHTML(safeLocalAsset(track.lyricsUrl))}" target="_blank" rel="noopener noreferrer">Lyrics</a>` : '',
      ...(track.attachments || []).map((asset) => {
        const href = safeLocalAsset(asset.downloadUrl);
        return href ? `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(asset.name)} · ${formatFileSize(asset.size)}</a>` : '';
      })
    ].filter(Boolean).join('');
    const licenseHref = safeExternal(track.licenseUrl);
    const sourceHref = safeExternal(track.sourceUrl || track.linkUrl);
    return `<article class="admin-catalog-item"><img class="admin-item-art" src="${safeCover(track.cover)}" alt=""/><div class="admin-item-main"><div class="admin-item-head"><div><h3>${escapeHTML(track.title)}</h3><p>${escapeHTML(track.artist)} · ${escapeHTML(track.album || 'Single')}</p></div><span class="admin-item-size mono">${formatFileSize(track.fileSize)}</span></div><div class="admin-item-meta"><span class="admin-badge">${escapeHTML(track.licenseName || 'Rights not specified')}</span><span>${escapeHTML(track.tag || 'other')}</span>${track.year ? `<span>${escapeHTML(track.year)}</span>` : ''}</div>${track.rightsStatement ? `<p class="admin-rights-copy">${escapeHTML(track.rightsStatement)}</p>` : ''}<div class="admin-item-links">${licenseHref ? `<a href="${escapeHTML(licenseHref)}" target="_blank" rel="noopener noreferrer">License</a>` : ''}${sourceHref ? `<a href="${escapeHTML(sourceHref)}" target="_blank" rel="noopener noreferrer">Source</a>` : ''}${files}</div></div><div class="admin-item-actions"><button class="button button-small button-secondary" data-action="admin-edit-track" data-id="${escapeHTML(track.id)}">Edit</button><button class="button button-small button-secondary" data-action="play-track" data-id="${escapeHTML(track.id)}">${icon('play', 13)} Listen</button><button class="icon-button admin-delete-button" data-action="admin-delete-track" data-id="${escapeHTML(track.id)}" title="Remove from shared catalog">${icon('trash', 15)}</button></div></article>`;
  }

  function renderAdminPage() {
    if (!state.admin.authenticated) {
      setTimeout(() => {
        if (state.page === 'admin') {
          state.page = 'home';
          render();
        }
      }, 0);
      return `<section class="page-hero compact-hero"><div><div class="hero-eyebrow">STUDIO</div><h1 class="display-font">Page not <em>found.</em></h1><p>Returning to studio home…</p></div></section>`;
    }
    const items = state.admin.items || [];
    const genreOptions = ['ambient','acoustic','electronic','experimental','indie','jazz','rock','folk','world','piano','soul','house','disco','dub','other'];
    return `<section class="page-hero admin-hero"><div><div class="hero-eyebrow">PRIVATE PUBLISHING DESK</div><h1 class="display-font">Publish the <em>whole story.</em></h1><p>One shared release can include full-length audio, cover art, lyrics, credits, license details, and downloadable extras.</p></div><div class="admin-hero-actions"><span class="admin-secure-pill">${icon('check', 13)} ADMIN SESSION</span><button class="button button-secondary button-small" data-action="admin-logout">Sign out</button></div></section>
      ${state.admin.error ? `<div class="inline-error admin-error">${icon('note', 15)} ${escapeHTML(state.admin.error)}</div>` : ''}
      <section class="admin-upload-panel"><div class="admin-panel-heading"><div><span class="mono small-label">NEW SHARED RELEASE</span><h2>Add a track and its files</h2></div><span class="mono admin-size-note">AUDIO UP TO 200 MB</span></div><form class="admin-upload-form" data-form="admin-upload" enctype="multipart/form-data">
        <div class="admin-form-grid"><label class="form-field"><span>Track title *</span><input class="form-input" name="title" maxlength="100" placeholder="Track title" required /></label><label class="form-field"><span>Artist / attribution *</span><input class="form-input" name="artist" maxlength="100" placeholder="Creator or credited artist" required /></label><label class="form-field"><span>Release / album</span><input class="form-input" name="album" maxlength="100" placeholder="Release name" /></label><label class="form-field"><span>Year</span><input class="form-input" name="year" type="number" min="1900" max="${new Date().getFullYear() + 1}" placeholder="YYYY" /></label><label class="form-field"><span>Genre</span><select class="form-input" name="genre"><option value="other">Other / mixed</option>${genreOptions.map((genre) => `<option value="${genre}">${genre.charAt(0).toUpperCase() + genre.slice(1)}</option>`).join('')}</select></label><label class="form-field"><span>Rights / license *</span><select class="form-input" name="license" required><option value="authorized">Authorized streaming only · no public reuse license</option><option value="cc-by-4.0">CC BY 4.0</option><option value="cc-by-sa-4.0">CC BY-SA 4.0</option><option value="cc-by-3.0">CC BY 3.0</option><option value="cc-by-sa-3.0">CC BY-SA 3.0</option><option value="cc0">CC0 1.0</option><option value="pdm">Public Domain Mark 1.0</option></select></label></div>
        <label class="file-pick admin-file-pick"><input type="file" name="audio" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.aiff,.aif" required /><span class="file-pick-icon">${icon('music', 17)}</span><span class="file-pick-copy"><b>Full-length audio *</b><small>MP3, M4A, AAC, WAV, OGG, Opus, FLAC, AIFF · max 200 MB</small></span></label>
        <div class="admin-form-grid admin-file-grid"><label class="file-pick"><input type="file" name="artwork" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" /><span class="file-pick-icon">${icon('spark', 16)}</span><span class="file-pick-copy"><b>Cover artwork</b><small>JPG, PNG, WebP, GIF · max 15 MB</small></span></label><label class="file-pick"><input type="file" name="lyricsFile" accept=".txt,.md,.lrc,text/plain" /><span class="file-pick-icon">${icon('note', 16)}</span><span class="file-pick-copy"><b>Lyrics file</b><small>TXT, Markdown, or LRC · max 5 MB</small></span></label></div>
        <label class="form-field"><span>Lyrics / liner notes (optional)</span><textarea class="form-input form-textarea admin-lyrics-input" name="lyricsText" maxlength="60000" placeholder="Paste lyrics or notes here…"></textarea></label>
        <label class="file-pick admin-file-pick"><input type="file" name="attachments" multiple accept=".pdf,.txt,.md,.lrc,.csv,.json,.docx,.xlsx,.pptx,.mp4,.webm,.zip" /><span class="file-pick-icon">${icon('upload', 16)}</span><span class="file-pick-copy"><b>Extra files</b><small>PDF, text, lyrics, CSV, JSON, Office docs, video, ZIP · up to 7 files, 40 MB each</small></span></label>
        <div class="admin-form-grid"><label class="form-field"><span>Original source URL (HTTPS)</span><input class="form-input" name="sourceUrl" type="url" placeholder="https://…" /></label><label class="form-field"><span>Attribution / rights note</span><input class="form-input" name="rightsStatement" maxlength="1000" placeholder="Creator credit, permission details, or required attribution" /></label></div>
        <label class="rights-check admin-rights-check"><input type="checkbox" name="rightsConfirmed" value="true" required /><span>I have permission to publish every file in this release and the selected license / rights statement is accurate. Public-domain and Creative Commons selections will be displayed as provided by me.</span></label>
        <div class="admin-submit-row"><span class="mono">PUBLIC IN THE CATALOG AFTER PUBLISHING</span><button class="button button-primary" type="submit">Publish shared release ${icon('arrow', 14)}</button></div>
      </form></section>
      <section class="admin-catalog-section"><div class="admin-panel-heading"><div><span class="mono small-label">LIVE SHARED CATALOG</span><h2>${items.length} admin release${items.length === 1 ? '' : 's'}</h2></div><span class="mono admin-size-note">VISIBLE TO EVERY LISTENER</span></div>${items.length ? `<div class="admin-catalog-list">${items.map(renderAdminCatalogItem).join('')}</div>` : `<div class="admin-empty"><span class="empty-state-icon">${icon('upload', 18)}</span><h3>Your shared catalog is ready.</h3><p>Publish an audio track above. Cover art, lyrics, and attachments can be added to the same release.</p></div>`}</section>`;
  }

  function renderStagePage() {
    const track = state.currentTrack;
    if (!track) return emptyState('Nothing on the deck.', 'Choose a full-length open track or add audio you have permission to share.');
    const isPreview = Boolean(track.isPreview);
    const isArchive = track.source === 'internet-archive';
    const isAdminCatalog = track.source === 'admin-catalog';
    const sourceTitle = isArchive ? 'Internet Archive · Netlabels' : isAdminCatalog ? 'KODA shared catalog' : 'Your uploaded file';
    const sourceNote = isArchive ? `${track.licenseName || 'Open license'} · source record by ${track.artist}` : isAdminCatalog ? `${track.licenseName || 'Rights not specified'} · shared release` : 'Full-length audio from your vault';
    const formatLabel = isArchive ? 'Open-license full track' : isAdminCatalog ? 'Shared full-length track' : isPreview ? 'Short preview' : 'Full-length audio';
    const signalNote = isArchive
      ? `Full-length audio from an Archive item with a declared ${track.licenseName || 'open'} license. Artist and source are credited below; check the source page for the original rights record.`
      : isAdminCatalog
        ? `Shared by the KODA catalog administrator. Rights: ${track.licenseName || 'not specified'}. ${track.rightsStatement || 'Check the linked source and license details before reuse.'}`
        : isPreview
          ? 'This item is a short sample. Open the official source to continue the full release.'
          : 'A full-length file from your personal crew vault. Share only music you own or have permission to upload and play.';
    const trackKind = isArchive ? `OPEN LICENSE · ${track.licenseName || 'CC'}` : isAdminCatalog ? `SHARED CATALOG · ${track.licenseName || 'RIGHTS'}` : isPreview ? 'CATALOG PREVIEW' : 'FULL TRACK · YOUR VAULT';
    const maxDuration = isPreview ? 30 : (track.duration || 210);
    const mediaLinks = [
      track.lyricsUrl ? `<a href="${escapeHTML(safeLocalAsset(track.lyricsUrl))}" target="_blank" rel="noopener noreferrer">Lyrics</a>` : '',
      ...(track.attachments || []).map((asset) => { const href = safeLocalAsset(asset.downloadUrl); return href ? `<a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(asset.name)}</a>` : ''; })
    ].filter(Boolean).join('');
    return `<section class="stage-head"><div class="hero-eyebrow">${icon('headphones', 13)} THE LISTENING DECK</div><div class="stage-head-meta mono">${state.isPlaying ? '<span class="hero-live-dot"></span> ON THE DECK' : 'READY WHEN YOU ARE'} ${state.activeRoomId ? '· ROOM SYNC ON' : '· SOLO LISTENING'}</div></section>
      <div class="stage-layout"><div class="stage-left"><div class="stage-art-wrap"><img class="stage-art" src="${safeCover(track.cover)}" alt="Cover art for ${escapeHTML(track.title)}" /><div class="stage-art-vinyl ${state.isPlaying ? 'spinning' : ''}"><div class="vinyl-center"></div></div><div class="stage-meter">${Array.from({ length: 34 }, (_, i) => `<i style="--bar:${12 + Math.sin(i * 1.7) * 7 + (i % 5) * 3}px;--delay:${i * 28}ms"></i>`).join('')}</div></div><div class="stage-track-info"><div class="hero-eyebrow">${escapeHTML(trackKind)}</div><h1 class="display-font">${escapeHTML(track.title)}</h1><p>${escapeHTML(track.artist)}</p><span class="stage-album">${escapeHTML(track.album || 'Single')}</span></div><div class="stage-controls"><button class="icon-button" data-action="previous-track" title="Previous">${icon('prev', 18)}</button><button class="play-master-btn stage-play" data-action="player-toggle" title="${state.isPlaying ? 'Pause' : 'Play'}">${icon(state.isPlaying ? 'pause' : 'play', 18)}</button><button class="icon-button" data-action="next-track" title="Next">${icon('next', 18)}</button><button class="icon-button ${isSaved(track.id) ? 'is-saved' : ''}" data-action="save-track" data-id="${escapeHTML(track.id)}" title="Save track">${icon('heart', 17)}</button></div><div class="stage-scrub"><span class="mono" id="stage-time-current">${formatTime(audio.currentTime || state.position)}</span><input type="range" min="0" max="${maxDuration}" step="0.1" value="${Math.min(audio.currentTime || state.position, maxDuration)}" class="scrub-slider" id="stage-scrub" data-role="seek" /><span class="mono">${isPreview ? '0:30' : formatTime(track.duration || 210)}</span></div><div class="stage-source-card"><span class="source-logo">${isArchive ? 'IA' : isAdminCatalog ? 'K+' : 'K'}</span><span><b>${escapeHTML(sourceTitle)}</b><small>${escapeHTML(sourceNote)}</small></span>${safeExternal(track.licenseUrl) ? `<a class="license-link" href="${escapeHTML(safeExternal(track.licenseUrl))}" target="_blank" rel="noopener noreferrer">License</a>` : ''}${safeExternal(track.sourceUrl || track.linkUrl) ? `<a class="icon-button" href="${escapeHTML(safeExternal(track.sourceUrl || track.linkUrl))}" target="_blank" rel="noopener noreferrer" title="Open source record">${icon('external', 15)}</a>` : ''}</div>${mediaLinks ? `<div class="stage-asset-links">${mediaLinks}</div>` : ''}</div>
      <div class="stage-right"><div class="stage-note-top"><span class="mono small-label">SIGNAL NOTES</span><span class="stage-note-led"></span></div><div class="stage-visualizer ${state.isPlaying ? 'is-playing' : ''}">${Array.from({ length: 52 }, (_, i) => `<i style="--h:${18 + Math.abs(Math.sin(i * .63)) * 90 + (i % 7) * 2}px;--d:${(i % 13) * 40}ms"></i>`).join('')}</div><div class="stage-metadata-grid"><div><span>ARTIST</span><b>${escapeHTML(track.artist)}</b></div><div><span>RELEASE</span><b>${escapeHTML(track.album || 'Single')}</b></div><div><span>YEAR</span><b>${escapeHTML(track.year || '—')}</b></div><div><span>FORMAT</span><b>${escapeHTML(formatLabel)}</b></div></div><div class="stage-description"><span class="mono small-label">ABOUT THIS LISTEN</span><p>${escapeHTML(signalNote)}</p></div><div class="stage-quote">“Listen closer. Share the feeling.”<span class="mono">— KODA ROOM NOTE 001</span></div></div></div>`;
  }

  function renderAlbumPage() {
    const album = state.currentAlbum;
    if (!album) return renderDiscover();
    return `<section class="album-detail-head"><button class="button button-ghost button-small" data-action="navigate" data-page="discover">${icon('prev', 13)} Back to catalog</button><div class="album-detail-layout"><img class="album-detail-art" src="${safeCover(album.cover)}" alt=""/><div><div class="hero-eyebrow">OPEN RELEASE · FULL TRACKS</div><h1 class="display-font">${escapeHTML(album.title)}</h1><p>${escapeHTML(album.artist)} ${album.year ? `· ${escapeHTML(album.year)}` : ''}</p><div class="hero-actions"><button class="button button-primary" data-action="play-list-album">${icon('play', 14)} Play full tracks</button>${safeExternal(album.linkUrl) ? `<a class="button button-secondary" href="${escapeHTML(safeExternal(album.linkUrl))}" target="_blank" rel="noopener">Open release ${icon('external', 13)}</a>` : ''}</div></div></div></section>${state.searchLoading ? '<div class="loading-panel"><i class="spinner"></i> Loading album…</div>' : renderTrackTable(album.tracks || [])}`;
  }

  function renderRoomCards(rooms) {
    if (!rooms.length) return `<div class="empty-state"><span class="empty-state-icon">${icon('radio', 19)}</span><h3>No listening rooms yet.</h3><p>Start the first room, then invite real friends to join the shared queue.</p><button class="button button-primary button-small" data-action="create-room">${icon('plus', 13)} Start a room</button></div>`;
    return `<div class="rooms-grid">${rooms.map((room, index) => {
      const track = room.currentTrack;
      const peopleHTML = (room.listeners || []).slice(0, 4).map((person) => avatarHTML(person, 'stack')).join('');
      const isActive = state.activeRoomId === room.id;
      return `<article class="room-card ${isActive ? 'active-room' : ''}" style="--room-accent:${['#ff7043','#d496ff','#7dcbb6'][index % 3]}" data-action="open-room" data-id="${escapeHTML(room.id)}"><div class="room-card-top"><div class="room-card-label"><span class="room-live-badge"><i class="live-dot"></i>${room.isPlaying ? 'OPEN' : 'READY'}</span><span class="mono">${escapeHTML(room.code || 'KODA')}</span></div><button class="icon-button room-more" data-action="copy-room" data-id="${escapeHTML(room.code || '')}" title="Copy invite code">${icon('link', 14)}</button></div><h3 class="room-card-title">${escapeHTML(room.name)}</h3><p class="room-card-subtitle">${escapeHTML(room.subtitle || room.vibe || '')}</p><div class="room-card-now">${track ? `<img src="${safeCover(track.cover)}" alt=""/><span><small>${room.isPlaying ? 'NOW PLAYING' : 'ROOM PICK'}</small><b>${escapeHTML(track.title)}</b><em>${escapeHTML(track.artist)}</em></span><span class="room-sound-bars ${room.isPlaying ? 'active' : ''}"><i></i><i></i><i></i></span>` : `<span class="empty-cover"></span><span class="muted-copy">Room is ready for a first track</span>`}</div><div class="room-card-foot"><span class="avatar-stack">${peopleHTML}<span class="listener-count">${(room.listeners || []).length} here</span></span><button class="button button-small ${isActive ? 'button-joined' : 'button-dark'}" data-action="join-room" data-id="${escapeHTML(room.id)}">${isActive ? 'Joined' : 'Join room'} ${icon('arrow', 13)}</button></div></article>`;
    }).join('')}</div>`;
  }

  function renderTrackTable(tracks, options = {}) {
    if (!tracks || !tracks.length) return emptyState('No tracks to show.', 'Search the catalog or add a file from your vault.');
    const compact = Boolean(options.compact);
    const showNotes = Boolean(options.showNotes);
    const playlistTarget = state.pendingPlaylistId;
    return `<div class="track-table-wrap ${compact ? 'compact-table-wrap' : ''} ${showNotes ? 'with-notes' : ''}"><div class="track-table track-table-head ${compact ? 'compact-table' : ''}"><span>#</span><span></span><span>Track</span><span class="track-album-col">Album</span>${showNotes ? '<span class="track-note-col">Liner note</span>' : ''}<span class="track-time-col">Length</span><span class="track-action-col"></span></div>${tracks.map((track, index) => {
      const mine = isSaved(track.id);
      const isCurrent = state.currentTrack?.id === track.id;
      const note = track.note ? `<span class="track-note-col track-liner-note"><span>${escapeHTML(track.note)}</span><small>— ${escapeHTML(track.addedBy?.name || 'The crew')}</small></span>` : (showNotes ? '<span class="track-note-col muted-copy">—</span>' : '');
      const hasCatalogCredits = track.source === 'internet-archive' || track.source === 'admin-catalog';
      const sourceHref = safeExternal(track.sourceUrl || track.linkUrl);
      const licenseHref = safeExternal(track.licenseUrl);
      const credits = hasCatalogCredits ? `<span class="track-credit-links">${sourceHref ? `<a data-action="external-link" href="${escapeHTML(sourceHref)}" target="_blank" rel="noopener noreferrer">SOURCE</a>` : 'KODA CATALOG'}${track.licenseName ? ` · ${licenseHref ? `<a data-action="external-link" href="${escapeHTML(licenseHref)}" target="_blank" rel="noopener noreferrer">${escapeHTML(track.licenseName)}</a>` : escapeHTML(track.licenseName)}` : ''}</span>` : '';
      const actions = playlistTarget ? `<button class="track-icon-action add-track-action" data-action="add-to-playlist" data-id="${escapeHTML(track.id)}" title="Add to tape">${icon('plus', 14)}</button>` : `<button class="track-icon-action" data-action="enqueue-track" data-id="${escapeHTML(track.id)}" title="Add to queue">${icon('plus', 14)}</button><button class="track-icon-action ${mine ? 'is-saved' : ''}" data-action="save-track" data-id="${escapeHTML(track.id)}" title="${mine ? 'Remove from saved' : 'Save track'}">${icon('heart', 14)}</button><button class="track-icon-action" data-action="share-track" data-id="${escapeHTML(track.id)}" title="Share this pick">${icon('share', 14)}</button>`;
      return `<div class="track-row ${isCurrent ? 'playing' : ''} ${compact ? 'compact-row' : ''}" data-action="play-track" data-id="${escapeHTML(track.id)}" role="button" tabindex="0"><span class="track-index mono">${isCurrent && state.isPlaying ? '<span class="playing-eq"><i></i><i></i><i></i></span>' : String(index + 1).padStart(2, '0')}</span><span class="track-cover-wrap"><img class="track-cover" src="${safeCover(track.cover)}" alt="" loading="lazy"/>${isCurrent ? `<span class="track-hover-play">${icon(state.isPlaying ? 'pause' : 'play', 13)}</span>` : ''}</span><span class="track-main"><b class="track-title">${escapeHTML(track.title)}</b><span class="track-artist">${escapeHTML(track.artist)}</span>${credits}</span><span class="track-album-col track-album">${escapeHTML(track.album || (track.source === 'upload' ? 'Your uploads' : 'Single'))}</span>${note}<span class="track-duration mono">${formatDuration(track)}${track.isPreview ? '<small>PREVIEW</small>' : track.source === 'internet-archive' ? '<small>OPEN</small>' : track.source === 'admin-catalog' ? '<small>SHARED</small>' : ''}</span><span class="track-actions">${actions}</span></div>`;
    }).join('')}</div>`;
  }

  function renderTapeCard(playlist, index = 0) {
    const first = playlist.tracks?.[0];
    const art = first?.cover || fallbackArt;
    return `<article class="tape-card" data-action="open-playlist" data-id="${escapeHTML(playlist.id)}"><div class="tape-art"><img src="${safeCover(art)}" alt="" loading="lazy"/><div class="tape-art-wash" style="--wash:${['#f28a60','#7ac4b2','#ab8ce5'][index % 3]}"></div><span class="tape-index mono">${String(index + 1).padStart(2, '0')}</span><span class="tape-art-mark">K</span></div><div class="tape-card-copy"><div class="tape-card-meta"><span class="mono">${(playlist.tracks || []).length} CUTS</span><span class="collab-pill">COLLAB</span></div><h3>${escapeHTML(playlist.title)}</h3><p>${escapeHTML(playlist.subtitle || '')}</p><div class="tape-card-foot"><span class="avatar-stack">${(playlist.contributors || []).slice(0, 4).map((person) => avatarHTML(person, 'stack')).join('')}<span class="listener-count">${(playlist.contributors || []).length} makers</span></span><span class="tape-arrow">${icon('arrow', 15)}</span></div></div></article>`;
  }

  function renderTapeList(playlists) {
    if (!playlists || !playlists.length) return `<div class="tape-empty-mini"><span class="mono small-label">NO TAPES YET</span><p>Make the first shared collection. It will belong to your crew, not a recommendation engine.</p><button class="button button-small button-secondary" data-action="create-playlist">${icon('plus', 13)} Start a crew tape</button></div>`;
    return `<div class="tape-list">${playlists.map((playlist, index) => {
      const track = playlist.tracks?.[0];
      return `<button class="tape-list-row" data-action="open-playlist" data-id="${escapeHTML(playlist.id)}"><span class="tape-list-number mono">${String(index + 1).padStart(2, '0')}</span><img src="${safeCover(track?.cover)}" alt=""/><span class="tape-list-copy"><b>${escapeHTML(playlist.title)}</b><small>${escapeHTML(playlist.subtitle || '')}</small></span><span class="tape-list-meta mono">${(playlist.tracks || []).length} TRACKS</span>${icon('chevron', 15)}</button>`;
    }).join('')}</div>`;
  }

  function renderAlbumCard(album) {
    return `<article class="album-card" data-action="open-album" data-id="${escapeHTML(album.id)}"><img src="${safeCover(album.cover)}" alt="" loading="lazy"/><div><b>${escapeHTML(album.title)}</b><span>${escapeHTML(album.artist)} ${album.year ? `· ${escapeHTML(album.year)}` : ''}</span></div><button class="icon-button" data-action="open-album" data-id="${escapeHTML(album.id)}">${icon('chevron', 14)}</button></article>`;
  }

  function renderActivityPreview() {
    const feed = (state.data.activityFeed || []).slice(0, 2);
    if (!feed.length) return '';
    return `<section class="activity-preview-block">${sectionHead('From the group chat', 'Music is a kind of message', 'activity', 'Open feed')}<div class="activity-preview-grid">${feed.map((item) => `<article class="activity-preview-card"><div class="activity-user-row">${avatarHTML(item.user, 'small')}<span><b>${escapeHTML(item.user?.name || 'A friend')}</b><small>${escapeHTML(item.time || 'Just now')}</small></span><span class="activity-action-text">${escapeHTML(item.action || 'shared a track')}</span></div><button class="activity-track-link" data-action="play-track" data-id="${escapeHTML(item.track?.id || '')}">${item.track ? `<img src="${safeCover(item.track.cover)}" alt=""/><span><b>${escapeHTML(item.track.title)}</b><small>${escapeHTML(item.track.artist)}</small></span>${icon('play', 14)}` : 'Open room'}</button><p>${escapeHTML(item.message || '')}</p></article>`).join('')}</div></section>`;
  }

  function sectionHead(title, subtitle, destination, linkText) {
    return `<div class="section-head"><div><h2 class="section-title">${escapeHTML(title)}</h2>${subtitle ? `<p class="section-meta">${escapeHTML(subtitle)}</p>` : ''}</div>${linkText ? `<button class="section-link" data-action="navigate" data-page="${escapeHTML(destination || 'discover')}">${escapeHTML(linkText)} ${icon('arrow', 13)}</button>` : ''}</div>`;
  }

  function renderRightbar() {
    const room = getRoom();
    const tabs = [['queue', 'Queue'], ['chat', 'Chat'], ['people', 'People']];
    const selected = room ? state.rightTab : 'queue';
    return `<aside class="studio-rightbar"><div class="rightbar-topline"><div><span class="mono small-label">ROOM CONSOLE</span><span class="rightbar-top-title">${room ? escapeHTML(room.name) : 'Your listening space'}</span></div><button class="icon-button rightbar-open" data-action="navigate" data-page="rooms" title="Open rooms">${icon('expand', 14)}</button></div>
      ${room ? `<div class="rightbar-room-status"><span class="room-status-art"><img src="${safeCover(room.currentTrack?.cover)}" alt=""/></span><span><b>${escapeHTML(room.currentTrack?.title || 'Room is open')}</b><small>${room.isPlaying ? 'Shared playback on' : 'Waiting for the next song'}</small></span><i class="room-status-wave ${room.isPlaying ? 'playing' : ''}"><b></b><b></b><b></b><b></b></i></div>` : `<div class="rightbar-invite"><div class="invite-orbit">${icon('headphones', 20)}</div><h3>Music is better<br/>when it’s <em>shared.</em></h3><p>Join a live room to hear the same song, queue picks, and talk in real time.</p><button class="button button-small button-secondary" data-action="navigate" data-page="rooms">Browse rooms ${icon('arrow', 13)}</button></div>`}
      <div class="rightbar-tabs">${tabs.map(([id, label]) => `<button class="rtab-btn ${selected === id ? 'active' : ''}" data-action="right-tab" data-id="${id}" ${!room ? 'disabled' : ''}>${label}${id === 'chat' && room ? `<span class="tab-count">${(room.chat || []).length}</span>` : ''}</button>`).join('')}</div>
      <div class="rightbar-body">${room ? renderRoomTab(room, selected) : renderRightbarRoomList()}</div>
      ${room ? `<div class="rightbar-reactions"><span class="mono small-label">SEND A LITTLE SIGNAL</span><div>${['✨','🧡','🔥','🪩','🫶'].map((emoji) => `<button class="reaction-mini" data-action="react" data-id="${emoji}" data-room="${escapeHTML(room.id)}">${emoji}</button>`).join('')}</div></div><div class="rightbar-bottom"><span class="mono">${escapeHTML(room.code || 'KODA')} · ROOM CODE</span><button data-action="copy-room" data-id="${escapeHTML(room.code || '')}">${icon('link', 13)} Copy invite</button></div>` : ''}
    </aside>`;
  }

  function renderRightbarRoomList() {
    const rooms = (state.data.rooms || []).slice(0, 3);
    return `<div class="rightbar-empty-state"><span class="mono small-label">OPEN STUDIOS</span>${rooms.map((room) => `<button class="rightbar-room-item" data-action="join-room" data-id="${escapeHTML(room.id)}"><img src="${safeCover(room.currentTrack?.cover)}" alt=""/><span><b>${escapeHTML(room.name)}</b><small>${escapeHTML(room.vibe || 'Open format')} · ${(room.listeners || []).length} here</small></span>${icon('chevron', 14)}</button>`).join('')}<button class="button button-small button-primary button-full" data-action="create-room">${icon('plus', 14)} Start a new room</button><div class="rightbar-room-note"><span class="mono small-label">THE POINT</span><p>Music is the excuse. The people are the reason.</p></div></div>`;
  }

  function renderRoomTab(room, tab) {
    if (tab === 'chat') {
      return `<div class="rightbar-chat"><div class="chat-headline"><span class="mono small-label">ROOM CHAT</span><span class="live-pill"><i class="live-dot"></i> LIVE</span></div><div class="chat-box" id="chat-box">${(room.chat || []).map(renderChatMessage).join('') || '<div class="muted-copy">Say the first thing.</div>'}</div><form class="chat-input-row" data-form="chat" data-id="${escapeHTML(room.id)}"><input class="chat-input" name="text" placeholder="Message the room…" maxlength="500" autocomplete="off" data-focus-key="chat-input"/><button class="send-button" type="submit" title="Send">${icon('send', 15)}</button></form><p class="chat-guideline">Keep it kind. Keep it about the music.</p></div>`;
    }
    if (tab === 'people') {
      return `<div class="rightbar-people"><div class="chat-headline"><span class="mono small-label">IN THE ROOM</span><span class="result-count">${(room.listeners || []).length}</span></div>${(room.listeners || []).map((person) => `<div class="listener-row"><span class="avatar avatar-small" style="--avatar-color:${escapeHTML(person.color || '#777')}">${escapeHTML(person.avatar || initials(person.name))}<i class="presence-dot is-online"></i></span><span><b>${escapeHTML(person.name)}</b><small>${person.role === 'HOST' ? 'Room host' : 'Listening now'}</small></span>${person.role === 'HOST' ? '<span class="host-tag">HOST</span>' : ''}</div>`).join('')}<div class="invite-people-card"><span class="mono small-label">BRING YOUR PEOPLE</span><p>Share the room code and meet here in a few taps.</p><button class="button button-small button-secondary button-full" data-action="copy-room" data-id="${escapeHTML(room.code || '')}">${icon('link', 13)} Copy ${escapeHTML(room.code || 'invite code')}</button></div></div>`;
    }
    return `<div class="rightbar-queue"><div class="queue-headline"><div><span class="mono small-label">UP NEXT</span><span class="queue-count">${String((room.queue || []).length).padStart(2, '0')}</span></div><button class="text-button" data-action="navigate" data-page="discover">Add music ${icon('plus', 13)}</button></div>${room.currentTrack ? `<div class="queue-current"><span class="queue-current-label mono">NOW PLAYING</span><div class="queue-current-track">${trackMini(room.currentTrack)}<span class="queue-current-bars ${room.isPlaying ? 'active' : ''}"><i></i><i></i><i></i></span></div></div>` : ''}${(room.queue || []).length ? room.queue.map((item, index) => `<div class="queue-card"><span class="queue-order mono">${String(index + 1).padStart(2, '0')}</span><img class="queue-cover" src="${safeCover(item.track?.cover)}" alt=""/><span class="queue-meta"><b>${escapeHTML(item.track?.title || 'Untitled')}</b><small>${escapeHTML(item.track?.artist || '')}</small><em>${escapeHTML(item.addedBy?.name || 'A friend')} · ${escapeHTML(item.note || 'Added to queue')}</em></span><button class="vote-btn ${item.voters?.includes(state.profile.handle) ? 'voted' : ''}" data-action="vote" data-room="${escapeHTML(room.id)}" data-id="${escapeHTML(item.qid)}" title="Vote for this song">↑<b>${item.votes || 0}</b></button></div>`).join('') : `<div class="queue-empty compact-empty"><span>${icon('playlist', 17)}</span><b>The queue is open.</b><small>Search a song and add it for everyone.</small><button class="button button-small button-ghost" data-action="navigate" data-page="discover">Browse music ${icon('arrow', 12)}</button></div>`}<div class="queue-footer-note"><span class="mono">${(room.queue || []).length} TRACKS IN THE ROOM QUEUE</span><span>Top-voted goes next</span></div></div>`;
  }

  function renderPlayer() {
    const track = state.currentTrack;
    const duration = track ? (track.isPreview ? 30 : Number(track.duration) || 210) : 30;
    const currentTime = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : state.position;
    return `<footer class="studio-player"><div class="player-now">${track ? `<button class="player-cover-button" data-action="navigate" data-page="stage"><img class="player-cover" src="${safeCover(track.cover)}" alt=""/></button><div class="player-meta"><button class="player-title" data-action="navigate" data-page="stage">${escapeHTML(track.title)}</button><span class="player-artist">${escapeHTML(track.artist)}</span></div><span class="player-source-tag ${track.isPreview ? 'preview-tag' : 'full-tag'}">${track.isPreview ? 'PREVIEW' : track.source === 'internet-archive' ? 'OPEN' : 'FULL'}</span><button class="icon-button player-heart ${isSaved(track.id) ? 'is-saved' : ''}" data-action="save-track" data-id="${escapeHTML(track.id)}" title="Save track">${icon('heart', 15)}</button>` : `<div class="player-placeholder">${icon('music', 20)}</div><div class="player-meta"><b class="player-title">Pick a track</b><span class="player-artist">Your studio is ready.</span></div>`}</div>
      <div class="player-center"><div class="transport-controls"><button class="icon-button transport-icon ${state.isShuffle ? 'selected' : ''}" data-action="shuffle" title="Shuffle">${icon('shuffle', 15)}</button><button class="icon-button transport-icon" data-action="previous-track" title="Previous">${icon('prev', 16)}</button><button class="play-master-btn" data-action="player-toggle" title="${state.isPlaying ? 'Pause' : 'Play'}">${icon(state.isPlaying ? 'pause' : 'play', 17)}</button><button class="icon-button transport-icon" data-action="next-track" title="Next">${icon('next', 16)}</button><button class="icon-button transport-icon ${state.repeat ? 'selected' : ''}" data-action="repeat" title="Repeat">${icon('repeat', 15)}</button></div><div class="scrub-row"><span class="player-time mono" id="player-time-current">${formatTime(currentTime)}</span><input class="scrub-slider" id="player-scrub" type="range" min="0" max="${duration}" step="0.1" value="${Math.min(currentTime, duration)}" data-role="seek" aria-label="Playback position"/><span class="player-time mono" id="player-time-total">${track?.isPreview ? '0:30' : formatTime(track?.duration || duration)}</span></div></div>
      <div class="player-right"><span class="player-room-indicator ${state.activeRoomId ? 'room-connected' : ''}"><i class="connection-dot ${state.socketConnected ? 'connected' : ''}" data-connection-dot></i>${state.activeRoomId ? `IN ${escapeHTML(getRoom()?.name || 'ROOM')}` : 'SOLO'}</span><button class="icon-button player-volume-button" data-action="toggle-mute" title="Volume">${icon(state.isMuted ? 'mute' : 'volume', 16)}</button><input type="range" min="0" max="1" step="0.01" value="${state.isMuted ? 0 : state.volume}" class="volume-slider" data-role="volume" aria-label="Volume"/><button class="icon-button" data-action="navigate" data-page="stage" title="Open listening deck">${icon('expand', 15)}</button>${safeExternal(track?.linkUrl) ? `<a class="button button-small provider-button" href="${escapeHTML(safeExternal(track.linkUrl))}" target="_blank" rel="noopener noreferrer" title="Continue listening at the official source">${icon('external', 13)} <span>Full song</span></a>` : ''}</div>
    </footer>`;
  }

  function renderChatMessage(message) {
    const system = message.type === 'system' || message.type === 'queue_event';
    return `<div class="chat-msg ${system ? 'chat-system' : ''}"><span class="chat-avatar" style="--avatar-color:${escapeHTML(message.user?.color || '#888')}">${escapeHTML(message.user?.avatar || initials(message.user?.name || 'K'))}</span><div class="chat-msg-copy"><div><b>${escapeHTML(message.user?.name || 'A friend')}</b><time>${escapeHTML(message.time || 'now')}</time></div><p>${escapeHTML(message.text || '')}</p></div></div>`;
  }

  function renderComment(comment) {
    return `<div class="comment-row">${avatarHTML(comment.user, 'small')}<div><div class="comment-meta"><b>${escapeHTML(comment.user?.name || 'A friend')}</b><time>${escapeHTML(comment.time || 'now')}</time></div><p>${escapeHTML(comment.text || '')}</p></div></div>`;
  }

  function renderActivityCard(item) {
    return `<article class="activity-card"><div class="activity-card-head">${avatarHTML(item.user, 'small')}<div><b>${escapeHTML(item.user?.name || 'A friend')}</b><span>${escapeHTML(item.action || 'shared a pick')} <time>${escapeHTML(item.time || 'now')}</time></span></div><button class="icon-button" data-action="activity-more" title="More">${icon('more', 16)}</button></div><div class="activity-note">${escapeHTML(item.message || '')}</div>${item.track ? `<div class="activity-feature-track"><button class="activity-play-hit" data-action="play-track" data-id="${escapeHTML(item.track.id)}"><img src="${safeCover(item.track.cover)}" alt=""/><span class="activity-track-copy"><b>${escapeHTML(item.track.title)}</b><small>${escapeHTML(item.track.artist)}</small><em>${item.track.isPreview ? 'SHORT SAMPLE' : item.track.source === 'internet-archive' ? 'OPEN LICENSE · FULL TRACK' : 'FULL TRACK'}</em></span><span class="activity-play-button">${icon('play', 15)}</span></button><div class="activity-track-actions"><button data-action="like" data-id="${escapeHTML(item.id)}">${icon('heart', 14)} ${item.likes || 0}</button><button data-action="share-track" data-id="${escapeHTML(item.track.id)}">${icon('share', 14)} Pass it on</button></div></div>` : ''}</article>`;
  }

  function trackMini(track) {
    if (!track) return '<span class="empty-cover"></span><span>—</span>';
    return `<span class="track-mini"><img src="${safeCover(track.cover)}" alt=""/><span><b>${escapeHTML(track.title)}</b><small>${escapeHTML(track.artist)}</small></span></span>`;
  }

  function avatarHTML(person, size = 'small') {
    if (!person) person = { name: 'KODA', avatar: 'K', color: '#ff5a1f' };
    const badge = person.avatar || initials(person.name || 'K');
    return `<span class="avatar avatar-${size}" style="--avatar-color:${escapeHTML(person.color || '#ff5a1f')}" title="${escapeHTML(person.name || '')}">${escapeHTML(badge)}</span>`;
  }

  function initials(name = '') {
    return String(name).split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'K';
  }

  function isSaved(id) { return (state.saved || []).some((track) => String(track.id) === String(id)); }

  function emptyState(title, copy) {
    return `<div class="empty-state"><span class="empty-state-icon">${icon('spark', 19)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(copy)}</p></div>`;
  }

  function showToast(message, isError = false) {
    clearTimeout(state.toastTimer);
    toastRoot.innerHTML = `<div class="studio-toast ${isError ? 'toast-error' : ''}"><span class="toast-mark">${isError ? '!' : '✓'}</span>${escapeHTML(message)}</div>`;
    state.toastTimer = setTimeout(() => { toastRoot.innerHTML = ''; }, 2700);
  }

  function showReaction(payload) {
    const layer = document.getElementById('reaction-layer');
    const emoji = payload?.emoji || '✨';
    const el = document.createElement('span');
    el.className = 'floating-emoji';
    el.textContent = emoji;
    el.style.left = `${Math.random() * 62}px`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 2400);
    showToast(`${payload?.user?.name || 'Someone'} sent ${emoji}`);
  }

  function showModal(title, body, footer = '') {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><span class="mono small-label">KODA STUDIO</span><h2 id="modal-title">${escapeHTML(title)}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close', 17)}</button></div>${body}${footer}</section></div>`;
    setTimeout(() => modalRoot.querySelector('input:not([type="checkbox"]), textarea, select')?.focus(), 30);
  }

  function closeModal() { modalRoot.innerHTML = ''; }

  function showCreateRoomModal() {
    showModal('Start a listening room', `<p class="modal-intro">Set the tone. Your friends can join, add songs, and vote on what comes next.</p><form data-form="create-room"><div class="form-field"><label>Room name</label><input class="form-input" name="name" maxlength="48" placeholder="e.g. Studio A, Friday night" required /></div><div class="form-field"><label>What are we listening to?</label><select class="form-input" name="vibe"><option>Open format</option><option>Indie · Alt · After dark</option><option>Desi · Punjabi · Hindi indie</option><option>Hip-hop · R&B · Bass</option><option>Pop · Global · New finds</option><option>Quiet listening · Ambient</option></select></div><div class="modal-footnote">${icon('people', 14)} Open to the crew · Shared queue and chat enabled</div><div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Create room ${icon('arrow', 14)}</button></div></form>`);
  }

  function showCreatePlaylistModal() {
    showModal('Make a crew tape', `<p class="modal-intro">A shared collection with a point of view. Everyone can add tracks and leave liner notes.</p><form data-form="create-playlist"><div class="form-field"><label>Tape title</label><input class="form-input" name="title" maxlength="64" placeholder="e.g. Sunday morning, no plans" required /></div><div class="form-field"><label>One-line description</label><input class="form-input" name="subtitle" maxlength="90" placeholder="The soundtrack to…" /></div><div class="form-field"><label>Notes for the crew</label><textarea class="form-input form-textarea" name="description" maxlength="240" placeholder="What is this tape for?"></textarea></div><div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Create the tape ${icon('arrow', 14)}</button></div></form>`);
  }

  function showUploadModal() {
    showModal('Add to your vault', `<p class="modal-intro">Upload a file you own or have permission to share. KODA stores it in this studio and lets your crew listen in full.</p><form data-form="upload" enctype="multipart/form-data"><div class="form-field"><label>Audio file</label><label class="file-pick"><input type="file" name="audio" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus,.aiff" required /><span class="file-pick-icon">${icon('upload', 17)}</span><span class="file-pick-copy"><b>Choose a file</b><small>MP3, M4A, WAV, FLAC, OGG, AAC · up to 50 MB</small></span></label></div><div class="form-grid"><div class="form-field"><label>Track title</label><input class="form-input" name="title" maxlength="100" placeholder="Optional" /></div><div class="form-field"><label>Artist</label><input class="form-input" name="artist" maxlength="100" placeholder="Optional" /></div></div><div class="form-field"><label>Collection / album</label><input class="form-input" name="album" maxlength="100" placeholder="Your uploads" /></div><label class="rights-check"><input type="checkbox" name="rightsConfirmed" required /><span>I own this audio or have permission to upload and share it with my crew.</span></label><div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Add to vault ${icon('arrow', 14)}</button></div></form>`);
  }

  function showProfileModal() {
    showModal('Your studio profile', `<p class="modal-intro">Make it easy for friends to know who is in the room.</p><form data-form="profile"><div class="form-field"><label>Your name</label><input class="form-input" name="name" maxlength="32" value="${escapeHTML(state.profile.name || 'You')}" required /></div><div class="form-field"><label>Handle</label><input class="form-input" name="handle" maxlength="24" value="${escapeHTML(state.profile.handle || '@you')}" required /></div><div class="form-field"><label>Avatar initials</label><input class="form-input" name="avatar" maxlength="2" value="${escapeHTML(state.profile.avatar || 'YO')}" /></div><div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save profile</button></div></form><div class="profile-modal-danger-zone"><button type="button" class="button-danger-ghost" data-action="logout">${icon('logout', 14)} Sign out / Exit to login page</button></div>`);
  }

  function showShareModal(track) {
    if (!track) return showToast('Choose a track to share first.', true);
    showModal('Pass this song along', `<div class="modal-track-preview">${trackMini(track)}<span class="source-tag">${track.isPreview ? 'PREVIEW' : track.source === 'internet-archive' ? 'OPEN LICENSE' : 'FULL TRACK'}</span></div><p class="modal-intro">Add a few words for the crew. The source and reuse license stay attached to this pick.</p><form data-form="share" data-id="${escapeHTML(track.id)}"><div class="form-field"><label>Your note</label><textarea class="form-input form-textarea" name="message" maxlength="220" placeholder="This made me think of you because…"></textarea></div><div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Share with crew ${icon('send', 14)}</button></div></form>`);
  }

  function showAddToPlaylistModal(trackId) {
    const track = getTrack(trackId);
    const playlist = getPlaylist(state.pendingPlaylistId);
    if (!track || !playlist) return;
    state.pendingTrackId = trackId;
    showModal('Add a track to the tape', `<div class="modal-track-preview">${trackMini(track)}<span class="source-tag">${track.isPreview ? 'PREVIEW' : track.source === 'internet-archive' ? 'OPEN LICENSE' : 'FULL TRACK'}</span></div><div class="modal-destination">${icon('playlist', 14)} <span>Going into <b>${escapeHTML(playlist.title)}</b></span></div><form data-form="add-playlist-track" data-playlist="${escapeHTML(playlist.id)}"><div class="form-field"><label>Liner note <span class="optional-label">OPTIONAL</span></label><input class="form-input" name="note" maxlength="140" placeholder="Why this one?" /></div><div class="modal-actions"><button type="button" class="button button-ghost" data-action="close-modal">Not now</button><button class="button button-primary" type="submit">Add to tape ${icon('plus', 14)}</button></div></form>`);
  }

  function showDmcaModal() {
    showModal('DMCA Copyright Takedown Notice', `
      <p class="modal-intro">If you believe your copyrighted work is being infringed on KODA, submit a formal notice under Title 17 U.S.C. § 512(c)(3).</p>
      <form data-form="dmca">
        <div class="form-grid">
          <div class="form-field">
            <label>Your legal name</label>
            <input class="form-input" name="claimantName" maxlength="120" placeholder="e.g. Jane Doe" required />
          </div>
          <div class="form-field">
            <label>Contact email</label>
            <input class="form-input" type="email" name="claimantEmail" maxlength="120" placeholder="e.g. legal@domain.com" required />
          </div>
        </div>
        <div class="form-field">
          <label>Description of copyrighted work</label>
          <textarea class="form-input form-textarea" name="copyrightWork" maxlength="500" placeholder="Title of song, artist, registration details…" required></textarea>
        </div>
        <div class="form-field">
          <label>URL or Track ID of infringing material</label>
          <input class="form-input" name="infringingUrl" maxlength="500" placeholder="https://... or track ID" required />
        </div>
        <div class="form-field">
          <label>Electronic signature (Type your full legal name)</label>
          <input class="form-input" name="signature" maxlength="120" placeholder="Full legal name" required />
        </div>
        <label class="rights-check">
          <input type="checkbox" name="goodFaithConfirmed" required />
          <span>I have a good-faith belief that use of the material is not authorized by the copyright owner, its agent, or the law.</span>
        </label>
        <div class="modal-actions">
          <button type="button" class="button button-ghost" data-action="close-modal">Cancel</button>
          <button class="button button-primary" type="submit">Submit DMCA Notice</button>
        </div>
      </form>
    `);
  }

  function showProModal() {
    showModal('Upgrade to KODA Pro Studio', `
      <p class="modal-intro">Elevate your listening studio with unlimited creator features and lossless streaming.</p>
      <form data-form="pro-checkout">
        <div class="pro-tiers-grid" style="display:flex;gap:12px;margin-bottom:18px;">
          <label style="flex:1;border:1px solid var(--border);border-radius:10px;padding:14px;background:var(--surface);cursor:pointer;">
            <input type="radio" name="tier" value="plus" />
            <div style="font-weight:700;margin-top:6px;">KODA Plus</div>
            <div style="font-size:18px;color:var(--accent);margin:4px 0;">$4.99<small style="font-size:11px;color:var(--muted)">/mo</small></div>
            <ul style="font-size:12px;padding-left:16px;margin:8px 0 0;color:var(--muted);">
              <li>50 cloud uploads</li>
              <li>Custom tapes</li>
              <li>Crew badge</li>
            </ul>
          </label>
          <label style="flex:1;border:2px solid var(--accent);border-radius:10px;padding:14px;background:rgba(255,104,59,0.06);cursor:pointer;">
            <input type="radio" name="tier" value="pro" checked />
            <div style="font-weight:700;margin-top:6px;">KODA Pro ⚡</div>
            <div style="font-size:18px;color:var(--accent);margin:4px 0;">$9.99<small style="font-size:11px;color:var(--muted)">/mo</small></div>
            <ul style="font-size:12px;padding-left:16px;margin:8px 0 0;color:var(--text);">
              <li><b>Unlimited</b> uploads</li>
              <li>Lossless audio streaming</li>
              <li>Verified PRO badge</li>
              <li>Vanity room URLs</li>
            </ul>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-ghost" data-action="close-modal">Maybe later</button>
          <button class="button button-primary" type="submit">Proceed with Stripe ${icon('arrow', 14)}</button>
        </div>
      </form>
    `);
  }

  function showTipModal(roomId) {
    const room = getRoom(roomId);
    showModal('Tip Room Host', `
      <p class="modal-intro">Support <b>${escapeHTML(room?.host?.name || 'the host')}</b> and fuel the room vibes.</p>
      <form data-form="tip" data-room-id="${escapeHTML(roomId || '')}">
        <div class="form-field">
          <label>Select tip amount</label>
          <div style="display:flex;gap:8px;margin-top:6px;">
            <label style="flex:1;text-align:center;padding:10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;"><input type="radio" name="amount" value="1" /> $1.00</label>
            <label style="flex:1;text-align:center;padding:10px;border:1px solid var(--accent);border-radius:8px;cursor:pointer;background:rgba(255,104,59,0.08);"><input type="radio" name="amount" value="5" checked /> $5.00</label>
            <label style="flex:1;text-align:center;padding:10px;border:1px solid var(--border);border-radius:8px;cursor:pointer;"><input type="radio" name="amount" value="10" /> $10.00</label>
          </div>
        </div>
        <div class="form-field" style="margin-top:14px;">
          <label>Message for the host <span class="optional-label">OPTIONAL</span></label>
          <input class="form-input" name="message" maxlength="120" placeholder="Loving the selection!" />
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-ghost" data-action="close-modal">Cancel</button>
          <button class="button button-primary" type="submit">Send tip 🪙</button>
        </div>
      </form>
    `);
  }

  async function runSearch(query) {
    const term = String(query || '').trim();
    state.searchQuery = term;
    if (!term) {
      state.searchResults = null; state.searchAlbums = []; state.searchError = ''; state.searchLoading = false;
      state.page = 'discover'; render(); return;
    }
    state.page = 'search'; state.searchLoading = true; state.searchError = ''; state.searchResults = null; state.searchAlbums = [];
    render();
    try {
      const data = await api(`/api/search?q=${encodeURIComponent(term)}`);
      if (state.searchQuery !== term) return;
      state.searchResults = data.songs || [];
      state.searchAlbums = data.albums || [];
      state.searchError = data.warning || '';
      state.searchLoading = false;
      state.selectedGenre = 'all';
      render();
    } catch (error) {
      if (state.searchQuery !== term) return;
      state.searchLoading = false;
      state.searchError = `${error.message} The starter catalog is still available below.`;
      state.searchResults = [];
      render();
    }
  }

  function applySearchInput(value) {
    state.searchQuery = value;
    const clearButton = document.querySelector('.search-clear');
    if (clearButton) clearButton.classList.toggle('visible', Boolean(value));
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => runSearch(value), value.trim() ? 420 : 500);
  }

  function filteredSeedTracks() {
    const genre = state.selectedGenre;
    return (state.data.tracks || []).filter((track) => genre === 'all' || track.tag === genre);
  }

  async function openAlbum(id) {
    state.page = 'album'; state.searchLoading = true; state.currentAlbum = { id, title: 'Loading album…', tracks: [] };
    render();
    try {
      state.currentAlbum = await api(`/api/album/${encodeURIComponent(id)}`);
      state.searchLoading = false; render();
    } catch (error) {
      state.searchLoading = false; showToast(error.message, true); render();
    }
  }

  function rememberTrack(track) {
    if (!track) return;
    state.recent = [track, ...(state.recent || []).filter((item) => item.id !== track.id)].slice(0, 20);
    localStorage.setItem(storageKeys.recent, JSON.stringify(state.recent));
  }

  async function playTrack(track, options = {}) {
    if (!track || !track.streamUrl) {
      showToast('This item has no playable audio file.', true);
      return;
    }
    const isSame = state.currentTrack?.id === track.id && audio.src;
    state.currentTrack = track;
    state.position = Number(options.position) || 0;
    state.duration = track.isPreview ? 30 : (Number(track.duration) || 210);
    rememberTrack(track);
    if (!isSame || audio.src !== new URL(track.streamUrl, location.href).href) {
      audio.src = track.streamUrl;
      audio.load();
    }
    if (options.position !== undefined) {
      try { audio.currentTime = Math.max(0, Number(options.position) || 0); } catch (_error) { /* wait for metadata */ }
    } else if (!isSame) {
      audio.currentTime = 0;
    }
    render();
    if (options.autoplay !== false) {
      try {
        await audio.play();
        state.isPlaying = true;
        render();
      } catch (_error) {
        state.isPlaying = false;
        render();
        showToast('Tap play to start the track.');
      }
    } else {
      state.isPlaying = false;
      render();
    }
    if (state.activeRoomId && options.syncRoom !== false) await syncRoom({ track, position: 0, isPlaying: options.autoplay !== false });
  }

  function playFromList(trackId, tracks) {
    const list = (tracks || []).filter((track) => track && track.streamUrl);
    const index = list.findIndex((track) => String(track.id) === String(trackId));
    const track = list[index] || getTrack(trackId);
    if (list.length) { state.playbackQueue = list; state.queueIndex = Math.max(0, index); }
    return playTrack(track, { autoplay: true });
  }

  async function togglePlayer() {
    if (!state.currentTrack) { showToast('Pick a track to start.'); return; }
    if (audio.paused) {
      try {
        if (!audio.src || audio.src !== new URL(state.currentTrack.streamUrl, location.href).href) audio.src = state.currentTrack.streamUrl;
        await audio.play(); state.isPlaying = true;
        if (state.activeRoomId) await syncRoom({ isPlaying: true, position: audio.currentTime });
        render();
      } catch (_error) { showToast('This track could not start. Try another track.', true); }
    } else {
      audio.pause(); state.isPlaying = false;
      if (state.activeRoomId) await syncRoom({ isPlaying: false, position: audio.currentTime });
      render();
    }
  }

  async function nextTrack() {
    const room = getRoom();
    if (state.activeRoomId && room?.queue?.length) {
      try {
        const data = await api(`/api/rooms/${encodeURIComponent(room.id)}/sync`, { method: 'POST', body: JSON.stringify({ action: 'next_in_queue', user: state.profile }) });
        state.data.rooms = data.rooms;
        const next = getRoom(room.id);
        if (next?.currentTrack) await playTrack(next.currentTrack, { autoplay: true, syncRoom: false });
        return;
      } catch (error) { showToast(error.message, true); }
    }
    if (state.localQueue.length) {
      const next = state.localQueue.shift(); render(); await playTrack(next, { autoplay: true }); return;
    }
    if (state.playbackQueue.length > 1) {
      let index = state.queueIndex;
      index = state.isShuffle ? Math.floor(Math.random() * state.playbackQueue.length) : (index + 1) % state.playbackQueue.length;
      state.queueIndex = index;
      await playTrack(state.playbackQueue[index], { autoplay: true });
      return;
    }
    if (state.repeat && state.currentTrack) { try { audio.currentTime = 0; } catch (_error) {} await playTrack(state.currentTrack, { autoplay: true, position: 0 }); return; }
    audio.pause(); state.isPlaying = false; state.position = 0; render();
    if (state.activeRoomId) await syncRoom({ isPlaying: false, position: 0 });
    if (state.currentTrack?.isPreview) showToast('This short sample has ended.');
  }

  async function previousTrack() {
    if (audio.currentTime > 4) { audio.currentTime = 0; state.position = 0; if (state.activeRoomId) await syncRoom({ position: 0 }); updatePlayerProgress(); return; }
    if (state.playbackQueue.length > 1) {
      state.queueIndex = (state.queueIndex - 1 + state.playbackQueue.length) % state.playbackQueue.length;
      await playTrack(state.playbackQueue[state.queueIndex], { autoplay: true });
    } else if (state.currentTrack) {
      await playTrack(state.currentTrack, { autoplay: true });
    }
  }

  async function syncRoom(payload) {
    const room = getRoom();
    if (!room || state.updatingFromRoom) return;
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(room.id)}/sync`, { method: 'POST', body: JSON.stringify({ ...payload, user: state.profile }) });
      state.data.rooms = data.rooms;
      render();
    } catch (error) { showToast(error.message, true); }
  }

  async function joinRoom(roomId) {
    if (!roomId) return;
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/join`, { method: 'POST', body: JSON.stringify({ user: state.profile }) });
      state.data.rooms = data.rooms || state.data.rooms;
      state.activeRoomId = roomId;
      state.selectedRoomId = roomId;
      state.page = 'room';
      state.rightTab = 'queue';
      const room = getRoom(roomId) || data.room;
      render();
      if (room?.currentTrack) await playTrack(room.currentTrack, { autoplay: Boolean(room.isPlaying), position: room.currentPosition || 0, syncRoom: false });
      showToast(`You’re in ${room?.name || 'the room'}.`);
    } catch (error) { showToast(error.message, true); }
  }

  async function createRoom(form) {
    const formData = new FormData(form);
    try {
      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ name: formData.get('name'), vibe: formData.get('vibe'), host: state.profile }) });
      state.data.rooms = data.rooms;
      closeModal();
      await joinRoom(data.room.id);
    } catch (error) { showToast(error.message, true); }
  }

  async function enqueueTrack(trackId) {
    const track = getTrack(trackId);
    if (!track) return;
    const room = getRoom();
    if (state.activeRoomId && room) {
      try {
        const data = await api(`/api/rooms/${encodeURIComponent(room.id)}/queue`, { method: 'POST', body: JSON.stringify({ track, user: state.profile }) });
        state.data.rooms = data.rooms; render(); showToast(`Added ${track.title} to the room queue.`); return;
      } catch (error) { showToast(error.message, true); return; }
    }
    state.localQueue.push(track);
    render(); showToast(`Added ${track.title} to your queue.`);
  }

  async function voteOnQueue(roomId, qid) {
    const room = getRoom(roomId);
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/queue/${encodeURIComponent(qid)}/vote`, { method: 'POST', body: JSON.stringify({ user: state.profile }) });
      state.data.rooms = data.rooms; render();
    } catch (error) { showToast(error.message, true); }
  }

  async function addTrackToPlaylist(form) {
    const playlistId = form.dataset.playlist || state.pendingPlaylistId;
    const track = getTrack(state.pendingTrackId);
    const note = new FormData(form).get('note') || '';
    if (!track || !playlistId) return;
    try {
      const data = await api(`/api/playlists/${encodeURIComponent(playlistId)}/tracks`, { method: 'POST', body: JSON.stringify({ track, user: state.profile, note }) });
      state.data.playlists = data.playlists; state.data.activityFeed = data.activityFeed || state.data.activityFeed;
      state.currentPlaylistId = playlistId; state.pendingPlaylistId = null; state.pendingTrackId = null;
      closeModal(); state.page = 'playlist'; render(); showToast('Added to the crew tape.');
    } catch (error) { showToast(error.message, true); }
  }

  async function createPlaylist(form) {
    const formData = new FormData(form);
    try {
      const data = await api('/api/playlists', { method: 'POST', body: JSON.stringify({ title: formData.get('title'), subtitle: formData.get('subtitle'), description: formData.get('description'), user: state.profile }) });
      state.data.playlists = data.playlists; state.currentPlaylistId = data.playlist.id; state.page = 'playlist'; closeModal(); render(); showToast('Your crew tape is ready.');
    } catch (error) { showToast(error.message, true); }
  }

  async function addComment(form) {
    const playlistId = form.dataset.id;
    const text = new FormData(form).get('text');
    if (!text?.trim()) return;
    try {
      const data = await api(`/api/playlists/${encodeURIComponent(playlistId)}/comments`, { method: 'POST', body: JSON.stringify({ text, user: state.profile }) });
      state.data.playlists = data.playlists; render(); showToast('Note added.');
    } catch (error) { showToast(error.message, true); }
  }

  async function submitUpload(form) {
    const formData = new FormData(form);
    if (!formData.get('rightsConfirmed')) { showToast('Please confirm you can share this audio.', true); return; }
    formData.set('rightsConfirmed', 'true');
    formData.set('user', JSON.stringify(state.profile));
    const audioFile = formData.get('audio');
    const submit = form.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.dataset.original = submit.textContent; submit.textContent = 'Uploading…'; }

    try {
      let data = null;
      // Direct-to-Cloud Upload check (Cloudflare R2 / AWS S3)
      if (audioFile && audioFile instanceof File && audioFile.size > 0) {
        try {
          const presignRes = await api('/api/upload/presign', {
            method: 'POST',
            body: JSON.stringify({
              filename: audioFile.name,
              contentType: audioFile.type || 'audio/mpeg',
              kind: 'audio'
            })
          });

          if (presignRes && presignRes.isCloud && presignRes.uploadUrl) {
            submit.textContent = 'Uploading to Cloudflare R2 / S3…';
            const uploadHeaders = presignRes.headers || {};
            const cloudPutRes = await fetch(presignRes.uploadUrl, {
              method: presignRes.method || 'PUT',
              headers: uploadHeaders,
              body: audioFile
            });
            if (!cloudPutRes.ok) throw new Error('Cloud storage upload failed (' + cloudPutRes.status + ')');

            submit.textContent = 'Registering track…';
            data = await api('/api/upload/complete', {
              method: 'POST',
              body: JSON.stringify({
                key: presignRes.key,
                publicUrl: presignRes.publicUrl,
                title: formData.get('title') || '',
                artist: formData.get('artist') || '',
                album: formData.get('album') || '',
                rightsConfirmed: 'true'
              })
            });
          }
        } catch (cloudErr) {
          console.warn('[Storage] Direct cloud upload bypassed or failed, using server upload:', cloudErr);
        }
      }

      if (!data) {
        data = await api('/api/upload', { method: 'POST', body: formData });
      }

      state.data.uploads = data.uploads || [];
      if (data.track && !(state.data.tracks || []).some((track) => track.id === data.track.id)) state.data.tracks.unshift(data.track);
      closeModal(); state.page = 'vault'; render(); showToast('Added to your vault.');
    } catch (error) {
      if (submit) { submit.disabled = false; submit.textContent = 'Try upload again'; }
      showToast(error.message, true);
    }
  }

  async function shareTrack(track) {
    if (!track) return;
    showShareModal(track);
  }

  async function toggleSaved(trackId) {
    const track = getTrack(trackId);
    if (!track) return;
    if (isSaved(track.id)) {
      state.saved = state.saved.filter((item) => item.id !== track.id);
      showToast('Removed from your shelf.');
    } else {
      state.saved.unshift(track);
      showToast('Saved to your shelf.');
    }
    localStorage.setItem(storageKeys.saved, JSON.stringify(state.saved));
    render();
  }

  async function sendShare(form) {
    const track = getTrack(form.dataset.id) || state.currentTrack;
    if (!track) return;
    const message = new FormData(form).get('message') || '';
    try {
      const data = await api('/api/activity/share', { method: 'POST', body: JSON.stringify({ track, message, user: state.profile }) });
      state.data.activityFeed = data.activityFeed; closeModal(); render(); showToast('Shared with your crew.');
    } catch (error) { showToast(error.message, true); }
  }

  async function shareCurrent() {
    if (!state.currentTrack) return showToast('Play or choose a track first.');
    showShareModal(state.currentTrack);
  }

  async function sendReaction(emoji, roomId = state.activeRoomId) {
    if (!roomId) return showToast('Join a room to send a reaction.');
    try { await api(`/api/rooms/${encodeURIComponent(roomId)}/react`, { method: 'POST', body: JSON.stringify({ emoji, user: state.profile }) }); }
    catch (error) { showToast(error.message, true); }
  }

  async function createTape(form) { await createPlaylist(form); }

  async function copyText(value, title = 'Copied') {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${title} to clipboard.`);
    } catch (_error) {
      const temp = document.createElement('textarea'); temp.value = value; document.body.appendChild(temp); temp.select(); document.execCommand('copy'); temp.remove(); showToast(`${title} to clipboard.`);
    }
  }

  async function likeActivity(id) {
    try { const data = await api(`/api/activity/${encodeURIComponent(id)}/like`, { method: 'POST', body: JSON.stringify({ user: state.profile }) }); state.data.activityFeed = data.activityFeed; render(); }
    catch (error) { showToast(error.message, true); }
  }

  function leaveRoom() {
    const room = getRoom();
    state.activeRoomId = null;
    state.selectedRoomId = null;
    state.page = 'rooms';
    state.updatingFromRoom = true;
    if (audio && !audio.paused) { audio.pause(); state.isPlaying = false; }
    setTimeout(() => { state.updatingFromRoom = false; }, 300);
    render(); showToast(`Left ${room?.name || 'the room'}.`);
  }

  function updatePlayerProgress() {
    if (!audio) return;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const track = state.currentTrack;
    const max = track ? (track.isPreview ? 30 : (Number(audio.duration) || Number(track.duration) || 210)) : 30;
    const slider = document.getElementById('player-scrub');
    if (slider && document.activeElement !== slider) { slider.max = max; slider.value = Math.min(current, max); }
    const currentText = document.getElementById('player-time-current');
    const stageText = document.getElementById('stage-time-current');
    if (currentText) currentText.textContent = formatTime(current);
    if (stageText) stageText.textContent = formatTime(current);
    const stageSlider = document.getElementById('stage-scrub');
    if (stageSlider && document.activeElement !== stageSlider) { stageSlider.max = max; stageSlider.value = Math.min(current, max); }
  }

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (action !== 'backdrop-close') event.stopPropagation();
    switch (action) {
      case 'external-link': break;
      case 'navigate': navPage(target.dataset.page || 'home'); break;
      case 'retry': loadApp(); break;

      case 'clear-search': {
        state.searchQuery = ''; state.searchResults = null; state.searchAlbums = []; state.searchError = ''; state.page = 'discover'; render(); document.querySelector('[data-role="search"]')?.focus(); break;
      }
      case 'create-room': showCreateRoomModal(); break;
      case 'create-playlist': showCreatePlaylistModal(); break;
      case 'open-upload': showUploadModal(); break;
      case 'open-dmca': showDmcaModal(); break;
      case 'open-pro': showProModal(); break;
      case 'open-tip': showTipModal(id || state.selectedRoomId); break;
      case 'profile': showProfileModal(); break;
      case 'logout': logoutApp(); break;
      case 'toggle-theme': state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); render(); break;
      case 'set-genre': state.selectedGenre = id || 'all'; state.searchQuery = ''; state.searchResults = null; state.searchAlbums = []; state.page = 'discover'; render(); break;
      case 'play-track': {
        const track = getTrack(id);
        let pageTracks = [track];
        if (state.page === 'playlist') pageTracks = getPlaylist()?.tracks || [track];
        else if (state.page === 'album') pageTracks = state.currentAlbum?.tracks || [track];
        else if (state.page === 'library') pageTracks = state.saved || [track];
        else if (state.page === 'vault') pageTracks = (state.data.tracks || []).filter((item) => item.source === 'admin-catalog');
        else if (state.page === 'discover' || state.page === 'search') pageTracks = state.searchQuery ? (state.searchResults || [track]) : filteredSeedTracks();
        else if (state.page === 'home') pageTracks = state.data.tracks || [track];
        await playFromList(id, pageTracks?.length ? pageTracks : [track]);
        break;
      }
      case 'player-toggle': await togglePlayer(); break;
      case 'next-track': await nextTrack(); break;
      case 'previous-track': await previousTrack(); break;
      case 'enqueue-track': await enqueueTrack(id); break;
      case 'save-track': await toggleSaved(id); break;
      case 'share-track': await shareTrack(getTrack(id)); break;
      case 'share-current': await shareCurrent(); break;
      case 'add-to-playlist': {
        if (!state.pendingPlaylistId) state.pendingPlaylistId = id;
        else state.pendingTrackId = id;
        const trackId = state.pendingPlaylistId === id ? null : id;
        if (trackId) showAddToPlaylistModal(trackId);
        else {
          state.pendingTrackId = null;
          state.pendingPlaylistId = id;
          state.page = 'discover'; render(); showToast('Choose an open track to add to this tape.');
        }
        break;
      }
      case 'cancel-playlist-target': state.pendingPlaylistId = null; state.page = 'discover'; render(); break;
      case 'join-room': await joinRoom(id); break;
      case 'open-room': state.selectedRoomId = id; state.page = 'room'; render(); break;
      case 'leave-room': leaveRoom(); break;
      case 'vote': await voteOnQueue(target.dataset.room || state.activeRoomId, id); break;
      case 'right-tab': state.rightTab = id || 'queue'; render(); break;
      case 'react': await sendReaction(id, target.dataset.room || state.activeRoomId); break;
      case 'copy-room': {
        const room = getRoom(id) || (state.data.rooms || []).find((entry) => entry.code === id);
        if (room) await copyText(`${location.origin}/#room/${room.id}\nRoom code: ${room.code}`, 'Invite link copied');
        else await copyText(id, 'Room code copied');
        break;
      }
      case 'open-playlist': state.currentPlaylistId = id; state.pendingPlaylistId = null; state.page = 'playlist'; render(); break;
      case 'play-list': {
        const playlist = getPlaylist(id);
        if (playlist?.tracks?.length) await playFromList(playlist.tracks[0].id, playlist.tracks);
        else showToast('Add a track to this tape first.');
        break;
      }
      case 'play-list-album': if (state.currentAlbum?.tracks?.length) await playFromList(state.currentAlbum.tracks[0].id, state.currentAlbum.tracks); break;
      case 'add-to-playlist-target': state.pendingPlaylistId = id; state.page = 'discover'; render(); break;
      case 'open-album': await openAlbum(id); break;
      case 'like': await likeActivity(id); break;
      case 'activity-more': showToast('More crew features are on the way.'); break;
      case 'shuffle': state.isShuffle = !state.isShuffle; render(); break;
      case 'repeat': state.repeat = !state.repeat; render(); break;
      case 'toggle-mute': state.isMuted = !state.isMuted; audio.muted = state.isMuted; render(); break;
      case 'add-to-tape': state.pendingPlaylistId = id; state.page = 'discover'; render(); break;
      case 'browse-to-queue': state.page = 'discover'; render(); break;
      case 'backdrop-close': if (event.target === target) closeModal(); break;
      case 'close-modal': closeModal(); break;
      case 'copy-tape': {
        const playlist = getPlaylist(id); if (playlist) await copyText(`${location.origin}/#tape/${playlist.id}`, 'Tape link copied'); break;
      }
      case 'share-playlist': {
        const playlist = getPlaylist(id); if (playlist) await copyText(`${location.origin}/#tape/${playlist.id}`, 'Tape link copied'); break;
      }
      case 'admin-logout': await logoutAdmin(); break;
      case 'admin-edit-track': showAdminEditModal(id); break;
      case 'admin-delete-track': await deleteAdminCatalogTrack(id); break;
      default: break;
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    switch (form.dataset.form) {

      case 'dmca': {
        const formData = new FormData(form);
        const submit = form.querySelector('[type="submit"]');
        if (submit) { submit.disabled = true; submit.textContent = 'Submitting notice…'; }
        try {
          const res = await api('/api/dmca/takedown', {
            method: 'POST',
            body: JSON.stringify({
              claimantName: formData.get('claimantName'),
              claimantEmail: formData.get('claimantEmail'),
              copyrightWork: formData.get('copyrightWork'),
              infringingUrl: formData.get('infringingUrl'),
              signature: formData.get('signature'),
              goodFaithConfirmed: formData.get('goodFaithConfirmed') ? 'true' : 'false'
            })
          });
          closeModal();
          showToast(res.message || 'DMCA Notice submitted.');
        } catch (err) {
          if (submit) { submit.disabled = false; submit.textContent = 'Submit DMCA Notice'; }
          showToast(err.message, true);
        }
        break;
      }
      case 'pro-checkout': {
        const formData = new FormData(form);
        const tier = formData.get('tier') || 'pro';
        const submit = form.querySelector('[type="submit"]');
        if (submit) { submit.disabled = true; submit.textContent = 'Opening checkout…'; }
        try {
          const res = await api('/api/billing/create-checkout-session', {
            method: 'POST',
            body: JSON.stringify({ tier })
          });
          if (res.url) {
            window.location.href = res.url;
          } else {
            closeModal();
            showToast('Tier upgraded successfully!');
          }
        } catch (err) {
          if (submit) { submit.disabled = false; submit.textContent = 'Proceed with Stripe'; }
          showToast(err.message, true);
        }
        break;
      }
      case 'tip': {
        const formData = new FormData(form);
        const amountCents = (parseInt(formData.get('amount'), 10) || 5) * 100;
        const message = formData.get('message') || '';
        const roomId = form.dataset.roomId;
        try {
          await api(`/api/rooms/${encodeURIComponent(roomId)}/tip`, {
            method: 'POST',
            body: JSON.stringify({ amountCents, message, senderName: state.profile?.name })
          });
          closeModal();
          showToast(`Tipped $${(amountCents / 100).toFixed(2)} to the host! 🪙`);
        } catch (err) {
          showToast(err.message, true);
        }
        break;
      }
      case 'create-room': await createRoom(form); break;
      case 'create-playlist': await createTape(form); break;
      case 'upload': await submitUpload(form); break;
      case 'add-playlist-track': await addTrackToPlaylist(form); break;
      case 'comment': await addComment(form); break;
      case 'share': await sendShare(form); break;
      case 'chat': {
        const text = new FormData(form).get('text');
        if (!text?.trim()) break;
        try {
          const data = await api(`/api/rooms/${encodeURIComponent(form.dataset.id)}/chat`, { method: 'POST', body: JSON.stringify({ text, user: state.profile }) });
          state.data.rooms = data.rooms; render();
          const input = document.querySelector('[data-focus-key="chat-input"]'); input?.focus();
        } catch (error) { showToast(error.message, true); }
        break;
      }
      case 'profile': {
        const formData = new FormData(form);
        const name = String(formData.get('name') || 'You').trim().slice(0, 32);
        let handle = String(formData.get('handle') || '@you').trim().slice(0, 24);
        if (!handle.startsWith('@')) handle = `@${handle}`;
        state.profile = { ...state.profile, name, handle, avatar: String(formData.get('avatar') || initials(name)).trim().slice(0, 2).toUpperCase() };
        localStorage.setItem(storageKeys.profile, JSON.stringify(state.profile)); closeModal(); render(); showToast('Profile saved.'); break;
      }
      case 'admin-login': await loginAdmin(form); break;
      case 'admin-upload': await submitAdminCatalog(form); break;
      case 'admin-edit': await updateAdminCatalogTrack(form); break;
      default: break;
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (target.matches('[data-role="search"]')) { applySearchInput(target.value); return; }
    if (target.matches('[data-role="volume"]')) {
      state.volume = Number(target.value); state.isMuted = false; audio.volume = state.volume; audio.muted = false;
      localStorage.setItem(storageKeys.volume, String(state.volume));
      const iconNode = document.querySelector('.player-volume-button .icon');
      if (iconNode) document.querySelector('.player-volume-button').innerHTML = icon('volume', 16);
      return;
    }
    if (target.matches('[data-role="seek"]')) {
      const value = Number(target.value);
      if (audio.readyState >= 1 && Number.isFinite(value)) {
        try { audio.currentTime = value; state.position = value; updatePlayerProgress(); } catch (_error) { /* Skip until metadata is ready. */ }
      }
    }
  });

  document.addEventListener('change', async (event) => {
    const target = event.target;
    if (target.matches('[data-role="seek"]')) {
      state.position = Number(target.value) || 0;
      if (state.activeRoomId) await syncRoom({ position: state.position });
    }
  });

  document.addEventListener('keydown', async (event) => {
    const active = document.activeElement;
    const isTyping = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);
    if ((event.metaKey || event.ctrlKey) && event.altKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      if (state.admin.authenticated) {
        openAdminPage();
      } else {
        showSecretAdminModal();
      }
      return;
    }
    if (event.key === '/' && !isTyping) { event.preventDefault(); document.querySelector('[data-role="search"]')?.focus(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('[data-role="search"]')?.focus(); }
    if (event.code === 'Space' && !isTyping) { event.preventDefault(); await togglePlayer(); }
    if ((event.key === 'Enter' || event.key === ' ') && active?.matches('.track-row[role="button"]')) { event.preventDefault(); active.click(); }
    if (event.key === 'Escape') closeModal();
  });

  audio.addEventListener('play', () => { state.isPlaying = true; render(); });
  audio.addEventListener('pause', () => { state.isPlaying = false; render(); });
  audio.addEventListener('timeupdate', () => { state.position = audio.currentTime; updatePlayerProgress(); });
  audio.addEventListener('loadedmetadata', () => {
    const needsRoomDurationSync = state.activeRoomId && !Number(state.currentTrack?.duration);
    if (state.currentTrack && !state.currentTrack.isPreview && Number.isFinite(audio.duration)) {
      state.currentTrack.duration = Math.floor(audio.duration);
      state.currentTrack.fullDuration = state.currentTrack.duration;
      render();
      if (needsRoomDurationSync) syncRoom({ track: state.currentTrack, position: audio.currentTime || 0, isPlaying: !audio.paused });
    }
    updatePlayerProgress();
  });
  audio.addEventListener('ended', async () => { state.isPlaying = false; await nextTrack(); });
  audio.addEventListener('error', () => {
    if (state.currentTrack) showToast('Audio could not load. Try another track or check your connection.', true);
    state.isPlaying = false; render();
  });

  window.addEventListener('hashchange', () => {
    if (checkSecretHash()) return;
    const tape = location.hash.match(/^#tape\/(.+)$/);
    const room = location.hash.match(/^#room\/(.+)$/);
    if (tape) { state.currentPlaylistId = tape[1]; state.page = 'playlist'; render(); }
    else if (room) { state.selectedRoomId = room[1]; state.page = 'room'; render(); }
  });

  loadApp();
})();
