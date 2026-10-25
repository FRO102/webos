import { stepPlayer } from './movement.js';
import { GHOST_LAYOUT, MAZES, PLAYER_SPAWN } from './mazes.js';

const CELL_SIZE = 24;
const PLAYER_STEP_MS = 118;
const DIFFICULTIES = [
  { name: 'Easy', lives: 5, ghostStepMs: 480, powerDurationMs: 11000 },
  { name: 'Normal', lives: 3, ghostStepMs: 360, powerDurationMs: 8500 },
  { name: 'Hard', lives: 2, ghostStepMs: 260, powerDurationMs: 6500 },
];
let currentDifficultyIndex = 1;
let difficulty = DIFFICULTIES[currentDifficultyIndex];
let GHOST_STEP_MS = difficulty.ghostStepMs;
let POWER_DURATION_MS = difficulty.powerDurationMs;
let currentMazeIndex = 0;
let MAP = MAZES[currentMazeIndex].layout;
let COLS = Math.max(...MAP.map((row) => row.length));
let ROWS = MAP.length;
let START = MAZES[currentMazeIndex].start;
let GHOST_STARTS = MAZES[currentMazeIndex].ghosts;

const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

const elements = {
  canvas: document.querySelector('#game-canvas'),
  mainMenu: document.querySelector('#main-menu'),
  gameLayout: document.querySelector('#game-layout'),
  announcement: document.querySelector('#game-announcement'),
  menuStart: document.querySelector('#menu-start'),
  menuBestScore: document.querySelector('#menu-best-score'),
  returnToMenu: document.querySelector('#return-to-menu'),
  score: document.querySelector('#score'),
  dotsLeft: document.querySelector('#dots-left'),
  footerDots: document.querySelector('#footer-dots'),
  lives: document.querySelector('#lives'),
  bestScore: document.querySelector('#best-score'),
  overlay: document.querySelector('#game-overlay'),
  overlayTitle: document.querySelector('#overlay-title'),
  overlayCopy: document.querySelector('#overlay-copy'),
  overlayPrimary: document.querySelector('#overlay-primary'),
  overlayActions: document.querySelector('#overlay-actions'),
  overlayResume: document.querySelector('#overlay-resume'),
  overlayRestart: document.querySelector('#overlay-restart'),
  gameStatus: document.querySelector('#game-status'),
  pauseToggle: document.querySelector('#pause-toggle'),
  restartGame: document.querySelector('#restart-game'),
  activeMaze: document.querySelector('#active-maze'),
  mazeOptions: document.querySelectorAll('[data-maze-index]'),
  modeOptions: document.querySelectorAll('[data-game-mode]'),
  campaignProgress: document.querySelector('#campaign-progress'),
  campaignProgressLabel: document.querySelector('#campaign-progress-label'),
  campaignProgressTrack: document.querySelector('.campaign-progress-track'),
  campaignProgressFill: document.querySelector('#campaign-progress-fill'),
  campaignMapList: document.querySelector('#campaign-map-list'),
  activeDifficulty: document.querySelector('#active-difficulty'),
  difficultyOptions: document.querySelectorAll('[data-difficulty-index]'),
};

const context = elements.canvas.getContext('2d', { alpha: false });
elements.canvas.width = COLS * CELL_SIZE;
elements.canvas.height = ROWS * CELL_SIZE;

const game = {
  phase: 'ready',
  mode: 'single',
  score: 0,
  lives: difficulty.lives,
  best: 0,
  remaining: 0,
  powerUntil: 0,
  player: { ...START },
  playerFrom: { ...START },
  direction: { x: 0, y: 0 },
  queuedDirection: { x: 0, y: 0 },
  ghosts: [],
  ghostsFrom: [],
  pellets: new Set(),
};

let lastPlayerStep = 0;
let lastGhostStep = 0;
let previousStatus = '';
let menuActive = true;
let bestScoreSave = Promise.resolve();
let bestScoreReady = false;

