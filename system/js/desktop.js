import { launchApp } from './app-loader.js';
import { showContextMenu } from './context-menu.js';
import { getCurrentUser } from './users.js';
import { bus } from './event-bus.js';
import { list as listFiles } from './filesystem.js';

export function initDesktop(apps) {
  const ul = document.getElementById('desktop-icons');
  const desktop = document.getElementById('desktop');
  let openFolder = null;
  let positions = {};
  try { positions = JSON.parse(localStorage.getItem('webos:desktop-positions') || '{}'); } catch { localStorage.removeItem('webos:desktop-positions'); }
  const savePositions = () => { try { localStorage.setItem('webos:desktop-positions', JSON.stringify(Object.fromEntries([...ul.children].filter(li => li.dataset.key && li.style.order).map(li => [li.dataset.key, li.style.order])))); } catch {} };
  const select = (el, additive = false) => {
    if (!additive) ul.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
    el?.classList.toggle('selected', additive ? !el.classList.contains('selected') : true);
  };
  const createIcon = ({ label, icon, open, contextLabel = 'Abrir', key = label, className = '' }) => {
    const li = document.createElement('li');
    li.dataset.key = key;
    if (className) li.classList.add(className);
    if (positions[key]) li.style.order = positions[key];
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
      let dragged = false;
      const move = ev => {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        dragged = true;
        li.style.position = 'relative';
        li.style.left = `${ev.clientX - startX}px`;
        li.style.top = `${ev.clientY - startY}px`;
      };
      const up = ev => {
        li.style.left = ''; li.style.top = '';
        if (dragged) {
          li.style.order = Math.max(0, Math.round((ev.clientY - 12) / 82));
          savePositions();
        }
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerup', up);
        b.removeEventListener('pointercancel', cancel);
      };
      const cancel = () => {
        li.style.left = ''; li.style.top = '';
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerup', up);
      };
      b.addEventListener('pointermove', move); b.addEventListener('pointerup', up, { once: true });
      b.addEventListener('pointercancel', cancel, { once: true });
    });
    li.append(b);
    ul.append(li);
    return li;
  };
  const closeFolder = () => {
    openFolder?.remove();
    openFolder = null;
  };
  const createAppFolder = category => {
    let folderButton;
    const folder = createIcon({
      label: category.name,
      icon: '📁',
      contextLabel: 'Abrir pasta',
      open: event => {
      if (openFolder?.dataset.categoryId === category.id) return closeFolder();
      closeFolder();
      const categoryApps = apps.filter(app => app.manifest.category?.id === category.id);
      const panel = document.createElement('section');
      panel.className = 'desktop-folder-popup';
      panel.dataset.categoryId = category.id;
      panel.setAttribute('role', 'group');
      panel.setAttribute('aria-label', category.name);
      const heading = document.createElement('h2');
      heading.textContent = category.name;
      const list = document.createElement('div');
      list.className = 'desktop-folder-apps';
      categoryApps.forEach(({ manifest, base }) => {
        const button = document.createElement('button');
        const image = document.createElement('img');
        image.src = base + manifest.icon;
        image.alt = '';
        image.draggable = false;
        const name = document.createElement('span');
        name.textContent = manifest.name;
        button.append(image, name);
        button.onclick = () => { closeFolder(); launchApp(manifest.id); };
        list.append(button);
      });
      panel.append(heading, list);
      document.body.append(panel);
      const iconRect = (event?.currentTarget ?? folderButton).getBoundingClientRect();
      const panelWidth = Math.min(260, window.innerWidth - 24);
      panel.style.left = `${Math.min(iconRect.right + 8, window.innerWidth - panelWidth - 12)}px`;
      panel.style.top = `${Math.min(iconRect.top, window.innerHeight - Math.min(panel.scrollHeight, window.innerHeight - 24) - 12)}px`;
      openFolder = panel;
      }
    });
    folderButton = folder.querySelector('button');
  };

  createIcon({ label: 'Lixeira', icon: '🗑️', open: () => launchApp('file-explorer', { path: '/.Trash' }), contextLabel: 'Abrir lixeira' });
  createIcon({ label: 'Pasta pessoal', icon: '🏠', open: () => launchApp('file-explorer', { path: `/home/${getCurrentUser()?.id || 'user'}` }) });
  const systemCategory = apps.find(app => app.manifest.category?.id === 'system')?.manifest.category;
  const gamesCategory = apps.find(app => app.manifest.category?.id === 'games')?.manifest.category;
  if (gamesCategory) createAppFolder(gamesCategory);
  if (systemCategory) createAppFolder(systemCategory);

  const home = `/home/${getCurrentUser()?.id || 'user'}`;
  const desktopPath = `${home}/Desktop`;
  const desktopEntries = new Map();
  let desktopRenderSequence = 0;
  const entryIcon = entry => {
    if (entry.type === 'dir') return '📁';
    const extension = entry.name.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return '🖼️';
    if (extension === 'pdf') return '📕';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(extension)) return '🎵';
    if (['mp4', 'webm', 'mov'].includes(extension)) return '🎬';
    if (['zip', 'rar', '7z', 'tar'].includes(extension)) return '🗜️';
    return '📄';
  };
  const openEntry = entry => {
    if (entry.type === 'dir') launchApp('file-explorer', { path: entry.path });
    else bus.emit('file:open', { path: entry.path });
  };
  const renderDesktopEntries = async () => {
    const renderId = ++desktopRenderSequence;
    let entries;
    try { entries = await listFiles(desktopPath); }
    catch (error) { console.warn('Não foi possível listar a pasta Desktop.', error); return; }
    if (renderId !== desktopRenderSequence) return;

    ul.querySelectorAll('[data-filesystem-entry]').forEach(icon => icon.remove());
    desktopEntries.clear();
    entries.forEach(entry => {
      const key = `filesystem:${entry.path}`;
      desktopEntries.set(key, entry);
      createIcon({
        key,
        label: entry.name,
        icon: entryIcon(entry),
        className: 'filesystem-entry',
        contextLabel: entry.type === 'dir' ? 'Abrir pasta' : 'Abrir ficheiro',
        open: () => openEntry(entry),
      }).dataset.filesystemEntry = '';
    });
  };
  renderDesktopEntries();
  bus.on('fs:changed', ({ path }) => {
    if (path === desktopPath || path.startsWith(`${desktopPath}/`)) renderDesktopEntries();
  });

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

  desktop.addEventListener('click', () => select(null));
  document.addEventListener('pointerdown', event => {
    if (openFolder && !openFolder.contains(event.target)) closeFolder();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeFolder(); });
  desktop.addEventListener('contextmenu', e => {
    e.preventDefault(); select(null);
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Novo ficheiro', action: () => launchApp('file-explorer', { path: desktopPath, action: 'new-file' }) },
      { label: 'Nova pasta', action: () => launchApp('file-explorer', { path: desktopPath, action: 'new-folder' }) },
      { separator: true },
      { label: 'Atualizar desktop', action: () => location.reload() },
      { label: 'Abrir Pasta pessoal', action: () => launchApp('file-explorer', { path: `/home/${getCurrentUser()?.id || 'user'}` }) },
      { label: 'Abrir Lixeira', action: () => launchApp('file-explorer', { path: '/.Trash' }) },
    ]);
  });
}
