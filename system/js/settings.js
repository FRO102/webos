import { kv } from './storage.js';
import { bus } from './event-bus.js';

export const WALLPAPERS = {
  aurora:  { name: 'Aurora',  css: 'radial-gradient(ellipse at 15% 90%, rgba(60,182,164,.35), transparent 55%), radial-gradient(ellipse at 85% 10%, rgba(224,164,88,.22), transparent 50%), linear-gradient(160deg,#27485a,#10202b)' },
  crepusculo: { name: 'Crepúsculo', css: 'radial-gradient(ellipse at 80% 85%, rgba(236,112,99,.35), transparent 55%), linear-gradient(170deg,#3b2c4f,#141826)' },
  floresta: { name: 'Floresta', css: 'radial-gradient(ellipse at 20% 20%, rgba(150,200,120,.25), transparent 55%), linear-gradient(160deg,#254232,#0e1a14)' },
  grafite: { name: 'Grafite', css: 'linear-gradient(160deg,#3a3f45,#16181b)' },
  papel:   { name: 'Papel',   css: 'radial-gradient(ellipse at 80% 10%, rgba(255,255,255,.8), transparent 60%), linear-gradient(160deg,#d9e2e8,#b7c6d0)' },
};

// paleta que as apps recebem (o SDK aplica-a como variáveis CSS --os-*)
const PALETTE = {
  light: { bg: '#ffffff', surface: '#eef1f3', btn: '#d3dce2', fg: '#1c2a33', muted: '#44565f', border: '#d3dce2', field: '#ffffff' },
  dark:  { bg: '#17222a', surface: '#1f2d37', btn: '#2f404c', fg: '#e6edf1', muted: '#9fb0ba', border: '#33454f', field: '#1a2730' },
};
const defaults = { theme: 'dark', accent: '#3cb6a4', wallpaper: 'aurora', fontSize: 14, animations: true, sounds: true, language: 'pt-PT', desktopBackground: null };
let state = { ...defaults };

export const getSettings = () => ({ ...state });

export function validateSettingsSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('As definições do backup são inválidas.');
  const next = { ...defaults, ...value };
  if (!PALETTE[next.theme]) throw new Error('Tema inválido no backup.');
  if (!/^#[0-9a-f]{6}$/i.test(next.accent)) throw new Error('Cor inválida no backup.');
  if (!WALLPAPERS[next.wallpaper]) throw new Error('Papel de parede inválido no backup.');
  if (!Number.isFinite(Number(next.fontSize)) || Number(next.fontSize) < 12 || Number(next.fontSize) > 20) throw new Error('Tamanho de texto inválido no backup.');
  if (typeof next.animations !== 'boolean' || typeof next.sounds !== 'boolean' || !['pt-PT', 'en'].includes(next.language)) throw new Error('Preferências inválidas no backup.');
  if (next.desktopBackground !== null) {
    if (typeof next.desktopBackground !== 'string' || !next.desktopBackground.startsWith('/') || next.desktopBackground.includes('..')) throw new Error('Fundo do ambiente de trabalho inválido no backup.');
  }
  return { theme: next.theme, accent: next.accent, wallpaper: next.wallpaper, fontSize: Number(next.fontSize), animations: next.animations, sounds: next.sounds, language: next.language, desktopBackground: next.desktopBackground };
}

export function applyRestoredSettings(snapshot) {
  state = validateSettingsSnapshot(snapshot);
  apply();
  bus.emit('settings:changed', getSettings());
  return getSettings();
}

export function themeVars() {
  const vars = { '--os-accent': state.accent, '--os-font-size': `${state.fontSize}px` };
  for (const [k, v] of Object.entries(PALETTE[state.theme])) vars[`--os-${k}`] = v;
  return { theme: state.theme, accent: state.accent, vars };
}

function apply() {
  const root = document.documentElement;
  root.dataset.theme = state.theme;
  root.dataset.animations = state.animations ? 'on' : 'off';
  root.style.setProperty('--os-font-size', `${state.fontSize}px`);
  root.style.setProperty('--accent', state.accent);
  document.getElementById('desktop')?.style.removeProperty('background');
}

export async function initSettings() {
  const saved = await kv.get('system:settings');
  state = { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
  if (!Number.isFinite(state.fontSize)) state.fontSize = defaults.fontSize;
  state.fontSize = Math.min(20, Math.max(12, state.fontSize));
  if (!['pt-PT', 'en'].includes(state.language)) state.language = defaults.language;
  if (typeof state.desktopBackground !== 'string' || !state.desktopBackground.startsWith('/') || state.desktopBackground.includes('..')) state.desktopBackground = null;
  if (!(await kv.get('system:settings'))) await kv.set('system:settings', state);
  apply();
}

export async function updateSettings(patch = {}) {
  const next = { ...state };
  if ('theme' in patch) { if (!PALETTE[patch.theme]) throw new Error('Tema inválido.'); next.theme = patch.theme; }
  if ('accent' in patch) { if (!/^#[0-9a-f]{6}$/i.test(patch.accent)) throw new Error('Cor inválida (usa #rrggbb).'); next.accent = patch.accent; }
  if ('wallpaper' in patch) { if (!WALLPAPERS[patch.wallpaper]) throw new Error('Papel de parede inválido.'); next.wallpaper = patch.wallpaper; }
  if ('fontSize' in patch) { const size = Number(patch.fontSize); if (!Number.isFinite(size) || size < 12 || size > 20) throw new Error('Tamanho de texto inválido.'); next.fontSize = size; }
  if ('animations' in patch) next.animations = Boolean(patch.animations);
  if ('sounds' in patch) next.sounds = Boolean(patch.sounds);
  if ('language' in patch) { if (!['pt-PT', 'en'].includes(patch.language)) throw new Error('Idioma inválido.'); next.language = patch.language; }
  if ('desktopBackground' in patch) {
    const value = patch.desktopBackground;
    if (value === null) next.desktopBackground = null;
    else if (typeof value !== 'string' || !value.startsWith('/') || value.includes('..') || value.length > 1024) throw new Error('Fundo do ambiente de trabalho inválido.');
    else next.desktopBackground = value;
  }
  state = next;
  apply();
  await kv.set('system:settings', state);
  bus.emit('settings:changed', getSettings());
  return getSettings();
}
