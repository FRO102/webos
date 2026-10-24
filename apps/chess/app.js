(function () {
  'use strict';

  const PIECES = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
  };

  const INITIAL_BOARD = [
    'r','n','b','q','k','b','n','r',
    'p','p','p','p','p','p','p','p',
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    'P','P','P','P','P','P','P','P',
    'R','N','B','Q','K','B','N','R'
  ];

  const state = {
    board: [...INITIAL_BOARD],
    turn: 'w',
    selectedIndex: null,
    validMoves: [],
    history: [],
    isGameOver: false,
    castlingRights: { wK: true, wQ: true, bK: true, bQ: true },
    
    mode: 'pvp', // 'pvp' ou 'pvc'
    aiThinking: false,
    aiDepth: 2 // Nível de dificuldade (1=Facil, 2=Medio, 3=Dificil)
  };

  const els = {};
  
  // Valores das peças para a IA avaliar o tabuleiro
  const PIECE_VALUES = { 'p': 10, 'n': 30, 'b': 30, 'r': 50, 'q': 90, 'k': 900 };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheElements();
    bindEvents();
    buildBoard();
    render();
  }

  function cacheElements() {
    els.board = document.getElementById('board');
    els.statusText = document.getElementById('status-text');
    els.btnNew = document.getElementById('btn-new');
    els.btnUndo = document.getElementById('btn-undo');
    els.overlay = document.getElementById('overlay');
    els.overlayTitle = document.getElementById('overlay-title');
    els.overlayDesc = document.getElementById('overlay-desc');
    els.btnPlayAgain = document.getElementById('btn-play-again');
    els.coordsFiles = document.getElementById('coords-files');
    els.coordsRanks = document.getElementById('coords-ranks');
    els.modeSelect = document.getElementById('mode-select');
    els.difficultySelect = document.getElementById('difficulty-select');
  }

  function bindEvents() {
    els.btnNew.addEventListener('click', startNewGame);
    els.btnPlayAgain.addEventListener('click', startNewGame);
    els.btnUndo.addEventListener('click', undoMove);

    els.modeSelect.addEventListener('change', (e) => {
      state.mode = e.target.value;
      els.difficultySelect.disabled = (state.mode !== 'pvc');
      
      if (state.mode === 'pvc' && state.turn === 'b' && !state.isGameOver && !state.aiThinking) {
        setTimeout(triggerAI, 300);
      }
    });

    els.difficultySelect.addEventListener('change', (e) => {
      state.aiDepth = parseInt(e.target.value, 10);
    });

    els.board.addEventListener('click', e => {
      if (state.aiThinking) return;
      if (state.mode === 'pvc' && state.turn === 'b') return; // Bloquear cliques se for a vez da IA

      const sq = e.target.closest('.square');
      if (!sq) return;
      handleSquareClick(parseInt(sq.dataset.index, 10));
    });
  }

  // ---------------------------------------------------------------- AI Logic

  function triggerAI() {
    if (state.isGameOver) return;
    
    state.aiThinking = true;
    render();

    // Usar setTimeout para libertar o UI thread brevemente antes de calcular
    setTimeout(() => {
      const bestMove = getBestMove(state.board, state.turn, state.aiDepth, state.castlingRights);
      
      state.aiThinking = false;
      
      if (bestMove) {
        const valid = getValidMoves(state.board, bestMove.from, state.turn);
        const moveInfo = valid.find(m => m.to === bestMove.to);
        if (moveInfo) {
          executeMove(bestMove.from, bestMove.to, moveInfo);
        }
      } else {
        checkGameState(); // Verificar se há xeque-mate
      }
    }, 50);
  }

  function getBestMove(board, color, depth, rights) {
    let bestScore = color === 'w' ? -Infinity : Infinity;
    let bestMove = null;
    const moves = getAllMoves(board, color);

    if (moves.length === 0) return null;

    // Baralhar ligeiramente para não ser sempre igual
    moves.sort(() => Math.random() - 0.5);

    for (const move of moves) {
      const sim = simulateMove(board, move, color, rights);
      
      const score = minimax(sim.board, depth - 1, color === 'w' ? 'b' : 'w', color, -Infinity, Infinity, sim.rights);
      
      if (color === 'w') {
        if (score > bestScore) { bestScore = score; bestMove = move; }
      } else {
        if (score < bestScore) { bestScore = score; bestMove = move; }
      }
    }
    return bestMove;
  }

  function minimax(board, depth, turn, maxPlayer, alpha, beta, rights) {
    // Se chegou ao fundo ou não há movimentos
    const moves = getAllMoves(board, turn);
    if (depth === 0 || moves.length === 0) {
      return evaluateBoard(board, maxPlayer);
    }

    if (turn === maxPlayer) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const sim = simulateMove(board, move, turn, rights);
        const evalScore = minimax(sim.board, depth - 1, turn === 'w' ? 'b' : 'w', maxPlayer, alpha, beta, sim.rights);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const sim = simulateMove(board, move, turn, rights);
        const evalScore = minimax(sim.board, depth - 1, turn === 'w' ? 'b' : 'w', maxPlayer, alpha, beta, sim.rights);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function simulateMove(board, move, color, rights) {
    const simBoard = [...board];
    const piece = simBoard[move.from];
    simBoard[move.to] = piece;
    simBoard[move.from] = null;

    const simRights = { ...rights };
    // Desativar direitos de roque se necessário
    if (piece === 'K') { simRights.wK = false; simRights.wQ = false; }
    if (piece === 'k') { simRights.bK = false; simRights.bQ = false; }

    // Promoção automática
    if (piece === 'P' && move.to < 8) simBoard[move.to] = 'Q';
    if (piece === 'p' && move.to >= 56) simBoard[move.to] = 'q';

    return { board: simBoard, rights: simRights };
  }

  function evaluateBoard(board, maxPlayer) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const piece = board[i];
      if (!piece) continue;
      
      const type = piece.toLowerCase();
      const val = PIECE_VALUES[type];
      
      if (piece === piece.toUpperCase()) {
        score += (maxPlayer === 'w' ? val : -val);
      } else {
        score += (maxPlayer === 'b' ? val : -val);
      }
    }
    return score;
  }

  // ---------------------------------------------------------------- Setup UI

  function buildBoard() {
    els.board.innerHTML = '';
    for (let i = 0; i < 64; i++) {
      const sq = document.createElement('div');
      const row = Math.floor(i / 8);
      const col = i % 8;
      sq.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      sq.dataset.index = i;
      els.board.appendChild(sq);
    }

    els.coordsFiles.innerHTML = '';
    for (let c = 0; c < 8; c++) {
      const span = document.createElement('span');
      span.textContent = String.fromCharCode(97 + c);
      els.coordsFiles.appendChild(span);
    }
    els.coordsRanks.innerHTML = '';
    for (let r = 8; r >= 1; r--) {
      const span = document.createElement('span');
      span.textContent = r;
      els.coordsRanks.appendChild(span);
    }
  }

  function render() {
    for (let i = 0; i < 64; i++) {
      const sq = els.board.children[i];
      sq.classList.remove('selected', 'valid-move', 'valid-capture', 'check');
      sq.innerHTML = '';

      const piece = state.board[i];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = `piece ${piece === piece.toUpperCase() ? 'white' : 'black'}`;
        pieceEl.textContent = PIECES[piece];
        sq.appendChild(pieceEl);
      }

      if (state.selectedIndex === i) {
        sq.classList.add('selected');
      }

      const move = state.validMoves.find(m => m.to === i);
      if (move) {
        sq.classList.add(move.capture ? 'valid-capture' : 'valid-move');
      }
    }

    if (!state.isGameOver) {
      const kingIdx = findKing(state.board, state.turn);
      if (kingIdx !== -1 && isKingInCheck(state.board, state.turn)) {
        els.board.children[kingIdx].classList.add('check');
      }
    }

    if (state.isGameOver) return;

    if (state.aiThinking) {
      els.statusText.textContent = 'O PC está a pensar…';
      els.statusText.classList.add('thinking');
    } else {
      els.statusText.classList.remove('thinking');
      els.statusText.textContent = state.turn === 'w' ? 'Vez das Brancas' : 'Vez das Negras';
      if (isKingInCheck(state.board, state.turn)) {
        els.statusText.textContent += ' (Xeque!)';
      }
    }

    els.btnUndo.disabled = state.history.length === 0 || state.isGameOver || state.aiThinking;
  }

  // ---------------------------------------------------------------- Fluxo do Jogo

  function handleSquareClick(index) {
    if (state.isGameOver) return;

    const piece = state.board[index];
    const isMyPiece = piece && (state.turn === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase());

    if (isMyPiece) {
      state.selectedIndex = index;
      state.validMoves = getValidMoves(state.board, index, state.turn);
      render();
      return;
    }

    if (state.selectedIndex !== null) {
      const move = state.validMoves.find(m => m.to === index);
      if (move) {
        executeMove(state.selectedIndex, index, move);
      } else {
        state.selectedIndex = null;
        state.validMoves = [];
        render();
      }
    }
  }

  function executeMove(from, to, moveInfo) {
    state.history.push({
      board: [...state.board],
      turn: state.turn,
      castlingRights: { ...state.castlingRights }
    });

    let piece = state.board[from];
    state.board[to] = piece;
    state.board[from] = null;

    if (piece === 'K') { state.castlingRights.wK = false; state.castlingRights.wQ = false; }
    if (piece === 'k') { state.castlingRights.bK = false; state.castlingRights.bQ = false; }
    if (piece === 'R' && from === 63) state.castlingRights.wK = false;
    if (piece === 'R' && from === 56) state.castlingRights.wQ = false;
    if (piece === 'r' && from === 7)  state.castlingRights.bK = false;
    if (piece === 'r' && from === 0)  state.castlingRights.bQ = false;

    if (moveInfo.castle) {
      if (moveInfo.castle === 'K') {
        state.board[to - 1] = state.board[to + 1];
        state.board[to + 1] = null;
      } else if (moveInfo.castle === 'Q') {
        state.board[to + 1] = state.board[to - 2];
        state.board[to - 2] = null;
      }
    }

    if (piece === 'P' && to < 8) state.board[to] = 'Q';
    if (piece === 'p' && to >= 56) state.board[to] = 'q';

    state.turn = state.turn === 'w' ? 'b' : 'w';
    state.selectedIndex = null;
    state.validMoves = [];

    checkGameState();
    render();

    // Se for contra o PC e for a vez do PC, pede lance à IA
    if (state.mode === 'pvc' && !state.isGameOver && state.turn === 'b') {
      setTimeout(triggerAI, 300);
    }
  }

  function checkGameState() {
    const allMoves = getAllMoves(state.board, state.turn);
    const inCheck = isKingInCheck(state.board, state.turn);

    if (allMoves.length === 0) {
      state.isGameOver = true;
      els.overlay.hidden = false;
      if (inCheck) {
        const winner = state.turn === 'w' ? 'Negras' : 'Brancas';
        els.overlayTitle.textContent = 'Xeque-Mate!';
        els.overlayDesc.textContent = `As ${winner} venceram.`;
        if (window.os && os.notify) os.notify(`Xeque-Mate! Vitória das ${winner}.`);
      } else {
        els.overlayTitle.textContent = 'Empate!';
        els.overlayDesc.textContent = 'Rei afogado (sem movimentos legais).';
        if (window.os && os.notify) os.notify('Empate por afogamento.');
      }
    }
  }

  function undoMove() {
    if (state.history.length === 0 || state.aiThinking) return;
    
    // Desfazer o lance do PC e o lance do jogador
    if (state.mode === 'pvc' && state.history.length >= 2) {
        state.history.pop();
    }
    
    const prev = state.history.pop();
    if (prev) {
        state.board = prev.board;
        state.turn = prev.turn;
        state.castlingRights = prev.castlingRights;
    }
    
    state.selectedIndex = null;
    state.validMoves = [];
    state.isGameOver = false;
    els.overlay.hidden = true;
    render();
  }

  function startNewGame() {
    state.board = [...INITIAL_BOARD];
    state.turn = 'w';
    state.selectedIndex = null;
    state.validMoves = [];
    state.history = [];
    state.isGameOver = false;
    state.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
    state.aiThinking = false;
    els.overlay.hidden = true;
    render();
  }

  // ---------------------------------------------------------------- Regras

  function isWhite(p) { return p && p === p.toUpperCase(); }
  function isBlack(p) { return p && p === p.toLowerCase(); }

  function getValidMoves(board, index, color) {
    const piece = board[index];
    if (!piece) return [];
    let moves = getPseudoLegalMoves(board, index, color);
    moves = moves.filter(move => {
      const simBoard = [...board];
      simBoard[move.to] = simBoard[index];
      simBoard[index] = null;
      if (move.castle) {
        if (move.castle === 'K') { simBoard[move.to - 1] = simBoard[move.to + 1]; simBoard[move.to + 1] = null; }
        if (move.castle === 'Q') { simBoard[move.to + 1] = simBoard[move.to - 2]; simBoard[move.to - 2] = null; }
      }
      return !isKingInCheck(simBoard, color);
    });
    return moves;
  }

  function getPseudoLegalMoves(board, index, color) {
    const piece = board[index];
    const type = piece.toLowerCase();
    const row = Math.floor(index / 8);
    const col = index % 8;
    const moves = [];
    const isW = color === 'w';

    const addMove = (r, c) => {
      if (r < 0 || r > 7 || c < 0 || c > 7) return false;
      const targetIdx = r * 8 + c;
      const target = board[targetIdx];
      const isEnemy = isW ? isBlack(target) : isWhite(target);
      const isEmpty = !target;
      if (isEmpty) { moves.push({ to: targetIdx, capture: false, from: index }); return true; }
      if (isEnemy) { moves.push({ to: targetIdx, capture: true, from: index }); return false; }
      return false;
    };

    if (type === 'p') {
      const dir = isW ? -1 : 1;
      const startRow = isW ? 6 : 1;
      if (row + dir >= 0 && row + dir <= 7) {
        if (!board[(row + dir) * 8 + col]) {
          moves.push({ to: (row + dir) * 8 + col, capture: false, from: index });
          if (row === startRow && !board[(row + 2 * dir) * 8 + col]) {
            moves.push({ to: (row + 2 * dir) * 8 + col, capture: false, from: index });
          }
        }
        if (col > 0 && board[(row + dir) * 8 + (col - 1)]) {
          if (isW ? isBlack(board[(row + dir) * 8 + (col - 1)]) : isWhite(board[(row + dir) * 8 + (col - 1)])) {
            moves.push({ to: (row + dir) * 8 + (col - 1), capture: true, from: index });
          }
        }
        if (col < 7 && board[(row + dir) * 8 + (col + 1)]) {
          if (isW ? isBlack(board[(row + dir) * 8 + (col + 1)]) : isWhite(board[(row + dir) * 8 + (col + 1)])) {
            moves.push({ to: (row + dir) * 8 + (col + 1), capture: true, from: index });
          }
        }
      }
    } 
    else if (type === 'n') {
      const offsets = [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]];
      for (const [dr, dc] of offsets) addMove(row + dr, col + dc);
    } 
    else if (type === 'b') {
      for (const [dr, dc] of [[-1,-1], [-1,1], [1,-1], [1,1]]) {
        let r = row + dr, c = col + dc;
        while (addMove(r, c)) { r += dr; c += dc; }
      }
    } 
    else if (type === 'r') {
      for (const [dr, dc] of [[-1,0], [1,0], [0,-1], [0,1]]) {
        let r = row + dr, c = col + dc;
        while (addMove(r, c)) { r += dr; c += dc; }
      }
    } 
    else if (type === 'q') {
      for (const [dr, dc] of [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]]) {
        let r = row + dr, c = col + dc;
        while (addMove(r, c)) { r += dr; c += dc; }
      }
    } 
    else if (type === 'k') {
      for (const [dr, dc] of [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]]) {
        addMove(row + dr, col + dc);
      }
      const rights = state.castlingRights;
      if (isW && !isKingInCheck(board, 'w')) {
        if (rights.wK && !board[61] && !board[62] && board[63] === 'R') {
          if (!isSquareAttacked(board, 61, 'b') && !isSquareAttacked(board, 62, 'b')) {
            moves.push({ to: 62, capture: false, castle: 'K', from: index });
          }
        }
        if (rights.wQ && !board[59] && !board[58] && !board[57] && board[56] === 'R') {
          if (!isSquareAttacked(board, 59, 'b') && !isSquareAttacked(board, 58, 'b')) {
            moves.push({ to: 58, capture: false, castle: 'Q', from: index });
          }
        }
      }
      if (!isW && !isKingInCheck(board, 'b')) {
        if (rights.bK && !board[5] && !board[6] && board[7] === 'r') {
          if (!isSquareAttacked(board, 5, 'w') && !isSquareAttacked(board, 6, 'w')) {
            moves.push({ to: 6, capture: false, castle: 'K', from: index });
          }
        }
        if (rights.bQ && !board[3] && !board[2] && !board[1] && board[0] === 'r') {
          if (!isSquareAttacked(board, 3, 'w') && !isSquareAttacked(board, 2, 'w')) {
            moves.push({ to: 2, capture: false, castle: 'Q', from: index });
          }
        }
      }
    }
    return moves;
  }

  function findKing(board, color) {
    const target = color === 'w' ? 'K' : 'k';
    return board.indexOf(target);
  }

  function isKingInCheck(board, color) {
    const kingIdx = findKing(board, color);
    if (kingIdx === -1) return false;
    return isSquareAttacked(board, kingIdx, color === 'w' ? 'b' : 'w');
  }

  function isSquareAttacked(board, index, byColor) {
    const row = Math.floor(index / 8);
    const col = index % 8;
    
    const knight = byColor === 'w' ? 'N' : 'n';
    const nOffsets = [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]];
    for (const [dr, dc] of nOffsets) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r*8+c] === knight) return true;
    }

    const pawn = byColor === 'w' ? 'P' : 'p';
    const pDir = byColor === 'w' ? 1 : -1;
    if (row + pDir >= 0 && row + pDir < 8) {
      if (col > 0 && board[(row + pDir)*8 + (col-1)] === pawn) return true;
      if (col < 7 && board[(row + pDir)*8 + (col+1)] === pawn) return true;
    }

    const king = byColor === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r*8+c] === king) return true;
      }
    }

    const sliders = [
      { types: [byColor === 'w' ? 'R' : 'r', byColor === 'w' ? 'Q' : 'q'], dirs: [[-1,0],[1,0],[0,-1],[0,1]] },
      { types: [byColor === 'w' ? 'B' : 'b', byColor === 'w' ? 'Q' : 'q'], dirs: [[-1,-1],[-1,1],[1,-1],[1,1]] }
    ];

    for (const { types, dirs } of sliders) {
      for (const [dr, dc] of dirs) {
        let r = row + dr, c = col + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const p = board[r*8+c];
          if (p) {
            if (types.includes(p)) return true;
            break;
          }
          r += dr; c += dc;
        }
      }
    }
    return false;
  }

  function getAllMoves(board, color) {
    let allMoves = [];
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && (color === 'w' ? isWhite(p) : isBlack(p))) {
        allMoves = allMoves.concat(getValidMoves(board, i, color));
      }
    }
    return allMoves;
  }

})();