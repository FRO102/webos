const $ = id => document.getElementById(id);
const out = $('out'), input = $('in'), promptEl = $('prompt');
async function copyDir(src, dst) {
  try { await os.fs.mkdir(dst); } catch { /* pode já existir */ }
  const items = await os.fs.list(src);
  for (const item of items) {
    const from = `${src === '/' ? '' : src}/${item.name}`;
    const to = `${dst === '/' ? '' : dst}/${item.name}`;
    if (item.type === 'dir') await copyDir(from, to);
    else {
      const metadata = await os.fs.stat(from);
      await os.fs.write(to, await os.fs.read(from), metadata.mime);
    }
  }
}

function scheduleSaveState() {
  if (scheduleSaveState.timer) clearTimeout(scheduleSaveState.timer);
  scheduleSaveState.timer = setTimeout(saveState, 250);
}

async function saveState() {
  try { await os.storage.set(HISTORY_KEY, hist.slice(-HISTORY_LIMIT)); } catch { /* ignore */ }
  try { await os.storage.set(ALIASES_KEY, userAliases); } catch { /* ignore */ }
  try { await os.storage.set(CWD_KEY, cwd); } catch { /* ignore */ }
  try { await os.storage.set(ENV_KEY, env); } catch { /* ignore */ }
}

function isValidSavedPath(path) {
  return typeof path === 'string' && path.startsWith('/');
}


const VERSION = 'WebOS Terminal 1.1';
const HISTORY_KEY = 'terminal-history-v1';
const ALIASES_KEY = 'terminal-aliases-v1';
const CWD_KEY = 'terminal-cwd-v1';
const ENV_KEY = 'terminal-env-v1';
const HISTORY_LIMIT = 500;
const OUTPUT_LIMIT = 250;
let HOME = '/home/user', cwd = HOME, previousCwd = null, hi = 0;
let hist = [], draft = '', running = false;
const aliases = { ll: 'ls -l', la: 'ls -la', cls: 'clear' };
const userAliases = {};
const env = { TERM: 'webos', USER: 'User', PWD: HOME, HOME };
let completionCandidates = [], completionIndex = -1;

const norm = p => { const o = []; for (const s of String(p ?? '').split('/')) { if (!s || s === '.') continue; s === '..' ? o.pop() : o.push(s); } return '/' + o.join('/'); };
const resolve = p => {
  const raw = String(p ?? '');
  if (raw === '~') return HOME;
  if (raw.startsWith('~/')) return norm(HOME + raw.slice(1));
  if (raw.startsWith('/')) return norm(raw);
  return norm(cwd + '/' + raw);
};
const shown = () => (cwd === HOME ? '~' : cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd);
const setPrompt = () => { promptEl.textContent = `User@WebOS:${shown()}$`; env.PWD = cwd; env.HOME = HOME; };

async function readText(path) {
  const content = await os.fs.read(path);
  if (typeof content === 'string') return content;
  const metadata = await os.fs.stat(path);
  if (metadata.mime.startsWith('text/') || /\/(json|xml|javascript|x-javascript)$/.test(metadata.mime)) return content.text();
  throw new Error(`${path}: ficheiro binário (${metadata.mime}); não pode ser lido como texto.`);
}

function bytesToSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function countWords(text) {
  return (String(text ?? '').match(/\S+/g) || []).length;
}

function errorMessage(error, fallback = 'Ocorreu um erro.') {
  try { return os.errors.message(error, fallback); } catch { return error?.message || fallback; }
}

function print(text, cls) {
  const value = String(text ?? '');
  const lines = value.split(/\r?\n/);
  if (lines.length > OUTPUT_LIMIT) {
    const trimmed = lines.slice(0, OUTPUT_LIMIT);
    trimmed.push(`... saída truncada (${lines.length - OUTPUT_LIMIT} linhas omitidas).`);
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = trimmed.join('\n');
    out.append(d);
  } else {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = value;
    out.append(d);
  }
  out.scrollTop = out.scrollHeight;
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
    d.append(`${it.type === 'dir' ? 'd' : '-'} ${String(it.size).padStart(7)} ${os.i18n.date(it.mtime)}  `, nameSpan(it));
    out.append(d);
  });
}

