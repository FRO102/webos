const ACCENTS = ['#3cb6a4', '#e0a458', '#5b8def', '#e06c75', '#a78bfa', '#7bc96f'];
const DEFAULTS = { theme: 'dark', accent: '#3cb6a4', wallpaper: 'aurora', fontSize: 14, animations: true, sounds: true, language: 'pt-PT' };
const $ = id => document.getElementById(id);
let st = null;

function render() {
  document.querySelectorAll('input[name=theme]').forEach(r => { r.checked = r.value === st.theme; });
  $('font-size').value = st.fontSize;
  $('font-size-value').textContent = `${st.fontSize}px`;
  $('animations').checked = st.animations;
  $('sounds').checked = st.sounds;
  $('language').value = st.language;
  $('language-status').textContent = st.language === 'en' ? 'English (UK)' : 'Português de Portugal';
  updateFullscreenUI();
  $('custom').value = st.accent;
  $('accents').replaceChildren(...ACCENTS.map(c => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.setAttribute('aria-label', `Cor ${c}`);
    b.setAttribute('aria-pressed', String(c.toLowerCase() === st.accent.toLowerCase()));
    b.onclick = () => set({ accent: c });
    return b;
  }));
  $('walls').replaceChildren(...Object.entries(st.wallpapers).map(([id, w]) => {
    const b = document.createElement('button');
    b.className = 'wall';
    b.style.background = w.css;
    b.textContent = w.name;
    b.setAttribute('aria-pressed', String(id === st.wallpaper));
    b.onclick = () => set({ wallpaper: id });
    return b;
  }));
}

function updateFullscreenUI(active = false) {
  const button = $('fullscreen');
  button.textContent = active ? 'Sair do ecrã inteiro' : 'Ativar ecrã inteiro';
  button.setAttribute('aria-pressed', String(active));
  $('fullscreen-status').textContent = active ? 'O WebOS está em ecrã inteiro. Usa Esc para sair.' : 'O browser pode exigir confirmação para entrar em ecrã inteiro.';
}

async function set(patch) {
  try { st = { ...st, ...(await os.settings.set(patch)) }; render(); }
  catch (e) { $('status').textContent = e.message; os.notify(e.message); }
}

document.querySelectorAll('input[name=theme]').forEach(r => { r.onchange = () => set({ theme: r.value }); });
$('custom').onchange = e => set({ accent: e.target.value });
$('font-size').oninput = e => { $('font-size-value').textContent = `${e.target.value}px`; };
$('font-size').onchange = e => set({ fontSize: e.target.value });
$('animations').onchange = e => set({ animations: e.target.checked });
$('sounds').onchange = e => set({ sounds: e.target.checked });
$('language').onchange = e => set({ language: e.target.value });
$('test').onclick = () => os.notify('Esta é uma notificação de teste.');
$('fullscreen').onclick = async () => {
  try { updateFullscreenUI(await os.shell.toggleFullscreen()); }
  catch (error) { $('fullscreen-status').textContent = os.errors.message(error, 'Não foi possível ativar o ecrã inteiro.'); }
};
$('reset').onclick = () => set(DEFAULTS);

os.settings.get().then(s => { st = s; render(); }).catch(e => { $('status').textContent = e.message; });
os.i18n.onChange(({ language }) => { if (st) { st.language = language; render(); } });
os.on('fullscreen:changed', ({ active }) => updateFullscreenUI(active));
os.shell.isFullscreen().then(updateFullscreenUI).catch(() => {});
