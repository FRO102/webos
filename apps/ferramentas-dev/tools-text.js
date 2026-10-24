'use strict';

/* Ferramentas de texto: JSON, Base64, URL, hashes/HMAC, regex e comparação de texto. */

/* ---------- Base64 (partilhado com o JWT) ---------- */
function b64Encode(str, urlSafe) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  let out = btoa(bin);
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return out;
}
function b64Decode(s) {
  let b = s.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  const bin = atob(b); // lança se houver caracteres inválidos
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
function tableOf(rows, head) {
  const tb = document.createElement('table');
  if (head) {
    const tr = document.createElement('tr');
    head.forEach(h => { const th = document.createElement('th'); th.textContent = h; tr.append(th); });
    tb.append(tr);
  }
  rows.forEach(([k, v]) => {
    const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
    th.scope = 'row'; th.textContent = k; td.textContent = v;
    tr.append(th, td); tb.append(tr);
  });
  return tb;
}

/* ---------- JSON ---------- */
// Os motores nem sempre indicam a posição do erro, por isso um validador mínimo localiza o primeiro carácter inválido.
function jsonErrorPos(s) {
  let i = 0;
  const NUM = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/y;
  const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
  const fail = () => { throw i; };
  const str = () => {
    i++;
    while (i < s.length) {
      const c = s[i];
      if (c === '"') { i++; return; }
      if (c === '\\') {
        i++;
        if (s[i] !== undefined && '"\\/bfnrt'.includes(s[i])) { i++; continue; }
        if (s[i] === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 1, i + 5))) { i += 5; continue; }
        fail();
      }
      if (c < ' ') fail();
      i++;
    }
    fail();
  };
  const value = () => {
    ws();
    const c = s[i];
    if (c === '{') {
      i++; ws();
      if (s[i] === '}') { i++; return; }
      for (;;) {
        ws(); if (s[i] !== '"') fail();
        str(); ws(); if (s[i] !== ':') fail();
        i++; value(); ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === '}') { i++; return; }
        fail();
      }
    }
    if (c === '[') {
      i++; ws();
      if (s[i] === ']') { i++; return; }
      for (;;) {
        value(); ws();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ']') { i++; return; }
        fail();
      }
    }
    if (c === '"') return str();
    NUM.lastIndex = i;
    const m = NUM.exec(s);
    if (m) { i += m[0].length; return; }
    for (const lit of ['true', 'false', 'null']) if (s.startsWith(lit, i)) { i += lit.length; return; }
    fail();
  };
  try { value(); ws(); if (i < s.length) fail(); } catch (p) { return typeof p === 'number' ? p : null; }
  return null;
}

registerTool('json', {
  init() {
    const inEl = $('#json-in'), out = $('#json-out'), m = $('#json-msg');
    const indent = () => { const v = $('#json-indent').value; return v === 'tab' ? '\t' : Number(v); };
    const sortKeys = v => Array.isArray(v) ? v.map(sortKeys)
      : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;

    function where(e) {
      const lc = /line (\d+) column (\d+)/.exec(e.message);
      if (lc) return { line: +lc[1], col: +lc[2] };
      const p = /position (\d+)/.exec(e.message);
      const pos = p ? Number(p[1]) : jsonErrorPos(inEl.value);
      if (pos === null) return null;
      const before = inEl.value.slice(0, pos);
      return { line: before.split('\n').length, col: pos - before.lastIndexOf('\n') };
    }
    function parse(announce) {
      if (!inEl.value.trim()) { msg(m, announce ? t('Cola um JSON na entrada.') : '', 'info'); return null; }
      try {
        const value = JSON.parse(inEl.value);
        msg(m, t('JSON válido.'), 'success');
        return { value };
      } catch (e) {
        const w = where(e);
        msg(m, `${t('JSON inválido')}${w ? ` (${t('linha')} ${w.line}, ${t('coluna')} ${w.col})` : ''}: ${e.message}`, 'error');
        return null;
      }
    }
    const run = fn => { const r = parse(true); if (r) out.value = fn(r.value); };
    $('#p-json [data-act=format]').onclick = () => run(v => JSON.stringify(v, null, indent()));
    $('#p-json [data-act=minify]').onclick = () => run(v => JSON.stringify(v));
    $('#p-json [data-act=sort]').onclick = () => run(v => JSON.stringify(sortKeys(v), null, indent()));
    inEl.addEventListener('input', debounce(() => parse(false)));
  },
});

