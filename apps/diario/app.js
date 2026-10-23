'use strict';

/* Diário / Hábitos — dados privados em os.storage (chave "diario", esquema v1).
   Exportação para Markdown em os.fs (permissões fs.read/fs.write).
   Compatível com o SDK documentado: os.i18n e os.errors são usados quando existem. */

const $ = (s, r = document) => r.querySelector(s);
const t = s => (window.os?.i18n?.t ? os.i18n.t(s) : s);
const locale = () => window.os?.i18n?.locale || 'pt-PT';
const fmtDate = (d, o) => (os.i18n?.date ? os.i18n.date(d, o) : d.toLocaleDateString(locale(), o));
const fmtNum = (n, o) => (os.i18n?.number ? os.i18n.number(n, o) : n.toLocaleString(locale(), o));
const errMsg = (e, fb) => (os.errors?.message ? os.errors.message(e, fb) : (e && e.message) || fb);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const days = n => `${n} ${n === 1 ? t('dia') : t('dias')}`;

/* ---------- ícones SVG locais ---------- */
const ICONS = {
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
};
const icon = n => `<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

const MOODS = [
  { v: 1, label: 'Muito mau', color: '#d9534f', mouth: 'M8 17q4-5 8 0' },
  { v: 2, label: 'Mau', color: '#e8863a', mouth: 'M8 16q4-2 8 0' },
  { v: 3, label: 'Normal', color: '#c9a227', mouth: 'M8 15h8' },
  { v: 4, label: 'Bom', color: '#6fae3f', mouth: 'M8 14q4 3 8 0' },
  { v: 5, label: 'Excelente', color: '#2fa866', mouth: 'M7 13q5 8 10 0' },
];
const face = m => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="9" cy="10" r=".6"/><circle cx="15" cy="10" r=".6"/><path d="${m.mouth}"/></svg>`;

/* ---------- datas (chaves locais AAAA-MM-DD) ---------- */
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parse(k); d.setDate(d.getDate() + n); return key(d); };
const todayK = () => key(new Date());
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

/* ---------- estado ---------- */
let db = { v: 1, entries: {}, habits: [], checks: {} };
let cur = todayK(), tab = 'diary', shownDay = null;
let canSave = true, dirty = false, saveTimer = null, listTimer = null;
const MAX_HABITS = 30;
const words = s => (s.trim() ? s.trim().split(/\s+/).length : 0);

function setStatus(msg, state = 'info') {
  const el = $('#status');
  el.textContent = msg;
  el.dataset.state = state;
}

/* ---------- persistência ---------- */
function scheduleSave() {
  if (!canSave) return;
  dirty = true;
  setStatus(t('A guardar…'), 'loading');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
}
async function flush() {
  clearTimeout(saveTimer);
  if (!dirty || !canSave) return;
  dirty = false;
  try {
    await os.storage.set('diario', db);
    setStatus(t('Guardado.'), 'success');
  } catch (e) {
    dirty = true;
    setStatus(errMsg(e, t('Não foi possível guardar.')), 'error');
  }
}
async function load() {
  try {
    const saved = await os.storage.get('diario');
    if (saved && saved.v === 1) {
      db = { v: 1, entries: saved.entries || {}, habits: saved.habits || [], checks: saved.checks || {} };
    } else if (saved) { // versão desconhecida: não sobrescrever
      canSave = false;
      setStatus(t('Dados de uma versão desconhecida. As alterações não serão guardadas.'), 'error');
    }
  } catch (e) {
    canSave = false;
    setStatus(errMsg(e, t('Não foi possível carregar os dados. As alterações não serão guardadas.')), 'error');
  }
  renderAll();
}

