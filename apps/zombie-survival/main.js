import { initGame, resetGame, initGameState, loop, togglePause, applyGameSettings, choosePerk, refreshWeaponSlots, syncBestRunUI, renderSafehouseScreen } from './game.js';
import { loadCharacterLook, applyCharacterLook, applyCharacterLookFromInputs, drawCharacterPreview, initCharacter } from './character.js'; // <-- adicionado initCharacter
import { initAudioIfNeeded, setAudioVolume, setAudioMuted, resumeAudio, getAudioState } from './audio.js';
import { setupInput } from './input.js';
import { initUI } from './ui.js';
import { initRenderer } from './render.js';
import { buildGround, buildDebris, buildObstacles, initAmbient } from './world.js';
import { state } from './state.js';
import { renderAchievementsScreen } from './achievements.js';
import { MAPS, MAP_STORAGE_KEY, SCRAP_STORAGE_KEY, UPGRADES_STORAGE_KEY } from './constants.js';
import { initAppStorage, getStoredValue, setStoredValue } from './persistence.js';
import { startTutorial, advanceTutorial, finishTutorial } from './tutorial.js';

async function startGame() {
await initAppStorage([
  MAP_STORAGE_KEY,
  'nightnine-best-run-v1',
  'nightnine-settings-v1',
  'nightnine-character-v1',
  'nightnine-achievements-v1',
  'nightnine-lifetime-stats-v1',
  SCRAP_STORAGE_KEY,
  UPGRADES_STORAGE_KEY
]);

// ... resto do código igual
// Inicializar elementos DOM e canvas
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;

// Carregar mapa selecionado ANTES de construir o mundo pela primeira vez,
// para que a paleta/obstáculos corretos já sejam usados no primeiro build.
(function loadInitialMap() {
  try {
    const raw = getStoredValue(MAP_STORAGE_KEY);
    if (raw && MAPS[raw]) state.selectedMap = raw;
    const rawSettings = getStoredValue('nightnine-settings-v1');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (parsed && parsed.gameMode) state.selectedMode = parsed.gameMode;
    }
  } catch (err) { /* ignore */ }
})();

// Construir mundo
buildGround();
buildDebris();
buildObstacles();
initAmbient();

// Inicializar módulos
initUI();
initGame(canvas, ctx, W, H);

initCharacter();
document.getElementById('controls-hint').style.display = 'none';
// Configurar inputs
setupInput(canvas, 
  document.getElementById('joystick-zone'),
  document.getElementById('joystick-nub'),
  document.getElementById('fire-btn'),
  document.getElementById('aim-zone'),
  document.getElementById('aim-nub')
);

// Eventos de UI
document.getElementById('start-btn').addEventListener('click', () => {
  initAudioIfNeeded();
  resumeAudio();
  initGameState(true);
  startTutorial(() => {
    initGameState(false);
    canvas.focus();
  });
  canvas.focus();
});

document.getElementById('tutorial-next-btn').addEventListener('click', advanceTutorial);
document.getElementById('skip-tutorial-btn').addEventListener('click', finishTutorial);

document.getElementById('retry-btn').addEventListener('click', () => {
  initAudioIfNeeded();
  resumeAudio();
  document.getElementById('death-screen').classList.add('hidden');
  resetGame();
});
document.getElementById('menu-from-death-btn').addEventListener('click', goToMainMenu);


document.getElementById('perk-a').addEventListener('click', () => choosePerk(0));
document.getElementById('perk-b').addEventListener('click', () => choosePerk(1));
document.getElementById('perk-c').addEventListener('click', () => choosePerk(2));

document.getElementById('resume-btn').addEventListener('click', () => togglePause(false));
document.getElementById('mute-btn').addEventListener('click', () => {
  const muted = document.getElementById('mute-btn').textContent.includes('ON');
  const next = !muted;
  setAudioMuted(next);
  try {
    const as = getAudioState();
    setStoredValue('nightnine-settings-v1', JSON.stringify({ difficulty: state.selectedDifficulty, playerClass: state.selectedClass, audioVolume: as.volume, audioMuted: next }));
  } catch (e) {}
});
document.getElementById('volume-slider').addEventListener('input', (e) => {
  const v = parseInt(e.target.value, 10) / 100;
  setAudioVolume(v);
  try {
    const as = getAudioState();
    setStoredValue('nightnine-settings-v1', JSON.stringify({ difficulty: state.selectedDifficulty, playerClass: state.selectedClass, audioVolume: v, audioMuted: as.muted }));
  } catch (e) {}
});

document.getElementById('customize-btn').addEventListener('click', () => {
  document.getElementById('customize-screen').classList.remove('hidden');
  drawCharacterPreview();
});
document.getElementById('back-custom-btn').addEventListener('click', () => {
  document.getElementById('customize-screen').classList.add('hidden');
});
document.getElementById('apply-custom-btn').addEventListener('click', () => {
  applyCharacterLookFromInputs(true);
  document.getElementById('customize-screen').classList.add('hidden');
});
for (const id of ['custom-outfit', 'custom-skin', 'custom-hat', 'custom-backpack', 'custom-mask']) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => applyCharacterLookFromInputs(false));
}

document.getElementById('achievements-btn').addEventListener('click', () => {
  renderAchievementsScreen();
  document.getElementById('achievements-screen').classList.remove('hidden');
});
document.getElementById('back-achievements-btn').addEventListener('click', () => {
  document.getElementById('achievements-screen').classList.add('hidden');
});

