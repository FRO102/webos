import { WEAPONS, PERKS, CRIT_CHANCE_BASE, CRIT_CHANCE_CALLED, CRIT_MUL, CALLED_SHOT_MUL, HEADSHOT_MUL, PAL, WORLD_W, WORLD_H } from './constants.js';
import { clamp, angleTo, dist, rand, randInt } from './utils.js';
import { playSound } from './audio.js';
import { keys, mouseX, mouseY, rightMouseDown, touchFiring, mouseDown, joystickVec } from './input.js';
import { state, isWeaponUnlocked } from './state.js';
import { spawnBloodSplat, spawnFloatText, dropPickup, addParticle } from './pickups.js';
import { flashHit, onPlayerDeath, openPerkChoice, refreshWeaponSlots } from './game.js';
import { addBullet, addGrenade } from './projectiles.js';
import { killZombie } from './enemies.js';
import { triggerDamageIndicator } from './ui.js';
import { checkAchievements } from './achievements.js';

// Funções de acesso ao estado do jogador
export function resetPlayerState(classMod) {
  state.player.x = 900;
  state.player.y = 600;
  state.player.speed = 150 + classMod.speedBonus;
  state.player.sprintSpeed = 245 + classMod.speedBonus;
  state.player.maxHp = 100;
  state.player.maxStamina = 100;
  state.player.maxArmor = 100 + (classMod.armorBonus || 0);
  state.player.armor = classMod.armorBonus ? classMod.armorBonus : 0;
  state.player.hp = state.player.maxHp;
  state.player.stamina = state.player.maxStamina;
  state.player.pickupRadius = 12;
  state.player.level = 1;
  state.player.xp = 0;
  state.player.nextXp = 40;
  state.player.dmgMul = classMod.dmgMul;
  state.player.alive = true;
  state.player.invuln = 0;
  state.player.weaponIdx = 0;
  state.player.meleeCd = 0;
  // Bónus de perks — resetados a cada run
  state.player.reloadMul = 1;
  state.player.spreadMul = 1;
  state.player.freeSprint = false;
  state.player.lifesteal = 0;
  state.player.dashCdBonusMul = 1;
  state.player.armorAbsorb = 0.65;
  state.player.critMulBonus = 0;
  state.player.medkitBonus = 0;
  state.player.hasUndying = false;
  state.player.undyingReady = true;
  state.player.hasBerserker = false;
  state.ammoState = WEAPONS.map(w => ({ mag: w.mag, reserve: Math.round(w.reserve * classMod.ammoMul) }));
  state.medkits = classMod.startMedkits;
  state.dashCooldown = 0;
  state.dashDuration = 0;
  state.dashMaxCooldown = 2.8 * classMod.dashCdMul;
  state.reloading = false;
  state.reloadTimer = 0;
  state.fireTimer = 0;
  state.meleeSwingTimer = 0;
  state.spinUpLevel = 0;
}

export function switchWeapon(idx) {
  if(idx < 0 || idx >= WEAPONS.length) return;
  if(!isWeaponUnlocked(idx)) return;
  if(state.player.weaponIdx === idx) return;
  state.player.weaponIdx = idx;
  state.reloading = false;
  state.reloadTimer = 0;
  state.spinUpLevel = 0;
  refreshWeaponSlots();
}

export function cycleWeapon(dir) {
  // dir: +1 (próxima) ou -1 (anterior); salta armas bloqueadas
  const n = WEAPONS.length;
  let idx = state.player.weaponIdx;
  for (let i = 0; i < n; i++) {
    idx = (idx + dir + n) % n;
    if (isWeaponUnlocked(idx)) { switchWeapon(idx); return; }
  }
}

export function reload() {
  const w = WEAPONS[state.player.weaponIdx];
  if(w.type === 'grenade' || w.type === 'melee') return;
  const st = state.ammoState[state.player.weaponIdx];
  if(state.reloading || st.mag >= w.mag || st.reserve <= 0) return;
  state.reloading = true;
  state.reloadTimer = w.reloadTime * (state.player.reloadMul || 1);
}

