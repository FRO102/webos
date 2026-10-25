import { MAPS, WEAPONS, PERKS, PERK_RARITY_WEIGHTS, RARITY_COLOR, WORLD_W, WORLD_H, STORAGE_KEY, DIFFICULTY_MODS, CLASS_MODS, SCRAP_STORAGE_KEY, UPGRADES_STORAGE_KEY, SAFEHOUSE_UPGRADES } from './constants.js';
import { clamp, rand, randInt } from './utils.js';
import { initAudioIfNeeded, playSound, resumeAudio } from './audio.js';
import { keys, mouseDown, touchFiring, rightMouseDown, joystickVec, mouseX, mouseY } from './input.js';
import { state, isWeaponUnlocked, resetState } from './state.js';
import { resetPlayerState, shoot, reload, switchWeapon, cycleWeapon, tryUseMedkit, tryDash, meleeAttack, gainXP, applyIncomingDamage } from './player.js';
import { waveComposition, spawnZombie, killZombie, updateZombies, resetEnemies, pickBossVariant } from './enemies.js';
import { updateBullets, updateGrenades, updateEnemyProjectiles, updateShockwaves } from './projectiles.js';
import { updatePickups, updateParticles, spawnFloatText, spawnBloodSplat, addParticle } from './pickups.js';
import { updateWeather, updateAmbient, obstacles,  buildGround, buildDebris, buildObstacles  } from './world.js';
import { render, setCamera, setShake, initRenderer } from './render.js';
import { dom, syncHUD, updateDamageIndicators, decayCombo, triggerDamageIndicator, damageIndicators, initUI, refreshWeaponSlotsUI } from './ui.js';
import { playerLook, applyCharacterLook, drawCharacterPreview, initCharacter, loadCharacterLook, saveCharacterLook } from './character.js';
import { loadAchievements, loadLifetimeStats, saveLifetimeStats, checkAchievements, renderAchievementsScreen, resetExplosiveKillCounter, unlockedCount, ACHIEVEMENTS } from './achievements.js';
import { getStoredValue, setStoredValue } from './persistence.js';

let canvas, ctx, W, H;
let hpBeforeWave = 100; // usado para o achievement "Untouched"
let footstepTimer = 0; // acumulador local para poeira de passos (não precisa persistir entre runs)

// ---- Funções de persistência ----
export function saveBestRun() {
  setStoredValue(STORAGE_KEY, JSON.stringify(state.bestRun));
}
export function loadBestRun() {
  try {
    const raw = getStoredValue(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.kills) && Number.isFinite(parsed.wave) && Number.isFinite(parsed.level)) {
      state.bestRun = { kills: parsed.kills, wave: parsed.wave, level: parsed.level };
    }
  } catch (err) { }
}
export function bestRunText() {
  return state.bestRun.kills + ' KILLS | NIGHT ' + state.bestRun.wave + ' | LV ' + state.bestRun.level;
}
export function syncBestRunUI() {
  dom.bestRun.textContent = 'BEST: ' + bestRunText();
  dom.statBest.textContent = bestRunText();
  const lifetimeEl = document.getElementById('lifetime-stats');
  if (lifetimeEl) {
    lifetimeEl.textContent = 'TOTAL: ' + state.lifetimeStats.totalKills + ' KILLS | ' +
      state.lifetimeStats.totalRuns + ' RUNS | ' + unlockedCount() + '/' + ACHIEVEMENTS.length + ' ACHIEVEMENTS';
  }
}

export function loadSettings() {
  try {
    const raw = getStoredValue('nightnine-settings-v1');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.difficulty) state.selectedDifficulty = parsed.difficulty;
    if (parsed && parsed.playerClass) state.selectedClass = parsed.playerClass;
  } catch (err) { }
}

