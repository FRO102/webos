const $ = id => document.getElementById(id);
let hex = '#267568', collections = [{ name: 'Favoritos', colors: [] }], selectedCollection = 0, syncing = false;
const clamp = (value, max) => Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
function parseHex(value) { const input = value.trim().replace(/^#/, ''); const expanded = input.length === 3 ? [...input].map(char => char + char).join('') : input; return /^[\da-f]{6}$/i.test(expanded) ? [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16)) : null; }
function toHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min; let h = 0, s = 0; const l = (max + min) / 2; if (delta) { s = delta / (1 - Math.abs(2 * l - 1)); if (max === r) h = ((g - b) / delta) % 6; else if (max === g) h = (b - r) / delta + 2; else h = (r - g) / delta + 4; h *= 60; if (h < 0) h += 360; } return [h, s * 100, l * 100]; }
function toRgb(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)].map(value => Math.round(value * 255)); }
const asHex = rgb => `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
function luminance(rgb) { const linear = rgb.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; }); return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]; }
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((x, y) => y - x); return (values[0] + .05) / (values[1] + .05); }
function grade(ratio) { return `${ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA grande' : 'Insuficiente'}`; }
function render() {
  const rgb = parseHex(hex); if (!rgb) return;
  syncing = true; $('hex').value = hex.toUpperCase(); $('color-picker').value = hex;
  ['red', 'green', 'blue'].forEach((id, index) => { $(id).value = rgb[index]; });
  const hsl = toHsl(rgb); ['hue', 'saturation', 'lightness'].forEach((id, index) => { $(id).value = Math.round(hsl[index]); });
  $('preview').style.backgroundColor = hex; $('preview-label').textContent = hex.toUpperCase();
  const white = contrast(rgb, [255, 255, 255]), black = contrast(rgb, [0, 0, 0]);
  $('white-ratio').textContent = `${white.toFixed(2)}:1`; $('white-grade').textContent = grade(white); $('on-white').style.color = hex; $('on-white').style.backgroundColor = '#fff'; $('on-white').querySelector('div').style.color = hex;
  $('black-ratio').textContent = `${black.toFixed(2)}:1`; $('black-grade').textContent = grade(black); $('on-black').style.color = hex; $('on-black').style.backgroundColor = '#263630'; $('on-black').querySelector('div').style.color = hex;
  syncing = false; renderCollections();
}
async function save() { await os.storage.set('collections', collections).catch(() => { $('status').textContent = 'Não foi possível guardar as coleções.'; }); }
function renderCollections() {
  $('collection-select').replaceChildren(...collections.map((item, index) => new Option(item.name, index))); $('collection-select').value = String(selectedCollection);
  const colors = collections[selectedCollection]?.colors ?? []; $('empty-swatches').hidden = colors.length > 0;
  $('swatches').replaceChildren(...colors.map((color, index) => { const card = document.createElement('button'); card.className = 'swatch'; card.title = `Selecionar ${color}`; const block = document.createElement('span'), code = document.createElement('code'), remove = document.createElement('span'); block.className = 'swatch-color'; block.style.background = color; code.textContent = color; remove.className = 'swatch-remove'; remove.textContent = '×'; remove.setAttribute('role', 'button'); remove.setAttribute('aria-label', `Remover ${color}`); remove.onclick = event => { event.stopPropagation(); collections[selectedCollection].colors.splice(index, 1); save(); renderCollections(); }; card.append(block, code, remove); card.onclick = () => { hex = color; render(); }; return card; }));
}
function setHex(value) { if (!syncing && parseHex(value)) { hex = asHex(parseHex(value)); render(); } }
$('color-picker').oninput = event => setHex(event.target.value);
$('hex').onchange = event => { const parsed = parseHex(event.target.value); if (parsed) setHex(asHex(parsed)); else { event.target.value = hex; $('status').textContent = 'Código HEX inválido.'; } };
['red', 'green', 'blue'].forEach((id, index) => $(id).oninput = () => { const rgb = ['red', 'green', 'blue'].map(name => clamp($(name).value, 255)); rgb[index] = clamp($(id).value, 255); hex = asHex(rgb); render(); });
['hue', 'saturation', 'lightness'].forEach(id => $(id).oninput = () => { const rgb = toRgb(clamp($('hue').value, 360), clamp($('saturation').value, 100), clamp($('lightness').value, 100)); hex = asHex(rgb); render(); });
$('random').onclick = () => { hex = asHex(Array.from({ length: 3 }, () => Math.floor(Math.random() * 256))); render(); };
$('copy-hex').onclick = async () => { try { await os.clipboard.write(hex.toUpperCase()); $('status').textContent = `${hex.toUpperCase()} copiado.`; } catch { $('status').textContent = 'A cópia não está disponível.'; } };
$('new-collection').onclick = async () => { const name = await os.dialog.prompt({ title: 'Nova coleção', message: 'Nome da coleção:', defaultValue: 'Nova coleção', okLabel: 'Criar' }); if (name?.trim()) { collections.push({ name: name.trim(), colors: [] }); selectedCollection = collections.length - 1; await save(); renderCollections(); } };
$('collection-select').onchange = () => { selectedCollection = Number($('collection-select').value); renderCollections(); };
$('add-color').onclick = async () => { const colors = collections[selectedCollection].colors; if (colors.includes(hex.toUpperCase())) return $('status').textContent = 'Esta cor já existe na coleção.'; colors.push(hex.toUpperCase()); await save(); renderCollections(); $('status').textContent = `${hex.toUpperCase()} guardado.`; };
$('rename-collection').onclick = async () => { const item = collections[selectedCollection], name = await os.dialog.prompt({ title: 'Renomear coleção', message: 'Novo nome:', defaultValue: item.name, okLabel: 'Renomear' }); if (name?.trim()) { item.name = name.trim(); await save(); renderCollections(); } };
$('delete-collection').onclick = async () => { if (collections.length < 2) return $('status').textContent = 'Mantém pelo menos uma coleção.'; if (!(await os.dialog.confirm({ title: 'Apagar coleção', message: `Apagar a coleção "${collections[selectedCollection].name}"?`, okLabel: 'Apagar', danger: true }))) return; collections.splice(selectedCollection, 1); selectedCollection = 0; await save(); renderCollections(); };
os.storage.get('collections').then(value => { if (Array.isArray(value) && value.length) collections = value; render(); }).catch(render);
render();