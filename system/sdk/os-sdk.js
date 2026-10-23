// SDK das apps: window.os (ponte postMessage -> sistema). Usar como <script> normal, não como módulo.
(() => {
  const pending = new Map(), listeners = new Map();
  let n = 0;
  const call = (method, params) => new Promise((resolve, reject) => {
    const id = ++n;
    pending.set(id, { resolve, reject });
    parent.postMessage({ id, method, params }, '*');
  });
  addEventListener('message', e => {
    if (e.source !== parent) return;
    const { id, result, error, event, data } = e.data ?? {};
    if (event) return listeners.get(event)?.forEach(fn => fn(data));
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (!error) return p.resolve(result);
    const details = typeof error === 'string' ? { code: 'operation_failed', message: error } : error;
    const exception = new Error(details.message || 'Ocorreu um erro ao executar a operação.');
    exception.name = 'OSApiError'; exception.code = details.code || 'operation_failed';
    p.reject(exception);
  });
  addEventListener('pointerdown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    call('window.focus').catch(() => {});
  });
  // Alt+Q (alternar) e Alt+setas (encaixar janelas) têm de funcionar mesmo com o foco dentro da app
  addEventListener('keydown', e => { if (e.altKey && (e.code === 'KeyQ' || e.code.startsWith('Arrow'))) { e.preventDefault(); call('shell.key', { type: 'down', code: e.code, shift: e.shiftKey }).catch(() => {}); } });
  addEventListener('keyup', e => { if (e.key === 'Alt') call('shell.key', { type: 'up' }).catch(() => {}); });

  let localeData = { language: 'pt-PT', locale: 'pt-PT', translations: {} };
  const sourceText = new WeakMap(), sourceAttributes = new WeakMap();
  const translateValue = value => {
    if (localeData.language !== 'en') return value;
    const exact = localeData.translations[value];
    if (exact) return exact;
    const color = value.match(/^Cor (#(?:[\da-f]{3}|[\da-f]{6}))$/i);
    if (color) return `Color ${color[1]}`;
    const count = value.match(/^(\d+) (item|itens|forma|formas|aplicação|aplicações|ficheiro|ficheiros|registo|registos|janela aberta|janelas abertas)$/i);
    if (count) {
      const labels = { item: 'item', itens: 'items', forma: 'shape', formas: 'shapes', aplicação: 'application', aplicações: 'applications', ficheiro: 'file', ficheiros: 'files', registo: 'record', registos: 'records', 'janela aberta': 'open window', 'janelas abertas': 'open windows' };
      return `${count[1]} ${labels[count[2].toLowerCase()]}`;
    }
    const workspace = value.match(/^Área (\d+)$/);
    if (workspace) return `Workspace ${workspace[1]}`;
    return value;
  };
  const translateText = text => {
    const current = text.nodeValue;
    const state = sourceText.get(text);
    const original = state && current === state.rendered ? state.source : current;
    const value = original.trim();
    if (!value) return;
    const translated = translateValue(value);
    const result = original.replace(value, translated);
    sourceText.set(text, { source: original, rendered: result });
    if (text.nodeValue !== result) text.nodeValue = result;
  };
  const translateDOM = root => {
    const language = localeData.language, translations = localeData.translations;
    if (!root || !translations) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) translateText(text);
    for (const element of [root, ...root.querySelectorAll('*')]) {
      for (const attribute of ['aria-label', 'aria-placeholder', 'placeholder', 'title']) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        const attributes = sourceAttributes.get(element) ?? {};
        const state = attributes[attribute];
        const source = state && current === state.rendered ? state.source : current;
        const translated = translateValue(source);
        attributes[attribute] = { source, rendered: translated };
        sourceAttributes.set(element, attributes);
        if (current !== translated) element.setAttribute(attribute, translated);
      }
    }
    document.documentElement.lang = language === 'en' ? 'en' : 'pt-PT';
  };
  const applyLocale = data => { localeData = data; translateDOM(document.body); };

  window.os = {
    errors: {
      is: (error, code) => error?.code === code,
      message: (error, fallback = 'Ocorreu um erro. Tenta novamente.') => translateValue(error?.message || fallback),
    },
    ui: {
      status: (target, message, state = 'info') => {
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        if (!element) return;
        element.textContent = translateValue(String(message ?? '')); element.dataset.state = state;
        element.setAttribute('role', state === 'error' ? 'alert' : 'status');
        element.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
      },
      run: async (options, operation) => {
        const button = options.button, original = button?.textContent, wasDisabled = button?.disabled;
        if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
        os.ui.status(options.status, options.loading || 'A processar…', 'loading');
        try {
          const result = await operation();
          if (options.success) os.ui.status(options.status, options.success, 'success');
          return result;
        } catch (error) {
          os.ui.status(options.status, os.errors.message(error, options.failure), 'error');
          throw error;
        } finally {
          if (button) { button.disabled = wasDisabled; button.removeAttribute('aria-busy'); button.textContent = original; }
        }
      },
    },
    window: {
      setTitle: title => call('window.setTitle', { title }),
      resize: (width, height) => call('window.resize', { width, height }),
      close: () => call('window.close'),
    },
    shell: { windows: () => call('shell.windows'), apps: () => call('shell.apps'), open: appId => call('shell.open', { appId }), focus: id => call('shell.focus', { id }), close: id => call('shell.close', { id }), isFullscreen: () => call('shell.fullscreenState'), toggleFullscreen: () => call('shell.fullscreen') },
    fs: { // requer "fs.read" / "fs.write" no manifest
      home: () => call('fs.home'),
      list: path => call('fs.list', { path }),
      exists: path => call('fs.exists', { path }),
      read: path => call('fs.read', { path }),
      stat: path => call('fs.stat', { path }),
      search: (query, path = '/') => call('fs.search', { query, path }),
      write: (path, content, mime) => call('fs.write', { path, content, mime }),
      mkdir: path => call('fs.mkdir', { path }),
      remove: path => call('fs.remove', { path }),
      trash: path => call('fs.trash', { path }),
      restore: path => call('fs.restore', { path }),
      emptyTrash: () => call('fs.emptyTrash'),
      move: (from, to) => call('fs.move', { from, to }),
    },
    storage: { // privado a cada app
      get: key => call('storage.get', { key }),
      set: (key, value) => call('storage.set', { key, value }),
      remove: key => call('storage.remove', { key }),
    },
    profileBackup: {
      export: () => call('profile.backup.export'),
      restore: backup => call('profile.backup.restore', { backup }),
    },
    args: () => call('app.args'),                       // ex.: { path } quando aberta com um ficheiro
    openFile: path => call('app.openFile', { path }),   // requer "apps.launch"
    notify: message => call('notify', { message }),
    external: { open: url => call('external.open', { url }) },
    clipboard: { read: () => call('clipboard.read'), write: text => call('clipboard.write', { text }) },
    theme: { get: () => call('theme.get') },
    settings: { // set requer "settings.write"
      get: () => call('settings.get'),
      set: patch => call('settings.set', { patch }),
    },
    i18n: {
      get language() { return localeData.language; },
      get locale() { return localeData.locale; },
      t: text => translateValue(String(text)),
      date: (value, options = {}) => new Intl.DateTimeFormat(localeData.locale, options).format(value instanceof Date ? value : new Date(value)),
      number: (value, options = {}) => new Intl.NumberFormat(localeData.locale, options).format(value),
      onChange: fn => os.on('locale:changed', fn),
      apply: root => translateDOM(root ?? document.body),
    },
    on: (event, fn) => { (listeners.get(event) ?? listeners.set(event, new Set()).get(event)).add(fn); }, // 'fs:changed'
  };

  os.on('locale:changed', applyLocale);
  const localeObserver = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) translateDOM(node);
    for (const record of records) if (record.type === 'characterData') translateText(record.target);
  });
  localeObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  call('locale.get').then(data => {
    applyLocale(data);
    listeners.get('locale:changed')?.forEach(fn => fn(data));
  }).catch(() => {});

  // aplica o tema do sistema como variáveis CSS (--os-bg, --os-fg, --os-accent, ...)
  const applyTheme = t => {
    if (!t) return;
    document.documentElement.dataset.theme = t.theme;
    Object.entries(t.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  };
  os.on('theme:changed', applyTheme);
  os.theme.get().then(applyTheme).catch(() => {});
})();
