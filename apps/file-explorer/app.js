const $ = id => document.getElementById(id);
const rows = $('rows'), addr = $('addr'), status = $('status');
const fileInput = $('file-input');
let home = '/home/user', cwd = home, entries = [], sel = null;

const say = msg => { status.textContent = msg; };
const join = (dir, name) => (dir === '/' ? '' : dir) + '/' + name;
const size = n => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
const validName = name => name && name !== '.' && name !== '..' && name.length <= 255 && !/[\\/\u0000-\u001f]/.test(name);

async function go(p) {
  try { entries = await os.fs.list(p); cwd = p; sel = null; render(); }
  catch (e) { say(e.message); }
}

function render() {
  addr.value = cwd;
  os.window.setTitle(`${cwd.split('/').pop() || '/'} — ${os.i18n.t('Ficheiros')}`);
  document.querySelectorAll('#places [data-place]').forEach(button => {
    const target = button.dataset.place === 'home' ? home : button.dataset.place === 'trash' ? '/.Trash' : `${home}/${button.dataset.place}`;
    if (target === cwd) button.setAttribute('aria-current', 'location');
    else button.removeAttribute('aria-current');
  });
  rows.replaceChildren();
  if (!entries.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 3; td.textContent = 'Esta pasta está vazia.'; td.className = 'empty'; tr.append(td); rows.append(tr);
  }
  entries.forEach(en => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.classList.toggle('sel', sel === en.path);
    const cells = [`${en.type === 'dir' ? '📁' : '📄'} ${en.name}`, en.type === 'dir' ? '' : size(en.size), os.i18n.date(en.mtime, { dateStyle: 'short', timeStyle: 'short' })];
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
$('refresh').onclick = () => go(cwd);
addr.onkeydown = e => { if (e.key === 'Enter') go(addr.value.trim() || '/'); };
document.querySelectorAll('#places [data-place]').forEach(button => {
  button.onclick = () => {
    const place = button.dataset.place;
    go(place === 'home' ? home : place === 'trash' ? '/.Trash' : `${home}/${place}`);
  };
});
async function createFolder() {
  const n = await os.dialog.prompt({ title: 'Nova pasta', message: 'Nome da nova pasta:', okLabel: 'Criar' });
  const name = n?.trim();
  if (name && validName(name)) await act(() => os.fs.mkdir(join(cwd, name)));
  else if (name) say('Indica um nome de pasta válido, sem separadores de caminho.');
}
$('mkdir').onclick = createFolder;
async function createFile() {
  const value = await os.dialog.prompt({ title: 'Novo ficheiro', message: 'Nome do ficheiro:', defaultValue: 'Novo ficheiro.txt', okLabel: 'Criar' });
  const name = value?.trim();
  if (!name) return;
  if (!validName(name)) return say('Indica um nome de ficheiro válido, sem separadores de caminho.');
  await act(() => os.fs.write(join(cwd, name), '', 'text/plain'));
}
$('new-file').onclick = createFile;
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
Promise.all([os.fs.home(), os.args()]).then(([path, args]) => {
  home = path;
  go(args?.path || home);
  if (args?.action === 'new-file') createFile();
  if (args?.action === 'new-folder') createFolder();
}).catch(() => go(home));
os.i18n.onChange(() => go(cwd));
