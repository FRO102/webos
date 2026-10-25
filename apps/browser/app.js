const $ = id => document.getElementById(id);

const state = {
  currentUrl: 'about:home',
  history: [],
  historyIndex: -1,
  bookmarks: [],
  prefs: { searchEngine: 'duckduckgo' },
  blockedTimer: null,
  isLoading: false,
};

const frame = $('frame');
const addr = $('addr');
const msg = $('msg');

const STORAGE = { history: 'browser:history:v1', bookmarks: 'browser:bookmarks:v1' };
const LIMITS = { history: 300, bookmarks: 200 };
const ENGINES = {
  duckduckgo: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  google: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  bing: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
};

function t(value) { return (window.os && os.i18n && typeof os.i18n.t === 'function') ? os.i18n.t(String(value)) : String(value); }

async function storageGet(key) {
  if (window.os && os.storage && typeof os.storage.get === 'function') {
    try { return await os.storage.get(key); } catch (e) { return null; }
  }
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
async function storageSet(key, value) {
  if (window.os && os.storage && typeof os.storage.set === 'function') {
    try { await os.storage.set(key, value); return; } catch (e) { /* fallthrough */ }
  }
  try { localStorage.setItem(key, value); } catch (e) { /* noop */ }
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (e) { return fallback; }
}

async function hydrate() {
  const [h, b] = await Promise.all([storageGet(STORAGE.history), storageGet(STORAGE.bookmarks)]);
  state.history = parseJson(h, []);
  state.historyIndex = state.history.length ? state.history.length - 1 : -1;
  state.bookmarks = parseJson(b, []);
}

function normalizeUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return 'about:home';
  if (/^about:/i.test(value)) return value.toLowerCase();
  if (/^file:/i.test(value)) return 'file:' + value.slice(5).trim();
  if (/^(https?|mailto|tel|ftp):/i.test(value)) return value;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/.*)?$/i.test(value) || /^localhost(:\d+)?(\/.*)?$/i.test(value)) return 'https://' + value;
  const engine = ENGINES[state.prefs.searchEngine] || ENGINES.duckduckgo;
  return engine(value);
}

function isDangerousScheme(url) {
  return /^(javascript|data|vbscript|blob):/i.test(String(url ?? '').trim());
}

function setStatus(message, kind) {
  msg.textContent = message || '';
  msg.dataset.state = kind || 'info';
}

function updateButtons() {
  $('back').disabled = state.historyIndex <= 0;
  $('fwd').disabled = state.historyIndex >= state.history.length - 1;
  const btn = $('bookmark');
  const isBm = state.bookmarks.some(b => b.url === state.currentUrl);
  btn.textContent = isBm ? '★' : '☆';
  btn.setAttribute('aria-pressed', String(isBm));
  $('external').disabled = !/^https?:/i.test(state.currentUrl);
}

async function setTitleWebOS(value) {
  if (window.os && os.window && typeof os.window.setTitle === 'function') {
    try { await os.window.setTitle(String(value).slice(0, 80)); } catch (e) { /* noop */ }
  }
}

