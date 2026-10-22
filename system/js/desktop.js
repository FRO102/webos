import { launchApp } from './app-loader.js';
import { showContextMenu } from './context-menu.js';
import { closeAll } from './window-manager.js';

export function initDesktop(apps) {
  const ul = document.getElementById('desktop-icons');
  let positions = {};
  try { positions = JSON.parse(localStorage.getItem('webos:desktop-positions') || '{}'); } catch { localStorage.removeItem('webos:desktop-positions'); }
  const savePositions = () => { try { localStorage.setItem('webos:desktop-positions', JSON.stringify(Object.fromEntries([...ul.children].filter(li => li.dataset.key && li.style.order).map(li => [li.dataset.key, li.style.order])))); } catch {} };
  const select = (el, additive = false) => {
    if (!additive) ul.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
    el?.classList.toggle('selected', additive ? !el.classList.contains('selected') : true);
  };
  const selectedCount = () => ul.querySelectorAll('.selected').length;
  const createIcon = ({ label, icon, open, contextLabel = 'Abrir' }) => {
    const li = document.createElement('li');
    li.dataset.key = label;
    if (positions[label]) li.style.order = positions[label];
    const b = document.createElement('button');
    b.className = 'd-icon';
    const visual = document.createElement('span');
    visual.textContent = icon;
    visual.setAttribute('aria-hidden', 'true');
    b.append(visual, label);
    b.addEventListener('click', e => { e.stopPropagation(); select(b, e.ctrlKey || e.metaKey); if (matchMedia('(pointer: coarse)').matches) open(); });
    b.addEventListener('dblclick', open);
    b.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation(); select(b);
      showContextMenu(e.clientX, e.clientY, [{ label: contextLabel, action: open }]);
    });
    b.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    b.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const startX = e.clientX, startY = e.clientY;
      const move = ev => {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        li.style.position = 'relative';
        li.style.left = `${ev.clientX - startX}px`;
        li.style.top = `${ev.clientY - startY}px`;
      };
      const up = ev => {
        li.style.left = ''; li.style.top = '';
        li.style.order = Math.max(0, Math.round((ev.clientY - 12) / 82));
        savePositions();
        b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up);
      };
      b.addEventListener('pointermove', move); b.addEventListener('pointerup', up, { once: true });
    });
    li.append(b);
    ul.append(li);
  };
  createIcon({ label: 'Lixeira', icon: '🗑', open: () => launchApp('file-explorer', { path: '/.Trash' }), contextLabel: 'Abrir lixeira' });
  createIcon({ label: 'Pasta pessoal', icon: '⌂', open: () => launchApp('file-explorer', { path: '/home/user' }) });
  const appStore = apps.find(({ manifest: m }) => m.id === 'app-store');
  if (appStore) {
    const { manifest: m, base } = appStore;
    const open = () => launchApp(m.id);
    createIcon({ label: m.name, icon: '', open });
    const b = ul.lastElementChild.querySelector('.d-icon');
    const img = document.createElement('img');
    img.src = base + m.icon;
    img.alt = '';
    img.draggable = false;
    b.querySelector('span').replaceWith(img);
  }
  const browser = apps.find(({ manifest: m }) => m.id === 'browser');
  if (browser) {
    const { manifest: m, base } = browser;
    const open = () => launchApp(m.id);
    createIcon({ label: m.name, icon: '', open });
    const b = ul.lastElementChild.querySelector('.d-icon');
    const img = document.createElement('img');
    img.src = base + m.icon;
    img.alt = '';
    img.draggable = false;
    b.querySelector('span').replaceWith(img);
  }

  const portfolio = apps.find(({ manifest: m }) => m.id === 'portfolio');
  if (portfolio) {
    const { manifest: m, base } = portfolio;
    const open = () => launchApp(m.id);
    createIcon({ label: m.name, icon: '', open });
    const b = ul.lastElementChild.querySelector('.d-icon');
    const img = document.createElement('img');
    img.src = base + m.icon;
    img.alt = '';
    img.draggable = false;
    b.querySelector('span').replaceWith(img);
  }

  const snake = apps.find(({ manifest: m }) => m.id === 'snake');
  if (snake) {
    const { manifest: m, base } = snake;
    const open = () => launchApp(m.id);
    createIcon({ label: m.name, icon: '', open });
    const b = ul.lastElementChild.querySelector('.d-icon');
    const img = document.createElement('img');
    img.src = base + m.icon;
    img.alt = '';
    img.draggable = false;
    b.querySelector('span').replaceWith(img);
  }
  const desktop = document.getElementById('desktop');
  desktop.addEventListener('click', () => select(null));
  desktop.addEventListener('contextmenu', e => {
    e.preventDefault(); select(null);
    showContextMenu(e.clientX, e.clientY, [
      ...(selectedCount() > 1 ? [{ label: `Abrir ${selectedCount()} itens`, action: () => {} }] : apps.map(({ manifest: m }) => ({ label: `Abrir ${m.name}`, action: () => launchApp(m.id) }))),
      { separator: true },
      { label: 'Abrir Lixeira', action: () => launchApp('file-explorer', { path: '/.Trash' }) },
      { label: 'Atualizar desktop', action: () => location.reload() },
      { separator: true },
      { label: 'Fechar todas as janelas', action: closeAll },
    ]);
  });
}
