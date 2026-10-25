// ---- helpers ----
const EXT_AUDIO = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.opus'];
const EXT_VIDEO = ['.mp4', '.webm', '.ogv', '.mkv', '.mov', '.avi', '.m4v'];

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};
const isMedia = (name) => [...EXT_AUDIO, ...EXT_VIDEO].some((ext) => name.toLowerCase().endsWith(ext));
const isVideo = (name) => EXT_VIDEO.some((ext) => name.toLowerCase().endsWith(ext));

let home = '/home/user';
let dir = '/home/user/Música';
let tracks = [];
let current = -1;
let objectUrl = null;
let useSdk = !!window.os;
let settings = { volume: 1, muted: false, repeat: 'none' };
let lastPositionSave = 0;

const videoEl = $('video');
const audioEl = $('audio');
const emptyEl = $('empty');
const statusEl = $('status');

function activeEl() { return (tracks[current] && isVideo(tracks[current].name)) ? videoEl : audioEl; }
function say(m, level) {
  if (statusEl) { statusEl.textContent = m; statusEl.dataset.level = level || 'info'; }
  if (useSdk && level === 'error' && window.os && os.notify) { try { os.notify(m); } catch (e) {} }
}
function revokeUrl() { if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch (e) {} objectUrl = null; } }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/(1024*1024)).toFixed(1) + ' MB';
}
function syncAll() {
  [audioEl, videoEl].forEach((m) => { m.volume = settings.volume; m.muted = settings.muted; });
  const v = $('volume'); if (v) v.value = settings.volume;
  const m = $('mute'); if (m) m.textContent = settings.muted ? '🔇' : '🔊';
}
function setActiveTrackEl(kind) {
  videoEl.hidden = kind !== 'video';
  audioEl.hidden = kind === 'video';
  emptyEl.hidden = true;
}
function hideMedia() { videoEl.hidden = true; audioEl.hidden = true; emptyEl.hidden = false; }
function updateTransport(media) {
  const dur = (media && media.duration) || 0;
  const cur = (media && media.currentTime) || 0;
  const seek = $('seek');
  if (seek) { seek.max = String(dur || 0); seek.value = String(cur); }
  const ct = $('curTime'); if (ct) ct.textContent = fmtTime(cur);
  const dt = $('durTime'); if (dt) dt.textContent = fmtTime(dur);
  const pb = $('play'); if (pb) pb.textContent = (media && media.paused) ? '▶' : '⏸';
  const te = $('title'); if (te) te.textContent = (tracks[current] ? tracks[current].name : 'Leitor Multimédia');
  const se = $('sub'); if (se) se.textContent = tracks[current] ? `${current + 1} / ${tracks.length}` : 'Nenhum ficheiro selecionado';
  if (window.os && os.window) try { os.window.setTitle(tracks[current] ? `${tracks[current].name} — Leitor Multimédia` : 'Leitor Multimédia'); } catch (e) {}
}
function renderPlaylist() {
  const ol = $('playlist');
  if (!ol) return;
  ol.replaceChildren();
  tracks.forEach((t, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pl-item' + (i === current ? ' active' : '');
    const icon = isVideo(t.name) ? '🎬' : '🎵';
    btn.innerHTML = `<span class="icon">${icon}</span><span class="name">${escapeHtml(t.name)}</span><span class="size">${fmtBytes(t.size)}</span>`;
    btn.onclick = () => playIndex(i);
    li.append(btn);
    ol.append(li);
  });
  const c = $('count'); if (c) c.textContent = tracks.length ? `(${tracks.length})` : '';
  const ep = $('emptyPl'); if (ep) ep.hidden = tracks.length > 0;
}
function bindMediaEvents(media) {
  // guard against double binding
  if (media.__bound) return;
  media.__bound = true;
  const update = () => updateTransport(media);
  media.addEventListener('timeupdate', update);
  media.addEventListener('loadedmetadata', update);
  media.addEventListener('durationchange', update);
  media.addEventListener('play', update);
async function loadMediaSource(src, mime) {
  const media = activeEl();
  const other = media === videoEl ? audioEl : videoEl;
  try { other.pause(); } catch (e) {}
  other.removeAttribute('src'); other.load && other.load();
  media.src = src;
  try { media.load(); } catch (e) {}
}
async function playIndex(i) {
  if (!tracks.length) { hideMedia(); return; }
  if (i < 0 || i >= tracks.length) return;
  current = i;
  revokeUrl();
  const track = tracks[current];
  say('');
  try {
    if (useSdk && window.os && os.fs) {
      const content = await os.fs.read(track.path);
      if (content instanceof Blob) {
        objectUrl = URL.createObjectURL(content);
        await loadMediaSource(objectUrl, track.mime);
      } else if (typeof content === 'string') {
        await loadMediaSource(content, track.mime);
      } else {
        say('Formato de ficheiro não suportado.', 'error'); return;
      }
    } else {
      await loadMediaSource(track.path, track.mime);
    }
  } catch (e) {
    say(e && e.message ? e.message : 'Não foi possível ler o ficheiro.', 'error'); return;
  }
  const wantVideo = isVideo(track.name);
  setActiveTrackEl(wantVideo ? 'video' : 'audio');
  const media = activeEl();
  bindMediaEvents(media);
  os && os.window && os.window.setTitle(`${track.name} — Leitor Multimédia`);
  media.play().catch(() => {});
  updateTransport(media);
  renderPlaylist();
  persistState(true);
}
function seekTo(val) {
  const media = activeEl(); if (!media) return;
  const v = Math.max(0, Math.min(Number(val) || 0, media.duration || 0));
  try { media.currentTime = v; } catch (e) {}
  updateTransport(media);
}
async function scanDir(d) {
  if (!useSdk || !window.os || !os.fs) return;
  try {
    const items = await os.fs.list(d);
    const media = items.filter((it) => it.type === 'file' && isMedia(it.name))
      .sort((a, b) => a.name.localeCompare(b.name, os.i18n.locale));
    tracks = media.map((it) => ({ name: it.name, path: it.path, size: it.size, mime: it.mime || 'application/octet-stream', type: 'fs' }));
    dir = d;
    emptyEl.hidden = tracks.length > 0;
    renderPlaylist();
    if (tracks.length && current < 0) await playIndex(0);
  } catch (e) {
    say(e && e.message ? e.message : 'Pasta não encontrada.', 'error');
  }
}
async function importFiles(fileList) {
  if (!fileList || !fileList.length) return;
  let last = null;
  for (const f of fileList) {
    if (!isMedia(f.name)) { say(`${f.name}: formato não suportado.`); continue; }
    if (f.size > 100 * 1024 * 1024) { say(`${f.name}: muito grande (>100 MB).`); continue; }
    try {
      if (useSdk && window.os && os.fs) {
        const target = dir + '/' + f.name;
        await os.fs.write(target, f, f.type || 'application/octet-stream');
        last = f.name;
      } else {
        tracks.push({ name: f.name, path: URL.createObjectURL(f), size: f.size, mime: f.type, type: 'blob' });
        last = f.name;
      }
    } catch (err) {
      say(err && err.message ? err.message : 'Falha ao importar.', 'error');
    }
  }
  if (useSdk && window.os && os.fs) {
    const cur = tracks[current] ? tracks[current].path : null;
    await scanDir(dir);
    if (last) {
      const idx = tracks.findIndex((t) => t.name === last);
      if (idx >= 0) await playIndex(idx);
    } else if (cur) {
      const idx = tracks.findIndex((t) => t.path === cur);
      if (idx >= 0) current = idx;
    }
  } else {
    renderPlaylist();
    if (last && current < 0) await playIndex(tracks.length - 1);
  }
}
function persistState(immediate) {
  if (!useSdk || !window.os || !os.storage) return;
  const now = Date.now();
  if (!immediate && now - lastPositionSave < 4000) return;
  lastPositionSave = now;
  const media = activeEl();
  const payload = {
    dir, currentName: tracks[current] ? tracks[current].name : null,
    position: media && Number.isFinite(media.currentTime) ? media.currentTime : 0,
    volume: settings.volume, muted: settings.muted, repeat: settings.repeat,
  };
  os.storage.set('state', payload).catch(() => {});
}
async function restoreState() {
  if (!useSdk || !window.os || !os.storage) { await scanDir(dir); return; }
  try {
    const s = (await os.storage.get('state')) || null;
    if (s && typeof s === 'object') {
      if (typeof s.volume === 'number') settings.volume = s.volume;
      if (typeof s.muted === 'boolean') settings.muted = s.muted;
      if (s.repeat) settings.repeat = s.repeat;
      if (s.dir) dir = s.dir;
      syncAll();
      await scanDir(dir);
      if (s.currentName) {
        const idx = tracks.findIndex((t) => t.name === s.currentName);
        if (idx >= 0) {
          await playIndex(idx);
          const media = activeEl();
          if (media && typeof s.position === 'number') {
            const cb = () => { try { media.currentTime = s.position; } catch (e) {} };
            media.addEventListener('loadedmetadata', cb, { once: true });
            if (media.readyState >= 1) cb();
          }
        }
      }
    } else {
      await scanDir(dir);
    }
  } catch (e) { await scanDir(dir); }
}
async function openFromFs() {
  if (!useSdk || !window.os || !os.dialog) { say('SDK indisponível.'); return; }
  const p = await os.dialog.open({ title: 'Abrir ficheiro multimédia', start: dir, filter: [...EXT_AUDIO, ...EXT_VIDEO] });
  if (!p) return;
  if (!tracks.some((t) => t.path === p)) {
    let name = p.split('/').pop();
    let size = 0; let mime = 'application/octet-stream';
    try { const st = await os.fs.stat(p); size = st.size || 0; mime = st.mime || mime; } catch (e) {}
    tracks.push({ name, path: p, size, mime, type: 'fs' });
    renderPlaylist();
  }
  const idx = tracks.findIndex((t) => t.path === p);
  if (idx >= 0) await playIndex(idx);
}

  media.addEventListener('pause', update);
  media.addEventListener('ended', () => {
    updateTransport(media);
    let nextIdx = current + 1;
    if (nextIdx >= tracks.length) {
      nextIdx = 0;
    }
    if (tracks.length && nextIdx < tracks.length) playIndex(nextIdx);
    else { say('Fim da lista.'); }
  });
  media.addEventListener('error', () => say('Erro ao reproduzir o ficheiro.', 'error'));
}