function hostOf(url) { try { return new URL(url).hostname; } catch (e) { return ''; } }
function baseName(p) { return String(p).split('/').filter(Boolean).pop() || p; }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
async function blobToText(blob) { if (blob instanceof Blob) return await blob.text(); return String(blob ?? ''); }
function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
function formatDate(v) { try { return os.i18n.date(v, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return new Date(v).toLocaleString(); } }

async function load(url) {
  if (state.blockedTimer) { clearTimeout(state.blockedTimer); state.blockedTimer = null; }
  $('frame-blocked').hidden = true;
  state.isLoading = true;
  setStatus(t('A carregar…'), 'loading');
  addr.value = (url === 'about:home') ? '' : url;
  state.currentUrl = url;

  if (url === 'about:home') {
    frame.hidden = true;
    $('home-page').hidden = false;
    frame.removeAttribute('src');
    frame.removeAttribute('srcdoc');
    await setTitleWebOS(t('Navegador'));
    setStatus('', 'info');
    state.isLoading = false;
    updateButtons();
    renderLists();
    return;
  }

  $('home-page').hidden = true;
  frame.hidden = false;

  if (url.startsWith('file:')) { await loadFile(url.slice(5)); return; }

  frame.sandbox = 'allow-scripts allow-forms allow-popups allow-same-origin allow-downloads';
  frame.referrerPolicy = 'no-referrer';
  frame.removeAttribute('srcdoc');
  frame.src = url;
  state.blockedTimer = setTimeout(() => {
    if (state.isLoading) { $('frame-blocked').hidden = false; setStatus(t('A página pode não permitir incorporação.'), 'info'); }
  }, 12000);
  await setTitleWebOS(hostOf(url) || t('Navegador'));
}

async function loadFile(path) {
  try {
    const stat = (window.os && os.fs && os.fs.stat) ? await os.fs.stat(path).catch(() => null) : null;
    const lower = String(path).toLowerCase();
    if (/\.(html?|xhtml)$/i.test(lower)) {
      const html = await os.fs.read(path);
      frame.sandbox = 'allow-scripts allow-forms';
      frame.srcdoc = String(html ?? '');
    } else if (/\.(md|txt|json|csv|js|css|log)$/i.test(lower)) {
      const content = await os.fs.read(path);
      const text = typeof content === 'string' ? content : await blobToText(content);
      frame.sandbox = '';
      frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font:14px/1.5 ui-monospace,monospace;margin:16px;white-space:pre-wrap;word-break:break-word;color:#1c2a33;background:#fff;}h1{font:inherit;font-weight:700;margin:0 0 12px;}</style></head><body><h1>${escapeHtml(baseName(path))}</h1><pre>${escapeHtml(text)}</pre></body></html>`;
    } else if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lower)) {
      let src = '';
      try { const data = await os.fs.read(path); const blob = data instanceof Blob ? data : new Blob([data]); src = URL.createObjectURL(blob); } catch (e) { src = ''; }
      frame.sandbox = '';
      frame.srcdoc = `<!DOCTYPE html><html><body style="display:grid;place-items:center;margin:0;background:#111;"><img src="${src}" style="max-width:100%;max-height:100vh;" alt="${escapeHtml(baseName(path))}"></body></html>`;
    } else {
      const meta = stat ? `${baseName(path)} — ${formatBytes(stat.size)}` : baseName(path);
      frame.sandbox = '';
      frame.srcdoc = `<!DOCTYPE html><html><body style="font:14px system-ui;margin:24px;color:#1c2a33;"><h1>${escapeHtml(baseName(path))}</h1><p>${escapeHtml(meta)}</p><p>Pré-visualização não disponível. Usa “Abrir com” no Explorador.</p></body></html>`;
    }
    setStatus('', 'info');
    state.isLoading = false;
    await setTitleWebOS(baseName(path));
    recordHistory(state.currentUrl);
    updateButtons();
  } catch (e) {
    frame.hidden = false;
    $('home-page').hidden = true;
    setStatus(e && e.message ? e.message : t('Não foi possível ler o ficheiro.'), 'error');
    state.isLoading = false;
  }
}

function recordHistory(url) {
  if (url === 'about:home') return;
  const entry = { url, title: safeTitle(), visitedAt: new Date().toISOString() };
  if (state.historyIndex >= 0 && state.historyIndex < state.history.length - 1) state.history = state.history.slice(0, state.historyIndex + 1);
  const last = state.history[state.history.length - 1];
  if (!last || last.url !== url) {
    state.history.push(entry);
    if (state.history.length > LIMITS.history) state.history.splice(0, state.history.length - LIMITS.history);
    state.historyIndex = state.history.length - 1;
  } else state.history[state.historyIndex] = entry;
  storageSet(STORAGE.history, JSON.stringify(state.history));
  updateButtons();
  renderHistory();
}
function safeTitle() { try { if (frame.contentDocument && frame.contentDocument.title) return frame.contentDocument.title; } catch (e) {} return hostOf(state.currentUrl) || state.currentUrl; }

function isBookmarked(url) { return state.bookmarks.some(b => b.url === url); }
function toggleBookmark() {
  const url = state.currentUrl;
  if (url === 'about:home') { setStatus(t('Não é possível guardar a página inicial.'), 'info'); return; }
  const idx = state.bookmarks.findIndex(b => b.url === url);
  if (idx >= 0) state.bookmarks.splice(idx, 1);
  else { state.bookmarks.unshift({ url, title: hostOf(url) || url, addedAt: new Date().toISOString() }); if (state.bookmarks.length > LIMITS.bookmarks) state.bookmarks.splice(LIMITS.bookmarks); }
  storageSet(STORAGE.bookmarks, JSON.stringify(state.bookmarks));
  updateButtons();
  renderBookmarks();
}
function removeBookmark(url) {
  const idx = state.bookmarks.findIndex(b => b.url === url);
  if (idx >= 0) state.bookmarks.splice(idx, 1);
  storageSet(STORAGE.bookmarks, JSON.stringify(state.bookmarks));
  updateButtons();
  renderBookmarks();
}

