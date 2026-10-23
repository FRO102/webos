export const PAL = {
  ground1:'#232819', ground2:'#1c2015', ground3:'#2a3020',
  bloodPool:'#3c0d10',
  wallShadow:'#0a0b06',
  playerBody:'#4a5a2c', playerBodyDk:'#37431f', playerSkin:'#c9a876',
  zombieSkin:'#5c6e3a', zombieSkinDk:'#3f4d28', zombieShirt:'#5c3226',
  zombieRunner:'#6e4a3a', zombieBrute:'#3a4a35',
  muzzle:'#ffd76b', bullet:'#ffe8a3',
  crateWood:'#7a5a35', crateMetal:'#8a3324'
};

// ---------------------------------------------------------------------------
// ARMAS — 13 no total. Cada uma desbloqueia numa night diferente e tem um
// "feel" próprio (cadência, spread, pellets, tipo especial).
// ---------------------------------------------------------------------------
export const WEAPONS = [
  { name:'Pistol',      icon:'🔫', dmg:22,  fireRate:0.28, spread:0.05, mag:12, reserve:60,  reloadTime:1.1, speedMul:1.00, bulletSpeed:620, pellets:1, unlockedWave:1  },
  { name:'Grenade',     icon:'💣', dmg:120, fireRate:0.8,  spread:0,    mag:3,  reserve:0,   reloadTime:0,   speedMul:0.95, bulletSpeed:360, pellets:1, unlockedWave:1,  type:'grenade' },
  { name:'Machete',     icon:'🔪', dmg:38,  fireRate:0.45, spread:0,    mag:1,  reserve:0,   reloadTime:0,   speedMul:1.05, bulletSpeed:0,   pellets:1, unlockedWave:1,  type:'melee', range:64, arc:1.5 },
  { name:'SMG',         icon:'⚡', dmg:11,  fireRate:0.09, spread:0.08, mag:28, reserve:120, reloadTime:1.4, speedMul:0.98, bulletSpeed:640, pellets:1, unlockedWave:3  },
  { name:'Shotgun',     icon:'💥', dmg:20,  fireRate:0.7,  spread:0.25, mag:6,  reserve:36,  reloadTime:1.8, speedMul:0.92, bulletSpeed:480, pellets:5, unlockedWave:4  },
  { name:'Rifle',       icon:'🎯', dmg:34,  fireRate:0.42, spread:0.03, mag:10, reserve:50,  reloadTime:1.8, speedMul:0.95, bulletSpeed:760, pellets:1, unlockedWave:5  },
  { name:'Magnum',      icon:'🔫', dmg:58,  fireRate:0.5,  spread:0.02, mag:6,  reserve:36,  reloadTime:1.6, speedMul:0.97, bulletSpeed:820, pellets:1, unlockedWave:6, pierce:2 },
  { name:'Sniper',      icon:'🔭', dmg:75,  fireRate:1.2,  spread:0.01, mag:5,  reserve:25,  reloadTime:2.5, speedMul:0.88, bulletSpeed:900, pellets:1, unlockedWave:7, pierce:3 },
  { name:'Flamethrower',icon:'🔥', dmg:6,   fireRate:0.045,spread:0.16, mag:100,reserve:300, reloadTime:2.4, speedMul:0.90, bulletSpeed:380, pellets:1, unlockedWave:9, type:'flame', range:170 },
  { name:'LMG',         icon:'🧱', dmg:15,  fireRate:0.07, spread:0.12, mag:60, reserve:240, reloadTime:3.0, speedMul:0.85, bulletSpeed:580, pellets:1, unlockedWave:10 },
  { name:'Crossbow',    icon:'🏹', dmg:45,  fireRate:0.6,  spread:0.02, mag:1,  reserve:20,  reloadTime:1.2, speedMul:1.0,  bulletSpeed:300, pellets:1, unlockedWave:13, pierce:99 },
  { name:'Minigun',     icon:'🌀', dmg:13,  fireRate:0.045,spread:0.15, mag:120,reserve:360, reloadTime:3.6, speedMul:0.78, bulletSpeed:600, pellets:1, unlockedWave:15, spinUp:true },
  { name:'Rocket',      icon:'🚀', dmg:180, fireRate:1.5,  spread:0,    mag:1,  reserve:10,  reloadTime:2.8, speedMul:0.80, bulletSpeed:200, pellets:1, unlockedWave:16, type:'grenade' }
];

