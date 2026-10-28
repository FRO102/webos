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
  function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function copyBoard(board) { return board.map(row => [...row]); }
  const solve = (board, randomize = false) => {
    const b = copyBoard(board);
    function candidates(r, c) {
      const out = [];
      for (let n = 1; n <= 9; n++) if (isSafe(b, r, c, n)) out.push(n);
      return randomize ? shuffle(out) : out;
    }
    function backtrack() {
      let best = null, bestCands = null;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (b[r][c] !== 0) continue;
          const cands = candidates(r, c);
          if (!bestCands || cands.length < bestCands.length) {
            best = { r, c }; bestCands = cands;
            if (cands.length <= 1) break;
          }
        }
        if (bestCands && bestCands.length <= 1) break;
      }
      if (!best) return copyBoard(b);
      if (!bestCands || bestCands.length === 0) return null;
      for (const num of bestCands) {
        b[best.r][best.c] = num;
        const res = backtrack();
        if (res) return res;
        b[best.r][best.c] = 0;
      }
      return null;
    }
    return backtrack();
  };
  const countSolutions = (board, limit = 2) => {
    const b = copyBoard(board);
    let count = 0;
    function findEmpty() {
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (b[r][c] === 0) return { r, c };
      return null;
    }
    function backtrack() {
      if (count >= limit) return;
      const target = findEmpty();
      if (!target) { count++; return; }
      const { r, c } = target;
      for (let num = 1; num <= 9; num++) {
        if (!isSafe(b, r, c, num)) continue;
        b[r][c] = num;
        backtrack();
        b[r][c] = 0;
        if (count >= limit) return;
      }
    }
    backtrack();
    return count;
  };
  const generateSolution = () => {
    const board = Array(9).fill().map(() => Array(9).fill(0));
    const firstRow = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let c = 0; c < 9; c++) board[0][c] = firstRow[c];
    const sol = solve(board, true);
    if (sol) return sol;
    return solve(Array(9).fill().map(() => Array(9).fill(0)), true);
  };
  const createPuzzle = (solution, difficulty) => {
    const targets = { easy: 36, medium: 46, hard: 52, expert: 60 };
    const removalsTarget = targets[difficulty] ?? 46;
    const puzzle = copyBoard(solution);
    const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
    let removed = 0;
    for (const pos of positions) {
      if (removed >= removalsTarget) break;
      const r = Math.floor(pos / 9);
      const c = pos % 9;
      if (puzzle[r][c] === 0) continue;
      const backup = puzzle[r][c];
      puzzle[r][c] = 0;
      if (countSolutions(puzzle) !== 1) { puzzle[r][c] = backup; continue; }
      removed++;
    }
    return puzzle;
  };
  const isComplete = (board, solution) => {
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (board[r][c] !== solution[r][c]) return false;
    return true;
  };
  return { isSafe, solve, countSolutions, generateSolution, createPuzzle, isComplete };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SudokuLogic;