/* ---------- navegação ---------- */
function goto(k) {
  const target = k > todayK() ? todayK() : k;
  flush();
  cur = target;
  shownDay = null;
  renderAll();
}
function pick(id, focus) {
  tab = id;
  document.querySelectorAll('[role=tab]').forEach(b => {
    const on = b.dataset.tab === id;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  document.querySelectorAll('[role=tabpanel]').forEach(p => { p.hidden = p.id !== `p-${id}`; });
  $('#bar').hidden = id === 'summary';
  flush();
  renderAll();
}

/* ---------- diário ---------- */
function setEntry(patch) {
  const e = { text: '', mood: null, ...db.entries[cur], ...patch };
  if (!e.text.trim() && !e.mood) delete db.entries[cur];
  else { e.updated = Date.now(); db.entries[cur] = e; }
  scheduleSave();
  renderCount();
  $('#delentry').disabled = !db.entries[cur];
  clearTimeout(listTimer);
  listTimer = setTimeout(renderList, 250);
}
function renderCount() {
  const n = words(db.entries[cur]?.text ?? '');
  $('#count').textContent = `${n} ${n === 1 ? t('palavra') : t('palavras')}`;
}
function renderMoods() {
  const box = $('#moods');
  box.replaceChildren();
  const current = db.entries[cur]?.mood;
  for (const m of MOODS) {
    const b = document.createElement('button');
    b.className = 'mood icon-only';
    b.style.setProperty('--c', m.color);
    b.dataset.v = m.v;
    b.innerHTML = face(m);
    b.title = t(m.label);
    b.setAttribute('aria-label', t(m.label));
    b.setAttribute('aria-pressed', String(m.v === current));
    b.onclick = () => {
      setEntry({ mood: db.entries[cur]?.mood === m.v ? null : m.v });
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.v) === db.entries[cur]?.mood)));
    };
    box.append(b);
  }
}
function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const ul = $('#entries');
  ul.replaceChildren();
  const keys = Object.keys(db.entries).sort().reverse().filter(k => !q || db.entries[k].text.toLowerCase().includes(q));
  if (!keys.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.textContent = q ? t('Nenhuma entrada encontrada.') : t('Ainda não há entradas.');
    ul.append(li);
    return;
  }
  for (const k of keys) {
    const e = db.entries[k], m = MOODS.find(x => x.v === e.mood);
    const li = document.createElement('li'), b = document.createElement('button');
    const d = document.createElement('span'), f = document.createElement('span'), s = document.createElement('span');
    d.className = 'd'; f.className = 'f'; s.className = 's';
    d.textContent = cap(fmtDate(parse(k), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    if (m) { f.innerHTML = face(m); f.style.color = m.color; f.title = t(m.label); }
    s.textContent = e.text.replace(/\s+/g, ' ').trim().slice(0, 90) || t('(sem texto)');
    b.append(d, f, s);
    if (k === cur) b.setAttribute('aria-current', 'date');
    b.onclick = () => goto(k);
    li.append(b);
    ul.append(li);
  }
}
function renderDiary() {
  const ta = $('#text');
  if (shownDay !== cur) { ta.value = db.entries[cur]?.text ?? ''; shownDay = cur; }
  ta.disabled = !canSave && Object.keys(db).length === 0;
  renderMoods();
  renderCount();
  $('#delentry').disabled = !db.entries[cur];
  renderList();
}

/* ---------- hábitos ---------- */
const isDone = (id, k) => !!db.checks[k]?.includes(id);
function toggle(id, on) {
  const arr = (db.checks[cur] ??= []);
  const i = arr.indexOf(id);
  if (on && i < 0) arr.push(id);
  if (!on && i >= 0) arr.splice(i, 1);
  if (!arr.length) delete db.checks[cur];
  scheduleSave();
  renderHabits();
}
function habitDates(id) {
  const s = new Set();
  for (const [k, ids] of Object.entries(db.checks)) if (ids.includes(id)) s.add(k);
  return s;
}
function habitStats(h) {
  const D = habitDates(h.id), today = todayK();
  let base = D.has(today) ? today : addDays(today, -1), current = 0;
  while (D.has(base)) { current++; base = addDays(base, -1); } // o dia de hoje por fazer não quebra a sequência
  let best = 0, run = 0, prev = null;
  const sorted = [...D].sort();
  for (const k of sorted) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  const start = sorted[0] && sorted[0] < h.created ? sorted[0] : h.created;
  const span = Math.max(1, Math.min(30, daysBetween(start, today) + 1));
  let n = 0;
  for (let i = 0; i < span; i++) if (D.has(addDays(today, -i))) n++;
  return { current, best, rate: Math.round((n / span) * 100) };
}
function iconButton(name, label, onclick, extra = '') {
  const b = document.createElement('button');
  b.className = `icon-only ${extra}`.trim();
  b.innerHTML = icon(name);
  b.title = label;
  b.setAttribute('aria-label', label);
  b.onclick = onclick;
  return b;
}
function renderHabits() {
  const ul = $('#habits');
  ul.replaceChildren();
  $('#nohabits').hidden = db.habits.length > 0;
  $('#addhabit').disabled = db.habits.length >= MAX_HABITS;
  for (const h of db.habits) {
    const st = habitStats(h);
    const li = document.createElement('li');
    li.className = 'habit';

    const label = document.createElement('label');
    label.className = 'habit-main';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isDone(h.id, cur);
    cb.onchange = () => toggle(h.id, cb.checked);
    const name = document.createElement('span');
    name.textContent = h.name;
    label.append(cb, name);

    const actions = document.createElement('div');
    actions.className = 'habit-actions';
    actions.append(
      iconButton('pencil', `${t('Renomear')}: ${h.name}`, () => renameHabit(h)),
      iconButton('trash', `${t('Apagar')}: ${h.name}`, () => deleteHabit(h), 'danger'),
    );

    const meta = document.createElement('div');
    meta.className = 'habit-meta';
    const streak = document.createElement('span');
    streak.className = 'streak';
    streak.innerHTML = icon('flame');
    streak.append(days(st.current));
    streak.title = `${t('Melhor sequência')}: ${days(st.best)}`;
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.setAttribute('role', 'img');
    let done7 = 0;
    for (let i = 6; i >= 0; i--) { // últimos 7 dias até hoje, tal como a sequência; o dia aberto fica realçado
      const k = addDays(todayK(), -i), dot = document.createElement('i');
      if (isDone(h.id, k)) { dot.classList.add('done'); done7++; }
      if (k === cur) dot.classList.add('sel');
      dot.title = fmtDate(parse(k), { weekday: 'short', day: 'numeric', month: 'short' });
      dots.append(dot);
    }
    dots.setAttribute('aria-label', `${done7} ${t('de 7 dias')}`);
    const rate = document.createElement('span');
    rate.textContent = `${st.rate}% ${t('nos últimos 30 dias')}`;
    meta.append(streak, dots, rate);

    li.append(label, actions, meta);
    ul.append(li);
  }
}
async function guarded(fn) {
  try { await fn(); } catch (e) { setStatus(errMsg(e, t('Ocorreu um erro.')), 'error'); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const addHabit = () => guarded(async () => {
  const name = await os.dialog.prompt({ title: t('Novo hábito'), message: t('Nome do hábito:'), okLabel: t('Criar') });
  if (!name || !name.trim()) return;
  db.habits.push({ id: uid(), name: name.trim().slice(0, 60), created: todayK() });
  scheduleSave();
  renderHabits();
});
const renameHabit = h => guarded(async () => {
  const name = await os.dialog.prompt({ title: t('Renomear hábito'), message: t('Novo nome:'), defaultValue: h.name, okLabel: t('Guardar') });
  if (!name || !name.trim()) return;
  h.name = name.trim().slice(0, 60);
  scheduleSave();
  renderHabits();
});
const deleteHabit = h => guarded(async () => {
  const ok = await os.dialog.confirm({
    title: t('Apagar hábito'),
    message: `${t('Apagar o hábito')} "${h.name}"? ${t('O histórico será removido.')}`,
    okLabel: t('Apagar'), danger: true,
  });
  if (!ok) return;
  db.habits = db.habits.filter(x => x.id !== h.id);
  for (const k of Object.keys(db.checks)) {
    db.checks[k] = db.checks[k].filter(id => id !== h.id);
    if (!db.checks[k].length) delete db.checks[k];
  }
  scheduleSave();
  renderHabits();
});

/* ---------- resumo ---------- */
function renderSummary() {
  const today = todayK(), ents = Object.entries(db.entries);
  const totalWords = ents.reduce((n, [, e]) => n + words(e.text), 0);
  let writeStreak = 0, base = db.entries[today]?.text.trim() ? today : addDays(today, -1);
  while (db.entries[base]?.text.trim()) { writeStreak++; base = addDays(base, -1); }
  const best = db.habits.map(h => ({ h, ...habitStats(h) })).sort((a, b) => b.rate - a.rate)[0];

  const dl = $('#stats');
  dl.replaceChildren();
  [
    [t('Entradas'), fmtNum(ents.length)],
    [t('Palavras'), fmtNum(totalWords)],
    [t('Dias seguidos a escrever'), fmtNum(writeStreak)],
    [t('Melhor hábito (30 dias)'), best ? `${best.h.name} (${best.rate}%)` : '—'],
  ].forEach(([k, v]) => {
    const box = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v;
    box.append(dt, dd);
    dl.append(box);
  });

  // mapa de atividade dos hábitos (12 semanas, semana a começar à segunda)
  const weeks = 12, dow = (parse(today).getDay() + 6) % 7;
  const start = addDays(today, -(dow + (weeks - 1) * 7));
  const ids = new Set(db.habits.map(h => h.id)), total = db.habits.length;
  const heat = $('#heat');
  heat.replaceChildren();
  let sum = 0, cnt = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const k = addDays(start, i), cell = document.createElement('i');
    if (k > today) cell.className = 'future';
    else {
      const done = (db.checks[k] || []).filter(id => ids.has(id)).length;
      const p = total ? Math.round((done / total) * 100) : 0;
      cell.style.setProperty('--p', p);
      cell.title = `${fmtDate(parse(k), { day: 'numeric', month: 'long' })}: ${done}/${total}`;
      sum += p; cnt++;
    }
    heat.append(cell);
  }
  const heatNote = total ? `${t('Média')}: ${Math.round(sum / cnt)}% ${t('nas últimas 12 semanas')}` : t('Cria hábitos para ver o mapa de atividade.');
  $('#heatnote').textContent = heatNote;
  heat.setAttribute('aria-label', heatNote);

  // gráfico de humor (30 dias)
  const N = 30, X = j => 12 + (j * 276) / (N - 1), Y = m => 90 - (m - 1) * 20;
  let path = '', prevHad = false, dots = '', moodSum = 0, moodN = 0;
  for (let j = 0; j < N; j++) {
    const m = db.entries[addDays(today, -(N - 1 - j))]?.mood;
    if (!m) { prevHad = false; continue; }
    path += `${prevHad ? 'L' : 'M'}${X(j).toFixed(1)} ${Y(m)}`;
    dots += `<circle cx="${X(j).toFixed(1)}" cy="${Y(m)}" r="3" fill="${MOODS[m - 1].color}"/>`;
    prevHad = true; moodSum += m; moodN++;
  }
  const grid = [10, 30, 50, 70, 90].map(y => `<line class="grid" x1="8" x2="292" y1="${y}" y2="${y}"/>`).join('');
  $('#chart').innerHTML = `<svg viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${grid}<path class="line" d="${path}"/>${dots}</svg>`;
  const chartNote = moodN
    ? `${t('Humor médio')}: ${fmtNum(moodSum / moodN, { maximumFractionDigits: 1 })}/5 (${moodN} ${moodN === 1 ? t('registo') : t('registos')})`
    : t('Regista o humor nas entradas para ver o gráfico.');
  $('#chartnote').textContent = chartNote;
  $('#chart').setAttribute('aria-label', chartNote);
}

/* ---------- exportação ---------- */
function buildMd() {
  const L = [`# ${t('Diário')}`, ''];
  for (const k of Object.keys(db.entries).sort().reverse()) {
    const e = db.entries[k], m = MOODS.find(x => x.v === e.mood);
    L.push(`## ${cap(fmtDate(parse(k), LONG))}${m ? ` — ${t(m.label)}` : ''}`, '', e.text.trim(), '');
  }
  if (db.habits.length) {
    L.push(`# ${t('Hábitos')}`, '');
    for (const h of db.habits) {
      const s = habitStats(h);
      L.push(`- **${h.name}**: ${t('sequência atual')} ${s.current}, ${t('melhor')} ${s.best}, ${s.rate}% ${t('nos últimos 30 dias')}`);
    }
    L.push('');
  }
  return L.join('\n');
}
const exportMd = () => guarded(async () => {
  const path = await os.dialog.save({ title: t('Exportar diário'), start: '/home/user/Documentos', defaultName: 'diario.md' });
  if (!path) return;
  await os.fs.write(path, buildMd());
  setStatus(`${t('Exportado para')} ${path}`, 'success');
});

/* ---------- apresentação ---------- */
function localizeAttrs() {
  document.querySelectorAll('[aria-label]').forEach(el => {
    el.dataset.origAria ??= el.getAttribute('aria-label');
    el.setAttribute('aria-label', t(el.dataset.origAria));
  });
  document.querySelectorAll('[placeholder]').forEach(el => {
    el.dataset.origPh ??= el.getAttribute('placeholder');
    el.setAttribute('placeholder', t(el.dataset.origPh));
  });
}
function renderBar() {
  const today = todayK();
  $('#daylabel').textContent = cap(fmtDate(parse(cur), LONG));
  const pickEl = $('#datepick');
  pickEl.value = cur;
  pickEl.max = today;
  $('#next').disabled = cur >= today;
  $('#today').disabled = cur === today;
}
function renderAll() {
  renderBar();
  if (tab === 'diary') renderDiary();
  if (tab === 'habits') renderHabits();
  if (tab === 'summary') renderSummary();
}

/* ---------- arranque ---------- */
function init() {
  document.querySelectorAll('[data-icon]').forEach(b => b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon)));
  const tabs = [...document.querySelectorAll('[role=tab]')];
  tabs.forEach((b, i) => {
    b.onclick = () => pick(b.dataset.tab);
    b.onkeydown = e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      pick(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].dataset.tab, true);
    };
  });
  $('#prev').onclick = () => goto(addDays(cur, -1));
  $('#next').onclick = () => goto(addDays(cur, 1));
  $('#today').onclick = () => goto(todayK());
  $('#datepick').onchange = e => { if (e.target.value) goto(e.target.value); };
  $('#text').addEventListener('input', e => setEntry({ text: e.target.value }));
  $('#search').addEventListener('input', renderList);
  $('#delentry').onclick = () => guarded(async () => {
    const ok = await os.dialog.confirm({ title: t('Apagar entrada'), message: t('Apagar a entrada deste dia?'), okLabel: t('Apagar'), danger: true });
    if (!ok) return;
    delete db.entries[cur];
    shownDay = null;
    scheduleSave();
    renderAll();
  });
  $('#addhabit').onclick = addHabit;
  $('#export').onclick = exportMd;
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); dirty = true; flush(); } });
  // o fecho da janela não avisa a app: guardar sempre que a app perde visibilidade ou foco
  addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  addEventListener('pagehide', flush);
  addEventListener('blur', flush);
  os.i18n?.onChange?.(() => { localizeAttrs(); renderAll(); });
  localizeAttrs();
  load();
}
init();