/* ---------- Base64 ---------- */
registerTool('base64', {
  init() {
    const inEl = $('#b64-in'), out = $('#b64-out'), m = $('#b64-msg');
    $('#p-base64 [data-act=enc]').onclick = () => {
      out.value = b64Encode(inEl.value, $('#b64-url').checked);
      msg(m, t('Codificado em Base64.'), 'success');
    };
    $('#p-base64 [data-act=dec]').onclick = () => {
      try { out.value = b64Decode(inEl.value); msg(m, t('Descodificado.'), 'success'); }
      catch (e) {
        out.value = '';
        msg(m, e instanceof TypeError ? t('O resultado não é texto UTF-8 válido.') : t('Base64 inválido.'), 'error');
      }
    };
  },
});

/* ---------- URL ---------- */
registerTool('url', {
  init() {
    const inEl = $('#url-in'), out = $('#url-out'), m = $('#url-msg'), parts = $('#url-parts');
    const show = fn => {
      parts.replaceChildren();
      try { out.value = fn(inEl.value); msg(m, t('Concluído.'), 'success'); }
      catch { out.value = ''; msg(m, t('Sequência % inválida.'), 'error'); }
    };
    $('#p-url [data-act=comp]').onclick = () => show(encodeURIComponent);
    $('#p-url [data-act=uri]').onclick = () => show(encodeURI);
    $('#p-url [data-act=dec]').onclick = () => show(decodeURIComponent);
    $('#p-url [data-act=parse]').onclick = () => {
      parts.replaceChildren();
      out.value = '';
      let u;
      try { u = new URL(inEl.value.trim()); } catch { return msg(m, t('URL inválido (inclui o protocolo, por exemplo https://).'), 'error'); }
      msg(m, t('URL analisado.'), 'success');
      parts.append(tableOf([
        [t('Protocolo'), u.protocol], [t('Utilizador'), u.username || '—'], [t('Anfitrião'), u.hostname],
        [t('Porta'), u.port || '—'], [t('Caminho'), u.pathname], [t('Fragmento'), u.hash || '—'], [t('Origem'), u.origin],
      ]));
      const params = [...u.searchParams.entries()];
      if (params.length) parts.append(tableOf(params, [t('Parâmetro'), t('Valor')]));
    };
  },
});

/* ---------- Hashes e HMAC ---------- */
registerTool('hash', {
  init() {
    const text = $('#hash-in'), out = $('#hash-out'), key = $('#hash-key'), cmp = $('#hash-cmp');
    let file = null, seq = 0;
    const MAX = 100 * 1024 * 1024;
    const format = bytes => {
      const f = $('#hash-fmt').value;
      if (f === 'b64') { let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); }
      const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
      return f === 'HEX' ? hex.toUpperCase() : hex;
    };
    function compare() {
      const el = $('#hash-cmpres'), want = cmp.value.trim().replace(/\s+/g, '');
      if (!want || !out.textContent) return msg(el, '', 'info');
      const same = $('#hash-fmt').value === 'b64' ? want === out.textContent : want.toLowerCase() === out.textContent.toLowerCase();
      msg(el, same ? t('Coincide.') : t('Não coincide.'), same ? 'success' : 'error');
    }
    async function compute() {
      const my = ++seq, algo = $('#hash-algo').value;
      const data = file ?? new TextEncoder().encode(text.value);
      try {
        let bytes;
        if (key.value) {
          const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key.value), { name: 'HMAC', hash: algo }, false, ['sign']);
          bytes = new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
        } else bytes = new Uint8Array(await crypto.subtle.digest(algo, data));
        if (my !== seq) return; // resposta antiga
        out.textContent = format(bytes);
      } catch (e) {
        if (my === seq) { out.textContent = ''; setStatus(errMsg(e, t('Não foi possível calcular o hash.')), 'error'); }
      }
      compare();
    }
    const soon = debounce(compute, 150);
    text.addEventListener('input', () => { file = null; $('#hash-clear').hidden = true; $('#hash-fileinfo').textContent = ''; soon(); });
    ['#hash-algo', '#hash-fmt'].forEach(s => $(s).addEventListener('change', compute));
    key.addEventListener('input', soon);
    cmp.addEventListener('input', compare);
    $('#hash-file').addEventListener('change', async e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (f.size > MAX) return setStatus(t('Ficheiro demasiado grande (máximo 100 MB).'), 'error');
      try { file = new Uint8Array(await f.arrayBuffer()); }
      catch (err) { return setStatus(errMsg(err, t('Não foi possível ler o ficheiro.')), 'error'); }
      text.value = '';
      $('#hash-clear').hidden = false;
      $('#hash-fileinfo').textContent = `${f.name} (${f.size.toLocaleString(locale())} bytes)`;
      compute();
    });
    $('#hash-clear').onclick = () => { file = null; $('#hash-clear').hidden = true; $('#hash-fileinfo').textContent = ''; compute(); };
    compute();
  },
});

