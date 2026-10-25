const SudokuLogic = (() => {
  const isSafe = (board, row, col, num) => {
    for (let index = 0; index < 9; index++) {
      if ((index !== col && board[row][index] === num) || (index !== row && board[index][col] === num)) return false;
    }
    const startRow = row - row % 3;
    const startCol = col - col % 3;
    for (let r = startRow; r < startRow + 3; r++) {
      for (let c = startCol; c < startCol + 3; c++) {
        if ((r !== row || c !== col) && board[r][c] === num) return false;
      }
    }
    return true;
  };
  return { isSafe };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SudokuLogic;

if (typeof document !== 'undefined') {
(function () {
  'use strict';

  const state = {
    board: [],
    solution: [],
    initial: [],
    selectedCell: null,
    isGameOver: false,
    startTime: null,
    timerInterval: null,
    elapsedSeconds: 0,
    hasUserAction: false,
    notes: [],
    notesMode: false,
    mistakes: 0
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    startNewGame();
  }

  function cacheElements() {
    els.board = document.getElementById('board');
    els.numpad = document.getElementById('numpad');
    els.timer = document.getElementById('timer');
    els.difficulty = document.getElementById('difficulty-select');
    els.btnNew = document.getElementById('btn-new');
    els.winOverlay = document.getElementById('win-overlay');
    els.winTime = document.getElementById('win-time');
    els.btnPlayAgain = document.getElementById('btn-play-again');
    els.btnNotes = document.getElementById('btn-notes');
    els.btnHint = document.getElementById('btn-hint');
    els.mistakes = document.getElementById('mistakes');
    els.gameStatus = document.getElementById('game-status');
  }

  function bindEvents() {
    els.btnNew.addEventListener('click', startNewGame);
    els.btnPlayAgain.addEventListener('click', startNewGame);
    els.btnNotes.addEventListener('click', toggleNotesMode);
    els.btnHint.addEventListener('click', revealHint);

    els.board.addEventListener('click', e => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const row = parseInt(cell.dataset.row, 10);
      const col = parseInt(cell.dataset.col, 10);
      selectCell(row, col);
    });

    els.numpad.addEventListener('click', e => {
      const btn = e.target.closest('.num-btn');
      if (!btn) return;
      const num = parseInt(btn.dataset.num, 10);
      inputNumber(num);
    });

    document.addEventListener('keydown', e => {
      if (state.isGameOver) return;
      const key = e.key;
      if (key.toLowerCase() === 'n') { toggleNotesMode(); return; }
      if (key.toLowerCase() === 'h') { revealHint(); return; }
      if (!state.selectedCell) return;

      if (key >= '1' && key <= '9') {
        inputNumber(parseInt(key, 10));
      } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
        inputNumber(0);
      } else if (key === 'ArrowUp') {
        e.preventDefault(); moveSelection(-1, 0);
      } else if (key === 'ArrowDown') {
        e.preventDefault(); moveSelection(1, 0);
      } else if (key === 'ArrowLeft') {
        e.preventDefault(); moveSelection(0, -1);
      } else if (key === 'ArrowRight') {
        e.preventDefault(); moveSelection(0, 1);
      }
    });
  }

  // ---------------------------------------------------------------- Geração

  function generateSudoku() {
    const board = Array(9).fill().map(() => Array(9).fill(0));
    fillBoard(board);
    return board;
  }

  function fillBoard(board) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of nums) {
            if (isSafe(board, row, col, num)) {
              board[row][col] = num;
              if (fillBoard(board)) return true;
              board[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  function isSafe(board, row, col, num) {
    return SudokuLogic.isSafe(board, row, col, num);
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function createPuzzle(solution, difficulty) {
    const puzzle = solution.map(row => [...row]);

    let cellsToRemove;
    if (difficulty === 'easy') cellsToRemove = 40;
    else if (difficulty === 'hard') cellsToRemove = 55;
    else cellsToRemove = 48;

    let attempts = cellsToRemove;
    while (attempts > 0) {
      const row = Math.floor(Math.random() * 9);
      const col = Math.floor(Math.random() * 9);
      if (puzzle[row][col] !== 0) {
        puzzle[row][col] = 0;
        attempts--;
      }
    }
    return puzzle;
  }

  // ---------------------------------------------------------------- Fluxo

  function startNewGame() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    const difficulty = els.difficulty.value;
    state.solution = generateSudoku();
    state.initial = createPuzzle(state.solution, difficulty);
    state.board = state.initial.map(row => [...row]);

    state.selectedCell = null;
    state.isGameOver = false;
    state.hasUserAction = false;
    state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    state.notesMode = false;
    state.mistakes = 0;
    state.elapsedSeconds = 0;
    state.startTime = Date.now();

    els.winOverlay.hidden = true;
    updateTimerDisplay();
    updateGameStatus();

    state.timerInterval = setInterval(() => {
      state.elapsedSeconds++;
      updateTimerDisplay();
    }, 1000);

    renderBoard();
    updateHighlights();
  }

  function updateTimerDisplay() {
    const mins = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(state.elapsedSeconds % 60).padStart(2, '0');
    els.timer.textContent = `${mins}:${secs}`;
  }

  // ---------------------------------------------------------------- Interação

  function selectCell(row, col) {
    if (state.isGameOver) return;
    state.selectedCell = { row, col };
    updateHighlights();
  }

  function moveSelection(dRow, dCol) {
    if (!state.selectedCell) return;
    let r = state.selectedCell.row + dRow;
    let c = state.selectedCell.col + dCol;
    r = Math.max(0, Math.min(8, r));
    c = Math.max(0, Math.min(8, c));
    selectCell(r, c);
  }

  function inputNumber(num) {
    if (state.isGameOver || !state.selectedCell) return;
    const { row, col } = state.selectedCell;
    if (state.initial[row][col] !== 0) return;

    if (state.notesMode && num !== 0) {
      const notes = state.notes[row][col];
      if (notes.has(num)) notes.delete(num);
      else notes.add(num);
      state.hasUserAction = true;
      renderBoard();
      updateHighlights();
      return;
    }

    if (num > 0 && state.board[row][col] !== num && num !== state.solution[row][col]) state.mistakes++;
    state.board[row][col] = num;
    state.notes[row][col].clear();
    state.hasUserAction = true;

    renderBoard();
    updateHighlights();
    updateGameStatus();
    checkWinCondition();
  }

  function toggleNotesMode() {
    state.notesMode = !state.notesMode;
    els.btnNotes.setAttribute('aria-pressed', String(state.notesMode));
    els.btnNotes.classList.toggle('active', state.notesMode);
    els.btnNotes.textContent = state.notesMode ? 'Notas: ligadas' : 'Notas: desligadas';
  }

  function revealHint() {
    if (state.isGameOver) return;
    if (!state.selectedCell) {
      els.gameStatus.textContent = 'Seleciona primeiro uma célula vazia.';
      return;
    }
    const { row, col } = state.selectedCell;
    if (state.initial[row][col] !== 0) {
      els.gameStatus.textContent = 'Escolhe uma célula que não esteja fixa.';
      return;
    }
    state.board[row][col] = state.solution[row][col];
    state.notes[row][col].clear();
    state.hasUserAction = true;
    els.gameStatus.textContent = 'Dica preenchida.';
    renderBoard();
    updateHighlights();
    checkWinCondition();
  }

  function updateGameStatus() {
    els.mistakes.textContent = `Erros: ${state.mistakes}`;
  }

  // ---------------------------------------------------------------- Render

  function renderBoard() {
    if (els.board.children.length === 0) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.row = r;
          cell.dataset.col = c;
          cell.setAttribute('role', 'gridcell');
          const value = document.createElement('span');
          value.className = 'cell-value';
          const notes = document.createElement('span');
          notes.className = 'cell-notes';
          cell.append(value, notes);
          els.board.appendChild(cell);
        }
      }
    }

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = els.board.children[r * 9 + c];
        const val = state.board[r][c];
        cell.querySelector('.cell-value').textContent = val > 0 ? val : '';
        const noteGrid = cell.querySelector('.cell-notes');
        noteGrid.replaceChildren();
        if (val === 0) {
          for (let note = 1; note <= 9; note++) {
            const noteEl = document.createElement('span');
            noteEl.textContent = state.notes[r][c].has(note) ? note : '';
            noteGrid.append(noteEl);
          }
        }

        if (state.initial[r][c] !== 0) cell.classList.add('fixed');
        else cell.classList.remove('fixed');

        if (val > 0 && state.initial[r][c] === 0 && (val !== state.solution[r][c] || !isSafe(state.board, r, c, val))) {
          cell.classList.add('error');
        } else {
          cell.classList.remove('error');
        }
      }
    }
  }

  function updateHighlights() {
    const cells = els.board.children;
    for (let i = 0; i < cells.length; i++) {
      cells[i].classList.remove('selected', 'highlighted', 'same-number');
    }

    if (!state.selectedCell) return;
    const { row: selR, col: selC } = state.selectedCell;
    const selectedValue = state.board[selR][selC];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = cells[r * 9 + c];
        const val = state.board[r][c];

        if (r === selR && c === selC) {
          cell.classList.add('selected');
        } else if (
          r === selR ||
          c === selC ||
          (Math.floor(r / 3) === Math.floor(selR / 3) &&
           Math.floor(c / 3) === Math.floor(selC / 3))
        ) {
          cell.classList.add('highlighted');
        }

        if (selectedValue > 0 && val === selectedValue && !(r === selR && c === selC)) {
          cell.classList.add('same-number');
        }
      }
    }
  }

  // ---------------------------------------------------------------- Vitória

  function checkWinCondition() {
    if (!state.hasUserAction) return; // Nunca ganha sem ação do utilizador

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.board[r][c] !== state.solution[r][c]) return;
      }
    }

    state.isGameOver = true;
    clearInterval(state.timerInterval);
    els.winTime.textContent = els.timer.textContent;
    els.winOverlay.hidden = false;

    if (window.os && os.notify) {
      os.notify('Parabéns! Resolveste o Sudoku.');
    }
  }
})();
}