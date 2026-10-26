import { launchApp } from './app-loader.js';
import { showContextMenu } from './context-menu.js';
import { getCurrentUser } from './users.js';
import { bus } from './event-bus.js';
import { list as listFiles, read as readDesktopFile, stat as statDesktopFile, write as writeFile, exists as fileExists, mkdir as makeDirectory, trash as trashFile, remove as removeFile } from './filesystem.js';
import { getSettings, WALLPAPERS } from './settings.js';

export function initDesktop(apps) {
  const ul = document.getElementById('desktop-icons');
  const desktop = document.getElementById('desktop');
  let openFolder = null;
  let positions = {};
  let desktopBackgroundUrl = null;
  const applyDesktopBackground = async () => {
    if (desktopBackgroundUrl) { URL.revokeObjectURL(desktopBackgroundUrl); desktopBackgroundUrl = null; }
    const settings = getSettings();
    if (settings.desktopBackground) {
      try {
        const content = await readDesktopFile(settings.desktopBackground);
        const blob = content instanceof Blob ? content : new Blob([content], { type: (await statDesktopFile(settings.desktopBackground)).mime || 'application/octet-stream' });
        desktopBackgroundUrl = URL.createObjectURL(blob);
        desktop.style.background = `url("${desktopBackgroundUrl}") center / cover no-repeat`;
        return;
      } catch (error) {
        console.warn('Não foi possível aplicar o fundo personalizado do ambiente de trabalho.', error);
      }
    }
    desktop.style.background = (WALLPAPERS[settings.wallpaper] ?? WALLPAPERS.aurora).css;
  };
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
      const items = [{ label: contextLabel, action: open }];

      if (key.startsWith('filesystem:')) {
        const path = key.slice('filesystem:'.length);
        const entry = [...desktopEntries.values()].find(item => item.path === path);
        if (entry) {
          items.push({ separator: true });
          if (entry.path.startsWith('/.Trash/')) {
            items.push({
              label: 'Apagar permanentemente',
              action: async () => {
                if (!confirm(`Apagar permanentemente "${entry.name}"?`)) return;
                try { await removeFile(entry.path); }
                catch (err) { console.error(err); }
              }
            });
          } else {
            items.push({
              label: 'Mover para a lixeira',
              action: async () => {
                if (!confirm(`Mover "${entry.name}" para a lixeira?`)) return;
                try { await trashFile(entry.path); }
                catch (err) { console.error(err); }
              }
            });
          }
        }
      }

      showContextMenu(e.clientX, e.clientY, items);
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

  const MAX_DROP_FILES = 100;
  const MAX_DROP_FILE_SIZE = 100 * 1024 * 1024;
  const normalizeDroppedName = name => String(name ?? '').replace(/\\/g, '/').split('/').filter(Boolean).pop()?.replace(/[\u0000-\u001f]/g, '') || '';
  const safeDroppedName = name => {
    const value = normalizeDroppedName(name).trim();
    if (!value || value === '.' || value === '..') return '';
    return value.slice(0, 255);
  };
  const collisionName = async (targetDir, name) => {
    const dotIndex = name.lastIndexOf('.');
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
    const extension = dotIndex > 0 ? name.slice(dotIndex) : '';
    let candidate = name;
    let counter = 1;
    while (await fileExists(`${targetDir}/${candidate}`)) {
      candidate = `${base} (${counter})${extension}`;
      counter += 1;
      if (counter > 9999) break;
    }
    return candidate;
  };
  const importFilesToDirectory = async (files, targetDir = desktopPath) => {
    const droppedFiles = [...files];
    const list = droppedFiles.slice(0, MAX_DROP_FILES);
    let imported = 0;
    const failures = [];
    if (droppedFiles.length > MAX_DROP_FILES) failures.push(`${droppedFiles.length - MAX_DROP_FILES} ficheiro(s) excedem o limite de ${MAX_DROP_FILES}.`);
    for (const file of list) {
      if (!file || typeof file.name !== 'string') continue;
      if (file.size > MAX_DROP_FILE_SIZE) { failures.push(`${file.name}: ficheiro demasiado grande.`); continue; }
      const name = safeDroppedName(file.name);
      if (!name) { failures.push(`${file.name}: nome inválido.`); continue; }
      try {
        const finalName = await collisionName(targetDir, name);
        await writeFile(`${targetDir}/${finalName}`, file, file.type || 'application/octet-stream');
        imported++;
      } catch (error) {
        failures.push(`${file.name}: ${error?.message || 'erro ao importar.'}`);
      }
    }
    if (imported > 0) {
      bus.emit('notify', { app: 'WebOS', message: imported === 1 ? '1 ficheiro adicionado ao WebOS.' : `${imported} ficheiros adicionados ao WebOS.` });
      if (targetDir === desktopPath) renderDesktopEntries();
    }
    if (failures.length) {
      bus.emit('notify', { app: 'WebOS', message: `${failures.length} ficheiro(s) não importado(s): ${failures.slice(0, 3).join(' · ')}${failures.length > 3 ? ' …' : ''}` });
    }
  };

  const hasFiles = dt => !!dt && Array.from(dt.types || []).includes('Files');

  const enableFolderDrop = (node, folderPath) => {
    let dragDepth = 0;
    const clearTarget = () => {
      dragDepth = 0;
      node.classList.remove('is-folder-drop-target');
    };
    node.addEventListener('dragenter', event => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepth += 1;
      node.classList.add('is-folder-drop-target');
      hideDropOverlay();
    });
    node.addEventListener('dragover', event => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      node.classList.add('is-folder-drop-target');
    });
    node.addEventListener('dragleave', event => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        clearTarget();
        showDropOverlay();
      }
    });
    node.addEventListener('drop', async event => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      clearTarget();
      hideDropOverlay();
      const files = event.dataTransfer?.files;
      if (files?.length) await importFilesToDirectory(files, folderPath);
    });
    return node;
  };

  // overlay visual para indicar que se pode largar ficheiros
  const dropOverlay = document.createElement('div');
  dropOverlay.id = 'desktop-drop-overlay';
  dropOverlay.setAttribute('role', 'status');
  dropOverlay.setAttribute('aria-live', 'polite');
  dropOverlay.hidden = true;
  dropOverlay.textContent = 'Arraste ficheiros para adicionar ao WebOS';
  desktop.append(dropOverlay);

  let dragDepth = 0;
  const showDropOverlay = () => { if (dropOverlay.hidden) { dropOverlay.hidden = false; desktop.classList.add('is-drop-target'); } };
  const hideDropOverlay = () => { dropOverlay.hidden = true; desktop.classList.remove('is-drop-target'); };
  desktop.addEventListener('dragenter', e => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    dragDepth += 1;
    showDropOverlay();
  });
  desktop.addEventListener('dragover', e => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    showDropOverlay();
  });
  desktop.addEventListener('dragleave', e => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) hideDropOverlay();
  });
  desktop.addEventListener('drop', async e => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    hideDropOverlay();
    const files = e.dataTransfer?.files;
    if (files && files.length) await importFilesToDirectory(files, desktopPath);
  });

  // captura global de segurança para drops sobre iframes/janelas
  document.addEventListener('dragover', e => {
    if (hasFiles(e.dataTransfer)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }
  }, true);
  document.addEventListener('drop', e => {
    if (!hasFiles(e.dataTransfer)) return;
    e.preventDefault();
    const target = e.target instanceof HTMLIFrameElement ? e.target : document.elementFromPoint(e.clientX, e.clientY)?.closest('iframe');
    if (target?.dataset.appId === 'file-explorer' && target.contentWindow) {
      target.contentWindow.postMessage({ type: 'webos:file-drop', files: [...(e.dataTransfer?.files ?? [])] }, location.origin);
      e.stopPropagation();
    }
    dragDepth = 0;
    hideDropOverlay();
    desktop.querySelectorAll('.is-folder-drop-target').forEach(node => node.classList.remove('is-folder-drop-target'));
  }, true);
  document.addEventListener('dragleave', e => {
    if (!hasFiles(e.dataTransfer) || e.relatedTarget) return;
    dragDepth = 0;
    hideDropOverlay();
    desktop.querySelectorAll('.is-folder-drop-target').forEach(node => node.classList.remove('is-folder-drop-target'));
  }, true);

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
      const fsIcon = ul.lastElementChild;
      if (entry.type === 'dir') enableFolderDrop(fsIcon, entry.path);
    });
  };
    bus.on('settings:changed', () => { applyDesktopBackground(); });

  // Aplica novamente caso o ficheiro de fundo seja alterado
  bus.on('fs:changed', ({ path }) => {
    if (getSettings().desktopBackground && (path === getSettings().desktopBackground || path.startsWith(`${getSettings().desktopBackground}/`))) applyDesktopBackground();
  });
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

  applyDesktopBackground();
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
