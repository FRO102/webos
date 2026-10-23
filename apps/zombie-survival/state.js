import { CLASS_MODS, DIFFICULTY_MODS, WEAPONS } from './constants.js';

export const state = {
  // Controlo do jogo
  gameRunning: false,
  paused: false,
  perkPending: false,
  perkChoices: [],
  screenShake: 0,
  lastTime: 0,
  gameStartTime: 0,
  tutorialMode: false,
  tutorialWeaponsUnlocked: false,

  // Ondas e inimigos
  wave: 0,
  killCount: 0,
  waveZombiesRemaining: 0,
  waveActive: false,
  waveTransitionTimer: 0,
  waveSpawnQueue: [],
  spawnTimer: 0,
  zombies: [],
  bossVariant: null,

  // Câmara
  camX: 0,
  camY: 0,

  // Combo
  comboCount: 0,
  comboTimer: 0,
  comboMult: 1,
  bestComboThisRun: 1,

  // Jogador
  player: {
    x: 900, y: 600, r: 11,
    speed: 150, sprintSpeed: 245,
    hp: 100, maxHp: 100,
    armor: 0, maxArmor: 100,
    stamina: 100, maxStamina: 100,
    level: 1, xp: 0, nextXp: 40,
    dmgMul: 1,
    pickupRadius: 12,
    angle: 0,
    alive: true,
    weaponIdx: 0,
    invuln: 0,
    meleeCd: 0,
    meleeRange: 58,
    meleeArc: 1.2,
    // Bónus vindos de perks (resetados por resetPlayerState)
    reloadMul: 1,
    spreadMul: 1,
    freeSprint: false,
    lifesteal: 0,
    dashCdBonusMul: 1,
    armorAbsorb: 0.65,
    critMulBonus: 0,
    medkitBonus: 0,
    hasUndying: false,
    undyingReady: true,
    hasBerserker: false
  },

  // Munição e armas
  ammoState: WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve })),
  reloading: false,
  reloadTimer: 0,
  fireTimer: 0,
  meleeSwingTimer: 0,
  medkits: 0,
  spinUpLevel: 0, // 0..1 — usado pela Minigun

  // Dash
  dashCooldown: 0,
  dashMaxCooldown: 2.8,
  dashDuration: 0,
  dashVx: 0,
  dashVy: 0,

  // Meteorologia
  weatherType: 'clear',
  weatherTimer: 18,
  weatherStrength: 0.4,
  dayNightClock: 0,

  // Dificuldade, classe e mapa
  selectedDifficulty: 'survivor',
  selectedClass: 'assault',
  selectedMap: 'forest',
  difficultyMod: DIFFICULTY_MODS.survivor,
  classMod: CLASS_MODS.assault,

  // Escudo temporário (pickup) — feedback próprio no HUD além do invuln genérico
  shieldTimer: 0,

  // Melhor pontuação
  bestRun: { kills: 0, wave: 0, level: 1 },

  // Estatísticas ao longo da vida (para achievements / ecrã inicial)
  lifetimeStats: {
    totalKills: 0,
    totalRuns: 0,
    totalWavesCleared: 0,
    weaponKills: {},   // { weaponName: kills }
    perksTaken: {},    // { perkName: count }
    meleeKills: 0,
    headshotKills: 0,
    critKills: 0,
    bossKills: 0
  },
  runPerksTaken: [],
  newAchievementsThisRun: [],

  // Coleções de entidades
  bullets: [],
  grenades: [],
  enemyProjectiles: [],
  particles: [],
  pickups: [],
  floatTexts: [],
  bloodPools: [],
  ambientParticles: [],
  damageIndicators: { top: 0, right: 0, bottom: 0, left: 0 }
};

// Funções auxiliares
export function isWeaponUnlocked(idx) {
  if (state.tutorialMode) return true;
  return state.wave >= WEAPONS[idx].unlockedWave;
}

export function resetState() {
  state.gameRunning = false;
  state.paused = false;
  state.perkPending = false;
  state.perkChoices = [];
  state.screenShake = 0;
  state.wave = 0;
  state.killCount = 0;
  state.waveZombiesRemaining = 0;
  state.waveActive = false;
  state.waveTransitionTimer = 0;
  state.waveSpawnQueue = [];
  state.spawnTimer = 0;
  state.gameStartTime = 0;
  state.tutorialMode = false;
  state.tutorialWeaponsUnlocked = false;
  state.bossVariant = null;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.comboMult = 1;
  state.bestComboThisRun = 1;
  state.camX = 0; state.camY = 0;
  state.runPerksTaken = [];
  state.newAchievementsThisRun = [];
  // reset player
  const p = state.player;
  p.x = 900; p.y = 600;
  p.hp = 100; p.maxHp = 100;
  p.armor = 0; p.maxArmor = 100;
  p.stamina = 100; p.maxStamina = 100;
  p.level = 1; p.xp = 0; p.nextXp = 40;
  p.dmgMul = 1;
  p.pickupRadius = 12;
  p.alive = true;
  p.invuln = 0;
  p.meleeCd = 0;
  p.reloadMul = 1;
  p.spreadMul = 1;
  p.freeSprint = false;
  p.lifesteal = 0;
  p.dashCdBonusMul = 1;
  p.armorAbsorb = 0.65;
  p.critMulBonus = 0;
  p.medkitBonus = 0;
  p.hasUndying = false;
  p.undyingReady = true;
  p.hasBerserker = false;
  state.ammoState = WEAPONS.map(w => ({ mag: w.mag, reserve: w.reserve }));
  state.reloading = false;
  state.reloadTimer = 0;
  state.fireTimer = 0;
  state.meleeSwingTimer = 0;
  state.medkits = 0;
  state.spinUpLevel = 0;
  state.dashCooldown = 0;
  state.dashMaxCooldown = 2.8;
  state.dashDuration = 0;
  state.dashVx = 0;
  state.dashVy = 0;
  state.weatherType = 'clear';
  state.weatherTimer = 18;
  state.weatherStrength = 0.4;
  state.dayNightClock = 0;
  state.shieldTimer = 0;
  state.zombies.length = 0;
  state.bullets.length = 0;
  state.grenades.length = 0;
  state.enemyProjectiles.length = 0;
  state.particles.length = 0;
  state.pickups.length = 0;
  state.floatTexts.length = 0;
  state.bloodPools.length = 0;
  state.ambientParticles.length = 0;
  state.damageIndicators = { top: 0, right: 0, bottom: 0, left: 0 };
}
