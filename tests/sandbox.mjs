import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const appRoot = join(root, 'apps');
const loader = await readFile(join(root, 'system/js/app-loader.js'), 'utf8');
const desktop = await readFile(join(root, 'system/js/desktop.js'), 'utf8');
const explorer = await readFile(join(appRoot, 'file-explorer/app.js'), 'utf8');
const expectedExceptions = new Set([
  'chess', 'escape-road',
  'pacman', 'puzzle', 'tetris', 'zombie-survival',
]);

assert.ok(loader.includes("const sandbox = ['allow-scripts', 'allow-forms', 'allow-modals', 'allow-popups', 'allow-downloads']"));
assert.ok(loader.includes("if (m.allowSameOrigin === true) sandbox.push('allow-same-origin')"));
assert.ok(desktop.includes("type: 'webos:file-drop'"));
assert.ok(desktop.includes("type: 'webos:path-drop'"));
assert.ok(desktop.includes("'*'"));
assert.ok(explorer.includes("if (event.source !== parent) return;"));
assert.ok(explorer.includes("event.data?.type !== 'webos:file-drop'"));

const appIds = (await readdir(appRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
const actualExceptions = new Set();
for (const id of appIds) {
  const manifest = JSON.parse(await readFile(join(appRoot, id, 'manifest.json'), 'utf8'));
  if (manifest.allowSameOrigin === true) actualExceptions.add(id);
}
assert.deepEqual(actualExceptions, expectedExceptions, 'Exceções allowSameOrigin devem ser intencionais e revistas');
console.log('Sandbox policy tests: OK');