if (typeof document !== 'undefined') {
(function () {
  'use strict';

  const DIFFICULTY_CONFIG = {
    easy: { maxMistakes: 5, maxHints: 3 },
    medium: { maxMistakes: 3, maxHints: 3 },
    hard: { maxMistakes: 3, maxHints: 3 }
  };

  const state = {
    board: [],
    solution: [],
    initial: [],
    selectedCell: null,
    isGameOver: false,
    gameResult: null,
    startTime: null,
    timerInterval: null,
    elapsedSeconds: 0,
    hasUserAction: false,
    notes: [],
    notesMode: false,
    mistakes: 0,
    maxMistakes: 3,
    hintsUsed: 0,
    maxHints: 3,
    paused: false,
    history: [],
    redo: [],
    difficulty: 'medium',
    bestTimes: {}
  };

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    bootstrap();
  }

  async function bootstrap() {
    state.bestTimes = await loadBestTimes();
    const restored = await loadGame();
    if (!restored) {
      startNewGame();
    } else {
      renderBoard();
      updateHighlights();
      updateTimerDisplay();
      updateGameStatus();
      updateBestTimeDisplay();
      updateUndoRedoButtons();
      if (state.isGameOver) showGameOverOverlay();
    }
  }

  function cacheElements() {
    els.board = document.getElementById('board');
    els.numpad = document.getElementById('numpad');
    els.timer = document.getElementById('timer');
    els.difficulty = document.getElementById('difficulty-select');
    els.btnNew = document.getElementById('btn-new');
    els.winOverlay = document.getElementById('win-overlay');
    els.loseOverlay = document.getElementById('lose-overlay');
    els.winTime = document.getElementById('win-time');
    els.loseTime = document.getElementById('lose-time');
    els.btnPlayAgain = document.getElementById('btn-play-again');
    els.btnTryAgain = document.getElementById('btn-try-again');
    els.btnNotes = document.getElementById('btn-notes');
    els.btnHint = document.getElementById('btn-hint');
    els.btnUndo = document.getElementById('btn-undo');
    els.btnRedo = document.getElementById('btn-redo');
    els.btnRestart = document.getElementById('btn-restart');
    els.btnPause = document.getElementById('btn-pause');
    els.mistakes = document.getElementById('mistakes');
    els.hints = document.getElementById('hints');
    els.bestTime = document.getElementById('best-time');
    els.gameStatus = document.getElementById('game-status');
  }

  function bindEvents() {
    els.btnNew.addEventListener('click', startNewGame);
    if (els.btnPlayAgain) els.btnPlayAgain.addEventListener('click', startNewGame);
    if (els.btnTryAgain) els.btnTryAgain.addEventListener('click', startNewGame);
    els.btnNotes.addEventListener('click', toggleNotesMode);
    els.btnHint.addEventListener('click', revealHint);
    if (els.btnUndo) els.btnUndo.addEventListener('click', undo);
    if (els.btnRedo) els.btnRedo.addEventListener('click', redo);
    if (els.btnRestart) els.btnRestart.addEventListener('click', restartBoard);
    if (els.btnPause) els.btnPause.addEventListener('click', togglePause);

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
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (state.isGameOver) return;
      if (state.paused) {
        if (e.key.toLowerCase() === 'p') togglePause();
        return;
      }
      const key = e.key;
      if (key.toLowerCase() === 'n') { toggleNotesMode(); return; }
      if (key.toLowerCase() === 'h') { revealHint(); return; }
      if (key.toLowerCase() === 'p') { togglePause(); return; }
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

    els.difficulty.addEventListener('change', startNewGame);

    document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
    window.addEventListener('beforeunload', saveGame);
  }

  // ---------------------------------------------------------------- Geração

  function generateSudoku() {
    return SudokuLogic.generateSolution();
  }

  function createPuzzle(solution, difficulty) {
    return SudokuLogic.createPuzzle(solution, difficulty);
  }

  function applyDifficultyConfig(diff) {
    const cfg = DIFFICULTY_CONFIG[diff] || DIFFICULTY_CONFIG.medium;
    state.maxMistakes = cfg.maxMistakes;
    state.maxHints = cfg.maxHints;
  }

  function storageAvailable() { return !!(window.os && os.storage && typeof os.storage.get === 'function'); }

  async function loadGame() {
    if (!storageAvailable()) return false;
    try {
      const data = await os.storage.get('sudoku:game');
      if (!data || !data.solution || !data.initial) return false;
      state.difficulty = data.difficulty || els.difficulty.value;
      els.difficulty.value = state.difficulty;
      state.solution = data.solution;
      state.initial = data.initial;
      state.board = data.board || data.initial.map(r => [...r]);
      state.notes = (data.notes && data.notes.length) ? deserializeNotes(data.notes) : Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
      state.mistakes = data.mistakes || 0;
      state.elapsedSeconds = data.elapsedSeconds || 0;
      state.hasUserAction = !!data.hasUserAction;
      state.hintsUsed = data.hintsUsed || 0;
      state.paused = false;
      state.gameResult = data.gameResult || null;
      state.isGameOver = !!data.isGameOver;
      state.startTime = Date.now() - state.elapsedSeconds * 1000;
      applyDifficultyConfig(state.difficulty);
      state.history = [];
      state.redo = [];
      state.selectedCell = null;
      if (!state.isGameOver) startTimerFromElapsed();
      return true;
    } catch (e) { return false; }
  }

  async function saveGame() {
    if (!storageAvailable()) return;
    try {
      const data = {
        difficulty: els.difficulty.value,
        solution: state.solution,
        initial: state.initial,
        board: state.board,
        notes: serializeNotes(),
        mistakes: state.mistakes,
        elapsedSeconds: state.elapsedSeconds,
        hasUserAction: state.hasUserAction,
        hintsUsed: state.hintsUsed,
        isGameOver: state.isGameOver,
        gameResult: state.gameResult
      };
      await os.storage.set('sudoku:game', data);
    } catch (e) {}
  }

  async function loadBestTimes() {
    if (!storageAvailable()) return {};
    try { return (await os.storage.get('sudoku:best')) || {}; } catch (e) { return {}; }
  }

  async function saveBestTimes() {
    if (!storageAvailable()) return;
    try { await os.storage.set('sudoku:best', state.bestTimes || {}); } catch (e) {}
  }

  function serializeNotes() {
    return state.notes.map(row => row.map(s => [...s]));
  }

  function deserializeNotes(data) {
    return data.map(row => row.map(arr => new Set(arr || [])));
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
    state.timerInterval = null;

    const difficulty = els.difficulty.value;
    applyDifficultyConfig(difficulty);
    state.solution = SudokuLogic.generateSolution();
    state.initial = SudokuLogic.createPuzzle(state.solution, difficulty);
    state.board = state.initial.map(row => [...row]);

    state.selectedCell = null;
    state.isGameOver = false;
    state.gameResult = null;
    state.hasUserAction = false;
    state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    state.notesMode = false;
    state.mistakes = 0;
    state.hintsUsed = 0;
    state.elapsedSeconds = 0;
    state.startTime = Date.now();
    state.paused = false;
    state.history = [];
    state.redo = [];
    state.difficulty = difficulty;

    if (els.winOverlay) els.winOverlay.hidden = true;
    if (els.loseOverlay) els.loseOverlay.hidden = true;
    updateTimerDisplay();
    updateGameStatus();
    updateHintsDisplay();
    updateBestTimeDisplay();

    state.timerInterval = setInterval(tickTimer, 1000);

    renderBoard();
    updateHighlights();
    updateUndoRedoButtons();
    saveGame();
  }

  function tickTimer() {
    if (state.paused || state.isGameOver) return;
    state.elapsedSeconds++;
    updateTimerDisplay();
    if (state.elapsedSeconds % 10 === 0) saveGame();
  }

  function startTimerFromElapsed() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.startTime = Date.now() - state.elapsedSeconds * 1000;
    state.timerInterval = setInterval(tickTimer, 1000);
  }

  function updateTimerDisplay() {
    const mins = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(state.elapsedSeconds % 60).padStart(2, '0');
    els.timer.textContent = mins + ':' + secs;
  }

  // ---------------------------------------------------------------- Interação

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return m + ':' + s;
  }

  function toggleNotesVisual(on) {
    state.notesMode = on;
    if (els.btnNotes) {
      els.btnNotes.setAttribute('aria-pressed', String(state.notesMode));
      els.btnNotes.classList.toggle('active', state.notesMode);
      els.btnNotes.textContent = state.notesMode ? 'Notas: ligadas' : 'Notas: desligadas';
    }
  }

  function toggleNotesMode() {
    toggleNotesVisual(!state.notesMode);
  }

  function selectCell(row, col) {
    if (state.isGameOver || state.paused) return;
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

  function snapshot(row, col) {
    return { value: state.board[row][col], notes: new Set(state.notes[row][col]), mistakes: state.mistakes, hints: state.hintsUsed };
  }

  function applySnapshot(row, col, snap) {
    state.board[row][col] = snap.value;
    state.notes[row][col] = new Set(snap.notes);
    state.mistakes = snap.mistakes;
    state.hintsUsed = snap.hints;
  }

  function pushHistory(entry) {
    state.history.push(entry);
    if (state.history.length > 50) state.history.shift();
    state.redo = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (state.isGameOver || state.paused) return;
    if (state.history.length === 0) return;
    const op = state.history.pop();
    state.redo.push(op);
    applySnapshot(op.row, op.col, op.before);
    renderBoard();
    updateHighlights();
    updateGameStatus();
    updateHintsDisplay();
    updateUndoRedoButtons();
    saveGame();
  }

  function redo() {
    if (state.isGameOver || state.paused) return;
    if (state.redo.length === 0) return;
    const op = state.redo.pop();
    state.history.push(op);
    applySnapshot(op.row, op.col, op.after);
    renderBoard();
    updateHighlights();
    updateGameStatus();
    updateHintsDisplay();
    updateUndoRedoButtons();
    saveGame();
  }

  function updateUndoRedoButtons() {
    if (els.btnUndo) els.btnUndo.disabled = state.history.length === 0;
    if (els.btnRedo) els.btnRedo.disabled = state.redo.length === 0;
  }

  function removeCandidateFromPeers(num, row, col) {
    for (let c = 0; c < 9; c++) {
      if (c !== col && state.board[row][c] === 0) state.notes[row][c].delete(num);
    }
    for (let r = 0; r < 9; r++) {
      if (r !== row && state.board[r][col] === 0) state.notes[r][col].delete(num);
    }
    const sr = row - row % 3, sc = col - col % 3;
    for (let r = sr; r < sr + 3; r++) {
      for (let c = sc; c < sc + 3; c++) {
        if ((r !== row || c !== col) && state.board[r][c] === 0) state.notes[r][c].delete(num);
      }
    }
  }



  // ---------------------------------------------------------------- Interação

  function inputNumber(num) {
    if (state.isGameOver || state.paused || !state.selectedCell) return;
    const { row, col } = state.selectedCell;
    if (state.initial[row][col] !== 0) return;
    const before = snapshot(row, col);
    if (state.notesMode && num !== 0) {
      const notes = state.notes[row][col];
      if (notes.has(num)) notes.delete(num);
      else notes.add(num);
      state.hasUserAction = true;
      const after = snapshot(row, col);
      pushHistory({ row, col, before, after });
      renderBoard(); updateHighlights(); saveGame(); return;
    }
    const prevValue = state.board[row][col];
    if (num > 0 && prevValue !== num && num !== state.solution[row][col]) state.mistakes++;
    state.board[row][col] = num;
    state.notes[row][col].clear();
    if (num > 0 && num === state.solution[row][col]) removeCandidateFromPeers(num, row, col);
    state.hasUserAction = true;
    const after = snapshot(row, col);
    pushHistory({ row, col, before, after });
    renderBoard(); updateHighlights(); updateGameStatus();
    checkMistakeLimit(); checkWinCondition(); saveGame();
  }

  function snapshot(row, col) {
    return { value: state.board[row][col], notes: new Set(state.notes[row][col]), mistakes: state.mistakes, hints: state.hintsUsed };
  }
  function applySnapshot(row, col, snap) {
    state.board[row][col] = snap.value;
    state.notes[row][col] = new Set(snap.notes);
    state.mistakes = snap.mistakes;
    state.hintsUsed = snap.hints;
  }
  function pushHistory(entry) { state.history.push(entry); if (state.history.length > 50) state.history.shift(); state.redo = []; updateUndoRedoButtons(); }
  function undo() {
    if (state.isGameOver || state.paused || state.history.length === 0) return;
    const op = state.history.pop(); state.redo.push(op);
    applySnapshot(op.row, op.col, op.before);
    renderBoard(); updateHighlights(); updateGameStatus(); updateHintsDisplay(); updateUndoRedoButtons(); saveGame();
  }
  function redo() {
    if (state.isGameOver || state.paused || state.redo.length === 0) return;
    const op = state.redo.pop(); state.history.push(op);
    applySnapshot(op.row, op.col, op.after);
    renderBoard(); updateHighlights(); updateGameStatus(); updateHintsDisplay(); updateUndoRedoButtons(); saveGame();
  }
  function moveSelection(dRow, dCol) {
    if (!state.selectedCell) return;
    let r = state.selectedCell.row + dRow, c = state.selectedCell.col + dCol;
    r = Math.max(0, Math.min(8, r)); c = Math.max(0, Math.min(8, c));
    selectCell(r, c);
  }
  function selectCell(row, col) { if (state.isGameOver || state.paused) return; state.selectedCell = { row, col }; updateHighlights(); }

  function toggleNotesVisual(on) {
    state.notesMode = on;
    if (els.btnNotes) { els.btnNotes.setAttribute('aria-pressed', String(state.notesMode)); els.btnNotes.classList.toggle('active', state.notesMode); els.btnNotes.textContent = state.notesMode ? 'Notas: ligadas' : 'Notas: desligadas'; }
  }
  function toggleNotesMode() { toggleNotesVisual(!state.notesMode); }
  function togglePause() {
    if (state.isGameOver) return;
    state.paused = !state.paused;
    if (state.paused) { if (state.timerInterval) clearInterval(state.timerInterval); state.timerInterval = null; if (els.btnPause) els.btnPause.textContent = 'Continuar'; els.gameStatus.textContent = 'Jogo pausado.'; }
    else { state.timerInterval = setInterval(tickTimer, 1000); if (els.btnPause) els.btnPause.textContent = 'Pausar'; els.gameStatus.textContent = ''; }
    saveGame();
  }
  function restartBoard() {
    if (state.isGameOver) return;
    state.board = state.initial.map(row => [...row]);
    state.notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    state.mistakes = 0; state.hintsUsed = 0; state.hasUserAction = false; state.history = []; state.redo = [];
    state.elapsedSeconds = 0; state.startTime = Date.now(); state.paused = false;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(tickTimer, 1000);
    if (els.btnPause) els.btnPause.textContent = 'Pausar';
    renderBoard(); updateHighlights(); updateGameStatus(); updateHintsDisplay(); updateUndoRedoButtons(); saveGame();
  }
  function revealHint() {
    if (state.isGameOver || state.paused) return;
    if (state.hintsUsed >= state.maxHints) { els.gameStatus.textContent = 'Limite de dicas atingido (' + state.maxHints + ').'; return; }
    if (!state.selectedCell) { els.gameStatus.textContent = 'Seleciona primeiro uma célula vazia.'; return; }
    const { row, col } = state.selectedCell;
    if (state.initial[row][col] !== 0) { els.gameStatus.textContent = 'Escolhe uma célula que não esteja fixa.'; return; }
    if (state.board[row][col] === state.solution[row][col]) { els.gameStatus.textContent = 'Essa célula já está correta.'; return; }
    const before = snapshot(row, col);
    state.board[row][col] = state.solution[row][col];
    state.notes[row][col].clear();
    removeCandidateFromPeers(state.solution[row][col], row, col);
    state.hintsUsed++; state.hasUserAction = true;
    const after = snapshot(row, col);
    pushHistory({ row, col, before, after });
    els.gameStatus.textContent = 'Dica preenchida.';
    renderBoard(); updateHighlights(); updateHintsDisplay(); checkWinCondition(); saveGame();
  }
  function checkMistakeLimit() {
    if (state.mistakes >= state.maxMistakes) {
      state.isGameOver = true; state.gameResult = 'lose';
      if (state.timerInterval) clearInterval(state.timerInterval);
      state.timerInterval = null;
      if (els.loseTime) els.loseTime.textContent = els.timer.textContent;
      if (els.loseOverlay) els.loseOverlay.hidden = false;
      if (window.os && os.notify) os.notify('Fim de jogo: limite de erros atingido.');
      saveGame();
    }
  }
  function tickTimer() {
    if (state.paused || state.isGameOver) return;
    state.elapsedSeconds++;
    updateTimerDisplay();
    if (state.elapsedSeconds % 10 === 0) saveGame();
  }
  function startTimerFromElapsed() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.startTime = Date.now() - state.elapsedSeconds * 1000;
    state.timerInterval = setInterval(tickTimer, 1000);
  }
  function updateTimerDisplay() {
    const mins = String(Math.floor(state.elapsedSeconds / 60)).padStart(2, '0');
    const secs = String(state.elapsedSeconds % 60).padStart(2, '0');
    els.timer.textContent = mins + ':' + secs;
  }

  function updateHintsDisplay() {
    if (els.hints) els.hints.textContent = 'Dicas: ' + state.hintsUsed + '/' + state.maxHints;
    if (els.btnHint) els.btnHint.disabled = state.hintsUsed >= state.maxHints;
  }
  function updateBestTimeDisplay() {
    if (!els.bestTime) return;
    const diff = els.difficulty.value;
    const best = (state.bestTimes || {})[diff];
    els.bestTime.textContent = best ? ('Melhor: ' + formatTime(best)) : 'Melhor: --:--';
  }
  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return m + ':' + s;
  }
  function updateGameStatus() { els.mistakes.textContent = 'Erros: ' + state.mistakes + '/' + state.maxMistakes; updateHintsDisplay(); }
  function updateUndoRedoButtons() {
    if (els.btnUndo) els.btnUndo.disabled = state.history.length === 0;
    if (els.btnRedo) els.btnRedo.disabled = state.redo.length === 0;
  }

  // ---------------------------------------------------------------- Render

  function renderBoard() {
    if (els.board.children.length === 0) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.row = r; cell.dataset.col = c;
          cell.setAttribute('role', 'gridcell');
          const value = document.createElement('span'); value.className = 'cell-value';
          const notes = document.createElement('span'); notes.className = 'cell-notes';
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
        cell.classList.remove('fixed', 'error', 'conflict');
        if (state.initial[r][c] !== 0) cell.classList.add('fixed');
        if (val > 0 && state.initial[r][c] === 0 && val !== state.solution[r][c]) cell.classList.add('error');
        if (val > 0) {
          let conflict = false;
          for (let k = 0; k < 9; k++) {
            if (k !== c && state.board[r][k] === val) conflict = true;
            if (k !== r && state.board[k][c] === val) conflict = true;
          }
          const sr = r - r % 3, sc = c - c % 3;
          for (let rr = sr; rr < sr + 3; rr++)
            for (let cc = sc; cc < sc + 3; cc++)
              if ((rr !== r || cc !== c) && state.board[rr][cc] === val) conflict = true;
          if (conflict) cell.classList.add('conflict');
        }
      }
    }
  }

  function updateHighlights() {
    const cells = els.board.children;
    for (let i = 0; i < cells.length; i++) cells[i].classList.remove('selected', 'highlighted', 'same-number');
    if (!state.selectedCell) return;
    const { row: selR, col: selC } = state.selectedCell;
    const selectedValue = state.board[selR][selC];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = cells[r * 9 + c];
        const val = state.board[r][c];
        if (r === selR && c === selC) cell.classList.add('selected');
        else if (r === selR || c === selC || (Math.floor(r / 3) === Math.floor(selR / 3) && Math.floor(c / 3) === Math.floor(selC / 3))) cell.classList.add('highlighted');
        if (selectedValue > 0 && val === selectedValue && !(r === selR && c === selC)) cell.classList.add('same-number');
      }
    }
  }

  function checkWinCondition() {
    if (!state.hasUserAction || state.isGameOver) return;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (state.board[r][c] !== state.solution[r][c]) return;
    state.isGameOver = true; state.gameResult = 'win';
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = null;
    if (els.winTime) els.winTime.textContent = els.timer.textContent;
    if (els.winOverlay) els.winOverlay.hidden = false;
    const diff = els.difficulty.value;
    const best = (state.bestTimes || {})[diff];
    if (!best || state.elapsedSeconds < best) {
      state.bestTimes = state.bestTimes || {};
      state.bestTimes[diff] = state.elapsedSeconds;
      saveBestTimes();
      if (window.os && os.notify) os.notify('Novo recorde! ' + formatTime(state.elapsedSeconds));
      updateBestTimeDisplay();
    } else {
      if (window.os && os.notify) os.notify('Parabéns! Resolveste o Sudoku.');
    }
    saveGame();
  }

  function showGameOverOverlay() {
    if (state.gameResult === 'win') {
      if (els.winOverlay) els.winOverlay.hidden = false;
      if (els.winTime) els.winTime.textContent = els.timer.textContent;
    } else if (state.gameResult === 'lose') {
      if (els.loseOverlay) els.loseOverlay.hidden = false;
      if (els.loseTime) els.loseTime.textContent = els.timer.textContent;
    }
  }

})();
}
