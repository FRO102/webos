'use strict';

/* Geradores (palavra-passe, UUID, token), crontab, data/hora e JWT. */

/* ---------- aleatoriedade segura ---------- */
function rnd(max) { // inteiro uniforme em [0, max) sem enviesamento de módulo
  const lim = Math.floor(4294967296 / max) * max, a = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim);
  return x % max;
}
const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));

registerTool('gen', {
  init() {
    const SETS = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~' };
    const len = $('#pw-len');

    function password() {
      const noAmbig = $('#pw-ambig').checked;
      const sets = Object.keys(SETS).filter(k => $(`#pw-${k}`).checked).map(k => (noAmbig ? SETS[k].replace(/[O0Il1|]/g, '') : SETS[k]));
      if (!sets.length) return null;
      const n = Number(len.value), pool = sets.join('');
      const chars = sets.map(s => s[rnd(s.length)]); // pelo menos um de cada conjunto escolhido
      while (chars.length < n) chars.push(pool[rnd(pool.length)]);
      for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
      return { text: chars.slice(0, n).join(''), bits: n * Math.log2(new Set(pool).size) };
    }
    function genPasswords() {
      const list = $('#pw-list'), st = $('#pw-strength');
      list.replaceChildren();
      const first = password();
      if (!first) return msg(st, t('Escolhe pelo menos um tipo de caracteres.'), 'error');
      const label = first.bits < 40 ? t('Fraca') : first.bits < 60 ? t('Razoável') : first.bits < 80 ? t('Forte') : t('Muito forte');
      msg(st, `≈ ${Math.round(first.bits)} bits — ${label}`, first.bits < 40 ? 'error' : 'success');
      for (let i = 0; i < 5; i++) {
        const p = i ? password() : first, li = document.createElement('li'), c = document.createElement('code'), b = document.createElement('button');
        c.textContent = p.text;
        b.textContent = t('Copiar');
        b.setAttribute('aria-label', `${t('Copiar palavra-passe')} ${i + 1}`);
        b.onclick = () => copyText(p.text);
        li.append(c, b);
        list.append(li);
      }
    }
    len.addEventListener('input', () => { $('#pw-lenout').textContent = len.value; genPasswords(); });
    ['lower', 'upper', 'digits', 'symbols', 'ambig'].forEach(k => $(`#pw-${k}`).addEventListener('change', genPasswords));
    $('#pw-gen').onclick = genPasswords;

    const uuid = () => {
      if (crypto.randomUUID) return crypto.randomUUID();
      const b = randomBytes(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    };
    const genUuids = () => { $('#uuid-out').value = Array.from({ length: Number($('#uuid-n').value) }, uuid).join('\n'); };
    $('#uuid-gen').onclick = genUuids;
    $('#uuid-n').addEventListener('change', genUuids);

    const genToken = () => {
      const bytes = randomBytes(Number($('#tok-bytes').value));
      $('#tok-out').textContent = $('#tok-fmt').value === 'hex'
        ? [...bytes].map(x => x.toString(16).padStart(2, '0')).join('')
        : btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    $('#tok-gen').onclick = genToken;
    ['#tok-bytes', '#tok-fmt'].forEach(s => $(s).addEventListener('change', genToken));

    genPasswords(); genUuids(); genToken();
  },
});

/* ---------- Crontab ---------- */
const CRON_ALIASES = { '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *', '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *' };
const CRON_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const CRON_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function cronField(raw, min, max, names) {
  const val = s => {
    const i = names ? names.indexOf(s.toUpperCase()) : -1;
    const n = i >= 0 ? (names === CRON_MONTHS ? i + 1 : i) : /^\d+$/.test(s) ? Number(s) : NaN;
    if (Number.isNaN(n)) throw new Error(`${t('Valor inválido')}: "${s}"`);
    return n;
  };
  const out = new Set();
  for (const part of raw.split(',')) {
    const [rangeStr, stepStr, extra] = part.split('/');
    if (!rangeStr || extra !== undefined) throw new Error(`${t('Valor inválido')}: "${part}"`);
    let step = 1;
    if (stepStr !== undefined) {
      if (!/^\d+$/.test(stepStr) || Number(stepStr) < 1) throw new Error(`${t('Passo inválido')}: "${stepStr}"`);
      step = Number(stepStr);
    }
    let lo, hi;
    if (rangeStr === '*' || rangeStr === '?') { lo = min; hi = max; }
    else if (rangeStr.includes('-')) { const [x, y] = rangeStr.split('-'); lo = val(x); hi = val(y); }
    else { lo = val(rangeStr); hi = stepStr !== undefined ? max : lo; }
    if (lo < min || hi > max || lo > hi) throw new Error(`${t('Fora do intervalo')} ${min}–${max}: "${part}"`);
    for (let v = lo; v <= hi; v += step) out.add(max === 7 && v === 7 ? 0 : v); // 7 = domingo
  }
  return [...out].sort((a, b) => a - b);
}
function cronParse(expr) {
  const e = CRON_ALIASES[expr.trim().toLowerCase()] ?? expr.trim();
  const f = e.split(/\s+/);
  if (f.length !== 5) throw new Error(t('A expressão deve ter 5 campos: minuto hora dia-do-mês mês dia-da-semana.'));
  return {
    raw: f,
    minutes: cronField(f[0], 0, 59), hours: cronField(f[1], 0, 23), doms: cronField(f[2], 1, 31),
    months: cronField(f[3], 1, 12, CRON_MONTHS), dows: cronField(f[4], 0, 7, CRON_DAYS),
    domStar: /^[*?]/.test(f[2]), dowStar: /^[*?]/.test(f[4]),
  };
}
function cronNext(c, from, count = 10) {
  const out = [], start = new Date(from);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < 366 * 6 && out.length < count; i++) {
    const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i);
    if (!c.months.includes(d.getMonth() + 1)) continue;
    const domOk = c.doms.includes(d.getDate()), dowOk = c.dows.includes(d.getDay());
    // regra do cron: se ambos os campos estão restritos, basta um deles coincidir
    const dayOk = c.domStar && c.dowStar ? true : c.domStar ? dowOk : c.dowStar ? domOk : (domOk || dowOk);
    if (!dayOk) continue;
    for (const h of c.hours) for (const m of c.minutes) {
      const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
      if (dt >= start && dt.getHours() === h && out.length < count) out.push(dt);
    }
  }
  return out;
}
function cronDescribe(c) {
  const [rm, rh] = c.raw, step = r => /^\*\/(\d+)$/.exec(r)?.[1];
  const m1 = c.minutes.length === 1, h1 = c.hours.length === 1, list = a => a.join(', ');
  let time;
  if (rm === '*' && rh === '*') time = t('A cada minuto');
  else if (step(rm) && rh === '*') time = `${t('A cada')} ${step(rm)} ${t('minutos')}`;
  else if (m1 && h1) time = `${t('Às')} ${pad(c.hours[0])}:${pad(c.minutes[0])}`;
  else if (m1 && rh === '*') time = `${t('No minuto')} ${c.minutes[0]} ${t('de cada hora')}`;
  else if (m1 && step(rh)) time = `${t('A cada')} ${step(rh)} ${t('horas, no minuto')} ${c.minutes[0]}`;
  else if (m1) time = `${t('Às')} ${c.hours.map(h => `${pad(h)}:${pad(c.minutes[0])}`).join(', ')}`;
  else if (rh === '*') time = `${t('Nos minutos')} ${list(c.minutes)} ${t('de cada hora')}`;
  else time = `${t('Nos minutos')} ${list(c.minutes)} ${t('das horas')} ${list(c.hours)}`;
  const wd = i => new Date(2021, 0, 3 + i).toLocaleDateString(locale(), { weekday: 'long' }); // 3 jan 2021 = domingo
  const mn = i => new Date(2021, i - 1, 1).toLocaleDateString(locale(), { month: 'long' });
  let day;
  if (c.domStar && c.dowStar) day = t('todos os dias');
  else {
    const p = [];
    if (!c.domStar) p.push(`${t('no dia')} ${list(c.doms)} ${t('do mês')}`);
    if (!c.dowStar) {
      const d = c.dows.join();
      p.push(d === '1,2,3,4,5' ? t('de segunda a sexta-feira') : d === '0,6' ? t('ao fim de semana') : `${t('dias da semana')}: ${c.dows.map(wd).join(', ')}`);
    }
    day = p.join(` ${t('ou')} `);
  }
  const month = c.raw[3] === '*' ? '' : `, ${t('em')} ${c.months.map(mn).join(', ')}`;
  return `${time}, ${day}${month}.`;
}

