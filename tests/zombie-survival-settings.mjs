import assert from 'node:assert/strict';
import { mergeSettings } from '../apps/zombie-survival/settings-rules.js';

const initial = JSON.stringify({
  gameMode: 'bossrush',
  difficulty: 'nightmare',
  playerClass: 'medic',
  audioVolume: 0.35,
  audioMuted: true
});

assert.deepEqual(JSON.parse(mergeSettings(initial, { audioMuted: false })), {
  gameMode: 'bossrush',
  difficulty: 'nightmare',
  playerClass: 'medic',
  audioVolume: 0.35,
  audioMuted: false
});
assert.deepEqual(JSON.parse(mergeSettings('{broken', { difficulty: 'rookie' })), {
  difficulty: 'rookie'
});
console.log('zombie-survival settings tests: OK');