async function readBestScore() {
  try {
    if (window.os?.storage) {
      const storedScore = Number(await window.os.storage.get('best-score')) || 0;
      if (storedScore > 0) return storedScore;
      return 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

function persistBestScore(score) {
  if (window.os?.storage) {
    bestScoreSave = bestScoreSave
      .then(() => window.os.storage.set('best-score', score))
      .catch(() => {});
    return;
  }
  try {
    if (window.localStorage) window.localStorage.setItem('mazechomp-best', String(score));
  } catch {
    // The score remains available for the current session if storage is disabled.
  }
}

function renderBestScore() {
  elements.bestScore.textContent = String(game.best).padStart(5, '0');
  elements.menuBestScore.textContent = String(game.best).padStart(5, '0');
}

function announce(message) {
  elements.announcement.textContent = '';
  window.requestAnimationFrame(() => {
    elements.announcement.textContent = message;
  });
}

function copyGhosts() {
  return GHOST_STARTS.map((ghost) => ({
    ...ghost,
    dir: { ...ghost.dir },
    home: { ...ghost.home },
  }));
}

function createPellets() {
  const pellets = new Set();
  MAP.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === '.' || cell === 'o') pellets.add(`${x},${y}`);
    });
  });
  return pellets;
}

function resetBoard() {
  game.player = { ...START };
  game.playerFrom = { ...START };
  game.direction = { x: 0, y: 0 };
  game.queuedDirection = { x: 0, y: 0 };
  game.ghosts = copyGhosts();
  game.ghostsFrom = game.ghosts.map(({ x, y }) => ({ x, y }));
  game.pellets = createPellets();
  game.remaining = game.pellets.size;
  game.powerUntil = 0;
  lastPlayerStep = performance.now();
  lastGhostStep = lastPlayerStep;
  renderHud();
}

function renderHud() {
  elements.score.textContent = String(game.score).padStart(5, '0');
  elements.dotsLeft.textContent = String(game.remaining);
  elements.footerDots.textContent = String(game.remaining);
  elements.lives.replaceChildren(
    ...Array.from({ length: game.lives }, () => {
      const life = document.createElement('span');
      life.className = 'life-dot';
      life.setAttribute('aria-hidden', 'true');
      return life;
    }),
  );
  elements.lives.setAttribute('aria-label', `${game.lives} lives remaining`);
}

function updateBestScore() {
  if (game.score <= game.best) return;
  game.best = game.score;
  renderBestScore();
  if (bestScoreReady) persistBestScore(game.best);
}

function addScore(points) {
  game.score += points;
  updateBestScore();
  renderHud();
}

function setPhase(phase) {
  game.phase = phase;
  const copy = {
    ready: ['READY?', 'The dots are waiting. Keep moving, and watch the corners.'],
    paused: ['PAUSED', 'Take a breath. Your maze is right where you left it.'],
    won: ['MAZE CLEARED', `Every dot cleared. You scored ${game.score.toLocaleString()} points.`],
    over: ['GAME OVER', `That was a close one. Final score: ${game.score.toLocaleString()}.`],
    'campaign-complete': [
      'CAMPAIGN COMPLETE',
      `All four mazes cleared! Final score: ${game.score.toLocaleString()} points · ${game.lives} lives remaining.`,
    ],
  };

  if (game.mode === 'campaign' && phase === 'won') {
    const nextMaze = MAZES[currentMazeIndex + 1];
    copy.won = [
      `MAP ${currentMazeIndex + 1} CLEARED`,
      `${MAZES[currentMazeIndex].name} complete. Score and lives carry into ${nextMaze.name}.`,
    ];
  }

  elements.overlay.hidden = phase === 'playing';
  if (phase !== 'playing') {
    const [title, message] = copy[phase];
    elements.overlayTitle.textContent = title;
    elements.overlayCopy.textContent = message;
    elements.overlayPrimary.textContent =
      phase === 'ready'
        ? 'START GAME'
        : phase === 'paused'
          ? 'RESUME'
          : phase === 'won' && game.mode === 'campaign'
            ? 'NEXT MAP'
            : phase === 'campaign-complete'
              ? 'PLAY CAMPAIGN AGAIN'
              : 'PLAY AGAIN';
    elements.overlayActions.hidden = phase !== 'paused';
  }

  const buttonText = phase === 'playing' ? 'Pause' : phase === 'paused' ? 'Resume' : 'Start';
  elements.pauseToggle.textContent = buttonText;
  elements.pauseToggle.setAttribute(
    'aria-label',
    phase === 'playing' ? 'Pause game' : phase === 'paused' ? 'Resume game' : 'Start game',
  );
  renderModeOptions();
  renderStatus(performance.now());
}

