import { bus } from './event-bus.js';
import * as fs from './filesystem.js';
import { kv, createProfileBackup, restoreProfileBackup } from './storage.js';
import { getSettings, updateSettings, themeVars, WALLPAPERS, validateSettingsSnapshot, applyRestoredSettings } from './settings.js';
import { closeWindow, focusWindow, setTitle, resizeWindow, getWindows } from './window-manager.js';
import { logger } from './logger.js';
import { listApps, openApp } from './shell-registry.js';
import { getCurrentUser } from './users.js';
import { localeData } from './i18n.js';

const clients = new Map(); // contentWindow -> { appId, winId, manifest }
const apiError = error => {
  const message = String(error?.message ?? error);
  const code = /permissão em falta/i.test(message) ? 'permission_denied'
    : /só pode aceder|path forbidden/i.test(message) ? 'path_forbidden'
      : /não existe|não encontrado/i.test(message) ? 'not_found'
        : /já existe/i.test(message) ? 'already_exists'
          : /inválid|inválido|invalid/i.test(message) ? 'invalid_args'
            : /quota|limite de/i.test(message) ? 'quota_exceeded' : 'operation_failed';
  return { code, message };
};
const scopedPath = path => {
  const value = String(path ?? '/');
  const home = `/home/${getCurrentUser()?.id || 'user'}`;
  if (value === '/' || value === '/home') return home;
  if (value === '/.Trash' || value.startsWith('/.Trash/') || value === home || value.startsWith(home + '/')) return value;
  throw new Error('A aplicação só pode aceder à pasta do utilizador.');
};
const scopedMove = (from, to) => [scopedPath(from), scopedPath(to)];

// perm: permissão exigida no manifest (as fs.* chegam na fase 5)
const methods = {
  'window.setTitle': { fn: (c, { title }) => setTitle(c.winId, String(title).slice(0, 80)) },
  'window.close':    { fn: c => closeWindow(c.winId) },
  'window.focus':    { fn: c => focusWindow(c.winId) },
  'window.resize':   { fn: (c, { width, height }) => resizeWindow(c.winId, width, height) },
  'shell.windows':   { fn: () => getWindows().map(w => ({ id: w.id, title: w.title, minimized: w.minimized, maximized: w.maximized, workspace: w.workspace })) },
  'shell.apps':      { fn: () => listApps() },
  'shell.open':      { fn: (c, { appId }) => openApp(String(appId)) },
  'shell.focus':     { fn: (c, { id }) => focusWindow(Number(id)) },
  'shell.close':     { fn: (c, { id }) => closeWindow(Number(id)) },
  'notify':          { perm: 'notifications', fn: (c, { message }) => bus.emit('notify', { app: c.manifest.name, message: String(message).slice(0, 500) }) },
  'clipboard.write': { perm: 'clipboard', fn: async (c, { text }) => { await navigator.clipboard.writeText(String(text ?? '').slice(0, 10000)); return true; } },
  'clipboard.read':  { perm: 'clipboard', fn: async () => navigator.clipboard.readText() },
  'external.open': { perm: 'external.open', fn: (c, { url }) => {
    const value = String(url ?? '').trim();
    if (!/^(https?:|mailto:)/i.test(value)) throw new Error('URL externa inválida.');
    window.open(value, '_blank', 'noopener,noreferrer');
    return true;
  } },
  'theme.get':       { fn: () => ({ accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }) },
  'locale.get':      { fn: () => localeData() },
};

Object.assign(methods, {
  // teclas do alternador de janelas, reenviadas pelo SDK quando a app tem o foco
  'shell.key': { fn: (c, { type, code, shift }) => { if (type === 'down' || type === 'up') bus.emit('switcher:key', { type, code: String(code ?? 'KeyQ'), shift: !!shift }); } },
});

export const registerClient = (frame, ctx) => clients.set(frame.contentWindow, ctx);

bus.on('window:closed', ({ id }) => {
  for (const [k, c] of clients) if (c.winId === id) clients.delete(k);
});

window.addEventListener('message', async e => {
  const ctx = clients.get(e.source);
  if (!ctx) return; // só aceita mensagens de iframes registados
  const { id, method, params } = e.data ?? {};
  const reply = msg => e.source.postMessage({ id, ...msg }, '*');
  const h = methods[method];
  if (!h) return reply({ error: { code: 'unsupported', message: `Método desconhecido: ${method}` } });
  if (h.perm && !ctx.manifest.permissions?.includes(h.perm)) return reply({ error: { code: 'permission_denied', message: `Permissão em falta: ${h.perm}` } });
  try { reply({ result: await h.fn(ctx, params ?? {}) }); logger.debug('API executada', { app: ctx.appId, method }); }
  catch (err) { const error = apiError(err); logger.error('Falha na API', { app: ctx.appId, method, error: error.message, code: error.code }); reply({ error }); }
});

