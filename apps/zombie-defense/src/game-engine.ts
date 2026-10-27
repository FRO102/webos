export type EnemyKind = "shambler" | "runner" | "brute" | "scout" | "armored" | "toxic" | "splitter" | "boss";
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const FINAL_WAVE = 10;

export type MapId = "suburb" | "dockyard" | "cemetery";
export type DifficultyId = "easy" | "normal" | "nightmare";
export type TowerId = "watchtower" | "sniper" | "cryo";

export interface Point {
  x: number;
  y: number;
}

export interface GameMap {
  id: MapId;
  name: string;
  subtitle: string;
  terrain: string;
  path: Point[];
  accent: string;
}

export interface Difficulty {
  id: DifficultyId;
  name: string;
  description: string;
  enemyHealth: number;
  enemySpeed: number;
  startingCash: number;
  baseLives: number;
}

export interface TowerDefinition {
  id: TowerId;
  name: string;
  shortName: string;
  description: string;
  cost: number;
  range: number;
  damage: number;
  cooldown: number;
  color: string;
  projectileColor: string;
  effect?: "slow";
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  waypoint: number;
  health: number;
  maxHealth: number;
  speed: number;
  radius: number;
  reward: number;
  kind: EnemyKind;
  splitsInto?: number;
  color?: string;
  slowTimer: number;
  attackFlash: number;
  bossPhase: number;
  phase: number;
}

export interface Tower {
  id: number;
  type: TowerId;
  x: number;
  y: number;
  cooldown: number;
  aimAngle: number;
  level: number;
  invested: number;
  targetId?: number;
  targeting?: "first" | "nearest" | "strongest" | "weakest";
}

export interface TowerStats {
  damage: number;
  range: number;
  cooldown: number;
  upgradeCost: number | null;
}

export interface Projectile {
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  color: string;
  slow: boolean;
}

export interface Explosion {
  x: number;
  y: number;
  radius: number;
  remaining: number;
  duration: number;
}

export interface GameState {
  mapId: MapId;
  difficultyId: DifficultyId;
  status: "ready" | "active" | "paused" | "won" | "lost";
  wave: number;
  baseLives: number;
  maxBaseLives: number;
  cash: number;
  score: number;
  comboKills: number;
  comboTimer: number;
  player: Point & { facing: number; health: number; maxHealth: number; hitFlash: number };
  playerDamageTimer: number;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  explosions: Explosion[];
  grenadeCooldown: number;
  grenadeMaxCooldown: number;
  spawnRemaining: number;
  spawnOrder?: string[];
  spawnTimer: number;
  waveSpawned: number;
  elapsed: number;
  nextEntityId: number;
  message: string;
  messageTimer: number;
  lastShot: number;
}

export interface GameInput {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  firing: boolean;
}

export const MAPS: GameMap[] = [
  {
    id: "suburb",
    name: "Bairro abandonado",
    subtitle: "Ruas vazias. Janelas a observar.",
    terrain: "#53634b",
    accent: "#a3c46c",
    path: [
      { x: -12, y: 94 }, { x: 194, y: 94 }, { x: 194, y: 234 },
      { x: 430, y: 234 }, { x: 430, y: 112 }, { x: 706, y: 112 },
      { x: 706, y: 410 }, { x: 974, y: 410 },
    ],
  },
  {
    id: "dockyard",
    name: "Cais enferrujado",
    subtitle: "Nevoeiro, contentores e maré alta.",
    terrain: "#445a57",
    accent: "#8bc6b5",
    path: [
      { x: -12, y: 282 }, { x: 174, y: 282 }, { x: 174, y: 100 },
      { x: 410, y: 100 }, { x: 410, y: 384 }, { x: 650, y: 384 },
      { x: 650, y: 206 }, { x: 974, y: 206 },
    ],
  },
  {
    id: "cemetery",
    name: "Cemitério velho",
    subtitle: "A noite não é a única coisa a despertar.",
    terrain: "#535546",
    accent: "#c2ad75",
    path: [
      { x: -12, y: 438 }, { x: 180, y: 438 }, { x: 180, y: 270 },
      { x: 402, y: 270 }, { x: 402, y: 92 }, { x: 690, y: 92 },
      { x: 690, y: 340 }, { x: 974, y: 340 },
    ],
  },
];

export const DIFFICULTIES: Difficulty[] = [
  {
    id: "easy",
    name: "Fácil",
    description: "Mais recursos e uma base resistente.",
    enemyHealth: 0.75,
    enemySpeed: 0.86,
    startingCash: 360,
    baseLives: 25,
  },
  {
    id: "normal",
    name: "Normal",
    description: "Uma luta justa por cada metro.",
    enemyHealth: 1,
    enemySpeed: 1,
    startingCash: 280,
    baseLives: 18,
  },
  {
    id: "nightmare",
    name: "Pesadelo",
    description: "Poucos recursos. Sem margem para erros.",
    enemyHealth: 1.42,
    enemySpeed: 1.18,
    startingCash: 220,
    baseLives: 12,
  },
];

