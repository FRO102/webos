const $ = id => document.getElementById(id);
const groups = {
  Comprimento: { m: ['Metro', 1], km: ['Quilómetro', 1000], cm: ['Centímetro', .01], mm: ['Milímetro', .001], mi: ['Milha', 1609.344], yd: ['Jarda', .9144], ft: ['Pé', .3048], in: ['Polegada', .0254] },
  Massa: { kg: ['Quilograma', 1], g: ['Grama', .001], mg: ['Miligrama', .000001], t: ['Tonelada', 1000], lb: ['Libra', .45359237], oz: ['Onça', .028349523125] },
  Temperatura: { C: ['Celsius'], F: ['Fahrenheit'], K: ['Kelvin'] },
  Área: { m2: ['Metro quadrado', 1], km2: ['Quilómetro quadrado', 1e6], cm2: ['Centímetro quadrado', .0001], ha: ['Hectare', 10000], acre: ['Acre', 4046.8564224], ft2: ['Pé quadrado', .09290304] },
  Volume: { L: ['Litro', 1], mL: ['Mililitro', .001], m3: ['Metro cúbico', 1000], gal: ['Galão (EUA)', 3.785411784], cup: ['Chávena (EUA)', .2365882365], pt: ['Pinta (EUA)', .473176473] },
  Dados: { B: ['Byte', 1], kB: ['Kilobyte (1000 B)', 1000], MB: ['Megabyte (1000 kB)', 1e6], GB: ['Gigabyte (1000 MB)', 1e9], KiB: ['Kibibyte (1024 B)', 1024], MiB: ['Mebibyte (1024 KiB)', 1048576], GiB: ['Gibibyte (1024 MiB)', 1073741824], bit: ['Bit', .125] }
};
let category = 'Comprimento', favorites = [], history = [];
let historyTimer;
const unitList = () => Object.entries(groups[category]);
const format = value => Number(value.toPrecision(9)).toLocaleString(os.i18n.locale, { maximumFractionDigits: 8 });
const unitName = key => groups[category][key][0];
function convert(value, from, to) {
  if (category !== 'Temperatura') return value * groups[category][from][1] / groups[category][to][1];
  const celsius = from === 'C' ? value : from === 'F' ? (value - 32) * 5 / 9 : value - 273.15;
  return to === 'C' ? celsius : to === 'F' ? celsius * 9 / 5 + 32 : celsius + 273.15;
}
function populate(select, preferred) { select.replaceChildren(...unitList().map(([key, [name]]) => new Option(`${name} (${key})`, key))); select.value = groups[category][preferred] ? preferred : unitList()[0][0]; }
function record(track = false) {
  const amount = Number($('amount').value), from = $('from-unit').value, to = $('to-unit').value;
  if (!Number.isFinite(amount) || !from || !to) return;
  const result = convert(amount, from, to); $('result').textContent = format(result); $('live-result').textContent = `${format(amount)} ${from} = ${format(result)} ${to}`;
  drawQuick(amount, from); renderFavorites();
  if (track) { clearTimeout(historyTimer); historyTimer = setTimeout(() => persistHistory({ category, amount, from, to, result }), 500); }
}
function drawQuick(amount, from) {
  const results = unitList().filter(([unit]) => unit !== from).slice(0, 6);
  $('quick-results').replaceChildren(...results.map(([unit, [name]]) => { const button = document.createElement('button'); button.className = 'quick'; button.innerHTML = '<strong></strong><small></small>'; button.querySelector('strong').textContent = format(convert(amount, from, unit)); button.querySelector('small').textContent = name; button.onclick = () => { $('to-unit').value = unit; record(true); }; return button; }));
}
async function persistHistory(item) {
  const last = history[0]; if (last && last.category === item.category && last.amount === item.amount && last.from === item.from && last.to === item.to) return;
  history.unshift(item); history = history.slice(0, 8); await os.storage.set('history', history).catch(() => {}); renderHistory();
}
function renderHistory() {
  $('empty-history').hidden = history.length > 0;
  $('history-list').replaceChildren(...history.map(item => { const li = document.createElement('li'), button = document.createElement('button'), left = document.createElement('strong'), right = document.createElement('span'); left.textContent = `${format(item.amount)} ${item.from} → ${format(item.result)} ${item.to}`; right.textContent = `${item.category} · ${unitNameSafe(item.category, item.from)} → ${unitNameSafe(item.category, item.to)}`; button.append(left, right); button.onclick = () => { category = item.category; renderCategories(); populate($('from-unit'), item.from); populate($('to-unit'), item.to); $('amount').value = item.amount; record(); }; li.append(button); return li; }));
}
function renderFavoriteList() {
  $('empty-favorites').hidden = favorites.length > 0;
  $('favorite-list').replaceChildren(...favorites.map((item, index) => {
    const li = document.createElement('li'), button = document.createElement('button'), label = document.createElement('strong'), remove = document.createElement('span');
    label.textContent = `${item.category} · ${unitNameSafe(item.category, item.from)} → ${unitNameSafe(item.category, item.to)}`; remove.textContent = 'Remover';
    button.append(label, remove); button.onclick = event => { if (event.target === remove) { favorites.splice(index, 1); os.storage.set('favorites', favorites); renderFavoriteList(); } else loadFavorite(item); };
    li.append(button); return li;
  }));
}
function unitNameSafe(group, unit) { return groups[group]?.[unit]?.[0] || unit; }
function renderCategories() { $('categories').replaceChildren(...Object.keys(groups).map(name => { const button = document.createElement('button'); button.textContent = name; button.setAttribute('aria-pressed', String(category === name)); button.onclick = () => { const previous = category; category = name; renderCategories(); populate($('from-unit'), previous === name ? $('from-unit').value : undefined); populate($('to-unit'), previous === name ? $('to-unit').value : undefined); record(); }; return button; })); }
function renderFavorites() { $('favorite-current').textContent = favorites.some(item => item.category === category && item.from === $('from-unit').value && item.to === $('to-unit').value) ? '★' : '☆'; }
function loadFavorite(item) { category = item.category; renderCategories(); populate($('from-unit'), item.from); populate($('to-unit'), item.to); record(true); }
renderCategories(); populate($('from-unit'), 'm'); populate($('to-unit'), 'cm');
os.storage.get('history').then(value => { history = value ?? []; renderHistory(); }).catch(() => {});
os.storage.get('favorites').then(value => { favorites = value ?? []; renderFavoriteList(); renderFavorites(); }).catch(() => {});
$('amount').oninput = () => record(true); $('from-unit').onchange = () => record(true); $('to-unit').onchange = () => record(true);
$('swap').onclick = () => { const from = $('from-unit').value; $('from-unit').value = $('to-unit').value; $('to-unit').value = from; record(true); };
$('favorite-current').onclick = async () => { const item = { category, from: $('from-unit').value, to: $('to-unit').value }; if (!favorites.some(value => value.category === item.category && value.from === item.from && value.to === item.to)) favorites.unshift(item); favorites = favorites.slice(0, 12); await os.storage.set('favorites', favorites); renderFavorites(); renderFavoriteList(); $('status').textContent = 'Conversão guardada nos favoritos.'; };
$('clear-history').onclick = async () => { history = []; await os.storage.set('history', history); renderHistory(); };
os.i18n.onChange(record);
record();