function startGame() {
  if (game.phase === 'over' || game.phase === 'won' || game.phase === 'campaign-complete') {
    game.score = 0;
    game.lives = difficulty.lives;
    if (game.mode === 'campaign') currentMazeIndex = 0;
    loadMaze(currentMazeIndex);
    resetBoard();
  }
  setPhase('playing');
}

function restartGame() {
  game.score = 0;
  game.lives = difficulty.lives;
  if (game.mode === 'campaign') currentMazeIndex = 0;
  loadMaze(currentMazeIndex);
  resetBoard();
  setPhase('playing');
}

function startFromMenu() {
  menuActive = false;
  elements.mainMenu.hidden = true;
  elements.gameLayout.hidden = false;
  elements.returnToMenu.hidden = false;
  restartGame();
  elements.canvas.focus({ preventScroll: true });
}

function returnToMenu() {
  menuActive = true;
  setPhase('ready');
  elements.gameLayout.hidden = true;
  elements.returnToMenu.hidden = true;
  elements.mainMenu.hidden = false;
  elements.menuStart.focus();
}

function advanceCampaign() {
  if (game.phase !== 'won' || game.mode !== 'campaign' || currentMazeIndex >= MAZES.length - 1) {
    return;
  }

  currentMazeIndex += 1;
  loadMaze(currentMazeIndex);
  resetBoard();
  setPhase('playing');
  elements.canvas.focus({ preventScroll: true });
}

function loadMaze(index) {
  currentMazeIndex = index;
  const maze = MAZES[currentMazeIndex];
  MAP = maze.layout;
  COLS = Math.max(...MAP.map((row) => row.length));
  ROWS = MAP.length;
  START = maze.start;
  GHOST_STARTS = maze.ghosts;
  elements.canvas.width = COLS * CELL_SIZE;
  elements.canvas.height = ROWS * CELL_SIZE;
  elements.activeMaze.textContent = maze.name;
  elements.mazeOptions.forEach((button) => {
    const selected = Number(button.dataset.mazeIndex) === currentMazeIndex;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-selected', selected);
  });
  renderModeOptions();
}

function selectMaze(index) {
  if (index === currentMazeIndex || !MAZES[index]) return;

  game.mode = 'single';
  loadMaze(index);
  game.score = 0;
  game.lives = difficulty.lives;
  resetBoard();
  setPhase('ready');
}

function selectMode(mode) {
  if (mode !== 'single' && mode !== 'campaign') return;
  if (game.mode === mode) return;
  if (game.phase === 'playing' || game.phase === 'paused') return;

  game.mode = mode;
  if (mode === 'campaign') currentMazeIndex = 0;
  loadMaze(currentMazeIndex);
  game.score = 0;
  game.lives = difficulty.lives;
  resetBoard();
  setPhase('ready');
}

function renderModeOptions() {
  elements.modeOptions.forEach((button) => {
    const selected = button.dataset.gameMode === game.mode;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-selected', selected);
    button.disabled = game.phase === 'playing' || game.phase === 'paused';
  });

  elements.campaignProgress.hidden = game.mode !== 'campaign';
  elements.mazeOptions.forEach((button) => {
    button.disabled = game.mode === 'campaign';
  });

  if (game.mode !== 'campaign') return;

  const completedMaps =
    game.phase === 'won' || game.phase === 'campaign-complete'
      ? currentMazeIndex + 1
      : currentMazeIndex;
  const progressPercent = (completedMaps / MAZES.length) * 100;
  elements.campaignProgressLabel.textContent = `${completedMaps} of ${MAZES.length} cleared`;
  elements.campaignProgressTrack.setAttribute('aria-valuenow', String(completedMaps));
  elements.campaignProgressFill.style.width = `${progressPercent}%`;
  elements.campaignMapList.replaceChildren(
    ...MAZES.map((maze, index) => {
      const item = document.createElement('li');
      item.textContent = maze.name;
      if (index < completedMaps) item.classList.add('is-complete');
      if (index === currentMazeIndex && game.phase !== 'campaign-complete') {
        item.classList.add('is-current');
        item.setAttribute('aria-current', 'step');
      }
      return item;
    }),
  );
}