export const TOWERS: TowerDefinition[] = [
  {
    id: "watchtower",
    name: "Torre sentinela",
    shortName: "Sentinela",
    description: "Disparos rápidos, alcance médio.",
    cost: 90,
    range: 150,
    damage: 19,
    cooldown: 0.62,
    color: "#e2b45b",
    projectileColor: "#ffe18a",
  },
  {
    id: "sniper",
    name: "Atirador de elite",
    shortName: "Atirador",
    description: "Alcance longo e dano elevado.",
    cost: 150,
    range: 250,
    damage: 58,
    cooldown: 1.55,
    color: "#7ea7d7",
    projectileColor: "#c9e8ff",
  },
  {
    id: "cryo",
    name: "Torre criogénica",
    shortName: "Criogénica",
    description: "Abranda alvos para ganhar tempo.",
    cost: 125,
    range: 135,
    damage: 11,
    cooldown: 0.42,
    color: "#74cbd0",
    projectileColor: "#b7faff",
    effect: "slow",
  },
];

export const WAVE_COMPOSITIONS: Record<number, { kinds: { kind: EnemyKind; count: number }[] }> = {
  1: { kinds: [{ kind: "shambler", count: 8 }] },
  2: { kinds: [{ kind: "shambler", count: 12 }] },
  3: { kinds: [{ kind: "shambler", count: 10 }, { kind: "runner", count: 4 }] },
  4: { kinds: [{ kind: "shambler", count: 10 }, { kind: "runner", count: 6 }] },
  5: { kinds: [{ kind: "brute", count: 2 }, { kind: "runner", count: 8 }, { kind: "shambler", count: 6 }] },
  6: { kinds: [{ kind: "brute", count: 3 }, { kind: "runner", count: 10 }] },
  7: { kinds: [{ kind: "armored", count: 4 }, { kind: "toxic", count: 3 }, { kind: "runner", count: 8 }] },
  8: { kinds: [{ kind: "armored", count: 6 }, { kind: "toxic", count: 4 }, { kind: "brute", count: 2 }] },
  9: { kinds: [{ kind: "boss", count: 1 }, { kind: "runner", count: 10 }, { kind: "shambler", count: 8 }] },
  10: { kinds: [{ kind: "boss", count: 2 }, { kind: "armored", count: 4 }, { kind: "brute", count: 3 }, { kind: "runner", count: 12 }] },
};
const PLAYER_SHOT_COOLDOWN = 0.24;
const PLAYER_SHOT_DAMAGE = 34;
const PLAYER_SPEED = 170;
const PATH_BLOCK_RADIUS = 43;

function getMap(id: MapId) {
  return MAPS.find((item) => item.id === id) ?? MAPS[0];
}

function getDifficulty(id: DifficultyId) {
  return DIFFICULTIES.find((item) => item.id === id) ?? DIFFICULTIES[1];
}

export function createGame(mapId: MapId, difficultyId: DifficultyId): GameState {
  const difficulty = getDifficulty(difficultyId);
  return {
    mapId,
    difficultyId,
    status: "ready",
    wave: 0,
    baseLives: difficulty.baseLives,
    maxBaseLives: difficulty.baseLives,
    cash: difficulty.startingCash,
    score: 0,
    comboKills: 0,
    comboTimer: 0,
    player: { x: 470, y: 474, facing: -Math.PI / 2, health: 100, maxHealth: 100, hitFlash: 0 },
    playerDamageTimer: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    explosions: [],
    grenadeCooldown: 0,
    grenadeMaxCooldown: 10,
    spawnRemaining: 0,
    spawnTimer: 0,
    waveSpawned: 0,
    elapsed: 0,
    nextEntityId: 1,
    message: "Prepara as defesas",
    messageTimer: 2.5,
    lastShot: 0,
  };
}

export function startWave(state: GameState): GameState {
  if (state.status !== "ready" || state.wave >= FINAL_WAVE) return state;
  state.wave += 1;
  state.status = "active";
  state.waveSpawned = 0;
  const composition = WAVE_COMPOSITIONS[state.wave] ?? WAVE_COMPOSITIONS[1];
  const total = composition.kinds.reduce((acc, item) => acc + item.count, 0);
  state.spawnRemaining = total;
  state.spawnOrder = composition.kinds.flatMap((item) => Array.from({ length: item.count }, () => item.kind));
  state.spawnTimer = 0.25;
  state.message = `Horda ${String(state.wave).padStart(2, "0")} a caminho`;
  state.messageTimer = 2.2;
  return state;
}

export function togglePause(state: GameState): GameState {
  if (state.status === "active") state.status = "paused";
  else if (state.status === "paused") state.status = "active";
  return state;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

export function canPlaceTower(state: GameState, x: number, y: number) {
  if (state.status === "won" || state.status === "lost") return false;
  if (x < 34 || x > GAME_WIDTH - 34 || y < 34 || y > GAME_HEIGHT - 34) return false;
  const path = getMap(state.mapId).path;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (pointToSegmentDistance({ x, y }, path[i], path[i + 1]) < PATH_BLOCK_RADIUS) return false;
  }
  if (state.towers.some((tower) => distance(tower, { x, y }) < 48)) return false;
  if (distance(state.player, { x, y }) < 32) return false;
  return true;
}