function renderBookmarks() {
  const list = $('bookmarks-list');
  list.replaceChildren();
  if (!state.bookmarks.length) { $('bookmarks-empty').hidden = false; return; }
  $('bookmarks-empty').hidden = true;
  state.bookmarks.forEach(b => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'item'; btn.type = 'button';
    const title = document.createElement('span'); title.className = 'item-title'; title.textContent = b.title || hostOf(b.url) || b.url;
    const meta = document.createElement('span'); meta.className = 'item-meta'; meta.textContent = b.url;
    const remove = document.createElement('button'); remove.className = 'item-remove'; remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', t('Remover'));
    remove.addEventListener('click', e => { e.stopPropagation(); removeBookmark(b.url); });
    btn.addEventListener('click', () => nav(b.url));
    btn.append(title, meta, remove);
    li.append(btn);
    list.append(li);
  });
}

function renderHistory() {
  const filter = ($('history-filter').value || '').toLowerCase();
  const list = $('history-list');
  list.replaceChildren();
  const items = state.history.slice().reverse().filter(h => !filter || String(h.url).toLowerCase().includes(filter) || String(h.title).toLowerCase().includes(filter));
  if (!items.length) { $('history-empty').hidden = false; return; }
  $('history-empty').hidden = true;
  items.forEach(h => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'item'; btn.type = 'button';
    const title = document.createElement('span'); title.className = 'item-title'; title.textContent = h.title || hostOf(h.url) || h.url;
    const meta = document.createElement('span'); meta.className = 'item-meta'; meta.textContent = `${h.url} · ${formatDate(h.visitedAt)}`;
    btn.addEventListener('click', () => nav(h.url));
    btn.append(title, meta);
    li.append(btn);
    list.append(li);
  });
}
function renderLists() { renderBookmarks(); renderHistory(); }

async function handleArgs() {
  if (!(window.os && os.args)) return false;
  try { const args = await os.args(); if (args && args.path) { nav('file:' + args.path); return true; } } catch (e) { /* noop */ }
  return false;
}

function nav(url) {
  const target = isDangerousScheme(url) ? '' : normalizeUrl(url);
  if (!target) { setStatus(t('Endereço bloqueado por segurança.'), 'error'); return; }
  if (state.historyIndex >= 0 && state.history[state.historyIndex]?.url === target) { load(target); updateButtons(); return; }
  if (state.historyIndex < state.history.length - 1) state.history = state.history.slice(0, state.historyIndex + 1);
  state.currentUrl = target;
  load(target);
  updateButtons();
}

