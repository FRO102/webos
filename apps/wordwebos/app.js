(function () {
  'use strict';

  const DRAFTS_KEY = 'drafts';
  const LEGACY_DRAFT_KEY = 'draft';
  const SAVE_DEBOUNCE_MS = 800;
  const MIN_ZOOM = 50;
  const MAX_ZOOM = 200;
  const ZOOM_STEP = 10;
  const WORDS_PER_PAGE_ESTIMATE = 500;

  const state = {
    path: null,
    docName: 'Documento sem título',
    dirty: false,
    zoom: 100,
    layout: 'print',
    activeTab: 'home',
    saving: false,
    saveTimer: null,
    statusTimer: null,
    revision: 0
  };

  let editor;
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    bindTabs();
    bindRibbon();
    bindFileMenu();
    bindInsertMenu();
    bindViewMenu();
    bindFindBar();
    bindEditorEvents();
    bindKeyboard();
    setupI18n();
    setupExternalListeners();
    setLayout('print');
    setZoom(100);

    await initializeDocument();

    if (!editor.innerHTML.trim()) {
      editor.innerHTML = '<p><br></p>';
    }
    updateStatus();
    updateToolbarState();
    updateWindowTitle();
    updateSaveState(state.dirty ? 'draft' : 'saved');
  }

  // ---------------------------------------------------------------- elements

  function cacheElements() {
    editor = document.getElementById('editor');
    els.app = document.querySelector('.app');
    els.page = document.getElementById('page');
    els.editorArea = document.getElementById('editorArea');
    els.tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    els.panels = Array.from(document.querySelectorAll('[data-panel]'));

    els.heading = document.getElementById('heading');
    els.fontFamily = document.getElementById('fontFamily');
    els.fontSize = document.getElementById('fontSize');
    els.textColorBtn = document.getElementById('textColorBtn');
    els.textColorSwatch = document.getElementById('textColorSwatch');
    els.textColorInput = document.getElementById('textColorInput');
    els.highlightBtn = document.getElementById('highlightBtn');
    els.highlightSwatch = document.getElementById('highlightSwatch');
    els.highlightInput = document.getElementById('highlightInput');

    els.statusPath = document.getElementById('statusPath');
    els.statusMessage = document.getElementById('statusMessage');
    els.saveState = document.getElementById('saveState');
    els.wordCount = document.getElementById('wordCount');
    els.pageCount = document.getElementById('pageCount');
    els.zoomValue = document.getElementById('zoomValue');

    els.findBar = document.getElementById('findBar');
    els.findInput = document.getElementById('findInput');
    els.replaceInput = document.getElementById('replaceInput');
    els.findPrev = document.getElementById('findPrev');
    els.findNext = document.getElementById('findNext');
    els.replaceAll = document.getElementById('replaceAll');
    els.findClose = document.getElementById('findClose');
  }

  // ---------------------------------------------------------------- i18n

  function setupI18n() {
    if (!window.os || !os.i18n) return;
    try { os.i18n.apply(document.body); } catch (e) {}
    if (typeof os.i18n.onChange === 'function') {
      os.i18n.onChange(() => {
        try { os.i18n.apply(document.body); } catch (e) {}
        updateStatus();
      });
    }
  }

  function t(text) {
    if (window.os && os.i18n && typeof os.i18n.t === 'function') {
      try { return os.i18n.t(text); } catch (e) { return text; }
    }
    return text;
  }

  function errorMessage(err, fallback) {
    if (window.os && os.errors && typeof os.errors.message === 'function') {
      try { return os.errors.message(err, fallback); } catch (e) { /* noop */ }
    }
    return fallback;
  }

  // ---------------------------------------------------------------- tabs

  function bindTabs() {
    els.tabs.forEach(tab => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
      tab.addEventListener('keydown', onTabKey);
    });
  }

  function onTabKey(e) {
    const idx = els.tabs.indexOf(e.currentTarget);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % els.tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + els.tabs.length) % els.tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = els.tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      activateTab(els.tabs[next].dataset.tab);
      els.tabs[next].focus();
    }
  }

  function activateTab(name) {
    state.activeTab = name;
    els.tabs.forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    els.panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
  }

  // ---------------------------------------------------------------- ribbon

  const COMMANDS = {
    undo: 'undo',
    redo: 'redo',
    bold: 'bold',
    italic: 'italic',
    underline: 'underline',
    strikeThrough: 'strikeThrough',
    justifyLeft: 'justifyLeft',
    justifyCenter: 'justifyCenter',
    justifyRight: 'justifyRight',
    justifyFull: 'justifyFull',
    insertUnorderedList: 'insertUnorderedList',
    insertOrderedList: 'insertOrderedList',
    outdent: 'outdent',
    indent: 'indent',
    removeFormat: 'removeFormat',
    insertHorizontalRule: 'insertHorizontalRule'
  };

  function bindRibbon() {
    document.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', preventFocusLoss);
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        if (COMMANDS[cmd]) runCommand(COMMANDS[cmd]);
      });
    });

    els.heading.addEventListener('change', () => applyHeading(els.heading.value));
    document.querySelectorAll('[data-style]').forEach(btn => {
      btn.addEventListener('click', () => applyParagraphStyle(btn.dataset.style));
    });
    els.fontFamily.addEventListener('change', () => applyFontFamily(els.fontFamily.value));
    els.fontSize.addEventListener('change', () => applyFontSize(Number(els.fontSize.value)));

    els.textColorBtn.addEventListener('mousedown', preventFocusLoss);
    els.textColorBtn.addEventListener('click', () => els.textColorInput.click());
    els.textColorInput.addEventListener('input', () => {
      els.textColorSwatch.style.background = els.textColorInput.value;
      runCommand('foreColor', els.textColorInput.value);
    });

    els.highlightBtn.addEventListener('mousedown', preventFocusLoss);
    els.highlightBtn.addEventListener('click', () => els.highlightInput.click());
    els.highlightInput.addEventListener('input', () => {
      els.highlightSwatch.style.background = els.highlightInput.value;
      runCommand('hiliteColor', els.highlightInput.value);
    });
  }

  function preventFocusLoss(e) { e.preventDefault(); }

  function runCommand(cmd, value = null) {
    editor.focus();
    try {
      document.execCommand(cmd, false, value);
    } catch (err) {
      console.warn('WordWebos: comando falhou', cmd, err);
    }
    onEditorChanged();
    updateToolbarState();
  }

  function applyHeading(tag) {
    applyParagraphStyle(tag);
  }

  function applyParagraphStyle(style) {
    const normalized = String(style || 'p').toLowerCase();
    const tag = normalized === 'normal' ? 'p' : normalized === 'quote' ? 'blockquote' : normalized;
    editor.focus();
    try {
      document.execCommand('formatBlock', false, '<' + tag + '>');
    } catch (err) {
      try {
        const selected = window.getSelection() && window.getSelection().toString() ? window.getSelection().toString() : ' ';
        document.execCommand('insertHTML', false, '<' + tag + '>' + escapeHtml(selected) + '</' + tag + '>');
      } catch (e) { /* noop */ }
    }
    onEditorChanged();
  }

  function applyFontFamily(family) {
    editor.focus();
    try {
      document.execCommand('fontName', false, family);
    } catch (err) { /* noop */ }
    onEditorChanged();
  }

  function applyFontSize(pt) {
    editor.focus();
    const TMP = 7;
    try {
      document.execCommand('fontSize', false, String(TMP));
    } catch (err) { return; }

    const fonts = editor.querySelectorAll('font[size="' + TMP + '"]');
    fonts.forEach(f => {
      const span = document.createElement('span');
      span.style.fontSize = pt + 'pt';
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    onEditorChanged();
  }

  function updateToolbarState() {
    const stateMap = {
      bold: 'bold',
      italic: 'italic',
      underline: 'underline',
      strikeThrough: 'strikeThrough',
      justifyLeft: 'justifyLeft',
      justifyCenter: 'justifyCenter',
      justifyRight: 'justifyRight',
      justifyFull: 'justifyFull',
      insertUnorderedList: 'insertUnorderedList',
      insertOrderedList: 'insertOrderedList'
    };
    for (const [cmd, qc] of Object.entries(stateMap)) {
      const btn = document.querySelector('[data-cmd="' + cmd + '"]');
      if (!btn) continue;
      let active = false;
      try { active = document.queryCommandState(qc); } catch (e) {}
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    const undoBtn = document.querySelector('[data-cmd="undo"]');
    const redoBtn = document.querySelector('[data-cmd="redo"]');
    if (undoBtn) undoBtn.disabled = !canUndo();
    if (redoBtn) redoBtn.disabled = !canRedo();

    try {
      const fontName = document.queryCommandValue('fontName') || 'Calibri';
      const normalized = normalizeFontName(fontName);
      if (els.fontFamily && normalized) {
        const options = Array.from(els.fontFamily.options).map(option => option.value.toLowerCase());
        const index = options.findIndex(value => value.includes(normalized.toLowerCase()));
        if (index >= 0) els.fontFamily.value = els.fontFamily.options[index].value;
      }
    } catch (e) { /* noop */ }

    try {
      const size = document.queryCommandValue('fontSize');
      if (size && els.fontSize) {
        const value = String(size).replace(/px|pt|/gi, '');
        const numeric = Number(value);
        if (!Number.isNaN(numeric) && numeric >= 8) {
          const match = Array.from(els.fontSize.options).find(option => Number(option.value) === numeric || Number(option.value) >= numeric);
          if (match) els.fontSize.value = match.value;
        }
      }
    } catch (e) { /* noop */ }
  }

  function normalizeFontName(name) {
    const value = String(name || '').toLowerCase();
    if (!value) return 'Calibri';
    if (value.includes('calibri')) return 'Calibri';
    if (value.includes('cambria')) return 'Cambria';
    if (value.includes('segoe')) return 'Segoe UI';
    if (value.includes('arial')) return 'Arial';
    if (value.includes('times')) return 'Times New Roman';
    if (value.includes('georgia')) return 'Georgia';
    if (value.includes('courier')) return 'Courier New';
    return value;
  }

  function canUndo() {
    try { return document.queryCommandEnabled('undo'); } catch (e) { return true; }
  }
  function canRedo() {
    try { return document.queryCommandEnabled('redo'); } catch (e) { return true; }
  }

  // ---------------------------------------------------------------- file menu

  function bindFileMenu() {
    document.getElementById('menuNew').addEventListener('click', newDocument);
    document.getElementById('menuOpen').addEventListener('click', openDocument);
    document.getElementById('menuSave').addEventListener('click', () => saveDocument(false));
    document.getElementById('menuSaveAs').addEventListener('click', () => saveDocument(true));
    document.getElementById('menuExportTxt').addEventListener('click', exportTxt);
    document.getElementById('menuPrint').addEventListener('click', () => {
      try { window.print(); } catch (e) { /* noop */ }
    });
  }

  async function newDocument() {
    if (state.dirty) {
      const ok = await confirmDiscard();
      if (!ok) return;
    }
    cancelDraftSave();
    await removeDraft(state.path);
    editor.innerHTML = '<p><br></p>';
    state.path = null;
    state.docName = 'Documento sem título';
    state.dirty = false;
    state.revision++;
    updateStatus();
    updateWindowTitle();
    updateSaveState('saved');
    setStatus(t('Novo documento'), 'info');
  }

  async function openDocument() {
    if (state.dirty) {
      const ok = await confirmDiscard();
      if (!ok) return;
    }
    if (!window.os || !os.dialog || !os.dialog.open) {
      setStatus(t('SDK indisponível.'), 'error');
      return;
    }
    let path;
    try {
      path = await os.dialog.open({
        title: t('Abrir documento'),
        type: 'file',
        select: 'file',
        directory: false,
        start: '/home/user/Documentos/',
        filter: ['.html', '.htm', '.txt']
      });
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao abrir.')), 'error');
      return;
    }
    if (!path) return;
    const previousPath = state.path;
    if (path === previousPath) await removeDraft(path);
    const opened = await openFile(path, { restoreDraft: path !== previousPath });
    if (opened && path !== previousPath) await removeDraft(previousPath);
  }

  async function openFile(path, options = {}) {
    cancelDraftSave();
    if (options.restoreDraft) {
      const draft = await getDraft(path);
      if (draft) {
        applyDraft(draft);
        return true;
      }
    }
    let content;
    try {
      content = await os.fs.read(path);
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao ler o ficheiro.')), 'error');
      if (state.dirty) scheduleDraftSave();
      return false;
    }

    const text = typeof content === 'string' ? content : '';
    const lower = path.toLowerCase();
    const html = (lower.endsWith('.html') || lower.endsWith('.htm'))
      ? extractBodyFromHtml(text)
      : plainTextToHtml(text);

    editor.innerHTML = sanitizeHtml(html) || '<p><br></p>';
    state.path = path;
    state.docName = basename(path);
    state.dirty = false;
    state.revision++;
    await removeDraft(path);

    updateStatus();
    updateWindowTitle();
    updateSaveState('saved');
    setStatus(t('Aberto') + ': ' + path, 'success');
    return true;
  }

  async function saveDocument(saveAs) {
    if (!state.path || saveAs) {
      return saveAsDocument();
    }
    return writeTo(state.path);
  }

  async function saveAsDocument() {
    if (!window.os || !os.dialog || !os.dialog.save) {
      setStatus(t('SDK indisponível.'), 'error');
      return;
    }
    let defaultName = state.docName;
    if (!/\.[^.]+$/.test(defaultName)) defaultName += '.html';

    let path;
    try {
      path = await os.dialog.save({
        title: t('Guardar documento'),
        start: '/home/user/Documentos/',
        defaultName: defaultName
      });
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao guardar.')), 'error');
      return;
    }
    if (!path) return;
    if (!/\.(html?|txt)$/i.test(path)) {
      if (/\.[^.]+$/.test(path)) {
        setStatus(t('Formato não suportado. Usa .html, .htm ou .txt.'), 'error');
        return;
      }
      path += '.html';
    }
    if (path !== state.path) {
      const existingDraft = await getDraft(path);
      if (existingDraft) {
        const discard = await os.dialog.confirm({
          title: t('Rascunho existente'),
          message: t('Este destino tem alterações não guardadas. Substituir esse rascunho?'),
          okLabel: t('Substituir'),
          danger: true
        });
        if (!discard) return;
      }
    }
    await writeTo(path);
  }

  async function writeTo(path) {
    if (state.saving) return;
    cancelDraftSave();
    const revision = state.revision;
    const previousPath = state.path;
    const lower = path.toLowerCase();
    let content, mime;

    if (lower.endsWith('.txt')) {
      content = editor.innerText || '';
      mime = 'text/plain';
    } else {
      content = buildHtmlDocument(sanitizeHtml(editor.innerHTML), basename(path));
      mime = 'text/html';
    }

    state.saving = true;
    setStatus(t('A guardar…'), 'info');
    updateSaveState('unsaved');

    try {
      await os.fs.write(path, content, mime);
      state.path = path;
      state.docName = basename(path);
      state.dirty = state.revision !== revision;
      await removeDraft(previousPath);
      if (path !== previousPath) await removeDraft(path);
      updateWindowTitle();
      updateStatus();
      if (state.dirty) {
        updateSaveState('unsaved');
        scheduleDraftSave();
        setStatus(t('Guardado; existem novas alterações.'), 'info');
      } else {
        updateSaveState('saved');
        setStatus(t('Guardado') + ': ' + path, 'success');
      }
    } catch (err) {
      updateSaveState('unsaved');
      setStatus(errorMessage(err, t('Falha ao guardar.')), 'error');
    } finally {
      state.saving = false;
      if (state.dirty) scheduleDraftSave();
    }
  }

  async function exportTxt() {
    if (!window.os || !os.dialog || !os.dialog.save) {
      setStatus(t('SDK indisponível.'), 'error');
      return;
    }
    let defaultName = state.docName.replace(/\.[^.]+$/, '') + '.txt';
    let path;
    try {
      path = await os.dialog.save({
        title: t('Exportar como texto'),
        start: '/home/user/Documentos/',
        defaultName: defaultName
      });
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao exportar.')), 'error');
      return;
    }
    if (!path) return;
    if (!/\.txt$/i.test(path)) path += '.txt';

    const content = editor.innerText || '';
    try {
      await os.fs.write(path, content, 'text/plain');
      setStatus(t('Exportado') + ': ' + path, 'success');
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao exportar.')), 'error');
    }
  }

  async function confirmDiscard() {
    if (window.os && os.dialog && typeof os.dialog.confirm === 'function') {
      try {
        return await os.dialog.confirm({
          title: t('Descartar alterações?'),
          message: t('Existem alterações não guardadas. Se continuar, serão perdidas.'),
          okLabel: t('Descartar'),
          danger: true
        });
      } catch (err) { return false; }
    }
    try { return window.confirm(t('Descartar alterações não guardadas?')); }
    catch (err) { return false; }
  }

  // ---------------------------------------------------------------- insert menu

  function bindInsertMenu() {
    document.getElementById('insertTable').addEventListener('mousedown', preventFocusLoss);
    document.getElementById('insertTable').addEventListener('click', insertTable);

    document.getElementById('insertImage').addEventListener('mousedown', preventFocusLoss);
    document.getElementById('insertImage').addEventListener('click', insertImage);

    document.getElementById('insertDate').addEventListener('mousedown', preventFocusLoss);
    document.getElementById('insertDate').addEventListener('click', insertDate);

    document.getElementById('insertPageBreak').addEventListener('mousedown', preventFocusLoss);
    document.getElementById('insertPageBreak').addEventListener('click', insertPageBreak);

    document.getElementById('insertLink').addEventListener('mousedown', preventFocusLoss);
    document.getElementById('insertLink').addEventListener('click', insertLink);
  }

  function insertTable() {
    editor.focus();
    const rows = 3, cols = 3;
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td><br></td>';
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    try { document.execCommand('insertHTML', false, html); } catch (e) {}
    onEditorChanged();
  }

  function insertPageBreak() {
    editor.focus();
    try {
      document.execCommand('insertHTML', false, '<hr class="page-break"><p><br></p>');
    } catch (e) {}
    onEditorChanged();
  }

  function insertDate() {
    editor.focus();
    const dateStr = formatDate(new Date());
    try { document.execCommand('insertText', false, dateStr); } catch (e) {}
    onEditorChanged();
  }

  async function insertLink() {
    let url = '';
    if (window.os && os.dialog && typeof os.dialog.prompt === 'function') {
      try {
        url = await os.dialog.prompt({
          title: t('Inserir hiperligação'),
          message: t('Escreve a URL:'),
          defaultValue: 'https://',
          okLabel: t('Inserir')
        });
      } catch (err) {
        return;
      }
    } else {
      url = window.prompt(t('Escreve a URL:'), 'https://');
    }
    if (!url) return;

    const clean = String(url).trim();
    if (!clean) return;
    const resolved = /^https?:\/\//i.test(clean) || /^mailto:/i.test(clean) || /^tel:/i.test(clean) || clean.startsWith('#')
      ? clean
      : 'https://' + clean;

    editor.focus();
    try {
      document.execCommand('createLink', false, resolved);
    } catch (e) {
      try {
        const selection = window.getSelection();
        const selectionText = selection && selection.toString() ? selection.toString() : resolved;
        document.execCommand('insertHTML', false, '<a href="' + escapeHtml(resolved) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(selectionText) + '</a>');
      } catch (err) { /* noop */ }
    }
    onEditorChanged();
  }

  async function insertImage() {
    if (!window.os || !os.dialog || !os.fs) {
      setStatus(t('SDK indisponível.'), 'error');
      return;
    }
    const savedRange = saveSelection();
    let path;
    try {
      path = await os.dialog.open({
        title: t('Inserir imagem'),
        start: '/home/user/Imagens/',
        filter: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
      });
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao abrir.')), 'error');
      return;
    }
    if (!path) return;

    let content;
    try {
      content = await os.fs.read(path);
    } catch (err) {
      setStatus(errorMessage(err, t('Falha ao ler a imagem.')), 'error');
      return;
    }

    let dataUrl;
    try {
      dataUrl = await toDataUrl(content, path);
    } catch (err) {
      setStatus(t('Formato de imagem não suportado.'), 'error');
      return;
    }

    editor.focus();
    restoreSelection(savedRange);
    try { document.execCommand('insertImage', false, dataUrl); } catch (e) {}
    onEditorChanged();
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0).cloneRange();
  }

  function restoreSelection(range) {
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function toDataUrl(content, path) {
    const mime = guessImageMime(path);
    if (typeof content === 'string') {
      if (content.startsWith('data:')) return Promise.resolve(content);
      if (/^[A-Za-z0-9+/=\s]+$/.test(content) && content.length > 32) {
        return Promise.resolve('data:' + mime + ';base64,' + content.replace(/\s+/g, ''));
      }
      return Promise.resolve('data:' + mime + ';charset=utf-8,' + encodeURIComponent(content));
    }
    if (content instanceof Blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(content);
      });
    }
    return Promise.reject(new Error('unsupported'));
  }

  function guessImageMime(path) {
    const l = path.toLowerCase();
    if (l.endsWith('.png')) return 'image/png';
    if (l.endsWith('.jpg') || l.endsWith('.jpeg')) return 'image/jpeg';
    if (l.endsWith('.gif')) return 'image/gif';
    if (l.endsWith('.svg')) return 'image/svg+xml';
    if (l.endsWith('.webp')) return 'image/webp';
    return 'application/octet-stream';
  }

  // ---------------------------------------------------------------- view menu

  function bindViewMenu() {
    document.getElementById('zoomIn').addEventListener('click', () => setZoom(state.zoom + ZOOM_STEP));
    document.getElementById('zoomOut').addEventListener('click', () => setZoom(state.zoom - ZOOM_STEP));
    document.getElementById('zoomReset').addEventListener('click', () => setZoom(100));

    document.querySelectorAll('.layout-btn').forEach(btn => {
      btn.addEventListener('click', () => setLayout(btn.dataset.layout));
    });

    document.getElementById('toggleFullscreen').addEventListener('click', toggleFullscreen);
  }

  function setZoom(z) {
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(z)));
    state.zoom = z;
    els.page.style.zoom = (z / 100).toString();
    els.zoomValue.textContent = z + '%';
  }

  function setLayout(layout) {
    state.layout = layout;
    els.app.dataset.layout = layout;
    document.querySelectorAll('.layout-btn').forEach(btn => {
      btn.dataset.active = btn.dataset.layout === layout ? 'true' : 'false';
    });
  }

  async function toggleFullscreen() {
    if (!window.os || !os.shell || typeof os.shell.toggleFullscreen !== 'function') {
      setStatus(t('Modo ecrã inteiro indisponível.'), 'error');
      return;
    }
    try {
      await os.shell.toggleFullscreen();
    } catch (err) {
      setStatus(t('Modo ecrã inteiro indisponível.'), 'error');
    }
  }

  // ---------------------------------------------------------------- find bar

  function bindFindBar() {
    els.findNext.addEventListener('click', findNext);
    els.findPrev.addEventListener('click', findPrev);
    els.replaceAll.addEventListener('click', replaceAllText);
    els.findClose.addEventListener('click', closeFindBar);
    els.findInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) findPrev(); else findNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeFindBar();
      }
    });
    els.replaceInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        replaceAllText();
      }
    });
  }

  function openFindBar() {
    els.findBar.hidden = false;
    els.findInput.focus();
    els.findInput.select();
  }

  function closeFindBar() {
    els.findBar.hidden = true;
    editor.focus();
  }

  function findNext() { searchFind(false); }
  function findPrev() { searchFind(true); }

  function searchFind(backwards) {
    const q = els.findInput.value;
    if (!q) return;
    let found = false;
    try {
      if (typeof window.find === 'function') {
        found = window.find(q, false, backwards, true, false, false, false);
      }
    } catch (e) { /* noop */ }
    if (!found) setStatus(t('Sem correspondências.'), 'info');
    else setStatus('', null);
  }

  function replaceAllText() {
    const search = (els.findInput.value || '').trim();
    if (!search) {
      setStatus(t('Escreve um texto para substituir.'), 'info');
      els.findInput.focus();
      return;
    }

    const replacement = els.replaceInput ? (els.replaceInput.value || '') : '';
    let count = 0;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue && node.nodeValue.toLowerCase().includes(search.toLowerCase())) nodes.push(node);
    }

    nodes.forEach(node => {
      const text = node.nodeValue || '';
      const regex = new RegExp(escapeRegExp(search), 'gi');
      const updated = text.replace(regex, replacement);
      if (updated !== text) {
        node.nodeValue = updated;
        count++;
      }
    });

    if (count) {
      setStatus(t('Substituído') + ': ' + count, 'success');
      onEditorChanged();
    } else {
      setStatus(t('Sem correspondências.'), 'info');
    }
  }

  // ---------------------------------------------------------------- editor events

  function bindEditorEvents() {
    editor.addEventListener('input', onEditorChanged);
    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('dragover', e => e.preventDefault());
    editor.addEventListener('drop', e => e.preventDefault());
    editor.addEventListener('paste', handlePaste);
    editor.addEventListener('paste', sanitizePaste);

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode) return;
      if (!editor.contains(sel.anchorNode)) return;
      updateToolbarState();
    });
  }

  function handlePaste(event) {
    if (event.clipboardData && event.clipboardData.types.includes('text/plain') && !event.clipboardData.types.includes('text/html')) {
      const text = event.clipboardData.getData('text/plain');
      if (text) {
        event.preventDefault();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        onEditorChanged();
      }
    }
  }

  function onEditorChanged() {
    state.revision++;
    state.dirty = true;
    scheduleStatusUpdate();
    updateSaveState('unsaved');
    updateWindowTitle();
    scheduleDraftSave();
  }

  function scheduleStatusUpdate() {
    if (state.statusTimer) clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(updateStatus, 200);
  }

  // ---------------------------------------------------------------- draft

  function scheduleDraftSave() {
    cancelDraftSave();
    state.saveTimer = setTimeout(saveDraft, SAVE_DEBOUNCE_MS);
  }

  function cancelDraftSave() {
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }

  function draftId(path) {
    return path || '__untitled__';
  }

  async function readDrafts() {
    let drafts;
    try { drafts = await os.storage.get(DRAFTS_KEY); } catch (err) { drafts = null; }
    if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) drafts = {};

    let legacy;
    try { legacy = await os.storage.get(LEGACY_DRAFT_KEY); } catch (err) { legacy = null; }
    if (legacy?.html) {
      const id = draftId(legacy.path);
      if (!drafts[id] || Number(legacy.savedAt) > Number(drafts[id].savedAt)) drafts[id] = legacy;
      try {
        await os.storage.set(DRAFTS_KEY, drafts);
        await os.storage.remove(LEGACY_DRAFT_KEY);
      } catch (err) { /* Keep the migrated draft in memory for this session. */ }
    }
    return drafts;
  }

  async function saveDraft() {
    state.saveTimer = null;
    if (!window.os || !os.storage || state.saving || !state.dirty) return;
    const revision = state.revision;
    const path = state.path;
    const draft = {
      path,
      name: state.docName,
      html: sanitizeHtml(editor.innerHTML),
      savedAt: Date.now()
    };
    try {
      const drafts = await readDrafts();
      drafts[draftId(path)] = draft;
      await os.storage.set(DRAFTS_KEY, drafts);
      if (state.path === path && state.revision === revision && state.dirty) updateSaveState('draft');
    } catch (err) {
      console.warn('WordWebos: falha ao guardar rascunho.', err);
    }
  }

  async function getDraft(path) {
    const drafts = await readDrafts();
    const draft = drafts[draftId(path)];
    return draft?.html ? draft : null;
  }

  async function getLatestDraft() {
    const drafts = await readDrafts();
    return Object.values(drafts)
      .filter(draft => draft?.html)
      .sort((left, right) => Number(right.savedAt) - Number(left.savedAt))[0] ?? null;
  }

  function applyDraft(draft) {
    cancelDraftSave();
    editor.innerHTML = sanitizeHtml(draft.html) || '<p><br></p>';
    state.path = draft.path || null;
    state.docName = draft.name || 'Documento sem título';
    state.dirty = true;
    state.revision++;

    const when = draft.savedAt ? formatTimeAgo(draft.savedAt) : '';
    setStatus(t('Rascunho restaurado') + (when ? ' (' + when + ')' : ''), 'info');
    updateStatus();
    updateWindowTitle();
    updateSaveState('draft');
  }

  async function removeDraft(path) {
    if (!window.os || !os.storage) return;
    const drafts = await readDrafts();
    delete drafts[draftId(path)];
    if (Object.keys(drafts).length) await os.storage.set(DRAFTS_KEY, drafts);
    else await os.storage.remove(DRAFTS_KEY);
  }

  async function initializeDocument() {
    let args = null;
    try { args = await os.args(); } catch (err) { /* no launch arguments */ }
    if (args?.path) {
      const opened = await openFile(args.path, { restoreDraft: true });
      if (!opened && !state.dirty) {
        const draft = await getLatestDraft();
        if (draft) applyDraft(draft);
      }
      return;
    }
    const draft = await getLatestDraft();
    if (draft) applyDraft(draft);
  }

  // ---------------------------------------------------------------- status

  function updateStatus() {
    const text = editor.innerText || '';
    const words = countWords(text);
    const pages = Math.max(1, Math.ceil(words / WORDS_PER_PAGE_ESTIMATE));

    els.wordCount.textContent = words + ' ' + (words === 1 ? t('palavra') : t('palavras'));
    els.pageCount.textContent = pages + ' ' + (pages === 1 ? t('página') : t('páginas'));
    els.statusPath.textContent = state.path || t('Documento não guardado');
  }

  function updateSaveState(kind) {
    const labels = {
      unsaved: t('Não guardado'),
      draft: t('Rascunho'),
      saved: t('Guardado'),
      external: t('Alterado externamente')
    };
    els.saveState.textContent = labels[kind] || '—';
    els.saveState.dataset.state = kind;
  }

  function setStatus(message, kind) {
    if (!els.statusMessage) return;
    if (window.os && os.ui && typeof os.ui.status === 'function') {
      try { os.ui.status(els.statusMessage, message, kind); return; } catch (e) {}
    }
    els.statusMessage.textContent = message || '';
    if (kind) els.statusMessage.dataset.state = kind;
    else delete els.statusMessage.dataset.state;
  }

  function updateWindowTitle() {
    if (!window.os || !os.window || typeof os.window.setTitle !== 'function') return;
    const marker = state.dirty ? ' *' : '';
    try { os.window.setTitle(state.docName + marker); } catch (e) {}
  }

  function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  // ---------------------------------------------------------------- keyboard

  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 's') {
        e.preventDefault();
        saveDocument(e.shiftKey);
      } else if (mod && key === 'o') {
        e.preventDefault();
        openDocument();
      } else if (mod && key === 'n') {
        e.preventDefault();
        newDocument();
      } else if (mod && key === 'f') {
        e.preventDefault();
        openFindBar();
      } else if (mod && key === 'p') {
        e.preventDefault();
        try { window.print(); } catch (err) {}
      } else if (mod && key === 'b') {
        e.preventDefault();
        runCommand('bold');
      } else if (mod && key === 'i') {
        e.preventDefault();
        runCommand('italic');
      } else if (mod && key === 'u') {
        e.preventDefault();
        runCommand('underline');
      } else if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) runCommand('redo'); else runCommand('undo');
      } else if (mod && key === 'y') {
        e.preventDefault();
        runCommand('redo');
      } else if (mod && key === 'l') {
        e.preventDefault();
        runCommand('justifyLeft');
      } else if (mod && key === 'e') {
        e.preventDefault();
        runCommand('justifyCenter');
      } else if (mod && key === 'r') {
        e.preventDefault();
        runCommand('justifyRight');
      } else if (mod && key === 'j') {
        e.preventDefault();
        runCommand('justifyFull');
      } else if (e.key === 'Escape' && !els.findBar.hidden) {
        e.preventDefault();
        closeFindBar();
      }
    });
  }

  // ---------------------------------------------------------------- external

  function setupExternalListeners() {
    if (!window.os || typeof os.on !== 'function') return;
    try {
      os.on('fs:changed', data => {
        if (!data || !data.path) return;
        if (state.path && data.path === state.path && !state.saving) {
          updateSaveState('external');
        }
      });
    } catch (e) { /* noop */ }
  }

  // ---------------------------------------------------------------- helpers

  function basename(path) {
    return path.split('/').pop() || path;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractBodyFromHtml(html) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc && doc.body ? sanitizeHtml(doc.body.innerHTML) : sanitizeHtml(html);
    } catch (e) {
      return sanitizeHtml(html);
    }
  }

  function sanitizePaste(event) {
    const html = event.clipboardData?.getData('text/html');
    if (!html) return;
    event.preventDefault();
    editor.focus();
    try { document.execCommand('insertHTML', false, sanitizeHtml(html)); } catch (e) {}
    onEditorChanged();
  }

  function sanitizeHtml(source) {
    const parsed = new DOMParser().parseFromString(String(source), 'text/html');
    sanitizeChildren(parsed.body);
    return parsed.body.innerHTML;
  }

  function sanitizeChildren(parent) {
    const allowedTags = new Set(['A', 'ABBR', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CITE', 'CODE', 'DD', 'DEL', 'DIV', 'DL', 'DT', 'EM', 'FONT', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'INS', 'LI', 'OL', 'P', 'PRE', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY', 'TFOOT', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL']);
    const blockedTags = new Set(['APPLET', 'AUDIO', 'BASE', 'BUTTON', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'LINK', 'MATH', 'META', 'OBJECT', 'SCRIPT', 'SELECT', 'SOURCE', 'STYLE', 'SVG', 'TEXTAREA', 'TRACK', 'VIDEO']);
    for (const child of [...parent.children]) {
      if (blockedTags.has(child.tagName)) { child.remove(); continue; }
      sanitizeChildren(child);
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      sanitizeAttributes(child);
    }
  }

  function sanitizeAttributes(element) {
    const allowed = new Set(['title', 'style']);
    if (element.tagName === 'A') allowed.add('href');
    if (element.tagName === 'IMG') ['src', 'alt', 'width', 'height'].forEach(name => allowed.add(name));
    if (element.tagName === 'TD' || element.tagName === 'TH') ['colspan', 'rowspan'].forEach(name => allowed.add(name));
    if (element.tagName === 'OL') ['start', 'reversed', 'type'].forEach(name => allowed.add(name));
    if (element.tagName === 'LI') allowed.add('value');
    if (element.tagName === 'FONT') ['color', 'face', 'size'].forEach(name => allowed.add(name));
    if (element.tagName === 'HR' && element.getAttribute('class') === 'page-break') allowed.add('class');

    for (const attribute of [...element.attributes]) {
      if (!allowed.has(attribute.name.toLowerCase())) element.removeAttribute(attribute.name);
    }
    if (element.tagName === 'A' && element.hasAttribute('href') && !safeLink(element.getAttribute('href'))) element.removeAttribute('href');
    if (element.tagName === 'IMG' && element.hasAttribute('src') && !safeImage(element.getAttribute('src'))) element.remove();
    if (element.hasAttribute('style')) sanitizeStyle(element);
  }

  function safeLink(value) {
    const url = value.trim();
    return url.startsWith('#') || /^(https?:|mailto:)/i.test(url) || (/^(?!\/\/)[^:\\]*$/.test(url) && !url.startsWith('/'));
  }

  function safeImage(value) {
    const url = value.trim();
    return /^https:\/\//i.test(url) || /^data:image\/(png|jpeg|gif|webp);base64,/i.test(url) || /^data:image\/svg\+xml;charset=utf-8,/i.test(url);
  }

  function sanitizeStyle(element) {
    const allowed = new Set(['background-color', 'color', 'font-family', 'font-size', 'font-style', 'font-weight', 'line-height', 'margin-left', 'margin-right', 'text-align', 'text-decoration', 'text-indent', 'vertical-align']);
    const clean = [];
    for (const property of [...element.style]) {
      const value = element.style.getPropertyValue(property).trim();
      if (!allowed.has(property) || /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:/i.test(value)) continue;
      clean.push(`${property}: ${value}`);
    }
    if (clean.length) element.setAttribute('style', clean.join('; '));
    else element.removeAttribute('style');
  }

  function plainTextToHtml(text) {
    return String(text)
      .split(/\r?\n/)
      .map(line => '<p>' + (escapeHtml(line) || '<br>') + '</p>')
      .join('');
  }

  function buildHtmlDocument(bodyHtml, title) {
    return (
      '<!DOCTYPE html>\n' +
      '<html lang="' + (window.os && os.i18n ? os.i18n.language : 'pt-PT') + '">\n' +
      '<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<title>' + escapeHtml(title) + '</title>\n' +
      '<style>\n' +
      'body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.5; max-width: 794px; margin: 40px auto; padding: 0 96px; color: #1a1a1a; }\n' +
      'h1, h2, h3, h4, h5, h6 { font-family: Calibri, "Segoe UI", Arial, sans-serif; }\n' +
      'table { border-collapse: collapse; }\n' +
      'td, th { border: 1px solid #999; padding: 6px; }\n' +
      'img { max-width: 100%; height: auto; }\n' +
      'hr.page-break { border: none; border-top: 2px dashed #ccc; margin: 24px 0; }\n' +
      '</style>\n' +
      '</head>\n' +
      '<body>\n' +
      bodyHtml + '\n' +
      '</body>\n' +
      '</html>'
    );
  }

  function formatDate(d) {
    if (window.os && os.i18n && typeof os.i18n.date === 'function') {
      try { return os.i18n.date(d, { dateStyle: 'long' }); } catch (e) {}
    }
    return d.toLocaleDateString('pt-PT', { dateStyle: 'long' });
  }

  function formatTimeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('agora mesmo');
    if (mins < 60) return t('há') + ' ' + mins + ' ' + t('min');
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('há') + ' ' + hours + ' ' + t('h');
    const days = Math.floor(hours / 24);
    return t('há') + ' ' + days + ' ' + t('d');
  }
})();