export function placeTower(state: GameState, towerId: TowerId, x: number, y: number): GameState {
  const definition = TOWERS.find((tower) => tower.id === towerId);
  if (!definition || !canPlaceTower(state, x, y)) {
    state.message = "Não é possível construir aqui";
    state.messageTimer = 1.5;
    return state;
  }
  if (state.cash < definition.cost) {
    state.message = "Créditos insuficientes";
    state.messageTimer = 1.5;
    return state;
  }
  state.cash -= definition.cost;
  state.towers.push({
    id: state.nextEntityId++,
    type: towerId,
    x,
    y,
    cooldown: 0.1,
    aimAngle: -Math.PI / 2,
    level: 1,
    invested: definition.cost,
    targeting: towerId === 'sniper' ? 'first' : 'nearest',
  });
  state.message = `${definition.name} construída`;
  state.messageTimer = 1.5;
  return state;
}

export function setTowerTargeting(state: GameState, towerId: number, mode: "first" | "nearest" | "strongest" | "weakest"): GameState {
  const tower = state.towers.find((item) => item.id === towerId);
  if (tower) tower.targeting = mode;
  return state;
}
export function getTowerStats(tower: Tower): TowerStats {
  const definition = TOWERS.find((item) => item.id === tower.type)!;
  const levelOffset = tower.level - 1;
  return {
    damage: Math.round(definition.damage * (1 + levelOffset * 0.42)),
    range: Math.round(definition.range * (1 + levelOffset * 0.1)),
    cooldown: definition.cooldown * Math.pow(0.87, levelOffset),
    upgradeCost: tower.level >= 3
      ? null
      : Math.round(definition.cost * (tower.level === 1 ? 0.55 : 0.78)),
  };
}

export function upgradeTower(state: GameState, towerId: number): GameState {
  const tower = state.towers.find((item) => item.id === towerId);
  if (!tower) return state;
  const stats = getTowerStats(tower);
  if (stats.upgradeCost === null) {
    state.message = "Esta torre já está no nível máximo";
    state.messageTimer = 1.5;
    return state;
  }
  if (state.cash < stats.upgradeCost) {
    state.message = "Créditos insuficientes para melhorar";
    state.messageTimer = 1.5;
    return state;
  }
  state.cash -= stats.upgradeCost;
  tower.invested += stats.upgradeCost;
  tower.level += 1;
  tower.cooldown = 0;
  state.message = `${TOWERS.find((item) => item.id === tower.type)!.shortName} melhorada para nível ${tower.level}`;
  state.messageTimer = 1.8;
  return state;
}

export function sellTower(state: GameState, towerId: number): GameState {
  const index = state.towers.findIndex((item) => item.id === towerId);
  if (index < 0) return state;
  const [tower] = state.towers.splice(index, 1);
  const refund = Math.floor(tower.invested * 0.7);
  state.cash += refund;
  state.message = `Torre vendida: +${refund} créditos`;
  state.messageTimer = 1.6;
  return state;
}

export function findTowerAt(state: GameState, x: number, y: number): number | null {
  const tower = [...state.towers]
    .reverse()
    .find((item) => distance(item, { x, y }) <= 22);
  return tower?.id ?? null;
}

type EnemyConfig = { health: number; speed: number; radius: number; reward: number; splitsInto?: number };

const ENEMY_COLORS: Record<EnemyKind, string> = {
  shambler: "#88a86f",
  runner: "#d07a50",
  brute: "#785a44",
  scout: "#a678d7",
  armored: "#9aa6b8",
  toxic: "#78b86f",
  splitter: "#c69a53",
  boss: "#c94c4c",
};

const ENEMY_CONFIGS: Record<EnemyKind, EnemyConfig> = {
  shambler: { health: 62, speed: 53, radius: 12, reward: 14 },
  runner: { health: 42, speed: 90, radius: 10, reward: 17 },
  brute: { health: 110, speed: 44, radius: 15, reward: 32 },
  scout: { health: 28, speed: 125, radius: 8, reward: 12 },
  armored: { health: 260, speed: 44, radius: 14, reward: 42 },
  toxic: { health: 140, speed: 50, radius: 15, reward: 26 },
  splitter: { health: 90, speed: 62, radius: 12, reward: 22, splitsInto: 2 },
  boss: { health: 920, speed: 26, radius: 22, reward: 180 },
};

