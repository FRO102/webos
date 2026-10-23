import { ZTYPES, BOSS_VARIANTS, WORLD_W, WORLD_H } from './constants.js';
import { rand, clamp, angleTo, dist } from './utils.js';
import { state } from './state.js';
import { spawnBloodSplat, spawnFloatText, dropPickup } from './pickups.js';
import { playSound } from './audio.js';
import { applyIncomingDamage, gainXP, onKillLifesteal } from './player.js';
import { explodeAt, enemyProjectiles } from './projectiles.js';
import { checkAchievements } from './achievements.js';

export function resetEnemies() {
  state.zombies.length = 0;
}

export function spawnZombie(type) {
  const def = ZTYPES[type];
  const ang = Math.random() * Math.PI * 2;
  const spawnDist = rand(420, 560);
  let x = state.player.x + Math.cos(ang) * spawnDist;
  let y = state.player.y + Math.sin(ang) * spawnDist;
  x = clamp(x, 20, WORLD_W - 20);
  y = clamp(y, 20, WORLD_H - 20);
  const zombie = {
    x, y, type,
    hp: def.hp * state.difficultyMod.enemyHp,
    maxHp: def.hp * state.difficultyMod.enemyHp,
    speed: def.speed * state.difficultyMod.enemySpeed,
    dmg: def.dmg * state.difficultyMod.enemyDmg,
    r: def.r,
    color: def.color, angle: 0, hitFlash: 0, attackCd: 0, wobble: Math.random() * 10,
    spitCd: rand(1.2, 2.3), kx: 0, ky: 0,
    // campos específicos de comportamentos novos
    screamCd: rand(2.5, 4.0),
    summonCd: rand(4.0, 6.0),
    bossVariant: type === 'boss' ? state.bossVariant : null
  };
  state.zombies.push(zombie);
  return zombie;
}

export function waveComposition(w) {
  const list = [];
  let total = 5 + w * 3;
  if (w % 5 === 0) total = Math.max(8, total - 8);

  for (let i = 0; i < total; i++) {
    let t = 'walker';
    const r = Math.random();

    // Tipos base
    if (w >= 2 && r < 0.24) t = 'runner';
    if (w >= 3 && r >= 0.24 && r < 0.32) t = 'crawler';
    if (w >= 4 && r > 0.85) t = 'brute';
    if (w >= 5 && r > 0.60 && r < 0.72) t = 'spitter';
    if (w >= 6 && r > 0.72 && r < 0.80) t = 'exploder';
    if (w >= 7 && r > 0.80 && r < 0.85) t = 'bomber';

    // Enxame e suporte
    if (w >= 3 && r >= 0.32 && r < 0.40) t = 'swarmer';
    if (w >= 9 && r >= 0.40 && r < 0.46) t = 'screamer';
    if (w >= 11 && r >= 0.46 && r < 0.52) t = 'ghost';

    // Elite / pesados
    if (w >= 8 && r > 0.92 && r < 0.97) t = 'tank';
    if (w >= 10 && r > 0.15 && r < 0.22) t = 'shocker';
    if (w >= 12 && r > 0.55 && r < 0.60) t = 'healer';
    if (w >= 14 && r > 0.97) t = 'juggernaut';

    list.push(t);
  }

  // Boss a cada 5 waves — sabor rotativo (brawler / summoner / artillery)
  if (w % 5 === 0) list.push('boss');
  return list;
}

export function pickBossVariant(w) {
  const idx = Math.floor(w / 5 - 1) % BOSS_VARIANTS.length;
  return BOSS_VARIANTS[(idx + BOSS_VARIANTS.length) % BOSS_VARIANTS.length];
}

function trackWeaponKill(z) {
  // state.lastDamageWeapon é definido em projectiles.js/player.js antes de killZombie
  const wname = state.lastDamageSource || 'Melee';
  state.lifetimeStats.weaponKills[wname] = (state.lifetimeStats.weaponKills[wname] || 0) + 1;
}

export function killZombie(z, opts) {
  opts = opts || {};
  z.hp = 0;
  if (z.type === 'exploder' || z.type === 'bomber') {
    explodeAt(z.x, z.y, z.type === 'bomber' ? 120 : 95, z.type === 'bomber' ? 80 : 62);
  }
  state.killCount++;
  state.lifetimeStats.totalKills++;
  trackWeaponKill(z);
  if (opts.melee) state.lifetimeStats.meleeKills++;
  if (opts.headshot) state.lifetimeStats.headshotKills++;
  if (opts.crit) state.lifetimeStats.critKills++;
  if (z.type === 'boss') state.lifetimeStats.bossKills++;
  if (opts.explosive) checkAchievements({ type:'explosiveKillEvent' });

  // Atualiza combo
  state.comboCount += 1;
  state.comboTimer = 3.1;
  state.comboMult = 1 + Math.min(2.0, state.comboCount * 0.14);
  state.bestComboThisRun = Math.max(state.bestComboThisRun, state.comboMult);
  const comboEl = document.getElementById('combo-indicator');
  if (comboEl) {
    comboEl.textContent = 'COMBO x' + state.comboMult.toFixed(1);
    comboEl.classList.add('show');
  }
  checkAchievements({ type:'combo', mult: state.comboMult });

  gainXP(Math.round(11 * (ZTYPES[z.type]?.scoreMul || 1) * state.comboMult));
  onKillLifesteal();
  spawnBloodSplat(z.x, z.y, 14);
  playSound(z.type === 'boss' ? 65 : 180, 0.09, 'triangle', 0.05);
  if (Math.random() < 0.35) dropPickup(z.x, z.y);
  state.waveZombiesRemaining = Math.max(0, state.waveZombiesRemaining - 1);

  checkAchievements({ type:'kill', zombieType: z.type, melee: !!opts.melee, headshot: !!opts.headshot, crit: !!opts.crit });
}

