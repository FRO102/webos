(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExcelWebOSFormula = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function evaluateArithmetic(source) {
    const tokens = String(source).match(/\s*(?:\d+(?:\.\d*)?|\.\d+|[()+*/-])/g) || [];
    const compactSource = String(source).replace(/\s/g, '');
    if (tokens.join('').replace(/\s/g, '') !== compactSource || !compactSource) throw new Error('Expressão inválida.');
    const values = tokens.map(token => token.trim()).filter(Boolean);
    let position = 0;

    function primary() {
      const token = values[position++];
      if (token === '+') return primary();
      if (token === '-') return -primary();
      if (token === '(') {
        const value = expression();
        if (values[position++] !== ')') throw new Error('Parênteses inválidos.');
        return value;
      }
      if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error('Valor inválido.');
      return Number(token);
    }

    function term() {
      let value = primary();
      while (values[position] === '*' || values[position] === '/') {
        const operator = values[position++];
        const right = primary();
        value = operator === '*' ? value * right : value / right;
      }
      return value;
    }

    function expression() {
      let value = term();
      while (values[position] === '+' || values[position] === '-') {
        const operator = values[position++];
        const right = term();
        value = operator === '+' ? value + right : value - right;
      }
      return value;
    }

    const result = expression();
    if (position !== values.length || !Number.isFinite(result)) throw new Error('Expressão inválida.');
    return result;
  }

  function calculateCells(cells) {
    const cache = new Map();
    const visiting = new Set();
    const cellPattern = /^([A-O])([1-9]|[1-4][0-9]|50)$/;
    const toNumber = result => {
      if (result.isError) throw new Error(result.computed);
      const value = Number.parseFloat(result.computed);
      return Number.isFinite(value) ? value : 0;
    };

    function cellResult(id) {
      if (cache.has(id)) return cache.get(id);
      if (visiting.has(id)) return { computed: '#CICLO!', isError: true };
      const cell = cells[id];
      if (!cell || !cell.raw) return { computed: '', isError: false };
      if (!cell.raw.startsWith('=')) return { computed: cell.raw, isError: false };

      visiting.add(id);
      let expression = cell.raw.slice(1).toUpperCase();
      try {
        expression = expression.replace(/\b(SUM|AVG|MIN|MAX)\(\s*([A-O](?:[1-9]|[1-4][0-9]|50))\s*:\s*([A-O](?:[1-9]|[1-4][0-9]|50))\s*\)/g, (match, fn, start, end) => {
          const startMatch = start.match(cellPattern), endMatch = end.match(cellPattern);
          const startColumn = startMatch[1].charCodeAt(0) - 65, endColumn = endMatch[1].charCodeAt(0) - 65;
          const startRow = Number(startMatch[2]), endRow = Number(endMatch[2]);
          const values = [];
          for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
            for (let column = Math.min(startColumn, endColumn); column <= Math.max(startColumn, endColumn); column++) {
              values.push(toNumber(cellResult(`${String.fromCharCode(65 + column)}${row}`)));
            }
          }
          if (!values.length) return '0';
          if (fn === 'SUM') return String(values.reduce((sum, value) => sum + value, 0));
          if (fn === 'AVG') return String(values.reduce((sum, value) => sum + value, 0) / values.length);
          if (fn === 'MIN') return String(Math.min(...values));
          return String(Math.max(...values));
        });
        expression = expression.replace(/\b[A-O](?:[1-9]|[1-4][0-9]|50)\b/g, reference => String(toNumber(cellResult(reference))));
        const value = evaluateArithmetic(expression);
        const result = { computed: (Math.round(value * 1000000) / 1000000).toString(), isError: false };
        cache.set(id, result);
        return result;
      } catch (error) {
        const message = error.message === '#CICLO!' ? '#CICLO!' : '#ERRO!';
        const result = { computed: message, isError: true };
        cache.set(id, result);
        return result;
      } finally {
        visiting.delete(id);
      }
    }

    const results = {};
    for (const id of Object.keys(cells)) results[id] = cellResult(id);
    return results;
  }

  return { evaluateArithmetic, calculateCells };
});