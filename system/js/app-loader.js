import { createWindow, focusWindow } from './window-manager.js';
import { registerClient } from './api.js';
import { bus } from './event-bus.js';
import { registerApps, registerOpener } from './shell-registry.js';

const apps = new Map();      // appId -> { manifest, base }
const running = new Map();   // winId -> appId
const recent = [];
const permissions = new Set(['fs.read', 'fs.write', 'apps.launch', 'settings.write', 'notifications', 'clipboard', 'external.open', 'profile.backup']);

bus.on('window:closed', ({ id }) => running.delete(id));

export async function loadRegistry() {
  const ids = await discoverAppIds();
  await Promise.all(ids.map(async id => {
    const base = `apps/${id}/`;
    try {
      const response = await fetch(base + 'manifest.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      if (!manifest.id || !manifest.name || !manifest.entry) throw new Error('campos obrigatórios em falta');
      if (!Array.isArray(manifest.permissions) || manifest.permissions.some(p => !permissions.has(p))) throw new Error('permissões inválidas');
      apps.set(manifest.id, { manifest, base });
    } catch (error) { console.warn(`App "${id}" ignorada: manifest inválido ou em falta.`, error); }
  }));
  const loaded = [...apps.values()];
  registerApps(getApps());
  registerOpener(launchApp);
  return loaded;
}

async function discoverAppIds() {
  try {
    const response = await fetch('apps/');
    if (response.ok) {
      const html = await response.text();
      const ids = [...html.matchAll(/href=["']([^"']+\/+)["']/gi)]
        .map(match => decodeURIComponent(match[1].split('/').filter(Boolean).pop()))
        .filter(id => /^[a-z0-9][a-z0-9-]*$/i.test(id) && id !== 'registry');
      if (ids.length) return [...new Set(ids)];
    }
  } catch (error) { console.info('Descoberta automática indisponível; a usar registry.json.', error); }

  const response = await fetch('apps/registry.json');
  if (!response.ok) throw new Error(`Não foi possível carregar o registo de aplicações (${response.status}).`);
  const reg = await response.json();
  if (!Array.isArray(reg.apps)) throw new Error('O registo de aplicações é inválido.');
  return reg.apps;
}

export function launchApp(appId, args = null) {
  const app = apps.get(appId);
  if (!app) return;
  const { manifest: m, base } = app;

  if (m.singleInstance) {
    for (const [winId, id] of running) if (id === appId) return focusWindow(winId);
  }

  const frame = document.createElement('iframe');
  frame.sandbox = 'allow-scripts allow-forms allow-modals allow-popups'; // sem allow-same-origin: isolamento total
  frame.title = m.name;
  frame.src = base + m.entry;

  const w = m.window ?? {};
  const win = createWindow({
    title: m.name, width: w.width, height: w.height,
    minWidth: w.minWidth, minHeight: w.minHeight, content: frame, flush: true,
  });
  registerClient(frame, { appId, winId: win.id, manifest: m, args });
  running.set(win.id, appId);
  recent.splice(recent.indexOf(appId), 1);
  recent.unshift(appId);
  recent.splice(8);
  bus.emit('app:launched', { appId });
}

export const getRecentApps = () => [...recent];
export const getApps = () => [...apps.values()].map(({ manifest: m, base }) => ({ id: m.id, name: m.name, version: m.version, icon: new URL(base + m.icon, document.baseURI).href, category: m.category ?? 'Sistema' }));

const ext = p => (p.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase();
bus.on('file:open', ({ path, appId }) => {
  const app = appId ? apps.get(appId)
    : ([...apps.values()].find(a => a.manifest.fileTypes?.includes(ext(path))) ?? apps.get('notepad'));
  if (app) launchApp(app.manifest.id, { path });
});
