const ta = document.getElementById('text');
const status = document.getElementById('status');
let path = null, dirty = false;
const dirOf = p => (p ? p.split('/').slice(0, -1).join('/') || '/' : '/home/user/Documentos');

const say = msg => { status.textContent = msg; };
const title = () => os.window.setTitle(`${dirty ? '• ' : ''}${path ? path.split('/').pop() : 'Sem título'} — Bloco de Notas`);
const confirmDiscard = async () => !dirty || os.dialog.confirm({ title: 'Alterações por guardar', message: 'Descartar as alterações por guardar?', okLabel: 'Descartar', danger: true });

async function load(p) {
  try { ta.value = await os.fs.read(p); path = p; dirty = false; title(); say(p); }
  catch (e) { say(e.message); }
}
async function save(saveAs) {
  let p = path;
  if (!p || saveAs) {
    p = await os.dialog.save({ title: 'Guardar como', start: dirOf(path), defaultName: path ? path.split('/').pop() : 'sem-titulo.txt' });
    if (!p) return;
  }
  try { await os.fs.write(p, ta.value); path = p; dirty = false; title(); say(`Guardado em ${p}`); }
  catch (e) { say(e.message); }
}

document.getElementById('new').onclick = async () => { if (await confirmDiscard()) { ta.value = ''; path = null; dirty = false; title(); say(''); } };
document.getElementById('open').onclick = async () => {
  if (!(await confirmDiscard())) return;
  const p = await os.dialog.open({ title: 'Abrir ficheiro', start: dirOf(path) });
  if (p) load(p);
};
document.getElementById('save').onclick = () => save(false);
document.getElementById('saveas').onclick = () => save(true);
ta.addEventListener('input', () => { if (!dirty) { dirty = true; title(); } });
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(false); } });

os.args().then(a => (a?.path ? load(a.path) : title()));