const R = 'fs.read', W = 'fs.write';
Object.assign(methods, {
  'fs.home':   { perm: R, fn: () => fs.ensureUserHome(getCurrentUser()?.id) },
  'fs.list':   { perm: R, fn: (c, { path }) => fs.list(scopedPath(path)) },
  'fs.read':   { perm: R, fn: (c, { path }) => fs.read(scopedPath(path)) },
  'fs.stat':   { perm: R, fn: (c, { path }) => fs.stat(scopedPath(path)) },
  'fs.search': { perm: R, fn: (c, { query, path }) => fs.search(query, scopedPath(path)) },
  'fs.write':  { perm: W, fn: (c, { path, content, mime }) => fs.write(scopedPath(path), content, mime).then(() => fs.stat(scopedPath(path))) },
  'fs.mkdir':  { perm: W, fn: (c, { path }) => fs.mkdir(scopedPath(path)) },
  'fs.remove': { perm: W, fn: (c, { path }) => fs.remove(scopedPath(path)) },
  'fs.trash':  { perm: W, fn: (c, { path }) => fs.trash(scopedPath(path)) },
  'fs.restore': { perm: W, fn: (c, { path }) => fs.restore(scopedPath(path)) },
  'fs.emptyTrash': { perm: W, fn: () => fs.emptyTrash() },
  'fs.move':   { perm: W, fn: (c, { from, to }) => { const [source, target] = scopedMove(from, to); return fs.move(source, target); } },
  // armazenamento privado: cada app só vê as suas chaves
  'storage.get':    { fn: (c, { key }) => kv.get(`app:${c.appId}:${key}`) },
  'storage.set':    { fn: (c, { key, value }) => kv.set(`app:${c.appId}:${key}`, value) },
  'storage.remove': { fn: (c, { key }) => kv.remove(`app:${c.appId}:${key}`) },
  'app.args':     { fn: c => c.args },
  'app.openFile': { perm: 'apps.launch', fn: (c, { path }) => bus.emit('file:open', { path }) },
});

// avisa as apps com acesso de leitura quando os ficheiros mudam
bus.on('fs:changed', data => {
  for (const [win, c] of clients) if (c.manifest.permissions?.includes(R)) win.postMessage({ event: 'fs:changed', data }, '*');
});

Object.assign(methods, {
  'theme.get':    { fn: () => themeVars() },
  'settings.get': { fn: () => ({ ...getSettings(), wallpapers: WALLPAPERS }) },
  'settings.set': { perm: 'settings.write', fn: (c, { patch }) => updateSettings(patch) },
  'profile.backup.export': { perm: 'profile.backup', fn: c => {
    if (c.appId !== 'backup-restauro') throw new Error('Esta capacidade está reservada à app de backup do perfil.');
    const user = getCurrentUser();
    if (!user) throw new Error('Não existe um perfil ativo.');
    return createProfileBackup(user);
  } },
  'profile.backup.restore': { perm: 'profile.backup', fn: async (c, { backup }) => {
    if (c.appId !== 'backup-restauro') throw new Error('Esta capacidade está reservada à app de backup do perfil.');
    const user = getCurrentUser();
    if (!user) throw new Error('Não existe um perfil ativo.');
    const settings = validateSettingsSnapshot(backup?.settings);
    const result = await restoreProfileBackup({ ...backup, settings }, user);
    applyRestoredSettings(settings);
    bus.emit('fs:changed', { path: `/home/${user.id}` });
    return result;
  } },
});

// todas as apps recebem a mudança de tema/cor
bus.on('settings:changed', () => {
  const data = themeVars();
  for (const win of clients.keys()) win.postMessage({ event: 'theme:changed', data }, '*');
});
bus.on('locale:changed', data => {
  for (const win of clients.keys()) win.postMessage({ event: 'locale:changed', data }, '*');
});
bus.on('window:opened', () => bus.emit('shell:changed'));
bus.on('window:closed', () => bus.emit('shell:changed'));
bus.on('window:focused', () => bus.emit('shell:changed'));
