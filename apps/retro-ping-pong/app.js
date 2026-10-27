// Retro Ping-Pong - WebOS app
(function () {
  "use strict";

  const FRAMES_PER_SECOND = 60;
  const FRAME_RATE_ADJUST = 30 / FRAMES_PER_SECOND;
  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const PADDLE_THICKNESS = 10;
  const PADDLE_HEIGHT = 100;
  const BALL_RADIUS = 10;

  const DIFFICULTY = {
    easy: { aiSpeed: 5 * FRAME_RATE_ADJUST, ballSpeed: 7 * FRAME_RATE_ADJUST, ballAccel: 0.04, deadZone: 40, prediction: 0.35 },
    normal: { aiSpeed: 8 * FRAME_RATE_ADJUST, ballSpeed: 9 * FRAME_RATE_ADJUST, ballAccel: 0.06, deadZone: 24, prediction: 0.7 },
    hard: { aiSpeed: 11 * FRAME_RATE_ADJUST, ballSpeed: 11 * FRAME_RATE_ADJUST, ballAccel: 0.08, deadZone: 12, prediction: 1 }
  };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const els = {
    scorePlayer: document.getElementById("score-player"),
    scoreCpu: document.getElementById("score-cpu"),
    modeRow: document.getElementById("mode-row"),
    recordRow: document.getElementById("record-row"),
    btnStart: document.getElementById("btn-start"),
    btnPause: document.getElementById("btn-pause"),
    btnRestart: document.getElementById("btn-restart"),
    btnFullscreen: document.getElementById("btn-fullscreen"),
    miniHud: document.getElementById("mini-hud"),
    miniScore: document.getElementById("mini-score"),
    miniStart: document.getElementById("mini-start"),
    miniPause: document.getElementById("mini-pause"),
    miniSettings: document.getElementById("mini-settings"),
    miniToggleHud: document.getElementById("mini-toggle-hud"),
    btnSettings: document.getElementById("btn-settings"),
    options: document.getElementById("options"),
    difficulty: document.getElementById("difficulty"),
    target: document.getElementById("target"),
    audioEnabled: document.getElementById("audio-enabled"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlay-title"),
    overlayMessage: document.getElementById("overlay-message"),
    overlayCta: document.getElementById("overlay-cta"),
    targetInc: document.getElementById("target-inc"),
    targetDec: document.getElementById("target-dec"),
    targetValue: document.getElementById("target-value"),
    audioToggle: document.getElementById("audio-toggle"),
    statusText: document.getElementById("status-text"),
    newRecord: document.getElementById("new-record"),
    segButtons: Array.from(document.querySelectorAll(".seg") || []),
    btnHideHud: document.getElementById("btn-hide-hud")  };

  const prefs = { difficulty: "normal", target: 10, audio: true, bestScore: 0, bestStreak: 0, games: 0 };
  const state = {
    status: "ready", // ready | playing | paused | gameover
    mode: "vs-cpu",
    difficulty: "normal",
    target: 10,
    scores: { player: 0, cpu: 0 },
    ball: { x: 100, y: 100, vx: 0, vy: 0, speed: 0 },
    paddlePlayer: { x: 0, y: 250 },
    paddleCpu: { x: 0, y: 250 },
    aiError: 0,
    streak: 0,
    shake: 0,
    winner: "",
    keys: { up: false, down: false },
    pointerActive: false,
    touchId: null,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
  };

  let audioCtx = null;
  let intervalId = null;
  let destroyed = false;
  let trail = [];

  // utils
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function cssVar(name, fallback) {
    try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch (e) { return fallback; }
  }
  function t(value) {
    try { if (window.os && os.i18n && typeof os.i18n.t === "function") return os.i18n.t(String(value)); } catch (e) {}
    return String(value);
  }
  function applyI18n() {
    try { if (window.os && os.i18n && typeof os.i18n.apply === "function") os.i18n.apply(document.body); } catch (e) {}
    updateHud();
  }

  function reducedMotion() { return state.reducedMotion; }

  // audio
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }
  function playSound(type, speed) {
    if (!prefs.audio || (els.audioEnabled && !els.audioEnabled.checked)) return;    const c = ensureAudio();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    const t0 = c.currentTime;
    const out = c.destination;
    const gain = c.createGain();
    if (type === "hit") {
      const noise = c.createBufferSource();
      const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 900 + (speed || 1) * 140; bp.Q.value = 3;
      gain.gain.setValueAtTime(0.35, t0); gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
      noise.connect(bp); bp.connect(gain); gain.connect(out); noise.start(t0); noise.stop(t0 + 0.06);
    } else if (type === "wall") {
      const noise = c.createBufferSource();
      const buf = c.createBuffer(1, c.sampleRate * 0.03, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noise.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 1400;
      gain.gain.setValueAtTime(0.18, t0); gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
      noise.connect(hp); hp.connect(gain); gain.connect(out); noise.start(t0); noise.stop(t0 + 0.03);
    } else if (type === "score") {
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, t0);
      osc.frequency.exponentialRampToValueAtTime(600, t0 + 0.1);
      gain.gain.setValueAtTime(0.25, t0); gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.connect(gain); gain.connect(out); osc.start(t0); osc.stop(t0 + 0.12);
    } else if (type === "win") {
      const osc = c.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(400, t0);
      osc.frequency.exponentialRampToValueAtTime(900, t0 + 0.2);
      gain.gain.setValueAtTime(0.22, t0); gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(gain); gain.connect(out); osc.start(t0); osc.stop(t0 + 0.22);
    }
  }

  // storage
  async function loadPrefs() {
    if (!window.os || !os.storage) return;
    try { const v = await os.storage.get("retro-ping-pong:prefs"); if (v && typeof v === "object") Object.assign(prefs, v); } catch (e) {}
    try { const v = await os.storage.get("retro-ping-pong:stats"); if (v && typeof v === "object") { prefs.bestScore = Number(v.bestScore) || prefs.bestScore; prefs.bestStreak = Number(v.bestStreak) || prefs.bestStreak; prefs.games = Number(v.games) || prefs.games; } } catch (e) {}
    state.difficulty = prefs.difficulty || "normal";
    state.target = prefs.target || 10;
    if (els.difficulty) els.difficulty.value = state.difficulty;
    if (els.target) els.target.value = String(state.target);
    if (els.audioEnabled) els.audioEnabled.checked = prefs.audio !== false;
    syncSegButtons();
    syncAudioSwitch();
    if (prefs.hudHidden) document.body.classList.add("hud-hidden");
    if (els.btnHideHud) {
      els.btnHideHud.textContent = prefs.hudHidden ? "Mostrar HUD" : "Ocultar HUD";
      els.btnHideHud.setAttribute("aria-label", prefs.hudHidden ? "Mostrar cabeçalho" : "Esconder cabeçalho");
    }
    updateHud();
  }
  async function saveStats() {
    if (!window.os || !os.storage) return;
    try { await os.storage.set("retro-ping-pong:prefs", { difficulty: state.difficulty, target: state.target, audio: prefs.audio, hudHidden: prefs.hudHidden }); } catch (e) {}
    try { await os.storage.set("retro-ping-pong:stats", { bestScore: prefs.bestScore, bestStreak: prefs.bestStreak, games: prefs.games }); } catch (e) {}
  }

  function popScore(el) {
    if (!el || reducedMotion()) return;
    el.classList.add("pop");
    setTimeout(() => el.classList.remove("pop"), 240);
  }
  function toggleHud(hidden) {
    if (typeof hidden === "boolean") {
      if (hidden) document.body.classList.add("hud-hidden");
      else document.body.classList.remove("hud-hidden");
    } else {
      document.body.classList.toggle("hud-hidden");
    }
    if (els.btnHideHud) {
      const hiddenState = document.body.classList.contains("hud-hidden");
      els.btnHideHud.textContent = hiddenState ? "Mostrar HUD" : "Ocultar HUD";
      els.btnHideHud.setAttribute("aria-label", hiddenState ? "Mostrar cabeçalho" : "Esconder cabeçalho");
    }
    prefs.hudHidden = document.body.classList.contains("hud-hidden");
    saveStats();
  }

  function updateHud() {
    els.scorePlayer.textContent = String(state.scores.player);
    els.scoreCpu.textContent = String(state.scores.cpu);
    if (els.targetValue) els.targetValue.textContent = String(state.target);
    if (els.statusText) els.statusText.textContent = `${state.difficulty.toUpperCase()} · ${state.target} pts`;
    const dLabel = state.difficulty === "easy" ? "Fácil" : state.difficulty === "hard" ? "Difícil" : "Normal";
    els.modeRow.textContent = `VS CPU · ${dLabel} · ${state.target}`;
    els.recordRow.textContent = `Recorde: ${prefs.bestScore} · Jogos: ${prefs.games}`;
    if (window.os && os.i18n && os.i18n.language === "en") {
      els.modeRow.textContent = `VS CPU · ${state.difficulty} · ${state.target}`;
      els.recordRow.textContent = `Best: ${prefs.bestScore} · Games: ${prefs.games}`;
    }
  }

  function hideOverlay() { els.overlay.classList.add("hidden"); }
  function showOverlay(title, message, cta) {
    els.overlayTitle.textContent = title;
    els.overlayMessage.textContent = message;
    els.overlayCta.textContent = cta;
    els.overlay.classList.remove("hidden");
  }

  function resetMatch() {
    state.scores.player = 0;
    state.scores.cpu = 0;
    state.streak = 0;
    state.shake = 0;
    trail = [];
    state.paddlePlayer.y = (CANVAS_H - PADDLE_HEIGHT) / 2;
    state.paddleCpu.y = (CANVAS_H - PADDLE_HEIGHT) / 2;
    state.paddlePlayer.x = 0;
    state.paddleCpu.x = CANVAS_W - PADDLE_THICKNESS;
    const d = DIFFICULTY[state.difficulty];
    state.ball.speed = d.ballSpeed;
    resetBall(Math.random() < 0.5 ? 1 : -1);
  }

  function resetBall(dirX) {
    state.ball.x = CANVAS_W / 2;
    state.ball.y = CANVAS_H / 2;
    const d = DIFFICULTY[state.difficulty];
    const angle = (Math.random() * 0.6 - 0.3);
    state.ball.vx = d.ballSpeed * dirX;
    state.ball.vy = d.ballSpeed * angle;
    state.ball.speed = d.ballSpeed;
    state.aiError = (Math.random() - 0.5) * d.deadZone;
  }

  function startGame() {
    resetMatch();
    state.status = "playing";
    hideOverlay();
    syncSettingsLock(true);
    playSound("score", 1);
    ensureLoop();
  }

  function pauseGame() {
    if (state.status === "playing") {
      state.status = "paused";
      syncLoop();
      showOverlay("Pausa", "Pressiona Space para continuar.", "Continuar");
    } else if (state.status === "paused") {
      state.status = "playing";
      hideOverlay();
      syncLoop();
    }
  }

  function handleGameOver(winner) {
    state.status = "gameover";
    state.winner = winner;
    syncLoop();
    const isPlayer = winner === "player";
    if (isPlayer) {
      popScore(els.scoreCpu);
      if (state.scores.player > prefs.bestScore) {
        prefs.bestScore = state.scores.player;
        if (window.os && os.notify) try { os.notify("Novo recorde!"); } catch (e) {}
      }
      prefs.bestStreak = Math.max(prefs.bestStreak, state.streak);
    }
    prefs.games = (prefs.games || 0) + 1;
    saveStats();
    const msg = isPlayer ? "Ganhaste!" : "CPU ganhou!";
    showOverlay(isPlayer ? "Vitória" : "Fim de jogo", msg, "Jogar novamente");
    try { playSound("win", 1); } catch (e) {}
  }

  function attrsNewRecord() {
    if (!els.newRecord) return;
    els.newRecord.classList.remove("hidden");
    setTimeout(() => { if (els.newRecord) els.newRecord.classList.add("hidden"); }, 1700);
  }
  function movePaddleWithKeys(dt) {
    const speed = 9 * FRAME_RATE_ADJUST;
    if (state.keys.up) state.paddlePlayer.y -= speed;
    if (state.keys.down) state.paddlePlayer.y += speed;
    state.paddlePlayer.y = clamp(state.paddlePlayer.y, 0, CANVAS_H - PADDLE_HEIGHT);
  }

  function updateAI() {
    const d = DIFFICULTY[state.difficulty];
    const ball = state.ball;
    let targetY = CANVAS_H / 2;
    if (ball.vx > 0) {
      const timeToPaddle = Math.max(0, (state.paddleCpu.x - ball.x) / ball.vx);
      const predictedY = ball.y + ball.vy * timeToPaddle * d.prediction;
      const top = BALL_RADIUS;
      const span = CANVAS_H - BALL_RADIUS * 2;
      const reflected = ((predictedY - top) % (span * 2) + span * 2) % (span * 2);
      const impactY = top + (reflected <= span ? reflected : span * 2 - reflected);
      targetY = impactY + state.aiError;
    }
    targetY = clamp(targetY - PADDLE_HEIGHT / 2, 0, CANVAS_H - PADDLE_HEIGHT);
    const center = state.paddleCpu.y + PADDLE_HEIGHT / 2;
    if (center < targetY - 3) state.paddleCpu.y += Math.min(d.aiSpeed, targetY - center);
    else if (center > targetY + 3) state.paddleCpu.y -= Math.min(d.aiSpeed, center - targetY);
    state.paddleCpu.y = clamp(state.paddleCpu.y, 0, CANVAS_H - PADDLE_HEIGHT);
  }

  function updatePhysics() {
    if (state.status !== "playing") return;
    movePaddleWithKeys(1);

    updateAI();

    const b = state.ball;
    b.x += b.vx;
    b.y += b.vy;

    // walls
    if (b.y < BALL_RADIUS) { b.y = BALL_RADIUS; b.vy = Math.abs(b.vy); playSound("wall", 1); }
    if (b.y > CANVAS_H - BALL_RADIUS) { b.y = CANVAS_H - BALL_RADIUS; b.vy = -Math.abs(b.vy); playSound("wall", 1); }

    // player paddle (left)
    if (b.x - BALL_RADIUS < PADDLE_THICKNESS && b.x > 0 &&
        b.y > state.paddlePlayer.y && b.y < state.paddlePlayer.y + PADDLE_HEIGHT) {
      const offset = (b.y - (state.paddlePlayer.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const d = DIFFICULTY[state.difficulty];
      b.vx = Math.abs(b.vx) * 1.02;
      b.vx = Math.min(b.vx, 18 * FRAME_RATE_ADJUST);
      b.vy = offset * (d.ballSpeed * 0.8);
      b.x = PADDLE_THICKNESS + BALL_RADIUS;
      playSound("hit", Math.abs(b.vx));
      state.shake = reducedMotion() ? 0 : 6;
    }

    // cpu paddle (right)
    if (b.x + BALL_RADIUS > CANVAS_W - PADDLE_THICKNESS && b.x < CANVAS_W &&
        b.y > state.paddleCpu.y && b.y < state.paddleCpu.y + PADDLE_HEIGHT) {
      const offset = (b.y - (state.paddleCpu.y + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
      const d = DIFFICULTY[state.difficulty];
      b.vx = -Math.abs(b.vx) * 1.02;
      b.vx = Math.max(b.vx, -18 * FRAME_RATE_ADJUST);
      b.vy = offset * (d.ballSpeed * 0.8);
      b.x = CANVAS_W - PADDLE_THICKNESS - BALL_RADIUS;
      playSound("hit", Math.abs(b.vx));
      state.shake = reducedMotion() ? 0 : 6;
    }

    // score left/right
    if (b.x < -BALL_RADIUS) {
      state.scores.cpu += 1;
      state.streak = 0;
      updateHud();
      playSound("score", 1);
      if (state.scores.cpu >= state.target) handleGameOver("cpu"); else resetBall(1);
    }
    if (b.x > CANVAS_W + BALL_RADIUS) {
      state.scores.player += 1;
      state.streak += 1;
      popScore(els.scorePlayer);
      updateHud();
      playSound("score", 1);
      if (state.scores.player >= state.target) handleGameOver("player"); else resetBall(-1);
    }

    if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.6);
    trail.push({ x: b.x, y: b.y });
    if (trail.length > (reducedMotion() ? 3 : 10)) trail.shift();
  }

  function render() {
    const acc = cssVar("--os-accent", "#ffffff");
    const bg = cssVar("--os-bg", "#000000");
    const fg = cssVar("--os-fg", "#ffffff");
    const muted = cssVar("--os-muted", "#888888");

    ctx.save();
    if (state.shake > 0 && !reducedMotion()) {
      const s = state.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40);

    // net
    ctx.strokeStyle = muted;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 8);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    // paddles
    ctx.fillStyle = fg;
    ctx.fillRect(state.paddlePlayer.x, state.paddlePlayer.y, PADDLE_THICKNESS, PADDLE_HEIGHT);
    ctx.fillRect(state.paddleCpu.x, state.paddleCpu.y, PADDLE_THICKNESS, PADDLE_HEIGHT);

    // trail
    if (!reducedMotion()) {
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        ctx.globalAlpha = (i + 1) / (trail.length + 1) * 0.5;
        ctx.fillStyle = acc;
        ctx.beginPath();
        ctx.arc(p.x, p.y, BALL_RADIUS * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ball
    ctx.fillStyle = fg;
    ctx.shadowColor = acc;
    ctx.shadowBlur = reducedMotion() ? 0 : 14;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // fps hidden (no analytics overlay in improved version)
  }

  function loop() {
    if (destroyed) return;
    updatePhysics();
    render();
  }

  function ensureLoop() {
    if (intervalId !== null) return;
    intervalId = window.setInterval(loop, 1000 / FRAMES_PER_SECOND);
  }
  function syncLoop() {
    if (state.status === "playing") ensureLoop(); else if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  }

  function syncSettingsLock(lock) {
    if (els.difficulty) els.difficulty.disabled = lock && state.status === "playing";
    if (els.target) els.target.disabled = lock && state.status === "playing";
  }
  function syncSegButtons() {
    if (els.segButtons) els.segButtons.forEach((b) => { const active = b.dataset.diff === state.difficulty; b.classList.toggle("active", active); b.setAttribute("aria-pressed", String(active)); });
  }
  function syncAudioSwitch() {
    if (els.audioToggle) els.audioToggle.setAttribute("aria-checked", String(prefs.audio !== false));
  }

  // inputs
  function pointerToPaddle(clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.height) return;
    const y = (clientY - rect.top) * (CANVAS_H / rect.height);
    state.paddlePlayer.y = clamp(y - PADDLE_HEIGHT / 2, 0, CANVAS_H - PADDLE_HEIGHT);
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.focus();
    state.pointerActive = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    pointerToPaddle(e.clientY);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (state.pointerActive || e.buttons > 0) pointerToPaddle(e.clientY);
  });
  canvas.addEventListener("pointerup", () => { state.pointerActive = false; });
  canvas.addEventListener("pointercancel", () => { state.pointerActive = false; });

  window.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "ArrowUp" || key === "w") { state.keys.up = true; e.preventDefault(); }
    else if (key === "ArrowDown" || key === "s") { state.keys.down = true; e.preventDefault(); }
    else if (key === " ") { e.preventDefault(); pauseGame(); }
    else if (key === "Enter" || key === "r") { e.preventDefault(); startGame(); }
    else if (key === "m") {
      prefs.audio = !prefs.audio;
      if (els.audioEnabled) els.audioEnabled.checked = prefs.audio;
      syncAudioSwitch();
      saveStats();
    }
  });
  window.addEventListener("keyup", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === "ArrowUp" || key === "w") state.keys.up = false;
    else if (key === "ArrowDown" || key === "s") state.keys.down = false;
  });
  window.addEventListener("blur", () => { if (state.status === "playing") pauseGame(); });

  // UI bindings
  if (els.btnStart) els.btnStart.addEventListener("click", startGame);
  if (els.btnPause) els.btnPause.addEventListener("click", pauseGame);
  if (els.btnRestart) els.btnRestart.addEventListener("click", startGame);
  if (els.overlayCta) els.overlayCta.addEventListener("click", () => {
    if (state.status === "gameover" || state.status === "ready") startGame();
    else if (state.status === "paused") pauseGame();
    else if (state.status === "playing") pauseGame();
  });
  if (els.btnFullscreen) els.btnFullscreen.addEventListener("click", async () => {
    if (window.os && os.shell && typeof os.shell.toggleFullscreen === "function") {
      try { await os.shell.toggleFullscreen(); } catch (e) {}
    }
  });
  if (els.btnSettings) els.btnSettings.addEventListener("click", () => {
    const hidden = els.options.classList.toggle("hidden");
    els.btnSettings.setAttribute("aria-expanded", String(!hidden));
  });

  // new UI hooks
  if (els.segButtons && els.segButtons.length) {
    els.segButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.diff;
        if (!v) return;
        els.segButtons.forEach((b) => { b.classList.toggle("active", b.dataset.diff === v); b.setAttribute("aria-pressed", String(b.dataset.diff === v)); });
        if (els.difficulty) els.difficulty.value = v;
        state.difficulty = v;
        prefs.difficulty = v;
        if (state.status === "playing" || state.status === "paused") {
          const serveDirection = state.ball.vx >= 0 ? 1 : -1;
          resetBall(serveDirection);
        } else {
          resetMatch();
          state.status = "ready";
          showOverlay("Retro Ping-Pong", "Preparado.", "Iniciar");
        }
        updateHud(); saveStats();
      });
    });
  }
  if (els.targetInc) els.targetInc.addEventListener("click", () => {
    state.target = clamp(state.target + 1, 5, 50);
    prefs.target = state.target;
    resetMatch();
    if (state.status !== "playing") { state.status = "ready"; showOverlay("Retro Ping-Pong", "Preparado.", "Iniciar"); }
    updateHud(); saveStats();
  });
  if (els.targetDec) els.targetDec.addEventListener("click", () => {
    state.target = clamp(state.target - 1, 5, 50);
    prefs.target = state.target;
    resetMatch();
    if (state.status !== "playing") { state.status = "ready"; showOverlay("Retro Ping-Pong", "Preparado.", "Iniciar"); }
    updateHud(); saveStats();
  });
  if (els.btnHideHud) els.btnHideHud.addEventListener("click", () => toggleHud());

  if (els.audioToggle) els.audioToggle.addEventListener("click", () => {
    const next = els.audioToggle.getAttribute("aria-checked") !== "true";
    els.audioToggle.setAttribute("aria-checked", String(next));
    prefs.audio = next;
    if (els.audioEnabled) els.audioEnabled.checked = next;
    saveStats();
  });
  if (els.difficulty) els.difficulty.addEventListener("change", (e) => {
    state.difficulty = e.target.value;
    prefs.difficulty = state.difficulty;
    resetMatch();
    if (state.status !== "playing") { state.status = "ready"; showOverlay("Retro Ping-Pong", "Preparado.", "Iniciar"); }
    updateHud(); saveStats();
  });
  if (els.target) els.target.addEventListener("change", (e) => {
    state.target = Number(e.target.value) || 10;
    prefs.target = state.target;
    resetMatch();
    if (state.status !== "playing") { state.status = "ready"; showOverlay("Retro Ping-Pong", "Preparado.", "Iniciar"); }
    updateHud(); saveStats();
  });
  if (els.audioEnabled) els.audioEnabled.addEventListener("change", (e) => {
    prefs.audio = e.target.checked;
    saveStats();
  });

  function destroy() {
    destroyed = true;
    if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    window.removeEventListener("keydown", null);
  }
  window.addEventListener("pagehide", destroy, { once: true });

  // init
  async function init() {
    state.difficulty = prefs.difficulty || "normal";
    state.target = prefs.target || 10;
    await loadPrefs();
    resetMatch();
    state.status = "ready";
    showOverlay("Retro Ping-Pong", "Mover jogador com rato/toque ou teclado.", "Iniciar");
    syncLoop();
    applyI18n();

    if (window.os && os.on) {
      os.on("theme:changed", () => render());
      os.on("locale:changed", () => applyI18n());
      os.on("fullscreen:changed", (d) => { if (els.btnFullscreen) els.btnFullscreen.textContent = (d && d.active) ? "Sair Fullscreen" : "Ecrã inteiro"; });
    }
    if (window.os && os.i18n && os.i18n.onChange) os.i18n.onChange(applyI18n);
    if (window.os && os.shell && os.shell.isFullscreen) {
      os.shell.isFullscreen().then((a) => { if (els.btnFullscreen) els.btnFullscreen.textContent = a ? "Sair Fullscreen" : "Ecrã inteiro"; }).catch(() => {});
    }
    canvas.focus();
  }

  // ensure DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { init(); }, { once: true });
  } else {
    init();
  }
})();
