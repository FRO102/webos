import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isSafe, solve, countSolutions, generateSolution, createPuzzle, isComplete } = require('../apps/sudoku/app.js');
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

// solve
const puzzle = solved.map(row => [...row]);
puzzle[0][0] = 0;
const sol = solve(puzzle);
assert.ok(sol, 'solve deve resolver');
assert.equal(sol[0][0], 1, 'solve deve preencher corretamente');

// countSolutions unicidade
const uniquePuzzle = solved.map(row => [...row]);
uniquePuzzle[0][0] = 0;
assert.equal(countSolutions(uniquePuzzle), 1, 'puzzle com 1 vazio deve ter 1 solução');

// generateSolution
const gen = generateSolution();
assert.ok(gen && gen.length === 9, 'generateSolution deve devolver 9x9');
for (let r = 0; r < 9; r++) {
  for (let c = 0; c < 9; c++) {
    assert.ok(gen[r][c] >= 1 && gen[r][c] <= 9, 'valores 1-9');
  }
}

// createPuzzle
for (const diff of ['easy','medium','hard']) {
  const sol2 = generateSolution();
  const pz = createPuzzle(sol2, diff);
  const emptyCount = pz.flat().filter(v => v === 0).length;
  assert.ok(emptyCount > 0, 'puzzle deve ter vazios');
  assert.equal(countSolutions(pz), 1, 'puzzle deve ter solução única (' + diff + ')');
  // fixed cells match solution
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (pz[r][c] !== 0) assert.equal(pz[r][c], sol2[r][c], 'fixos correspondem à solução');
}

// isComplete
assert.equal(isComplete(solved, solved), true, 'board completo deve ser true');
const incomplete = solved.map(row => [...row]); incomplete[0][0] = 0;
assert.equal(isComplete(incomplete, solved), false, 'board incompleto deve ser false');

console.log('Sudoku extended logic tests: OK');