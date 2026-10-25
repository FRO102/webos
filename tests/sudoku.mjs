import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isSafe } = require('../apps/sudoku/app.js');
const solved = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [4, 5, 6, 7, 8, 9, 1, 2, 3],
  [7, 8, 9, 1, 2, 3, 4, 5, 6],
  [2, 3, 4, 5, 6, 7, 8, 9, 1],
  [5, 6, 7, 8, 9, 1, 2, 3, 4],
  [8, 9, 1, 2, 3, 4, 5, 6, 7],
  [3, 4, 5, 6, 7, 8, 9, 1, 2],
  [6, 7, 8, 9, 1, 2, 3, 4, 5],
  [9, 1, 2, 3, 4, 5, 6, 7, 8],
];

assert.equal(isSafe(solved, 0, 0, 1), true, 'A célula não deve colidir consigo própria.');
const rowConflict = solved.map(row => [...row]);
rowConflict[0][1] = 1;
assert.equal(isSafe(rowConflict, 0, 1, 1), false, 'Deteta duplicado na linha.');
const columnConflict = solved.map(row => [...row]);
columnConflict[1][0] = 1;
assert.equal(isSafe(columnConflict, 1, 0, 1), false, 'Deteta duplicado na coluna.');
const boxConflict = solved.map(row => [...row]);
boxConflict[1][1] = 1;
assert.equal(isSafe(boxConflict, 1, 1, 1), false, 'Deteta duplicado no bloco 3x3.');
console.log('Sudoku logic tests: OK');