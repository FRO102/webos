const $ = id => document.getElementById(id);
const out = $('out'), input = $('in'), promptEl = $('prompt');
const VERSION = 'WebOS Terminal 1.0';
const HISTORY_KEY = 'terminal-history-v1';
let HOME = '/home/user', cwd = HOME, hi = 0;
let hist = [];
const aliases = { ll: 'ls -l', la: 'ls -la', cls: 'clear' };

const norm = p => { const o = []; for (const s of p.split('/')) { if (!s || s === '.') continue; s === '..' ? o.pop() : o.push(s); } return '/' + o.join('/'); };
const resolve = p => norm(p === '~' || p.startsWith('~/') ? HOME + p.slice(1) : p.startsWith('/') ? p : cwd + '/' + p);
const shown = () => (cwd === HOME ? '~' : cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd);
const setPrompt = () => { promptEl.textContent = `User@WebOS:${shown()}$`; };

async function readText(path) {
  const content = await os.fs.read(path);
  if (typeof content === 'string') return content;
  const metadata = await os.fs.stat(path);
  if (metadata.mime.startsWith('text/') || /\/(json|xml|javascript|x-javascript)$/.test(metadata.mime)) return content.text();
  throw new Error(`${path}: ficheiro binário (${metadata.mime}); não pode ser lido como texto.`);
}

function print(text, cls) {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = text;
  out.append(d);
}
const nameSpan = it => { const s = document.createElement('span'); if (it.type === 'dir') s.className = 'dir'; s.textContent = it.name + (it.type === 'dir' ? '/' : ''); return s; };
function printLs(items, long) {
  if (!items.length) return;
  if (!long) {
    const d = document.createElement('div');
    items.forEach(it => d.append(nameSpan(it), '  '));
    return out.append(d);
  }
  items.forEach(it => {
    const d = document.createElement('div');
    d.append(`${it.type === 'dir' ? 'd' : '-'} ${String(it.size).padStart(7)} ${new Date(it.mtime).toLocaleDateString('pt-PT')}  `, nameSpan(it));
    out.append(d);
  });
}

async function destPath(src, dst) {
  const d = resolve(dst);
  try { if ((await os.fs.stat(d)).type === 'dir') return norm(d + '/' + src.split('/').pop()); } catch { /* destino novo */ }
  return d;
}

const HELP = `Comandos:
  ls [-l] [pasta]     lista ficheiros       cd [pasta]        muda de pasta
  pwd                 pasta atual           cat f...          mostra ficheiros
  head [-n N] f       primeiras linhas      tail [-n N] f      últimas linhas
  tree [pasta]        mostra a árvore       find texto        pesquisa ficheiros
  grep texto f...     procura dentro de ficheiros  stat f  metadados
  mkdir p...          cria pastas           touch f...        cria ficheiros vazios
  rm [-r] p...        move para a Lixeira  purge p...         apaga definitivamente
  cp origem dest      copia ficheiros       echo txt [> f]    escreve (> ou >>)
  trash f...          move para a Lixeira  restore f         restaura da Lixeira
  open ficheiro       abre na app certa     apps              lista aplicações
  ps                  lista janelas         kill ID            fecha uma janela
  theme dark|light    muda o tema           wallpaper ID       muda o wallpaper
  settings            mostra definições     alias [n=valor]   gere aliases
  date, whoami, uname, uptime, version, history, clear, help
Atalhos: Tab completa, ↑/↓ histórico, Ctrl+L limpa.`;

