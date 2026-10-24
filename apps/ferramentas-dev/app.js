'use strict';

/* Ferramentas de Programador — núcleo: ajudantes, navegação e persistência da última ferramenta.
   As ferramentas vivem em tools-text.js e tools-gen.js (scripts clássicos que chamam registerTool).
   Nada do que o utilizador cola (JSON, tokens, chaves) é guardado: só o separador aberto por último. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const t = s => (window.os?.i18n?.t ? os.i18n.t(s) : s);
const locale = () => window.os?.i18n?.locale || 'pt-PT';
const fmtDate = (d, o) => (os.i18n?.date ? os.i18n.date(d, o) : d.toLocaleString(locale(), o));
const errMsg = (e, fb) => (os.errors?.message ? os.errors.message(e, fb) : (e && e.message) || fb);
const pad = n => String(n).padStart(2, '0');
const debounce = (fn, ms = 180) => { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; };

function setStatus(text, state = 'info') {
  const el = $('#status');
  el.textContent = text;
  el.dataset.state = state;
}
function msg(el, text, state = 'info') {
  el.textContent = text;
  el.dataset.state = state;
}

async function copyText(text) {
  try {
    if (os.clipboard?.write) await os.clipboard.write(text);
    else await navigator.clipboard.writeText(text);
    setStatus(t('Copiado para a área de transferência.'), 'success');
  } catch (e) {
    setStatus(errMsg(e, t('Não foi possível copiar.')), 'error');
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const el = $(b.dataset.copy);
  const text = el.value ?? el.textContent;
  if (!text) return setStatus(t('Nada para copiar.'));
  copyText(text);
});

/* ---------- ferramentas e navegação ---------- */
const tools = {};
const registerTool = (id, def) => { tools[id] = def; };
const tabs = () => $$('#tools [role=tab]');

function pick(id, focus) {
  if (!tools[id]) return;
  tabs().forEach(b => {
    const on = b.dataset.tool === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  $$('[role=tabpanel]').forEach(p => { p.hidden = p.id !== `p-${id}`; });
  tools[id].show?.();
  setStatus('');
  os.storage.set('prefs', { tool: id }).catch(() => {});
}

function localizeAttrs() {
  for (const [attr, key] of [['aria-label', 'origAria'], ['placeholder', 'origPh']]) {
    $$(`[${attr}]`).forEach(el => {
      el.dataset[key] ??= el.getAttribute(attr);
      el.setAttribute(attr, t(el.dataset[key]));
    });
  }
}

async function start() {
  tabs().forEach((b, i, all) => {
    b.onclick = () => pick(b.dataset.tool);
    b.onkeydown = e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      pick(all[(i + d + all.length) % all.length].dataset.tool, true);
    };
  });
  for (const [id, def] of Object.entries(tools)) {
    try { def.init(); } catch (e) { console.error(`Falha ao iniciar "${id}":`, e); }
  }
  localizeAttrs();
  os.i18n?.onChange?.(localizeAttrs);
  let first = 'json';
  try { const p = await os.storage.get('prefs'); if (p?.tool && tools[p.tool]) first = p.tool; } catch { /* usa o predefinido */ }
  pick(first);
}
window.addEventListener('load', start);
