import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const allowed = new Set(['fs.read', 'fs.write', 'apps.launch', 'settings.write', 'notifications', 'clipboard', 'external.open', 'profile.backup']);
const root = fileURLToPath(new URL('../apps/', import.meta.url));
const registry = JSON.parse(await readFile(join(root, 'registry.json'), 'utf8'));
const apps = registry.apps;
const errors = [];

for (const id of apps) {
  const dir = join(root, id);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  for (const field of ['id', 'name', 'version', 'entry']) if (typeof manifest[field] !== 'string' || !manifest[field]) errors.push(`${id}: ${field} inválido`);
  if (manifest.id !== id) errors.push(`${id}: id não corresponde à pasta`);
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some(permission => !allowed.has(permission))) errors.push(`${id}: permissões inválidas`);
  if (manifest.fileTypes !== undefined && (!Array.isArray(manifest.fileTypes) || manifest.fileTypes.some(type => typeof type !== 'string' || !/^\.[a-z0-9]+$/i.test(type)))) errors.push(`${id}: fileTypes inválido`);
  try { await readFile(join(dir, manifest.entry)); } catch { errors.push(`${id}: entry não encontrado`); }
}

if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Manifestos válidos: ${apps.length}`);
