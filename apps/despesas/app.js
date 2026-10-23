const $ = id => document.getElementById(id);
const DEFAULT_CATEGORIES = { expense: ['Casa', 'Alimentação', 'Transportes', 'Saúde', 'Lazer', 'Compras', 'Serviços', 'Outros'], income: ['Salário', 'Freelance', 'Investimentos', 'Reembolso', 'Outros'] };
const COLORS = ['#16836a', '#e0a23a', '#d66a55', '#5685a0', '#8d72a8', '#82a64c', '#c27891', '#667c78'];
const money = value => new Intl.NumberFormat(os.i18n.locale, { style: 'currency', currency: 'EUR' }).format(value);
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const today = new Date();
let view = new Date(today.getFullYear(), today.getMonth(), 1), entries = [], budgets = {}, categories = structuredClone(DEFAULT_CATEGORIES), editingId = null;
const say = text => { $('status').textContent = text; };
const save = async () => { try { await os.storage.set('finance-data', { entries, budgets, categories }); } catch { say('Não foi possível guardar os dados.'); } };

function selectedEntries() { return entries.filter(item => item.date.startsWith(monthKey(view))).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created); }
function updateCategories() {
  const options = categories[$('entry-kind').value];
  $('entry-category').replaceChildren(...options.map(name => new Option(name, name)));
  $('remove-category').disabled = options.length <= 1;
}
function render() {
  const key = monthKey(view), items = selectedEntries();
  $('month-label').textContent = view.toLocaleDateString(os.i18n.locale, { month: 'long', year: 'numeric' });
  const income = items.filter(item => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = items.filter(item => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
  $('balance').textContent = money(income - expense); $('balance').className = income >= expense ? 'positive' : 'negative';
  $('income-total').textContent = money(income); $('expense-total').textContent = money(expense);
  const budget = Number(budgets[key]) || 0, progress = budget ? expense / budget * 100 : 0;
  $('budget-input').value = budget || ''; $('budget-progress').value = Math.min(progress, 100); $('budget-progress').classList.toggle('over', progress > 100);
  $('budget-note').textContent = budget ? `${money(Math.max(0, budget - expense))} disponíveis${progress > 100 ? ` · ${money(expense - budget)} acima do limite` : ''}` : 'Sem limite definido';
  $('entry-count').textContent = `${items.length} ${items.length === 1 ? 'movimento' : 'movimentos'}`;
  $('empty-state').hidden = items.length > 0;
  $('entry-list').replaceChildren(...items.map(item => {
    const row = document.createElement('tr');
    const values = [new Date(`${item.date}T12:00:00`).toLocaleDateString(os.i18n.locale), item.description, item.category];
    values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    const amount = document.createElement('td'); amount.textContent = `${item.kind === 'income' ? '+' : '−'} ${money(item.amount)}`; amount.className = item.kind === 'income' ? 'positive' : 'negative'; row.append(amount);
    const action = document.createElement('td'), actions = document.createElement('div'), edit = document.createElement('button'), remove = document.createElement('button');
    actions.className = 'row-actions'; edit.type = remove.type = 'button'; edit.textContent = 'Editar'; remove.textContent = 'Apagar'; remove.className = 'delete';
    edit.setAttribute('aria-label', `Editar ${item.description}`); remove.setAttribute('aria-label', `Apagar ${item.description}`);
    edit.onclick = () => startEdit(item); remove.onclick = async () => {
      const accepted = await os.dialog.confirm({ title: 'Apagar movimento', message: `Apagar o movimento "${item.description}" de ${money(item.amount)}?`, okLabel: 'Apagar', danger: true });
      if (!accepted) return;
      entries = entries.filter(entry => entry.id !== item.id); await save(); render();
    };
    actions.append(edit, remove); action.append(actions); row.append(action); return row;
  }));
  drawDaily(items); drawCategories(items);
}
function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio); return { ctx, width: rect.width, height: rect.height };
}
function drawDaily(items) {
  const { ctx, width, height } = canvasContext($('daily-chart')), days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const incoming = Array(days).fill(0), outgoing = Array(days).fill(0);
  items.forEach(item => (item.kind === 'income' ? incoming : outgoing)[Number(item.date.slice(-2)) - 1] += item.amount);
  const max = Math.max(1, ...incoming, ...outgoing), pad = { left: 8, right: 8, top: 9, bottom: 20 }, graphHeight = height - pad.top - pad.bottom, graphWidth = width - pad.left - pad.right;
  ctx.clearRect(0, 0, width, height); ctx.font = '9px Segoe UI'; ctx.textAlign = 'center';
  for (let line = 0; line < 3; line++) { const y = pad.top + graphHeight * line / 2; ctx.strokeStyle = '#e6ece9'; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke(); }
  const group = graphWidth / days, bar = Math.max(2, Math.min(8, group * .32));
  for (let day = 0; day < days; day++) {
    const x = pad.left + group * (day + .5);
    [[incoming[day], '#16836a', -bar * .55], [outgoing[day], '#d66a55', bar * .55]].forEach(([value, color, offset]) => { const h = value / max * graphHeight; ctx.fillStyle = color; ctx.fillRect(x + offset - bar / 2, pad.top + graphHeight - h, bar, h); });
    if (day === 0 || (day + 1) % 5 === 0 || day === days - 1) { ctx.fillStyle = '#657974'; ctx.fillText(String(day + 1), x, height - 5); }
  }
  $('daily-total').textContent = `↑ ${money(incoming.reduce((a, b) => a + b, 0))}  ↓ ${money(outgoing.reduce((a, b) => a + b, 0))}`;
}
function drawCategories(items) {
  const kind = $('chart-kind').value, grouped = {};
  items.filter(item => item.kind === kind).forEach(item => grouped[item.category] = (grouped[item.category] || 0) + item.amount);
  const values = Object.entries(grouped).sort((a, b) => b[1] - a[1]), { ctx, width, height } = canvasContext($('category-chart'));
  ctx.clearRect(0, 0, width, height); const total = values.reduce((sum, [, value]) => sum + value, 0);
  if (!total) { ctx.fillStyle = '#657974'; ctx.textAlign = 'center'; ctx.font = '12px Segoe UI'; ctx.fillText('Sem dados neste mês', width / 2, height / 2); $('category-legend').replaceChildren(); return; }
  const cx = Math.min(height / 2, width * .25), cy = height / 2, radius = Math.min(height * .39, width * .2);
  let angle = -Math.PI / 2;
  values.forEach(([, value], index) => { const next = angle + value / total * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, angle, next); ctx.closePath(); ctx.fillStyle = COLORS[index % COLORS.length]; ctx.fill(); angle = next; });
  ctx.beginPath(); ctx.arc(cx, cy, radius * .57, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#203b39'; ctx.textAlign = 'center'; ctx.font = '600 11px Segoe UI'; ctx.fillText(money(total), cx, cy + 4);
  $('category-legend').replaceChildren(...values.map(([name, value], index) => { const li = document.createElement('li'), swatch = document.createElement('i'), label = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = COLORS[index % COLORS.length]; label.textContent = `${name} ${Math.round(value / total * 100)}%`; li.append(swatch, label); return li; }));
}
function csvCell(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function toCsv() { return ['data,tipo,descricao,categoria,valor', ...entries.map(item => [item.date, item.kind, item.description, item.category, item.amount.toFixed(2)].map(csvCell).join(','))].join('\r\n'); }
function parseCsv(text) {
  const sample = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
  const delimiter = [',', ';', '\t'].map(char => [char, sample.split(char).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], value = '', quoted = false, closedQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') {
      if (quoted) { quoted = false; closedQuote = true; }
      else if (!value && !closedQuote) quoted = true;
      else throw new Error('CSV inválido: aspas fora de um campo citado.');
    }
    else if (char === delimiter && !quoted) { row.push(value); value = ''; closedQuote = false; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[i + 1] === '\n') i++; row.push(value); if (row.some(cell => cell.trim())) rows.push(row); row = []; value = ''; closedQuote = false; }
    else if (closedQuote && !quoted && !/\s/.test(char)) throw new Error('CSV inválido: conteúdo após o fecho de aspas.');
    else if (!closedQuote || quoted) value += char;
    else value += char;
  }
  if (quoted) throw new Error('CSV inválido: existe uma aspa sem fecho.');
  if (row.length || value) { row.push(value); if (row.some(cell => cell.trim())) rows.push(row); }
  if (!rows.length) throw new Error('O ficheiro CSV está vazio.');
  return rows;
}
window.financeImport = { parseCsv, normalizedHeader, normalizeKind, parseAmount, duplicateKey };
function normalizedHeader(value) { return value.trim().toLocaleLowerCase('pt').replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, ''); }
function normalizeKind(value) {
  const key = normalizedHeader(value);
  if (['income', 'entrada', 'receita', 'rendimento'].includes(key)) return 'income';
  if (['expense', 'despesa', 'saida', 'gasto'].includes(key)) return 'expense';
  return null;
}
function parseAmount(value) {
  let input = value.trim().replace(/[€\s]/g, '');
  if (input.includes(',') && input.includes('.')) input = input.lastIndexOf(',') > input.lastIndexOf('.') ? input.replaceAll('.', '').replace(',', '.') : input.replaceAll(',', '');
  else input = input.replace(',', '.');
  return Number(input);
}
function duplicateKey(item) { return [item.date, item.kind, item.description.trim().toLocaleLowerCase('pt'), item.category.trim().toLocaleLowerCase('pt'), item.amount.toFixed(2)].join('|'); }
async function exportCsv() {
  const path = await os.dialog.save({ title: 'Exportar movimentos', start: '/home/user/Documentos', defaultName: `despesas-${monthKey(view)}.csv` });
  if (!path) return;
  try { await os.fs.write(path, toCsv(), 'text/csv'); say(`CSV guardado em ${path}`); } catch (error) { say(error.message); }
}
async function importCsv() {
  const path = await os.dialog.open({ title: 'Importar movimentos CSV', start: '/home/user/Documentos', filter: '.csv' });
  if (!path) return;
  try {
    const rows = parseCsv(await os.fs.read(path));
    const headers = rows.shift().map(normalizedHeader), columns = {
      date: headers.findIndex(value => ['data', 'date'].includes(value)),
      kind: headers.findIndex(value => ['tipo', 'type'].includes(value)),
      description: headers.findIndex(value => ['descricao', 'description', 'designacao'].includes(value)),
      category: headers.findIndex(value => ['categoria', 'category'].includes(value)),
      amount: headers.findIndex(value => ['valor', 'amount', 'montante'].includes(value))
    };
    if (Object.values(columns).some(index => index < 0)) throw new Error('CSV inválido: são necessárias colunas para data, tipo, descrição, categoria e valor.');
    if (new Set(Object.values(columns)).size !== Object.values(columns).length) throw new Error('CSV inválido: cada campo obrigatório deve ter uma coluna própria.');
    const imported = rows.map((row, index) => {
      if (row.length !== headers.length) throw new Error(`Linha ${index + 2}: número de colunas inválido.`);
      const date = row[columns.date].trim(), kind = normalizeKind(row[columns.kind]), description = row[columns.description].trim(), category = row[columns.category].trim(), amount = parseAmount(row[columns.amount]);
      const [year, month, day] = date.split('-').map(Number), parsedDate = new Date(year, month - 1, day), validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsedDate.getTime()) && parsedDate.getFullYear() === year && parsedDate.getMonth() === month - 1 && parsedDate.getDate() === day;
      if (!validDate || !kind || !description || !category || !Number.isFinite(amount) || amount <= 0) throw new Error(`Linha ${index + 2}: data, tipo, descrição, categoria ou valor inválido.`);
      return { id: crypto.randomUUID(), date, kind, description, category, amount, created: Date.now() };
    });
    const known = new Set(entries.map(duplicateKey)), unique = imported.filter(item => { const key = duplicateKey(item); if (known.has(key)) return false; known.add(key); return true; });
    const skipped = imported.length - unique.length;
    if (!unique.length) return say(`Nenhum movimento novo para importar${skipped ? `; ${skipped} duplicado(s) detetado(s)` : ''}.`);
    const accepted = await os.dialog.confirm({ title: 'Confirmar importação', message: `Importar ${unique.length} movimento(s)?${skipped ? ` ${skipped} duplicado(s) serão ignorados.` : ''} Nenhum dado será alterado antes desta confirmação.`, okLabel: 'Importar' });
    if (!accepted) return say('Importação cancelada.');
    const nextEntries = [...entries, ...unique];
    const nextCategories = {
      expense: [...categories.expense],
      income: [...categories.income]
    };
    unique.forEach(item => { if (!nextCategories[item.kind].includes(item.category)) nextCategories[item.kind].push(item.category); });
    await os.storage.set('finance-data', { entries: nextEntries, budgets, categories: nextCategories });
    entries = nextEntries; categories = nextCategories; updateCategories(); render(); say(`${unique.length} movimento(s) importado(s)${skipped ? `; ${skipped} duplicado(s) ignorado(s)` : ''}.`);
  } catch (error) { os.ui.status('status', os.errors.message(error), 'error'); }
}
function startEdit(item) {
  editingId = item.id; $('entry-kind').value = item.kind; updateCategories(); $('entry-category').value = item.category;
  $('entry-description').value = item.description; $('entry-date').value = item.date; $('entry-amount').value = item.amount;
  $('submit-entry').textContent = 'Guardar'; $('cancel-edit').hidden = false; $('entry-description').focus();
}
function cancelEdit() { editingId = null; $('entry-form').reset(); $('entry-date').value = today.toISOString().slice(0, 10); $('submit-entry').textContent = 'Adicionar'; $('cancel-edit').hidden = true; updateCategories(); }
$('entry-kind').onchange = updateCategories;
$('entry-date').value = today.toISOString().slice(0, 10);
$('entry-form').onsubmit = async event => { event.preventDefault(); const amount = Number($('entry-amount').value); if (!Number.isFinite(amount) || amount <= 0) return;
  const values = { date: $('entry-date').value, kind: $('entry-kind').value, description: $('entry-description').value.trim(), category: $('entry-category').value, amount };
  if (editingId) { Object.assign(entries.find(item => item.id === editingId), values); cancelEdit(); say('Movimento atualizado.'); }
  else { entries.push({ id: crypto.randomUUID(), ...values, created: Date.now() }); $('entry-description').value = ''; $('entry-amount').value = ''; }
  await save(); render(); $('entry-description').focus();
};
$('cancel-edit').onclick = cancelEdit;
$('add-category').onclick = async () => {
  const kind = $('entry-kind').value, name = (await os.dialog.prompt({ title: 'Nova categoria', message: `Nome da categoria de ${kind === 'income' ? 'entrada' : 'despesa'}:`, okLabel: 'Adicionar' }))?.trim();
  if (!name) return;
  if (categories[kind].some(value => value.toLocaleLowerCase('pt') === name.toLocaleLowerCase('pt'))) return say('Já existe uma categoria com esse nome.');
  categories[kind].push(name); await save(); updateCategories(); $('entry-category').value = name; say(`Categoria "${name}" adicionada.`);
};
$('remove-category').onclick = async () => {
  const kind = $('entry-kind').value, name = $('entry-category').value;
  if (categories[kind].length <= 1) return say('Mantém pelo menos uma categoria.');
  if (entries.some(item => item.kind === kind && item.category === name)) return say('Esta categoria está em uso; edita primeiro os movimentos associados.');
  if (!(await os.dialog.confirm({ title: 'Remover categoria', message: `Remover a categoria "${name}"?`, okLabel: 'Remover', danger: true }))) return;
  categories[kind] = categories[kind].filter(value => value !== name); await save(); updateCategories(); render(); say(`Categoria "${name}" removida.`);
};
$('budget-input').onchange = async () => { const value = Number($('budget-input').value); if (value > 0) budgets[monthKey(view)] = value; else delete budgets[monthKey(view)]; await save(); render(); };
$('prev-month').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); };
$('next-month').onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); };
$('chart-kind').onchange = () => drawCategories(selectedEntries());
$('export-csv').onclick = exportCsv; $('import-csv').onclick = importCsv;
window.addEventListener('resize', render);
updateCategories();
os.storage.get('finance-data').then(data => { entries = data?.entries ?? []; budgets = data?.budgets ?? {}; categories = { expense: [...new Set([...DEFAULT_CATEGORIES.expense, ...(data?.categories?.expense ?? [])])], income: [...new Set([...DEFAULT_CATEGORIES.income, ...(data?.categories?.income ?? [])])] }; updateCategories(); render(); }).catch(() => { render(); say('Não foi possível carregar os dados guardados.'); });
os.i18n.onChange(render);