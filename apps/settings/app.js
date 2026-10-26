const ACCENTS = ['#3cb6a4', '#e0a458', '#5b8def', '#e06c75', '#a78bfa', '#7bc96f'];
const DEFAULTS = { theme: 'dark', accent: '#3cb6a4', wallpaper: 'aurora', fontSize: 14, animations: true, sounds: true, language: 'pt-PT', desktopBackground: null };
const $ = id => document.getElementById(id);
let st = null;
let previewUrl = null;

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
  updateDesktopBackgroundPreview();
}

function updateFullscreenUI(active = false) {
  const button = $('fullscreen');
  button.textContent = active ? 'Sair do ecrã inteiro' : 'Ativar ecrã inteiro';
  button.setAttribute('aria-pressed', String(active));
  $('fullscreen-status').textContent = active ? 'O WebOS está em ecrã inteiro. Usa Esc para sair.' : 'O browser pode exigir confirmação para entrar em ecrã inteiro.';
}

function updateDesktopBackgroundPreview() {
  const preview = $('desktop-bg-preview');
  const removeBtn = $('remove-desktop-bg');
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  if (st.desktopBackground) {
    preview.hidden = false;
    (async () => {
      try {
        const content = await os.fs.read(st.desktopBackground);
        const blob = content instanceof Blob ? content : new Blob([content]);
        previewUrl = URL.createObjectURL(blob);
        preview.src = previewUrl;
        preview.alt = st.desktopBackground.split('/').pop();
      } catch (e) { preview.hidden = true; if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; } }
    })();
    removeBtn.disabled = false;
    $('desktop-bg-status').textContent = st.desktopBackground ? st.desktopBackground.split('/').pop() : 'Sem imagem escolhida.';
    $('desktop-bg-status').textContent = st.desktopBackground ? st.desktopBackground.split('/').pop() : 'Sem imagem escolhida.';
  } else {
    preview.hidden = true;
    preview.removeAttribute('src');
    removeBtn.disabled = true;
    $('desktop-bg-status').textContent = 'Sem imagem selecionada.';
    $('desktop-bg-status').textContent = 'Sem imagem selecionada.';
  }
}

async function set(patch) {
  try { st = { ...st, ...(await os.settings.set(patch)) }; render(); }
  catch (e) { $('status').textContent = e.message; os.notify(e.message); }
}

function sanitizeDesktopBackgroundName(name, type) {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || type?.split('/')[1] || 'img').toLowerCase();
  return `fundo-desktop-${Date.now()}.${ext}`;
}

async function uploadDesktopBackground(file) {
  if (!file || !file.type.startsWith('image/')) { $('status').textContent = 'Selecciona um ficheiro de imagem.'; return; }
  if (file.size > 5 * 1024 * 1024) { $('status').textContent = 'A imagem excede 5 MB.'; return; }
  try {
    const home = await os.fs.home();
    const dir = `${home}/Imagens`;
    try { await os.fs.mkdir(dir); } catch { }
    const path = `${dir}/${sanitizeDesktopBackgroundName(file.name, file.type)}`;
    await os.fs.write(path, file, file.type || 'application/octet-stream');
    await set({ desktopBackground: path });
    $('status').textContent = 'Fundo do ambiente de trabalho atualizado.';
  } catch (e) { $('status').textContent = e.message; os.notify(e.message); }
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

// Fundo de ambiente de trabalho personalizado
const fileInput = $('desktop-bg-file');
$('add-desktop-bg').onclick = () => fileInput.click();
fileInput.onchange = async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (file) await uploadDesktopBackground(file);
};
$('browse-desktop-bg').onclick = async () => {
  try {
    const path = await os.dialog.open({ title: 'Escolher imagem de fundo', start: '/home/user/Imagens/', filter: ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'] });
    if (path) await set({ desktopBackground: path });
  } catch (e) { $('status').textContent = e.message; os.notify(e.message); }
};
$('remove-desktop-bg').onclick = () => set({ desktopBackground: null });

os.settings.get().then(s => { st = s; render(); }).catch(e => { $('status').textContent = e.message; });
os.i18n.onChange(({ language }) => { if (st) { st.language = language; render(); } });
os.on('fullscreen:changed', ({ active }) => updateFullscreenUI(active));
os.shell.isFullscreen().then(updateFullscreenUI).catch(() => {});
