import { initGame, resetGame, initGameState, loop, togglePause, applyGameSettings, choosePerk, refreshWeaponSlots, syncBestRunUI } from './game.js';
import { loadCharacterLook, applyCharacterLook, applyCharacterLookFromInputs, drawCharacterPreview, initCharacter } from './character.js'; // <-- adicionado initCharacter
import { initAudioIfNeeded, setAudioVolume, setAudioMuted, resumeAudio } from './audio.js';
import { setupInput } from './input.js';
import { initUI } from './ui.js';
import { initRenderer } from './render.js';
import { buildGround, buildDebris, buildObstacles, initAmbient } from './world.js';
import { state } from './state.js';
import { renderAchievementsScreen } from './achievements.js';
import { MAPS, MAP_STORAGE_KEY } from './constants.js';
import { initAppStorage, getStoredValue, setStoredValue } from './persistence.js';

async function startGame() {
await initAppStorage([
  MAP_STORAGE_KEY,
  'nightnine-best-run-v1',
  'nightnine-settings-v1',
  'nightnine-character-v1',
  'nightnine-achievements-v1',
  'nightnine-lifetime-stats-v1'
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
  document.getElementById('fire-btn')
);

// Eventos de UI
document.getElementById('start-btn').addEventListener('click', () => {
  initAudioIfNeeded();
  resumeAudio();
  document.getElementById('start-screen').classList.add('hidden');
  initGameState(false); // modo tutorial
  canvas.focus();
});

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
  setAudioMuted(!muted);
});
document.getElementById('volume-slider').addEventListener('input', (e) => {
  setAudioVolume(parseInt(e.target.value, 10) / 100);
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
setAudioVolume(70/100);
setAudioMuted(false);
syncFullscreenButtons();

// Iniciar loop
requestAnimationFrame(loop);
}

startGame();