const cmds = {
  help: () => print(HELP),
  pwd: () => print(cwd),
  clear: () => out.replaceChildren(),
  whoami: () => print('User'),
  date: () => print(new Date().toLocaleString('pt-PT')),
  version: () => print(VERSION),
  uname: () => print('WebOS browser-shell x86_64'),
  uptime: () => print(`${Math.floor(performance.now() / 1000)}s desde o arranque desta aplicação`),
  history: () => hist.forEach((h, i) => print(`${i + 1}  ${h}`)),
  async settings() { const s = await os.settings.get(); print(JSON.stringify({ theme: s.theme, accent: s.accent, wallpaper: s.wallpaper, fontSize: s.fontSize, animations: s.animations, sounds: s.sounds }, null, 2)); },
  async echo(a) {
    const i = a.findIndex(x => x === '>' || x === '>>');
    if (i < 0) return print(a.join(' '));
    if (!a[i + 1]) throw new Error('falta o ficheiro de destino.');
    const p = resolve(a[i + 1]);
    const prev = a[i] === '>>' && await os.fs.exists(p) ? await readText(p) : '';
    await os.fs.write(p, prev + a.slice(0, i).join(' ') + '\n');
  },
  async ls(a) {
    const long = a.some(x => x === '-l' || x === '-la' || x === '-al');
    const p = resolve(a.find(x => !['-l', '-la', '-al'].includes(x)) ?? '.');
    const st = await os.fs.stat(p);
    printLs(st.type === 'dir' ? await os.fs.list(p) : [st], long);
  },
  async cd(a) {
    const p = resolve(a[0] ?? '~');
    if ((await os.fs.stat(p)).type !== 'dir') throw new Error(`${a[0]}: não é uma pasta`);
    cwd = p;
  },
  async cat(a) {
    if (!a.length) throw new Error('indica um ficheiro.');
    for (const f of a) print(await readText(resolve(f)));
  },
  async head(a) { return printLines(a, 10, false); },
  async tail(a) { return printLines(a, 10, true); },
  async tree(a) {
    const root = resolve(a[0] ?? '.');
    const walk = async (path, prefix = '') => {
      const items = await os.fs.list(path);
      for (const [index, item] of items.entries()) {
        const last = index === items.length - 1;
        print(`${prefix}${last ? '└─' : '├─'} ${item.name}${item.type === 'dir' ? '/' : ''}`);
        if (item.type === 'dir') await walk(`${path === '/' ? '' : path}/${item.name}`, prefix + (last ? '  ' : '│ '));
      }
    };
    print(root); await walk(root);
  },
  async find(a) {
    if (!a[0]) throw new Error('uso: find texto');
    const hits = await os.fs.search(a.join(' '), '/');
    hits.forEach(item => print(`${item.type === 'dir' ? 'd' : '-'} ${item.path}`));
    if (!hits.length) print('nenhum resultado.');
  },
  async grep(a) {
    if (a.length < 2) throw new Error('uso: grep texto ficheiro...');
    const query = a.shift().toLowerCase();
    for (const file of a) {
      const path = resolve(file), lines = (await readText(path)).split(/\r?\n/);
      lines.forEach((line, index) => { if (line.toLowerCase().includes(query)) print(`${file}:${index + 1}:${line}`); });
    }
  },
  async stat(a) {
    if (!a[0]) throw new Error('indica um caminho.');
    print(JSON.stringify(await os.fs.stat(resolve(a[0])), null, 2));
  },
  async mkdir(a) { for (const d of a) await os.fs.mkdir(resolve(d)); },
  async touch(a) {
    for (const f of a) { const p = resolve(f); try { await os.fs.stat(p); } catch { await os.fs.write(p, ''); } }
  },
  async rm(a) {
    const rec = a.includes('-r');
    for (const f of a.filter(x => x !== '-r')) {
      const p = resolve(f);
      if ((await os.fs.stat(p)).type === 'dir' && !rec) throw new Error(`${f} é uma pasta (usa rm -r)`);
      await os.fs.trash(p);
    }
  },
  async purge(a) {
    if (!a.length) throw new Error('uso: purge caminho...');
    if (!await os.dialog.confirm({ title: 'Apagar definitivamente?', message: `Apagar ${a.length} item(ns)? Esta ação não pode ser anulada.`, okLabel: 'Apagar', danger: true })) return;
    for (const path of a) await os.fs.remove(resolve(path));
  },
  async trash(a) { if (!a.length) throw new Error('indica um caminho.'); for (const file of a) await os.fs.trash(resolve(file)); },
  async restore(a) { if (!a.length) throw new Error('indica um item da Lixeira.'); for (const file of a) await os.fs.restore(resolve(file)); },
  async mv(a) {
    if (a.length !== 2) throw new Error('uso: mv origem destino');
    const src = resolve(a[0]);
    await os.fs.move(src, await destPath(src, a[1]));
  },
  async cp(a) {
    if (a.length !== 2) throw new Error('uso: cp origem destino');
    const src = resolve(a[0]);
    const metadata = await os.fs.stat(src);
    if (metadata.type !== 'file') throw new Error('só copia ficheiros.');
    await os.fs.write(await destPath(src, a[1]), await os.fs.read(src), metadata.mime);
  },
  async open(a) {
    if (!a[0]) throw new Error('indica um ficheiro.');
    const p = resolve(a[0]);
    if ((await os.fs.stat(p)).type === 'dir') throw new Error('é uma pasta (usa cd).');
    await os.openFile(p);
  },
  async theme(a) {
    if (!['dark', 'light'].includes(a[0])) throw new Error('uso: theme dark|light');
    await os.settings.set({ theme: a[0] });
  },
  async wallpaper(a) {
    if (!a[0]) throw new Error('uso: wallpaper aurora|crepusculo|floresta|grafite|papel');
    await os.settings.set({ wallpaper: a[0] });
  },
  async apps() { (await os.shell.apps()).forEach(app => print(`${app.id}\t${app.name}\t${app.version}`)); },
  async ps() { (await os.shell.windows()).forEach(w => print(`${w.id}\t${w.title}\tÁrea ${w.workspace}\t${w.minimized ? 'minimizada' : 'ativa'}`)); },
  async kill(a) { if (!a[0]) throw new Error('uso: kill ID'); await os.shell.close(Number(a[0])); },
  async alias(a) {
    if (!a.length) return Object.entries(aliases).forEach(([name, value]) => print(`${name}='${value}'`));
    const [name, ...value] = a.join(' ').split('=');
    if (!name || !value.length) throw new Error('uso: alias nome=comando');
    aliases[name.trim()] = value.join('=').trim();
  },
};

