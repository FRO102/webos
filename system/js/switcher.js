import { bus } from './event-bus.js';
import { getWindows, focusWindow, snapWindow, getActiveId } from './window-manager.js';

let el = null, list = [], idx = 0;
const close = () => { el?.remove(); el = null; };

function step(back) {
  if (!el) {
    list = getWindows().sort((a, b) => b.el.style.zIndex - a.el.style.zIndex); // mais recente primeiro
    if (list.length < 2) return;
    idx = 0;
    el = document.createElement('div');
    el.id = 'switcher';
    el.setAttribute('role', 'status');
    list.forEach(w => { const s = document.createElement('span'); s.textContent = w.title; el.append(s); });
    document.body.append(el);
  }
  idx = (idx + (back ? -1 : 1) + list.length) % list.length;
  [...el.children].forEach((c, i) => c.classList.toggle('sel', i === idx));
  el.setAttribute('aria-label', `Janela: ${list[idx].title}`);
}
function commit() {
  if (!el) return;
  const w = list[idx];
  close();
  focusWindow(w.id);
}

// teclas reenviadas pelas apps (iframes) via SDK
const SNAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'top', ArrowDown: 'restore' };
const snapKey = code => { const id = getActiveId(); if (id != null) snapWindow(id, SNAP[code]); };
bus.on('switcher:key', ({ type, code, shift }) => {
  if (type === 'down') SNAP[code] ? snapKey(code) : step(shift);
  if (type === 'up') commit();
});

export function initSwitcher() {
  addEventListener('keydown', e => {
    if (e.altKey && e.code === 'KeyQ') { e.preventDefault(); step(e.shiftKey); }
    else if (e.altKey && SNAP[e.code]) { e.preventDefault(); snapKey(e.code); }
    else if (e.key === 'Escape' && el) close();
  });
  addEventListener('keyup', e => { if (e.key === 'Alt') { e.preventDefault(); commit(); } });
  addEventListener('blur', close);
}
