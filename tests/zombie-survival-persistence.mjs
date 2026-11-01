import assert from 'node:assert/strict';

const persisted = new Map();
const writes = [];
let shouldFail = false;
globalThis.window = {
  addEventListener() {},
  os: {
    storage: {
      async get(key) { return persisted.get(key) ?? null; },
      async set(key, value) {
        writes.push([key, value]);
        if (shouldFail) throw new Error('storage unavailable');
        persisted.set(key, value);
      }
    }
  }
};
globalThis.document = { addEventListener() {}, dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options) { this.type = type; this.detail = options?.detail; }
};

const storage = await import('../apps/zombie-survival/persistence.js');
await storage.initAppStorage(['settings']);

const firstWrite = storage.setStoredValue('settings', '{"mode":"standard"}');
const latestWrite = storage.setStoredValue('settings', '{"mode":"bossrush"}');
assert.equal(storage.getStoredValue('settings'), '{"mode":"bossrush"}', 'the in-memory value should update immediately');
await storage.flushStoredValues();
assert.deepEqual(await Promise.all([firstWrite, latestWrite]), [{ ok: true }, { ok: true }]);
assert.deepEqual(writes, [['settings', '{"mode":"bossrush"}']], 'rapid writes to one key should coalesce to the latest value');
assert.equal(persisted.get('settings'), '{"mode":"bossrush"}');

shouldFail = true;
const originalWarn = console.warn;
console.warn = () => {};
const failedWrite = storage.setStoredValue('scrap', '12');
await storage.flushStoredValues();
const failure = await failedWrite;
console.warn = originalWarn;
assert.equal(failure.ok, false);
assert.match(failure.error.message, /storage unavailable/);
assert.match(storage.getStorageStatus().lastError.message, /storage unavailable/);
console.log('zombie-survival persistence tests: OK');