function spawnEnemy(state: GameState) {
  const map = getMap(state.mapId);
  const difficulty = getDifficulty(state.difficultyId);
  const waveScale = 1 + Math.max(0, state.wave - 1) * 0.12;
  const kind = (state.spawnOrder?.shift() ?? "shambler") as EnemyKind;
  const config = ENEMY_CONFIGS[kind] ?? ENEMY_CONFIGS.shambler;
  const start = map.path[0];
  state.enemies.push({
    id: state.nextEntityId++,
    x: start.x,
    y: start.y,
    waypoint: 1,
    health: config.health * difficulty.enemyHealth * waveScale,
    maxHealth: config.health * difficulty.enemyHealth * waveScale,
    speed: config.speed * difficulty.enemySpeed * (1 + state.wave * 0.025),
    radius: config.radius,
    reward: config.reward + Math.floor(state.wave * 0.8),
    kind,
    splitsInto: config.splitsInto,
    color: ENEMY_COLORS[kind] ?? "#98988f",
    slowTimer: 0,
    attackFlash: 0,
    phase: Math.random() * Math.PI * 2,
    bossPhase: kind === "boss" ? 1 : 0,
  });
  state.waveSpawned += 1;
  state.spawnRemaining -= 1;
}

function handleBossPhase(state: GameState, enemy: Enemy) { if (enemy.kind !== 'boss') return; if (enemy.bossPhase === 1 && enemy.health <= enemy.maxHealth * 0.55) { enemy.bossPhase = 2; enemy.speed *= 1.35; state.message = 'O boss entrou em furia!'; state.messageTimer = 2.2; } }

function damageEnemy(state: GameState, enemy: Enemy, damage: number, slow: boolean) {
   enemy.health -= damage;
   handleBossPhase(state, enemy);
  enemy.attackFlash = 0.12;
  if (slow) enemy.slowTimer = Math.max(enemy.slowTimer, 1.8);
  if (enemy.health <= 0 && enemy.kind === 'splitter' && enemy.splitsInto) {
    for (let i = 0; i < enemy.splitsInto; i++) {
      state.enemies.push({
        ...enemy,
        id: state.nextEntityId++,
        x: enemy.x,
        y: enemy.y,
        waypoint: enemy.waypoint,
        health: enemy.maxHealth * 0.33,
        maxHealth: enemy.maxHealth * 0.33,
        speed: enemy.speed * 1.25,
        reward: Math.floor(enemy.reward * 0.35),
        radius: Math.max(6, enemy.radius - 3),
        bossPhase: 0,
        attackFlash: 0,
        slowTimer: 0,
      });
    }
  }
  if (enemy.health <= 0) {
    state.cash += enemy.reward;
    state.comboKills += 1;
    state.comboTimer = Math.max(state.comboTimer, 4.2);
    const comboBonus = Math.min(4, state.comboKills);
    state.score += enemy.reward * (10 + comboBonus);
    if (state.comboKills >= 3) state.cash += comboBonus;
    state.enemies = state.enemies.filter((item) => item.id !== enemy.id);
  }
}

export function throwGrenade(state: GameState, x: number, y: number): GameState {
  if (state.status !== "active") return state;
  if (state.grenadeCooldown > 0) {
    state.message = `Granada pronta em ${state.grenadeCooldown.toFixed(1)} s`;
    state.messageTimer = 1.1;
    return state;
  }
  const blastRadius = 96;
  let blastPoint = { x, y };
  let targets = state.enemies.filter((enemy) => distance(enemy, blastPoint) <= blastRadius);
  if (targets.length === 0) {
    const priorityTarget = [...state.enemies].sort(
      (a, b) => b.waypoint - a.waypoint || distance(a, state.player) - distance(b, state.player),
    )[0];
    if (!priorityTarget) {
      state.message = "Ainda não há zombies para atingir";
      state.messageTimer = 1.3;
      return state;
    }
    blastPoint = { x: priorityTarget.x, y: priorityTarget.y };
    targets = state.enemies.filter((enemy) => distance(enemy, blastPoint) <= blastRadius);
  }
  state.grenadeCooldown = state.grenadeMaxCooldown;
  state.explosions.push({ x: blastPoint.x, y: blastPoint.y, radius: blastRadius, remaining: 0.38, duration: 0.38 });
  for (const enemy of targets) {
    enemy.slowTimer = Math.max(enemy.slowTimer, 2.4);
    damageEnemy(state, enemy, enemy.kind === "brute" ? 74 : 94, true);
  }
  state.message = `Granada! ${targets.length} ${targets.length === 1 ? "zombie atingido" : "zombies atingidos"}`;
  state.messageTimer = 1.4;
  return state;
}