// ---------------------------------------------------------------------------
// PERKS — 16 perks divididos por raridade. Raridade influencia a frequência
// com que aparecem nas 3 escolhas de level-up (ver randomPerkChoices em game.js).
// ---------------------------------------------------------------------------
export const PERKS = [
  // COMUNS
  {
    id: 'sharpened_ammo', name: 'Sharpened Ammo', rarity:'common', icon:'🗡️',
    desc: '+15% ranged damage',
    apply: (player) => { player.dmgMul *= 1.15; }
  },
  {
    id: 'runner_legs', name: 'Runner Legs', rarity:'common', icon:'👟',
    desc: '+12 move speed, +16 sprint speed',
    apply: (player) => { player.speed += 12; player.sprintSpeed += 16; }
  },
  {
    id: 'thick_skin', name: 'Thick Skin', rarity:'common', icon:'❤️',
    desc: '+20 max HP and heal 20',
    apply: (player) => {
      player.maxHp += 20;
      player.hp = Math.min(player.hp + 20, player.maxHp);
    }
  },
  {
    id: 'deep_breath', name: 'Deep Breath', rarity:'common', icon:'💨',
    desc: '+20 max stamina and refill',
    apply: (player) => {
      player.maxStamina += 20;
      player.stamina = player.maxStamina;
    }
  },
  {
    id: 'combat_plating', name: 'Combat Plating', rarity:'common', icon:'🛡️',
    desc: '+35 max armor and refill armor',
    apply: (player) => {
      player.maxArmor += 35;
      player.armor = player.maxArmor;
    }
  },
  {
    id: 'scavenger', name: 'Scavenger', rarity:'common', icon:'🧲',
    desc: '+30% pickup radius and +1 medkit',
    apply: (player, medkits) => {
      player.pickupRadius *= 1.3;
      return medkits + 1;
    }
  },
  {
    id: 'quick_hands', name: 'Quick Hands', rarity:'common', icon:'⏱️',
    desc: '-20% reload time',
    apply: (player) => { player.reloadMul = (player.reloadMul || 1) * 0.8; }
  },
  {
    id: 'steady_grip', name: 'Steady Grip', rarity:'common', icon:'🎯',
    desc: '-25% weapon spread',
    apply: (player) => { player.spreadMul = (player.spreadMul || 1) * 0.75; }
  },
  // RAROS
  {
    id: 'adrenaline', name: 'Adrenaline', rarity:'rare', icon:'⚡',
    desc: 'Sprint no longer drains stamina',
    apply: (player) => { player.freeSprint = true; }
  },
  {
    id: 'bloodlust', name: 'Bloodlust', rarity:'rare', icon:'🩸',
    desc: 'Killing an enemy heals 2 HP',
    apply: (player) => { player.lifesteal = (player.lifesteal || 0) + 2; }
  },
  {
    id: 'second_wind', name: 'Second Wind', rarity:'rare', icon:'🌀',
    desc: '-35% dash cooldown',
    apply: (player) => { player.dashCdBonusMul = (player.dashCdBonusMul || 1) * 0.65; }
  },
  {
    id: 'iron_will', name: 'Iron Will', rarity:'rare', icon:'🔩',
    desc: 'Armor absorbs 85% of damage instead of 65%',
    apply: (player) => { player.armorAbsorb = 0.85; }
  },
  {
    id: 'executioner', name: 'Executioner', rarity:'rare', icon:'☠️',
    desc: '+50% critical hit damage',
    apply: (player) => { player.critMulBonus = (player.critMulBonus || 0) + 0.5; }
  },
  {
    id: 'field_medic', name: 'Field Medic', rarity:'rare', icon:'⛑️',
    desc: 'Medkits and health pickups heal 60% more',
    apply: (player) => { player.medkitBonus = (player.medkitBonus || 0) + 0.6; }
  },
  // ÉPICOS
  {
    id: 'undying', name: 'Undying', rarity:'epic', icon:'💜',
    desc: 'Once per night, surviving a lethal hit leaves you at 1 HP',
    apply: (player) => { player.hasUndying = true; }
  },
  {
    id: 'berserker', name: 'Berserker', rarity:'epic', icon:'🔥',
    desc: 'Below 30% HP: +35% damage and +20% move speed',
    apply: (player) => { player.hasBerserker = true; }
  }
];

export const PERK_RARITY_WEIGHTS = { common: 62, rare: 30, epic: 8 };
export const RARITY_COLOR = { common:'#8b8968', rare:'#7ac8e6', epic:'#c084fc' };

