import { bus } from './event-bus.js';

let menu = null;
const hide = () => { menu?.remove(); menu = null; };
bus.on('menus:close', hide);

// items: [{ label, action, disabled } | { separator: true }]
export function showContextMenu(x, y, items) {
  bus.emit('menus:close');
  menu = document.createElement('ul');
  menu.id = 'context-menu';
  menu.setAttribute('role', 'menu');
  items.forEach(it => {
    const li = document.createElement('li');
    if (it.separator) { li.className = 'sep'; li.setAttribute('role', 'separator'); }
    else {
      const b = document.createElement('button');
      b.setAttribute('role', 'menuitem');
      b.textContent = it.label;
      b.disabled = !!it.disabled;
      b.addEventListener('click', () => { hide(); it.action?.(); });
      li.append(b);
    }
    menu.append(li);
  });
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(0, Math.min(x, innerWidth - r.width - 4)) + 'px';
  menu.style.top = Math.max(0, Math.min(y, innerHeight - r.height - 4)) + 'px';
  menu.querySelector('button:not(:disabled)')?.focus();
}

document.addEventListener('pointerdown', e => { if (menu && !menu.contains(e.target)) hide(); }, true);
addEventListener('blur', hide); // clique dentro de um iframe tira o foco à página
addEventListener('keydown', e => {
  if (!menu) return;
  if (e.key === 'Escape') return hide();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = [...menu.querySelectorAll('button:not(:disabled)')];
    const i = items.indexOf(document.activeElement);
    items.at((i + (e.key === 'ArrowDown' ? 1 : -1)) % items.length)?.focus();
  }
});