export function loadScrapAndUpgrades() {
  try {
    const rawScrap = getStoredValue(SCRAP_STORAGE_KEY);
    if (rawScrap !== null && rawScrap !== undefined) {
      state.scrap = parseInt(rawScrap, 10) || 0;
    }
    const rawUpg = getStoredValue(UPGRADES_STORAGE_KEY);
    if (rawUpg) {
      const parsed = JSON.parse(rawUpg);
      if (parsed && typeof parsed === 'object') {
        for (const k of Object.keys(state.safehouseUpgrades)) {
          if (Number.isFinite(parsed[k])) state.safehouseUpgrades[k] = parsed[k];
        }
      }
    }
  } catch (err) {}
}

export function saveScrapAndUpgrades() {
  setStoredValue(SCRAP_STORAGE_KEY, String(state.scrap));
  setStoredValue(UPGRADES_STORAGE_KEY, JSON.stringify(state.safehouseUpgrades));
}

export function renderSafehouseScreen() {
  const container = document.getElementById('safehouse-upgrades-list');
  const scrapEl = document.getElementById('safehouse-scrap-count');
  if (!container || !scrapEl) return;
  scrapEl.textContent = state.scrap;
  container.innerHTML = '';
  
  SAFEHOUSE_UPGRADES.forEach(u => {
    const lvl = state.safehouseUpgrades[u.id] || 0;
    const cost = Math.round(u.costBase * Math.pow(u.costScale, lvl));
    const isMax = lvl >= u.maxLevel;
    
    const row = document.createElement('div');
    row.className = 'ach-row';
    row.innerHTML = `
      <div class="ach-icon">⚙️</div>
      <div class="ach-text">
        <div class="ach-name">${u.name} (Lvl ${lvl}/${u.maxLevel})</div>
        <div class="ach-desc">${u.desc}</div>
      </div>
      <div>
        <button class="btn" style="padding:6px 12px;font-size:12px;" ${isMax || state.scrap < cost ? 'disabled' : ''}>
          ${isMax ? 'MAX' : 'BUY (' + cost + ' SCRAP)'}
        </button>
      </div>
    `;
    const btn = row.querySelector('button');
    if (!isMax) {
      btn.addEventListener('click', () => {
        if (state.scrap >= cost) {
          state.scrap -= cost;
          state.safehouseUpgrades[u.id] = lvl + 1;
          saveScrapAndUpgrades();
          renderSafehouseScreen();
          playSound(600, 0.1, 'triangle', 0.05);
        }
      });
    }
    container.appendChild(row);
  });
}

export function applyGameSettings() {
  const diff = document.getElementById('difficulty-select').value;
  const cls = document.getElementById('class-select').value;
  state.selectedDifficulty = diff;
  state.selectedClass = cls;
  state.difficultyMod = DIFFICULTY_MODS[diff];
  state.classMod = CLASS_MODS[cls] || CLASS_MODS.assault;
  try {
    setStoredValue('nightnine-settings-v1', JSON.stringify({ difficulty: diff, playerClass: cls }));
  } catch (err) { }
}

// ---- Iniciar onda ----
export function startWave(w) {
  state.wave = w;
  state.waveSpawnQueue = waveComposition(w);
  state.waveZombiesRemaining = state.waveSpawnQueue.length;
  state.waveActive = true;
  hpBeforeWave = state.player.hp;
  dom.waveNum.textContent = w;
  const bannerEl = document.getElementById('wave-banner');
  const bannerNum = document.getElementById('banner-num');
  const bannerSub = document.getElementById('banner-sub');
  bannerNum.textContent = w;
  const unlockedNow = WEAPONS.filter(weapon => weapon.unlockedWave === w && weapon.unlockedWave > 1);
  if (w % 5 === 0) {
    state.bossVariant = pickBossVariant(w);
    const variantFlavor = { brawler: 'RELENTLESS BRAWLER', summoner: 'THE SUMMONER', artillery: 'LIVING ARTILLERY' }[state.bossVariant] || 'BOSS NIGHT';
    bannerSub.textContent = 'BOSS NIGHT — ' + variantFlavor;
  }
  else if (unlockedNow.length > 0) bannerSub.textContent = unlockedNow.map(wp => wp.name.toUpperCase() + ' UNLOCKED').join(' • ');
  else bannerSub.textContent = w === 1 ? 'THEY ARE COMING' : 'THE HORDE GROWS';
  bannerEl.classList.add('show');
  setTimeout(() => bannerEl.classList.remove('show'), 1800);
  refreshWeaponSlots();
}

