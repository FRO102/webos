import { PAL, WORLD_W, WORLD_H } from './constants.js';
import { dist, angleTo, clamp, rand } from './utils.js';
import { state } from './state.js';
import { obstacles } from './world.js';
import { playSound } from './audio.js';
import { spawnBloodSplat, spawnFloatText, addParticle } from './pickups.js';
import { applyIncomingDamage } from './player.js';
import { killZombie } from './enemies.js';

export let bullets = [];
export let grenades = [];
export let enemyProjectiles = [];
export let shockwaves = [];

export function addBullet(b) { bullets.push(b); }
export function addGrenade(g) { grenades.push(g); }

export function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.life -= dt;
    s.radius += s.growSpeed * dt;
    if (s.life <= 0) shockwaves.splice(i, 1);
  }
}

export function explodeAt(x, y, radius, damage, sourceWeapon) {
  // Garantir que state.zombies é um array
  if (!state.zombies) state.zombies = [];
  if (sourceWeapon) state.lastDamageSource = sourceWeapon;

  shockwaves.push({ x, y, radius: radius * 0.15, maxRadius: radius, growSpeed: radius * 5.5, life: 0.32, maxLife: 0.32 });

  spawnBloodSplat(x, y, 18);
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    addParticle({
      x, y,
      vx: Math.cos(a) * rand(80, 230),
      vy: Math.sin(a) * rand(80, 230),
      life: rand(0.2, 0.45),
      maxLife: 0.45,
      color: i % 3 === 0 ? '#ffb347' : '#c0492e',
      size: rand(2, 4)
    });
  }
  for (const z of state.zombies) {
    if (z.hp <= 0) continue;
    const d = dist(x, y, z.x, z.y);
    if (d > radius) continue;
    const t = 1 - d / radius;
    const hitDmg = damage * (0.5 + t * 0.5);
    z.hp -= hitDmg;
    z.hitFlash = 0.2;
    const a = angleTo(x, y, z.x, z.y);
    const kb = 350 * t;
    z.kx = (z.kx || 0) + Math.cos(a) * kb;
    z.ky = (z.ky || 0) + Math.sin(a) * kb;
    spawnFloatText(z.x, z.y - 16, '-' + Math.round(hitDmg), '#ffb347');
    if (z.hp <= 0) killZombie(z, { explosive: true });
  }
  const pd = dist(x, y, state.player.x, state.player.y);
  if (pd < radius + 8 && state.player.alive) {
    const t = 1 - pd / radius;
    const pDmg = 36 * Math.max(0, t);
    applyIncomingDamage(pDmg, x, y, 0.95);
    const a = angleTo(x, y, state.player.x, state.player.y);
    state.player.x = clamp(state.player.x + Math.cos(a) * 85 * t, state.player.r, WORLD_W - state.player.r);
    state.player.y = clamp(state.player.y + Math.sin(a) * 85 * t, state.player.r, WORLD_H - state.player.r);
  }
  state.screenShake = Math.min(state.screenShake + 8, 12);
  playSound(75, 0.2, 'sawtooth', 0.09);
}

export function updateBullets(dt) {
  // Garantir que state.zombies é um array
  if (!state.zombies) state.zombies = [];

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let hit = false;
    let piercesLeft = b.pierce || 0;
    for (const z of state.zombies) {
      if (z.hp <= 0) continue;
      if (b.hitSet && b.hitSet.has(z)) continue; // já perfurou este alvo
      if (dist(b.x, b.y, z.x, z.y) < z.r + 2) {
        let damage = b.dmg;
        const headX = z.x + Math.cos(z.angle) * z.r * 0.45;
        const headY = z.y + Math.sin(z.angle) * z.r * 0.45;
        const isHeadshot = dist(b.x, b.y, headX, headY) < z.r * 0.48;
        const isCrit = Math.random() < b.critChance;
        if (isHeadshot) damage *= 1.5;
        if (isCrit) damage *= (b.critMul || 1.75);
        z.hp -= damage;
        z.hitFlash = 0.12;
        const kb = Math.max(70, Math.min(220, damage * 1.9));
        z.kx = (z.kx || 0) + Math.cos(state.player.angle) * kb;
        z.ky = (z.ky || 0) + Math.sin(state.player.angle) * kb;
        spawnBloodSplat(z.x, z.y, 4);
        spawnFloatText(z.x, z.y - 14, '-' + Math.round(damage), '#ffd76b');
        if (isHeadshot) spawnFloatText(z.x, z.y - 26, 'HEADSHOT', '#d8cfa8');
        if (isCrit) spawnFloatText(z.x, z.y - 36, 'CRIT', '#ffb347');
        if (b.weaponName) state.lastDamageSource = b.weaponName;
        if (z.hp <= 0) {
          killZombie(z, { headshot: isHeadshot, crit: isCrit });
        }
        if (piercesLeft > 0) {
          piercesLeft--;
          if (!b.hitSet) b.hitSet = new Set();
          b.hitSet.add(z);
          continue; // não consome a bala, continua a viajar
        }
        hit = true;
        break;
      }
    }
    for (const o of obstacles) {
      if (o.hp > 0 && b.x > o.x - o.w / 2 && b.x < o.x + o.w / 2 && b.y > o.y - o.h / 2 && b.y < o.y + o.h / 2) {
        hit = true;
        o.hp -= b.dmg;
      }
    }
    if (hit || b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
      bullets.splice(i, 1);
    }
  }
}

export function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.fuse -= dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.vx *= 0.985;
    g.vy *= 0.985;
    if (g.x < 8 || g.x > WORLD_W - 8) g.vx *= -0.65;
    if (g.y < 8 || g.y > WORLD_H - 8) g.vy *= -0.65;
    g.x = clamp(g.x, 8, WORLD_W - 8);
    g.y = clamp(g.y, 8, WORLD_H - 8);
    if (g.fuse <= 0) {
      explodeAt(g.x, g.y, g.radius || 130, g.damage || 120, g.weaponName);
      grenades.splice(i, 1);
    }
  }
}

export function updateEnemyProjectiles(dt) {
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const p = enemyProjectiles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (state.player.alive && dist(p.x, p.y, state.player.x, state.player.y) < state.player.r + p.r) {
      applyIncomingDamage(p.dmg, p.x, p.y, 0.8);
      state.player.invuln = Math.max(state.player.invuln, 0.18);
      playSound(120, 0.07, 'sawtooth', 0.04);
      const a = angleTo(p.x, p.y, state.player.x, state.player.y);
      state.player.x = clamp(state.player.x + Math.cos(a) * 18, state.player.r, WORLD_W - state.player.r);
      state.player.y = clamp(state.player.y + Math.sin(a) * 18, state.player.r, WORLD_H - state.player.r);
      enemyProjectiles.splice(i, 1);
      continue;
    }
    if (p.life <= 0 || p.x < 0 || p.x > WORLD_W || p.y < 0 || p.y > WORLD_H) {
      enemyProjectiles.splice(i, 1);
    }
  }
}
