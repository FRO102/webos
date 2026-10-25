import assert from 'node:assert/strict';
import { decodeBackupContent, encodeBackupContent, fileContentSize, isBinaryFileContent } from '../system/js/fs-content.js';

const bytes = new Uint8Array([0, 255, 1, 128, 65]);
const blob = new Blob([bytes], { type: 'application/pdf' });
assert.equal(isBinaryFileContent(blob), true);
assert.equal(fileContentSize(blob), bytes.byteLength);

const encoded = await encodeBackupContent(blob);
assert.equal(encoded.encoding, 'base64');
const restored = decodeBackupContent(encoded, 'application/pdf');
assert.equal(restored.type, 'application/pdf');
assert.deepEqual(new Uint8Array(await restored.arrayBuffer()), bytes);

assert.equal(await encodeBackupContent('texto'), 'texto');
assert.equal(decodeBackupContent('texto'), 'texto');
assert.throws(() => decodeBackupContent({ encoding: 'base64', data: '%%%=' }));
console.log('Filesystem content tests: OK');