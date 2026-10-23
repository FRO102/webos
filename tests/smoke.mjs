import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { parseAppDirectoryListing } from '../system/js/app-discovery.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const mustContain = async (relative, terms) => {
  const source = await readFile(join(root, relative), 'utf8');
  for (const term of terms) if (!source.includes(term)) throw new Error(`${relative}: falta ${term}`);
};

await mustContain('system/js/storage.js', ['DB_VERSION = 2', 'audit']);
await mustContain('system/js/storage.js', ['webos-profile-backup', 'caminho inválido']);
await mustContain('system/js/filesystem.js', ['export async function trash', 'export async function restore', 'export async function search']);
await mustContain('system/js/api.js', ['scopedPath', "'shell.apps'", "'clipboard.read'"]);
await mustContain('system/js/api.js', ["'profile.backup.export'", "'profile.backup.restore'", 'permission_denied']);
await mustContain('system/js/api.js', ["'fs.home'", 'ensureUserHome']);
await mustContain('system/sdk/os-sdk.js', ['OSApiError', 'errors:', 'ui:', 'profileBackup']);
await mustContain('system/sdk/os-sdk.js', ['home: () => call(\'fs.home\')']);
await mustContain('system/js/filesystem.js', ['ensureUserHome', "'Desktop'"]);
await mustContain('apps/file-explorer/index.html', ['data-place="Desktop"', 'id="new-file"']);
await mustContain('apps/file-explorer/app.js', ['async function createFile()', 'os.fs.home()']);
await mustContain('apps/browser/index.html', ['https://free-for.dev/#/', 'https://www.worldometers.info/', 'https://web.goodplan.app/']);
assert.equal((await readFile(join(root, 'apps/browser/index.html'), 'utf8')).includes('Porto'), false, 'O atalho do Porto não deve aparecer no navegador.');
await mustContain('system/js/window-manager.js', ['switchWorkspace', 'snapWindow', 'toggleMaximize']);
await mustContain('system/js/notifications.js', ['system:notifications', 'system:notifications:unread']);
await mustContain('system/js/users.js', ['createUser', 'selectUser']);
await mustContain('system/js/app-loader.js', ['parseAppDirectoryListing', "fetch('apps/')", 'listagem da pasta apps/']);
await mustContain('system/js/app-discovery.js', ['parseAppDirectoryListing', 'appIdPattern']);
await mustContain('system/js/i18n.js', ['export const localeFor', 'export const translate', 'locale:changed', 'function translateTextNode']);
await mustContain('system/sdk/os-sdk.js', ['i18n:', 'onChange:', 'new Intl.DateTimeFormat(localeData.locale', "call('locale.get')"]);
await mustContain('system/js/api.js', ["'locale.get'", "event: 'locale:changed'"]);
assert.deepEqual(parseAppDirectoryListing('<a href="calculator/">Calculator</a><a href="file.json">File</a><a href="../">Parent</a><a href="to-do/">Todo</a><a href="calculator/">Duplicate</a>'), ['calculator', 'to-do']);
await mustContain('apps/despesas/app.js', ['nextEntries', 'cada campo obrigatório', 'Apagar movimento']);
await mustContain('apps/diagramas/app.js', ['# WebOS Flow 1', 'ligações repetidas', 'Apagar seleção', 'suppressNextClick', 'svg.setPointerCapture(event.pointerId)', 'chooseConnectionNode', 'Clique na forma de origem da ligação.', 'event.key === \'Escape\'']);
await mustContain('apps/backup-restauro/manifest.json', ['profile.backup']);
console.log('Smoke test WebOS: OK');
