export const BOARD_W = 10;
export const BOARD_H = 20;
export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
export const COLORS = { I: '#22d3ee', O: '#fbbf24', T: '#a78bfa', S: '#4ade80', Z: '#f87171', J: '#3b82f6', L: '#fb923c' };
export const PACE = {
  relaxed: { gravity: 1000, linesPerLevel: 12, mult: 0.84, min: 110 },
  normal: { gravity: 800, linesPerLevel: 10, mult: 0.82, min: 90 },
  fast: { gravity: 600, linesPerLevel: 8, mult: 0.8, min: 70 },
};
const JLSTZ_KICKS = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const I_KICKS = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export function rotate(matrix) {
  const height = matrix.length;
  const width = matrix[0].length;
  return Array.from({ length: width }, (_, x) => Array.from({ length: height }, (_, y) => matrix[height - 1 - y][x]));
}

export function pieceMatrix(type, rotation = 0) {
  if (!SHAPES[type]) throw new RangeError(`Unknown piece type: ${type}`);
  let matrix = SHAPES[type].map(row => row.slice());
  for (let turn = 0; turn < rotation % 4; turn += 1) matrix = rotate(matrix);
  return matrix;
}

function shuffledBag(random) {
  const bag = [...TYPES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
}

function drawPiece(bag, random) {
  const nextBag = bag.length ? [...bag] : shuffledBag(random);
  return { type: nextBag.shift(), bag: nextBag };
}

export function makePiece(type) {
  const width = pieceMatrix(type)[0].length;
  return { type, x: Math.floor((BOARD_W - width) / 2), y: 0, rot: 0 };
}

export function createBoard() {
  return Array.from({ length: BOARD_H }, () => Array(BOARD_W).fill(null));
}

export function newGame(bestScore = 0, pace = 'normal', random = Math.random) {
  let bag = [];
  const currentDraw = drawPiece(bag, random);
  bag = currentDraw.bag;
  const queue = [];
  for (let index = 0; index < 3; index += 1) {
    const drawn = drawPiece(bag, random);
    queue.push(drawn.type);
    bag = drawn.bag;
  }
  return {
    board: createBoard(), current: makePiece(currentDraw.type), queue, hold: null, holdUsed: false, bag,
    score: 0, bestScore, lines: 0, level: 1, pace: PACE[pace] ? pace : 'normal', status: 'ready',
    combo: -1, backToBack: false, lastAction: null, lastClear: null, clearSerial: 0,
  };
}

export function canPlace(board, piece) {
  const matrix = pieceMatrix(piece.type, piece.rot);
  return matrix.every((row, rowIndex) => row.every((value, columnIndex) => {
    if (!value) return true;
    const x = piece.x + columnIndex;
    const y = piece.y + rowIndex;
    return x >= 0 && x < BOARD_W && y < BOARD_H && (y < 0 || board[y][x] === null);
  }));
}

export function eachCell(piece, callback) {
  pieceMatrix(piece.type, piece.rot).forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value) callback(piece.x + columnIndex, piece.y + rowIndex);
  }));
}

export function lockPiece(game, dropBonus = 0, random = Math.random) {
  const board = game.board.map(row => row.slice());
  let aboveBoard = false;
  eachCell(game.current, (x, y) => {
    if (y < 0) aboveBoard = true;
    else if (y < BOARD_H && x >= 0 && x < BOARD_W) board[y][x] = game.current.type;
  });
  const score = game.score + dropBonus;
  if (aboveBoard) return { ...game, board, status: 'gameover', score, bestScore: Math.max(game.bestScore, score) };

  const spin = game.current.type === 'T' && game.lastAction === 'rotate' ? classifyTSpin(board, game.current) : null;
  const remaining = board.filter(row => row.some(cell => cell === null));
  const cleared = BOARD_H - remaining.length;
  const newBoard = [...Array.from({ length: cleared }, () => Array(BOARD_W).fill(null)), ...remaining];
  const points = spin
    ? (spin === 'full' ? [400, 800, 1200, 1600][cleared] : [100, 200, 400][cleared]) || 0
    : [0, 100, 300, 500, 800][cleared] || 0;
  const difficultClear = cleared === 4 || Boolean(spin && cleared > 0);
  const continuesBackToBack = difficultClear && game.backToBack;
  const combo = cleared ? game.combo + 1 : -1;
  const comboBonus = cleared && combo > 0 ? 50 * combo * game.level : 0;
  const backToBackBonus = continuesBackToBack ? Math.floor(points * game.level / 2) : 0;
  const nextScore = score + points * game.level + comboBonus + backToBackBonus;
  const lines = game.lines + cleared;
  const level = Math.floor(lines / PACE[game.pace].linesPerLevel) + 1;
  const drawn = drawPiece(game.bag, random);
  const nextPiece = makePiece(game.queue[0]);
  return {
    ...game, board: newBoard, current: nextPiece, queue: [...game.queue.slice(1), drawn.type], bag: drawn.bag,
    holdUsed: false, score: nextScore, bestScore: Math.max(game.bestScore, nextScore), lines, level,
    combo, backToBack: difficultClear || (cleared ? false : game.backToBack), lastAction: null,
    lastClear: cleared || spin ? { lines: cleared, spin, combo, backToBack: continuesBackToBack } : null,
    clearSerial: game.clearSerial + (cleared || spin ? 1 : 0),
    status: canPlace(newBoard, nextPiece) ? game.status : 'gameover',
  };
}

