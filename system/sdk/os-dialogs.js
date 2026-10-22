// Diálogos para as apps (requer os-sdk.js carregado antes; abrir/guardar precisam de "fs.read").
//   os.dialog.open({ title, start, filter })           -> Promise<caminho | null>
//   os.dialog.save({ title, start, defaultName })      -> Promise<caminho | null>
//   os.dialog.prompt({ title, message, defaultValue, okLabel })  -> Promise<texto | null>
//   os.dialog.confirm({ title, message, okLabel, danger })       -> Promise<boolean>
(() => {
  const CSS = `
.os-dlg-ov{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.45)}
.os-dlg{width:min(460px,92vw);height:min(380px,88vh);display:flex;flex-direction:column;overflow:hidden;background:var(--os-bg,#fff);color:var(--os-fg,#1c2a33);border:1px solid var(--os-border,#d3dce2);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.4);font:13px system-ui,sans-serif}
.os-dlg.small{width:min(360px,92vw);height:auto}
.os-dlg header,.os-dlg footer{display:flex;gap:6px;padding:8px;background:var(--os-surface,#eef1f3)}
.os-dlg header{border-bottom:1px solid var(--os-border,#d3dce2)}
.os-dlg footer{border-top:1px solid var(--os-border,#d3dce2)}
.os-dlg.small footer{justify-content:flex-end}
.os-dlg .body{display:flex;flex-direction:column;gap:8px;padding:16px}
.os-dlg h3{margin:0;font-size:14px}
.os-dlg p{margin:0;color:var(--os-muted,#44565f)}
.os-dlg h3:empty,.os-dlg p:empty{display:none}
.os-dlg input{flex:1;min-width:0;padding:5px 8px;border:1px solid var(--os-border,#c4cdd3);border-radius:6px;background:var(--os-field,#fff);color:inherit;font:inherit}
.os-dlg .body input{flex:none}
.os-dlg .list{flex:1;margin:0;padding:4px;overflow:auto;list-style:none}
.os-dlg button{padding:5px 12px;border:0;border-radius:6px;background:var(--os-btn,#d3dce2);color:inherit;font:inherit;cursor:pointer}
.os-dlg .list button{display:block;width:100%;padding:5px 8px;background:none;text-align:left;cursor:default}
.os-dlg button:hover{background:color-mix(in srgb,var(--os-accent,#3cb6a4) 25%,var(--os-btn,#d3dce2))}
.os-dlg .list button[aria-selected=true]{background:color-mix(in srgb,var(--os-accent,#3cb6a4) 35%,var(--os-bg,#fff))}
.os-dlg .ok{background:var(--os-accent,#3cb6a4);color:#08201c}
.os-dlg .danger{background:#d64545;color:#fff}
.os-dlg button:focus-visible,.os-dlg input:focus-visible{outline:2px solid var(--os-accent,#3cb6a4);outline-offset:1px}`;

  const stack = []; // diálogos abertos; Esc cancela só o do topo
  let ready = false;
  const join = (d, n) => (d === '/' ? '' : d) + '/' + n;

  function setup() {
    if (ready) return;
    ready = true;
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.append(s);
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && stack.length) { e.preventDefault(); e.stopPropagation(); stack.at(-1)(); }
    }, true);
  }

  // base comum: cria o overlay, regista o cancelamento e devolve [overlay, $, finish]
  function modal(html, cancelValue, resolve) {
    setup();
    const ov = document.createElement('div');
    ov.className = 'os-dlg-ov';
    ov.innerHTML = html;
    const cancel = () => finish(cancelValue);
    const finish = v => { stack.splice(stack.indexOf(cancel), 1); ov.remove(); resolve(v); };
    stack.push(cancel);
    ov.onclick = e => { if (e.target === ov) cancel(); };
    ov.querySelector('.cancel').onclick = cancel;
    document.body.append(ov);
    return [ov.querySelector.bind(ov), finish];
  }

  // ---- prompt / confirm
  function box({ title = '', message = '', input = false, defaultValue = '', okLabel = 'OK', cancelLabel = 'Cancelar', danger = false }) {
    return new Promise(resolve => {
      const [$, finish] = modal(
        '<div class="os-dlg small" role="alertdialog" aria-modal="true"><div class="body"><h3></h3><p></p><input spellcheck="false"></div><footer><button class="cancel"></button><button class="ok"></button></footer></div>',
        input ? null : false, resolve);
      const field = $('input'), ok = $('.ok'), cancelBtn = $('.cancel');
      $('h3').textContent = title;
      $('p').textContent = message;
      $('.os-dlg').setAttribute('aria-label', title || message);
      ok.textContent = okLabel;
      cancelBtn.textContent = cancelLabel;
      if (danger) ok.classList.add('danger');
      field.hidden = !input;
      field.value = defaultValue;
      ok.onclick = () => finish(input ? field.value : true);
      field.onkeydown = e => { if (e.key === 'Enter') ok.click(); };
      if (input) { field.focus(); field.select(); } else (danger ? cancelBtn : ok).focus();
    });
  }

  // ---- abrir / guardar
  function files(mode, o = {}) {
    return new Promise(resolve => {
      const [$, finish] = modal(
        '<div class="os-dlg" role="dialog" aria-modal="true"><header><button class="up" aria-label="Pasta acima">↑</button><input class="path" aria-label="Pasta" spellcheck="false"></header><ul class="list"></ul><footer><input class="name" aria-label="Nome do ficheiro" spellcheck="false"><button class="cancel">Cancelar</button><button class="ok"></button></footer></div>',
        null, resolve);
      const name = $('.name'), list = $('.list'), pathIn = $('.path');
      $('.os-dlg').setAttribute('aria-label', o.title || (mode === 'open' ? 'Abrir ficheiro' : 'Guardar ficheiro'));
      $('.ok').textContent = mode === 'open' ? 'Abrir' : 'Guardar';
      name.value = o.defaultName || '';
      if (mode === 'open') { name.readOnly = true; name.placeholder = 'Seleciona um ficheiro'; } else name.placeholder = 'nome.txt';
      let cwd = o.start || '/home/user', sel = null;

      async function go(p) {
        let items;
        try { items = await os.fs.list(p); } catch { pathIn.value = cwd; return; }
        cwd = p; sel = null; pathIn.value = p;
        if (mode === 'open') name.value = '';
        list.replaceChildren();
        items.filter(i => i.type === 'dir' || !o.filter || o.filter(i.name)).forEach(i => {
          const li = document.createElement('li'), b = document.createElement('button');
          b.textContent = `${i.type === 'dir' ? '📁' : '📄'} ${i.name}`;
          b.setAttribute('aria-selected', 'false');
          b.onclick = () => {
            sel = i;
            list.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
            if (i.type === 'file') name.value = i.name; else if (mode === 'open') name.value = '';
          };
          b.ondblclick = () => activate(i);
          b.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); activate(i); } };
          li.append(b);
          list.append(li);
        });
      }
      function activate(i) {
        if (i.type === 'dir') return go(i.path);
        if (mode === 'open') return finish(i.path);
        name.value = i.name;
        confirmOk();
      }
      async function confirmOk() {
        if (mode === 'open') return sel?.type === 'dir' ? go(sel.path) : sel ? finish(sel.path) : undefined;
        const n = name.value.trim();
        if (!n || n.includes('/')) return name.focus();
        const p = join(cwd, n);
        try {
          const st = await os.fs.stat(p);
          if (st.type === 'dir') return go(p);
          if (!await box({ title: 'Substituir ficheiro?', message: `"${n}" já existe nesta pasta.`, okLabel: 'Substituir', danger: true })) return;
        } catch { /* ficheiro novo */ }
        finish(p);
      }

      $('.up').onclick = () => go(cwd.split('/').slice(0, -1).join('/') || '/');
      $('.ok').onclick = confirmOk;
      pathIn.onkeydown = e => { if (e.key === 'Enter') go(pathIn.value.trim() || '/'); };
      name.onkeydown = e => { if (e.key === 'Enter') confirmOk(); };
      go(cwd).then(() => {
        if (mode === 'save') { name.focus(); name.select(); } else (list.querySelector('button') ?? $('.cancel')).focus();
      });
    });
  }

  os.dialog = {
    open: o => files('open', o),
    save: o => files('save', o),
    prompt: o => box({ ...o, input: true }),
    confirm: o => box({ ...o, input: false }),
  };
})();
