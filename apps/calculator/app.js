const layout = [
  ['C', 'fn'], ['⌫', 'fn'], ['%', 'fn'], ['÷', 'op'],
  ['7'], ['8'], ['9'], ['×', 'op'],
  ['4'], ['5'], ['6'], ['-', 'op'],
  ['1'], ['2'], ['3'], ['+', 'op'],
  ['±', 'fn'], ['0'], [',', 'dot'], ['=', 'eq'],
];
let cur = '0', prev = null, op = null, fresh = false;
const out = document.getElementById('display');
const show = () => { out.textContent = cur.replace('.', ','); };

const calc = (a, b, o) => ({ '+': a + b, '-': a - b, '×': a * b, '÷': b === 0 ? NaN : a / b })[o];
const fmt = n => Number.isFinite(n) ? String(parseFloat(n.toFixed(10))) : 'Erro';

function equals() {
  if (op === null || prev === null) return;
  cur = fmt(calc(prev, parseFloat(cur), op));
  prev = op = null; fresh = true;
}

function press(k) {
  if (cur === 'Erro' && k !== 'C') return;
  if (/^\d$/.test(k)) { cur = (cur === '0' || fresh) ? k : cur + k; fresh = false; }
  else if (k === ',' || k === '.') { if (fresh) { cur = '0'; fresh = false; } if (!cur.includes('.')) cur += '.'; }
  else if ('+-×÷'.includes(k)) { if (op && !fresh) equals(); prev = parseFloat(cur); op = k; fresh = true; }
  else if (k === '=') equals();
  else if (k === 'C') { cur = '0'; prev = op = null; fresh = false; }
  else if (k === '⌫') { cur = cur.length > 1 && !fresh ? cur.slice(0, -1) : '0'; if (cur === '-') cur = '0'; }
  else if (k === '±') { if (cur !== '0') cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur; }
  else if (k === '%') cur = fmt(parseFloat(cur) / 100);
  show();
}

const keys = document.getElementById('keys');
layout.forEach(([label, cls]) => {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', () => press(label));
  keys.append(b);
});

const map = { '*': '×', '/': '÷', Enter: '=', Backspace: '⌫', Escape: 'C', Delete: 'C' };
addEventListener('keydown', e => {
  const k = map[e.key] ?? e.key;
  if (/^[\d.,+\-×÷=%⌫C]$/.test(k)) { e.preventDefault(); press(k); }
});