function selectDifficulty(index) {
  if (index === currentDifficultyIndex || !DIFFICULTIES[index]) return;

  currentDifficultyIndex = index;
  difficulty = DIFFICULTIES[currentDifficultyIndex];
  GHOST_STEP_MS = difficulty.ghostStepMs;
  POWER_DURATION_MS = difficulty.powerDurationMs;
  elements.activeDifficulty.textContent = difficulty.name;
  elements.difficultyOptions.forEach((button) => {
    const selected = Number(button.dataset.difficultyIndex) === currentDifficultyIndex;
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-selected', selected);
  });

  if (game.mode === 'campaign') currentMazeIndex = 0;
  loadMaze(currentMazeIndex);
  game.score = 0;
  game.lives = difficulty.lives;
  resetBoard();
  setPhase('ready');
}

function togglePause() {
  if (game.phase === 'playing') {
    setPhase('paused');
  } else if (game.phase === 'paused') {
    setPhase('playing');
  } else if (game.phase === 'ready') {
    startGame();
  } else {
    startGame();
  }
}

function isWall(x, y) {
  return y < 0 || y >= ROWS || x < 0 || x >= COLS || MAP[y]?.[x] === '#' || MAP[y]?.[x] === undefined;
}

function setDirection(direction) {
  if (menuActive) return;
  game.queuedDirection = direction;
  if (game.phase === 'ready') setPhase('playing');
}

function handleKeyDown(event) {
  if (menuActive) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const direction = DIRECTIONS[key];

  if (direction) {
    event.preventDefault();
    setDirection(direction);
    return;
  }

  if (key === 'r') {
    restartGame();
    return;
  }

  if (key === ' ' || key === 'Escape') {
    event.preventDefault();
    if (game.phase === 'ready') startGame();
    else if (game.phase === 'playing' || game.phase === 'paused') togglePause();
    return;
  }

  if (
    key === 'Enter' &&
    ['ready', 'won', 'over', 'campaign-complete'].includes(game.phase) &&
    !(event.target instanceof HTMLElement && event.target.closest('button'))
  ) {
    handleOverlayPrimary();
  }
}

function handleOverlayPrimary() {
  if (game.phase === 'paused') {
    togglePause();
  } else if (game.phase === 'won' && game.mode === 'campaign') {
    advanceCampaign();
  } else if (game.phase === 'campaign-complete') {
    currentMazeIndex = 0;
    game.score = 0;
    game.lives = difficulty.lives;
    loadMaze(currentMazeIndex);
    resetBoard();
    setPhase('playing');
    elements.canvas.focus({ preventScroll: true });
  } else {
    startGame();
    elements.canvas.focus({ preventScroll: true });
  }
}

function chooseGhostDirection(ghost, powered) {
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const options = directions.filter((direction) => !isWall(ghost.x + direction.x, ghost.y + direction.y));
  if (!options.length) return null;

  const reverse = { x: -ghost.dir.x, y: -ghost.dir.y };
  const forwardChoices = options.filter(
    (direction) => direction.x !== reverse.x || direction.y !== reverse.y,
  );
  const possible = forwardChoices.length ? forwardChoices : options;
  const distance = (direction) =>
    Math.abs(ghost.x + direction.x - game.player.x) +
    Math.abs(ghost.y + direction.y - game.player.y);

  if (powered) {
    possible.sort((a, b) => distance(b) - distance(a));
    return possible[0];
  }

  if (Math.random() < 0.72) {
    possible.sort((a, b) => distance(a) - distance(b));
  }
  return possible[Math.floor(Math.random() * Math.min(possible.length, 2))];
}

function collectPellet(now) {
  const key = `${game.player.x},${game.player.y}`;
  if (!game.pellets.has(key)) return;

  game.pellets.delete(key);
  const isPowerPellet = MAP[game.player.y][game.player.x] === 'o';
  addScore(isPowerPellet ? 50 : 10);
  game.remaining = game.pellets.size;
  if (isPowerPellet) {
    game.powerUntil = now + POWER_DURATION_MS;
    announce('Power pellet collected. Ghosts are vulnerable.');
  }
  renderHud();

  if (game.remaining === 0) {
    if (game.mode === 'campaign' && currentMazeIndex === MAZES.length - 1) {
      setPhase('campaign-complete');
    } else {
      setPhase('won');
      if (game.mode === 'campaign') window.setTimeout(advanceCampaign, 1600);
    }
  }
}

