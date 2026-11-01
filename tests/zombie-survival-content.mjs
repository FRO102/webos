import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const consts = await import('../apps/zombie-survival/constants.js');
const modeRules = await import('../apps/zombie-survival/mode-rules.js');
const mapRules = await import('../apps/zombie-survival/map-rules.js');
assert.ok(consts.GAME_MODES);
assert.equal(mapRules.restoreMapSelection('random', consts.MAPS), 'random');
assert.equal(mapRules.restoreMapSelection('city', consts.MAPS), 'city');
assert.equal(mapRules.restoreMapSelection('missing-map', consts.MAPS), 'forest');
assert.equal(modeRules.getModeStartWave(consts.GAME_MODES.find(mode => mode.id === 'challenge')), 8);
assert.equal(modeRules.isModeComplete(consts.GAME_MODES.find(mode => mode.id === 'challenge'), 11), false);
assert.equal(modeRules.getModeResultCopy(consts.GAME_MODES.find(mode => mode.id === 'challenge'), true, 'pt').title, 'MISSÃO CONCLUÍDA');
assert.equal(modeRules.getModeResultCopy(consts.GAME_MODES.find(mode => mode.id === 'challenge'), true, 'en').title, 'CHALLENGE COMPLETE');
const challengeMode = consts.GAME_MODES.find(mode => mode.id === 'challenge');
assert.ok(challengeMode.spawnMul <= 1.2, 'challenge spawn pressure should stay under 1.2x');
assert.ok(challengeMode.objectiveChance <= 0.8, 'challenge objective chance should stay under 0.8');
assert.equal(consts.WEAPONS.length, 13);
assert.equal(consts.PERKS.length, 19);
const burstCarbine = consts.WEAPONS.find(weapon => weapon.name === 'Burst Carbine');
const lightningLance = consts.WEAPONS.find(weapon => weapon.name === 'Lança-Raios');
const minionSummoner = consts.WEAPONS.find(weapon => weapon.name === 'Invocadora de Minions');
assert.equal(burstCarbine.unlockedWave, 8);
assert.equal(lightningLance.unlockedWave, 11);
assert.equal(minionSummoner.unlockedWave, 14);
assert.ok(burstCarbine.reserve > 0 && lightningLance.reserve > 0 && minionSummoner.reserve > 0);
for (const removedName of ['Rifle', 'Crossbow', 'Auto Shotgun', 'LMG']) {
  assert.equal(consts.WEAPONS.some(weapon => weapon.name === removedName), false, `${removedName} should be removed`);
}

const fieldRations = consts.PERKS.find(perk => perk.id === 'field_rations');
const bloodRunner = consts.PERKS.find(perk => perk.id === 'blood_runner');
const battleHardened = consts.PERKS.find(perk => perk.id === 'battle_hardened');
const ammoState = [{ reserve: 10 }, { reserve: 0 }];
fieldRations.apply({}, 0, ammoState);
assert.deepEqual(ammoState.map(ammo => ammo.reserve), [12, 0]);
const perkPlayer = { staminaOnKill: 0, xpMul: 1 };
bloodRunner.apply(perkPlayer);
battleHardened.apply(perkPlayer);
assert.equal(perkPlayer.staminaOnKill, 6);
assert.equal(perkPlayer.xpMul, 1.15);
assert.equal(modeRules.isModeComplete(consts.GAME_MODES.find(mode => mode.id === 'challenge'), 12), true);
assert.equal(consts.GAME_MODES.find(mode => mode.id === 'standard').endless, true);
for (const mode of consts.GAME_MODES.filter(candidate => !candidate.endless)) {
  assert.ok(Number.isFinite(mode.maxWave), `finite mode ${mode.id} must define maxWave`);
}
const html = await readFile(new URL('../apps/zombie-survival/index.html', import.meta.url), 'utf8');
assert.match(html, /13 weapons, 15 enemy types, 19 perks/);
const css = await readFile(new URL('../apps/zombie-survival/zombie-survival.css', import.meta.url), 'utf8');
assert.match(css, /#mobile-controls\s*\{\s*display\s*:\s*none\s*;/, 'touch controls should be hidden by default');
assert.equal((css.match(/#mobile-controls\s*\{/g) || []).length, 2, 'mobile controls should only have base and coarse-pointer rules');
const ui = await readFile(new URL('../apps/zombie-survival/ui.js', import.meta.url), 'utf8');
assert.match(ui, /slot\.tabIndex\s*=\s*0/, 'weapon slots should be keyboard focusable');
assert.match(ui, /setAttribute\('aria-label',\s*`Selecione a arma \$\{w\.name\}`\)/, 'weapon slots should have accessible names');
assert.match(ui, /setAttribute\('aria-pressed',\s*String\(state\.player\.weaponIdx === i\)\)/, 'weapon slots should expose selection state');
const renderJs = await readFile(new URL('../apps/zombie-survival/render.js', import.meta.url), 'utf8');
assert.match(renderJs, /drawHazards\s*\(/, 'rendering should keep hazard markers');
assert.match(renderJs, /drawInteractables\s*\(/, 'rendering should keep interactive markers');
assert.match(renderJs, /type === 'cache'/, 'interactive rendering should keep cache logic');
assert.match(renderJs, /type === 'altar'/, 'interactive rendering should keep altar logic');
for (const mapId of Object.keys(consts.MAPS)) {
  assert.match(html, new RegExp(`<option value="${mapId}"`), `map ${mapId} should be available in the selector`);
}
for (const map of Object.values(consts.MAPS)) {
  assert.ok(Object.keys(map.debrisMix).every(type => ['rock', 'bush'].includes(type)), `${map.label} uses supported debris`);
  assert.ok(Object.keys(map.obstacleMix).every(type => consts.OBSTACLE_DIMENSIONS[type]), `${map.label} uses obstacles with collision dimensions`);
  assert.ok((map.mechanics.hazards || []).every(hazard => ['slow', 'damage', 'poison'].includes(hazard.type)), `${map.label} uses supported hazards`);
  assert.ok((map.mechanics.interactives || []).every(interactive => ['cache', 'altar'].includes(interactive.type)), `${map.label} uses supported interactives`);
}
const mapSignatureObjects = {
  forest: 'tree',
  city: 'car',
  graveyard: 'grave',
  wasteland: 'toxicDrum',
  desert: 'cactus',
  subway: 'subwayCar',
  ironworks: 'furnace'
};
for (const [mapId, objectType] of Object.entries(mapSignatureObjects)) {
  assert.ok(consts.MAPS[mapId].obstacleMix[objectType] > 0, `${mapId} should include its signature object`);
}
console.log('content test OK');