registerTool('cron', {
  init() {
    const inEl = $('#cron-in'), m = $('#cron-msg');
    function run() {
      const desc = $('#cron-desc'), fields = $('#cron-fields'), next = $('#cron-next');
      desc.textContent = ''; fields.replaceChildren(); next.replaceChildren();
      let c;
      try { c = cronParse(inEl.value); } catch (e) { return msg(m, e.message, 'error'); }
      msg(m, t('Expressão válida.'), 'success');
      desc.textContent = cronDescribe(c);
      const all = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
      const shown = [c.minutes, c.hours, c.doms, c.months, c.dows].map((v, i) => (v.length === all[i][1] - all[i][0] + 1 ? t('todos') : v.join(', ')));
      fields.append(tableOf([
        [t('Minuto'), `${c.raw[0]} → ${shown[0]}`], [t('Hora'), `${c.raw[1]} → ${shown[1]}`], [t('Dia do mês'), `${c.raw[2]} → ${shown[2]}`],
        [t('Mês'), `${c.raw[3]} → ${shown[3]}`], [t('Dia da semana'), `${c.raw[4]} → ${shown[4]}`],
      ]));
      const runs = cronNext(c, new Date());
      if (!runs.length) { const li = document.createElement('li'); li.textContent = t('Nenhuma execução nos próximos 6 anos.'); next.append(li); }
      runs.forEach(d => {
        const li = document.createElement('li');
        li.textContent = fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        next.append(li);
      });
    }
    inEl.addEventListener('input', debounce(run, 200));
    $('#cron-preset').addEventListener('change', e => { if (e.target.value) { inEl.value = e.target.value; run(); } });
    run();
  },
});

