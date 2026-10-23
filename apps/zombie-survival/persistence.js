const values = new Map();
let useSdkStorage = false;

export async function initAppStorage(keys) {
  useSdkStorage = Boolean(window.os?.storage);

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
  values.set(key, value);

  if (useSdkStorage) {
    window.os.storage.set(key, value).catch(() => {});
    return;
  }

  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Storage is optional when the game is opened outside WebOS.
  }
}