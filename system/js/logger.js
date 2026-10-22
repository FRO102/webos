import { audit } from './storage.js';

const MAX = 200;
const entries = [];
const add = (level, message, data = null) => {
  const entry = { level, message: String(message), data, time: Date.now() };
  entries.push(entry);
  if (entries.length > MAX) entries.shift();
  if (level === 'error') console.error(`[WebOS] ${entry.message}`, data ?? '');
  else if (level === 'warn') console.warn(`[WebOS] ${entry.message}`, data ?? '');
  else console.info(`[WebOS] ${entry.message}`, data ?? '');
  audit.add(entry).catch(() => {});
  return entry;
};

export const logger = {
  debug: (message, data) => add('debug', message, data),
  info: (message, data) => add('info', message, data),
  warn: (message, data) => add('warn', message, data),
  error: (message, data) => add('error', message, data),
  memory: () => [...entries],
};