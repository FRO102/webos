import assert from 'node:assert/strict';

const consts = await import('../apps/zombie-survival/constants.js');
assert.ok(consts.OBJECTIVES.some(o => o.id === 'protect'));
assert.ok(consts.OBJECTIVES.some(o => o.id === 'recover'));
assert.ok(consts.OBJECTIVES.some(o => o.id === 'eliminate'));
for (const o of consts.OBJECTIVES) {
  assert.ok(typeof o.reward === 'object');
  assert.ok(Number.isFinite(o.time) && o.time > 0);
  assert.ok(typeof o.label === 'string');
}
console.log('objectives structure OK');
console.log('zombie-survival objectives tests: OK');
