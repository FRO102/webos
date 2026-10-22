import { bus } from './event-bus.js';

const wins = new Map();
let zTop = 10, counter = 0, activeId = null;
let currentWorkspace = Number(localStorage.getItem('webos:workspace') || 1);
const workspaceCount = 4;
const layer = () => document.getElementById('window-layer');

export const getWindows = () => [...wins.values()];
export const getActiveId = () => activeId;
export const getWorkspace = () => currentWorkspace;
export const getWorkspaceCount = () => workspaceCount;

export function createWindow({ title = 'Janela', width = 480, height = 320, minWidth = 240, minHeight = 140, content = '', flush = false } = {}) {
  const id = ++counter;
  const el = document.createElement('section');
  el.className = 'window';
  el.setAttribute('role', 'dialog');
  el.setAttribute('tabindex', '-1');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-label', title);
  const off = id % 8;
  const L = layer();
  const maxWidth = Math.max(1, L.clientWidth - 16);
  const maxHeight = Math.max(1, L.clientHeight - 16);
  width = Math.min(Math.max(1, Number(width) || 480), maxWidth);
  height = Math.min(Math.max(1, Number(height) || 320), maxHeight);
  el.style.cssText = `width:${width}px;height:${height}px;left:${50 + off * 30}px;top:${30 + off * 28}px`;
  el.innerHTML = `
    <header class="win-title"><span class="win-name"></span>
      <div class="win-btns">
        <button data-act="min" aria-label="Minimizar">—</button>
        <button data-act="max" aria-label="Maximizar">▢</button>
        <button data-act="close" aria-label="Fechar">✕</button>
      </div>
    </header>
    <div class="win-body"></div>
    ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<i class="rz rz-${d}" data-dir="${d}"></i>`).join('')}`;
  el.querySelector('.win-name').textContent = title;
  const body = el.querySelector('.win-body');
  body.classList.toggle('flush', flush);
  content instanceof Node ? body.append(content) : (body.innerHTML = content);

  const w = { id, el, body, title, minW: minWidth, minH: minHeight, maximized: false, minimized: false, workspace: currentWorkspace };
  wins.set(id, w);
  layer().append(el);

  el.addEventListener('pointerdown', () => focusWindow(id), true);
  el.querySelector('.win-btns').addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'min') minimizeWindow(id);
    if (act === 'max') toggleMaximize(id);
    if (act === 'close') closeWindow(id);
  });
  const bar = el.querySelector('.win-title');
  bar.addEventListener('pointerdown', e => startDrag(w, e));
  bar.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleMaximize(id); });
  el.querySelectorAll('.rz').forEach(h => h.addEventListener('pointerdown', e => startResize(w, e)));

  bus.emit('window:opened', { id, title });
  focusWindow(id);
  applyWorkspaceVisibility();
  if (matchMedia('(max-width: 640px)').matches) toggleMaximize(id); // ecrãs pequenos: janelas ocupam tudo
  return w;
}

export function focusWindow(id) {
  const w = wins.get(id);
  if (!w) return;
  if (w.workspace !== currentWorkspace) switchWorkspace(w.workspace);
  if (w.minimized) { w.minimized = false; w.el.classList.remove('minimized'); }
  wins.forEach(o => {
    o.el.classList.toggle('active', o === w);
    o.el.setAttribute('aria-modal', String(o === w));
  });
  w.el.style.zIndex = ++zTop;
  activeId = id;
  if (!w.el.contains(document.activeElement)) w.el.focus({ preventScroll: true });
  bus.emit('window:focused', { id });
}

export function minimizeWindow(id) {
  const w = wins.get(id);
  if (!w) return;
  w.minimized = true;
  w.el.classList.add('minimized');
  w.el.classList.remove('active');
  bus.emit('window:minimized', { id });
  if (activeId === id) { activeId = null; focusTopmost(); }
}

export function toggleMaximize(id) {
  const w = wins.get(id);
  if (!w) return;
  if (!w.maximized) w.restoreRect = { left: w.el.offsetLeft, top: w.el.offsetTop, width: w.el.offsetWidth, height: w.el.offsetHeight };
  w.maximized = !w.maximized;
  w.el.classList.toggle('maximized', w.maximized);
  w.el.querySelector('[data-act="max"]').textContent = w.maximized ? '❐' : '▢';
  if (!w.maximized && w.restoreRect) Object.assign(w.el.style, Object.fromEntries(Object.entries(w.restoreRect).map(([key, value]) => [key, `${value}px`])));
  bus.emit('window:state', { id, maximized: w.maximized });
}

export function closeWindow(id) {
  const w = wins.get(id);
  if (!w) return;
  w.el.classList.add('closing');
  setTimeout(() => w.el.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120);
  wins.delete(id);
  bus.emit('window:closed', { id });
  if (activeId === id) { activeId = null; focusTopmost(); }
}

function applyWorkspaceVisibility() {
  wins.forEach(w => w.el.classList.toggle('other-workspace', w.workspace !== currentWorkspace));
  const active = getWindows().find(w => w.workspace === currentWorkspace && !w.minimized);
  if (!active && activeId != null && wins.get(activeId)?.workspace !== currentWorkspace) {
    activeId = null;
    bus.emit('window:focused', { id: null });
  }
}

export function switchWorkspace(workspace) {
  const next = Math.min(workspaceCount, Math.max(1, Number(workspace) || 1));
  currentWorkspace = next;
  localStorage.setItem('webos:workspace', String(next));
  applyWorkspaceVisibility();
  bus.emit('workspace:changed', { workspace: next });
}

function focusTopmost() {
  const top = getWindows().filter(w => !w.minimized).sort((a, b) => a.el.style.zIndex - b.el.style.zIndex).pop();
  if (top) focusWindow(top.id); else bus.emit('window:focused', { id: null });
}

let preview = null;
function showSnap(zone) {
  if (!zone) { preview?.remove(); preview = null; return; }
  if (!preview) { preview = document.createElement('div'); preview.id = 'snap-preview'; document.body.append(preview); }
  const L = layer(), W = L.clientWidth, H = L.clientHeight;
  const r = zone === 'top' ? [0, 0, W, H] : zone === 'left' ? [0, 0, W / 2, H] : [W / 2, 0, W / 2, H];
  Object.assign(preview.style, { left: r[0] + 'px', top: r[1] + 'px', width: r[2] + 'px', height: r[3] + 'px' });
}
const zoneAt = (x, y) => (y <= 6 ? 'top' : x <= 6 ? 'left' : x >= innerWidth - 7 ? 'right' : null);

// zone: 'left' | 'right' | 'top' (maximizar) | 'restore'
export function snapWindow(id, zone) {
  const w = wins.get(id);
  if (!w || w.minimized) return;
  if (zone === 'restore') {
    if (w.maximized) return toggleMaximize(id);
    if (w.snapped && w.restoreRect) {
      for (const [k, v] of Object.entries(w.restoreRect)) w.el.style[k] = v + 'px';
      w.snapped = false;
    }
    return;
  }
  if (zone === 'top') { if (!w.maximized) toggleMaximize(id); return; }
  if (w.maximized) toggleMaximize(id);
  const L = layer(), W = L.clientWidth, H = L.clientHeight;
  if (!w.snapped) w.restoreRect = { left: w.el.offsetLeft, top: w.el.offsetTop, width: w.el.offsetWidth, height: w.el.offsetHeight };
  Object.assign(w.el.style, { left: (zone === 'left' ? 0 : W / 2) + 'px', top: '0px', width: W / 2 + 'px', height: H + 'px' });
  w.snapped = true;
}

function startDrag(w, e) {
  if (e.target.closest('button')) return;
  const bar = e.currentTarget, sx = e.clientX, sy = e.clientY;
  let started = false, dx = 0, dy = 0, zone = null;
  bar.setPointerCapture(e.pointerId);
  const begin = () => { // sair de maximizado/encaixado mantendo o ponteiro na mesma zona da barra
    const r = w.el.getBoundingClientRect(), ratio = (sx - r.left) / r.width;
    if (w.maximized) toggleMaximize(w.id);
    if (w.snapped && w.restoreRect) { w.el.style.width = w.restoreRect.width + 'px'; w.el.style.height = w.restoreRect.height + 'px'; }
    w.snapped = false;
    dx = ratio * w.el.offsetWidth;
    dy = Math.min(sy - r.top, 18);
    started = true;
  };
  const move = ev => {
    if (!started) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return; begin(); }
    const maxY = layer().clientHeight - 36;
    w.el.style.left = Math.min(Math.max(ev.clientX - dx, 80 - w.el.offsetWidth), innerWidth - 80) + 'px';
    w.el.style.top = Math.min(Math.max(ev.clientY - dy, 0), maxY) + 'px';
    zone = zoneAt(ev.clientX, ev.clientY);
    showSnap(zone);
  };
  const up = () => {
    bar.removeEventListener('pointermove', move);
    bar.removeEventListener('pointerup', up);
    bar.removeEventListener('pointercancel', up);
    showSnap(null);
    if (started && zone) snapWindow(w.id, zone);
  };
  bar.addEventListener('pointermove', move);
  bar.addEventListener('pointerup', up);
  bar.addEventListener('pointercancel', up);
}

function startResize(w, e) {
  e.preventDefault();
  if (w.maximized) return;
  w.snapped = false;
  const h = e.currentTarget, dir = h.dataset.dir;
  const s = { x: e.clientX, y: e.clientY, l: w.el.offsetLeft, t: w.el.offsetTop, w: w.el.offsetWidth, h: w.el.offsetHeight };
  h.setPointerCapture(e.pointerId);
  const move = ev => {
    const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
    let l = s.l, t = s.t, wd = s.w, ht = s.h;
    if (dir.includes('e')) wd = Math.max(w.minW, s.w + dx);
    if (dir.includes('s')) ht = Math.max(w.minH, s.h + dy);
    if (dir.includes('w')) { wd = Math.max(w.minW, s.w - dx); l = s.l + s.w - wd; }
    if (dir.includes('n')) { t = Math.max(0, Math.min(s.t + dy, s.t + s.h - w.minH)); ht = s.t + s.h - t; }
    Object.assign(w.el.style, { left: l + 'px', top: t + 'px', width: wd + 'px', height: ht + 'px' });
  };
  const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); };
  h.addEventListener('pointermove', move);
  h.addEventListener('pointerup', up);
}

export function setTitle(id, title) {
  const w = wins.get(id);
  if (!w) return;
  w.title = title;
  w.el.querySelector('.win-name').textContent = title;
  w.el.setAttribute('aria-label', title);
  bus.emit('window:title', { id, title });
}

export function resizeWindow(id, width, height) {
  const w = wins.get(id);
  if (!w || w.maximized) return;
  const L = layer();
  const maxWidth = Math.max(1, L.clientWidth);
  const maxHeight = Math.max(1, L.clientHeight);
  const minWidth = Math.min(w.minW, maxWidth);
  const minHeight = Math.min(w.minH, maxHeight);
  w.el.style.width = Math.min(Math.max(+width || minWidth, minWidth), maxWidth) + 'px';
  w.el.style.height = Math.min(Math.max(+height || minHeight, minHeight), maxHeight) + 'px';
}

export function moveWindow(id, dx, dy) {
  const w = wins.get(id);
  if (!w || w.maximized || w.minimized) return;
  const L = layer();
  const maxLeft = Math.max(0, L.clientWidth - w.el.offsetWidth);
  const maxTop = Math.max(0, L.clientHeight - w.el.offsetHeight);
  w.el.style.left = Math.min(maxLeft, Math.max(0, w.el.offsetLeft + Number(dx || 0))) + 'px';
  w.el.style.top = Math.min(maxTop, Math.max(0, w.el.offsetTop + Number(dy || 0))) + 'px';
}

export const closeAll = () => getWindows().forEach(w => closeWindow(w.id));

addEventListener('keydown', e => {
  if (e.key === 'Escape') { const id = getActiveId(); if (id != null) minimizeWindow(id); }
  if (e.altKey && e.key === 'F4') { e.preventDefault(); const id = getActiveId(); if (id != null) closeWindow(id); }
  if (e.metaKey || e.ctrlKey) return;
  const id = getActiveId();
  if (id == null) return;
  if (e.altKey && e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); switchWorkspace(currentWorkspace - 1); return; }
  if (e.altKey && e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); switchWorkspace(currentWorkspace + 1); return; }
  if (e.key === 'F11') { e.preventDefault(); toggleMaximize(id); return; }
  if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); toggleMaximize(id); return; }
  if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); snapWindow(id, 'restore'); return; }
  if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); snapWindow(id, 'left'); return; }
  if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); snapWindow(id, 'right'); return; }
});
