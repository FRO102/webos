import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

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
await mustContain('system/sdk/os-sdk.js', ['OSApiError', 'errors:', 'ui:', 'profileBackup']);
await mustContain('system/js/window-manager.js', ['switchWorkspace', 'snapWindow', 'toggleMaximize']);
await mustContain('system/js/notifications.js', ['system:notifications', 'system:notifications:unread']);
await mustContain('system/js/users.js', ['createUser', 'selectUser']);
await mustContain('apps/registry.json', ['calendar', 'media-player', 'downloads']);
await mustContain('apps/despesas/app.js', ['nextEntries', 'cada campo obrigatório', 'Apagar movimento']);
await mustContain('apps/diagramas/app.js', ['# WebOS Flow 1', 'ligações repetidas', 'Apagar seleção']);
await mustContain('apps/backup-restauro/manifest.json', ['profile.backup']);
console.log('Smoke test WebOS: OK');