export function refreshWeaponSlots() {
  refreshWeaponSlotsUI();
}

// ---- Flash e morte ----
export function flashHit() {
  const flashEl = document.getElementById('flash');
  flashEl.style.opacity = 0.45;
  setTimeout(() => flashEl.style.opacity = 0, 90);
}

export function onPlayerDeath() {
  state.player.alive = false;
  state.gameRunning = false;
  playSound(55, 0.3, 'sawtooth', 0.1);
  saveScrapAndUpgrades();
  const isBest = state.killCount > state.bestRun.kills || (state.killCount === state.bestRun.kills && state.wave > state.bestRun.wave);
  if (isBest) {
    state.bestRun = { kills: state.killCount, wave: state.wave, level: state.player.level };
    saveBestRun();
  }
  state.lifetimeStats.totalRuns++;
  state.lifetimeStats.totalWavesCleared += Math.max(0, state.wave - 1);
  saveLifetimeStats();
  syncBestRunUI();
  setTimeout(() => {
    document.getElementById('stat-wave').textContent = state.wave;
    document.getElementById('stat-kills').textContent = state.killCount;
    document.getElementById('stat-level').textContent = state.player.level;
    document.getElementById('stat-combo').textContent = 'x' + state.bestComboThisRun.toFixed(1);
    const t = Math.floor((performance.now() - state.gameStartTime) / 1000);
    document.getElementById('stat-time').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    document.getElementById('stat-best').textContent = bestRunText();
    const achEl = document.getElementById('death-new-achievements');
    if (achEl) {
      achEl.innerHTML = '';
      for (const ach of state.newAchievementsThisRun) {
        const item = document.createElement('div');
        item.className = 'death-ach-item';
        item.textContent = ach.icon + ' ACHIEVEMENT UNLOCKED: ' + ach.name.toUpperCase();
        achEl.appendChild(item);
      }
    }
    document.getElementById('death-screen').classList.remove('hidden');
  }, 700);
  const controlsHint = document.getElementById('controls-hint');
  if (controlsHint) controlsHint.style.display = 'none';
}

