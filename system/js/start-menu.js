import { bus } from './event-bus.js';
import { launchApp } from './app-loader.js';
import { closeAll } from './window-manager.js';
import { logout, lockSession } from './boot.js';
import * as fs from './filesystem.js';
import { getRecentApps } from './app-loader.js';

export function initStartMenu(apps) {
  const btn = document.getElementById('start-btn');
  const menu = document.createElement('div');
  menu.id = 'start-menu';
  menu.hidden = true;
  menu.innerHTML = `
    <input type="search" placeholder="Pesquisar apps" aria-label="Pesquisar apps">
    <ul></ul>
    <footer>
      <button data-act="close-all">Fechar janelas</button>
      <button data-act="lock">Bloquear</button>
      <button data-act="logout">Terminar sessão</button>
      <button data-act="reload">Reiniciar</button>
    </footer>`;
  document.body.append(menu);
  const input = menu.querySelector('input'), list = menu.querySelector('ul');

  const filteredApps = () => {
    const q = input.value.trim().toLowerCase();
    return apps.filter(a => a.manifest.name.toLowerCase().includes(q));
  };
  const render = async () => {
    list.replaceChildren();
    const found = filteredApps();
    const files = await fs.search(input.value);
    const recentIds = getRecentApps();
    const recentApps = recentIds.map(id => apps.find(a => a.manifest.id === id)).filter(Boolean);
    const ordered = [...recentApps, ...found.filter(a => !recentIds.includes(a.manifest.id))];
    if (!ordered.length && !files.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nenhuma app encontrada.';
      list.append(li);
    }
    ordered.forEach(({ manifest: m, base }) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      const img = document.createElement('img');
      img.src = base + m.icon; img.alt = '';
      b.append(img, m.name);
      b.addEventListener('click', () => { close(); launchApp(m.id); });
      li.append(b);
      list.append(li);
    });
    files.forEach(file => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.textContent = `📄 ${file.name}`;
      b.title = file.path;
      b.addEventListener('click', () => { close(); bus.emit('file:open', { path: file.path }); });
      li.append(b);
      list.append(li);
    });
  };
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const open = () => {
    bus.emit('menus:close');
    input.value = '';
    render();
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    input.focus();
  };

  bus.on('start:toggle', () => (menu.hidden ? open() : close()));
  bus.on('menus:close', close);
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const a = filteredApps()[0]; if (a) { close(); launchApp(a.manifest.id); } }
    if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector('button')?.focus(); }
  });
  menu.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...list.querySelectorAll('button')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowUp' && i === 0) input.focus(); else items[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), items.length - 1)].focus();
  });
  menu.querySelector('footer').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act === 'close-all') { closeAll(); close(); }
    if (act === 'lock') { close(); lockSession(); }
    if (act === 'logout') logout(false);
    if (act === 'reload') logout(true);
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('#start-btn')) close();
  }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
  addEventListener('blur', close);
}