export function stepGame(state: GameState, deltaMs: number, input: GameInput): GameState {
  if (state.status !== "active") return state;
  const dt = Math.min(0.04, Math.max(0, deltaMs / 1000));
  state.elapsed += dt;
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.player.hitFlash = Math.max(0, state.player.hitFlash - dt);
  state.playerDamageTimer = Math.max(0, state.playerDamageTimer - dt);
  state.lastShot = Math.max(0, state.lastShot - dt);
  state.grenadeCooldown = Math.max(0, state.grenadeCooldown - dt);
  state.explosions = state.explosions
    .map((explosion) => ({ ...explosion, remaining: explosion.remaining - dt }))
    .filter((explosion) => explosion.remaining > 0);

  const moveLength = Math.hypot(input.moveX, input.moveY);
  if (moveLength > 0) {
    state.player.x += (input.moveX / Math.max(1, moveLength)) * PLAYER_SPEED * dt;
    state.player.y += (input.moveY / Math.max(1, moveLength)) * PLAYER_SPEED * dt;
  }
  state.player.x = Math.max(22, Math.min(GAME_WIDTH - 22, state.player.x));
  state.player.y = Math.max(24, Math.min(GAME_HEIGHT - 24, state.player.y));
  state.player.facing = Math.atan2(input.aimY - state.player.y, input.aimX - state.player.x);

  if (input.firing && state.lastShot <= 0) {
    const target = state.enemies
      .filter((enemy) => distance(enemy, { x: input.aimX, y: input.aimY }) < 36)
      .sort((a, b) => distance(a, state.player) - distance(b, state.player))[0]
      ?? state.enemies.filter((enemy) => distance(enemy, state.player) < 330)
        .sort((a, b) => distance(a, { x: input.aimX, y: input.aimY }) - distance(b, { x: input.aimX, y: input.aimY }))[0];
    if (target) damageEnemy(state, target, PLAYER_SHOT_DAMAGE, false);
    state.lastShot = PLAYER_SHOT_COOLDOWN;
  }

  if (state.spawnRemaining > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy(state);
      state.spawnTimer = Math.max(0.34, 0.93 - state.wave * 0.035);
    }
  }

  const path = getMap(state.mapId).path;
  for (const enemy of [...state.enemies]) {
    enemy.attackFlash = Math.max(0, enemy.attackFlash - dt);
    enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
    const target = path[enemy.waypoint];
    if (!target) {
      state.enemies = state.enemies.filter((item) => item.id !== enemy.id);
      state.baseLives = Math.max(0, state.baseLives - (enemy.kind === "brute" ? 3 : 1));
      state.message = enemy.kind === "brute" ? "Um brutamontes chegou à base!" : "Um zombie passou pela defesa";
      state.messageTimer = 1.6;
      continue;
    }
    const remaining = distance(enemy, target);
    const speed = enemy.speed * (enemy.slowTimer > 0 ? 0.52 : 1);
    if (remaining <= speed * dt + 1) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.waypoint += 1;
    } else {
      enemy.x += ((target.x - enemy.x) / remaining) * speed * dt;
      enemy.y += ((target.y - enemy.y) / remaining) * speed * dt;
    }
  }

  const touchingZombie = state.enemies.find(
    (enemy) => distance(state.player, enemy) < enemy.radius + 10,
  );
  if (touchingZombie && state.playerDamageTimer <= 0) {
    state.player.health = Math.max(0, state.player.health - (touchingZombie.kind === "brute" ? 22 : 13));
    state.player.hitFlash = 0.22;
    state.playerDamageTimer = 0.72;
    state.comboKills = 0;
    state.comboTimer = 0;
    state.message = "Um zombie atacou-te";
    state.messageTimer = 1.1;
  }

  for (const tower of state.towers) {
    const definition = TOWERS.find((item) => item.id === tower.type)!;
    const stats = getTowerStats(tower);
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    const candidates = state.enemies.filter((enemy) => distance(tower, enemy) <= stats.range);
    const target = candidates.sort((a, b) => {
      const mode = tower.targeting ?? (tower.type === "sniper" ? "first" : "nearest");
      if (mode === "first") return b.waypoint - a.waypoint || a.id - b.id;
      if (mode === "strongest") return b.health - a.health || a.id - b.id;
      if (mode === "weakest") return a.health - b.health || a.id - b.id;
      return distance(tower, a) - distance(tower, b);
    })[0];
    if (target) {
      tower.aimAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
      tower.targetId = target.id;
    } else {
      tower.targetId = undefined;
    }
    if (target && tower.cooldown <= 0) {
      state.projectiles.push({
        x: tower.x,
        y: tower.y - 10,
        targetId: target.id,
        speed: tower.type === "sniper" ? 570 : 420,
        damage: stats.damage,
        color: definition.projectileColor,
        slow: definition.effect === "slow",
      });
      tower.cooldown = stats.cooldown;
    }
  }

  for (const projectile of [...state.projectiles]) {
    const target = state.enemies.find((enemy) => enemy.id === projectile.targetId);
    if (!target) {
      state.projectiles = state.projectiles.filter((item) => item !== projectile);
      continue;
    }
    const remaining = distance(projectile, target);
    if (remaining < projectile.speed * dt + target.radius) {
      damageEnemy(state, target, projectile.damage, projectile.slow);
      state.projectiles = state.projectiles.filter((item) => item !== projectile);
    } else {
      projectile.x += ((target.x - projectile.x) / remaining) * projectile.speed * dt;
      projectile.y += ((target.y - projectile.y) / remaining) * projectile.speed * dt;
    }
  }

  if (state.baseLives <= 0 || state.player.health <= 0) {
    state.status = "lost";
    state.message = state.player.health <= 0 ? "Foste infetado" : "A base caiu";
  } else if (state.waveSpawned > 0 && state.spawnRemaining === 0 && state.enemies.length === 0) {
    state.comboKills = 0;
    state.comboTimer = 0;
    state.status = state.wave >= FINAL_WAVE ? "won" : "ready";
    state.cash += 45 + state.wave * 7;
    state.score += 250 + state.wave * 50;
    state.message = state.wave >= FINAL_WAVE ? "A zona está segura" : "Horda eliminada — recebeste reforços";
    state.messageTimer = 5;
  }
  return state;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: GameState) {
  const map = getMap(state.mapId);
  ctx.fillStyle = map.terrain;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const seed = state.mapId === "suburb" ? 11 : state.mapId === "dockyard" ? 29 : 47;
  for (let i = 0; i < 145; i += 1) {
    const x = ((i * 137 + seed * 31) % GAME_WIDTH);
    const y = ((i * 83 + seed * 19) % GAME_HEIGHT);
    const size = 1 + ((i * 7) % 3);
    ctx.fillStyle = i % 3 === 0 ? "rgba(208,197,139,.10)" : "rgba(13,22,18,.12)";
    ctx.fillRect(x, y, size, size);
  }
  if (state.mapId === "suburb") {
    for (const [x, y, w, h] of [[42, 290, 106, 57], [258, 34, 126, 44], [470, 300, 118, 60], [782, 56, 118, 42], [812, 278, 74, 62]]) {
      ctx.fillStyle = "#3c4238";
      roundedRect(ctx, x, y, w, h, 7);
      ctx.fill();
      ctx.fillStyle = "#65685a";
      roundedRect(ctx, x + 6, y + 6, w - 12, 9, 4);
      ctx.fill();
      ctx.fillStyle = "#202a28";
      for (let wx = x + 15; wx < x + w - 10; wx += 30) {
        ctx.fillRect(wx, y + 22, 12, 10);
      }
      ctx.fillStyle = "rgba(0,0,0,.2)";
      ctx.fillRect(x + 10, y + h - 9, w - 20, 4);
    }
  } else if (state.mapId === "dockyard") {
    const cargoContainers: Array<[number, number, number, number, string]> = [
      [40, 64, 82, 36, "#806347"], [240, 315, 124, 37, "#63724f"],
      [474, 54, 102, 36, "#8b553d"], [724, 280, 112, 38, "#58736e"],
      [820, 70, 62, 48, "#806347"], [48, 410, 96, 37, "#66755b"],
    ];
    for (const [x, y, w, h, color] of cargoContainers) {
      ctx.fillStyle = "rgba(0,0,0,.22)";
      roundedRect(ctx, x + 5, y + 7, w, h, 3);
      ctx.fill();
      ctx.fillStyle = color;
      roundedRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(20,25,23,.5)";
      ctx.lineWidth = 2;
      for (let xx = x + 12; xx < x + w; xx += 18) {
        ctx.beginPath();
        ctx.moveTo(xx, y + 4);
        ctx.lineTo(xx, y + h - 4);
        ctx.stroke();
      }
    }
  } else {
    for (let i = 0; i < 17; i += 1) {
      const x = 30 + ((i * 137) % 900);
      const y = 26 + ((i * 67) % 470);
      if (pathContainsPoint(map.path, x, y, 58)) continue;
      ctx.fillStyle = "#a49a82";
      roundedRect(ctx, x, y, 15, 31, 4);
      ctx.fill();
      ctx.fillStyle = "#68695c";
      ctx.fillRect(x + 3, y + 3, 9, 6);
      ctx.fillStyle = "rgba(0,0,0,.19)";
      ctx.fillRect(x + 2, y + 32, 18, 4);
    }
    for (const [x, y] of [[102, 171], [289, 373], [540, 181], [836, 432], [829, 170], [290, 60]]) {
      ctx.strokeStyle = "rgba(188,182,151,.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 17, y - 13);
      ctx.moveTo(x + 5, y - 15);
      ctx.lineTo(x + 12, y + 6);
      ctx.stroke();
    }
  }
}