$('back').onclick = () => {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    const entry = state.history[state.historyIndex];
    if (entry) { state.currentUrl = entry.url; load(entry.url); }
    updateButtons();
  }
};
$('fwd').onclick = () => {
  if (state.historyIndex < state.history.length - 1) {
    state.historyIndex++;
    const entry = state.history[state.historyIndex];
    if (entry) { state.currentUrl = entry.url; load(entry.url); }
    updateButtons();
  }
};
$('reload').onclick = () => load(state.currentUrl);
$('stop').onclick = () => { try { frame.contentWindow && frame.contentWindow.stop && frame.contentWindow.stop(); } catch (e) {} state.isLoading = false; clearTimeout(state.blockedTimer); state.blockedTimer = null; setStatus(t('Carregamento interrompido.'), 'info'); };
$('home').onclick = () => nav('about:home');
$('go').onclick = () => nav(addr.value.trim());
addr.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nav(addr.value.trim()); } });
$('external').onclick = async () => {
  const url = state.currentUrl;
  if (!/^https?:/i.test(url)) return;
  try {
    if (window.os && os.external && typeof os.external.open === 'function') await os.external.open(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
    setStatus(t('Aberto no navegador do sistema.'), 'success');
  } catch (e) {
    setStatus((window.os && os.errors && os.errors.message) ? os.errors.message(e, t('Não foi possível abrir externamente.')) : t('Não foi possível abrir externamente.'), 'error');
  }
};
$('blocked-external').onclick = () => $('external').click();
$('bookmark').onclick = toggleBookmark;

$('home-go').onclick = () => nav($('home-query').value.trim() || 'about:home');
$('home-query').addEventListener('keydown', e => { if (e.key === 'Enter') $('home-go').click(); });

document.querySelectorAll('[data-url]').forEach(button => button.addEventListener('click', () => nav(button.dataset.url)));

$('clear-bookmarks').onclick = async () => {
  const ok = (window.os && os.dialog) ? await os.dialog.confirm({ title: t('Limpar favoritos'), message: t('Remover todos os favoritos?'), okLabel: t('Limpar'), danger: true }) : confirm(t('Remover todos os favoritos?'));
  if (!ok) return;
  state.bookmarks = [];
  storageSet(STORAGE.bookmarks, JSON.stringify(state.bookmarks));
  updateButtons();
  renderBookmarks();
};
$('export-bookmarks').onclick = async () => {
  if (!window.os || !os.dialog || !os.fs) { setStatus(t('Exportação indisponível.'), 'error'); return; }
  const path = await os.dialog.save({ title: t('Exportar favoritos'), defaultName: 'favoritos-browser.json', start: '/home/user/Documentos/' });
  if (!path) return;
  try { await os.fs.write(path, JSON.stringify(state.bookmarks, null, 2), 'application/json'); setStatus(t('Favoritos exportados.'), 'success'); }
  catch (e) { setStatus((window.os && os.errors && os.errors.message) ? os.errors.message(e, t('Falha ao exportar.')) : t('Falha ao exportar.'), 'error'); }
};
$('import-bookmarks').onclick = async () => {
  if (!window.os || !os.dialog || !os.fs) { setStatus(t('Importação indisponível.'), 'error'); return; }
  const path = await os.dialog.open({ title: t('Importar favoritos'), start: '/home/user/Documentos/' });
  if (!path) return;
  try {
    const content = await os.fs.read(path);
    const data = parseJson(typeof content === 'string' ? content : await blobToText(content), null);
    if (Array.isArray(data)) {
      const urls = new Set(state.bookmarks.map(b => b.url));
      data.forEach(d => { if (d && d.url && !urls.has(d.url)) { state.bookmarks.push(d); urls.add(d.url); } });
      if (state.bookmarks.length > LIMITS.bookmarks) state.bookmarks.splice(LIMITS.bookmarks);
      storageSet(STORAGE.bookmarks, JSON.stringify(state.bookmarks));
      updateButtons();
      renderBookmarks();
      setStatus(t('Favoritos importados.'), 'success');
    } else setStatus(t('Ficheiro inválido.'), 'error');
  } catch (e) { setStatus(t('Falha ao importar.'), 'error'); }
};
$('history-filter').addEventListener('input', renderHistory);
$('clear-history').onclick = async () => {
  const ok = (window.os && os.dialog) ? await os.dialog.confirm({ title: t('Limpar histórico'), message: t('Remover todo o histórico de navegação?'), okLabel: t('Limpar'), danger: true }) : confirm(t('Remover todo o histórico?'));
  if (!ok) return;
  state.history = [];
  state.historyIndex = -1;
  storageSet(STORAGE.history, JSON.stringify(state.history));
  updateButtons();
  renderHistory();
};

document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); addr.focus(); addr.select(); }
  if (ctrl && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); toggleBookmark(); }
  if (e.key === 'F5' || (ctrl && (e.key === 'r' || e.key === 'R'))) { e.preventDefault(); $('reload').click(); }
  if (e.key === 'Escape') { $('stop').click(); }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); $('back').click(); }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); $('fwd').click(); }
});

function applyI18n() {
  if (window.os && os.i18n && typeof os.i18n.apply === 'function') {
    try { os.i18n.apply(document.body); } catch (e) { /* noop */ }
  }
}

frame.addEventListener('load', () => {
  if (state.isLoading) {
    state.isLoading = false;
    clearTimeout(state.blockedTimer); state.blockedTimer = null;
    if (String(msg.textContent).startsWith('A carregar')) setStatus('', 'info');
  }
  try {
    const docTitle = frame.contentDocument && frame.contentDocument.title;
    if (docTitle && state.currentUrl !== 'about:home') setTitleWebOS(docTitle);
  } catch (e) { /* cross-origin, keep host */ }
  recordHistory(state.currentUrl);
  updateButtons();
});

async function init() {
  await hydrate();
  renderLists();
  const handled = await handleArgs();
  if (!handled) nav('about:home');
  applyI18n();
  if (window.os && os.i18n && typeof os.i18n.onChange === 'function') os.i18n.onChange(() => applyI18n());
}

init();

