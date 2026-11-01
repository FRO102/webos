import assert from 'node:assert/strict';

const consts = await import('../apps/zombie-survival/constants.js');
const { chooseObjective, getObjectiveOutcome, advanceObjectiveTimer, settleObjective, recordObjectiveKill, recordEliteKill, markEliteTargetLost } = await import('../apps/zombie-survival/objective-rules.js');
assert.ok(consts.OBJECTIVES.some(o => o.id === 'protect'));
assert.ok(consts.OBJECTIVES.some(o => o.id === 'recover'));
assert.ok(consts.OBJECTIVES.some(o => o.id === 'eliminate'));
for (const id of ['clear', 'precision']) {
  const objective = consts.OBJECTIVES.find(candidate => candidate.id === id);
  assert.ok(objective, `missing objective ${id}`);
  assert.ok(Number.isInteger(objective.targetCount) && objective.targetCount > 0);
  assert.ok(Number.isFinite(objective.reward.xp) && objective.reward.xp > 0);
}
for (const o of consts.OBJECTIVES) {
  assert.ok(typeof o.reward === 'object');
  assert.ok(Number.isFinite(o.time) && o.time > 0);
  assert.ok(typeof o.label === 'string');
}
console.log('objectives structure OK');

const candidates = [
  { id: 'early', minWave: 1, weight: 1 },
  { id: 'late', minWave: 4, weight: 1 }
];
assert.equal(chooseObjective(candidates, 3, 0, () => 0), null, 'zero chance must not offer an objective');
assert.equal(chooseObjective(candidates, 3, 1, () => 0.5).id, 'early', 'wave filtering must exclude later objectives');
assert.equal(chooseObjective(candidates, 4, 1, () => 0.99).id, 'late', 'weighted selection must include objectives unlocked for the wave');
assert.equal(chooseObjective([], 1, 1, () => 0), null, 'empty candidate sets must not offer an objective');
console.log('objective chance and wave filtering OK');

assert.equal(getObjectiveOutcome({ active: true, type: 'protect', timer: 0 }), 'completed');
assert.equal(getObjectiveOutcome({ active: true, type: 'recover', collected: true, timer: 8 }), 'completed');
assert.equal(getObjectiveOutcome({ active: true, type: 'eliminate', killed: true, timer: 8 }), 'completed');
const eliteObjective = { active: true, type: 'eliminate', targetId: 'target-1', timer: 12 };
assert.equal(recordEliteKill(eliteObjective, 'other-elite'), false);
assert.equal(getObjectiveOutcome(eliteObjective), null, 'another elite must not complete the target objective');
assert.equal(recordEliteKill(eliteObjective, 'target-1'), true);
assert.equal(getObjectiveOutcome(eliteObjective), 'completed');
const lostEliteObjective = { active: true, type: 'eliminate', targetId: 'target-2', timer: 12 };
markEliteTargetLost(lostEliteObjective, ['other-elite']);
assert.equal(getObjectiveOutcome(lostEliteObjective), 'failed', 'a missing target must fail without reward');
assert.equal(getObjectiveOutcome({ active: true, type: 'recover', collected: false, timer: 0 }), 'failed');
const clearObjective = { active: true, type: 'clear', progress: 0, targetCount: 2, timer: 8 };
recordObjectiveKill(clearObjective);
recordObjectiveKill(clearObjective);
assert.equal(getObjectiveOutcome(clearObjective), 'completed');
const precisionObjective = { active: true, type: 'precision', progress: 0, targetCount: 2, timer: 8 };
recordObjectiveKill(precisionObjective, false);
recordObjectiveKill(precisionObjective, true);
assert.equal(precisionObjective.progress, 1);
assert.equal(getObjectiveOutcome(precisionObjective), null);
recordObjectiveKill(precisionObjective, true);
assert.equal(getObjectiveOutcome(precisionObjective), 'completed');
assert.equal(getObjectiveOutcome({ active: false, type: 'recover', collected: true, timer: 8 }), null);
console.log('objective completion and failure outcomes OK');

const protectObjective = { active: true, type: 'protect', timer: 5, target: { x: 10, y: 10, r: 4 } };
advanceObjectiveTimer(protectObjective, 1, { x: 20, y: 20 });
assert.equal(protectObjective.timer, 5, 'protect timer must pause outside its zone');
advanceObjectiveTimer(protectObjective, 2, { x: 10, y: 10 });
assert.equal(protectObjective.timer, 3, 'protect timer must advance inside its zone');
console.log('protect zone timing OK');

const rewardObjective = { active: true, type: 'recover', reward: { scrap: 20, xp: 25 } };
assert.deepEqual(settleObjective(rewardObjective, true), { scrap: 20, xp: 25 });
assert.equal(rewardObjective.status, 'completed');
assert.equal(settleObjective(rewardObjective, true), null, 'settled objectives must not pay out twice');
console.log('objective rewards settle once OK');
console.log('zombie-survival objectives tests: OK');
