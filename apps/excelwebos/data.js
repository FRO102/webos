(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ExcelWebOSData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function parseCsv(source) {
    const text = String(source ?? '').replace(/^\uFEFF/, '');
    if (!text) return [];

    const rows = [];
    let row = [], field = '', quoted = false, afterQuote = false;
    const pushField = () => { row.push(field); field = ''; afterQuote = false; };
    const pushRow = () => {
      pushField();
      rows.push(row);
      row = [];
    };

    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (quoted) {
        if (char === '"') {
          if (text[index + 1] === '"') { field += '"'; index++; }
          else { quoted = false; afterQuote = true; }
        } else field += char;
        continue;
      }

      if (afterQuote && char !== ',' && char !== '\r' && char !== '\n' && char !== ' ' && char !== '\t') {
        throw new Error('CSV inválido: conteúdo inesperado após aspas.');
      }
      if (char === ',' ) { pushField(); continue; }
      if (char === '\r' || char === '\n') {
        if (char === '\r' && text[index + 1] === '\n') index++;
        pushRow();
        continue;
      }
      if (char === '"') {
        if (field.length || afterQuote) throw new Error('CSV inválido: aspas numa posição inesperada.');
        quoted = true;
        continue;
      }
      if (!afterQuote) field += char;
    }

    if (quoted) throw new Error('CSV inválido: campo entre aspas não terminado.');
    if (row.length || field.length || afterQuote || text.endsWith(',')) pushRow();
    return rows;
  }

  function serializeCsv(rows) {
    return rows.map(row => row.map(value => {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')).join('\r\n') + (rows.length ? '\r\n' : '');
  }

  function validateWorkbook(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || (data.format !== undefined && (data.format !== 'webos-spreadsheet' || data.version !== 1))
      || !data.cells || typeof data.cells !== 'object' || Array.isArray(data.cells)) {
      throw new Error('O ficheiro não contém uma folha válida.');
    }
    const cells = {};
    for (const [id, cell] of Object.entries(data.cells)) {
      if (!/^[A-O](?:[1-9]|[1-4][0-9]|50)$/.test(id) || !cell || typeof cell !== 'object'
        || typeof cell.raw !== 'string' || cell.raw.length > 10000) throw new Error(`A célula ${id} contém dados inválidos.`);
      cells[id] = { raw: cell.raw, computed: cell.raw, style: validateCellStyle(cell.style) };
    }
    const colWidths = {};
    if (data.colWidths !== undefined) {
      if (!data.colWidths || typeof data.colWidths !== 'object' || Array.isArray(data.colWidths)) throw new Error('As larguras de coluna são inválidas.');
      for (const [column, width] of Object.entries(data.colWidths)) {
        const index = Number(column), value = Number(width);
        if (!Number.isInteger(index) || index < 0 || index >= 15 || !Number.isFinite(value) || value < 35 || value > 600) throw new Error('Uma largura de coluna está fora dos limites.');
        colWidths[index] = value;
      }
    }
    return { cells, colWidths };
  }

  function validateCellStyle(style) {
    if (!style || typeof style !== 'object' || Array.isArray(style)) return {};
    const safe = {};
    if (typeof style.bold === 'boolean') safe.bold = style.bold;
    if (typeof style.italic === 'boolean') safe.italic = style.italic;
    if (['left', 'center', 'right'].includes(style.align)) safe.align = style.align;
    if (typeof style.color === 'string' && /^#[\da-f]{6}$/i.test(style.color)) safe.color = style.color;
    return safe;
  }

  function workbookSignature(data) {
    const normalized = validateWorkbook(data);
    return JSON.stringify(normalized);
  }

  return { parseCsv, serializeCsv, validateWorkbook, workbookSignature };
});