const values = new Map();
const pendingWrites = new Map();
let useSdkStorage = false;
let flushTimer = null;
let flushQueue = Promise.resolve();
let lastStorageError = null;
let lifecycleRegistered = false;

function reportStorageError(key, error) {
  lastStorageError = { key, message: error?.message || String(error) };
  console.warn('Zombie Survival storage write failed:', key, error);
  if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
    document.dispatchEvent(new CustomEvent('zombie-storage-error', { detail: lastStorageError }));
  }
}

function scheduleFlush() {
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushStoredValues();
  }, 80);
}

function registerStorageLifecycle() {
  if (lifecycleRegistered || typeof document === 'undefined') return;
  lifecycleRegistered = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flushStoredValues();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { void flushStoredValues(); });
  }
}

export function flushStoredValues() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!pendingWrites.size) return flushQueue;

  const batch = [...pendingWrites.entries()];
  pendingWrites.clear();
  flushQueue = flushQueue.then(async () => {
    for (const [key, entry] of batch) {
      let result;
      try {
        if (useSdkStorage) await window.os.storage.set(key, entry.value);
        else if (typeof localStorage !== 'undefined') localStorage.setItem(key, entry.value);
        else {
          for (const resolve of entry.waiters) resolve({ ok: true, skipped: true });
          continue;
        }
        lastStorageError = null;
        result = { ok: true };
      } catch (error) {
        reportStorageError(key, error);
        result = { ok: false, error: lastStorageError };
      }
      for (const resolve of entry.waiters) resolve(result);
    }
  });
  return flushQueue;
}

export function getStorageStatus() {
  return {
    mode: useSdkStorage ? 'sdk' : 'local',
    pendingWrites: pendingWrites.size,
    lastError: lastStorageError
  };
}

export async function initAppStorage(keys) {
  useSdkStorage = Boolean(window.os?.storage);
  registerStorageLifecycle();

  for (const key of keys) {
    try {
      const value = useSdkStorage
        ? await window.os.storage.get(key)
        : localStorage.getItem(key);
      if (value !== null && value !== undefined) values.set(key, value);
    } catch (error) {
      values.delete(key);
    }
  }
}

export function getStoredValue(key) {
  if (values.has(key)) return values.get(key);
  if (useSdkStorage) return null;

  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

export function setStoredValue(key, value) {
  const storedValue = String(value);
  values.set(key, storedValue);
  return new Promise(resolve => {
    const entry = pendingWrites.get(key);
    if (entry) {
      entry.value = storedValue;
      entry.waiters.push(resolve);
    } else {
      pendingWrites.set(key, { value: storedValue, waiters: [resolve] });
    }
    scheduleFlush();
  });
}