import assert from 'node:assert/strict';
const consts = await import('../apps/zombie-survival/constants.js');
assert.ok(consts.GAME_MODES);
console.log('content test OK');