/* ---------- Data e hora ---------- */
registerTool('time', {
  init() {
    const ep = $('#ts-epoch'), dt = $('#ts-date'), zone = $('#ts-zone'), out = $('#ts-out'), m = $('#ts-msg');
    const localIn = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const utcIn = d => d.toISOString().slice(0, 19);
    function relative(d) {
      const s = (d.getTime() - Date.now()) / 1000, a = Math.abs(s);
      const [v, u] = a < 60 ? [s, 'second'] : a < 3600 ? [s / 60, 'minute'] : a < 86400 ? [s / 3600, 'hour'] : a < 2592000 ? [s / 86400, 'day'] : a < 31536000 ? [s / 2592000, 'month'] : [s / 31536000, 'year'];
      return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(Math.round(v), u);
    }
    function show(d) {
      out.replaceChildren();
      const rows = [
        [t('Segundos'), String(Math.floor(d.getTime() / 1000))], [t('Milissegundos'), String(d.getTime())],
        ['ISO 8601 (UTC)', d.toISOString()],
        [t('Local'), fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })],
        [t('Relativo'), relative(d)],
      ];
      for (const [k, v] of rows) {
        const dtEl = document.createElement('dt'), dd = document.createElement('dd'), b = document.createElement('button');
        dtEl.textContent = k; dd.append(v);
        b.textContent = t('Copiar'); b.setAttribute('aria-label', `${t('Copiar')}: ${k}`); b.onclick = () => copyText(v);
        dd.append(b); out.append(dtEl, dd);
      }
    }
    function fromEpoch() {
      const n = Number(ep.value);
      if (!ep.value.trim() || !Number.isFinite(n)) { out.replaceChildren(); return msg(m, ep.value.trim() ? t('Timestamp inválido.') : '', ep.value.trim() ? 'error' : 'info'); }
      const d = new Date(Math.abs(n) >= 1e11 ? n : n * 1000);
      if (Number.isNaN(d.getTime())) { out.replaceChildren(); return msg(m, t('Timestamp inválido.'), 'error'); }
      msg(m, Math.abs(n) >= 1e11 ? t('Interpretado como milissegundos.') : t('Interpretado como segundos.'), 'info');
      dt.value = zone.value === 'utc' ? utcIn(d) : localIn(d);
      show(d);
    }
    function fromDate() {
      if (!dt.value) return;
      const d = new Date(zone.value === 'utc' ? `${dt.value.length === 16 ? `${dt.value}:00` : dt.value}Z` : dt.value);
      if (Number.isNaN(d.getTime())) return msg(m, t('Data inválida.'), 'error');
      ep.value = String(Math.floor(d.getTime() / 1000));
      msg(m, '', 'info');
      show(d);
    }
    ep.addEventListener('input', debounce(fromEpoch, 150));
    dt.addEventListener('input', fromDate);
    zone.addEventListener('change', fromEpoch);
    $('#ts-now').onclick = () => { ep.value = String(Math.floor(Date.now() / 1000)); fromEpoch(); };
    $('#ts-now').click();
  },
});

/* ---------- JWT ---------- */
registerTool('jwt', {
  init() {
    const inEl = $('#jwt-in'), m = $('#jwt-msg');
    function run() {
      const h = $('#jwt-header'), p = $('#jwt-payload'), cl = $('#jwt-claims');
      h.value = ''; p.value = ''; cl.replaceChildren();
      const tok = inEl.value.trim();
      if (!tok) return msg(m, '', 'info');
      const parts = tok.split('.');
      if (parts.length < 2 || parts.length > 3) return msg(m, t('Um JWT tem 3 partes separadas por pontos.'), 'error');
      let head, pay;
      try { head = JSON.parse(b64Decode(parts[0])); pay = JSON.parse(b64Decode(parts[1])); }
      catch { return msg(m, t('Não foi possível descodificar o token (Base64 ou JSON inválido).'), 'error'); }
      h.value = JSON.stringify(head, null, 2);
      p.value = JSON.stringify(pay, null, 2);
      msg(m, `${t('Token descodificado')}${head.alg ? ` (${head.alg})` : ''}.`, 'success');
      const now = Date.now() / 1000;
      for (const [k, label] of [['iat', t('Emitido em')], ['nbf', t('Válido a partir de')], ['exp', t('Expira em')]]) {
        if (typeof pay[k] !== 'number') continue;
        const dtEl = document.createElement('dt'), dd = document.createElement('dd');
        dtEl.textContent = label;
        dd.textContent = fmtDate(new Date(pay[k] * 1000), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (k === 'exp') dd.append(` — ${pay.exp < now ? t('expirado') : t('ainda válido')}`);
        if (k === 'nbf' && pay.nbf > now) dd.append(` — ${t('ainda não é válido')}`);
        cl.append(dtEl, dd);
      }
    }
    inEl.addEventListener('input', debounce(run, 200));
  },
});
