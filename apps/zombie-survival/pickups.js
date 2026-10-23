import { rand, clamp, dist } from './utils.js';
import { state } from './state.js';
import { playSound } from './audio.js';
import { WEAPONS } from './constants.js';

export const pickups = state.pickups;
export let particles = [];
export let floatTexts = [];
export let bloodPools = [];

export function addParticle(p) { particles.push(p); }
export function addFloatText(f) { floatTexts.push(f); }

// Índices resolvidos por nome — evita quebrar quando a lista de armas muda de ordem
const IDX = {
  pistol: WEAPONS.findIndex(w => w.name === 'Pistol'),
  smg: WEAPONS.findIndex(w => w.name === 'SMG'),
  grenade: WEAPONS.findIndex(w => w.name === 'Grenade'),
  shotgun: WEAPONS.findIndex(w => w.name === 'Shotgun'),
  rifle: WEAPONS.findIndex(w => w.name === 'Rifle'),
  lmg: WEAPONS.findIndex(w => w.name === 'LMG'),
  flamethrower: WEAPONS.findIndex(w => w.name === 'Flamethrower'),
  minigun: WEAPONS.findIndex(w => w.name === 'Minigun')
};

export function spawnBloodSplat(x, y, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: rand(-90, 90),
      vy: rand(-90, 90),
      life: rand(0.3, 0.6),
      maxLife: 0.6,
      color: Math.random() < 0.5 ? '#7a1218' : '#5c0d18',
      size: rand(2, 4),
      gravity: true
    });
  }
  bloodPools.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), r: rand(6, 14), a: 0.55 });
}

export function spawnFloatText(x, y, text, color) {
  floatTexts.push({ x, y, text, color, life: 0.6, maxLife: 0.6 });
}

export function dropPickup(x, y) {
  const r = Math.random();
  let type;
  if (r < 0.30) type = 'ammo';
  else if (r < 0.50) type = 'health';
  else if (r < 0.65) type = 'ammo2';
  else if (r < 0.76) type = 'armor';
  else if (r < 0.86) type = 'medkit';
  else if (r < 0.93) type = 'heavyAmmo';
  else if (r < 0.98) type = 'shield';
  else type = null;
  if (type) pickups.push({ x, y, type, bob: Math.random() * 10 });
}

export function updatePickups(dt) {
  const pickupMul = state.classMod.pickupMul || 1;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (dist(p.x, p.y, state.player.x, state.player.y) < state.player.r + state.player.pickupRadius * pickupMul) {
      if (p.type === 'health') {
        const bonus = 1 + (state.player.medkitBonus || 0) * 0.5; // pickups beneficiam parcialmente do perk de cura
        const hpGain = Math.round(30 * state.classMod.healMul * bonus);
        state.player.hp = clamp(state.player.hp + hpGain, 0, state.player.maxHp);
        spawnFloatText(p.x, p.y - 10, '+' + hpGain + ' HP', '#8fae3c');
      } else if (p.type === 'ammo') {
        if (IDX.pistol >= 0) state.ammoState[IDX.pistol].reserve += 18;
        if (IDX.smg >= 0) state.ammoState[IDX.smg].reserve += 22;
        spawnFloatText(p.x, p.y - 10, '+LIGHT AMMO', '#ffd76b');
      } else if (p.type === 'ammo2') {
        if (IDX.grenade >= 0) {
          state.ammoState[IDX.grenade].mag = Math.min(state.ammoState[IDX.grenade].mag + 1, WEAPONS[IDX.grenade].mag);
        }
        if (IDX.shotgun >= 0) state.ammoState[IDX.shotgun].reserve += 6;
        spawnFloatText(p.x, p.y - 10, '+GRENADE', '#ffd76b');
      } else if (p.type === 'heavyAmmo') {
        if (IDX.rifle >= 0) state.ammoState[IDX.rifle].reserve += 15;
        if (IDX.lmg >= 0) state.ammoState[IDX.lmg].reserve += 40;
        if (IDX.minigun >= 0) state.ammoState[IDX.minigun].reserve += 60;
        if (IDX.flamethrower >= 0) state.ammoState[IDX.flamethrower].reserve += 50;
        spawnFloatText(p.x, p.y - 10, '+HEAVY AMMO', '#ffb347');
      } else if (p.type === 'armor') {
        state.player.armor = clamp(state.player.armor + 28, 0, state.player.maxArmor);
        spawnFloatText(p.x, p.y - 10, '+ARMOR', '#7ac8e6');
      } else if (p.type === 'medkit') {
        state.medkits += 1;
        spawnFloatText(p.x, p.y - 10, '+MEDKIT', '#d8cfa8');
      } else if (p.type === 'shield') {
        state.shieldTimer = Math.max(state.shieldTimer, 4.0);
        state.player.invuln = Math.max(state.player.invuln, 4.0);
        spawnFloatText(p.x, p.y - 10, 'SHIELDED!', '#c084fc');
      }
      playSound(640, 0.05, 'triangle', 0.03);
      pickups.splice(i, 1);
    }
  }
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity) { p.vx *= 0.9; p.vy *= 0.9; }
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.life -= dt;
    f.y -= 20 * dt;
    if (f.life <= 0) floatTexts.splice(i, 1);
  }
}
