import assert from 'node:assert/strict';
import {
  BOARD_H, BOARD_W, TYPES, canPlace, createBoard, hardDropPiece, holdPiece,
  lockPiece, makePiece, newGame, pieceMatrix, rotatePiece, selectPace, startPause,
} from '../apps/tetris/engine.js';

const fixedRandom = () => 0.5;
let game = newGame(0, 'normal', fixedRandom);
assert.equal(game.board.length, BOARD_H);
assert.ok(game.board.every(row => row.length === BOARD_W));
assert.equal(new Set([game.current.type, ...game.queue, ...game.bag]).size, TYPES.length, 'the first seven-piece bag must contain each type once');
assert.equal(game.queue.length, 3, 'three following pieces are kept in the visible queue');
assert.deepEqual(pieceMatrix('I', 1), [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], 'I rotation preserves its SRS pivot');
assert.equal(canPlace(game.board, makePiece(game.current.type)), true);
assert.equal(canPlace(game.board, { ...makePiece('O'), x: -1 }), false, 'pieces cannot enter the left wall');

game = startPause(game);
const rotated = rotatePiece({ ...game, current: makePiece('T') });
assert.equal(rotated.current.rot, 1);
const kicked = rotatePiece({ ...game, current: { type: 'I', x: -1, y: 8, rot: 1 } });
assert.equal(kicked.current.rot, 2);
assert.equal(kicked.current.x, 1, 'I-piece SRS applies the +2 wall kick when other tests fail');
const held = holdPiece({ ...game, current: makePiece('T') }, fixedRandom);
assert.equal(held.hold, 'T');
assert.equal(held.holdUsed, true);
assert.equal(holdPiece(held, fixedRandom), held, 'hold cannot be used twice before locking a piece');

let clearBoard = createBoard();
clearBoard[BOARD_H - 1] = Array(BOARD_W).fill('O');
for (let x = 3; x < 7; x += 1) clearBoard[BOARD_H - 1][x] = null;
game = {
  ...newGame(0, 'normal', fixedRandom), board: clearBoard, status: 'playing',
  current: { type: 'I', x: 3, y: 0, rot: 0 },
};
game = hardDropPiece(game, fixedRandom);
assert.equal(game.lines, 1, 'a completed row is cleared');
assert.equal(game.score, 136, 'hard drop and single-line points are both scored');
assert.ok(game.board[0].every(cell => cell === null), 'line clear inserts an empty row at the top');
assert.equal(game.holdUsed, false, 'locking a piece re-enables hold');

const comboBoard = createBoard();
comboBoard[BOARD_H - 1] = Array(BOARD_W).fill('O');
for (let x = 3; x < 7; x += 1) comboBoard[BOARD_H - 1][x] = null;
let comboGame = { ...newGame(0, 'normal', fixedRandom), board: comboBoard, status: 'playing', current: { type: 'I', x: 3, y: 0, rot: 0 } };
comboGame = hardDropPiece(comboGame, fixedRandom);
comboGame = { ...comboGame, board: comboBoard.map(row => [...row]), current: { type: 'I', x: 3, y: 0, rot: 0 }, status: 'playing' };
comboGame = hardDropPiece(comboGame, fixedRandom);
assert.equal(comboGame.combo, 1);
assert.equal(comboGame.score, 322, 'second consecutive clear earns a combo bonus');

const spinBoard = createBoard();
spinBoard[17][3] = 'O';
spinBoard[17][5] = 'O';
spinBoard[19][3] = 'O';
const spinGame = {
  ...newGame(0, 'normal', fixedRandom), board: spinBoard, status: 'playing',
  current: { type: 'T', x: 3, y: 17, rot: 0 }, lastAction: 'rotate',
};
const tSpin = lockPiece(spinGame, 0, fixedRandom);
assert.equal(tSpin.score, 400, 'a full T-Spin without line clears has a base score');
assert.equal(tSpin.lastClear.spin, 'full');

const toppedBoard = createBoard();
toppedBoard[0][5] = 'O';
assert.equal(canPlace(createBoard(), { type: 'O', x: 4, y: -1, rot: 0 }), true, 'pieces may spawn partially above the board');
const topped = {
  ...newGame(0, 'normal', fixedRandom), board: toppedBoard, status: 'playing',
  current: { type: 'I', x: 3, y: BOARD_H - 1, rot: 0 }, queue: ['O', 'T', 'S'],
};
const gameOver = hardDropPiece(topped, fixedRandom);
assert.equal(gameOver.status, 'gameover', 'locking above the board ends the game');
assert.equal(gameOver.bestScore, gameOver.score);

assert.equal(selectPace(newGame(0, 'normal', fixedRandom), 'fast', fixedRandom).pace, 'fast');
const activeGame = { ...game, status: 'playing' };
assert.equal(selectPace(activeGame, 'fast', fixedRandom), activeGame, 'pace cannot change during a game');
console.log('Tetris engine tests: OK');
