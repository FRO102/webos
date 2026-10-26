import { store, req, tx } from './storage.js';
import { bus } from './event-bus.js';
import { normalizeFsPath } from './fs-paths.js';
import { fileContentSize, isBinaryFileContent } from './fs-content.js';
import { getSettings } from './settings.js';

const norm = normalizeFsPath;
const parentOf = p => (p === '/' ? null : norm(p + '/..'));
const get = async p => req((await store('fs')).get(p));
const meta = n => ({ path: n.path, name: n.path.split('/').pop() || '/', type: n.type, mime: n.mime ?? (n.type === 'file' ? 'text/plain' : 'inode/directory'), size: n.type === 'file' ? fileContentSize(n.content) : 0, ctime: n.ctime ?? n.mtime, mtime: n.mtime });
const changed = p => bus.emit('fs:changed', { path: p });
const locale = () => getSettings().language === 'en' ? 'en-GB' : 'pt-PT';

async function assertParent(p) {
  const par = await get(parentOf(p));
  if (!par || par.type !== 'dir') throw new Error(`A pasta não existe: ${parentOf(p)}`);
}
async function subtree(p) {
  const all = await req((await store('fs')).getAll());
  return all.filter(n => n.path === p || n.path.startsWith(p + '/'));
}

export async function stat(p) {
  p = norm(p);
  const n = await get(p);
  if (!n) throw new Error(`Não existe: ${p}`);
  return meta(n);
}

export async function exists(p) {
  return !!(await get(norm(p)));
}

export async function list(p) {
  p = norm(p);
  const n = await get(p);
  if (!n || n.type !== 'dir') throw new Error(`Não é uma pasta: ${p}`);
  const kids = await req((await store('fs')).index('parent').getAll(p));
  return kids.map(meta).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name, locale()) : a.type === 'dir' ? -1 : 1);
}

export async function search(query, p = '/') {
  const currentLocale = locale();
  const q = String(query ?? '').trim().toLocaleLowerCase(currentLocale);
  if (!q) return [];
  p = norm(p);
  const all = await req((await store('fs')).getAll());
  return all.filter(n => !n.path.startsWith('/.Trash') && n.path.startsWith(p === '/' ? '/' : p + '/') && n.path.toLocaleLowerCase(currentLocale).includes(q)).map(meta).slice(0, 100);
}

export async function read(p) {
  p = norm(p);
  const n = await get(p);
  if (!n || n.type !== 'file') throw new Error(`Ficheiro não encontrado: ${p}`);
  return n.content;
}

export async function write(p, content, mime = null) {
  p = norm(p);
  if (p === '/') throw new Error('Caminho inválido.');
  await assertParent(p);
  if ((await get(p))?.type === 'dir') throw new Error(`${p} é uma pasta.`);
  const previous = await get(p), now = Date.now();
  if (content === null || content === undefined || (!isBinaryFileContent(content) && typeof content !== 'string')) throw new Error('Conteúdo de ficheiro inválido.');
  await tx('fs', s => s.put({ path: p, parent: parentOf(p), type: 'file', content, mime: mime ?? previous?.mime ?? 'text/plain', ctime: previous?.ctime ?? now, mtime: now }));
  changed(p);
}

export async function mkdir(p) {
  p = norm(p);
  if (await get(p)) throw new Error(`Já existe: ${p}`);
  await assertParent(p);
  await tx('fs', s => s.put({ path: p, parent: parentOf(p), type: 'dir', ctime: Date.now(), mtime: Date.now() }));
  changed(p);
}

export async function remove(p) {
  p = norm(p);
  if (p === '/') throw new Error('Não é possível apagar a raiz.');
  const nodes = await subtree(p);
  if (!nodes.length) throw new Error(`Não existe: ${p}`);
  await tx('fs', s => nodes.forEach(n => s.delete(n.path)));
  changed(p);
}

export async function trash(p) {
  p = norm(p);
  if (p === '/' || p === '/.Trash' || p.startsWith('/.Trash/')) throw new Error('Caminho inválido para a lixeira.');
  if (p === '/home' || /^\/home\/[^/]+$/.test(p)) throw new Error('Não é possível mover a pasta pessoal para a lixeira.');
  const nodes = await subtree(p);
  if (!nodes.length) throw new Error(`Não existe: ${p}`);
  const name = p.split('/').pop();
  let target = `/.Trash/${Date.now()}-${name}`;
  while (await get(target)) target += '-1';
  await tx('fs', s => nodes.forEach(n => {
    s.delete(n.path);
    const path = target + n.path.slice(p.length);
    s.put({ ...n, path, parent: parentOf(path), trashedFrom: p, trashedAt: Date.now() });
  }));
  changed(p);
}

export async function emptyTrash() {
  await remove('/.Trash');
  await mkdir('/.Trash');
  changed('/.Trash');
}

export async function restore(p) {
  p = norm(p);
  const nodes = await subtree(p);
  const root = nodes.find(n => n.path === p);
  if (!root?.trashedFrom) throw new Error('Este item não está na lixeira.');
  const target = norm(root.trashedFrom);
  if (await get(target)) throw new Error(`Já existe um item em ${target}.`);
  await assertParent(target);
  await tx('fs', s => nodes.forEach(n => {
    s.delete(n.path);
    const path = target + n.path.slice(p.length);
    s.put({ ...n, path, parent: parentOf(path), trashedFrom: undefined, trashedAt: undefined });
  }));
  changed(target);
}

export async function move(from, to) {
  from = norm(from); to = norm(to);
  if (from === '/' || to.startsWith(from + '/')) throw new Error('Movimento inválido.');
  if (from === '/home' || /^\/home\/[^/]+$/.test(from)) throw new Error('Não é possível mover a pasta pessoal.');
  const nodes = await subtree(from);
  if (!nodes.length) throw new Error(`Não existe: ${from}`);
  if (await get(to)) throw new Error(`Já existe: ${to}`);
  await assertParent(to);
  await tx('fs', s => nodes.forEach(n => {
    s.delete(n.path);
    const path = to + n.path.slice(from.length);
    s.put({ ...n, path, parent: parentOf(path) });
  }));
  changed(from);
  changed(to);
}

export async function ensureUserHome(userId) {
  const home = `/home/${String(userId || 'user').replace(/[^a-z0-9-]/gi, '') || 'user'}`;
  for (const path of [home, 'Desktop', 'Documentos', 'Imagens', 'Música', 'Vídeos', 'Downloads'].map(name => name.startsWith('/') ? name : `${home}/${name}`)) {
    if (!(await get(path))) await mkdir(path);
  }
  return home;
}

export async function initFS() {
  if (await get('/')) {
    for (const d of ['/.Trash', '/home', '/home/user', '/home/user/Desktop', '/home/user/Documentos', '/home/user/Imagens', '/home/user/Música', '/home/user/Vídeos', '/home/user/Downloads']) if (!(await get(d))) await mkdir(d);
    return;
  }
  await tx('fs', s => s.put({ path: '/', type: 'dir', mtime: Date.now() }));
  for (const d of ['/.Trash', '/home', '/home/user', '/home/user/Desktop', '/home/user/Documentos', '/home/user/Imagens', '/home/user/Música', '/home/user/Vídeos', '/home/user/Downloads']) await mkdir(d);
  await write('/home/user/Documentos/leia-me.txt', 'Bem-vindo ao WebOS!\n\nEste ficheiro vive no sistema de ficheiros virtual (IndexedDB).\nEdita-o, guarda-o e abre-o no Explorador de Ficheiros.\n');
}
