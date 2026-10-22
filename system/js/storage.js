let dbp;
export const DB_VERSION = 2;
const open = () => dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open('webos', DB_VERSION);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    if (!db.objectStoreNames.contains('fs')) {
      const fs = db.createObjectStore('fs', { keyPath: 'path' });
      fs.createIndex('parent', 'parent');
      fs.createIndex('type', 'type');
      fs.createIndex('mtime', 'mtime');
    } else {
      const fs = r.transaction.objectStore('fs');
      if (!fs.indexNames.contains('type')) fs.createIndex('type', 'type');
      if (!fs.indexNames.contains('mtime')) fs.createIndex('mtime', 'mtime');
    }
    if (!db.objectStoreNames.contains('audit')) db.createObjectStore('audit', { keyPath: 'id', autoIncrement: true });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

export const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
export const store = async (name, mode = 'readonly') => (await open()).transaction(name, mode).objectStore(name);

// várias escritas numa só transação (atómico)
export async function tx(name, fn) {
  const t = (await open()).transaction(name, 'readwrite');
  fn(t.objectStore(name));
  return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
}

export const kv = {
  get: async k => req((await store('kv')).get(k)),
  set: async (k, v) => req((await store('kv', 'readwrite')).put(v, k)).then(() => true),
  remove: async k => req((await store('kv', 'readwrite')).delete(k)).then(() => true),
};

export const audit = {
  add: async entry => req((await store('audit', 'readwrite')).add({ ...entry, time: Date.now() })).then(() => true),
  list: async () => req((await store('audit')).getAll()),
  clear: async () => req((await store('audit', 'readwrite')).clear()).then(() => true),
};

export async function createProfileBackup(user) {
  const home = `/home/${user.id}`;
  const db = await open();
  const [keys, values, files] = await Promise.all([
    req(db.transaction('kv').objectStore('kv').getAllKeys()),
    req(db.transaction('kv').objectStore('kv').getAll()),
    req(db.transaction('fs').objectStore('fs').getAll()),
  ]);
  const appData = keys.map((key, index) => [key, values[index]]).filter(([key]) => typeof key === 'string' && key.startsWith('app:'));
  const homeFiles = files.filter(file => file.path === home || file.path.startsWith(home + '/')).map(file => ({
    path: file.path === home ? '/' : file.path.slice(home.length), type: file.type,
    ...(file.type === 'file' ? { content: file.content, mime: file.mime ?? 'text/plain' } : {}),
    ctime: file.ctime ?? file.mtime, mtime: file.mtime,
  }));
  const backup = {
    format: 'webos-profile-backup', version: 1, createdAt: new Date().toISOString(),
    profile: { id: user.id, name: user.name }, settings: await kv.get('system:settings'), appData, files: homeFiles,
  };
  const encoded = JSON.stringify(backup);
  if (encoded.length > 50 * 1024 * 1024) throw new Error('O backup excede o limite de 50 MB.');
  return backup;
}

export async function restoreProfileBackup(backup, user) {
  if (!backup || backup.format !== 'webos-profile-backup' || backup.version !== 1) throw new Error('Formato de backup não suportado.');
  if (!Array.isArray(backup.appData) || !Array.isArray(backup.files) || backup.appData.length > 10000 || backup.files.length > 10000) throw new Error('O backup contém dados inválidos ou excede os limites permitidos.');
  if (JSON.stringify(backup).length > 50 * 1024 * 1024) throw new Error('O backup excede o limite de 50 MB.');
  const home = `/home/${user.id}`, paths = new Set();
  const records = backup.files.map(file => {
    if (!file || typeof file.path !== 'string' || !file.path.startsWith('/') || file.path.includes('\\') || file.path.split('/').includes('..')) throw new Error('O backup contém um caminho inválido.');
    if (file.path.length > 1024 || (file.path !== '/' && file.path.slice(1).split('/').some(part => !part || part === '.' || part === '..'))) throw new Error('O backup contém um caminho inválido.');
    const path = file.path === '/' ? home : home + file.path;
    if (paths.has(path) || !['dir', 'file'].includes(file.type)) throw new Error('O backup contém caminhos repetidos ou tipos inválidos.');
    paths.add(path);
    if (file.type === 'file' && typeof file.content !== 'string') throw new Error('O backup contém um ficheiro inválido.');
    return { path, type: file.type, ...(file.type === 'file' ? { content: file.content, mime: String(file.mime ?? 'text/plain').slice(0, 120) } : {}), ctime: Number(file.ctime) || Date.now(), mtime: Number(file.mtime) || Date.now() };
  });
  if (!records.some(file => file.path === home && file.type === 'dir')) throw new Error('O backup não contém a pasta pessoal.');
  for (const file of records) {
    if (file.path === home) continue;
    const parent = file.path.slice(0, file.path.lastIndexOf('/')) || home;
    if (!records.some(item => item.path === parent && item.type === 'dir')) throw new Error(`Falta a pasta que contém ${file.path.slice(home.length) || '/'}.`);
  }
  const appKeys = new Set();
  for (const pair of backup.appData) {
    if (!Array.isArray(pair) || typeof pair[0] !== 'string' || !pair[0].startsWith('app:') || pair[0].length > 500 || appKeys.has(pair[0])) throw new Error('O backup contém dados privados de aplicação inválidos.');
    appKeys.add(pair[0]);
  }
  const db = await open();
  const [oldKeys, oldFiles] = await Promise.all([
    req(db.transaction('kv').objectStore('kv').getAllKeys()),
    req(db.transaction('fs').objectStore('fs').getAll()),
  ]);
  const transaction = db.transaction(['kv', 'fs'], 'readwrite');
  const kvStore = transaction.objectStore('kv'), fsStore = transaction.objectStore('fs');
  oldKeys.filter(key => typeof key === 'string' && key.startsWith('app:')).forEach(key => kvStore.delete(key));
  backup.appData.forEach(([key, value]) => kvStore.put(value, key));
  kvStore.put(backup.settings, 'system:settings');
  oldFiles.filter(file => file.path === home || file.path.startsWith(home + '/')).forEach(file => fsStore.delete(file.path));
  const now = Date.now();
  records.forEach(file => {
    const parent = file.path === home ? '/home' : file.path.slice(0, file.path.lastIndexOf('/')) || '/';
    fsStore.put({ ...file, parent, ctime: Number(file.ctime) || now, mtime: Number(file.mtime) || now });
  });
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
  return { files: records.length, appKeys: backup.appData.length };
}