function resolvePlayerGhostCollisions(now) {
  if (game.phase !== 'playing') return;
  const powered = now < game.powerUntil;

  for (let index = game.ghosts.length - 1; index >= 0; index -= 1) {
    const ghost = game.ghosts[index];
    if (!ghost || ghost.x !== game.player.x || ghost.y !== game.player.y) continue;

    if (powered) {
      addScore(200);
      game.ghosts[index] = {
        ...ghost,
        x: ghost.home.x,
        y: ghost.home.y,
        dir: { x: 0, y: 0 },
      };
      game.ghostsFrom[index] = { x: ghost.home.x, y: ghost.home.y };
      announce('Ghost eaten. +200');
    } else {
      resetAfterHit(now);
      return;
    }
  }
}
function resetAfterHit(now) {
  game.lives = Math.max(0, game.lives - 1);
  game.player = { ...START };
  game.playerFrom = { ...START };
  game.direction = { x: 0, y: 0 };
  game.queuedDirection = { x: 0, y: 0 };
  game.ghosts = copyGhosts();
  game.ghostsFrom = game.ghosts.map(({ x, y }) => ({ x, y }));
  game.powerUntil = 0;
  lastPlayerStep = now;
  lastGhostStep = now;
  renderHud();
  announce(game.lives > 0 ? `${game.lives} lives remaining.` : 'No lives remaining. Game over.');
  if (game.lives === 0) setPhase('over');
}

function moveGhosts(now) {
  const powered = now < game.powerUntil;
  game.ghostsFrom = game.ghosts.map(({ x, y }) => ({ x, y }));

  for (let index = 0; index < game.ghosts.length; index += 1) {
    if (game.phase !== 'playing') break;
    const ghost = game.ghosts[index];
    const direction = chooseGhostDirection(ghost, powered);
    if (!direction) continue;

    ghost.dir = direction;
    ghost.x += direction.x;
    ghost.y += direction.y;

    if (ghost.x !== game.player.x || ghost.y !== game.player.y) continue;

    if (powered) {
      addScore(200);
      game.ghosts[index] = {
        ...ghost,
        x: ghost.home.x,
        y: ghost.home.y,
        dir: { x: 0, y: 0 },
      };
      game.ghostsFrom[index] = { x: ghost.home.x, y: ghost.home.y };
      announce('Ghost eaten. +200');
    } else {
      resetAfterHit(now);
      break;
    }
  }
}

function updateGame(now) {
  if (game.phase === 'playing') {
    if (now - lastPlayerStep >= PLAYER_STEP_MS) {
      lastPlayerStep = now;
      game.playerFrom = { ...game.player };
      const movement = stepPlayer(game.player, game.direction, game.queuedDirection, isWall);
      game.player = movement.position;
      game.direction = movement.direction;
      resolvePlayerGhostCollisions(now);
      collectPellet(now);
    }

    if (game.phase === 'playing' && now - lastGhostStep >= GHOST_STEP_MS) {
      lastGhostStep = now;
      moveGhosts(now);
    }

    if (now >= game.powerUntil) game.powerUntil = 0;
  }

  renderStatus(now);
  drawMaze(now);
  requestAnimationFrame(updateGame);
}

function renderStatus(now) {
  let status;
  const secondsLeft = Math.max(0, Math.ceil((game.powerUntil - now) / 1000));
  if (game.powerUntil > now) status = `POWER MODE · ${secondsLeft}s`;
  else if (game.phase === 'playing') status = 'IN THE MAZE';
  else if (game.phase === 'paused') status = 'PAUSED';
  else status = 'READY TO PLAY';

  if (previousStatus !== status) {
    elements.gameStatus.textContent = status;
    previousStatus = status;
  }
  elements.gameStatus.classList.toggle('power-active', game.powerUntil > now);
}