// ---------------------------------------------------------------------------
// TIPOS DE ZOMBIE — 15 no total.
// ---------------------------------------------------------------------------
export const ZTYPES = {
  walker:    { hp:40,  speed:52,  dmg:10, r:11, color:PAL.zombieSkin,    scoreMul:1   },
  runner:    { hp:26,  speed:110, dmg:8,  r:9,  color:PAL.zombieRunner,  scoreMul:1.3 },
  crawler:   { hp:20,  speed:70,  dmg:14, r:8,  color:'#4a5a3a', scoreMul:1.1, isCrawler:true, lowProfile:true },
  brute:     { hp:130, speed:38,  dmg:22, r:16, color:PAL.zombieBrute,   scoreMul:2.2 },
  spitter:   { hp:55,  speed:48,  dmg:8,  r:10, color:'#6f8a42', scoreMul:1.7, isSpitter:true },
  exploder:  { hp:62,  speed:62,  dmg:16, r:12, color:'#a26a2a', scoreMul:1.9, isExploder:true },
  bomber:    { hp:90,  speed:44,  dmg:10, r:13, color:'#8a5a2a', scoreMul:2.1, isBomber:true },
  swarmer:   { hp:18,  speed:140, dmg:6,  r:7,  color:'#b8a06a', scoreMul:0.8, isSwarmer:true },
  shocker:   { hp:70,  speed:55,  dmg:12, r:10, color:'#7ac8e6', scoreMul:2.0, isShocker:true },
  healer:    { hp:60,  speed:45,  dmg:5,  r:10, color:'#8fae3c', scoreMul:1.8, isHealer:true },
  screamer:  { hp:48,  speed:58,  dmg:6,  r:10, color:'#c08a3c', scoreMul:1.9, isScreamer:true },
  ghost:     { hp:44,  speed:64,  dmg:12, r:9,  color:'#7d8fae', scoreMul:2.0, isGhost:true, ignoresObstacles:true },
  tank:      { hp:280, speed:30,  dmg:25, r:18, color:'#5a4a3a', scoreMul:3.0, isTank:true },
  juggernaut:{ hp:520, speed:34,  dmg:32, r:22, color:'#4a3a4a', scoreMul:4.2, isJuggernaut:true },
  boss:      { hp:860, speed:42,  dmg:28, r:24, color:'#7e2b1f', scoreMul:5.5, isBoss:true }
};

// Bosses rotativos: cada múltiplo de 5 nights usa um "sabor" diferente do boss
// base, todos derivados de ZTYPES.boss mas com pequenas variações de comportamento.
export const BOSS_VARIANTS = ['brawler', 'summoner', 'artillery'];

export const DIFFICULTY_MODS = {
  rookie:    { enemyHp:0.85, enemyDmg:0.82, enemySpeed:0.92, spawnMul:0.9,  xpMul:1.05 },
  survivor:  { enemyHp:1,    enemyDmg:1,    enemySpeed:1,    spawnMul:1,    xpMul:1    },
  nightmare: { enemyHp:1.25, enemyDmg:1.25, enemySpeed:1.08, spawnMul:1.15, xpMul:1.2  }
};

export const CLASS_MODS = {
  assault: { dmgMul:1.1, speedBonus:0,  ammoMul:1.2,  healMul:1,    dashCdMul:1,    pickupMul:1,    startMedkits:1 },
  medic:   { dmgMul:1,   speedBonus:0,  ammoMul:1,    healMul:1.35, dashCdMul:1,    pickupMul:1.08, startMedkits:2 },
  scout:   { dmgMul:1,   speedBonus:18, ammoMul:0.95, healMul:1,    dashCdMul:0.75, pickupMul:1.35, startMedkits:1 },
  heavy:   { dmgMul:1.05,speedBonus:-8, ammoMul:1.1,  healMul:0.9,  dashCdMul:1.15, pickupMul:1,    startMedkits:1, armorBonus:40 }
};

export const WEATHER_TYPES = ['clear','fog','rain','storm'];