function fireProjectile(z, a, opts) {
  enemyProjectiles.push(Object.assign({
    x: z.x + Math.cos(a) * 12,
    y: z.y + Math.sin(a) * 12,
    vx: Math.cos(a) * (opts.speed || 260),
    vy: Math.sin(a) * (opts.speed || 260),
    life: opts.life || 2.8,
    dmg: opts.dmg || 10,
    r: opts.r || 4,
    type: opts.type || 'acid'
  }, opts.extra || {}));
}

export function updateZombies(dt) {
  for (const z of state.zombies) {
    if (z.hitFlash > 0) z.hitFlash -= dt;
    if (z.attackCd > 0) z.attackCd -= dt;
    const d = dist(z.x, z.y, state.player.x, state.player.y);
    z.angle = angleTo(z.x, z.y, state.player.x, state.player.y);
    z.x += (z.kx || 0) * dt;
    z.y += (z.ky || 0) * dt;
    z.kx = (z.kx || 0) * 0.84;
    z.ky = (z.ky || 0) * 0.84;
    z.x = clamp(z.x, z.r, WORLD_W - z.r);
    z.y = clamp(z.y, z.r, WORLD_H - z.r);

    // ---- SPITTER ----
    if (z.type === 'spitter' && state.player.alive) {
      z.spitCd -= dt;
      if (d > 120 && d < 380 && z.spitCd <= 0) {
        fireProjectile(z, z.angle, { speed:260, dmg:11, r:4, type:'acid', life:2.8 });
        z.spitCd = rand(1.6, 2.4);
        playSound(420, 0.08, 'sawtooth', 0.035);
      }
    }

    // ---- BOSS (com variantes) ----
    if (z.type === 'boss' && state.player.alive) {
      const variant = z.bossVariant || 'brawler';
      z.spitCd -= dt;

      if (variant === 'artillery') {
        // Dispara mais frequentemente e em leque mais largo, mas é mais lento a perseguir
        if (z.spitCd <= 0) {
          for (let n = 0; n < 7; n++) {
            const a = z.angle + (n - 3) * 0.18;
            fireProjectile(z, a, { speed:260, dmg:12, r:4, type:'acid', life:2.4 });
          }
          z.spitCd = rand(1.6, 2.3);
          playSound(180, 0.12, 'square', 0.05);
        }
      } else if (variant === 'summoner') {
        // Invoca swarmers periodicamente em vez de atirar tanto
        z.summonCd -= dt;
        if (z.summonCd <= 0) {
          for (let n = 0; n < 3; n++) {
            const sAng = Math.random() * Math.PI * 2;
            const sx = clamp(z.x + Math.cos(sAng) * 60, 20, WORLD_W - 20);
            const sy = clamp(z.y + Math.sin(sAng) * 60, 20, WORLD_H - 20);
            const def = ZTYPES.swarmer;
            state.zombies.push({
              x: sx, y: sy, type:'swarmer',
              hp: def.hp * state.difficultyMod.enemyHp, maxHp: def.hp * state.difficultyMod.enemyHp,
              speed: def.speed * state.difficultyMod.enemySpeed, dmg: def.dmg * state.difficultyMod.enemyDmg,
              r: def.r, color: def.color, angle:0, hitFlash:0.2, attackCd:0, wobble: Math.random()*10,
              spitCd: 99, kx:0, ky:0, screamCd:99, summonCd:99
            });
          }
          z.summonCd = rand(5.5, 7.5);
          playSound(140, 0.15, 'sawtooth', 0.06);
        }
        if (z.spitCd <= 0) {
          fireProjectile(z, z.angle, { speed:230, dmg:10, r:4, type:'acid', life:2.4 });
          z.spitCd = rand(2.4, 3.4);
        }
      } else {
        // brawler: mais agressivo em corpo a corpo, leque de tiro clássico
        if (z.spitCd <= 0) {
          for (let n = 0; n < 5; n++) {
            const a = z.angle + (n - 2) * 0.22;
            fireProjectile(z, a, { speed:240, dmg:12, r:4, type:'acid', life:2.4 });
          }
          z.spitCd = rand(2.1, 3.0);
          playSound(180, 0.12, 'square', 0.05);
        }
      }

      if (d < (variant === 'brawler' ? 84 : 70) && z.attackCd <= 0) {
        z.attackCd = variant === 'brawler' ? 1.4 : 1.8;
        explodeAt(z.x, z.y, variant === 'brawler' ? 135 : 120, variant === 'brawler' ? 46 : 40);
      }
    }

    // ---- EXPLODER ----
    if (z.type === 'exploder' && d < 34 && state.player.alive) {
      z.hp = 0;
      explodeAt(z.x, z.y, 95, 62);
      continue;
    }

    // ---- BOMBER (explode com raio maior, avisa antes) ----
    if (z.type === 'bomber' && state.player.alive) {
      if (d < 60) {
        z.attackCd -= dt;
        if (z.attackCd <= -1.1) {
          // após 1.1s de "beeping" perto do jogador, explode
          z.hp = 0;
          explodeAt(z.x, z.y, 120, 80);
          continue;
        } else if (z.attackCd <= 0 && z.attackCd > -1.1) {
          // pulso visual de aviso a cada ~0.2s (aproveita hitFlash)
          if (Math.floor(z.attackCd * 5) % 2 === 0) z.hitFlash = 0.1;
        }
      } else {
        z.attackCd = 0;
      }
    }

    // ---- SHOCKER ----
    if (z.type === 'shocker' && state.player.alive) {
      z.spitCd -= dt;
      if (d > 100 && d < 400 && z.spitCd <= 0) {
        fireProjectile(z, z.angle, { speed:320, dmg:12, r:5, type:'shock', life:2.5 });
        z.spitCd = rand(2.0, 3.2);
        playSound(880, 0.08, 'square', 0.04);
      }
    }

    // ---- HEALER ----
    if (z.type === 'healer' && z.hp > 0) {
      z.spitCd -= dt;
      if (z.spitCd <= 0 && state.zombies.length > 0) {
        for (const other of state.zombies) {
          if (other === z) continue;
          if (other.hp <= 0) continue;
          const distToOther = dist(z.x, z.y, other.x, other.y);
          if (distToOther < 150 && other.hp < other.maxHp) {
            const healAmount = Math.min(15, other.maxHp - other.hp);
            other.hp += healAmount;
            spawnFloatText(other.x, other.y - 16, '+' + healAmount + ' HP', '#8fae3c');
          }
        }
        z.spitCd = rand(3.0, 4.5);
        playSound(240, 0.1, 'triangle', 0.03);
      }
    }

    // ---- SCREAMER (invoca reforços à distância) ----
    if (z.type === 'screamer' && state.player.alive) {
      z.screamCd -= dt;
      if (d < 340 && z.screamCd <= 0) {
        z.screamCd = rand(6, 9);
        playSound(660, 0.28, 'sawtooth', 0.06);
        state.screenShake = Math.min(state.screenShake + 3, 10);
        spawnFloatText(z.x, z.y - 20, 'SCREECH!', '#c08a3c');
        for (let n = 0; n < 2; n++) {
          const t = Math.random() < 0.5 ? 'walker' : 'runner';
          const def = ZTYPES[t];
          const sAng = Math.random() * Math.PI * 2;
          const sx = clamp(z.x + Math.cos(sAng) * 70, 20, WORLD_W - 20);
          const sy = clamp(z.y + Math.sin(sAng) * 70, 20, WORLD_H - 20);
          state.zombies.push({
            x: sx, y: sy, type: t,
            hp: def.hp * state.difficultyMod.enemyHp, maxHp: def.hp * state.difficultyMod.enemyHp,
            speed: def.speed * state.difficultyMod.enemySpeed, dmg: def.dmg * state.difficultyMod.enemyDmg,
            r: def.r, color: def.color, angle:0, hitFlash:0.2, attackCd:0, wobble: Math.random()*10,
            spitCd: rand(1.2,2.3), kx:0, ky:0, screamCd:99, summonCd:99
          });
        }
      }
    }

    // Movimento e ataque
    if (d > 28) {
      z.x += Math.cos(z.angle) * z.speed * dt;
      z.y += Math.sin(z.angle) * z.speed * dt;
    } else if (state.player.alive && z.attackCd <= 0) {
      z.attackCd = 0.9;
      if (state.player.invuln <= 0) {
        applyIncomingDamage(z.dmg, z.x, z.y, z.type === 'boss' ? 1 : (z.type === 'juggernaut' ? 0.9 : 0.7));
        state.player.invuln = 0.5;
        state.screenShake = Math.min(state.screenShake + (z.type === 'juggernaut' ? 8 : 6), 10);
        playSound(95, 0.08, 'sawtooth', 0.05);
        spawnBloodSplat(state.player.x, state.player.y, 6);
      }
    }
  }
  // Remover mortos in-place (em vez de filter)
  for (let i = state.zombies.length - 1; i >= 0; i--) {
    if (state.zombies[i].hp <= 0) {
      state.zombies.splice(i, 1);
    }
  }
}