function drawMaze(now) {
  context.fillStyle = '#090e1a';
  context.fillRect(0, 0, elements.canvas.width, elements.canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (MAP[y][x] === '#') {
        context.fillStyle = '#182748';
        context.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        context.strokeStyle = '#325a92';
        context.lineWidth = 1;
        context.strokeRect(x * CELL_SIZE + 2, y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }

      if (!game.pellets.has(`${x},${y}`)) continue;
      const powerPellet = MAP[y][x] === 'o';
      context.beginPath();
      context.fillStyle = powerPellet ? '#f3fbff' : '#f5e7b3';
      context.shadowColor = powerPellet ? '#71dbf4' : 'transparent';
      context.shadowBlur = powerPellet ? 10 : 0;
      context.arc(
        x * CELL_SIZE + CELL_SIZE / 2,
        y * CELL_SIZE + CELL_SIZE / 2,
        powerPellet ? 5.1 : 2.1,
        0,
        Math.PI * 2,
      );
      context.fill();
      context.shadowBlur = 0;
    }
  }

  const ghostProgress = clamp((now - lastGhostStep) / GHOST_STEP_MS);
  game.ghosts.forEach((ghost, index) => {
    const from = game.ghostsFrom[index] || ghost;
    const x = lerp(from.x, ghost.x, ghostProgress) * CELL_SIZE + CELL_SIZE / 2;
    const y = lerp(from.y, ghost.y, ghostProgress) * CELL_SIZE + CELL_SIZE / 2;
    drawGhost(ghost, x, y, now < game.powerUntil);
  });

  const playerProgress = clamp((now - lastPlayerStep) / PLAYER_STEP_MS);
  const playerX = lerp(game.playerFrom.x, game.player.x, playerProgress) * CELL_SIZE + CELL_SIZE / 2;
  const playerY = lerp(game.playerFrom.y, game.player.y, playerProgress) * CELL_SIZE + CELL_SIZE / 2;
  drawPlayer(playerX, playerY, now);
}

function drawGhost(ghost, x, y, frightened) {
  context.fillStyle = frightened ? '#3978d4' : ghost.color;
  context.beginPath();
  context.arc(x, y, 9, Math.PI, 0);
  context.lineTo(x + 9, y + 8);
  context.lineTo(x + 4, y + 5);
  context.lineTo(x, y + 8);
  context.lineTo(x - 4, y + 5);
  context.lineTo(x - 9, y + 8);
  context.closePath();
  context.fill();

  context.fillStyle = '#f7f7f0';
  context.beginPath();
  context.ellipse(x - 3, y - 1, 2.6, 3.2, 0, 0, Math.PI * 2);
  context.ellipse(x + 3, y - 1, 2.6, 3.2, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#172037';
  context.beginPath();
  context.arc(x - 3, y, 1.1, 0, Math.PI * 2);
  context.arc(x + 3, y, 1.1, 0, Math.PI * 2);
  context.fill();
}

function drawPlayer(x, y, now) {
  const direction =
    game.direction.x || game.direction.y ? game.direction : { x: 1, y: 0 };
  const angle = Math.atan2(direction.y, direction.x);
  const mouth = 0.12 + (Math.sin(now / 75) + 1) * 0.15;

  context.fillStyle = '#f6d64a';
  context.shadowColor = '#f6d64a';
  context.shadowBlur = 8;
  context.beginPath();
  context.moveTo(x, y);
  context.arc(x, y, 9.5, angle + mouth, angle + Math.PI * 2 - mouth);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

elements.overlayPrimary.addEventListener('click', handleOverlayPrimary);
elements.overlayResume.addEventListener('click', togglePause);
elements.overlayRestart.addEventListener('click', restartGame);
elements.pauseToggle.addEventListener('click', togglePause);
elements.restartGame.addEventListener('click', restartGame);
elements.menuStart.addEventListener('click', startFromMenu);
elements.returnToMenu.addEventListener('click', returnToMenu);
elements.mazeOptions.forEach((button) => {
  button.addEventListener('click', () => selectMaze(Number(button.dataset.mazeIndex)));
});
elements.modeOptions.forEach((button) => {
  button.addEventListener('click', () => selectMode(button.dataset.gameMode));
});
elements.difficultyOptions.forEach((button) => {
  button.addEventListener('click', () =>
    selectDifficulty(Number(button.dataset.difficultyIndex)),
  );
});
document.addEventListener('keydown', handleKeyDown);

document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => {
    const directionName = button.dataset.direction;
    const direction = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }[directionName];
    if (direction) setDirection(direction);
  });
});

renderBestScore();
readBestScore().then((storedScore) => {
  game.best = Math.max(storedScore, game.best);
  bestScoreReady = true;
  renderBestScore();
  if (game.best > storedScore) persistBestScore(game.best);
});
resetBoard();
setPhase('ready');
requestAnimationFrame(updateGame);