async function destPath(src, dst) {
  const d = resolve(dst);
  try { if ((await os.fs.stat(d)).type === 'dir') return norm(d + '/' + src.split('/').pop()); } catch { /* destino novo */ }
  return d;
}

const HELP = `Comandos:
  ls [-l] [-a] [pasta...]  lista ficheiros      cd [pasta|-]      muda de pasta
  pwd                 pasta atual           cat f...          mostra ficheiros
  head/tail [-n N] f  primeiras/últimas     tree [pasta] [-L N]   árvore
  find texto [pasta]   pesquisa ficheiros    grep texto f...   procura dentro de ficheiros
  wc [-lwc] f...      linhas/palavras/bytes stat f            metadados
  basename/dirname p  extrai nome da pasta   du [pasta]        tamanho recursivo
  mkdir p...          cria pastas           touch f...        cria ficheiros vazios
  rm [-r] p...        move para a Lixeira  purge p...        apaga definitivamente
  emptytrash          esvazia a Lixeira     cp [-r] o d       copia ficheiros/pastas
  mv origem dest      move ficheiros        echo txt [> f]    escreve (> ou >>)
  trash f...          move para lixeira     restore f         restaura da lixeira
  open ficheiro       abre na app certa     apps              lista apps
  ps                  lista janelas         kill ID           fecha uma janela
  theme dark|light    muda o tema           wallpaper ID      muda o wallpaper
  settings            mostra definições     alias/unalias     gere aliases
  env [nome=valor]    variáveis ambiente    wc, basename...
  date, whoami, uname, uptime, version, history, clear, help
Atalhos: Tab completa, ↑/↓ histórico, Ctrl+L limpa, Ctrl+U limpa linha, Ctrl+W apaga palavra.`;