// ---- Update do jogador ----
export function updatePlayer(dt) {
  if (!state.player.alive) return;
  if (state.dashCooldown > 0) state.dashCooldown -= dt;
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (joystickVec.x || joystickVec.y) { dx += joystickVec.x; dy += joystickVec.y; }

  const len = Math.hypot(dx, dy);
  const w = WEAPONS[state.player.weaponIdx];
  const sprinting = (keys['shift']) && len > 0 && (state.player.stamina > 1 || state.player.freeSprint);
  let spd = (sprinting ? state.player.sprintSpeed : state.player.speed) * w.speedMul;
  if (state.player.hasBerserker && state.player.hp / state.player.maxHp < 0.30) spd *= 1.2;

  if (state.dashDuration > 0) {
    state.dashDuration -= dt;
    state.player.x = clamp(state.player.x + state.dashVx * dt, state.player.r, WORLD_W - state.player.r);
    state.player.y = clamp(state.player.y + state.dashVy * dt, state.player.r, WORLD_H - state.player.r);
  } else if (len > 0) {
    dx /= len; dy /= len;
    let nx = state.player.x + dx * spd * dt;
    let ny = state.player.y + dy * spd * dt;
    nx = clamp(nx, state.player.r, WORLD_W - state.player.r);
    ny = clamp(ny, state.player.r, WORLD_H - state.player.r);
    // Colisão síncrona por eixo — permite deslizar ao longo de obstáculos
    let blockedX = false, blockedY = false;
    for (const o of obstacles) {
      if (o.hp <= 0) continue;
      if (nx + state.player.r > o.x - o.w / 2 && nx - state.player.r < o.x + o.w / 2 &&
          state.player.y + state.player.r > o.y - o.h / 2 && state.player.y - state.player.r < o.y + o.h / 2) {
        blockedX = true;
      }
      if (ny + state.player.r > o.y - o.h / 2 && ny - state.player.r < o.y + o.h / 2 &&
          state.player.x + state.player.r > o.x - o.w / 2 && state.player.x - state.player.r < o.x + o.w / 2) {
        blockedY = true;
      }
    }
    if (!blockedX) state.player.x = nx;
    if (!blockedY) state.player.y = ny;

    // Poeira de passos — ritmo mais rápido a sprintar
    footstepTimer -= dt;
    if (footstepTimer <= 0) {
      footstepTimer = sprinting ? 0.16 : 0.26;
      addParticle({
        x: state.player.x - Math.cos(state.player.angle) * 6 + rand(-3, 3),
        y: state.player.y - Math.sin(state.player.angle) * 6 + rand(-3, 3) + state.player.r * 0.6,
        vx: rand(-8, 8), vy: rand(-4, 2),
        life: 0.35, maxLife: 0.35, color: 'rgba(180,175,150,0.35)', size: rand(3, 5)
      });
    }
  }

  if (sprinting && state.dashDuration <= 0 && !state.player.freeSprint) {
    state.player.stamina = clamp(state.player.stamina - dt * 30, 0, state.player.maxStamina);
  } else if (!sprinting) {
    state.player.stamina = clamp(state.player.stamina + dt * 14, 0, state.player.maxStamina);
  }

  const worldMouseX = mouseX + state.camX;
  const worldMouseY = mouseY + state.camY;
  state.player.angle = Math.atan2(worldMouseY - state.player.y, worldMouseX - state.player.x);

  if (state.player.invuln > 0) state.player.invuln -= dt;
  if (state.shieldTimer > 0) state.shieldTimer -= dt;
  if (state.player.meleeCd > 0) state.player.meleeCd -= dt;

  if (state.fireTimer > 0) state.fireTimer -= dt;
  if (!mouseDown && !touchFiring && w.spinUp) {
    state.spinUpLevel = Math.max(0, (state.spinUpLevel || 0) - dt * 1.4);
  }
  if (state.reloading) {
    state.reloadTimer -= dt;
    if (state.reloadTimer <= 0) {
      state.reloading = false;
      const w2 = WEAPONS[state.player.weaponIdx];
      const st = state.ammoState[state.player.weaponIdx];
      const need = w2.mag - st.mag;
      const give = Math.min(need, st.reserve);
      st.mag += give;
      st.reserve -= give;
    }
  }
  if ((mouseDown || touchFiring) && !state.reloading) {
    shoot();
  }
}

// ---- Update das ondas ----
export function updateWaveLogic(dt) {
  state.spawnTimer -= dt;
  if (state.waveSpawnQueue.length > 0 && state.spawnTimer <= 0) {
    spawnZombie(state.waveSpawnQueue.shift());
    state.spawnTimer = Math.max(0.25, (1.1 - state.wave * 0.04) / state.difficultyMod.spawnMul);
  }
  // Remover mortos in-place
  for (let i = state.zombies.length - 1; i >= 0; i--) {
    if (state.zombies[i].hp <= 0) {
      state.zombies.splice(i, 1);
    }
  }

  if (state.waveActive && state.waveSpawnQueue.length === 0 && state.zombies.length === 0) {
    state.waveActive = false;
    state.waveTransitionTimer = 2.5;
    state.medkits += 1;
    state.scrap += 15;
    saveScrapAndUpgrades();
    state.player.armor = clamp(state.player.armor + 20, 0, state.player.maxArmor);
    state.player.undyingReady = true; // Undying recarrega no fim de cada night
    spawnFloatText(state.player.x, state.player.y - 26, '+WAVE SUPPLIES', '#d8cfa8');
    const centerMsg = document.getElementById('center-msg');
    centerMsg.textContent = 'NIGHT ' + state.wave + ' CLEARED';
    centerMsg.classList.add('show');
    state.lifetimeStats.totalWavesCleared++;
    checkAchievements({ type:'wave', wave: state.wave });
    if (state.player.hp >= hpBeforeWave) {
      checkAchievements({ type:'waveNoDamage' });
    }
    saveLifetimeStats();
  }
  if (!state.waveActive && state.waveTransitionTimer > 0) {
    state.waveTransitionTimer -= dt;
    if (state.waveTransitionTimer <= 0) {
      document.getElementById('center-msg').classList.remove('show');
      startWave(state.wave + 1);
    }
  }
}

