(function () {
  'use strict';

  const COLS = 15;
  const ROWS = 50;
  const DRAFT_KEY = 'excel_draft_v2';

  const state = {
    cells: {}, // { "A1": { raw: "=SUM(B1:B5)", computed: "100", style: {...} } }
    activeCell: 'A1',
    selectionRange: null, // { start: 'A1', end: 'B5' }
    isSelecting: false,
    path: null,
    docName: 'Sem título',
    dirty: false,
    saveTimer: null,
    history: [],
    historyIndex: -1,
  };

  const els = {};
  let tableBody;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    buildGrid();
    bindEvents();
    await restoreDraft();
    pushHistory(); // Estado inicial
    setActiveCell('A1', false);
    updateWindowTitle();
  }

  function cacheElements() {
    els.formulaInput = document.getElementById('formula-input');
    els.cellAddress = document.getElementById('cell-address');
    els.statusMsg = document.getElementById('status-message');
    els.statusStats = document.getElementById('status-stats');
    els.statusCoords = document.getElementById('status-coords');
    els.colorPicker = document.getElementById('color-picker');
    els.colorPreview = document.getElementById('color-preview');
    tableBody = document.getElementById('sheet-body');
  }

  // ------------------------------------------------------------- Grelha & UI

  function buildGrid() {
    const colHeaders = document.getElementById('col-headers');
    colHeaders.innerHTML = '<th class="corner"></th>';

    for (let c = 0; c < COLS; c++) {
      const th = document.createElement('th');
      th.textContent = getColName(c);
      colHeaders.appendChild(th);
    }

    tableBody.innerHTML = '';
    for (let r = 1; r <= ROWS; r++) {
      const tr = document.createElement('tr');
      const rowHeader = document.createElement('th');
      rowHeader.className = 'row-header';
      rowHeader.textContent = r;
      tr.appendChild(rowHeader);

      for (let c = 0; c < COLS; c++) {
        const td = document.createElement('td');
        const id = getColName(c) + r;
        td.dataset.id = id;

        const div = document.createElement('div');
        div.contentEditable = 'true';
        div.dataset.id = id;
        
        td.appendChild(div);
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    }
    renderAllCells();
  }

  function renderCell(id) {
    const el = document.querySelector(`td[data-id="${id}"] div`);
    if (!el) return;

    const cellData = state.cells[id];
    
    // Se a célula estiver em foco, não sobrescrever o que o utilizador está a escrever
    if (document.activeElement === el) return;

    if (!cellData) {
      el.textContent = '';
      el.className = '';
      return;
    }

    el.textContent = cellData.computed;
    
    let classes = [];
    if (cellData.isError) classes.push('error');
    if (cellData.style) {
      if (cellData.style.bold) classes.push('bold');
      if (cellData.style.italic) classes.push('italic');
      if (cellData.style.align) classes.push('align-' + cellData.style.align);
    }
    el.className = classes.join(' ');
    el.style.color = (cellData.style && cellData.style.color) ? cellData.style.color : '';
  }

  function renderAllCells() {
    document.querySelectorAll('td div').forEach(el => { el.textContent = ''; el.className = ''; el.style.color = ''; });
    for (const id in state.cells) renderCell(id);
  }

  // ------------------------------------------------------------- Motor de Fórmulas

  function getRangeValues(start, end) {
    const cells = [];
    const startCol = start.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
    const endCol = end.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const id = getColName(c) + r;
        const cell = state.cells[id];
        if (cell && !cell.isError) {
          const num = parseFloat(cell.computed);
          if (!isNaN(num)) cells.push(num);
        }
      }
    }
    return cells;
  }

  function evaluateFormula(rawStr) {
    if (typeof rawStr !== 'string' || !rawStr.startsWith('=')) {
      return { computed: rawStr, isError: false };
    }

    let expr = rawStr.substring(1).toUpperCase();

    // 1. Resolver Intervalos (Ranges) com Funções: SUM, AVG, MIN, MAX
    const funcRegex = /(SUM|AVG|MIN|MAX)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)/g;
    expr = expr.replace(funcRegex, (match, func, start, end) => {
      const vals = getRangeValues(start, end);
      if (vals.length === 0) return '0';
      
      switch (func) {
        case 'SUM': return vals.reduce((a, b) => a + b, 0).toString();
        case 'AVG': return (vals.reduce((a, b) => a + b, 0) / vals.length).toString();
        case 'MIN': return Math.min(...vals).toString();
        case 'MAX': return Math.max(...vals).toString();
        default: return '0';
      }
    });

    // 2. Resolver Células Individuais
    const cellRegex = /[A-Z]+[0-9]+/g;
    expr = expr.replace(cellRegex, (match) => {
      const cell = state.cells[match];
      if (!cell) return '0';
      const num = parseFloat(cell.computed);
      return isNaN(num) ? '0' : num.toString();
    });

    // 3. Validar e Calcular Expressão Matemática
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      return { computed: '#ERRO!', isError: true };
    }

    try {
      const result = new Function('return ' + expr)();
      if (result === Infinity || result === -Infinity || isNaN(result)) {
        return { computed: '#ERRO!', isError: true };
      }
      const rounded = Math.round(result * 1000000) / 1000000;
      return { computed: rounded.toString(), isError: false };
    } catch (e) {
      return { computed: '#ERRO!', isError: true };
    }
  }

  function updateCellValue(id, rawValue) {
    if (!state.cells[id]) state.cells[id] = { raw: '', computed: '', style: {} };
    
    const oldRaw = state.cells[id].raw;
    if (oldRaw === rawValue) return;

    state.cells[id].raw = rawValue;
    const result = evaluateFormula(rawValue);
    state.cells[id].computed = result.computed;
    state.cells[id].isError = result.isError;

    renderCell(id);
    markDirty();

    if (id === state.activeCell) {
      els.formulaInput.value = rawValue;
    }
  }

  // ------------------------------------------------------------- Seleção e Navegação

  function setActiveCell(id, focusGrid = true) {
    const td = document.querySelector(`td[data-id="${id}"]`);
    if (!td) return;

    state.activeCell = id;
    state.selectionRange = { start: id, end: id };
    updateSelectionUI();

    els.cellAddress.textContent = id;
    els.statusCoords.textContent = 'Célula: ' + id;

    const input = td.querySelector('div');
    const cell = state.cells[id];
    els.formulaInput.value = cell ? cell.raw : '';
    
    updateToolbarState();
    
    if (focusGrid) input.focus();
  }

  function updateSelectionUI() {
    document.querySelectorAll('td.active, td.selected').forEach(el => {
      el.classList.remove('active', 'selected');
    });

    if (!state.selectionRange) return;

    const { start, end } = state.selectionRange;
    const startCol = start.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
    const endCol = end.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    // Mostrar stats na status bar se houver seleção múltipla
    if (minCol !== maxCol || minRow !== maxRow) {
      const vals = getRangeValues(start, end);
      if (vals.length > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = sum / vals.length;
        els.statusStats.textContent = `Soma: ${sum.toFixed(2)} | Média: ${avg.toFixed(2)} | Contagem: ${vals.length}`;
      } else {
        els.statusStats.textContent = '';
      }
    } else {
      els.statusStats.textContent = '';
    }

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const td = document.querySelector(`td[data-id="${getColName(c) + r}"]`);
        if (td) {
          td.classList.add('selected');
          if (getColName(c) + r === state.activeCell) {
            td.classList.remove('selected');
            td.classList.add('active');
          }
        }
      }
    }
  }

  function moveSelection(dRow, dCol) {
    let colIdx = state.activeCell.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    let rowIdx = parseInt(state.activeCell.replace(/[A-Z]/g, ''), 10);

    colIdx = Math.max(0, Math.min(COLS - 1, colIdx + dCol));
    rowIdx = Math.max(1, Math.min(ROWS, rowIdx + dRow));

    setActiveCell(getColName(colIdx) + rowIdx);
  }

  // ------------------------------------------------------------- Eventos e Interação

  function bindEvents() {
    // Mouse (Seleção e Edição)
    tableBody.addEventListener('mousedown', e => {
      const td = e.target.closest('td');
      if (!td || !td.dataset.id) return;
      
      // Se clicar na célula já ativa e ela estiver em modo de edição, permite.
      if (td.dataset.id === state.activeCell && document.activeElement === td.querySelector('div')) {
        return; 
      }

      e.preventDefault(); // Evita selecionar texto ao arrastar
      state.isSelecting = true;
      setActiveCell(td.dataset.id, false);
      document.activeElement.blur(); // Sai do modo de edição se estava noutra
    });

    tableBody.addEventListener('mouseover', e => {
      if (!state.isSelecting) return;
      const td = e.target.closest('td');
      if (td && td.dataset.id) {
        state.selectionRange.end = td.dataset.id;
        updateSelectionUI();
      }
    });

    window.addEventListener('mouseup', () => {
      state.isSelecting = false;
    });

    // Duplo clique entra em modo de edição
    tableBody.addEventListener('dblclick', e => {
      const td = e.target.closest('td');
      if (td && td.dataset.id) {
        const input = td.querySelector('div');
        input.focus();
        // Selecionar o texto todo para o utilizador substituir
        document.execCommand('selectAll', false, null);
      }
    });

    // Teclado e Edição
    tableBody.addEventListener('focusin', e => {
      if (e.target.tagName === 'DIV' && e.target.dataset.id) {
        const id = e.target.dataset.id;
        const cell = state.cells[id];
        // Ao focar, mostra a FÓRMULA BRUTA (raw)
        if (cell) e.target.textContent = cell.raw;
      }
    });

    tableBody.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
        moveSelection(1, 0);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.target.blur();
        moveSelection(0, e.shiftKey ? -1 : 1);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        // Se estiver a editar, as setas movem o cursor. Se não, movem a seleção.
        const isEditing = document.activeElement === e.target && e.target.textContent !== (state.cells[e.target.dataset.id]?.computed || '');
        if (!isEditing) {
          e.preventDefault();
          if (e.key === 'ArrowUp') moveSelection(-1, 0);
          if (e.key === 'ArrowDown') moveSelection(1, 0);
          if (e.key === 'ArrowLeft') moveSelection(0, -1);
          if (e.key === 'ArrowRight') moveSelection(0, 1);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
         // Limpar células selecionadas
         if (document.activeElement.tagName !== 'DIV' || document.activeElement.textContent === '') {
           e.preventDefault();
           clearSelection();
         }
      }
    });

    tableBody.addEventListener('blur', e => {
      if (e.target.tagName === 'DIV' && e.target.dataset.id) {
        const id = e.target.dataset.id;
        const newValue = e.target.textContent.trim();
        updateCellValue(id, newValue);
        renderCell(id); // Volta a mostrar o valor computado
      }
    }, true);

    // Formula Bar
    els.formulaInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateCellValue(state.activeCell, els.formulaInput.value);
        moveSelection(1, 0);
      }
    });
    els.formulaInput.addEventListener('blur', () => {
       const id = state.activeCell;
       if (els.formulaInput.value !== (state.cells[id]?.raw || '')) {
           updateCellValue(id, els.formulaInput.value);
       }
    });

    // Copiar / Colar TSV
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);

    // Formatação
    document.getElementById('btn-bold').addEventListener('click', () => applyStyle('bold'));
    document.getElementById('btn-italic').addEventListener('click', () => applyStyle('italic'));
    document.getElementById('btn-align-left').addEventListener('click', () => applyStyle('align', 'left'));
    document.getElementById('btn-align-center').addEventListener('click', () => applyStyle('align', 'center'));
    document.getElementById('btn-align-right').addEventListener('click', () => applyStyle('align', 'right'));
    
    document.getElementById('btn-color').addEventListener('click', () => els.colorPicker.click());
    els.colorPicker.addEventListener('input', () => {
      els.colorPreview.style.background = els.colorPicker.value;
      applyStyle('color', els.colorPicker.value);
    });

    // Ficheiros e Histórico
    document.getElementById('btn-open').addEventListener('click', openFile);
    document.getElementById('btn-save').addEventListener('click', saveFile);
    document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);

    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') { e.preventDefault(); saveFile(); }
        if (e.key === 'o') { e.preventDefault(); openFile(); }
        if (e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
      }
    });

    if (window.os && os.args) {
      os.args().then(args => { if (args && args.path) loadPath(args.path); }).catch(()=>{});
    }
  }

  // ------------------------------------------------------------- Copiar / Colar

  function handleCopy(e) {
    if (document.activeElement.tagName === 'DIV' && document.activeElement.textContent !== '') {
      return; // Deixa o browser copiar o texto da célula normalmente
    }

    e.preventDefault();
    if (!state.selectionRange) return;

    const { start, end } = state.selectionRange;
    const startCol = start.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
    const endCol = end.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

    let copyText = "";
    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      let row = [];
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        const cell = state.cells[getColName(c) + r];
        row.push(cell ? cell.raw : '');
      }
      copyText += row.join('\t') + '\n';
    }

    e.clipboardData.setData('text/plain', copyText);
    setStatus('Copiado!');
  }

  function handlePaste(e) {
    if (document.activeElement.tagName === 'DIV') {
      return; // Deixa o browser colar texto na célula
    }

    e.preventDefault();
    const pasteData = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (!pasteData) return;

    const rows = pasteData.split(/\r?\n/).filter((r, i, arr) => i < arr.length - 1 || r !== '');
    const startCol = state.activeCell.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(state.activeCell.replace(/[A-Z]/g, ''), 10);

    rows.forEach((rowStr, rOffset) => {
      const cols = rowStr.split('\t');
      cols.forEach((colStr, cOffset) => {
        const id = getColName(startCol + cOffset) + (startRow + rOffset);
        if (startCol + cOffset < COLS && startRow + rOffset <= ROWS) {
          updateCellValue(id, colStr);
        }
      });
    });
    pushHistory();
    setStatus('Colado!');
  }

  function clearSelection() {
    if (!state.selectionRange) return;
    const { start, end } = state.selectionRange;
    const startCol = start.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
    const endCol = end.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        const id = getColName(c) + r;
        if (state.cells[id]) {
          state.cells[id].raw = '';
          state.cells[id].computed = '';
          renderCell(id);
        }
      }
    }
    markDirty();
    pushHistory();
  }

  // ------------------------------------------------------------- Formatação e Estado

  function applyStyle(key, val = true) {
    // Aplica a TODAS as células da seleção
    const { start, end } = state.selectionRange;
    const startCol = start.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
    const endCol = end.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
      for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        const id = getColName(c) + r;
        if (!state.cells[id]) state.cells[id] = { raw: '', computed: '', style: {} };
        if (!state.cells[id].style) state.cells[id].style = {};

        if (key === 'bold' || key === 'italic') {
          // Toggle based on active cell's state
          const activeStyle = state.cells[state.activeCell]?.style || {};
          state.cells[id].style[key] = !activeStyle[key];
        } else {
          state.cells[id].style[key] = val;
        }
        renderCell(id);
      }
    }
    updateToolbarState();
    markDirty();
    pushHistory();
  }

  function updateToolbarState() {
    const style = state.cells[state.activeCell]?.style || {};
    document.getElementById('btn-bold').setAttribute('aria-pressed', style.bold ? 'true' : 'false');
    document.getElementById('btn-italic').setAttribute('aria-pressed', style.italic ? 'true' : 'false');
    els.colorPreview.style.background = style.color || '#000000';
    els.colorPicker.value = style.color || '#000000';
  }

  // ------------------------------------------------------------- Histórico (Undo/Redo)

  function pushHistory() {
    // Limpar estados futuros se estivermos a fazer uma nova ação após Undo
    if (state.historyIndex < state.history.length - 1) {
      state.history = state.history.slice(0, state.historyIndex + 1);
    }
    
    state.history.push(JSON.stringify(state.cells));
    
    // Limitar memória a 30 passos
    if (state.history.length > 30) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      state.cells = JSON.parse(state.history[state.historyIndex]);
      renderAllCells();
      updateUndoRedoButtons();
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      state.cells = JSON.parse(state.history[state.historyIndex]);
      renderAllCells();
      updateUndoRedoButtons();
    }
  }

  function updateUndoRedoButtons() {
    document.getElementById('btn-undo').disabled = state.historyIndex <= 0;
    document.getElementById('btn-redo').disabled = state.historyIndex >= state.history.length - 1;
  }

  function markDirty() {
    state.dirty = true;
    updateWindowTitle();
    scheduleDraft();
  }

  // ------------------------------------------------------------- Persistência

  function updateWindowTitle() {
    if (!window.os || !os.window) return;
    const marker = state.dirty ? ' *' : '';
    os.window.setTitle(`ExcelWebos - ${state.docName}${marker}`);
  }

  function setStatus(msg) {
    els.statusMsg.textContent = msg;
  }

  async function saveFile() {
    if (!window.os) return;
    let path = state.path;
    if (!path) {
      path = await os.dialog.save({ title: 'Guardar Folha', defaultName: 'folha.json', start: '/home/user/Documentos/' });
      if (!path) return;
      if (!path.endsWith('.json')) path += '.json';
    }

    const data = { cells: state.cells };
    try {
      await writeFileWithOverwrite(path, JSON.stringify(data, null, 2), 'application/json');
      state.path = path;
      state.docName = path.split('/').pop();
      state.dirty = false;
      updateWindowTitle();
      setStatus('Guardado com sucesso.');
      if (window.os && os.storage) await os.storage.remove(DRAFT_KEY);
    } catch (err) {
      os.notify('Erro ao guardar: ' + err.message);
    }
  }

  async function openFile() {
    if (!window.os) return;
    const path = await os.dialog.open({ title: 'Abrir Folha', start: '/home/user/Documentos/', filter: ['.json', '.csv'] });
    if (path) loadPath(path);
  }

  async function loadPath(path) {
    try {
      const content = await os.fs.read(path);
      const isCsv = path.toLowerCase().endsWith('.csv');
      
      if (isCsv) {
        parseCsv(content);
      } else {
        const data = JSON.parse(content);
        state.cells = data.cells || {};
      }
      
      state.path = path;
      state.docName = path.split('/').pop();
      state.dirty = false;
      
      renderAllCells();
      setActiveCell('A1', false);
      pushHistory();
      updateWindowTitle();
      setStatus('Ficheiro aberto: ' + state.docName);
    } catch (err) {
      os.notify('Erro ao abrir: ' + err.message);
    }
  }

  async function writeFileWithOverwrite(path, content, mime) {
    try {
      await os.fs.write(path, content, mime);
    } catch (err) {
      if (os.errors && os.errors.is(err, 'already_exists')) {
        await os.fs.remove(path);
        await os.fs.write(path, content, mime);
      } else {
        throw err;
      }
    }
  }

  async function exportCsv() {
    let path = await os.dialog.save({ title: 'Exportar CSV', defaultName: state.docName.replace('.json', '') + '.csv', start: '/home/user/Documentos/' });
    if (!path) return;
    if (!path.toLowerCase().endsWith('.csv')) path += '.csv';

    let csvContent = "";
    for (let r = 1; r <= ROWS; r++) {
      let row = [];
      for (let c = 0; c < COLS; c++) {
        const id = getColName(c) + r;
        const cell = state.cells[id];
        let val = cell ? cell.computed : "";
        val = String(val).replace(/"/g, '""');
        if (val.includes(',') || val.includes('\n') || val.includes('"')) val = `"${val}"`;
        row.push(val);
      }
      csvContent += row.join(",") + "\r\n";
    }

    try {
      await writeFileWithOverwrite(path, csvContent, 'text/csv');
      setStatus('Exportado: ' + path.split('/').pop());
    } catch (err) {
      os.notify('Erro ao exportar CSV.');
    }
  }

  function parseCsv(text) {
    state.cells = {};
    const lines = text.split(/\r?\n/);
    for (let r = 0; r < Math.min(lines.length, ROWS); r++) {
      if (!lines[r]) continue;
      const cols = lines[r].split(',');
      for (let c = 0; c < Math.min(cols.length, COLS); c++) {
        let val = cols[c].trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).replace(/""/g, '"');
        }
        if (val) state.cells[getColName(c) + (r + 1)] = { raw: val, computed: val, style: {} };
      }
    }
  }

  // ------------------------------------------------------------- Helpers

  function scheduleDraft() {
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(async () => {
      if (!window.os || !os.storage) return;
      try {
        await os.storage.set(DRAFT_KEY, { cells: state.cells, path: state.path, name: state.docName });
      } catch (e) {}
    }, 1000);
  }

  async function restoreDraft() {
    if (!window.os || !os.storage) return;
    try {
      const draft = await os.storage.get(DRAFT_KEY);
      if (draft && draft.cells) {
        state.cells = draft.cells;
        state.path = draft.path;
        state.docName = draft.name || 'Sem título';
        renderAllCells();
        setStatus('Rascunho restaurado.');
      }
    } catch (e) {}
  }

  function getColName(index) {
    let name = '';
    while (index >= 0) {
      name = String.fromCharCode((index % 26) + 65) + name;
      index = Math.floor(index / 26) - 1;
    }
    return name;
  }

})();