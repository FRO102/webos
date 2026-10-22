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

  window.os = {
    errors: {
      is: (error, code) => error?.code === code,
      message: (error, fallback = 'Ocorreu um erro. Tenta novamente.') => error?.message || fallback,
    },
    ui: {
      status: (target, message, state = 'info') => {
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        if (!element) return;
        element.textContent = String(message ?? ''); element.dataset.state = state;
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
    shell: { windows: () => call('shell.windows'), apps: () => call('shell.apps'), open: appId => call('shell.open', { appId }), focus: id => call('shell.focus', { id }), close: id => call('shell.close', { id }) },
    fs: { // requer "fs.read" / "fs.write" no manifest
      list: path => call('fs.list', { path }),
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
    on: (event, fn) => { (listeners.get(event) ?? listeners.set(event, new Set()).get(event)).add(fn); }, // 'fs:changed'
  };

  // aplica o tema do sistema como variáveis CSS (--os-bg, --os-fg, --os-accent, ...)
  const applyTheme = t => {
    if (!t) return;
    document.documentElement.dataset.theme = t.theme;
    Object.entries(t.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  };
  os.on('theme:changed', applyTheme);
  os.theme.get().then(applyTheme).catch(() => {});
})();