// ---- wiring ----
function wire() {
  const fileInput = $('file');
  if (fileInput) fileInput.addEventListener('change', (e) => { importFiles(e.target.files); e.target.value = ''; });
  const openBtn = $('openFs');
  if (openBtn) openBtn.addEventListener('click', openFromFs);
  const playBtn = $('play');
  if (playBtn) playBtn.addEventListener('click', () => {
    const m = activeEl(); if (!m || !m.src) return;
    if (m.paused) m.play().catch(() => {}); else m.pause();
  });
  const prevBtn = $('prev');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (!tracks.length) return;
    playIndex((current - 1 + tracks.length) % tracks.length);
  });
  const nextBtn = $('next');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (!tracks.length) return;
    playIndex((current + 1) % tracks.length);
  });
  const b5 = $('back5'); if (b5) b5.addEventListener('click', () => { const m = activeEl(); if (m) seekTo((m.currentTime || 0) - 5); });
  const f5 = $('fwd5'); if (f5) f5.addEventListener('click', () => { const m = activeEl(); if (m) seekTo((m.currentTime || 0) + 5); });
  const seek = $('seek'); if (seek) seek.addEventListener('input', (e) => seekTo(e.target.value));
  const vol = $('volume'); if (vol) vol.addEventListener('input', (e) => { settings.volume = Number(e.target.value) || 0; syncAll(); persistState(false); });
  const muteBtn = $('mute'); if (muteBtn) muteBtn.addEventListener('click', () => { settings.muted = !settings.muted; syncAll(); persistState(false); });
  const clearBtn = $('clearPl');
  if (clearBtn) clearBtn.addEventListener('click', async () => {
    if (useSdk && window.os && os.dialog) {
      const ok = await os.dialog.confirm({ title: 'Limpar lista', message: 'Remover todas as faixas da lista de reprodução?', okLabel: 'Limpar', danger: true });
      if (!ok) return;
    }
    tracks = []; current = -1; revokeUrl();
    [audioEl, videoEl].forEach((m) => { try { m.pause(); m.removeAttribute('src'); m.load(); } catch (e) {} });
    hideMedia();
    renderPlaylist();
    persistState(true);
  });
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const m = activeEl();
    if (e.code === 'Space') { e.preventDefault(); if (m && m.src) { if (m.paused) m.play().catch(()=>{}); else m.pause(); } }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (m) seekTo((m.currentTime || 0) - 5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (m) seekTo((m.currentTime || 0) + 5); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); settings.volume = Math.min(1, settings.volume + 0.05); syncAll(); persistState(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); settings.volume = Math.max(0, settings.volume - 0.05); syncAll(); persistState(false); }
    else if (e.key && e.key.toLowerCase() === 'm') { settings.muted = !settings.muted; syncAll(); persistState(false); }
    else if (e.key && e.key.toLowerCase() === 'n') { if (tracks.length) playIndex((current + 1) % tracks.length); }
    else if (e.key && e.key.toLowerCase() === 'p') { if (tracks.length) playIndex((current - 1 + tracks.length) % tracks.length); }
  });
  setInterval(() => persistState(false), 5000);
  document.addEventListener('pagehide', () => { persistState(true); revokeUrl(); });
  if (useSdk && window.os) {
    if (typeof os.on === 'function') {
      os.on('fs:changed', () => { if (tracks.length) scanDir(dir).catch(() => {}); });
    }
    if (os.i18n && typeof os.i18n.onChange === 'function') {
      os.i18n.onChange(() => { document.title = os.i18n.t('Leitor Multimédia'); });
    }
  }
}
async function boot() {
    useSdk = !!(window.os && window.os.window);
  try { home = useSdk ? await os.fs.home() : '/home/user'; } catch (e) { home = '/home/user'; }
  dir = (home === '/home/user' ? '/home/user/Música' : home + '/Música');
  syncAll();
  wire();
  if (useSdk && window.os && os.fs) {
    try { await os.fs.mkdir(dir).catch(() => {}); } catch (e) {}
    let fileArg = null;
    try { const a = await os.args(); if (a && a.path) fileArg = a.path; } catch (e) {}
    if (fileArg) {
      const folder = fileArg.split('/').slice(0, -1).join('/') || dir;
      dir = folder;
      await scanDir(dir);
      const idx = tracks.findIndex((t) => t.path === fileArg);
      if (idx >= 0) await playIndex(idx);
    } else {
      await restoreState();
    }
  } else {
    hideMedia();
  }
}
function whenReady(fn) {
  if (window.os && window.os.window) return fn();
  let tries = 0;
  const iv = setInterval(() => {
    if (window.os && window.os.window) { clearInterval(iv); fn(); }
    else if (++tries > 50) { clearInterval(iv); fn(); }
  }, 100);
}
whenReady(boot);