export const OUTFIT_PRESETS = {
  militia: { body:'#4a5a2c', bodyDk:'#37431f' },
  ash:     { body:'#5f635d', bodyDk:'#4a4e48' },
  blood:   { body:'#6b2b2b', bodyDk:'#4b1d1d' },
  navy:    { body:'#2b3f57', bodyDk:'#1e2d40' },
  desert:  { body:'#8a7a4a', bodyDk:'#6b5e38' },
  shadow:  { body:'#2a2a2e', bodyDk:'#18181c' },
  crimson: { body:'#7a2020', bodyDk:'#571414' },
  arctic:  { body:'#c9d6de', bodyDk:'#9aabb5' },
  toxic:   { body:'#5a7a2a', bodyDk:'#3e561c' },
  royal:   { body:'#3a2a5a', bodyDk:'#251a3d' }
};

export const SKIN_PRESETS = {
  warm: '#c9a876',
  tan:  '#b8895a',
  deep: '#7f5a3f',
  pale: '#e0c9ab'
};

// ---------------------------------------------------------------------------
// ACESSÓRIOS — puramente cosméticos, desenhados sobre o boneco do jogador
// (ver character.js / render.js). 'none' está sempre disponível.
// ---------------------------------------------------------------------------
export const HAT_PRESETS = {
  none:    { label:'NONE' },
  cap:     { label:'CAP',      color:'#3a4a26' },
  beanie:  { label:'BEANIE',   color:'#5c2020' },
  helmet:  { label:'HELMET',   color:'#5a5a5a' },
  bandana: { label:'BANDANA',  color:'#7a1c1c' }
};

export const BACKPACK_PRESETS = {
  none:    { label:'NONE' },
  scout:   { label:'SCOUT PACK',   color:'#4a3a26' },
  medic:   { label:'MEDIC PACK',   color:'#8a2020' },
  tactical:{ label:'TACTICAL RIG', color:'#2a2a2a' }
};

export const MASK_PRESETS = {
  none:    { label:'NONE' },
  bandit:  { label:'BANDIT',   color:'#1a1a1a' },
  gasmask: { label:'GAS MASK', color:'#4a5a3a' },
  skull:   { label:'SKULL',    color:'#d8cfa8' }
};

// ---------------------------------------------------------------------------
// MAPAS — temas jogáveis à escolha no menu. Cada um define a paleta do chão,
// a cor de fundo dos limites do mundo, o tipo/mistura de debris e obstáculos,
// e um leve tom de overlay para reforçar a identidade visual.
// ---------------------------------------------------------------------------
export const MAPS = {
  forest: {
    label: 'ROTTEN FOREST',
    desc: 'The original woods — overgrown and familiar.',
    ground: { g1:'#232819', g2:'#1c2015', g3:'#2a3020' },
    bounds: '#050603',
    debrisMix: { rock:0.5, bush:0.5 },
    obstacleMix: { crate:0.5, barrel:0.5 },
    tint: 'rgba(18,28,46,1)',
    fogBase: 0
  },
  city: {
    label: 'DEAD CITY BLOCKS',
    desc: 'Concrete, rubble and the husks of cars.',
    ground: { g1:'#22242a', g2:'#1a1c21', g3:'#2b2e35' },
    bounds: '#08090c',
    debrisMix: { rock:0.85, bush:0.15 },
    obstacleMix: { crate:0.35, barrel:0.65 },
    tint: 'rgba(28,26,38,1)',
    fogBase: 0.03
  },
  graveyard: {
    label: 'OLD GRAVEYARD',
    desc: 'Fog clings to the headstones at night.',
    ground: { g1:'#1e2420', g2:'#171c19', g3:'#242c27' },
    bounds: '#040605',
    debrisMix: { rock:0.7, bush:0.3 },
    obstacleMix: { crate:0.2, barrel:0.3, grave:0.5 },
    tint: 'rgba(20,34,30,1)',
    fogBase: 0.06
  }
};

export const STORAGE_KEY = 'nightnine-best-run-v1';
export const CUSTOM_STORAGE_KEY = 'nightnine-character-v1';
export const SETTINGS_STORAGE_KEY = 'nightnine-settings-v1';
export const ACHIEVEMENTS_STORAGE_KEY = 'nightnine-achievements-v1';
export const STATS_STORAGE_KEY = 'nightnine-lifetime-stats-v1';
export const MAP_STORAGE_KEY = 'nightnine-selected-map-v1';

export const WORLD_W = 1800;
export const WORLD_H = 1200;
export const TILE = 40;

export const CRIT_CHANCE_BASE = 0.10;
export const CRIT_CHANCE_CALLED = 0.25;
export const CRIT_MUL = 1.75;
export const CALLED_SHOT_MUL = 1.35;
export const HEADSHOT_MUL = 1.5;