async function printLines(args, defaultCount, fromEnd) {
  let count = defaultCount;
  const filtered = [...args];
  const n = filtered.findIndex(item => item === '-n');
  if (n >= 0) { count = Number(filtered[n + 1]); filtered.splice(n, 2); }
  const file = filtered[0];
  if (!file || !Number.isFinite(count)) throw new Error('uso: head/tail [-n N] ficheiro');
  const lines = (await readText(resolve(file))).split(/\r?\n/);
  print((fromEnd ? lines.slice(-count) : lines.slice(0, count)).join('\n'));
}

async function run(line) {
  print(`${promptEl.textContent} ${line}`, 'cmd');
  const toks = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
  if (!toks.length) return;
  let [name, ...args] = toks;
  if (aliases[name]) [name, ...args] = [...aliases[name].matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]).concat(args);
  if (!Object.hasOwn(cmds, name)) return print(`${name}: comando não encontrado (escreve help)`, 'err');
  try { await cmds[name](args); } catch (e) { print(`${name}: ${e.message}`, 'err'); }
}

async function complete() {
  const v = input.value, word = v.match(/(\S*)$/)[1], head = v.slice(0, v.length - word.length);
  if (!head.trim()) {
    const hits = Object.keys(cmds).filter(c => c.startsWith(word));
    if (hits.length === 1) input.value = head + hits[0] + ' ';
    return;
  }
  const slash = word.lastIndexOf('/'), dirPart = word.slice(0, slash + 1), base = word.slice(slash + 1);
  try {
    const hits = (await os.fs.list(resolve(dirPart || '.'))).filter(i => i.name.startsWith(base));
    if (hits.length === 1) input.value = head + dirPart + hits[0].name + (hits[0].type === 'dir' ? '/' : ' ');
  } catch { /* sem sugestões */ }
}

input.addEventListener('keydown', async e => {
  if (e.key === 'Enter') {
    const line = input.value;
    input.value = '';
    if (line.trim()) {
      hist.push(line);
      hist = hist.slice(-200);
      hi = hist.length;
      os.storage.set(HISTORY_KEY, hist).catch(() => {});
    }
    await run(line);
    setPrompt();
    out.scrollTop = out.scrollHeight;
  } else if (e.key === 'Tab') { e.preventDefault(); complete(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi > 0) input.value = hist[--hi]; }
  else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, hist.length); input.value = hist[hi] ?? ''; }
  else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); out.replaceChildren(); }
});
document.body.addEventListener('click', () => { if (!getSelection().toString()) input.focus(); });

Promise.all([os.fs.home(), os.storage.get(HISTORY_KEY)]).then(([home, savedHistory]) => {
  HOME = home;
  cwd = home;
  if (Array.isArray(savedHistory)) hist = savedHistory.filter(line => typeof line === 'string').slice(-200);
  setPrompt();
  print('WebOS Terminal — escreve "help" para ver os comandos.');
  input.focus();
}).catch(() => {
  setPrompt();
  print('WebOS Terminal — escreve "help" para ver os comandos.');
});