// ---- Reset e init ----
export function resetGame() {
  initGameState(false);
}

export function initGameState(tutorial) {
      // Se o mapa selecionado for 'random', sortear um mapa real
  if (state.selectedMap === 'random') {
    const keys = Object.keys(MAPS);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    state.selectedMap = randomKey;
    // Reconstruir o mundo com o mapa sorteado
    buildGround();
    buildDebris();
    buildObstacles();
    // Atualizar o select para mostrar o mapa sorteado (opcional)
    const mapSelect = document.getElementById('map-select');
    if (mapSelect) mapSelect.value = randomKey;
  }


  state.tutorialMode = !!tutorial;
  applyGameSettings();
  resetPlayerState(state.classMod);
  resetEnemies();
  resetExplosiveKillCounter();
  state.zombies.length = 0;
  state.bullets.length = 0;
  state.grenades.length = 0;
  state.enemyProjectiles.length = 0;
  state.particles.length = 0;
  state.pickups.length = 0;
  state.floatTexts.length = 0;
  state.bloodPools.length = 0;
  state.killCount = 0;
  state.perkPending = false;
  state.perkChoices = [];
  state.paused = false;
  state.bossVariant = null;
  state.runPerksTaken = [];
  state.newAchievementsThisRun = [];
  document.getElementById('pause-screen').classList.add('hidden');
  state.comboCount = 0;
  state.comboTimer = 0;
  state.comboMult = 1;
  state.bestComboThisRun = 1;
  dom.comboEl.classList.remove('show');
  dom.comboEl.textContent = 'COMBO x1.0';
  damageIndicators.top = 0;
  damageIndicators.right = 0;
  damageIndicators.bottom = 0;
  damageIndicators.left = 0;
  state.weatherType = 'clear';
  state.weatherTimer = rand(14, 26);
  state.weatherStrength = rand(0.35, 0.7);
  state.screenShake = 0;


  const controlsHint = document.getElementById('controls-hint');
  if (controlsHint) {
    controlsHint.style.display = 'block';
  }
  if (tutorial) {
    state.ammoState.forEach((st, i) => { st.reserve = 999; st.mag = WEAPONS[i].mag; });
    state.medkits = 1;
    state.waveActive = false;
    state.waveSpawnQueue = [];
    state.tutorialWeaponsUnlocked = true;
  } else {
    state.tutorialWeaponsUnlocked = false;
    startWave(1);
  }

  switchWeapon(0);
  refreshWeaponSlots();
  state.gameStartTime = performance.now();
  state.gameRunning = true;
  document.getElementById('perk-screen').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.add('hidden');
}

export function togglePause(force) {
  const controlsHint = document.getElementById('controls-hint');
  if (!state.gameRunning || state.perkPending || !state.player.alive) return;
  state.paused = typeof force === 'boolean' ? force : !state.paused;
  document.getElementById('pause-screen').classList.toggle('hidden', !state.paused);
  if (!state.paused) resumeAudio();
  if (controlsHint) {
    controlsHint.style.display = state.paused ? 'none' : 'block';
  }
}

// ---- Perks (com raridade ponderada) ----
function weightedPerkPool() {
  // Devolve uma cópia dos PERKS com pesos ajustados pela raridade
  return PERKS.map(p => ({ perk: p, weight: PERK_RARITY_WEIGHTS[p.rarity] || 50 }));
}

function pickWeighted(pool) {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i].weight;
    if (r <= 0) return i;
  }
  return pool.length - 1;
}

