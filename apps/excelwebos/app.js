(function () {
  'use strict';

  const COLS = 15; // A a O
  const ROWS = 50;
  const DRAFT_KEY = 'excel_draft';

  // Estado da aplicação
  const state = {
    cells: {}, // Formato: { "A1": { raw: "=B1", computed: "10", style: {...} } }
    activeCell: 'A1',
    path: null,
    docName: 'Sem título',
    dirty: false,
    saveTimer: null
  };

  const els = {};
  let tableBody;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheElements();
    buildGrid();
    bindEvents();
    await restoreDraft();
    if (!state.path) setStatus('Novo documento');
    updateWindowTitle();
  }

  function cacheElements() {
    els.formulaInput = document.getElementById('formula-input');
    els.cellAddress = document.getElementById('cell-address');
    els.statusMsg = document.getElementById('status-message');
    els.statusCoords = document.getElementById('status-coords');
    els.colorPicker = document.getElementById('color-picker');
    els.colorPreview = document.getElementById('color-preview');
    tableBody = document.getElementById('sheet-body');
  }

  // ------------------------------------------------------------- Grelha

  function buildGrid() {
    const colHeaders = document.getElementById('col-headers');
    colHeaders.innerHTML = '<th class="corner"></th>';

    // Cabeçalhos de Coluna
    for (let c = 0; c < COLS; c++) {
      const th = document.createElement('th');
      th.textContent = getColName(c);
      colHeaders.appendChild(th);
    }

    // Linhas
    tableBody.innerHTML = '';
    for (let r = 1; r <= ROWS; r++) {
      const tr = document.createElement('tr');
      
      // Cabeçalho da Linha
      const rowHeader = document.createElement('th');
      rowHeader.className = 'row-header';
      rowHeader.textContent = r;
      tr.appendChild(rowHeader);

      // Células
      for (let c = 0; c < COLS; c++) {
        const td = document.createElement('td');
        const id = getColName(c) + r;
        td.dataset.id = id;

        const div = document.createElement('div');
        div.contentEditable = 'true';
        div.dataset.id = id;
        // Para evitar que o browser insira tags HTML ao colar
        div.addEventListener('paste', e => {
          e.preventDefault();
          const text = (e.clipboardData || window.clipboardData).getData('text/plain');
          document.execCommand('insertText', false, text);
        });

        td.appendChild(div);
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    }

    // Aplicar estado aos inputs (se houver draft)
    renderAllCells();
  }

  function renderAllCells() {
    for (const id in state.cells) {
      renderCell(id);
    }
    setActiveCell(state.activeCell, false);
  }

  // ------------------------------------------------------------- Cálculos

  function evaluateFormula(rawStr) {
    if (typeof rawStr !== 'string' || !rawStr.startsWith('=')) {
      return { computed: rawStr, isError: false };
    }

    let expr = rawStr.substring(1).toUpperCase();

    // Substituir referências (A1, B10) pelos seus valores computados
    const cellRegex = /[A-Z]+[0-9]+/g;
    expr = expr.replace(cellRegex, (match) => {
      const cell = state.cells[match];
      if (!cell) return '0';
      const val = cell.computed;
      const num = parseFloat(val);
      return isNaN(num) ? '0' : num.toString();
    });

    // Validação de segurança: apenas números, operadores e parênteses
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
      return { computed: '#ERRO!', isError: true };
    }

    try {
      // Math evaluation segura
      const result = new Function('return ' + expr)();
      if (result === Infinity || result === -Infinity || isNaN(result)) {
        return { computed: '#ERRO!', isError: true };
      }
      // Arredondar dízimas
      const rounded = Math.round(result * 1000000) / 1000000;
      return { computed: rounded.toString(), isError: false };
    } catch (e) {
      return { computed: '#ERRO!', isError: true };
    }
  }

  function updateCellValue(id, rawValue) {
    if (!state.cells[id]) state.cells[id] = { raw: '', computed: '', style: {} };
    
    state.cells[id].raw = rawValue;
    const result = evaluateFormula(rawValue);
    state.cells[id].computed = result.computed;
    state.cells[id].isError = result.isError;

    renderCell(id);
    markDirty();

    // Se a célula atualizada for a ativa, atualiza o input superior
    if (id === state.activeCell) {
      els.formulaInput.value = rawValue;
    }
  }

  function renderCell(id) {
    const cellEl = document.querySelector(`td[data-id="${id}"] div`);
    if (!cellEl) return;

    const cellData = state.cells[id];
    if (!cellData) {
      cellEl.textContent = '';
      cellEl.className = '';
      return;
    }

    // Mostrar o valor computado, exceto se a célula estiver em edição
    // (Para simplificar, mostramos sempre o computado. Excel mostra raw ao editar).
    cellEl.textContent = cellData.computed;
    
    // Aplicar classes de estilo e erro
    let classes = [];
    if (cellData.isError) classes.push('error');
    if (cellData.style) {
      if (cellData.style.bold) classes.push('bold');
      if (cellData.style.italic) classes.push('italic');
      if (cellData.style.align) classes.push('align-' + cellData.style.align);
    }
    cellEl.className = classes.join(' ');
    
    if (cellData.style && cellData.style.color) {
      cellEl.style.color = cellData.style.color;
    } else {
      cellEl.style.color = '';
    }
  }

  // ------------------------------------------------------------- Navegação

  function setActiveCell(id, focusGrid = true) {
    // Remover destaque antigo
    const oldActive = document.querySelector('td.active');
    if (oldActive) oldActive.classList.remove('active');

    state.activeCell = id;
    els.cellAddress.textContent = id;
    els.statusCoords.textContent = 'Célula: ' + id;

    // Destacar nova célula
    const td = document.querySelector(`td[data-id="${id}"]`);
    if (td) {
      td.classList.add('active');
      const input = td.querySelector('div');
      if (focusGrid) {
        input.focus();
      }
    }

    // Atualizar formula bar
    const cell = state.cells[id];
    els.formulaInput.value = cell ? cell.raw : '';
    
    // Atualizar estado dos botões de formatação
    updateToolbarState();
  }

  function moveSelection(dRow, dCol) {
    const colStr = state.activeCell.replace(/[0-9]/g, '');
    const rowStr = state.activeCell.replace(/[A-Z]/g, '');
    
    let colIdx = colStr.charCodeAt(0) - 65; // 'A' = 0
    let rowIdx = parseInt(rowStr, 10);

    colIdx = Math.max(0, Math.min(COLS - 1, colIdx + dCol));
    rowIdx = Math.max(1, Math.min(ROWS, rowIdx + dRow));

    const newId = getColName(colIdx) + rowIdx;
    setActiveCell(newId);
  }

  // ------------------------------------------------------------- Eventos

  function bindEvents() {
    // Cliques na grelha
    tableBody.addEventListener('click', e => {
      const td = e.target.closest('td');
      if (td && td.dataset.id) setActiveCell(td.dataset.id);
    });

    // Navegação por teclado dentro das células
    tableBody.addEventListener('keydown', e => {
      const isEditing = e.target.isContentEditable && document.activeElement === e.target;

      if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur(); // Confirma a edição
        moveSelection(1, 0);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.target.blur();
        moveSelection(0, e.shiftKey ? -1 : 1);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditing) {
        // Se não estiver a editar, as setas movem a seleção
        e.preventDefault();
        if (e.key === 'ArrowUp') moveSelection(-1, 0);
        if (e.key === 'ArrowDown') moveSelection(1, 0);
        if (e.key === 'ArrowLeft') moveSelection(0, -1);
        if (e.key === 'ArrowRight') moveSelection(0, 1);
      }
    });

    // Atualização do valor (ao sair da célula)
    tableBody.addEventListener('blur', e => {
      if (e.target.tagName === 'DIV' && e.target.dataset.id) {
        const id = e.target.dataset.id;
        const newValue = e.target.textContent.trim();
        const currentRaw = state.cells[id] ? state.cells[id].raw : '';
        
        // Só atualiza se o texto visível for diferente da raw (ou seja, o user editou)
        if (newValue !== currentRaw) {
          updateCellValue(id, newValue);
        } else {
          // Repõe o valor computado visualmente (caso tenha apagado e reescrito igual)
          renderCell(id);
        }
      }
    }, true);

    // Atualização do valor em tempo real via Formula Bar
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

    // Formatação
    document.getElementById('btn-bold').addEventListener('click', () => applyStyle('bold'));
    document.getElementById('btn-italic').addEventListener('click', () => applyStyle('italic'));
    document.getElementById('btn-align-left').addEventListener('click', () => applyStyle('align', 'left'));
    document.getElementById('btn-align-center').addEventListener('click', () => applyStyle('align', 'center'));
    document.getElementById('btn-align-right').addEventListener('click', () => applyStyle('align', 'right'));

    // Cor
    document.getElementById('btn-color').addEventListener('click', () => els.colorPicker.click());
    els.colorPicker.addEventListener('input', () => {
      els.colorPreview.style.background = els.colorPicker.value;
      applyStyle('color', els.colorPicker.value);
    });

    // Ficheiros
    document.getElementById('btn-open').addEventListener('click', openFile);
    document.getElementById('btn-save').addEventListener('click', saveFile);
    document.getElementById('btn-export-csv').addEventListener('click', exportCsv);

    // Atalhos Globais
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') { e.preventDefault(); saveFile(); }
        if (e.key === 'o') { e.preventDefault(); openFile(); }
      }
    });

    // Carregar argumentos (se aberto pelo explorer)
    if (window.os && os.args) {
      os.args().then(args => {
        if (args && args.path) loadPath(args.path);
      }).catch(()=>{});
    }
  }

  // ------------------------------------------------------------- Formatação

  function applyStyle(key, val = true) {
    const id = state.activeCell;
    if (!state.cells[id]) state.cells[id] = { raw: '', computed: '', style: {} };
    if (!state.cells[id].style) state.cells[id].style = {};

    // Toggle para bold/italic
    if (key === 'bold' || key === 'italic') {
      state.cells[id].style[key] = !state.cells[id].style[key];
    } else {
      state.cells[id].style[key] = val;
    }

    renderCell(id);
    updateToolbarState();
    markDirty();
  }

  function updateToolbarState() {
    const style = state.cells[state.activeCell]?.style || {};
    document.getElementById('btn-bold').setAttribute('aria-pressed', style.bold ? 'true' : 'false');
    document.getElementById('btn-italic').setAttribute('aria-pressed', style.italic ? 'true' : 'false');
    
    if (style.color) {
      els.colorPreview.style.background = style.color;
      els.colorPicker.value = style.color;
    } else {
      els.colorPreview.style.background = '#000000';
      els.colorPicker.value = '#000000';
    }
  }

  // ------------------------------------------------------------- Ficheiros

  function markDirty() {
    state.dirty = true;
    updateWindowTitle();
    scheduleDraft();
  }

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
      
      // Limpar a grelha visualmente e recarregar
      document.querySelectorAll('td div').forEach(div => { div.textContent = ''; div.className = ''; div.style.color = ''; });
      renderAllCells();
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
        // Escapar aspas duplas e adicionar aspas se contiver vírgulas ou quebras de linha
        val = String(val).replace(/"/g, '""');
        if (val.includes(',') || val.includes('\n') || val.includes('"')) {
          val = `"${val}"`;
        }
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
    let maxR = Math.min(lines.length, ROWS);
    for (let r = 0; r < maxR; r++) {
      if (!lines[r]) continue;
      // Split simples por vírgula (não suporta vírgulas dentro de aspas por simplificação)
      const cols = lines[r].split(',');
      for (let c = 0; c < Math.min(cols.length, COLS); c++) {
        let val = cols[c].trim();
        // Remover aspas externas
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1).replace(/""/g, '"');
        }
        if (val) {
          const id = getColName(c) + (r + 1);
          state.cells[id] = { raw: val, computed: val, style: {} };
        }
      }
    }
  }

  // ------------------------------------------------------------- Draft & Helpers

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
    // 0 = A, 1 = B, ..., 25 = Z, 26 = AA
    let name = '';
    while (index >= 0) {
      name = String.fromCharCode((index % 26) + 65) + name;
      index = Math.floor(index / 26) - 1;
    }
    return name;
  }

})();