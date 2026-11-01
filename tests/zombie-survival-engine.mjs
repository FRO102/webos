import assert from 'node:assert/strict';

const consts = await import('../apps/zombie-survival/constants.js');
const world = await import('../apps/zombie-survival/world.js');
const modeRules = await import('../apps/zombie-survival/mode-rules.js');
const weaponRules = await import('../apps/zombie-survival/weapon-rules.js');
const pickups = await import('../apps/zombie-survival/pickups.js');
const { claimZombieDeath, isPlayerCreditedDeath } = await import('../apps/zombie-survival/death-rules.js');
const { state } = await import('../apps/zombie-survival/state.js');

// pickRandomMap
const rm = world.pickRandomMap();
assert.ok(consts.MAPS[rm], 'pickRandomMap should return a valid map key');
console.log('pickRandomMap OK:', rm);
const dyingZombie = { hp: 10 };
assert.equal(claimZombieDeath(dyingZombie), true);
assert.equal(dyingZombie.hp, 0);
assert.equal(claimZombieDeath(dyingZombie), false, 'a zombie death can only be resolved once');
assert.equal(claimZombieDeath(null), false);
assert.equal(isPlayerCreditedDeath({}), true, 'player-caused kills should remain credited by default');
assert.equal(isPlayerCreditedDeath({ summoned: true }), true, 'allied minion kills should be credited');
assert.equal(isPlayerCreditedDeath({ attributed: false }), false, 'autonomous enemy detonations should not be credited');
console.log('zombie death resolution guard OK');
const originalRandom = Math.random;
Math.random = () => 0.999999;
assert.equal(world.pickRandomMap(), Object.keys(consts.MAPS).at(-1), 'random map selection should include newly added maps');
Math.random = originalRandom;

const previousRuntimeMap = state.runtimeMap;
state.runtimeMap = 'city';
world.resetMapMechanics();
const cityMechanics = world.currentMapMechanics();
assert.equal(cityMechanics.interactives[0].type, 'cache', 'city door should be a usable supply cache');
cityMechanics.interactives[0].used = true;
world.resetMapMechanics();
assert.equal(world.currentMapMechanics().interactives[0].used, undefined, 'interactives should reset for a new run');
assert.equal(consts.MAPS.city.mechanics.interactives[0].used, undefined, 'runtime interactions must not mutate map definitions');
const previousPlayerPosition = { x: state.player.x, y: state.player.y };
const previousScrap = state.scrap;
const previousMedkits = state.medkits;
const previousObjective = state.objective;
state.player.x = 1520;
state.player.y = 760;
state.scrap = 0;
state.medkits = 0;
state.objective = { active: true, type: 'recover', collected: false };
world.tryInteract();
assert.equal(state.scrap, 40);
assert.equal(state.medkits, 1);
assert.equal(state.objective.collected, true, 'collecting a map cache should complete recover objectives');
world.tryInteract();
assert.equal(state.scrap, 40, 'used caches should not award scrap twice');
state.player.x = previousPlayerPosition.x;
state.player.y = previousPlayerPosition.y;
state.scrap = previousScrap;
state.medkits = previousMedkits;
state.objective = previousObjective;
state.runtimeMap = previousRuntimeMap;
world.resetMapMechanics();
console.log('map interactive reward and reset OK');

const previousRandom = Math.random;
Math.random = () => 0;
for (const [mapId, objectType] of Object.entries({
  forest: 'tree', city: 'car', graveyard: 'grave', wasteland: 'toxicDrum',
  desert: 'cactus', subway: 'subwayCar', ironworks: 'furnace'
})) {
  state.runtimeMap = mapId;
  world.buildObstacles();
  assert.ok(world.obstacles.some(obstacle => obstacle.type === objectType), `${mapId} should generate ${objectType}`);
  for (const obstacle of world.obstacles) {
    assert.deepEqual({ w: obstacle.w, h: obstacle.h }, consts.OBSTACLE_DIMENSIONS[obstacle.type]);
  }
}
Math.random = previousRandom;
state.runtimeMap = previousRuntimeMap;
world.resetMapMechanics();
console.log('map signature objects generate with collision dimensions OK');

const previousAmmoState = state.ammoState;
const previousPickups = state.pickups.slice();
const previousPickupPosition = { x: state.player.x, y: state.player.y };
state.player.x = 100;
state.player.y = 100;
state.ammoState = consts.WEAPONS.map(weapon => ({ mag: weapon.mag, reserve: 0 }));
state.pickups.length = 0;
state.pickups.push({ x: 101, y: 100, type: 'ammo2' }, { x: 101, y: 100, type: 'heavyAmmo' });
pickups.updatePickups(0);
const carbineIndex = consts.WEAPONS.findIndex(weapon => weapon.name === 'Burst Carbine');
const lightningIndex = consts.WEAPONS.findIndex(weapon => weapon.name === 'Lança-Raios');
const summonerIndex = consts.WEAPONS.findIndex(weapon => weapon.name === 'Invocadora de Minions');
assert.equal(state.ammoState[carbineIndex].reserve, 24);
assert.equal(state.ammoState[lightningIndex].reserve, 12);
assert.equal(state.ammoState[summonerIndex].reserve, 2);
state.ammoState = previousAmmoState;
state.pickups.length = 0;
state.pickups.push(...previousPickups);
state.player.x = previousPickupPosition.x;
state.player.y = previousPickupPosition.y;
console.log('new weapon ammo pickups OK');

const lightningTargets = weaponRules.selectLightningTargets([
  { x: 100, y: 0, r: 10, hp: 20 },
  { x: 200, y: 0, r: 10, hp: 20 },
  { x: 250, y: 50, r: 10, hp: 20 },
  { x: 350, y: 0, r: 10, hp: 20 }
], { x: 0, y: 0 }, 0, 300, 3);
assert.deepEqual(lightningTargets.map(target => target.x), [100, 200, 250]);
assert.equal(weaponRules.hasSummonCapacity([{ life: 4 }, { life: 4 }, { life: 4 }], 3), false);
assert.equal(weaponRules.hasSummonCapacity([{ life: 0 }, { life: 4 }], 3), true);
console.log('lightning chain and summon capacity OK');

assert.equal(modeRules.shouldSpawnBoss(3, 1), true, 'boss cadence should be configurable');
assert.equal(modeRules.shouldSpawnBoss(4, 5), false, 'default cadence should not spawn a boss before wave 5');
assert.equal(modeRules.shouldSpawnBoss(5, 5), true, 'default cadence should spawn a boss at wave 5');
console.log('wave boss cadence OK');

// objectives structure
assert.ok(Array.isArray(consts.OBJECTIVES) && consts.OBJECTIVES.length >= 3);
for (const o of consts.OBJECTIVES) {
  assert.ok(typeof o.id === 'string' && typeof o.label === 'string' && Number.isFinite(o.time));
}
console.log('OBJECTIVES OK');

// ZTYPES ignores obstacles only for ghost
assert.equal(consts.ZTYPES.ghost.ignoresObstacles, true);
assert.equal(consts.ZTYPES.walker.ignoresObstacles, undefined);
console.log('ghost ignoresObstacles OK');

console.log('zombie-survival engine tests: OK');