export function tryUseMedkit() {
  if(!state.player.alive || state.medkits <= 0 || state.player.hp >= state.player.maxHp) return;
  state.medkits--;
  const bonus = 1 + (state.player.medkitBonus || 0);
  const healAmount = Math.round(34 * state.classMod.healMul * bonus);
  state.player.hp = clamp(state.player.hp + healAmount, 0, state.player.maxHp);
  playSound(680, 0.08, 'triangle', 0.05);
  spawnFloatText(state.player.x, state.player.y-24, '+' + healAmount + ' HP', '#8fae3c');
}

export function tryDash() {
  if(!state.player.alive || state.dashCooldown > 0 || state.player.stamina < 18) return;
  let dx = 0, dy = 0;
  if(keys['w']||keys['arrowup']) dy -= 1;
  if(keys['s']||keys['arrowdown']) dy += 1;
  if(keys['a']||keys['arrowleft']) dx -= 1;
  if(keys['d']||keys['arrowright']) dx += 1;
  if(joystickVec.x || joystickVec.y) { dx += joystickVec.x; dy += joystickVec.y; }
  const len = Math.hypot(dx, dy);
  if(len > 0) { dx /= len; dy /= len; }
  else { dx = Math.cos(state.player.angle); dy = Math.sin(state.player.angle); }
  const dashSpeed = 520 + state.classMod.speedBonus * 2.5;
  state.dashVx = dx * dashSpeed;
  state.dashVy = dy * dashSpeed;
  state.dashDuration = 0.14;
  state.dashMaxCooldown = 2.8 * state.classMod.dashCdMul * (state.player.dashCdBonusMul || 1);
  state.dashCooldown = state.dashMaxCooldown;
  state.player.stamina = clamp(state.player.stamina - 18, 0, state.player.maxStamina);
  state.player.invuln = Math.max(state.player.invuln, 0.12);
  state.screenShake = Math.min(state.screenShake + 1.8, 8);
  playSound(820, 0.05, 'square', 0.03);
}

function berserkerActive() {
  return state.player.hasBerserker && state.player.hp / state.player.maxHp < 0.30;
}

function currentDmgMul() {
  return state.player.dmgMul * (berserkerActive() ? 1.35 : 1);
}

export function shoot() {
  const w = WEAPONS[state.player.weaponIdx];

  if (w.type === 'melee') {
    meleeAttack(w);
    return;
  }

  if(w.type === 'grenade') {
    if(state.fireTimer > 0) return;
    if (w.name === 'Rocket') throwRocket();
    else throwGrenade();
    state.fireTimer = w.fireRate;
    return;
  }

  const st = state.ammoState[state.player.weaponIdx];
  if(state.reloading) return;
  if(state.fireTimer > 0) return;
  if(st.mag <= 0) {
    if(st.reserve > 0) reload();
    else { meleeAttack(); state.fireTimer = 0.16; }
    state.spinUpLevel = Math.max(0, state.spinUpLevel - 0.08);
    return;
  }

  // Minigun: precisa "aquecer" antes de disparar à cadência máxima
  if (w.spinUp) {
    state.spinUpLevel = clamp((state.spinUpLevel || 0) + 0.045, 0, 1);
    if (state.spinUpLevel < 1) {
      // durante o spin-up ainda gasta pouca munição e atira mais devagar
      state.fireTimer = w.fireRate * (1.6 - state.spinUpLevel * 0.6);
      if (Math.random() > state.spinUpLevel) return;
    } else {
      state.fireTimer = w.fireRate;
    }
  } else {
    state.fireTimer = w.fireRate;
  }

  // Flamethrower: dano curto-alcance contínuo, não gasta 1 bala visual por tick
  if (w.type === 'flame') {
    st.mag--;
    fireFlameTick(w);
    return;
  }

  st.mag--;
  const calledShot = rightMouseDown;
  const shotMul = calledShot ? CALLED_SHOT_MUL : 1;
  const critChance = calledShot ? CRIT_CHANCE_CALLED : CRIT_CHANCE_BASE;
  const critMul = CRIT_MUL + (state.player.critMulBonus || 0);
  const finalDmg = w.dmg * currentDmgMul() * shotMul;
  const spreadMul0 = state.player.spreadMul || 1;

  for(let p=0; p<w.pellets; p++) {
    const spreadMulCalled = calledShot ? 0.5 : 1;
    const spread = (Math.random()-0.5) * w.spread * 2 * spreadMulCalled * spreadMul0;
    const a = state.player.angle + spread;
    addBullet({
      x: state.player.x + Math.cos(state.player.angle)*16,
      y: state.player.y + Math.sin(state.player.angle)*16,
      vx: Math.cos(a)*w.bulletSpeed,
      vy: Math.sin(a)*w.bulletSpeed,
      dmg: finalDmg,
      life: 0.7,
      critChance,
      critMul,
      calledShot,
      pierce: w.pierce || 0,
      weaponName: w.name
    });
  }
  // Muzzle particles
  for(let i=0; i<4; i++) {
    addParticle({
      x: state.player.x + Math.cos(state.player.angle)*18,
      y: state.player.y + Math.sin(state.player.angle)*18,
      vx: Math.cos(state.player.angle)*rand(60,160) + rand(-40,40),
      vy: Math.sin(state.player.angle)*rand(60,160) + rand(-40,40),
      life: 0.15, maxLife: 0.15, color: PAL.muzzle, size: 3
    });
  }
  state.screenShake = Math.min(state.screenShake + 2.2, 8);
  playSound(calledShot ? 420 : 520, 0.06, calledShot ? 'triangle' : 'square', calledShot ? 0.04 : 0.03);
}