function pathContainsPoint(path: Point[], x: number, y: number, radius: number) {
  for (let i = 0; i < path.length - 1; i += 1) {
    if (pointToSegmentDistance({ x, y }, path[i], path[i + 1]) < radius) return true;
  }
  return false;
}

function drawRoute(ctx: CanvasRenderingContext2D, path: Point[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  path.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
  ctx.strokeStyle = "rgba(22,25,22,.44)";
  ctx.lineWidth = 68;
  ctx.stroke();
  ctx.strokeStyle = "#82795e";
  ctx.lineWidth = 60;
  ctx.stroke();
  ctx.strokeStyle = "#9b8d69";
  ctx.lineWidth = 47;
  ctx.stroke();
  ctx.strokeStyle = "rgba(49,49,39,.3)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 16]);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 55; i += 1) {
    const x = (i * 167 + 33) % GAME_WIDTH;
    const y = (i * 89 + 17) % GAME_HEIGHT;
    if (pathContainsPoint(path, x, y, 21)) {
      ctx.fillStyle = i % 2 === 0 ? "rgba(43,42,34,.22)" : "rgba(227,203,151,.18)";
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + (i % 4), 1.5 + (i % 2), i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBase(ctx: CanvasRenderingContext2D, point: Point, lives: number, maxLives: number) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.fillStyle = "rgba(0,0,0,.33)";
  roundedRect(ctx, -33, -23, 67, 47, 5);
  ctx.fill();
  ctx.fillStyle = "#4a5146";
  roundedRect(ctx, -35, -27, 70, 45, 4);
  ctx.fill();
  ctx.fillStyle = "#727862";
  ctx.fillRect(-30, -23, 60, 7);
  ctx.fillStyle = "#272e29";
  ctx.fillRect(-24, -12, 15, 21);
  ctx.fillRect(8, -12, 15, 21);
  ctx.fillStyle = "#d7a348";
  ctx.fillRect(-6, -17, 12, 33);
  ctx.fillStyle = "#e8c878";
  ctx.fillRect(-3, -14, 6, 27);
  ctx.fillStyle = "#a1a590";
  ctx.fillRect(-38, -34, 76, 3);
  ctx.fillStyle = "#34433d";
  roundedRect(ctx, -28, -45, 56, 7, 3);
  ctx.fill();
  ctx.fillStyle = "#9bce79";
  const lifeRatio = maxLives > 0 ? Math.max(0, Math.min(1, lives / maxLives)) : 0;
  ctx.fillRect(-27, -44, 54 * lifeRatio, 5);
  ctx.fillStyle = "#e6dfc3";
  ctx.font = "700 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("REFÚGIO", 0, 34);
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D, point: Point) {
  ctx.save();
  ctx.translate(point.x + 8, point.y);
  ctx.strokeStyle = "#272925";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-14, -19);
  ctx.lineTo(13, -17);
  ctx.moveTo(-13, -10);
  ctx.lineTo(14, -9);
  ctx.moveTo(-11, -1);
  ctx.lineTo(14, 0);
  ctx.moveTo(-9, 8);
  ctx.lineTo(14, 9);
  ctx.stroke();
  ctx.fillStyle = "#b94738";
  ctx.beginPath();
  ctx.arc(0, -30, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eab29a";
  ctx.beginPath();
  ctx.arc(0, -30, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTower(ctx: CanvasRenderingContext2D, tower: Tower, selected: boolean) {
  const definition = TOWERS.find((item) => item.id === tower.type)!;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  if (selected) {
    const range = getTowerStats(tower).range;
    ctx.fillStyle = "rgba(224, 191, 115, .08)";
    ctx.strokeStyle = "rgba(232, 198, 115, .55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(2, 13, 21, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#373a34";
  ctx.beginPath();
  ctx.arc(0, 3, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = definition.color;
  ctx.beginPath();
  ctx.arc(0, 2, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#252a28";
  ctx.beginPath();
  ctx.arc(0, 1, 8, 0, Math.PI * 2);
  ctx.fill();
  if (tower.level >= 2) {
    ctx.strokeStyle = "#ffe39c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2, 14, -Math.PI * .82, -Math.PI * .18);
    ctx.stroke();
  }
  if (tower.level >= 3) {
    ctx.strokeStyle = "#fff3c9";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 2, 17, Math.PI * .15, Math.PI * .85);
    ctx.stroke();
  }
  ctx.rotate(tower.aimAngle);
  ctx.fillStyle = "#a9a48c";
  roundedRect(ctx, 1, -3.5, tower.type === "sniper" ? 25 : 19, 7, 2);
  ctx.fill();
  ctx.fillStyle = "#3b403b";
  ctx.fillRect(4, -1, tower.type === "sniper" ? 19 : 13, 2);
  ctx.restore();
  ctx.fillStyle = "#e9dfc4";
  ctx.font = "700 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText(definition.shortName.toUpperCase(), tower.x, tower.y + 32);
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy) {
  const sway = Math.sin(enemy.phase + enemy.x * 0.04) * 1.6;
  const body =  enemy.color ?? (enemy.kind === "brute" ? "#68744f" : enemy.kind === "runner" ? "#748357" : "#657451");
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(sway * 0.035);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.beginPath();
  ctx.ellipse(1, enemy.radius * 0.88, enemy.radius * 1.1, enemy.radius * .55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#394431";
  ctx.lineWidth = enemy.kind === "brute" ? 5 : 3;
  ctx.beginPath();
  ctx.moveTo(-4, 7);
  ctx.lineTo(-7 + sway, enemy.radius + 5);
  ctx.moveTo(4, 7);
  ctx.lineTo(8 - sway, enemy.radius + 5);
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 3, enemy.radius * .78, enemy.radius * 1.03, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = enemy.attackFlash > 0 ? "#bd4f42" : "#849063";
  ctx.beginPath();
  ctx.arc(0, -enemy.radius * .68, enemy.radius * .64, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d85d47";
  ctx.beginPath();
  ctx.arc(-3, -enemy.radius * .7, 1.5, 0, Math.PI * 2);
  ctx.arc(3, -enemy.radius * .7, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const barWidth = enemy.radius * 2.1;
  ctx.fillStyle = "rgba(18,22,19,.72)";
  roundedRect(ctx, enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth, 3.5, 2);
  ctx.fill();
  const barColor = enemy.color ?? (enemy.kind === "brute" ? "#e29955" : "#b6c47b");
  ctx.fillStyle = barColor;
  roundedRect(ctx, enemy.x - barWidth / 2, enemy.y - enemy.radius - 12, barWidth * Math.max(0, enemy.health / enemy.maxHealth), 3.5, 2);
  ctx.fill();
   if (enemy.slowTimer > 0) {
     ctx.strokeStyle = "rgba(149,237,243,.68)";
     ctx.lineWidth = 2;
     ctx.beginPath();
     ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
     ctx.stroke();
   }
   if (enemy.kind === "boss") {
     ctx.save();
     ctx.strokeStyle = "rgba(255, 115, 95, .9)";
     ctx.lineWidth = 2;
     ctx.beginPath();
     ctx.arc(enemy.x, enemy.y, enemy.radius + 7 + (enemy.bossPhase === 2 ? 1.5 : 0), 0, Math.PI * 2);
     ctx.stroke();
     ctx.fillStyle = "#ffcf99";
     ctx.font = "700 10px monospace";
     ctx.textAlign = "center";
     ctx.fillText(`FASE ${enemy.bossPhase}`, enemy.x, enemy.y - enemy.radius - 17);
     ctx.restore();
   }
}
function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
  const { player } = state;
  const bob = Math.sin(state.elapsed * 11) * 1.2;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.beginPath();
  ctx.ellipse(1, 11, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#252a28";
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = player.hitFlash > 0 ? "#d96651" : "#cf9e5c";
  ctx.beginPath();
  ctx.arc(-1, -3, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#394d4a";
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(7, 1);
  ctx.lineTo(8, 12);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(player.facing);
  ctx.fillStyle = "#d6d1bd";
  roundedRect(ctx, 5, -2.2, 15, 4.5, 1.5);
  ctx.fill();
  ctx.fillStyle = "#373936";
  ctx.fillRect(9, -1, 9, 2);
  ctx.restore();
  ctx.fillStyle = "#e6e2cd";
  ctx.font = "700 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("TU", player.x, player.y - 19);
}

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState, selectedTowerId: number | null = null, previewTower?: { type: TowerId; x: number; y: number } | null) {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawTerrain(ctx, state);
  const map = getMap(state.mapId);
  drawRoute(ctx, map.path);
  drawGate(ctx, map.path[0]);
  drawBase(ctx, map.path[map.path.length - 1], state.baseLives, state.maxBaseLives);

  for (const tower of state.towers) drawTower(ctx, tower, tower.id === selectedTowerId);
  if (previewTower) {
    const definition = TOWERS.find((item) => item.id === previewTower.type);
    const valid = canPlaceTower(state, previewTower.x, previewTower.y);
    if (definition) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.translate(previewTower.x, previewTower.y);
      ctx.fillStyle = definition.color;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = valid ? "#72ff9b" : "#ff5a5a";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = definition.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(previewTower.x, previewTower.y, definition.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (!valid) {
        ctx.save();
        ctx.fillStyle = "rgba(255,90,90,.75)";
        ctx.font = "700 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Nao pode colocar aqui", previewTower.x, previewTower.y - 24);
        ctx.restore();
      }
    }
  }
  for (const explosion of state.explosions) {
    const progress = 1 - explosion.remaining / explosion.duration;
    const radius = explosion.radius * (0.28 + progress * 0.72);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = "rgba(239, 177, 91, .22)";
    ctx.strokeStyle = "rgba(255, 220, 148, .88)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  for (const projectile of state.projectiles) {
    ctx.save();
    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.slow ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const enemy of state.enemies) drawEnemy(ctx, enemy);
  drawPlayer(ctx, state);


  const vignette = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, 150, GAME_WIDTH / 2, GAME_HEIGHT / 2, 590);
  vignette.addColorStop(0, "rgba(14,19,15,0)");
  vignette.addColorStop(1, "rgba(13,17,15,.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (state.messageTimer > 0 && state.message) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, state.messageTimer * 1.5);
    ctx.fillStyle = "rgba(17,21,18,.78)";
    roundedRect(ctx, GAME_WIDTH / 2 - 145, 16, 290, 30, 5);
    ctx.fill();
    ctx.fillStyle = "#eee6ce";
    ctx.font = "700 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(state.message.toUpperCase(), GAME_WIDTH / 2, 35);
    ctx.restore();
  }

  if (state.status === "paused" || state.status === "won" || state.status === "lost") {
    ctx.fillStyle = "rgba(15,19,16,.58)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = state.status === "lost" ? "#e17965" : "#e8dfc4";
    ctx.font = "800 34px monospace";
    ctx.textAlign = "center";
    const headline = state.status === "paused" ? "JOGO EM PAUSA" : state.status === "won" ? "ZONA SEGURA" : state.player.health <= 0 ? "FOSTE INFETADO" : "A BASE CAIU";
    ctx.fillText(headline, GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
}
