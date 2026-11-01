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
import { mergeSettings } from './settings-rules.js';
import { restoreMapSelection } from './map-rules.js';

const ZOMBIE_I18N = {
  'hud.vitals': { pt: 'Vitals', en: 'Vitals' },
  'hud.minimap': { pt: 'Minimap', en: 'Minimap' },
  'hud.utility': { pt: 'Utilidade', en: 'Utility' },
  'hud.medkit': { pt: 'MEDKIT', en: 'MEDKIT' },
  'hud.dash': { pt: 'DASH', en: 'DASH' },
  'hud.status': { pt: 'Estado', en: 'Status' },
  'hud.playerStatus': { pt: 'ESTADO DO JOGADOR', en: 'PLAYER STATUS' },
  'hud.night': { pt: 'Noite', en: 'Night' },
  'hud.kills': { pt: 'Mortes', en: 'Kills' },
  'hud.level': { pt: 'Nível', en: 'Level' },
  'hud.ammo': { pt: 'Munição', en: 'Ammo' },
  'hud.activeWeapon': { pt: '(arma ativa)', en: '(active weapon)' },
  'hud.run': { pt: 'Run', en: 'Run' },
  'hud.time': { pt: 'TEMPO', en: 'TIME' },
  'hud.remaining': { pt: 'RESTANTES', en: 'REMAINING' },
  'hud.weather': { pt: 'CLIMA', en: 'WEATHER' },
  'hud.objective': { pt: 'OBJETIVO', en: 'OBJECTIVE' },
  'menu.difficulty': { pt: 'DIFICULDADE', en: 'DIFFICULTY' },
  'menu.class': { pt: 'CLASSE', en: 'CLASS' },
  'menu.mode': { pt: 'MODO', en: 'MODE' },
  'menu.map': { pt: 'MAPA', en: 'MAP' },
  'menu.safehouse': { pt: 'SAFEHOUSE', en: 'SAFEHOUSE' },
  'menu.customize': { pt: 'PERSONALIZAR', en: 'CUSTOMIZE SURVIVOR' },
  'menu.achievements': { pt: 'CONQUISTAS', en: 'ACHIEVEMENTS' },
  'menu.bestiary': { pt: 'BESTIÁRIO', en: 'BESTIARY' },
  'menu.armory': { pt: 'ARMAMENTO', en: 'ARMORY' },
  'menu.back': { pt: 'VOLTAR', en: 'BACK' },
  'menu.enterDark': { pt: '▶ ENTRAR NA NOITE', en: '▶ ENTER THE DARK' },
  'menu.randomMap': { pt: '🎲 Um mapa aleatório será escolhido ao iniciar a run.', en: '🎲 A random map will be chosen when you start a run.' },
  'menu.startingTip': { pt: 'Use WASD para se mover', en: 'Use WASD to move' },
  'menu.death.nights': { pt: 'NOITES SOBREVIVIDAS: ', en: 'NIGHTS SURVIVED: ' },
  'menu.death.kills': { pt: 'ZOMBIES ELIMINADOS: ', en: 'ZOMBIES SLAIN: ' },
  'menu.death.level': { pt: 'NÍVEL ALCANÇADO: ', en: 'LEVEL REACHED: ' },
  'menu.death.time': { pt: 'TEMPO SOBREVIVIDO: ', en: 'TIME SURVIVED: ' },
  'menu.death.combo': { pt: 'MELHOR COMBO: ', en: 'BEST COMBO: ' },
  'menu.death.best': { pt: 'MELHOR RUN: ', en: 'BEST RUN: ' },
  'menu.safehouseTitle': { pt: 'SAFEHOUSE', en: 'SAFEHOUSE' },
  'menu.achievementsTitle': { pt: 'CONQUISTAS', en: 'ACHIEVEMENTS' },
  'menu.bestiaryTitle': { pt: 'BESTIÁRIO', en: 'BESTIARY' },
  'menu.armoryTitle': { pt: 'ARMAMENTO', en: 'ARMORY' },
  'menu.customizeTitle': { pt: 'PERSONALIZAR', en: 'CUSTOMIZE' },
  'menu.levelUp': { pt: 'NÍVEL UP', en: 'LEVEL UP' },
  'menu.paused': { pt: 'PAUSADO', en: 'PAUSED' },
  'menu.resume': { pt: '▶ CONTINUAR', en: '▶ RESUME' },
  'menu.apply': { pt: 'APLICAR', en: 'APPLY' },
  'menu.fullscreen': { pt: 'ECRÃ COMPLETO: OFF', en: 'FULLSCREEN: OFF' },
  'menu.mute': { pt: 'MUTE: OFF', en: 'MUTE: OFF' },
  'ui.confirm': { pt: 'CONTINUAR', en: 'CONTINUE' },
  'ui.skip': { pt: 'PULAR TUTORIAL', en: 'SKIP TUTORIAL' },
  'ui.back': { pt: 'VOLTAR', en: 'BACK' },
  'ui.menu': { pt: '🏠 MENU', en: '🏠 MENU' },
  'ui.retry': { pt: '↺ RISE AGAIN', en: '↺ RISE AGAIN' },
  'ui.achievementUnlocked': { pt: 'CONQUISTA DESBLOQUEADA', en: 'ACHIEVEMENT UNLOCKED' },
};

