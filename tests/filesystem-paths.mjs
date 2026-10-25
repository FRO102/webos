import assert from 'node:assert/strict';
import { normalizeFsPath, resolveScopedFsPath } from '../system/js/fs-paths.js';

assert.equal(normalizeFsPath('/home/user/Documentos/../Imagens'), '/home/user/Imagens');
assert.equal(normalizeFsPath('/home/user/./Documentos//nota.txt'), '/home/user/Documentos/nota.txt');
assert.equal(resolveScopedFsPath('/', '/home/user'), '/home/user');
assert.equal(resolveScopedFsPath('/home/user/Documentos/nota.txt', '/home/user'), '/home/user/Documentos/nota.txt');
assert.equal(resolveScopedFsPath('/.Trash/item.txt', '/home/user'), '/.Trash/item.txt');

for (const path of [
  '/home/user/../other/secret.txt',
  '/home/user/../../.Trash/item.txt',
  '/home/user2/secret.txt',
  '/home/user\\..\\other\\secret.txt',
  '/home/user/\0secret.txt',
]) {
  assert.throws(() => resolveScopedFsPath(path, '/home/user'), undefined, `deve rejeitar ${JSON.stringify(path)}`);
}

assert.throws(() => normalizeFsPath('/../../outside'), /Caminho inválido/);
console.log('Filesystem path tests: OK');