function classifyTSpin(board, piece) {
  const corners = [[0, 0], [2, 0], [0, 2], [2, 2]].map(([x, y]) => {
    const boardX = piece.x + x;
    const boardY = piece.y + y;
    return boardX < 0 || boardX >= BOARD_W || boardY < 0 || boardY >= BOARD_H || board[boardY][boardX] !== null;
  });
  if (corners.filter(Boolean).length < 3) return null;
  const frontCorners = [[0, 1], [1, 3], [2, 3], [0, 2]][piece.rot].map(index => corners[index]);
  return frontCorners.every(Boolean) ? 'full' : 'mini';
}

export function gravityPiece(game, random = Math.random) {
  if (game.status !== 'playing') return game;
  const candidate = { ...game.current, y: game.current.y + 1 };
  return canPlace(game.board, candidate) ? { ...game, current: candidate } : lockPiece(game, 0, random);
}

export function softDropPiece(game, random = Math.random) {
  if (game.status !== 'playing') return game;
  const candidate = { ...game.current, y: game.current.y + 1 };
  return canPlace(game.board, candidate)
    ? { ...game, current: candidate, score: game.score + 1, bestScore: Math.max(game.bestScore, game.score + 1) }
    : lockPiece(game, 0, random);
}

export function hardDropPiece(game, random = Math.random) {
  if (game.status !== 'playing') return game;
  let piece = game.current;
  let distance = 0;
  while (canPlace(game.board, { ...piece, y: piece.y + 1 })) {
    piece = { ...piece, y: piece.y + 1 };
    distance += 1;
  }
  return lockPiece({ ...game, current: piece }, distance * 2, random);
}

export function movePiece(game, direction) {
  if (game.status !== 'playing') return game;
  const candidate = { ...game.current, x: game.current.x + Math.sign(direction) };
  return canPlace(game.board, candidate) ? { ...game, current: candidate, lastAction: 'move' } : game;
}

export function rotatePiece(game, direction = 1) {
  if (game.status !== 'playing' || game.current.type === 'O') return game;
  const from = game.current.rot;
  const to = (from + (direction < 0 ? 3 : 1)) % 4;
  const rotated = { ...game.current, rot: to };
  const kicks = (game.current.type === 'I' ? I_KICKS : JLSTZ_KICKS)[`${from}>${to}`];
  for (let kickIndex = 0; kickIndex < kicks.length; kickIndex += 1) {
    const [offsetX, offsetY] = kicks[kickIndex];
    const candidate = { ...rotated, x: rotated.x + offsetX, y: rotated.y - offsetY };
    if (canPlace(game.board, candidate)) return { ...game, current: candidate, lastAction: 'rotate', rotationKick: kickIndex };
  }
  return game;
}

export function holdPiece(game, random = Math.random) {
  if (game.status !== 'playing' || game.holdUsed) return game;
  if (game.hold === null) {
    const drawn = drawPiece(game.bag, random);
    const current = makePiece(game.queue[0]);
    return {
      ...game, current, queue: [...game.queue.slice(1), drawn.type], bag: drawn.bag,
      hold: game.current.type, holdUsed: true, lastAction: 'hold', status: canPlace(game.board, current) ? game.status : 'gameover',
    };
  }
  const current = makePiece(game.hold);
  return { ...game, current, hold: game.current.type, holdUsed: true, lastAction: 'hold', status: canPlace(game.board, current) ? game.status : 'gameover' };
}

export function startPause(game, random = Math.random) {
  if (game.status === 'ready') return { ...game, status: 'playing' };
  if (game.status === 'playing') return { ...game, status: 'paused' };
  if (game.status === 'paused') return { ...game, status: 'playing' };
  return { ...newGame(game.bestScore, game.pace, random), status: 'playing' };
}

export function restartGame(game, random = Math.random) {
  return newGame(game.bestScore, game.pace, random);
}

export function selectPace(game, pace, random = Math.random) {
  if (game.status !== 'ready' || !PACE[pace] || game.pace === pace) return game;
  return newGame(game.bestScore, pace, random);
}