function currentZombieLanguage() {
  return window.os?.i18n?.language === 'en' ? 'en' : 'pt';
}

function applyZombieLanguage() {
  const lang = currentZombieLanguage();
  const nodes = document.querySelectorAll('[data-i18n]');
  for (const node of nodes) {
    const key = node.dataset.i18n;
    const text = ZOMBIE_I18N[key]?.[lang];
    if (text) node.textContent = text;
  }
  if (document.documentElement) {
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-PT';
  }
}

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
    state.selectedMap = restoreMapSelection(raw, MAPS);
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
applyZombieLanguage();
if (window.os?.i18n?.onChange) {
  window.os.i18n.onChange(() => applyZombieLanguage());
}
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
function syncAudioControls(volume, muted) {
  document.getElementById('volume-slider').value = Math.round(volume * 100);
  document.getElementById('mute-btn').textContent = 'MUTE: ' + (muted ? 'ON' : 'OFF');
}
document.getElementById('mute-btn').addEventListener('click', () => {
  const next = !getAudioState().muted;
  setAudioMuted(next);
  const audioState = getAudioState();
  syncAudioControls(audioState.volume, audioState.muted);
  try {
    setStoredValue('nightnine-settings-v1', mergeSettings(getStoredValue('nightnine-settings-v1'), { difficulty: state.selectedDifficulty, playerClass: state.selectedClass, audioVolume: audioState.volume, audioMuted: audioState.muted }));
  } catch (e) {}
});
document.getElementById('volume-slider').addEventListener('input', (e) => {
  const v = parseInt(e.target.value, 10) / 100;
  setAudioVolume(v);
  try {
    const as = getAudioState();
    syncAudioControls(as.volume, as.muted);
    setStoredValue('nightnine-settings-v1', mergeSettings(getStoredValue('nightnine-settings-v1'), { difficulty: state.selectedDifficulty, playerClass: state.selectedClass, audioVolume: v, audioMuted: as.muted }));
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
    setStoredValue('nightnine-settings-v1', mergeSettings(raw, { gameMode: e.target.value }));
  } catch (err) {}
});
document.getElementById('class-select').addEventListener('change', applyGameSettings);

// Mapa — sincronizar o <select> com o que já foi carregado no arranque
function syncMapDescription() {
  const mapSelect = document.getElementById('map-select');
  const label = document.getElementById('map-desc-label');
  if (!mapSelect || !label) return;
  if (mapSelect.value === 'random') {
    label.textContent = ZOMBIE_I18N['menu.randomMap'][currentZombieLanguage()];
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
    state.runtimeMap = value === 'random' ? null : value;
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
  syncAudioControls(vol, muted);
} catch (err) {
  setAudioVolume(0.7);
  setAudioMuted(false);
  syncAudioControls(0.7, false);
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
