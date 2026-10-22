const $ = id => document.getElementById(id);
const rows = $('rows'), addr = $('addr'), status = $('status');
const fileInput = $('file-input');
let cwd = '/home/user', entries = [], sel = null;

const say = msg => { status.textContent = msg; };
const join = (dir, name) => (dir === '/' ? '' : dir) + '/' + name;
const size = n => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

async function go(p) {
  try { entries = await os.fs.list(p); cwd = p; sel = null; render(); }
  catch (e) { say(e.message); }
}

function render() {
  addr.value = cwd;
  os.window.setTitle(`${cwd.split('/').pop() || '/'} — Ficheiros`);
  rows.replaceChildren();
  entries.forEach(en => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.classList.toggle('sel', sel === en.path);
    const cells = [`${en.type === 'dir' ? '📁' : '📄'} ${en.name}`, en.type === 'dir' ? '' : size(en.size), new Date(en.mtime).toLocaleString('pt-PT')];
    cells.forEach(t => { const td = document.createElement('td'); td.textContent = t; tr.append(td); });
    tr.onclick = () => select(en.path);
    tr.onfocus = () => select(en.path);
    tr.ondblclick = () => activate(en);
    tr.onkeydown = e => {
      if (e.key === 'Enter') activate(en);
      if (e.key === 'Delete') remove();
      if (e.key === 'F2') rename();
    };
    rows.append(tr);
  });
  say(`${entries.length} ${entries.length === 1 ? 'item' : 'itens'}`);
}

function select(p) {
  sel = p;
  [...rows.children].forEach((tr, i) => tr.classList.toggle('sel', entries[i].path === p));
}
const current = () => entries.find(e => e.path === sel);
const activate = en => (en.type === 'dir' ? go(en.path) : os.openFile(en.path).catch(e => say(e.message)));

async function act(fn) { try { await fn(); } catch (e) { say(e.message); } }

$('up').onclick = () => go(cwd.split('/').slice(0, -1).join('/') || '/');
$('trash-open').onclick = () => go('/.Trash');
addr.onkeydown = e => { if (e.key === 'Enter') go(addr.value.trim() || '/'); };
$('mkdir').onclick = async () => {
  const n = await os.dialog.prompt({ title: 'Nova pasta', message: 'Nome da nova pasta:', okLabel: 'Criar' });
  if (n?.trim()) act(() => os.fs.mkdir(join(cwd, n.trim())));
};
async function rename() {
  const en = current();
  if (!en) return say('Seleciona um item primeiro.');
  const dest = (await os.dialog.prompt({ title: 'Mover/Renomear', message: 'Novo nome ou caminho completo:', defaultValue: en.name, okLabel: 'Aplicar' }))?.trim();
  if (dest) act(() => os.fs.move(en.path, dest.startsWith('/') ? dest : join(cwd, dest)));
}
async function remove() {
  const en = current();
  if (!en) return say('Seleciona um item primeiro.');
  if (await os.dialog.confirm({ title: 'Mover para a lixeira', message: `Mover "${en.name}" para a lixeira?`, okLabel: 'Mover', danger: true })) act(() => os.fs.trash(en.path));
}
$('rename').onclick = rename;
$('del').onclick = remove;
$('restore').onclick = async () => {
  const en = current();
  if (!en || !en.path.startsWith('/.Trash/')) return say('Seleciona um item da lixeira.');
  act(() => os.fs.restore(en.path));
};
$('empty-trash').onclick = async () => {
  if (cwd !== '/.Trash') return say('Abre a lixeira para a esvaziar.');
  if (await os.dialog.confirm({ title: 'Esvaziar lixeira', message: 'Apagar permanentemente todos os itens?', okLabel: 'Esvaziar', danger: true })) act(() => os.fs.emptyTrash());
};
$('upload').onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const content = await file.text();
  act(() => os.fs.write(join(cwd, file.name), content));
  fileInput.value = '';
};
$('download').onclick = async () => {
  const en = current();
  if (!en || en.type !== 'file') return say('Seleciona um ficheiro primeiro.');
  try {
    const content = await os.fs.read(en.path);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: en.mime }));
    link.download = en.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  } catch (e) { say(e.message); }
};

os.on('fs:changed', () => go(cwd));
os.args().then(args => go(args?.path || cwd)).catch(() => go(cwd));
