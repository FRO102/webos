const $ = id => document.getElementById(id);
const rows = $('rows'), addr = $('addr'), status = $('status');
const fileInput = $('file-input');
const searchInput = $('search'), sortSelect = $('sort');
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
  const query = searchInput.value.trim().toLocaleLowerCase(os.i18n.locale);
  const visibleEntries = entries.filter(entry => entry.name.toLocaleLowerCase(os.i18n.locale).includes(query));
  if (sel && !visibleEntries.some(entry => entry.path === sel)) sel = null;
  const sortBy = sortSelect.value;
  visibleEntries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    if (sortBy === 'size') return a.size - b.size || a.name.localeCompare(b.name, os.i18n.locale);
    if (sortBy === 'date') return b.mtime - a.mtime || a.name.localeCompare(b.name, os.i18n.locale);
    if (sortBy === 'type') return a.mime.localeCompare(b.mime, os.i18n.locale) || a.name.localeCompare(b.name, os.i18n.locale);
    return a.name.localeCompare(b.name, os.i18n.locale);
  });
  if (!visibleEntries.length) {
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = entries.length ? 'Nenhum ficheiro corresponde à pesquisa.' : 'Esta pasta está vazia.';
    td.className = 'empty'; tr.append(td); rows.append(tr);
  }
  visibleEntries.forEach(en => {
    const tr = document.createElement('tr');
    tr.dataset.path = en.path;
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
  say(query ? `${visibleEntries.length} de ${entries.length} itens` : `${entries.length} ${entries.length === 1 ? 'item' : 'itens'}`);
}

function select(p) {
  sel = p;
  [...rows.querySelectorAll('tr[data-path]')].forEach(row => row.classList.toggle('sel', row.dataset.path === p));
}
const current = () => entries.find(e => e.path === sel);
async function openFile(en) {
  try {
    const extension = en.name.match(/\.[^.]+$/)?.[0].toLowerCase();
    const apps = await os.shell.apps();
    const handlers = apps.filter(app => app.fileTypes?.some(type => type.toLowerCase() === extension));
    if (handlers.length < 2) return await os.openFile(en.path, handlers[0]?.id);
    const appId = await os.dialog.choose({
      title: 'Abrir com',
      message: `Escolhe a aplicação para abrir "${en.name}".`,
      options: handlers.map(app => ({ label: app.name, value: app.id })),
    });
    if (appId) await os.openFile(en.path, appId);
  } catch (error) { say(error.message); }
}
const activate = en => (en.type === 'dir' ? go(en.path) : openFile(en));

async function act(fn) { try { await fn(); } catch (e) { say(e.message); } }

$('up').onclick = () => go(cwd.split('/').slice(0, -1).join('/') || '/');
$('refresh').onclick = () => go(cwd);
addr.onkeydown = e => { if (e.key === 'Enter') go(addr.value.trim() || '/'); };
searchInput.oninput = render;
sortSelect.onchange = render;
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
  const files = [...(fileInput.files ?? [])];
  if (!files.length) return;
  let imported = 0;
  const failures = [];
  for (const file of files) {
    try {
      const path = join(cwd, file.name);
      if (await os.fs.exists(path)) {
        const replace = await os.dialog.confirm({ title: 'Substituir ficheiro?', message: `Já existe "${file.name}". Queres substituir?`, okLabel: 'Substituir', danger: true });
        if (!replace) continue;
      }
      await os.fs.write(path, file, file.type || 'application/octet-stream');
      imported++;
    } catch (error) { failures.push(`${file.name}: ${error.message}`); }
  }
  say(failures.length ? `${imported} importado(s); ${failures.length} falha(s): ${failures.join(' · ')}` : `${imported} ${imported === 1 ? 'ficheiro importado.' : 'ficheiros importados.'}`);
  fileInput.value = '';
};
$('download').onclick = async () => {
  const en = current();
  if (!en || en.type !== 'file') return say('Seleciona um ficheiro primeiro.');
  try {
    const content = await os.fs.read(en.path);
    const blob = content instanceof Blob
      ? content
      : typeof content === 'string' && content.startsWith('data:')
        ? dataUrlToBlob(content)
        : new Blob([content], { type: en.mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = en.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (e) { say(e.message); }
};

function dataUrlToBlob(value) {
  const match = value.match(/^data:([^,]*),(.*)$/s);
  if (!match) throw new Error('O ficheiro de imagem não tem um formato válido.');
  const [mime = 'application/octet-stream', ...parameters] = match[1].split(';');
  const encoded = match[2];
  const content = parameters.includes('base64') ? atob(encoded) : decodeURIComponent(encoded);
  const bytes = new Uint8Array(content.length);
  for (let index = 0; index < content.length; index++) bytes[index] = content.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

os.on('fs:changed', () => go(cwd));
Promise.all([os.fs.home(), os.args()]).then(([path, args]) => {
  home = path;
  go(args?.path || home);
  if (args?.action === 'new-file') createFile();
  if (args?.action === 'new-folder') createFolder();
}).catch(() => go(home));
os.i18n.onChange(() => go(cwd));
