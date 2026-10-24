(function () {
  'use strict';

  const API_BASES = [
    'https://de1.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info'
  ];
  const DEFAULT_FAVICON = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0B6E4F"/><circle cx="16" cy="16" r="8" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.6"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>');
  const LIMIT = 60;

  const state = {
    stations: [],
    favorites: [],
    history: [],
    currentStation: null,
    isPlaying: false,
    activeTab: 'search',
    apiBase: API_BASES[0],
    searchAbort: null,
    offset: 0,
    sleepTimerId: null,
    prevVolume: 0.7
  };

  const els = {};
  let audio;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindEvents();
    await loadStorage();
    await selectBestServer();
    await loadFilters();
    
    // Restaurar última estação
    try {
      const last = await os.storage.get('lastStation');
      if (last) {
        state.currentStation = last;
        audio.src = last.url_resolved;
        updatePlayerUI();
      }
    } catch(e) {}

    await performSearch(true);
    renderTabs();
    renderList();
    restoreVolume();
    setupMediaSession();
  }

  function cacheElements() {
    els.searchInput = document.getElementById('search-input');
    els.countryFilter = document.getElementById('country-filter');
    els.tagFilter = document.getElementById('tag-filter');
    els.sortFilter = document.getElementById('sort-filter');
    els.list = document.getElementById('station-list');
    els.playerFavicon = document.getElementById('player-favicon');
    els.playerName = document.getElementById('player-name');
    els.playerMeta = document.getElementById('player-meta');
    els.playPause = document.getElementById('play-pause');
    els.btnStop = document.getElementById('btn-stop');
    els.volume = document.getElementById('volume');
    els.volumeLabel = document.getElementById('volume-label');
    els.tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    els.sleepTimer = document.getElementById('sleep-timer');
    els.visualizer = document.getElementById('visualizer');
    
    els.btnExport = document.getElementById('btn-export');
    els.btnImport = document.getElementById('btn-import');
    els.btnLoadMore = document.getElementById('btn-load-more');
    
    audio = document.getElementById('audio');
  }

  // ---------------------------------------------------------------- Storage

  async function loadStorage() {
    try {
      const [favs, hist] = await Promise.all([os.storage.get('favorites'), os.storage.get('history')]);
      state.favorites = Array.isArray(favs) ? favs : [];
      state.history = Array.isArray(hist) ? hist : [];
    } catch (err) { state.favorites = []; state.history = []; }
  }

  async function persistFavorites() { try { await os.storage.set('favorites', state.favorites); } catch (err) {} }
  async function persistHistory() { try { await os.storage.set('history', state.history.slice(0, 30)); } catch (err) {} }
  async function persistLastStation(st) { try { await os.storage.set('lastStation', st); } catch (err) {} }

  async function restoreVolume() {
    try {
      const v = await os.storage.get('volume');
      if (typeof v === 'number' && v >= 0 && v <= 1) {
        audio.volume = v; els.volume.value = String(v); updateVolumeLabel(v);
        state.prevVolume = v;
      }
    } catch (err) {}
  }

  // ---------------------------------------------------------------- API

  async function selectBestServer() {
    for (const base of API_BASES) {
      try {
        const res = await fetch(base + '/json/stats', { cache: 'no-store' });
        if (res.ok) { state.apiBase = base; return; }
      } catch (err) {}
    }
  }

  async function loadFilters() {
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(state.apiBase + '/json/countries?order=stationcount&reverse=true&limit=60'),
        fetch(state.apiBase + '/json/tags?order=stationcount&reverse=true&limit=60')
      ]);
      if (cRes.ok) {
        const countries = await cRes.json();
        for (const c of countries) {
          const opt = document.createElement('option');
          opt.value = c.iso_3166_1 || c.name; opt.textContent = c.name;
          els.countryFilter.appendChild(opt);
        }
      }
      if (tRes.ok) {
        const tags = await tRes.json();
        for (const t of tags) {
          const opt = document.createElement('option');
          opt.value = t.name; opt.textContent = t.name;
          els.tagFilter.appendChild(opt);
        }
      }
    } catch (err) {}
  }

  async function performSearch(reset = true) {
    if (state.searchAbort) state.searchAbort.abort();
    state.searchAbort = new AbortController();
    if (reset) state.offset = 0;

    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(state.offset),
      order: els.sortFilter.value,
      reverse: els.sortFilter.value === 'random' ? 'false' : 'true',
      hidebroken: 'true'
    });
    
    const q = els.searchInput.value.trim();
    if (q) params.set('name', q);
    if (els.countryFilter.value) params.set('countrycode', els.countryFilter.value);
    if (els.tagFilter.value) params.set('tag', els.tagFilter.value);

    if (reset) els.list.innerHTML = '<div class="empty-state">A pesquisar…</div>';

    try {
      const res = await fetch(state.apiBase + '/json/stations/search?' + params.toString(), { signal: state.searchAbort.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const valid = data.filter(s => s.url_resolved && s.lastcheckok === 1);

      if (reset) state.stations = valid;
      else state.stations = state.stations.concat(valid);

      if (!state.stations.length) {
        els.list.innerHTML = '<div class="empty-state">Sem estações para estes filtros.</div>';
      } else {
        renderList();
      }
      updateListActions();
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (reset) els.list.innerHTML = '<div class="empty-state">Falha de ligação.</div>';
    }
  }

  // ---------------------------------------------------------------- UI

  function renderTabs() {
    els.tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.tab === state.activeTab ? 'true' : 'false'));
    updateListActions();
  }

  function updateListActions() {
    els.btnExport.hidden = state.activeTab !== 'favorites';
    els.btnImport.hidden = state.activeTab !== 'favorites';
    els.btnLoadMore.hidden = state.activeTab !== 'search' || state.stations.length === 0;
  }

  function getActiveList() {
    if (state.activeTab === 'favorites') return state.favorites;
    if (state.activeTab === 'history') return state.history;
    return state.stations;
  }

  function renderList() {
    const list = getActiveList();
    if (!list || !list.length) {
      const msg = state.activeTab === 'favorites' ? 'Ainda não tens favoritos.' : state.activeTab === 'history' ? 'Ainda não ouviste nada.' : 'Sem resultados.';
      els.list.innerHTML = '<div class="empty-state">' + msg + '</div>';
      return;
    }
    els.list.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const st of list) frag.appendChild(buildStationItem(st));
    els.list.appendChild(frag);
  }

  function buildStationItem(station) {
    const item = document.createElement('div');
    item.className = 'station-item';
    item.dataset.uuid = station.stationuuid;
    if (state.currentStation && state.currentStation.stationuuid === station.stationuuid) item.classList.add('active');

    const img = document.createElement('img');
    img.className = 'station-favicon'; img.loading = 'lazy';
    img.src = station.favicon || DEFAULT_FAVICON;
    img.onerror = () => { img.src = DEFAULT_FAVICON; };
    item.appendChild(img);

    const info = document.createElement('div');
    info.className = 'station-info';
    const name = document.createElement('div');
    name.className = 'station-name'; name.textContent = station.name || 'Sem nome';
    info.appendChild(name);
    const meta = document.createElement('div');
    meta.className = 'station-meta';
    const bits = [];
    if (station.country) bits.push(station.country);
    if (station.codec) bits.push(station.codec);
    if (station.bitrate) bits.push(station.bitrate + ' kbps');
    meta.textContent = bits.join(' · ') || '—';
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'station-actions';
    const favBtn = document.createElement('button');
    favBtn.type = 'button'; favBtn.className = 'fav-btn'; favBtn.setAttribute('aria-label', 'Favorito');
    const isFav = state.favorites.some(f => f.stationuuid === station.stationuuid);
    favBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    favBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="' + (isFav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    favBtn.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(station); });
    actions.appendChild(favBtn);
    item.appendChild(actions);

    item.addEventListener('click', () => playStation(station));
    return item;
  }

  // ---------------------------------------------------------------- Player

  function playStation(station) {
    if (!station || !station.url_resolved) return;
    
    state.currentStation = station;
    els.playPause.classList.add('loading');
    
    audio.src = station.url_resolved;
    audio.load();

    audio.play().then(() => {
      state.isPlaying = true;
      updatePlayerUI();
      addToHistory(station);
      persistLastStation(station);
      setupMediaSession();
    }).catch(err => {
      state.isPlaying = false;
      els.playPause.classList.remove('loading');
      updatePlayerUI();
      os.notify('Não foi possível reproduzir esta estação.');
    });
  }

  function togglePlayPause() {
    if (!state.currentStation) return;
    if (audio.paused) {
      audio.play().then(() => { state.isPlaying = true; updatePlayerUI(); });
    } else {
      audio.pause();
      state.isPlaying = false;
      updatePlayerUI();
    }
  }

  function stopPlayback() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    state.isPlaying = false;
    state.currentStation = null;
    updatePlayerUI();
  }

  function updatePlayerUI() {
    const st = state.currentStation;
    els.playPause.classList.remove('loading');
    
    if (!st) {
      els.playerName.textContent = 'Nenhuma estação';
      els.playerMeta.textContent = 'Selecione uma estação para ouvir';
      els.playerFavicon.hidden = true;
      els.playPause.disabled = true;
      els.btnStop.disabled = true;
      els.visualizer.classList.remove('playing');
      if (window.os && os.window) os.window.setTitle('Rádio');
      return;
    }

    els.playerName.textContent = st.name || 'Sem nome';
    const meta = [];
    if (st.country) meta.push(st.country);
    if (st.codec) meta.push(st.codec);
    if (st.bitrate) meta.push(st.bitrate + ' kbps');
    els.playerMeta.textContent = meta.join(' · ') || '—';

    els.playerFavicon.hidden = false;
    els.playerFavicon.src = st.favicon || DEFAULT_FAVICON;
    els.playerFavicon.onerror = () => { els.playerFavicon.src = DEFAULT_FAVICON; };

    els.playPause.disabled = false;
    els.btnStop.disabled = false;
    
    els.playPause.innerHTML = state.isPlaying
      ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>';
    els.playPause.setAttribute('aria-label', state.isPlaying ? 'Pausar' : 'Reproduzir');
    
    if (state.isPlaying) els.visualizer.classList.add('playing');
    else els.visualizer.classList.remove('playing');

    if (window.os && os.window) os.window.setTitle('Rádio - ' + (st.name || 'A tocar'));
    document.querySelectorAll('.station-item').forEach(el => el.classList.toggle('active', el.dataset.uuid === st.stationuuid));
  }

  function updateVolumeLabel(v) { els.volumeLabel.textContent = Math.round(v * 100) + '%'; }

  // ---------------------------------------------------------------- Favoritos e Histórico

  function toggleFavorite(station) {
    const idx = state.favorites.findIndex(f => f.stationuuid === station.stationuuid);
    if (idx >= 0) state.favorites.splice(idx, 1);
    else state.favorites.unshift(station);
    persistFavorites();
    renderList();
  }

  function addToHistory(station) {
    state.history = state.history.filter(h => h.stationuuid !== station.stationuuid);
    state.history.unshift(station);
    persistHistory();
  }

  // ---------------------------------------------------------------- Media Session API

  function setupMediaSession() {
    if (!('mediaSession' in navigator) || !state.currentStation) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.currentStation.name,
      artist: state.currentStation.country || 'Rádio',
      album: 'WebOS Rádio',
      artwork: [{ src: state.currentStation.favicon || DEFAULT_FAVICON, sizes: '512x512', type: 'image/png' }]
    });
    
    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('stop', () => stopPlayback());
  }

  // ---------------------------------------------------------------- Export / Import

  async function exportFavorites() {
    if (!window.os || !os.dialog || !os.fs) return;
    const path = await os.dialog.save({ title: 'Exportar Favoritos', defaultName: 'radio_favoritos.json', start: '/home/user/Documentos/' });
    if (!path) return;
    try {
      await os.fs.write(path, JSON.stringify(state.favorites, null, 2), 'application/json');
      os.notify('Favoritos exportados.');
    } catch (err) { os.notify('Erro ao exportar.'); }
  }

  async function importFavorites() {
    if (!window.os || !os.dialog || !os.fs) return;
    const path = await os.dialog.open({ title: 'Importar Favoritos', start: '/home/user/Documentos/', filter: ['.json'] });
    if (!path) return;
    try {
      const content = await os.fs.read(path);
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        // Merge sem duplicados
        for (const st of data) {
          if (!state.favorites.some(f => f.stationuuid === st.stationuuid)) {
            state.favorites.push(st);
          }
        }
        await persistFavorites();
        renderList();
        os.notify('Favoritos importados.');
      } else throw new Error('Formato inválido');
    } catch (err) { os.notify('Erro ao importar: ficheiro inválido.'); }
  }

  // ---------------------------------------------------------------- Eventos

  function bindEvents() {
    let searchTimer = null;
    const scheduleSearch = () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.activeTab = 'search'; renderTabs(); performSearch(true);
      }, 400);
    };

    els.searchInput.addEventListener('input', scheduleSearch);
    els.countryFilter.addEventListener('change', () => { state.activeTab = 'search'; renderTabs(); performSearch(true); });
    els.tagFilter.addEventListener('change', () => { state.activeTab = 'search'; renderTabs(); performSearch(true); });
    els.sortFilter.addEventListener('change', () => { state.activeTab = 'search'; renderTabs(); performSearch(true); });

    els.tabs.forEach(t => t.addEventListener('click', () => {
      state.activeTab = t.dataset.tab; renderTabs(); renderList();
    }));

    els.playPause.addEventListener('click', togglePlayPause);
    els.btnStop.addEventListener('click', stopPlayback);
    
    els.volume.addEventListener('input', () => {
      const v = parseFloat(els.volume.value);
      audio.volume = v; updateVolumeLabel(v);
      if (v > 0) state.prevVolume = v;
      if (window.os && os.storage) os.storage.set('volume', v).catch(() => {});
    });

    // Sleep Timer
    els.sleepTimer.addEventListener('change', () => {
      if (state.sleepTimerId) clearTimeout(state.sleepTimerId);
      const mins = parseInt(els.sleepTimer.value, 10);
      if (mins > 0) {
        state.sleepTimerId = setTimeout(() => {
          stopPlayback();
          els.sleepTimer.value = '0';
          os.notify('Sleep Timer: Rádio parada.');
        }, mins * 60000);
      }
    });

    // Load More
    els.btnLoadMore.addEventListener('click', () => {
      state.offset += LIMIT;
      performSearch(false);
    });

    // Export/Import
    els.btnExport.addEventListener('click', exportFavorites);
    els.btnImport.addEventListener('click', importFavorites);

    // Áudio Events
    audio.addEventListener('playing', () => { state.isPlaying = true; updatePlayerUI(); });
    audio.addEventListener('pause', () => { state.isPlaying = false; updatePlayerUI(); });
    audio.addEventListener('error', () => {
      if (!state.currentStation) return;
      state.isPlaying = false; updatePlayerUI();
      os.notify('A estação parou ou está indisponível.');
    });

    // Atalhos de Teclado
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
      if (e.key.toLowerCase() === 'm') { els.volume.value = audio.volume > 0 ? '0' : String(state.prevVolume); els.volume.dispatchEvent(new Event('input')); }
      if (e.key === '+' || e.key === '=') { els.volume.value = String(Math.min(1, audio.volume + 0.1)); els.volume.dispatchEvent(new Event('input')); }
      if (e.key === '-') { els.volume.value = String(Math.max(0, audio.volume - 0.1)); els.volume.dispatchEvent(new Event('input')); }
    });
  }

  // Args de arranque
  if (window.os && typeof os.args === 'function') {
    os.args().then(args => {
      if (args && args.url) {
        state.currentStation = { name: 'Stream externo', url_resolved: args.url, stationuuid: 'external' };
        playStation(state.currentStation);
      }
    }).catch(() => {});
  }
})();