const cmds = {
  help: () => print(HELP),
  pwd: () => print(cwd),
  clear: () => out.replaceChildren(),
  whoami: () => print('User'),
  date: () => print(os.i18n.date(new Date(), { dateStyle: 'medium', timeStyle: 'medium' })),
  version: () => print(VERSION),
  uname: () => print('WebOS browser-shell x86_64'),
  uptime: () => print(`${Math.floor(performance.now() / 1000)}s desde o arranque desta aplicação`),
  history: (a) => {
    if (a.includes('-c')) {
      hist = [];
      scheduleSaveState();
      return print('Histórico limpo.', 'success');
    }
    hist.forEach((h, i) => print(`${i + 1}  ${h}`));
  },
  async settings() { const s = await os.settings.get(); print(JSON.stringify({ theme: s.theme, accent: s.accent, wallpaper: s.wallpaper, fontSize: s.fontSize, animations: s.animations, sounds: s.sounds, language: s.language }, null, 2)); },
  async ps() { (await os.shell.windows()).forEach(w => print(`${w.id}\t${w.title}\tÁrea ${w.workspace}\t${w.minimized ? 'minimizada' : 'ativa'}`)); },
  async theme(a) {
    if (!['dark', 'light'].includes(a[0])) throw new Error('uso: theme dark|light');
    await os.settings.set({ theme: a[0] });
    print(`Tema: ${a[0]}`, 'success');
  },
  async echo(a) {
    const i = a.findIndex(x => x === '>' || x === '>>');
    if (i < 0) return print(a.join(' '));
    if (!a[i + 1]) throw new Error('falta o ficheiro de destino.');
    const p = resolve(a[i + 1]);
    const prev = a[i] === '>>' && await os.fs.exists(p) ? await readText(p) : '';
    await os.fs.write(p, prev + a.slice(0, i).join(' ') + '\n');
  },
  async ls(a) {
    const long = a.some(x => /^-.*l/.test(x));
    const showHidden = a.some(x => /^-.*a/.test(x));
    const paths = a.filter(x => !x.startsWith('-'));
    if (!paths.length) paths.push('.');
    for (const target of paths) {
      const p = resolve(target);
      const st = await os.fs.stat(p);
      if (paths.length > 1) print(`${p}:`, 'info');
      const rawItems = st.type === 'dir' ? await os.fs.list(p) : [st];
      const items = showHidden ? rawItems : rawItems.filter(item => !item.name.startsWith('.'));
      printLs(items, long);
    }
  },
  async cd(a) {
    let p;
    if (a[0] === '-') {
      if (!previousCwd) throw new Error('sem pasta anterior.');
      p = previousCwd;
    } else {
      p = resolve(a[0] ?? '~');
    }
    if ((await os.fs.stat(p)).type !== 'dir') throw new Error(`${a[0] ?? p}: não é uma pasta`);
    if (p !== cwd) { previousCwd = cwd; cwd = p; }
    setPrompt();
    scheduleSaveState();
  },
  async basename(a) { if (!a[0]) throw new Error('uso: basename caminho'); print(a[0].split('/').filter(Boolean).pop() || '/'); },
  async dirname(a) { if (!a[0]) throw new Error('uso: dirname caminho'); const resolved = resolve(a[0]); const parent = resolved.split('/').slice(0, -1).join('/') || '/'; print(parent); },
  async cat(a) {
    if (!a.length) throw new Error('indica um ficheiro.');
    for (const f of a) {
      try { print(await readText(resolve(f))); }
      catch (e) { print(`${f}: ${errorMessage(e)}`, 'err'); }
    }
  },
  async head(a) { return printLines(a, 10, false); },
  async tail(a) { return printLines(a, 10, true); },
  async tree(a) {
    const depthFlag = a.indexOf('-L');
    let maxDepth = 99;
    if (depthFlag >= 0) {
      const n = Number(a[depthFlag + 1]);
      if (Number.isFinite(n) && n > 0) { maxDepth = Math.min(n, 8); }
      a = a.filter((x, index) => index !== depthFlag && index !== depthFlag + 1);
    }
    const root = resolve(a[0] ?? '.');
    const walk = async (path, prefix = '', depth = 0) => {
      if (depth >= maxDepth) return;
      const items = await os.fs.list(path);
      for (const [index, item] of items.entries()) {
        const last = index === items.length - 1;
        print(`${prefix}${last ? '└─' : '├─'} ${item.name}${item.type === 'dir' ? '/' : ''}`);
        if (item.type === 'dir') await walk(`${path === '/' ? '' : path}/${item.name}`, prefix + (last ? '  ' : '│ '), depth + 1);
      }
    };
    print(root); await walk(root);
  },
  async find(a) {
    if (!a[0]) throw new Error('uso: find texto [na pasta]');
    let folder = '/';
    const args = [...a];
    const inIndex = args.findIndex(x => x === '-in' || x === '--in');
    if (inIndex >= 0 && args[inIndex + 1]) { folder = resolve(args[inIndex + 1]); args.splice(inIndex, 2); }
    const query = args.join(' ');
    if (!query) throw new Error('uso: find texto [na pasta]');
    const hits = await os.fs.search(query, folder === '/' ? '/' : resolve(folder));
    hits.forEach(item => print(`${item.type === 'dir' ? 'd' : '-'} ${item.path}`));
    if (!hits.length) print('nenhum resultado.');
  },
  async grep(a) {
    if (a.length < 2) throw new Error('uso: grep texto ficheiro...');
    if (a.includes('-i')) { a = a.filter(x => x !== '-i'); }
    const query = a.shift().toLowerCase();
    let matches = 0;
    for (const file of a) {
      try {
        const path = resolve(file), lines = (await readText(path)).split(/\r?\n/);
        lines.forEach((line, index) => { if (line.toLowerCase().includes(query)) { print(`${file}:${index + 1}:${line}`); matches++; } });
      } catch (e) {
        print(`${file}: ${errorMessage(e)}`, 'err');
      }
    }
    if (!matches) print('nenhuma correspondência.');
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
    const targets = a.filter(x => x !== '-r');
    for (const f of targets) {
      const p = resolve(f);
      const st = await os.fs.stat(p);
      if (st.type === 'dir' && !rec) throw new Error(`${f} é uma pasta (usa rm -r)`);
      await os.fs.trash(p);
    }
  },
  async purge(a) {
    if (!a.length) throw new Error('uso: purge caminho...');
    for (const path of a) {
      const p = resolve(path);
      if (p === '/' || p === HOME || p === '/.Trash') throw new Error(`${path}: caminho protegido.`);
    }
    if (!await os.dialog.confirm({ title: 'Apagar definitivamente?', message: `Apagar ${a.length} item(ns) de forma permanente? Esta acção não pode ser anulada.`, okLabel: 'Apagar', danger: true })) return;
    for (const path of a) await os.fs.remove(resolve(path));
  },
  async emptytrash(a) {
    if (!await os.dialog.confirm({ title: 'Esvaziar lixeira', message: 'Apagar permanentemente todos os itens da Lixeira?', okLabel: 'Esvaziar', danger: true })) return;
    await os.fs.emptyTrash();
    print('Lixeira esvaziada.', 'success');
  },
  async trash(a) { if (!a.length) throw new Error('indica um caminho.'); for (const file of a) await os.fs.trash(resolve(file)); },
  async restore(a) { if (!a.length) throw new Error('indica um item da Lixeira.'); for (const file of a) await os.fs.restore(resolve(file)); },
  async mv(a) {
    if (a.length !== 2) throw new Error('uso: mv origem destino');
    const src = resolve(a[0]);
    await os.fs.move(src, await destPath(src, a[1]));
  },
  async cp(a) {
    const recursive = a.includes('-r');
    const args = a.filter(x => x !== '-r');
    if (args.length !== 2) throw new Error('uso: cp [-r] origem destino');
    const src = resolve(args[0]);
    const dst = await destPath(src, args[1]);
    const metadata = await os.fs.stat(src);
    if (metadata.type === 'dir') {
      if (!recursive) throw new Error('cp: pasta requer -r.');
      await copyDir(src, dst);
      return print(`Copiado: ${src} -> ${dst}`, 'success');
    }
    if (metadata.type !== 'file') throw new Error('só copia ficheiros.');
    await os.fs.write(dst, await os.fs.read(src), metadata.mime);
    print(`Copiado: ${src} -> ${dst}`, 'success');
  },
  async du(a) {
    const root = resolve(a[0] ?? '.');
    let total = 0, count = 0;
    const walk = async path => {
      const st = await os.fs.stat(path).catch(() => null);
      if (!st) return;
      if (st.type === 'file') { total += st.size; count++; return; }
      const items = await os.fs.list(path);
      for (const item of items) await walk(`${path === '/' ? '' : path}/${item.name}`);
    };
    await walk(root);
    print(`${bytesToSize(total)}\t${count} ficheiro(s)\t${root}`);
  },
  async wc(a) {
    if (!a.length) throw new Error('uso: wc [-lwc] ficheiro...');
    const showLines = !a.includes('-c') || a.includes('-l');
    const showWords = !a.includes('-c') || a.includes('-w');
    const showBytes = a.includes('-c') || (!a.includes('-l') && !a.includes('-w'));
    const files = a.filter(x => !x.startsWith('-'));
    if (!files.length) throw new Error('uso: wc [-lwc] ficheiro...');
    let totalLines = 0, totalWords = 0, totalBytes = 0;
    for (const file of files) {
      const path = resolve(file);
      const metadata = await os.fs.stat(path);
      const text = await readText(path);
      const lines = text.split(/\r?\n/).length;
      const words = countWords(text);
      const parts = [];
      if (showLines) parts.push(String(lines));
      if (showWords) parts.push(String(words));
      if (showBytes) parts.push(String(metadata.size));
      totalLines += lines; totalWords += words; totalBytes += metadata.size;
      print(`${parts.join(' ')}\t${file}`);
    }
    if (files.length > 1) {
      const parts = [];
      if (showLines) parts.push(String(totalLines));
      if (showWords) parts.push(String(totalWords));
      if (showBytes) parts.push(String(totalBytes));
      print(`${parts.join(' ')}\ttotal`);
    }
  },
  basename(a) { if (!a[0]) throw new Error('uso: basename caminho'); print(String(a[0]).split('/').filter(Boolean).pop() || '/'); },
  async dirname(a) { if (!a[0]) throw new Error('uso: dirname caminho'); const resolved = resolve(a[0]); const parent = resolved.split('/').slice(0, -1).join('/') || '/'; print(parent); },
  async open(a) {
    if (!a[0]) throw new Error('indica um ficheiro.');
    const p = resolve(a[0]);
    if ((await os.fs.stat(p)).type === 'dir') throw new Error('é uma pasta (usa cd).');
    await os.openFile(p);
  },
  async theme(a) {
    if (!['dark', 'light'].includes(a[0])) throw new Error('uso: theme dark|light');
    await os.settings.set({ theme: a[0] });
    print(`Tema: ${a[0]}`, 'success');
  },
  async wallpaper(a) {
    if (!a[0]) throw new Error('uso: wallpaper aurora|crepusculo|floresta|grafite|papel');
    await os.settings.set({ wallpaper: a[0] });
    print(`Wallpaper: ${a[0]}`, 'success');
  },
  async apps() { (await os.shell.apps()).forEach(app => print(`${app.id}\t${app.name}\t${app.version}`)); },
  async ps() { (await os.shell.windows()).forEach(w => print(`${w.id}\t${w.title}\tÁrea ${w.workspace}\t${w.minimized ? 'minimizada' : 'ativa'}`)); },
  async kill(a) { if (!a[0]) throw new Error('uso: kill ID'); await os.shell.close(Number(a[0])); },
  async alias(a) {
    if (!a.length) {
      for (const [name, value] of Object.entries({ ...aliases, ...userAliases })) print(`${name}='${value}'`);
      return;
    }
    const [name, ...value] = a.join(' ').split('=');
    const trimmedName = name.trim();
    if (!/^[a-zA-Z_][\w-]*$/.test(trimmedName)) throw new Error('nome de alias inválido.');
    if (!value.length || !value.join('=').trim()) throw new Error('uso: alias nome=comando');
    const command = value.join('=').trim();
    if (/[;&|]/.test(command)) throw new Error('alias não pode conter ;, & ou |.');
    if (aliases[trimmedName] && !userAliases[trimmedName]) throw new Error('não é possível redefinir alias integrado.');
    userAliases[trimmedName] = command;
    aliases[trimmedName] = command;
    scheduleSaveState();
  },
  async unalias(a) {
    if (!a.length) throw new Error('uso: unalias nome...');
    for (const name of a) {
      if (!userAliases[name]) throw new Error(`${name}: alias não encontrado.`);
      delete userAliases[name];
      delete aliases[name];
    }
    scheduleSaveState();
  },
  async env(a) {
    if (!a.length) return Object.entries(env).forEach(([name, value]) => print(`${name}=${value}`));
    const [assignment] = a;
    const index = assignment.indexOf('=');
    if (index < 0) return print(env[assignment] ?? '');
    const name = assignment.slice(0, index).trim();
    const value = assignment.slice(index + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('nome de variável inválido.');
    env[name] = value;
    scheduleSaveState();
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
  if (running) return;
  running = true;
  input.disabled = true;
  const promptText = promptEl.textContent;
  print(`${promptText} ${line}`, 'cmd');
  const toks = [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);
  if (!toks.length) { running = false; input.disabled = false; input.focus(); return; }
  let [name, ...args] = toks;
  if (aliases[name]) [name, ...args] = [...aliases[name].matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]).concat(args);
  if (!Object.hasOwn(cmds, name)) { print(`${name}: comando não encontrado (escreve help)`, 'err'); running = false; input.disabled = false; input.focus(); return; }
  try { await cmds[name](args); } catch (e) { print(`${name}: ${errorMessage(e)}`, 'err'); }
  running = false;
  input.disabled = false;
  input.focus();
  scheduleSaveState();
  setPrompt();
}

async function complete() {
  const v = input.value, word = v.match(/(\S*)$/)[1], head = v.slice(0, v.length - word.length);
  const allCommands = [...new Set([...Object.keys(cmds), ...Object.keys(aliases)])];
  if (!head.trim()) {
    const hits = allCommands.filter(c => c.startsWith(word));
    if (hits.length === 1) input.value = head + hits[0] + ' ';
    else if (hits.length > 1) print(hits.join('  '), 'info');
    return;
  }
  const slash = word.lastIndexOf('/'), dirPart = word.slice(0, slash + 1), base = word.slice(slash + 1);
  try {
    const hits = (await os.fs.list(resolve(dirPart || '.'))).filter(i => i.name.toLowerCase().startsWith(base.toLowerCase()));
    if (hits.length === 1) input.value = head + dirPart + hits[0].name + (hits[0].type === 'dir' ? '/' : ' ');
    else if (hits.length > 1) {
      print(hits.map(i => i.name + (i.type === 'dir' ? '/' : '')).join('  '), 'info');
    }
  } catch { /* sem sugestões */ }
}

input.addEventListener('keydown', async e => {
  if (e.key === 'Enter') {
    const line = input.value;
    input.value = '';
    if (line.trim()) {
      hist.push(line);
      hist = hist.slice(-HISTORY_LIMIT);
      hi = hist.length;
      draft = '';
      os.storage.set(HISTORY_KEY, hist).catch(() => {});
    }
    await run(line);
  } else if (e.key === 'Tab') { e.preventDefault(); complete(); }
  else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (hi === hist.length && input.value) draft = input.value;
    if (hi > 0) input.value = hist[--hi];
  }
  else if (e.key === 'ArrowDown') {
    e.preventDefault();
    hi = Math.min(hi + 1, hist.length);
    input.value = hi === hist.length ? draft : (hist[hi] ?? '');
  }
  else if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); out.replaceChildren(); }
  else if (e.ctrlKey && e.key.toLowerCase() === 'u') { e.preventDefault(); input.value = ''; }
  else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    input.value = input.value.replace(/\s*\S+\s*$/, (m) => m.match(/^\s+$/) ? m : '');
  }
  else if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    e.preventDefault();
    print('^C', 'info');
    input.value = '';
  }
});
window.addEventListener('beforeunload', () => { saveState(); });
document.body.addEventListener('click', () => { if (!getSelection().toString()) input.focus(); });

