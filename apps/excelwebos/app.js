(function () {
  'use strict';

  const COLS = 15; // A a O
  const ROWS = 50;
  const DRAFT_KEY = 'excel_draft_v3';

  const state = {
    cells: {}, 
    activeCell: 'A1',
    selectionRange: null, // { start: 'A1', end: 'B5' }
    isSelecting: false,
    path: null,
    docName: 'Sem título',
    dirty: false,
    saveTimer: null,
    history: [],
    historyIndex: -1,
    revision: 0,
    savedSnapshot: '',
    colWidths: {} // { 0: 100, 1: 120 } (index: width)
  };

  const els = {};
  let tableBody;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    buildGrid();
    bindEvents();
    const args = window.os?.args ? await os.args().catch(() => null) : null;
    const restoredDraft = await restoreDraft(args?.path ?? null);
    if (args?.path && !restoredDraft) await loadPath(args.path);
    if (!args?.path && !restoredDraft) state.savedSnapshot = documentSnapshot();
    if (state.history.length === 0) pushHistory();
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
      th.className = 'col-header';
      th.dataset.col = c;
      th.textContent = getColName(c);
      colHeaders.appendChild(th);
      
      // Aplicar largura guardada
      if (state.colWidths[c]) {
        th.style.width = state.colWidths[c] + 'px';
        th.style.minWidth = state.colWidths[c] + 'px';
      }
    }

    tableBody.innerHTML = '';
    for (let r = 1; r <= ROWS; r++) {
      const tr = document.createElement('tr');
      const rowHeader = document.createElement('th');
      rowHeader.className = 'row-header';
      rowHeader.dataset.row = r;
      rowHeader.textContent = r;
      tr.appendChild(rowHeader);

      for (let c = 0; c < COLS; c++) {
        const td = document.createElement('td');
        const id = getColName(c) + r;
        td.dataset.id = id;
        td.dataset.col = c;
        td.dataset.row = r;

        // Aplicar largura guardada
        if (state.colWidths[c]) {
          td.style.width = state.colWidths[c] + 'px';
          td.style.minWidth = state.colWidths[c] + 'px';
        }

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
    if (document.activeElement === el) return; // Não sobrescrever enquanto edita

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

  // Recalcula dependências em ordem, detetando ciclos diretos e indiretos.
  function recalculateAll() {
    const results = ExcelWebOSFormula.calculateCells(state.cells);
    for (const [id, result] of Object.entries(results)) {
      state.cells[id].computed = result.computed;
      state.cells[id].isError = result.isError;
    }

    renderAllCells();
    if (state.activeCell) {
      const active = state.cells[state.activeCell];
      els.formulaInput.value = active ? active.raw : '';
    }
    updateStats();
  }

  function updateCellValue(id, rawValue) {
    if (!state.cells[id]) state.cells[id] = { raw: '', computed: '', style: {} };
    if (state.cells[id].raw === rawValue) return;

    state.cells[id].raw = rawValue;
    markDirty();
    recalculateAll();
    pushHistory();
  }

  // ------------------------------------------------------------- Seleção

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

  function expandSelection(targetId) {
    state.selectionRange.end = targetId;
    updateSelectionUI();
  }

  function updateSelectionUI() {
    document.querySelectorAll('td.active, td.selected').forEach(el => el.classList.remove('active', 'selected'));
    document.querySelectorAll('th.active').forEach(el => el.classList.remove('active'));

    if (!state.selectionRange) return;
    const { start, end } = state.selectionRange;

    const startCol = start.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
    const endCol = end.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

    const minCol = Math.min(startCol, endCol), maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow), maxRow = Math.max(startRow, endRow);

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
    updateStats();
  }

  function updateStats() {
    if (!state.selectionRange) return;
    const { start, end } = state.selectionRange;
    const startCol = start.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const startRow = parseInt(start.replace(/[A-Z]/g, ''), 10);
    const endCol = end.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    const endRow = parseInt(end.replace(/[A-Z]/g, ''), 10);

    if (start !== end) {
      const vals = getRangeValues(start, end);
      if (vals.length > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        els.statusStats.textContent = `Soma: ${sum.toFixed(2)} | Média: ${(sum / vals.length).toFixed(2)} | Contagem: ${vals.length}`;
      } else {
        els.statusStats.textContent = '';
      }
    } else {
      els.statusStats.textContent = '';
    }
  }

  // ------------------------------------------------------------- Eventos e Teclado

  function bindEvents() {
    tableBody.addEventListener('mousedown', e => {
      const td = e.target.closest('td');
      if (!td) return;
      if (td.dataset.id === state.activeCell && document.activeElement === td.querySelector('div')) return;

      e.preventDefault();
      state.isSelecting = true;
      setActiveCell(td.dataset.id, false);
      document.activeElement.blur();
    });

    tableBody.addEventListener('mouseover', e => {
      if (!state.isSelecting) return;
      const td = e.target.closest('td');
      if (td) expandSelection(td.dataset.id);
    });

    window.addEventListener('mouseup', () => { state.isSelecting = false; });

    // Duplo clique para editar
    tableBody.addEventListener('dblclick', e => {
      const td = e.target.closest('td');
      if (td) {
        const input = td.querySelector('div');
        input.focus();
        document.execCommand('selectAll', false, null);
      }
    });

    // Cabeçalhos (Selecionar coluna/linha inteira)
    document.getElementById('col-headers').addEventListener('mousedown', e => {
      const th = e.target.closest('th.col-header');
      if (th) selectWholeCol(parseInt(th.dataset.col));
    });
    tableBody.addEventListener('mousedown', e => {
      const th = e.target.closest('th.row-header');
      if (th) selectWholeRow(parseInt(th.dataset.row));
    });

    // Navegação de Teclado
    tableBody.addEventListener('keydown', e => {
      const isEditing = document.activeElement === e.target;

      if (e.key === 'Enter') {
        e.preventDefault(); e.target.blur();
        moveSelection(e.shiftKey ? -1 : 1, 0);
      } else if (e.key === 'Tab') {
        e.preventDefault(); e.target.blur();
        moveSelection(0, e.shiftKey ? -1 : 1);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        e.preventDefault();
        if (e.shiftKey) {
          // Expandir seleção
          const current = state.selectionRange.end;
          const col = current.replace(/[0-9]/g, '').charCodeAt(0) - 65;
          const row = parseInt(current.replace(/[A-Z]/g, ''), 10);
          let nextId = current;
          if (e.key === 'ArrowUp') nextId = getColName(col) + Math.max(1, row - 1);
          if (e.key === 'ArrowDown') nextId = getColName(col) + Math.min(ROWS, row + 1);
          if (e.key === 'ArrowLeft') nextId = getColName(Math.max(0, col - 1)) + row;
          if (e.key === 'ArrowRight') nextId = getColName(Math.min(COLS - 1, col + 1)) + row;
          expandSelection(nextId);
          document.querySelector(`td[data-id="${nextId}"]`).scrollIntoView({ block: 'nearest' });
        } else {
          // Mover normalmente
          if (e.key === 'ArrowUp') moveSelection(-1, 0);
          if (e.key === 'ArrowDown') moveSelection(1, 0);
          if (e.key === 'ArrowLeft') moveSelection(0, -1);
          if (e.key === 'ArrowRight') moveSelection(0, 1);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
         if (!isEditing || e.target.textContent === '') { e.preventDefault(); clearSelection(); }
      }
    });

    tableBody.addEventListener('focusin', e => {
      if (e.target.tagName === 'DIV') {
        const cell = state.cells[e.target.dataset.id];
        if (cell) e.target.textContent = cell.raw;
      }
    });

    tableBody.addEventListener('blur', e => {
      if (e.target.tagName === 'DIV') {
        updateCellValue(e.target.dataset.id, e.target.textContent.trim());
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
       if (els.formulaInput.value !== (state.cells[state.activeCell]?.raw || '')) {
           updateCellValue(state.activeCell, els.formulaInput.value);
       }
    });

    // Formatação
    document.getElementById('btn-bold').addEventListener('click', () => applyStyle('bold'));
    document.getElementById('btn-italic').addEventListener('click', () => applyStyle('italic'));
    document.getElementById('btn-align-left').addEventListener('click', () => applyStyle('align', 'left'));
    document.getElementById('btn-align-center').addEventListener('click', () => applyStyle('align', 'center'));
    document.getElementById('btn-align-right').addEventListener('click', () => applyStyle('align', 'right'));
    document.getElementById('btn-clear-format').addEventListener('click', () => applyStyle('clear'));
    
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

    // Atalhos Globais e Resize
    window.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') { e.preventDefault(); saveFile(); }
        if (e.key === 'o') { e.preventDefault(); openFile(); }
        if (e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
      }
    });

    bindColResize();

  }

  function moveSelection(dRow, dCol) {
    let colIdx = state.activeCell.replace(/[0-9]/g, '').charCodeAt(0) - 65;
    let rowIdx = parseInt(state.activeCell.replace(/[A-Z]/g, ''), 10);
    colIdx = Math.max(0, Math.min(COLS - 1, colIdx + dCol));
    rowIdx = Math.max(1, Math.min(ROWS, rowIdx + dRow));
    setActiveCell(getColName(colIdx) + rowIdx);
  }

  function selectWholeCol(colIdx) {
    const startId = getColName(colIdx) + '1';
    const endId = getColName(colIdx) + ROWS;
    state.selectionRange = { start: startId, end: endId };
    state.activeCell = startId;
    updateSelectionUI();
    document.querySelectorAll(`th.col-header`).forEach(th => th.classList.toggle('active', parseInt(th.dataset.col) === colIdx));
  }

  function selectWholeRow(rowIdx) {
    const startId = 'A' + rowIdx;
    const endId = getColName(COLS - 1) + rowIdx;
    state.selectionRange = { start: startId, end: endId };
    state.activeCell = startId;
    updateSelectionUI();
    document.querySelectorAll(`th.row-header`).forEach(th => th.classList.toggle('active', parseInt(th.dataset.row) === rowIdx));
  }

  // ------------------------------------------------------------- Redimensionamento de Colunas

  function bindColResize() {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let targetCol = -1;

    document.getElementById('col-headers').addEventListener('mousedown', e => {
      if (e.offsetX > e.target.offsetWidth - 5) {
        isResizing = true;
        startX = e.clientX;
        startWidth = e.target.offsetWidth;
        targetCol = parseInt(e.target.dataset.col);
        e.target.style.cursor = 'col-resize';
      }
    });

    window.addEventListener('mousemove', e => {
      if (!isResizing) return;
      const width = Math.max(40, startWidth + (e.clientX - startX));
      state.colWidths[targetCol] = width;
      
      document.querySelectorAll(`td[data-col="${targetCol}"]`).forEach(td => {
        td.style.width = width + 'px'; td.style.minWidth = width + 'px';
      });
      document.querySelector(`th[data-col="${targetCol}"]`).style.width = width + 'px';
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.querySelectorAll('th').forEach(th => th.style.cursor = '');
      }
    });
  }

  // ------------------------------------------------------------- Formatação, Histórico, Ficheiros

  function applyStyle(key, val = true) {
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

        if (key === 'clear') {
          state.cells[id].style = {};
        } else if (key === 'bold' || key === 'italic') {
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

  function pushHistory() {
    if (state.historyIndex < state.history.length - 1) state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(JSON.stringify({ cells: state.cells, colWidths: state.colWidths }));
    if (state.history.length > 30) state.history.shift();
    state.historyIndex = state.history.length - 1;
    updateUndoRedoButtons();
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      const prev = JSON.parse(state.history[state.historyIndex]);
      state.cells = prev.cells;
      state.colWidths = prev.colWidths || {};
      renderAllCells();
      recalculateAll();
      markDirty();
      updateUndoRedoButtons();
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      const next = JSON.parse(state.history[state.historyIndex]);
      state.cells = next.cells;
      state.colWidths = next.colWidths || {};
      renderAllCells();
      recalculateAll();
      markDirty();
      updateUndoRedoButtons();
    }
  }

  function updateUndoRedoButtons() {
    document.getElementById('btn-undo').disabled = state.historyIndex <= 0;
    document.getElementById('btn-redo').disabled = state.historyIndex >= state.history.length - 1;
  }

  function markDirty() { state.revision++; state.dirty = true; updateWindowTitle(); scheduleDraft(); }
  
  function updateWindowTitle() {
    if (!window.os || !os.window) return;
    os.window.setTitle(`ExcelWebos - ${state.docName}${state.dirty ? ' *' : ''}`);
  }

  function setStatus(msg) { els.statusMsg.textContent = msg; }

  function documentSnapshot() {
    const cells = Object.fromEntries(Object.entries(state.cells).map(([id, cell]) => [id, { raw: cell.raw, style: cell.style || {} }]));
    return ExcelWebOSData.workbookSignature({ cells, colWidths: state.colWidths });
  }

  function markDirty() {
    state.revision++;
    state.dirty = documentSnapshot() !== state.savedSnapshot;
    updateWindowTitle();
    if (state.dirty) scheduleDraft();
    else if (window.os?.storage) os.storage.remove(draftStorageKey(state.path)).catch(() => {});
  }

  async function saveFile() {
    if (!window.os) return;
    let path = state.path;
    if (!path) {
      path = await os.dialog.save({ title: 'Guardar Folha', defaultName: 'folha.json', start: '/home/user/Documentos/' });
      if (!path) return;
      if (!path.endsWith('.json')) path += '.json';
    }
    const data = { format: 'webos-spreadsheet', version: 1, cells: state.cells, colWidths: state.colWidths };
    const serialized = JSON.stringify(data, null, 2);
    const savedSnapshot = documentSnapshot();
    const savedRevision = state.revision;
    try {
      await writeFileWithOverwrite(path, serialized, 'application/json');
      state.path = path;
      state.docName = path.split('/').pop();
      state.savedSnapshot = savedSnapshot;
      state.dirty = state.revision !== savedRevision || documentSnapshot() !== savedSnapshot;
      updateWindowTitle();
      setStatus('Guardado.');
      if (!state.dirty && window.os && os.storage) {
        await os.storage.remove(draftStorageKey(path));
        await os.storage.remove(DRAFT_KEY);
      } else if (state.dirty) scheduleDraft();
    } catch (err) { os.notify('Erro ao guardar: ' + err.message); }
  }

  async function openFile() {
    if (!window.os) return;
    if (state.dirty) {
      const discard = await os.dialog.confirm({
        title: 'Alterações por guardar',
        message: 'Queres descartar as alterações da folha atual?',
        okLabel: 'Descartar',
        danger: true,
      });
      if (!discard) return;
    }
    const path = await os.dialog.open({ title: 'Abrir Folha', start: '/home/user/Documentos/', filter: ['.json', '.csv'] });
    if (path) await loadPath(path);
  }

  async function loadPath(path) {
    try {
      const content = await os.fs.read(path);
      let nextCells;
      let nextColWidths = {};
      if (path.toLowerCase().endsWith('.csv')) {
        nextCells = parseCsv(typeof content === 'string' ? content : await content.text());
      } else {
        const text = typeof content === 'string' ? content : await content.text();
        const data = ExcelWebOSData.validateWorkbook(JSON.parse(text));
        nextCells = data.cells;
        nextColWidths = data.colWidths;
      }
      state.cells = nextCells;
      state.colWidths = nextColWidths;
      state.path = path; state.docName = path.split('/').pop();
      state.revision++;
      
      // Reconstruir a grelha (para aplicar as larguras das colunas)
      buildGrid();
      recalculateAll();
      state.savedSnapshot = documentSnapshot();
      state.dirty = false;
      setActiveCell('A1', false);
      state.history = [];
      state.historyIndex = -1;
      pushHistory(); updateWindowTitle(); setStatus('Aberto: ' + state.docName);
      if (window.os?.storage) {
        await os.storage.remove(draftStorageKey(path));
        await os.storage.remove(DRAFT_KEY);
      }
    } catch (err) { os.notify('Erro ao abrir: ' + err.message); }
  }

  async function exportCsv() {
    let path = await os.dialog.save({ title: 'Exportar CSV', defaultName: state.docName.replace('.json', '') + '.csv', start: '/home/user/Documentos/' });
    if (!path) return;
    if (!path.toLowerCase().endsWith('.csv')) path += '.csv';
    const rows = [];
    for (let r = 1; r <= ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const cell = state.cells[getColName(c) + r];
        row.push(cell ? cell.computed : '');
      }
      rows.push(row);
    }
    const csvContent = ExcelWebOSData.serializeCsv(rows);
    try { await writeFileWithOverwrite(path, csvContent, 'text/csv'); setStatus('CSV Exportado.'); } 
    catch (err) { os.notify('Erro ao exportar CSV.'); }
  }

  function parseCsv(text) {
    const cells = {};
    const rows = ExcelWebOSData.parseCsv(text);
    for (let r = 0; r < Math.min(rows.length, ROWS); r++) {
      for (let c = 0; c < Math.min(rows[r].length, COLS); c++) {
        const val = rows[r][c];
        if (val) cells[getColName(c) + (r + 1)] = { raw: val, computed: val, style: {} };
      }
    }
    return cells;
  }

  async function writeFileWithOverwrite(path, content, mime) {
    await os.fs.write(path, content, mime);
  }

  // ------------------------------------------------------------- Helpers

  function draftStorageKey(path = state.path) {
    return path ? `${DRAFT_KEY}:${encodeURIComponent(path)}` : DRAFT_KEY;
  }

  function scheduleDraft() {
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(async () => {
      state.saveTimer = null;
      if (!state.dirty) return;
      if (!window.os || !os.storage) return;
      const path = state.path;
      const key = draftStorageKey(path);
      const draft = { cells: state.cells, path, name: state.docName, colWidths: state.colWidths, revision: state.revision, savedSnapshot: state.savedSnapshot, updatedAt: Date.now() };
      try { await os.storage.set(key, draft); } catch (e) {}
    }, 1000);
  }

  async function restoreDraft(path = null) {
    if (!window.os || !os.storage) return false;
    try {
      const key = draftStorageKey(path);
      let draft = await os.storage.get(key);
      if (!draft && path) {
        const legacy = await os.storage.get(DRAFT_KEY);
        if (legacy?.path === path) draft = legacy;
      }
      if (draft && draft.cells && (!path || draft.path === path)) {
        state.cells = draft.cells; state.path = draft.path; state.docName = draft.name || 'Sem título';
        state.colWidths = draft.colWidths || {};
        state.dirty = true;
        state.revision = Number(draft.revision) || 0;
        state.savedSnapshot = typeof draft.savedSnapshot === 'string' ? draft.savedSnapshot : '';
        buildGrid(); recalculateAll(); updateWindowTitle(); setStatus('Rascunho restaurado.');
        return true;
      }
    } catch (e) {}
    return false;
  }

  function getColName(index) {
    let name = '';
    while (index >= 0) { name = String.fromCharCode((index % 26) + 65) + name; index = Math.floor(index / 26) - 1; }
    return name;
  }

})();