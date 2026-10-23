(function () {
  'use strict';

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const state = {
    board: Array(9).fill(''),
    turn: 'X',
    mode: '2p',            // '2p' | '1p'
    over: false,
    result: null,          // 'X' | 'O' | 'draw' | null
    locked: false,
    scores: { X: 0, O: 0, draw: 0 }
  };

  let roundGeneration = 0;
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    els.board = document.getElementById('board');
    els.status = document.getElementById('status');
    els.turnText = document.getElementById('turn-text');
    els.scoreX = document.getElementById('score-x');
    els.scoreO = document.getElementById('score-o');
    els.scoreDraw = document.getElementById('score-draw');
    els.newRound = document.getElementById('new-round');
    els.resetScores = document.getElementById('reset-scores');
    els.modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
    els.cells = Array.from(els.board.querySelectorAll('.cell'));

    await loadScores();
    bindEvents();
    setupI18n();
    render();
  }

  async function loadScores() {
    try {
      const saved = await os.storage.get('scores');
      if (saved && typeof saved === 'object') {
        state.scores = {
          X: Number(saved.X) || 0,
          O: Number(saved.O) || 0,
          draw: Number(saved.draw) || 0
        };
      }
    } catch (err) {
      console.warn('Tic Tac Toe: não foi possível carregar as pontuações.', err);
    }
  }

  function bindEvents() {
    els.cells.forEach(cell => {
      cell.addEventListener('click', () => onCellClick(Number(cell.dataset.index)));
    });
    els.newRound.addEventListener('click', resetBoard);
    els.resetScores.addEventListener('click', onResetScores);
    els.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
  }

  function setupI18n() {
    if (!window.os || !os.i18n) return;
    try {
      if (typeof os.i18n.apply === 'function') os.i18n.apply(document.body);
    } catch (err) {
      console.warn('Tic Tac Toe: falha ao aplicar traduções.', err);
    }
    if (typeof os.i18n.onChange === 'function') {
      os.i18n.onChange(() => {
        try {
          if (typeof os.i18n.apply === 'function') os.i18n.apply(document.body);
        } catch (err) { /* noop */ }
        render();
      });
    }
  }

  function t(text) {
    if (window.os && os.i18n && typeof os.i18n.t === 'function') {
      try { return os.i18n.t(text); } catch (err) { return text; }
    }
    return text;
  }

  function onCellClick(index) {
    if (state.over || state.locked) return;
    if (state.board[index] !== '') return;
    if (state.mode === '1p' && state.turn !== 'X') return;

    play(index);

    if (state.mode === '1p' && !state.over) {
      scheduleAiMove();
    }
  }

  function scheduleAiMove() {
    state.locked = true;
    render();

    const gen = roundGeneration;
    window.setTimeout(() => {
      if (gen !== roundGeneration) return;
      if (state.over) { state.locked = false; render(); return; }

      const move = bestMove(state.board, 'O');
      if (move !== -1) play(move);
      state.locked = false;
      render();
    }, 320);
  }

  function play(index) {
    state.board[index] = state.turn;
    const outcome = evaluate(state.board);

    if (outcome) {
      state.over = true;
      state.result = outcome;
      if (outcome === 'draw') state.scores.draw++;
      else state.scores[outcome]++;
      persistScores();
    } else {
      state.turn = state.turn === 'X' ? 'O' : 'X';
    }
    render();
  }

  function evaluate(board) {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    if (board.every(v => v !== '')) return 'draw';
    return null;
  }

  function other(player) { return player === 'X' ? 'O' : 'X'; }

  function bestMove(board, ai) {
    let bestScore = -Infinity;
    let bestIdx = -1;
    for (let i = 0; i < 9; i++) {
      if (board[i] === '') {
        board[i] = ai;
        const score = minimax(board, false, ai, other(ai), 1);
        board[i] = '';
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }
    return bestIdx;
  }

  function minimax(board, isMax, ai, human, depth) {
    const outcome = evaluate(board);
    if (outcome === ai) return 10 - depth;
    if (outcome === human) return depth - 10;
    if (outcome === 'draw') return 0;

    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
          board[i] = ai;
          best = Math.max(best, minimax(board, false, ai, human, depth + 1));
          board[i] = '';
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
          board[i] = human;
          best = Math.min(best, minimax(board, true, ai, human, depth + 1));
          board[i] = '';
        }
      }
      return best;
    }
  }

  async function persistScores() {
    try {
      await os.storage.set('scores', state.scores);
    } catch (err) {
      console.warn('Tic Tac Toe: falha ao guardar pontuações.', err);
    }
  }

  function resetBoard() {
    roundGeneration++;
    state.board = Array(9).fill('');
    state.turn = 'X';
    state.over = false;
    state.result = null;
    state.locked = false;
    setStatus('', null);
    render();
  }

  async function onResetScores() {
    let confirmed = false;

    if (window.os && os.dialog && typeof os.dialog.confirm === 'function') {
      try {
        confirmed = await os.dialog.confirm({
          title: t('Reiniciar pontuações'),
          message: t('O histórico de vitórias e empates será apagado.'),
          okLabel: t('Reiniciar'),
          danger: true
        });
      } catch (err) {
        confirmed = false;
      }
    } else {
      try { confirmed = window.confirm(t('Reiniciar pontuações?')); }
      catch (err) { confirmed = false; }
    }

    if (!confirmed) return;

    state.scores = { X: 0, O: 0, draw: 0 };
    render();

    try {
      await os.storage.remove('scores');
    } catch (err) {
      const msg = (window.os && os.errors && typeof os.errors.message === 'function')
        ? os.errors.message(err, t('Falha ao reiniciar as pontuações.'))
        : t('Falha ao reiniciar as pontuações.');
      setStatus(msg, 'error');
    }
  }

  function setMode(mode) {
    if (mode !== '1p' && mode !== '2p') return;
    if (mode === state.mode) return;
    state.mode = mode;
    els.modeBtns.forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.mode === mode ? 'true' : 'false');
    });
    resetBoard();
  }

  function setStatus(message, kind) {
    els.status.textContent = message || '';
    if (kind) els.status.dataset.state = kind;
    else delete els.status.dataset.state;
  }

  function render() {
    els.cells.forEach((cell, i) => {
      const v = state.board[i];
      cell.textContent = v;
      cell.classList.toggle('cell--x', v === 'X');
      cell.classList.toggle('cell--o', v === 'O');
      cell.disabled = v !== '' || state.over || state.locked;

      const status = v === '' ? t('vazio') : t('marcada com') + ' ' + v;
      cell.setAttribute('aria-label', t('Casa') + ' ' + (i + 1) + ', ' + status);
    });

    els.scoreX.textContent = String(state.scores.X);
    els.scoreO.textContent = String(state.scores.O);
    els.scoreDraw.textContent = String(state.scores.draw);

    let turnMessage;
    if (state.over) {
      if (state.result === 'draw') turnMessage = t('Empate');
      else turnMessage = t('Vitória de') + ' ' + state.result;
    } else if (state.locked) {
      turnMessage = t('A pensar') + '…';
    } else {
      turnMessage = t('Vez de') + ' ' + state.turn;
    }
    els.turnText.textContent = turnMessage;
  }
})();