/* ---------- Regex (executada num Worker com tempo limite contra backtracking catastrófico) ---------- */
const RX_WORKER = [
  'onmessage = e => {',
  '  const { pattern, flags, text, max } = e.data;',
  '  try {',
  '    const re = new RegExp(pattern, flags), matches = [];',
  '    const pack = m => ({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null });',
  '    if (flags.includes("g")) { for (const m of text.matchAll(re)) { matches.push(pack(m)); if (matches.length >= max) break; } }',
  '    else { const m = re.exec(text); if (m) matches.push(pack(m)); }',
  '    postMessage({ ok: true, matches, truncated: matches.length >= max, replacement: null });',
  '  } catch (err) { postMessage({ ok: false, error: String(err.message) }); }',
  '};',
].join('\n');

function regexInline(p) { // alternativa quando não há Workers: limita o tamanho do texto
  if (p.text.length > 20000) return { ok: false, error: 'Sem Workers neste browser: o texto de teste está limitado a 20 000 caracteres.' };
  try {
    const re = new RegExp(p.pattern, p.flags), matches = [];
    const pack = m => ({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups ? { ...m.groups } : null });
    if (p.flags.includes('g')) { for (const m of p.text.matchAll(re)) { matches.push(pack(m)); if (matches.length >= p.max) break; } }
    else { const m = re.exec(p.text); if (m) matches.push(pack(m)); }
    return { ok: true, matches, truncated: matches.length >= p.max };
  } catch (err) { return { ok: false, error: String(err.message) }; }
}
let rxWorker = null;
function regexRun(payload, replacement) {
  rxWorker?.terminate();
  return new Promise(resolve => {
    let url, w;
    const done = r => { clearTimeout(timer); w?.terminate(); if (rxWorker === w) rxWorker = null; if (url) URL.revokeObjectURL(url); resolve(r); };
    let timer;
    try {
      url = URL.createObjectURL(new Blob([RX_WORKER], { type: 'text/javascript' }));
      w = rxWorker = new Worker(url);
    } catch { return resolve(regexInline(payload)); }
    timer = setTimeout(() => done({ ok: false, timeout: true }), 1500);
    w.onmessage = e => done(e.data);
    w.onerror = () => done(regexInline(payload));
    w.postMessage(payload);
  }).then(r => { r.replacement = r.ok ? safeReplace(payload, replacement) : null; return r; });
}
function safeReplace(p, replacement) { // a substituição é rápida de verificar depois de a expressão já ter passado no Worker
  try { return p.text.replace(new RegExp(p.pattern, p.flags), replacement); } catch { return null; }
}

registerTool('regex', {
  init() {
    const pat = $('#rx-pat'), text = $('#rx-text'), rep = $('#rx-rep'), m = $('#rx-msg');
    let seq = 0;
    const flags = () => ['g', 'i', 'm', 's', 'u'].filter(f => $(`#rx-${f}`).checked).join('');
    async function run() {
      const my = ++seq, hl = $('#rx-hl'), list = $('#rx-list');
      hl.replaceChildren(); list.replaceChildren(); $('#rx-out').value = '';
      if (!pat.value) { hl.textContent = text.value; return msg(m, '', 'info'); }
      msg(m, t('A testar…'), 'loading');
      const res = await regexRun({ pattern: pat.value, flags: flags(), text: text.value, max: 1000 }, rep.value);
      if (my !== seq) return;
      hl.textContent = text.value;
      if (res.timeout) return msg(m, t('Tempo excedido: a expressão pode ter backtracking catastrófico.'), 'error');
      if (!res.ok) return msg(m, `${t('Expressão inválida')}: ${res.error}`, 'error');
      // realce das correspondências
      hl.replaceChildren();
      let pos = 0;
      res.matches.forEach((x, i) => {
        if (x.index > pos) hl.append(text.value.slice(pos, x.index));
        if (x.text) { const mk = document.createElement('mark'); mk.className = i % 2 ? 'b' : 'a'; mk.textContent = x.text; hl.append(mk); }
        pos = x.index + x.text.length;
      });
      hl.append(text.value.slice(pos));
      res.matches.forEach((x, i) => {
        const li = document.createElement('li');
        li.append(`@${x.index}: "${x.text}"`);
        const extra = [...x.groups.map((g, k) => `$${k + 1}=${g === undefined ? '∅' : `"${g}"`}`),
          ...Object.entries(x.named || {}).map(([k, v]) => `${k}=${v === undefined ? '∅' : `"${v}"`}`)].join('  ');
        if (extra) { const s = document.createElement('span'); s.className = 'g'; s.textContent = `  ${extra}`; li.append(s); }
        list.append(li);
      });
      const n = res.matches.length;
      msg(m, n ? `${n} ${n === 1 ? t('correspondência') : t('correspondências')}${res.truncated ? ` (${t('limite de 1000')})` : ''}` : t('Sem correspondências.'), n ? 'success' : 'info');
      if (res.replacement !== null) $('#rx-out').value = res.replacement;
    }
    const soon = debounce(run, 250);
    [pat, text, rep].forEach(el => el.addEventListener('input', soon));
    ['g', 'i', 'm', 's', 'u'].forEach(f => $(`#rx-${f}`).addEventListener('change', run));
  },
});