export function randomPerkChoices(count) {
  const pool = weightedPerkPool();
  const out = [];
  while (out.length < count && pool.length > 0) {
    const idx = pickWeighted(pool);
    out.push(pool[idx].perk);
    pool.splice(idx, 1);
  }
  return out;
}

export function openPerkChoice() {
  state.perkPending = true;
  state.gameRunning = false;
  state.perkChoices = randomPerkChoices(3);
  document.getElementById('perk-desc').textContent = 'Choose one perk for level ' + (state.player.level + 1);
  const buttons = [
    document.getElementById('perk-a'),
    document.getElementById('perk-b'),
    document.getElementById('perk-c')
  ];
  for (let i = 0; i < buttons.length; i++) {
    const p = state.perkChoices[i];
    const rarity = p.rarity || 'common';
    buttons[i].className = 'btn perk-btn rarity-' + rarity;
    buttons[i].innerHTML = '<span class="perk-rarity-tag ' + rarity + '">' + rarity.toUpperCase() + '</span>' +
      p.name.toUpperCase() + '  -  ' + p.desc;
  }
  document.getElementById('perk-screen').classList.remove('hidden');
}

export function choosePerk(idx) {
  if (!state.perkPending) return;
  const choice = state.perkChoices[idx];
  if (!choice) return;
  const result = choice.apply(state.player, state.medkits);
  if (result !== undefined) state.medkits = result;
  state.player.level += 1;
  state.player.xp -= state.player.nextXp;
  state.player.nextXp = Math.round(state.player.nextXp * 1.35 + 8);
  state.perkPending = false;
  state.runPerksTaken.push(choice.id || choice.name);
  state.lifetimeStats.perksTaken[choice.name] = (state.lifetimeStats.perksTaken[choice.name] || 0) + 1;
  saveLifetimeStats();
  checkAchievements({ type:'perk', rarity: choice.rarity });
  checkAchievements({ type:'level', level: state.player.level });
  document.getElementById('perk-screen').classList.add('hidden');
  if (state.player.xp >= state.player.nextXp) {
    openPerkChoice();
    return;
  }
  state.gameRunning = true;
}

// ---- Inicialização e loop ----
export function initGame(canvasEl, ctx2d, width, height) {
  canvas = canvasEl; ctx = ctx2d; W = width; H = height;
  initRenderer(canvas, ctx, W, H);
  initCharacter();
  loadBestRun();
  loadSettings();
  loadScrapAndUpgrades();
  loadCharacterLook();
  loadAchievements();
  loadLifetimeStats();
  syncBestRunUI();
}

export function loop(ts) {
  if (!state.lastTime) state.lastTime = ts;
  let dt = (ts - state.lastTime) / 1000;
  dt = Math.min(dt, 0.05);
  state.lastTime = ts;

  if (state.gameRunning && !state.paused) {
    state.dayNightClock += dt;
    updatePlayer(dt);
    updateZombies(dt);
    updateBullets(dt);
    updateGrenades(dt);
    updateEnemyProjectiles(dt);
    updateShockwaves(dt);
    updateAmbient(dt);
    updateParticles(dt);
    updatePickups(dt);
    updateWaveLogic(dt);
    updateWeather(dt);
    decayCombo(dt);
    updateDamageIndicators(dt);
    if (state.bloodPools.length > 140) state.bloodPools.splice(0, state.bloodPools.length - 140);

    state.camX = clamp(state.player.x - W / 2, 0, WORLD_W - W);
    state.camY = clamp(state.player.y - H / 2, 0, WORLD_H - H);
    state.screenShake = Math.max(0, state.screenShake - dt * 24);
    setCamera(state.camX, state.camY);
    setShake(state.screenShake);

    syncHUD(state.gameStartTime);
  }
  if (state.paused) {
    updateDamageIndicators(dt);
  }
  if (state.meleeSwingTimer > 0) state.meleeSwingTimer -= dt;
  render(ts);
  requestAnimationFrame(loop);
}