function fireFlameTick(w) {
  const finalDmg = w.dmg * currentDmgMul();
  let hitAny = false;
  for (const z of state.zombies) {
    if (z.hp <= 0) continue;
    const d = dist(state.player.x, state.player.y, z.x, z.y);
    if (d > w.range) continue;
    const a = angleTo(state.player.x, state.player.y, z.x, z.y);
    const da = Math.atan2(Math.sin(a - state.player.angle), Math.cos(a - state.player.angle));
    if (Math.abs(da) > 0.32) continue;
    z.hp -= finalDmg;
    z.hitFlash = 0.08;
    state.lastDamageSource = w.name;
    hitAny = true;
    if (Math.random() < 0.4) spawnFloatText(z.x, z.y - 12, '-' + Math.round(finalDmg), '#ffb347');
    if (z.hp <= 0) killZombie(z);
  }
  if (Math.random() < 0.6) {
    addParticle({
      x: state.player.x + Math.cos(state.player.angle) * rand(20, w.range * 0.7),
      y: state.player.y + Math.sin(state.player.angle) * rand(20, w.range * 0.7),
      vx: rand(-20,20), vy: rand(-40,-10),
      life: 0.22, maxLife: 0.22, color: Math.random() < 0.5 ? '#ffb347' : '#ff6b3d', size: rand(3,6)
    });
  }
  if (hitAny) state.screenShake = Math.min(state.screenShake + 0.3, 5);
  playSound(180, 0.03, 'sawtooth', 0.02);
}

export function throwGrenade() {
  const st = state.ammoState[1];
  if(st.mag <= 0) return;
  st.mag--;
  const throwSpeed = 370;
  addGrenade({
    x: state.player.x + Math.cos(state.player.angle)*18,
    y: state.player.y + Math.sin(state.player.angle)*18,
    vx: Math.cos(state.player.angle)*throwSpeed,
    vy: Math.sin(state.player.angle)*throwSpeed,
    fuse: 1.05,
    r: 6,
    weaponName: 'Grenade'
  });
  state.screenShake = Math.min(state.screenShake + 1.6, 8);
  playSound(240, 0.08, 'triangle', 0.04);
}