/* ---------- Comparar texto (diferença por linhas) ---------- */
registerTool('diff', {
  init() {
    const a = $('#diff-a'), b = $('#diff-b'), out = $('#diff-out'), m = $('#diff-msg');
    const lines = s => (s === '' ? [] : s.replace(/\r\n/g, '\n').split('\n'));
    const key = s => {
      let k = s;
      if ($('#diff-ws').checked) k = k.trim().replace(/\s+/g, ' ');
      if ($('#diff-case').checked) k = k.toLowerCase();
      return k;
    };
    function row(cls, l, r, sign, text) {
      const d = document.createElement('div');
      d.className = `line ${cls}`;
      for (const [c, v] of [['ln', l ?? ''], ['ln', r ?? ''], ['sg', sign], ['tx', text || ' ']]) {
        const s = document.createElement('span'); s.className = c; s.textContent = v; d.append(s);
      }
      return d;
    }
    function compute() {
      const A = lines(a.value), B = lines(b.value), ka = A.map(key), kb = B.map(key);
      out.replaceChildren();
      if (!A.length && !B.length) return msg(m, '', 'info');
      let s = 0;
      while (s < A.length && s < B.length && ka[s] === kb[s]) s++;
      let ea = A.length, eb = B.length;
      while (ea > s && eb > s && ka[ea - 1] === kb[eb - 1]) { ea--; eb--; }
      const n = ea - s, mm = eb - s, w = mm + 1;
      if (n * mm > 4e6) return msg(m, t('Textos demasiado grandes para comparar (limite de 4 milhões de combinações de linhas).'), 'error');
      const L = new Uint32Array((n + 1) * w);
      for (let i = n - 1; i >= 0; i--) for (let j = mm - 1; j >= 0; j--) {
        L[i * w + j] = ka[s + i] === kb[s + j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      }
      const ops = [];
      for (let i = 0; i < s; i++) ops.push({ t: '=', l: i + 1, r: i + 1, text: A[i] });
      let i = 0, j = 0;
      while (i < n && j < mm) {
        if (ka[s + i] === kb[s + j]) { ops.push({ t: '=', l: s + i + 1, r: s + j + 1, text: A[s + i] }); i++; j++; }
        else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { ops.push({ t: '-', l: s + i + 1, text: A[s + i] }); i++; }
        else { ops.push({ t: '+', r: s + j + 1, text: B[s + j] }); j++; }
      }
      while (i < n) { ops.push({ t: '-', l: s + i + 1, text: A[s + i] }); i++; }
      while (j < mm) { ops.push({ t: '+', r: s + j + 1, text: B[s + j] }); j++; }
      for (let k = ea; k < A.length; k++) ops.push({ t: '=', l: k + 1, r: eb + (k - ea) + 1, text: A[k] });

      const add = ops.filter(o => o.t === '+').length, del = ops.filter(o => o.t === '-').length;
      if (!add && !del) return msg(m, t('Os textos são iguais.'), 'success');
      msg(m, `+${add} ${t('adicionadas')}, −${del} ${t('removidas')}`, 'info');
      const vis = new Array(ops.length).fill(false);
      ops.forEach((o, k) => { if (o.t !== '=') for (let x = Math.max(0, k - 3); x <= Math.min(ops.length - 1, k + 3); x++) vis[x] = true; });
      let hidden = 0, drawn = 0;
      const LIMIT = 2000;
      const flushGap = () => {
        if (!hidden) return;
        const g = document.createElement('div'); g.className = 'gap';
        g.textContent = `… ${hidden} ${hidden === 1 ? t('linha igual') : t('linhas iguais')}`;
        out.append(g); hidden = 0;
      };
      let truncated = false;
      ops.forEach((o, k) => {
        if (truncated) return;
        if (!vis[k]) { hidden++; return; }
        if (drawn >= LIMIT) { truncated = true; return; }
        flushGap();
        drawn++;
        out.append(o.t === '=' ? row('same', o.l, o.r, ' ', o.text) : o.t === '+' ? row('add', null, o.r, '+', o.text) : row('del', o.l, null, '−', o.text));
      });
      if (!truncated) flushGap();
      else { const g = document.createElement('div'); g.className = 'gap'; g.textContent = t('Resultado truncado às primeiras 2000 linhas.'); out.append(g); }
    }
    const soon = debounce(compute, 250);
    [a, b].forEach(el => el.addEventListener('input', soon));
    ['#diff-ws', '#diff-case'].forEach(s => $(s).addEventListener('change', compute));
  },
});
