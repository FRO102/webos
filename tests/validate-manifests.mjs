import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const allowed = new Set(['fs.read', 'fs.write', 'apps.launch', 'settings.write', 'notifications', 'clipboard', 'external.open', 'profile.backup']);
const allowedCategoryIds = new Set(['system', 'applications', 'games']);
const root = fileURLToPath(new URL('../apps/', import.meta.url));
const errors = [];
const categories = new Map();
const apps = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);

for (const id of apps) {
  const dir = join(root, id);
  let manifest;
  try { manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')); }
  catch { errors.push(`${id}: manifest.json em falta ou inválido`); continue; }
  for (const field of ['id', 'name', 'version', 'icon', 'entry']) if (typeof manifest[field] !== 'string' || !manifest[field]) errors.push(`${id}: ${field} inválido`);
  if (manifest.id !== id) errors.push(`${id}: id não corresponde à pasta`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) errors.push(`${id}: nome da pasta inválido`);
  const category = manifest.category;
  if (!category || typeof category !== 'object'
    || typeof category.id !== 'string' || !allowedCategoryIds.has(category.id)
    || typeof category.name !== 'string' || !category.name.trim()
    || typeof category.nameEn !== 'string' || !category.nameEn.trim()) {
    errors.push(`${id}: category deve incluir id, name e nameEn válidos`);
  } else {
    const labels = `${category.name}\n${category.nameEn}`;
    if (categories.has(category.id) && categories.get(category.id) !== labels) errors.push(`${id}: rótulos inconsistentes para a categoria ${category.id}`);
    else categories.set(category.id, labels);
  }
  if (!Array.isArray(manifest.permissions) || manifest.permissions.some(permission => !allowed.has(permission))) errors.push(`${id}: permissões inválidas`);
  if (manifest.allowSameOrigin !== undefined && typeof manifest.allowSameOrigin !== 'boolean') errors.push(`${id}: allowSameOrigin deve ser booleano`);
  if (manifest.fileTypes !== undefined && (!Array.isArray(manifest.fileTypes) || manifest.fileTypes.some(type => typeof type !== 'string' || !/^\.[a-z0-9]+$/i.test(type)))) errors.push(`${id}: fileTypes inválido`);
  for (const field of ['entry', 'icon']) {
    if (typeof manifest[field] !== 'string' || manifest[field].startsWith('/') || manifest[field].split(/[\\/]/).includes('..')) {
      errors.push(`${id}: caminho de ${field} inválido`);
      continue;
    }
    try { await readFile(join(dir, manifest[field])); } catch { errors.push(`${id}: ${field} não encontrado`); }
  }
}

if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Manifestos válidos: ${apps.length}`);
