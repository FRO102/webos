import { createWindow, focusWindow, setTitle } from './window-manager.js';
import { registerClient } from './api.js';
import { bus } from './event-bus.js';
import { registerApps, registerOpener } from './shell-registry.js';
import { parseAppDirectoryListing } from './app-discovery.js';
import { translate } from './i18n.js';

const apps = new Map();      // appId -> { manifest, base }
const running = new Map();   // winId -> appId
const recent = [];
const permissions = new Set(['fs.read', 'fs.write', 'apps.launch', 'settings.write', 'notifications', 'clipboard', 'external.open', 'profile.backup']);
const DEFAULT_CATEGORY = { id: 'applications', name: 'Aplicações', nameEn: 'Applications' };
const CATEGORY_IDS = new Set(['system', 'applications', 'games']);

bus.on('window:closed', ({ id }) => running.delete(id));

export async function loadRegistry() {
  const ids = await discoverAppIds();
  await Promise.all(ids.map(async id => {
    const base = `apps/${id}/`;
    try {
      const response = await fetch(base + 'manifest.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      if (manifest.id !== id || !manifest.name || !manifest.version || !manifest.icon || !manifest.entry) throw new Error('campos obrigatórios em falta ou id diferente do nome da pasta');
      if (manifest.category === undefined) manifest.category = DEFAULT_CATEGORY;
      if (!manifest.category || !CATEGORY_IDS.has(manifest.category.id)
        || typeof manifest.category.name !== 'string' || !manifest.category.name.trim()
        || typeof manifest.category.nameEn !== 'string' || !manifest.category.nameEn.trim()) throw new Error('categoria inválida');
      for (const path of [manifest.icon, manifest.entry]) {
        if (path.startsWith('/') || path.split(/[\\/]/).includes('..')) throw new Error('caminho de ficheiro inválido');
      }
      if (!Array.isArray(manifest.permissions) || manifest.permissions.some(p => !permissions.has(p))) throw new Error('permissões inválidas');
      apps.set(manifest.id, { manifest, base });
    } catch (error) { console.warn(`App "${id}" ignorada: manifest inválido ou em falta.`, error); }
  }));
  const loaded = [...apps.values()];
  registerApps(getApps());
  registerOpener(launchApp);
  return loaded;
}

bus.on('locale:changed', () => {
  for (const [winId, appId] of running) {
    const manifest = apps.get(appId)?.manifest;
    if (manifest) setTitle(winId, translate(manifest.name));
  }
});

async function discoverAppIds() {
  try {
    const registryResponse = await fetch('apps/registry.json', { cache: 'no-store' });
    if (registryResponse.ok) {
      const registry = await registryResponse.json();
      if (Array.isArray(registry) && registry.length) return registry.map(String).filter(Boolean);
    }
  } catch (error) {
    // Ignore and fall back to directory listing for local development.
  }

  const response = await fetch('apps/');
  if (!response.ok) throw new Error(`Não foi possível listar as aplicações (${response.status}). O servidor tem de permitir a listagem da pasta apps/.`);
  const ids = parseAppDirectoryListing(await response.text());
  if (!ids.length) throw new Error('Não foram encontradas pastas de aplicações. O servidor tem de permitir a listagem da pasta apps/.');
  return ids;
}

export function launchApp(appId, args = null) {
  const app = apps.get(appId);
  if (!app) return;
  const { manifest: m, base } = app;

  if (m.singleInstance) {
    for (const [winId, id] of running) if (id === appId) return focusWindow(winId);
  }

  const frame = document.createElement('iframe');
  frame.sandbox = 'allow-scripts allow-forms allow-modals allow-popups allow-downloads'; // sem allow-same-origin: isolamento total
  frame.title = m.name;
  frame.src = base + m.entry;

  const w = m.window ?? {};
  const win = createWindow({
    title: translate(m.name), width: w.width, height: w.height,
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
export const getApps = () => [...apps.values()].map(({ manifest: m, base }) => {
  return { id: m.id, name: m.name, version: m.version, icon: new URL(base + m.icon, document.baseURI).href, category: { ...m.category }, fileTypes: [...(m.fileTypes ?? [])] };
});

const ext = p => (p.match(/\.[^./]+$/)?.[0] ?? '').toLowerCase();
bus.on('file:open', ({ path, appId }) => {
  const app = appId ? apps.get(appId)
    : ([...apps.values()].find(a => a.manifest.fileTypes?.includes(ext(path))) ?? apps.get('notepad'));
  if (app) launchApp(app.manifest.id, { path });
});