Promise.all([os.fs.home(), os.storage.get(HISTORY_KEY), os.storage.get(ALIASES_KEY), os.storage.get(CWD_KEY), os.storage.get(ENV_KEY)]).then(([home, savedHistory, savedAliases, savedCwd, savedEnv]) => {
  HOME = home;
  cwd = home;
  if (Array.isArray(savedHistory)) hist = savedHistory.filter(line => typeof line === 'string').slice(-HISTORY_LIMIT);
  if (savedAliases && typeof savedAliases === 'object') {
    for (const [name, value] of Object.entries(savedAliases)) {
      if (typeof value === 'string' && /^[a-zA-Z_][\w-]*$/.test(name)) {
        userAliases[name] = value;
        aliases[name] = value;
      }
    }
  }
  if (isValidSavedPath(savedCwd)) {
    os.fs.stat(savedCwd).then(st => { if (st.type === 'dir') { cwd = savedCwd; previousCwd = home; setPrompt(); } }).catch(() => {});
  }
  if (savedEnv && typeof savedEnv === 'object') {
    Object.assign(env, savedEnv);
  }
  hi = hist.length;
  setPrompt();
  print('WebOS Terminal — escreve "help" para ver os comandos.');
  input.focus();
}).catch(() => {
  setPrompt();
  print('WebOS Terminal — escreve "help" para ver os comandos.');
});
