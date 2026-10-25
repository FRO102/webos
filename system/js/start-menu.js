import { bus } from './event-bus.js';
import { launchApp } from './app-loader.js';
import { closeAll } from './window-manager.js';
import { logout, lockSession } from './boot.js';
import * as fs from './filesystem.js';
import { getRecentApps } from './app-loader.js';
import { localeData, translate } from './i18n.js';

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
    return apps.filter(a => {
      const category = a.manifest.category;
      return `${a.manifest.name} ${translate(a.manifest.name)} ${category.name} ${category.nameEn}`.toLowerCase().includes(q);
    });
  };
  const categoryLabel = category => localeData().language === 'en' ? category.nameEn : category.name;
  const createAppItem = ({ manifest, base }) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const image = document.createElement('img');
    image.src = base + manifest.icon;
    image.alt = '';
    button.append(image, translate(manifest.name));
    button.addEventListener('click', () => { close(); launchApp(manifest.id); });
    li.append(button);
    return li;
  };
  const render = async () => {
    list.replaceChildren();
    const found = filteredApps();
    const files = await fs.search(input.value);
    const recentIds = getRecentApps();
    const recentApps = recentIds.map(id => found.find(app => app.manifest.id === id)).filter(Boolean);
    const categorizedApps = found.filter(app => !recentIds.includes(app.manifest.id));
    if (!recentApps.length && !categorizedApps.length && !files.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nenhuma app encontrada.';
      list.append(li);
    }
    if (recentApps.length) {
      const heading = document.createElement('li');
      heading.className = 'section-heading';
      heading.textContent = translate('Recentes');
      list.append(heading, ...recentApps.map(createAppItem));
    }
    const categories = new Map();
    categorizedApps.forEach(app => {
      const category = app.manifest.category;
      if (!categories.has(category.id)) categories.set(category.id, { category, apps: [] });
      categories.get(category.id).apps.push(app);
    });
    [...categories.values()].sort((a, b) => categoryLabel(a.category).localeCompare(categoryLabel(b.category))).forEach(({ category, apps: categoryApps }) => {
      if (!categoryApps.length) return;

      const group = document.createElement('li');
      group.className = 'category-group';
      const details = document.createElement('details');
      details.open = input.value.trim().length > 0;
      const summary = document.createElement('summary');
      summary.textContent = `${categoryLabel(category)} · ${categoryApps.length}`;
      const groupList = document.createElement('ul');
      groupList.append(...categoryApps.map(createAppItem));
      details.append(summary, groupList);
      group.append(details);
      list.append(group);
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
