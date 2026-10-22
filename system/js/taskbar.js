import { bus } from './event-bus.js';
import { focusWindow, minimizeWindow, toggleMaximize, closeWindow, getWindows, getActiveId, getWorkspace, getWorkspaceCount, switchWorkspace } from './window-manager.js';
import { showContextMenu } from './context-menu.js';
import { launchApp } from './app-loader.js';

export function initTaskbar() {
  const list = document.getElementById('task-list');
  const clock = document.getElementById('clock');
  const sound = document.getElementById('sound-status');
  const workspaces = document.getElementById('workspaces');
  const btns = new Map();

  bus.on('window:opened', ({ id, title }) => {
    const b = document.createElement('button');
    b.className = 'task-btn';
    b.textContent = title;
    b.title = title;
    b.addEventListener('click', () => {
      const w = getWindows().find(x => x.id === id);
      if (w.minimized || getActiveId() !== id) focusWindow(id); else minimizeWindow(id);
    });
    b.addEventListener('contextmenu', e => {
      e.preventDefault();
      const w = getWindows().find(x => x.id === id);
      showContextMenu(e.clientX, e.clientY, [
        w.minimized ? { label: 'Restaurar', action: () => focusWindow(id) } : { label: 'Minimizar', action: () => minimizeWindow(id) },
        { label: w.maximized ? 'Repor tamanho' : 'Maximizar', action: () => { toggleMaximize(id); focusWindow(id); } },
        { separator: true },
        { label: 'Fechar janela', action: () => closeWindow(id) },
      ]);
    });
    btns.set(id, b);
    list.append(b);
  });
  bus.on('window:closed', ({ id }) => { btns.get(id)?.remove(); btns.delete(id); });
  bus.on('window:title', ({ id, title }) => { const b = btns.get(id); if (b) { b.textContent = title; b.title = title; } });
  const refresh = () => getWindows().forEach(w => {
    const button = btns.get(w.id);
    if (!button) return;
    button.hidden = w.workspace !== getWorkspace();
    button.classList.toggle('active', w.id === getActiveId());
    button.classList.toggle('minimized', w.minimized);
    button.setAttribute('aria-pressed', String(w.id === getActiveId()));
  });
  bus.on('window:focused', refresh);
  bus.on('window:minimized', refresh);
  bus.on('workspace:changed', refresh);
  const renderWorkspaces = () => {
    workspaces.replaceChildren();
    for (let i = 1; i <= getWorkspaceCount(); i++) {
      const b = document.createElement('button');
      b.className = 'workspace-btn';
      b.textContent = i;
      b.title = `Área de trabalho ${i}`;
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(i === getWorkspace()));
      b.onclick = () => switchWorkspace(i);
      workspaces.append(b);
    }
  };
  bus.on('workspace:changed', renderWorkspaces);
  renderWorkspaces();

  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) + '\n' +
      d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  tick();
  setInterval(tick, 15000);
  clock.addEventListener('click', () => launchApp('clock')); // o relógio da barra abre a app
  clock.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launchApp('clock'); } });
  sound?.addEventListener('click', () => {
    const muted = sound.dataset.muted === 'true';
    sound.dataset.muted = String(!muted);
    sound.textContent = muted ? '◖' : '◌';
    sound.title = muted ? 'Som ligado' : 'Som desligado';
    sound.setAttribute('aria-label', sound.title);
    bus.emit('sound:changed', { muted: !muted });
  });

  document.getElementById('start-btn').addEventListener('click', () => bus.emit('start:toggle'));
}
