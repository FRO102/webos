const $ = id => document.getElementById(id);
const svg = $('diagram'), nodeLayer = $('nodes'), edgeLayer = $('edges'), ns = 'http://www.w3.org/2000/svg';
const types = { inicio: 'start', processo: 'process', decisao: 'decision', fim: 'end' };
const defaults = { inicio: 'Início', processo: 'Processo', decisao: 'Decisão?', fim: 'Fim' };
let nodes = [], edges = [], selected = [], selectedEdge = null, nextId = 1, filePath = null, dirty = false;
const say = text => { $('status').textContent = text; };
const title = () => os.window.setTitle(`${dirty ? '• ' : ''}${filePath?.split('/').pop() || $('diagram-title').value} — Diagramas`);
const markDirty = () => { dirty = true; title(); };
function element(name, attrs = {}) { const item = document.createElementNS(ns, name); Object.entries(attrs).forEach(([key, value]) => item.setAttribute(key, value)); return item; }
function shape(node) {
  const g = element('g', { class: `node ${types[node.type]}`, transform: `translate(${node.x} ${node.y})`, tabindex: '0', role: 'button', 'aria-label': `${node.type}: ${node.label}` });
  if (node.type === 'inicio') g.append(element('rect', { x: -65, y: -23, width: 130, height: 46, rx: 23 }));
  else if (node.type === 'fim') g.append(element('ellipse', { cx: 0, cy: 0, rx: 65, ry: 23 }));
  else if (node.type === 'decisao') g.append(element('polygon', { points: '0,-38 82,0 0,38 -82,0' }));
  else g.append(element('rect', { x: -70, y: -25, width: 140, height: 50, rx: 5 }));
  const text = element('text'); text.textContent = node.label; g.append(text);
  g.classList.toggle('selected', selected.includes(node.id));
  g.addEventListener('pointerdown', event => beginDrag(event, node, g));
  g.addEventListener('click', event => { event.stopPropagation(); selectedEdge = null; if (!event.shiftKey) selected = []; if (selected.includes(node.id)) selected = selected.filter(id => id !== node.id); else selected.push(node.id); render(); });
  g.addEventListener('dblclick', event => { event.stopPropagation(); editNode(node); });
  g.addEventListener('keydown', event => { if (event.key === 'Enter') editNode(node); if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected(); });
  return g;
}
function render() {
  nodeLayer.replaceChildren(...nodes.map(shape)); edgeLayer.replaceChildren(...edges.flatMap(edge => {
    const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to); if (!from || !to) return element('g');
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.max(1, Math.hypot(dx, dy)), ux = dx / len, uy = dy / len;
    const start = { x: from.x + ux * 70, y: from.y + uy * 27 }, end = { x: to.x - ux * 75, y: to.y - uy * 30 };
    const d = `M${start.x},${start.y} L${end.x},${end.y}`;
    const path = element('path', { class: `edge${selectedEdge === edge.id ? ' selected' : ''}`, d, 'aria-hidden': 'true' });
    const angle = Math.atan2(dy, dx) * 180 / Math.PI, hit = element('rect', { class: 'edge-hit', x: -len / 2, y: -8, width: len, height: 16, transform: `translate(${(start.x + end.x) / 2} ${(start.y + end.y) / 2}) rotate(${angle})`, tabindex: '0', role: 'button', 'aria-label': `Ligação ${from.label} para ${to.label}${edge.label ? `: ${edge.label}` : ''}` });
    hit.addEventListener('click', event => { event.stopPropagation(); selected = []; selectedEdge = edge.id; render(); });
    hit.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selected = []; selectedEdge = edge.id; render(); } });
    const result = [path, hit];
    if (edge.label) { const label = element('text', { class: 'edge-label', x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 7, tabindex: '0', role: 'button' }); label.textContent = edge.label; label.addEventListener('click', event => { event.stopPropagation(); selected = []; selectedEdge = edge.id; render(); }); result.push(label); }
    return result;
  }));
  $('selection-label').textContent = selectedEdge ? `Ligação selecionada${edges.find(edge => edge.id === selectedEdge)?.label ? `: ${edges.find(edge => edge.id === selectedEdge).label}` : ''}` : selected.length ? `${selected.length} forma${selected.length > 1 ? 's' : ''} selecionada${selected.length > 1 ? 's' : ''}` : 'Nenhuma seleção';
  $('edit-node').disabled = selected.length !== 1; $('edit-edge').disabled = !selectedEdge; $('reverse-edge').disabled = !selectedEdge;
}
function point(event) { const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
function beginDrag(event, node) {
  if (event.button !== 0) return; event.stopPropagation();
  selectedEdge = null;
  if (!selected.includes(node.id)) { selected = event.shiftKey ? [...selected, node.id] : [node.id]; render(); }
  const start = point(event), origins = selected.map(id => { const item = nodes.find(value => value.id === id); return [item, item.x, item.y]; });
  svg.setPointerCapture(event.pointerId);
  const move = ev => { const current = point(ev); origins.forEach(([item, x, y]) => { item.x = Math.max(85, x + current.x - start.x); item.y = Math.max(45, y + current.y - start.y); }); render(); };
  const end = () => { svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', end); svg.removeEventListener('pointercancel', end); markDirty(); };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}
function addNode(type) { const node = { id: `n${nextId++}`, type, label: defaults[type], x: 260 + (nodes.length % 4) * 180, y: 150 + Math.floor(nodes.length / 4) * 120 }; nodes.push(node); selectedEdge = null; selected = [node.id]; markDirty(); render(); }
async function editNode(node) { const label = await os.dialog.prompt({ title: 'Editar forma', message: 'Texto apresentado na forma:', defaultValue: node.label, okLabel: 'Aplicar' }); if (label?.trim()) { node.label = label.trim().slice(0, 60); markDirty(); render(); } }
async function deleteSelected() {
  if (selectedEdge) {
    const edge = edges.find(item => item.id === selectedEdge);
    if (!edge || !(await os.dialog.confirm({ title: 'Apagar ligação', message: `Apagar a ligação entre "${nodes.find(node => node.id === edge.from)?.label}" e "${nodes.find(node => node.id === edge.to)?.label}"?`, okLabel: 'Apagar', danger: true }))) return;
    edges = edges.filter(item => item.id !== selectedEdge); selectedEdge = null; markDirty(); render(); return;
  }
  if (!selected.length) return;
  const removedEdges = edges.filter(edge => selected.includes(edge.from) || selected.includes(edge.to)).length;
  const details = `${selected.length} forma(s)${removedEdges ? ` e ${removedEdges} ligação(ões) associada(s)` : ''}`;
  if (!(await os.dialog.confirm({ title: 'Apagar seleção', message: `Apagar ${details}? Esta ação não pode ser anulada.`, okLabel: 'Apagar', danger: true }))) return;
  nodes = nodes.filter(node => !selected.includes(node.id)); edges = edges.filter(edge => !selected.includes(edge.from) && !selected.includes(edge.to)); selected = []; markDirty(); render();
}
function connect() { if (selected.length !== 2 || selected[0] === selected[1]) return say('Seleciona duas formas para criar uma ligação.'); if (edges.some(edge => edge.from === selected[0] && edge.to === selected[1])) return say('Estas formas já estão ligadas.'); edges.push({ id: crypto.randomUUID(), from: selected[0], to: selected[1], label: '' }); selectedEdge = null; markDirty(); render(); say('Ligação criada.'); }
async function editEdge() { const edge = edges.find(item => item.id === selectedEdge); if (!edge) return; const label = await os.dialog.prompt({ title: 'Editar ligação', message: 'Rótulo da ligação (deixa vazio para remover):', defaultValue: edge.label, okLabel: 'Guardar' }); if (label === null) return; edge.label = label.trim().slice(0, 50); markDirty(); render(); }
function reverseEdge() { const edge = edges.find(item => item.id === selectedEdge); if (!edge) return; [edge.from, edge.to] = [edge.to, edge.from]; markDirty(); render(); }
function serialize() { return [`# WebOS Flow 1`, `# Título: ${$('diagram-title').value.replace(/[\r\n]/g, ' ')}`, ...nodes.map(node => `${node.id} ${node.type} ${Math.round(node.x)} ${Math.round(node.y)} ${JSON.stringify(node.label)}`), ...edges.map(edge => `${edge.from} -> ${edge.to}${edge.label ? ` ${JSON.stringify(edge.label)}` : ''}`)].join('\n') + '\n'; }
function parse(text) {
  const parsedNodes = [], parsedEdges = []; let heading = 'Diagrama sem título', max = 0, headerSeen = false, titleSeen = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('# WebOS Flow')) {
      if (headerSeen || line !== '# WebOS Flow 1') throw new Error('Versão ou cabeçalho .flow não suportado.');
      headerSeen = true; continue;
    }
    if (line.startsWith('# Título:')) {
      if (!headerSeen || titleSeen) throw new Error('Cabeçalho .flow inválido ou repetido.');
      heading = line.slice(9).trim() || heading; titleSeen = true; continue;
    }
    if (line.startsWith('#')) { if (!headerSeen) throw new Error('O ficheiro não começa com um cabeçalho .flow válido.'); continue; }
    if (!headerSeen) throw new Error('O ficheiro não começa com um cabeçalho .flow válido.');
    const link = line.match(/^(n\d+)\s+->\s+(n\d+)(?:\s+("(?:[^"\\]|\\.)*"))?$/);
    if (link) {
      let label = '';
      try { label = link[3] ? JSON.parse(link[3]) : ''; } catch { throw new Error('Rótulo de ligação inválido.'); }
      if (typeof label !== 'string') throw new Error('Rótulo de ligação inválido.');
      parsedEdges.push({ id: crypto.randomUUID(), from: link[1], to: link[2], label }); continue;
    }
    const match = line.match(/^(n\d+)\s+(inicio|processo|decisao|fim)\s+(-?\d+)\s+(-?\d+)\s+("(?:[^"\\]|\\.)*")$/);
    if (!match) throw new Error(`Linha inválida: ${line}`);
    let label;
    try { label = JSON.parse(match[5]); } catch { throw new Error('Texto de forma inválido.'); }
    if (typeof label !== 'string' || !label.trim() || label.length > 60) throw new Error('Texto de forma inválido.');
    parsedNodes.push({ id: match[1], type: match[2], x: Math.max(85, Number(match[3])), y: Math.max(45, Number(match[4])), label }); max = Math.max(max, Number(match[1].slice(1)));
  }
  if (!headerSeen) throw new Error('O ficheiro não contém um cabeçalho .flow suportado.');
  if (new Set(parsedNodes.map(node => node.id)).size !== parsedNodes.length) throw new Error('O ficheiro contém identificadores de forma repetidos.');
  if (parsedEdges.some(edge => !parsedNodes.some(node => node.id === edge.from) || !parsedNodes.some(node => node.id === edge.to))) throw new Error('O ficheiro contém ligações para formas inexistentes.');
  const edgeKeys = parsedEdges.map(edge => `${edge.from}->${edge.to}`);
  if (new Set(edgeKeys).size !== edgeKeys.length) throw new Error('O ficheiro contém ligações repetidas.');
  nodes = parsedNodes; edges = parsedEdges; selected = []; selectedEdge = null; nextId = max + 1; $('diagram-title').value = heading; dirty = false; title(); render(); say('Diagrama carregado.');
}
window.diagramImport = { parse };
async function save(saveAs = false) {
  let path = filePath;
  if (!path || saveAs) path = await os.dialog.save({ title: 'Guardar diagrama', start: '/home/user/Documentos', defaultName: `${$('diagram-title').value.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'diagrama'}.flow` });
  if (!path) return;
  try { await os.fs.write(path, serialize(), 'text/plain'); filePath = path; dirty = false; title(); say(`Guardado em ${path}`); } catch (error) { say(error.message); }
}
async function confirmDiscard() { return !dirty || os.dialog.confirm({ title: 'Alterações por guardar', message: 'Descartar as alterações do diagrama atual?', okLabel: 'Descartar', danger: true }); }
async function open() { if (!(await confirmDiscard())) return; const path = await os.dialog.open({ title: 'Abrir diagrama', start: '/home/user/Documentos', filter: '.flow' }); if (!path) return; try { const source = await os.fs.read(path); parse(source); filePath = path; title(); } catch (error) { os.ui.status('status', os.errors.message(error), 'error'); } }
$('diagram').addEventListener('click', event => { if (event.target === svg) { selected = []; selectedEdge = null; render(); } });
document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => addNode(button.dataset.add));
$('connect').onclick = connect; $('edit-node').onclick = () => { const node = nodes.find(item => item.id === selected.at(-1)); if (node) editNode(node); };
$('edit-edge').onclick = editEdge; $('reverse-edge').onclick = reverseEdge;
$('delete-node').onclick = deleteSelected; $('save-file').onclick = () => save(); $('open-file').onclick = open;
$('new-diagram').onclick = async () => { if (!(await confirmDiscard())) return; nodes = []; edges = []; selected = []; selectedEdge = null; filePath = null; dirty = false; $('diagram-title').value = 'Diagrama sem título'; title(); render(); say('Novo diagrama'); };
$('diagram-title').oninput = markDirty;
addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); } });
os.args().then(args => args?.path ? os.fs.read(args.path).then(text => { parse(text); filePath = args.path; title(); }) : title()).catch(error => say(error.message));
render();