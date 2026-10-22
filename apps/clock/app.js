const $ = (s, r = document) => r.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- separadores ---------- */
const tabs = [...document.querySelectorAll('[role=tab]')];
function pick(t) {
  tabs.forEach(x => {
    const on = x === t;
    x.setAttribute('aria-selected', String(on));
    x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.onclick = () => pick(t);
  t.onkeydown = e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    pick(n); n.focus();
  };
});

/* ---------- relógio ---------- */
for (let i = 0; i < 60; i++) {
  const major = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = major ? 80 : 86;
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', 100 + Math.sin(a) * r1); l.setAttribute('y1', 100 - Math.cos(a) * r1);
  l.setAttribute('x2', 100 + Math.sin(a) * 92); l.setAttribute('y2', 100 - Math.cos(a) * 92);
  if (major) l.setAttribute('class', 'major');
  $('#ticks').append(l);
}
const ZONES = [['Local', undefined], ['Lisboa', 'Europe/Lisbon'], ['Nova Iorque', 'America/New_York'], ['Tóquio', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney']];
const worldTimes = ZONES.map(([city]) => {
  const li = document.createElement('li');
  li.innerHTML = '<span class="city"></span><time></time>';
  li.firstChild.textContent = city;
  $('#world').append(li);
  return li.lastChild;
});

function tickClock() {
  const d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  $('#hh').setAttribute('transform', `rotate(${h * 30} 100 100)`);
  $('#mm').setAttribute('transform', `rotate(${m * 6} 100 100)`);
  $('#ss').setAttribute('transform', `rotate(${s * 6} 100 100)`);
  $('#digital').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(s)}`;
  $('#longdate').textContent = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  ZONES.forEach(([, tz], i) => { worldTimes[i].textContent = d.toLocaleTimeString('pt-PT', { timeZone: tz, hour: '2-digit', minute: '2-digit' }); });
}
tickClock();
setInterval(tickClock, 1000);

/* ---------- calendário (eventos guardados com os.storage) ---------- */
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
let view = new Date(); view.setDate(1);
let selected = key(new Date());
let events = {};
const save = () => os.storage.set('events', events);

function render(focus) {
  const y = view.getFullYear(), m = view.getMonth(), todayK = key(new Date());
  $('#month').textContent = cap(view.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }));
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // semana começa à segunda
  const grid = $('#grid');
  grid.replaceChildren();
  for (let i = 0; i < 42; i++) {
    const d = new Date(y, m, 1 - offset + i), k = key(d), n = events[k]?.length ?? 0;
    const b = document.createElement('button');
    b.textContent = d.getDate();
    b.className = [d.getMonth() !== m && 'out', k === todayK && 'today', k === selected && 'sel', n && 'has'].filter(Boolean).join(' ');
    b.setAttribute('aria-label', d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) + (n ? `, ${n} evento${n > 1 ? 's' : ''}` : ''));
    b.setAttribute('aria-pressed', String(k === selected));
    b.onclick = () => {
      selected = k;
      if (d.getMonth() !== m) view = new Date(d.getFullYear(), d.getMonth(), 1);
      render(true);
    };
    grid.append(b);
    if (focus && k === selected) queueMicrotask(() => b.focus());
  }
  renderDay();
}

function renderDay() {
  const [y, m, d] = selected.split('-').map(Number);
  $('#dayhead').textContent = new Date(y, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const ul = $('#events');
  ul.replaceChildren();
  const list = events[selected] ?? [];
  if (!list.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Sem eventos neste dia.'; ul.append(li); }
  list.forEach((ev, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="t"></span><span class="x"></span><button aria-label="Apagar evento">✕</button>';
    li.children[0].textContent = ev.t || '—';
    li.children[1].textContent = ev.x;
    li.children[2].onclick = () => {
      list.splice(i, 1);
      if (!list.length) delete events[selected];
      save(); render();
    };
    ul.append(li);
  });
}

function addEvent() {
  const x = $('#evtext').value.trim();
  if (!x) return $('#evtext').focus();
  (events[selected] ??= []).push({ t: $('#evtime').value, x });
  events[selected].sort((a, b) => (a.t || '99:99').localeCompare(b.t || '99:99'));
  $('#evtext').value = ''; $('#evtime').value = '';
  save(); render(); $('#evtext').focus();
}
$('#evadd').onclick = addEvent;
$('#evtext').onkeydown = e => { if (e.key === 'Enter') addEvent(); };
$('#prev').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
$('#next').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };
$('#today').onclick = () => { view = new Date(); view.setDate(1); selected = key(new Date()); render(true); };

render();
os.storage.get('events').then(e => { events = e ?? {}; render(); }).catch(() => {});

/* ---------- cronómetro ---------- */
let swStart = 0, swAcc = 0, swInt = null, laps = [];
const swNow = () => swAcc + (swInt ? performance.now() - swStart : 0);
const fmtSw = ms => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}.${pad(Math.floor(ms / 10) % 100)}`;
const swPaint = () => { $('#swdisp').textContent = fmtSw(swNow()); };
$('#swgo').onclick = () => {
  if (swInt) { swAcc += performance.now() - swStart; clearInterval(swInt); swInt = null; }
  else { swStart = performance.now(); swInt = setInterval(swPaint, 50); }
  $('#swgo').textContent = swInt ? 'Pausar' : 'Continuar';
  $('#swlap').disabled = !swInt;
  swPaint();
};
$('#swlap').onclick = () => {
  laps.unshift(swNow());
  const ol = $('#laps');
  ol.replaceChildren(...laps.map((t, i) => {
    const li = document.createElement('li');
    li.textContent = `${fmtSw(t)}  (+${fmtSw(t - (laps[i + 1] ?? 0))})`;
    return li;
  }));
  ol.start = laps.length; ol.reversed = true;
};
$('#swreset').onclick = () => {
  clearInterval(swInt); swInt = null; swAcc = 0; laps = [];
  $('#swgo').textContent = 'Iniciar'; $('#swlap').disabled = true;
  $('#laps').replaceChildren(); swPaint();
};

/* ---------- temporizador ---------- */
let tEnd = 0, tLeft = 0, tInt = null, lastShown = '';
const fmtT = ms => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const inputMs = () => ((+$('#tm').value || 0) * 60 + (+$('#ts').value || 0)) * 1000;
function tPaint(ms) {
  const t = fmtT(ms);
  $('#tdisp').textContent = t;
  if (t !== lastShown) { lastShown = t; os.window.setTitle(tInt ? `${t} — Relógio` : 'Relógio'); }
}
function tTick() {
  const rem = tEnd - Date.now();
  if (rem <= 0) {
    clearInterval(tInt); tInt = null; tLeft = 0;
    $('#tgo').textContent = 'Iniciar';
    tPaint(0); os.window.setTitle('Relógio'); lastShown = '';
    os.notify('O temporizador terminou.');
    return;
  }
  tPaint(rem);
}
$('#tgo').onclick = () => {
  if (tInt) { tLeft = tEnd - Date.now(); clearInterval(tInt); tInt = null; $('#tgo').textContent = 'Continuar'; tPaint(tLeft); return; }
  if (!tLeft) tLeft = inputMs();
  if (!tLeft) return;
  tEnd = Date.now() + tLeft;
  tInt = setInterval(tTick, 200);
  $('#tgo').textContent = 'Pausar';
  tTick();
};
$('#treset').onclick = () => {
  clearInterval(tInt); tInt = null; tLeft = 0; lastShown = '';
  $('#tgo').textContent = 'Iniciar'; tPaint(inputMs()); os.window.setTitle('Relógio');
};
['#tm', '#ts'].forEach(s => $(s).addEventListener('input', () => { if (!tInt && !tLeft) tPaint(inputMs()); }));
document.querySelectorAll('[data-min]').forEach(b => {
  b.onclick = () => { $('#tm').value = b.dataset.min; $('#ts').value = 0; $('#treset').click(); };
});
tPaint(inputMs());
