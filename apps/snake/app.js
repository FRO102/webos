const N = 20, cv = document.getElementById('c'), ctx = cv.getContext('2d'), cell = cv.width / N;
let snake, dir, next, food, score, best = 0, state = 'play', timer;

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const rnd = () => Math.floor(Math.random() * N);

function place() { do food = { x: rnd(), y: rnd() }; while (snake.some(s => s.x === food.x && s.y === food.y)); }
function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = next = { x: 1, y: 0 }; score = 0; state = 'play';
  place(); hud(); draw();
}
function hud() { document.getElementById('score').textContent = `Pontos: ${score}`; document.getElementById('best').textContent = `Recorde: ${best}`; }

function tick() {
  if (state !== 'play') return;
  dir = next;
  const h = { x: (snake[0].x + dir.x + N) % N, y: (snake[0].y + dir.y + N) % N };
  if (snake.some(s => s.x === h.x && s.y === h.y)) return end();
  snake.unshift(h);
  if (h.x === food.x && h.y === food.y) { score++; place(); hud(); } else snake.pop();
  draw();
}

async function end() {
  state = 'over';
  if (score > best) { best = score; if (score > 0) os.notify(`Novo recorde no Snake: ${score}`); os.storage.set('best', best); }
  hud(); draw();
}

function draw() {
  ctx.fillStyle = css('--os-bg') || '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#e06c75'; ctx.beginPath(); ctx.arc((food.x + .5) * cell, (food.y + .5) * cell, cell * .38, 0, 7); ctx.fill();
  ctx.fillStyle = css('--os-accent') || '#3cb6a4';
  snake.forEach((s, i) => { ctx.globalAlpha = i ? .8 : 1; ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2); });
  ctx.globalAlpha = 1;
  if (state !== 'play') {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff'; ctx.font = '600 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(state === 'over' ? 'Fim de jogo — Espaço para recomeçar' : 'Pausa — Espaço para continuar', cv.width / 2, cv.height / 2);
  }
}

const DIRS = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (DIRS[k]) {
    e.preventDefault();
    const [x, y] = DIRS[k];
    if (x !== -dir.x || y !== -dir.y) next = { x, y };
  } else if (k === ' ') {
    e.preventDefault();
    if (state === 'over') reset(); else { state = state === 'play' ? 'pause' : 'play'; draw(); }
  }
});

addEventListener('blur', () => {
  if (state === 'play') { state = 'pause'; draw(); }
});

addEventListener('pointerdown', () => cv.focus(), { capture: true });

os.on('theme:changed', draw);

os.storage.get('best').then(b => { best = b ?? 0; hud(); }).catch(() => {});
reset();
timer = setInterval(tick, 110);
cv.focus();
