import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const desktop = await readFile(join(root, 'system/js/desktop.js'), 'utf8');
const explorer = await readFile(join(root, 'apps/file-explorer/app.js'), 'utf8');

for (const term of [
  "const INTERNAL_PATH_TYPE = 'application/x-webos-path'",
  'setPointerCapture(e.pointerId)',
  "addEventListener('lostpointercapture', cancel, { once: true })",
  'gridColumn',
  'gridRow',
  'selectedItems',
  "setData('application/x-webos-paths'",
  'const getDroppedPaths',
  'importFilesToDirectory(files, desktopPath, e.dataTransfer)',
  "moveDroppedItems(internalPaths, desktopPath, 'move')",
  "moveDroppedItems(internalPaths, folderPath, 'move')",
  "copyFile(from, target)",
  "const enableTrashDrop",
  'trash-drop-target',
  "type: 'webos:path-drop'",
]) {
  assert.ok(desktop.includes(term), `desktop.js: falta ${term}`);
}

for (const term of [
  "tr.draggable = true",
  "setData('application/x-webos-paths'",
  "setData('application/x-webos-path', paths[0])",
  'async function importFiles(files, dataTransfer = null)',
  'importFiles([...(event.dataTransfer?.files ?? [])], event.dataTransfer)',
  "os.fs.move(from, join(targetDir, targetName))",
  "event.data?.type === 'webos:path-drop'",
  'const droppedPaths',
  'os.fs.trash(path)',
]) {
  assert.ok(explorer.includes(term), `file-explorer/app.js: falta ${term}`);
}

const sdk = await readFile(join(root, 'system/sdk/os-sdk.js'), 'utf8');
assert.ok(sdk.includes("copy: (from, to) => call('fs.copy', { from, to })"), 'os-sdk.js: falta fs.copy');
assert.ok(explorer.includes("os.fs.copy(from, join(targetDir, targetName))"), 'file-explorer/app.js: falta cópia de drops internos');
assert.ok(explorer.includes('MAX_IMPORT_FILES'), 'file-explorer/app.js: falta limite de importação');
assert.ok(explorer.includes('importCancelled'), 'file-explorer/app.js: falta cancelamento da importação');
assert.ok(explorer.includes("label: 'Cancelar'"), 'file-explorer/app.js: falta cancelamento de drops internos');
const desktopCss = await readFile(join(root, 'system/css/desktop.css'), 'utf8');
assert.ok(desktopCss.includes('scrollbar-width: none'), 'desktop.css: a grelha deve ocultar a scrollbar visual');
assert.equal(desktop.includes('typeof event !=='), false, 'Desktop não deve depender de event global.');
assert.equal(explorer.includes('typeof event !=='), false, 'Explorador não deve depender de event global.');
console.log('Desktop drag/drop tests: OK');