const safehouseBtn = document.getElementById('safehouse-btn');
if (safehouseBtn) {
  safehouseBtn.addEventListener('click', () => {
    renderSafehouseScreen();
    const screen = document.getElementById('safehouse-screen');
    if (screen) screen.classList.remove('hidden');
  });
}
const backSafehouseBtn = document.getElementById('back-safehouse-btn');
if (backSafehouseBtn) {
  backSafehouseBtn.addEventListener('click', () => {
    const screen = document.getElementById('safehouse-screen');
    if (screen) screen.classList.add('hidden');
  });
}

document.getElementById('fullscreen-btn').addEventListener('click', () => toggleFullscreen());
document.getElementById('pause-fullscreen-btn').addEventListener('click', () => toggleFullscreen());
document.addEventListener('fullscreenchange', syncFullscreenButtons);

function toggleFullscreen() {
  const stage = document.getElementById('stage');
  if(!stage) return;
  if(!document.fullscreenElement) {
    stage.requestFullscreen().catch(()=>{});
  } else {
    document.exitFullscreen().catch(()=>{});
  }
}

function syncFullscreenButtons() {
  const txt = 'FULLSCREEN: ' + (document.fullscreenElement ? 'ON' : 'OFF');
  document.getElementById('fullscreen-btn').textContent = txt;
  document.getElementById('pause-fullscreen-btn').textContent = txt;
}

function goToMainMenu() {
  // Para o jogo e mostra o ecrã inicial
  resetGame(); // reseta o jogo e para o loop (isto esconde o start-screen internamente)
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  document.getElementById('perk-screen').classList.add('hidden');
  const commandsHint = document.getElementById('controls-hint');
  if (commandsHint) commandsHint.style.display = 'none'; // esconde comandos se existir
  // O resetGame já define state.gameRunning = false, mas por segurança:
  state.gameRunning = false;
  state.paused = false;
}

document.getElementById('menu-btn').addEventListener('click', goToMainMenu);


// Dificuldade e classe
document.getElementById('difficulty-select').addEventListener('change', applyGameSettings);

document.getElementById('mode-select')?.addEventListener('change', (e) => {
  state.selectedMode = e.target.value;
  try {
    const raw = getStoredValue('nightnine-settings-v1');
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.gameMode = e.target.value;
    setStoredValue('nightnine-settings-v1', JSON.stringify(parsed));
  } catch (err) {}
});
document.getElementById('class-select').addEventListener('change', applyGameSettings);

// Mapa — sincronizar o <select> com o que já foi carregado no arranque
function syncMapDescription() {
  const mapSelect = document.getElementById('map-select');
  const label = document.getElementById('map-desc-label');
  if (!mapSelect || !label) return;
  if (mapSelect.value === 'random') {
    label.textContent = '🎲 A random map will be chosen when you start a run.';
  } else {
    const map = MAPS[mapSelect.value] || MAPS.forest;
    label.textContent = map.desc;
  }
}
const mapSelectEl = document.getElementById('map-select');
if (document.getElementById('mode-select')) {
  document.getElementById('mode-select').value = state.selectedMode || 'standard';
}
if (mapSelectEl) {
  mapSelectEl.value = state.selectedMap;
  syncMapDescription();
  mapSelectEl.addEventListener('change', () => {
    const value = mapSelectEl.value;
    state.selectedMap = value;
    setStoredValue(MAP_STORAGE_KEY, value);
    syncMapDescription();
    // Se for 'random', não reconstruímos já; o sorteio acontece no início da run
    if (value !== 'random') {
      buildGround();
      buildDebris();
      buildObstacles();
    }
  });
}

// Carregar preferências
applyGameSettings();
syncBestRunUI();
refreshWeaponSlots();
try {
  const rawSettings = getStoredValue('nightnine-settings-v1');
  const parsed = rawSettings ? JSON.parse(rawSettings) : null;
  const vol = (parsed && Number.isFinite(parsed.audioVolume)) ? parsed.audioVolume : 0.7;
  const muted = (parsed && typeof parsed.audioMuted === 'boolean') ? parsed.audioMuted : false;
  setAudioVolume(vol);
  setAudioMuted(muted);
} catch (err) {
  setAudioVolume(0.7);
window.runtimeGameMode = 'standard';
  setAudioMuted(false);
}
syncFullscreenButtons();

// Iniciar loop
document.getElementById('bestiary-btn').addEventListener('click', async () => {
  const { BESTIARY } = await import('./constants.js');
  const list = document.getElementById('bestiary-list');
  if (list) {
    list.innerHTML = '';
    (BESTIARY || []).forEach(z => {
      const row = document.createElement('div');
      row.className = 'ach-row';
      row.innerHTML = '<div class="ach-text"><div class="ach-name">' + z.name + '</div><div class="ach-desc">' + z.desc + '</div></div>';
      list.appendChild(row);
    });
  }
  document.getElementById('bestiary-screen').classList.remove('hidden');
});
document.getElementById('back-bestiary-btn').addEventListener('click', () => document.getElementById('bestiary-screen').classList.add('hidden'));
document.getElementById('armory-btn').addEventListener('click', async () => {
  const { WEAPONS } = await import('./constants.js');
  const list = document.getElementById('armory-list');
  if (list) {
    list.innerHTML = '';
    WEAPONS.forEach(w => {
      const row = document.createElement('div');
      row.className = 'ach-row';
      row.innerHTML = '<div class="ach-text"><div class="ach-name">' + w.icon + ' ' + w.name.toUpperCase() + '</div><div class="ach-desc">DMG ' + w.dmg + ' · RATE ' + w.fireRate + ' · WAVE ' + w.unlockedWave + '</div></div>';
      list.appendChild(row);
    });
  }
  document.getElementById('armory-screen').classList.remove('hidden');
});
document.getElementById('back-armory-btn').addEventListener('click', () => document.getElementById('armory-screen').classList.add('hidden'));
requestAnimationFrame(loop);
}

startGame();
