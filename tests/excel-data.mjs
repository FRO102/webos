import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseCsv, serializeCsv, validateWorkbook, workbookSignature } = require('../apps/excelwebos/data.js');
const { evaluateArithmetic, calculateCells } = require('../apps/excelwebos/formula-data.js');

const source = '\uFEFFname,description,value\r\nAlpha,"text, with comma",1\r\nBeta,"two lines\r\ninside",2\r\nGamma,"say ""hello""",3\r\n';
const parsed = parseCsv(source);
assert.deepEqual(parsed, [
  ['name', 'description', 'value'],
  ['Alpha', 'text, with comma', '1'],
  ['Beta', 'two lines\r\ninside', '2'],
  ['Gamma', 'say "hello"', '3'],
]);
assert.deepEqual(parseCsv(serializeCsv(parsed)), parsed, 'CSV mantém campos citados e quebras de linha no round-trip.');
assert.deepEqual(parseCsv('a,b\r\n1,2'), [['a', 'b'], ['1', '2']]);
assert.deepEqual(parseCsv(''), []);
assert.throws(() => parseCsv('a,"campo'), /não terminado/);
assert.throws(() => parseCsv('a,"x"z'), /após aspas/);
assert.equal(evaluateArithmetic('2+3*4'), 14);
assert.equal(evaluateArithmetic('(2+3)*4'), 20);
assert.equal(evaluateArithmetic('-2 + +5'), 3);
assert.throws(() => evaluateArithmetic('1/0'), /inválida/);
assert.throws(() => evaluateArithmetic('globalThis.process.exit()'), /inválida/);
const calculated = calculateCells({
  A1: { raw: '2' },
  A2: { raw: '3' },
  B1: { raw: '=A1+A2*2' },
  C1: { raw: '=SUM(A1:A2)' },
  D1: { raw: '=AVG(A1:A2)' },
  E1: { raw: '=MIN(A1:A2)' },
  F1: { raw: '=MAX(A1:A2)' },
});
assert.equal(calculated.B1.computed, '8');
assert.equal(calculated.C1.computed, '5');
assert.equal(calculated.D1.computed, '2.5');
assert.equal(calculated.E1.computed, '2');
assert.equal(calculated.F1.computed, '3');

const longChain = { A50: { raw: '1' } };
for (let row = 49; row >= 1; row--) longChain[`A${row}`] = { raw: `=A${row + 1}+1` };
assert.equal(calculateCells(longChain).A1.computed, '50', 'Recalcula cadeias maiores que cinco células.');

const cycle = calculateCells({ A1: { raw: '=B1+1' }, B1: { raw: '=A1+1' }, C1: { raw: '=A1+2' } });
assert.equal(cycle.A1.computed, '#CICLO!');
assert.equal(cycle.B1.computed, '#CICLO!');
assert.equal(cycle.C1.isError, true);
assert.equal(calculateCells({ A1: { raw: '=A10+1' } }).A1.computed, '1', 'A1 não deve confundir a referência A10 com ciclo.');
assert.deepEqual(validateWorkbook({ cells: { A1: { raw: 'legacy' } } }), { cells: { A1: { raw: 'legacy', computed: 'legacy', style: {} } }, colWidths: {} });
assert.deepEqual(validateWorkbook({ format: 'webos-spreadsheet', version: 1, cells: { O50: { raw: '=1+2' } }, colWidths: { 0: 120 } }), { cells: { O50: { raw: '=1+2', computed: '=1+2', style: {} } }, colWidths: { 0: 120 } });
assert.throws(() => validateWorkbook({ format: 'webos-spreadsheet', version: 99, cells: {} }), /válida/);
assert.throws(() => validateWorkbook({ cells: { P1: { raw: 'out of range' } } }), /inválidos/);
assert.deepEqual(validateWorkbook({ cells: { A1: { raw: '1', style: { bold: true, align: 'right', color: 'red', position: 'fixed' } } } }).cells.A1.style, { bold: true, align: 'right' });
assert.equal(workbookSignature({ cells: { A1: { raw: '1' } }, colWidths: {} }), workbookSignature({ format: 'webos-spreadsheet', version: 1, cells: { A1: { raw: '1', computed: 'ignored' } }, colWidths: {} }));
console.log('Excel CSV tests: OK');