import assert from 'node:assert/strict';

const consts = await import('../apps/zombie-survival/constants.js');
const world = await import('../apps/zombie-survival/world.js');

// pickRandomMap
const rm = world.pickRandomMap();
assert.ok(consts.MAPS[rm], 'pickRandomMap should return a valid map key');
console.log('pickRandomMap OK:', rm);

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
