import { getUsers, selectUser, clearSessionUser } from './users.js';
import { localeFor } from './i18n.js';
import { getSettings } from './settings.js';

const flag = (k, v) => {
  try {
    if (v === undefined) return sessionStorage.getItem(k) === '1';
    v ? sessionStorage.setItem(k, '1') : sessionStorage.removeItem(k);
  } catch { return false; }
};
const wait = ms => new Promise(r => setTimeout(r, ms));

// full=true repete também o ecrã de arranque
export function logout(full) {
  flag('webos:session', false);
  clearSessionUser();
  if (full) flag('webos:booted', false);
  location.reload();
}

function login(el) {
  const users = getUsers();
  return new Promise(resolve => {
    const cards = users.map(user => `<button class="user-card" data-user="${user.id}"><span class="avatar" aria-hidden="true">${user.avatar}</span><span>${user.name}</span></button>`).join('');
    el.innerHTML = `
      <div class="boot-center">
        <div class="login-clock"></div><div class="login-date"></div>
        <div class="user-list" aria-label="Utilizadores">${cards}</div>
      </div>`;
    const clock = el.querySelector('.login-clock'), date = el.querySelector('.login-date');
    const tick = () => {
      const d = new Date();
      const locale = localeFor(getSettings().language);
      clock.textContent = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      date.textContent = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
    };
    tick();
    const t = setInterval(tick, 15000);
    const buttons = [...el.querySelectorAll('.user-card')];
    buttons.forEach(button => { button.onclick = async () => { await selectUser(button.dataset.user); clearInterval(t); resolve(); }; });
    buttons[0]?.focus();
  });
}

export async function lockSession() {
  flag('webos:session', false);
  const boot = document.createElement('div');
  boot.id = 'boot';
  boot.setAttribute('role', 'dialog');
  boot.setAttribute('aria-modal', 'true');
  boot.setAttribute('aria-label', 'Sessão bloqueada');
  document.body.append(boot);
  const guarded = ['desktop', 'window-layer', 'taskbar'].map(id => document.getElementById(id));
  guarded.forEach(element => { element.inert = true; });
  await login(boot);
  flag('webos:session', true);
  guarded.forEach(element => { element.inert = false; });
  boot.remove();
}

export async function runBoot(ready) {
  const el = document.getElementById('boot');
  const guarded = ['desktop', 'window-layer', 'taskbar'].map(id => document.getElementById(id));
  guarded.forEach(g => { g.inert = true; });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!flag('webos:booted')) {
    el.innerHTML = '<div class="boot-center"><div class="boot-logo" aria-hidden="true">◆</div><div>WebOS</div><div class="boot-bar"><i></i></div></div>';
    await wait(reduce ? 250 : 1500);
    flag('webos:booted', true);
  }
  try { await ready; }
  catch (e) {
    console.error(e);
    el.innerHTML = '<div class="boot-center"><p>Falha ao iniciar o sistema.</p><p>Vê a consola e confirma que estás a usar um servidor local.</p></div>';
    return;
  }
  if (!flag('webos:session')) await login(el);
  flag('webos:session', true);
  guarded.forEach(g => { g.inert = false; });
  el.classList.add('hide');
  await wait(reduce ? 0 : 350);
  el.remove();
}
