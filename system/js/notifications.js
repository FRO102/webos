import { bus } from './event-bus.js';
import { kv } from './storage.js';
import { localeFor } from './i18n.js';
import { getSettings } from './settings.js';

export async function initNotifications() {
  const box = document.createElement('div');
  box.id = 'toasts';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  document.body.append(box);
  const button = document.getElementById('notification-btn');
  const panel = document.createElement('aside');
  panel.id = 'notification-center';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Centro de notificações');
  panel.innerHTML = '<header><strong>Notificações</strong><button aria-label="Limpar notificações">Limpar</button></header><div class="notification-list"></div>';
  document.body.append(panel);
  const history = (await kv.get('system:notifications')) || [];
  let unread = Number(await kv.get('system:notifications:unread')) || 0;
  const list = panel.querySelector('.notification-list');
  const close = () => { panel.hidden = true; button?.setAttribute('aria-expanded', 'false'); };
  const render = () => {
    list.replaceChildren();
    if (!history.length) { const empty = document.createElement('p'); empty.textContent = 'Nenhuma notificação.'; list.append(empty); return; }
    history.forEach(({ app, message, time, timeAt }) => { const item = document.createElement('article'); item.innerHTML = '<strong></strong><span></span><time></time>'; item.querySelector('strong').textContent = app; item.querySelector('span').textContent = message; item.querySelector('time').textContent = timeAt ? new Date(timeAt).toLocaleTimeString(localeFor(getSettings().language), { hour: '2-digit', minute: '2-digit' }) : time; list.append(item); });
  };
  const updateBadge = () => { button?.setAttribute('data-unread', unread ? String(unread) : ''); button?.setAttribute('aria-label', unread ? `Centro de notificações, ${unread} não lidas` : 'Centro de notificações'); };
  button?.addEventListener('click', async () => { panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) { unread = 0; await kv.set('system:notifications:unread', 0); updateBadge(); render(); } });
  panel.querySelector('header button').addEventListener('click', async () => { history.length = 0; unread = 0; await kv.set('system:notifications', history); await kv.set('system:notifications:unread', 0); updateBadge(); render(); });
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && e.target !== button) close(); }, true);

  bus.on('notify', ({ app, message }) => {
    history.unshift({ app, message, timeAt: Date.now(), time: new Date().toLocaleTimeString(localeFor(getSettings().language), { hour: '2-digit', minute: '2-digit' }) });
    history.splice(20);
    unread++;
    kv.set('system:notifications', history).catch(() => {});
    kv.set('system:notifications:unread', unread).catch(() => {});
    updateBadge();
    const t = document.createElement('button');
    t.className = 'toast';
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = app;
    span.textContent = message;
    t.append(strong, span);
    const dismiss = () => t.remove();
    t.addEventListener('click', dismiss);
    box.append(t);
    setTimeout(dismiss, 5000);
    while (box.children.length > 4) box.firstChild.remove();
  });
  bus.on('locale:changed', render);
  updateBadge();
  render();
}