export function throwRocket() {
  // Rocket usa o mesmo pipeline de grenade mas com raio/dano próprios
  const w = WEAPONS[state.player.weaponIdx];
  const st = state.ammoState[state.player.weaponIdx];
  if (st.mag <= 0) return;
  st.mag--;
  addGrenade({
    x: state.player.x + Math.cos(state.player.angle)*18,
    y: state.player.y + Math.sin(state.player.angle)*18,
    vx: Math.cos(state.player.angle) * 480,
    vy: Math.sin(state.player.angle) * 480,
    fuse: 1.4,
    r: 7,
    radius: 150,
    damage: w.dmg,
    weaponName: 'Rocket'
  });
  state.screenShake = Math.min(state.screenShake + 2.4, 10);
  playSound(200, 0.1, 'sawtooth', 0.05);
}

export function meleeAttack(weaponOverride) {
  if (!state.player.alive || state.player.meleeCd > 0) return;
  const isMachete = weaponOverride && weaponOverride.type === 'melee';
  state.player.meleeCd = isMachete ? weaponOverride.fireRate : 0.55;
  state.meleeSwingTimer = 0.13;
  const range = isMachete ? weaponOverride.range : state.player.meleeRange;
  const arc = isMachete ? weaponOverride.arc : state.player.meleeArc;
  const baseDmg = isMachete
    ? weaponOverride.dmg * currentDmgMul()
    : 18 + state.player.level * 1.5;
  let hits = 0;

  for (const z of state.zombies) {
    if (z.hp <= 0) continue;
    const d = dist(state.player.x, state.player.y, z.x, z.y);
    if (d > range + z.r) continue;
    const a = angleTo(state.player.x, state.player.y, z.x, z.y);
    const da = Math.atan2(Math.sin(a - state.player.angle), Math.cos(a - state.player.angle));
    if (Math.abs(da) > arc * 0.5) continue;
    z.hp -= baseDmg;
    z.hitFlash = 0.16;
    const knock = 160;
    z.kx = (z.kx || 0) + Math.cos(state.player.angle) * knock;
    z.ky = (z.ky || 0) + Math.sin(state.player.angle) * knock;
    spawnBloodSplat(z.x, z.y, 6);
    spawnFloatText(z.x, z.y - 16, '-' + Math.round(baseDmg), '#d8cfa8');
    state.lastDamageSource = isMachete ? weaponOverride.name : 'Melee';
    hits++;
    if (z.hp <= 0) killZombie(z, { melee: true });
  }

  if (hits === 0) {
    spawnFloatText(
      state.player.x + Math.cos(state.player.angle) * 20,
      state.player.y + Math.sin(state.player.angle) * 20,
      'MISS',
      '#8b8968'
    );
  }
  state.screenShake = Math.min(state.screenShake + 3.4, 10);
}

export function applyIncomingDamage(amount, fromX, fromY, indicatorPower) {
  if(!state.player.alive) return;
  let dmg = amount;
  if(state.player.armor > 0) {
    const absorbRate = state.player.armorAbsorb || 0.65;
    const blocked = Math.min(state.player.armor, dmg * absorbRate);
    state.player.armor -= blocked;
    dmg -= blocked;
  }
  let newHp = clamp(state.player.hp - dmg, 0, state.player.maxHp);
  // Undying: uma vez por night, um golpe fatal deixa o jogador com 1 HP
  if (newHp <= 0 && state.player.hasUndying && state.player.undyingReady) {
    newHp = 1;
    state.player.undyingReady = false;
    spawnFloatText(state.player.x, state.player.y - 30, 'UNDYING!', '#c084fc');
    playSound(760, 0.25, 'triangle', 0.07);
  }
  state.player.hp = newHp;
  flashHit();
  if(Number.isFinite(fromX) && Number.isFinite(fromY)) {
    triggerDamageIndicator(fromX, fromY, indicatorPower || 0.75);
  }
  if(state.player.hp <= 0) onPlayerDeath();
}

export function onKillLifesteal() {
  if (state.player.lifesteal > 0 && state.player.alive) {
    state.player.hp = clamp(state.player.hp + state.player.lifesteal, 0, state.player.maxHp);
  }
}

export function gainXP(amount) {
  state.player.xp += Math.round(amount * state.difficultyMod.xpMul);
  if(state.player.xp >= state.player.nextXp && !state.perkPending) {
    openPerkChoice();
  }
}
