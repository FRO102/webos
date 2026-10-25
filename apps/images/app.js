const $ = id => document.getElementById(id);
const img = $('img'), stage = $('stage'), empty = $('empty'), status = $('status');
const MAX = 5 * 1024 * 1024;
let DEFAULT_DIR = '/home/user/Imagens', dir = DEFAULT_DIR, files = [], idx = -1;
let currentObjectUrl = null;

const say = m => { status.textContent = m; };
const isImg = n => /\.(png|jpe?g|gif|webp|svg)$/i.test(n);
const join = (d, n) => (d === '/' ? '' : d) + '/' + n;

async function scan(d) {
  try { files = (await os.fs.list(d)).filter(i => i.type === 'file' && isImg(i.name)); dir = d; }
  catch (e) { say(e.message); }
}

// as imagens ficam guardadas como data URL (ou SVG em texto) no sistema de ficheiros
async function show(i) {
  idx = files.length ? Math.min(Math.max(i, 0), files.length - 1) : -1;
  const f = files[idx];
  img.hidden = !f; empty.hidden = !!f;
  $('name').textContent = f ? `${f.name} (${idx + 1}/${files.length})` : '';
  os.window.setTitle(f ? `${f.name} — Imagens` : 'Imagens');
  if (!f) return;
  try {
    const c = await os.fs.read(f.path);
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    if (c instanceof Blob) {
      currentObjectUrl = URL.createObjectURL(c);
      img.src = currentObjectUrl;
    } else {
      img.src = c.startsWith('data:') ? c : 'data:image/svg+xml;utf8,' + encodeURIComponent(c);
    }
    say(f.path);
  } catch (e) { say(e.message); }
}

$('prev').onclick = () => show(idx - 1);
$('next').onclick = () => show(idx + 1);
$('zoom').onclick = () => { stage.classList.toggle('actual'); $('zoom').textContent = stage.classList.contains('actual') ? 'Ajustar' : '100%'; };
addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });

$('file').onchange = async e => {
  let last = null;
  for (const f of e.target.files) {
    if (f.size > MAX) { say(`${f.name}: maior que 5 MB.`); continue; }
    try { await os.fs.write(join(dir, f.name), f, f.type || 'application/octet-stream'); last = f.name; } catch (err) { say(err.message); }
  }
  e.target.value = '';
  await scan(dir);
  if (last) show(files.findIndex(f => f.name === last));
};

os.on('fs:changed', async () => { const cur = files[idx]?.path; await scan(dir); show(Math.max(files.findIndex(f => f.path === cur), 0)); });
addEventListener('pagehide', () => { if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl); });

(async () => {
  const [home, a] = await Promise.all([os.fs.home(), os.args()]);
  DEFAULT_DIR = `${home}/Imagens`;
  dir = DEFAULT_DIR;
  if (a?.path) {
    await scan(a.path.split('/').slice(0, -1).join('/') || '/');
    show(files.findIndex(f => f.path === a.path));
  } else { await scan(DEFAULT_DIR); show(0); }
})();
