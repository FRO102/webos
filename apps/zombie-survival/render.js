import { PAL, WORLD_W, WORLD_H, TILE, HAT_PRESETS, BACKPACK_PRESETS, MASK_PRESETS } from './constants.js';
import { state } from './state.js';
import { bullets, grenades, enemyProjectiles, shockwaves } from './projectiles.js';
import { groundTiles, debris, obstacles, ambientParticles, currentMap } from './world.js';
import { pickups, particles, floatTexts, bloodPools } from './pickups.js';
import { playerLook } from './character.js';
import { rand, clamp } from './utils.js';

let canvas, ctx, W, H, camX, camY, screenShake;
let minimapCanvas, minimapCtx;

export function initRenderer(canvasEl, ctx2d, width, height) {
  canvas = canvasEl;
  ctx = ctx2d;
  W = width; H = height;
  minimapCanvas = document.getElementById('minimap');
  minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
}

export function setCamera(cx, cy) { camX = cx; camY = cy; }
export function setShake(shake) { screenShake = shake; }

function worldToScreen(x, y) { return { x: x - camX, y: y - camY }; }

export function drawGround() {
  const map = currentMap();
  ctx.fillStyle = map.ground.g1;
  ctx.fillRect(0, 0, W, H);
  const startX = Math.floor(camX / TILE) * TILE;
  const startY = Math.floor(camY / TILE) * TILE;
  for (let y = startY; y < camY + H + TILE; y += TILE) {
    for (let x = startX; x < camX + W + TILE; x += TILE) {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const f = h - Math.floor(h);
      let c = map.ground.g1;
      if (f < 0.15) c = map.ground.g2;
      else if (f < 0.25) c = map.ground.g3;
      ctx.fillStyle = c;
      const sx = x - camX, sy = y - camY;
      ctx.fillRect(sx, sy, TILE, TILE);
      if (f < 0.06) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(sx + 6, sy + 6, TILE - 12, TILE - 12);
      }
    }
  }
}

export function drawBloodPools() {
  for (const b of bloodPools) {
    const s = worldToScreen(b.x, b.y);
    if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) continue;
    ctx.fillStyle = `rgba(60,13,16,${b.a})`;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, b.r, b.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawDebris() {
  for (const d of debris) {
    const s = worldToScreen(d.x, d.y);
    if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) continue;
    if (d.type === 'rock') {
      ctx.fillStyle = '#3a3a30';
      ctx.fillRect(s.x - d.size / 2, s.y - d.size / 2, d.size, d.size * 0.7);
      ctx.fillStyle = '#4a4a3c';
      ctx.fillRect(s.x - d.size / 2, s.y - d.size / 2, d.size, 2);
    } else {
      ctx.fillStyle = '#2a3a1c';
      ctx.beginPath();
      ctx.arc(s.x, s.y, d.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#354720';
      ctx.beginPath();
      ctx.arc(s.x - 2, s.y - 2, d.size / 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawObstacles() {
  for (const o of obstacles) {
    if (o.hp <= 0) continue;
    const s = worldToScreen(o.x, o.y);
    if (s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(s.x - o.w / 2 + 3, s.y - o.h / 2 + 5, o.w, o.h);
    if (o.type === 'crate') {
      ctx.fillStyle = PAL.crateWood;
      ctx.fillRect(s.x - o.w / 2, s.y - o.h / 2, o.w, o.h);
      ctx.strokeStyle = '#4a3320';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - o.w / 2, s.y - o.h / 2, o.w, o.h);
      ctx.beginPath();
      ctx.moveTo(s.x - o.w / 2, s.y - o.h / 2);
      ctx.lineTo(s.x + o.w / 2, s.y + o.h / 2);
      ctx.moveTo(s.x + o.w / 2, s.y - o.h / 2);
      ctx.lineTo(s.x - o.w / 2, s.y + o.h / 2);
      ctx.stroke();
    } else if (o.type === 'grave') {
      // Lápide: base retangular com topo arredondado
      ctx.fillStyle = '#5a5a52';
      ctx.beginPath();
      ctx.moveTo(s.x - o.w / 2, s.y + o.h / 2);
      ctx.lineTo(s.x - o.w / 2, s.y - o.h * 0.15);
      ctx.quadraticCurveTo(s.x - o.w / 2, s.y - o.h / 2, s.x, s.y - o.h / 2);
      ctx.quadraticCurveTo(s.x + o.w / 2, s.y - o.h / 2, s.x + o.w / 2, s.y - o.h * 0.15);
      ctx.lineTo(s.x + o.w / 2, s.y + o.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3a3a34';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - o.h * 0.25);
      ctx.lineTo(s.x, s.y + o.h * 0.3);
      ctx.stroke();
    } else {
      ctx.fillStyle = PAL.crateMetal;
      ctx.fillRect(s.x - o.w / 2, s.y - o.h / 2, o.w, o.h);
      ctx.strokeStyle = '#4a1810';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x - o.w / 2, s.y - o.h / 2, o.w, o.h);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(s.x - o.w / 2 + 3, s.y - o.h / 2 + 3, o.w - 6, 3);
    }
  }
}

export function drawPickups(t) {
  for (const p of pickups) {
    const s = worldToScreen(p.x, p.y);
    const bob = Math.sin(t / 300 + p.bob) * 3;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    if (p.type === 'health') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 10, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a5152a';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#e8e0c0';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else if (p.type === 'armor') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 10, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f6d86';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#7ac8e6';
      ctx.fillRect(-5, -5, 10, 10);
    } else if (p.type === 'medkit') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 10, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5c4a2a';
      ctx.fillRect(-8, -7, 16, 14);
      ctx.fillStyle = '#d8cfa8';
      ctx.fillRect(-2, -4, 4, 8);
      ctx.fillRect(-4, -2, 8, 4);
    } else if (p.type === 'heavyAmmo') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 10, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(-9, -8, 18, 16);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(-6, -5, 4, 10);
      ctx.fillRect(1, -5, 4, 10);
    } else if (p.type === 'shield') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 10, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(192,132,252,0.35)';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 10, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5c4a2a';
      ctx.fillRect(-7, -6, 14, 12);
      ctx.fillStyle = '#ffd76b';
      ctx.fillRect(-5, -3, 10, 3);
    }
    ctx.restore();
  }
}

export function drawZombie(z) {
  const s = worldToScreen(z.x, z.y);
  if (s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) return;
  ctx.save();
  ctx.translate(s.x, s.y);

  const isGhost = z.type === 'ghost';
  if (isGhost) ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 150) * 0.15;

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, z.r * 0.7, z.r * 0.9, z.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(z.angle);
  const flash = z.hitFlash > 0;
  const bodyColor = flash ? '#ffffff' : z.color;
  const dkColor = flash ? '#cccccc' : PAL.zombieSkinDk;

  // Crawler: corpo achatado e mais baixo
  const squash = z.type === 'crawler' ? 0.55 : 0.85;

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, z.r, z.r * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? '#eee' : PAL.zombieShirt;
  ctx.fillRect(-z.r * 0.5, -z.r * 0.5, z.r * 1.0, z.r * 0.6);
  ctx.fillStyle = dkColor;
  ctx.fillRect(z.r * 0.2, -z.r * 0.9, z.r * 0.9, z.r * 0.35);
  ctx.fillRect(z.r * 0.2, z.r * 0.55, z.r * 0.9, z.r * 0.35);
  ctx.fillStyle = '#d94b2e';
  ctx.beginPath(); ctx.arc(z.r * 0.4, -z.r * 0.25, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(z.r * 0.4, z.r * 0.25, 1.6, 0, Math.PI * 2); ctx.fill();

  // Juggernaut: placas de blindagem extra
  if (z.type === 'juggernaut') {
    ctx.strokeStyle = '#8a8a90';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, z.r * 0.7, -0.7, 0.7); ctx.stroke();
  }
  // Tank: linhas de "couraça"
  if (z.type === 'tank') {
    ctx.strokeStyle = '#3a2f26';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-z.r*0.4, -z.r*0.5); ctx.lineTo(z.r*0.4, -z.r*0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-z.r*0.4, z.r*0.5); ctx.lineTo(z.r*0.4, z.r*0.5); ctx.stroke();
  }
  // Bomber: aviso pulsante quando prestes a explodir
  if (z.type === 'bomber' && z.attackCd < 0) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 60);
    ctx.strokeStyle = `rgba(255,120,40,${pulse.toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, z.r + 4, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  if (z.maxHp > 45) {
    const pct = z.hp / z.maxHp;
    ctx.fillStyle = '#000';
    ctx.fillRect(s.x - 14, s.y - z.r - 10, 28, 4);
    ctx.fillStyle = pct > 0.5 ? '#8fae3c' : '#c0492e';
    ctx.fillRect(s.x - 14, s.y - z.r - 10, 28 * pct, 4);
  }
}

export function drawPlayer() {
  const s = worldToScreen(state.player.x, state.player.y);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0, state.player.r * 0.7, state.player.r * 0.9, state.player.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  const flicker = state.player.invuln > 0 && Math.floor(performance.now() / 60) % 2 === 0;
  ctx.rotate(state.player.angle);

  // Mochila — desenhada atrás do corpo, do lado oposto à direção do olhar
  if (playerLook.backpack && playerLook.backpack !== 'none') {
    ctx.fillStyle = (BACKPACK_PRESETS[playerLook.backpack] || {}).color || '#4a3a26';
    ctx.fillRect(-state.player.r * 0.9, -state.player.r * 0.55, state.player.r * 0.55, state.player.r * 1.1);
  }

  ctx.fillStyle = '#2a2a24';
  ctx.fillRect(state.player.r - 2, -3, 18, 6);
  ctx.fillStyle = flicker ? '#ff8080' : playerLook.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, state.player.r, state.player.r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = playerLook.bodyDk;
  ctx.beginPath();
  ctx.ellipse(0, state.player.r * 0.3, state.player.r * 0.85, state.player.r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = playerLook.skinColor;
  ctx.beginPath();
  ctx.arc(state.player.r * 0.3, 0, state.player.r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Máscara — sobre a cara, virada para a direção do olhar
  if (playerLook.mask && playerLook.mask !== 'none') {
    ctx.fillStyle = (MASK_PRESETS[playerLook.mask] || {}).color || '#1a1a1a';
    ctx.fillRect(state.player.r * 0.15, -state.player.r * 0.3, state.player.r * 0.55, state.player.r * 0.6);
  }

  // Chapéu — sobre a cabeça
  if (playerLook.hat && playerLook.hat !== 'none') {
    ctx.fillStyle = (HAT_PRESETS[playerLook.hat] || {}).color || '#3a4a26';
    ctx.beginPath();
    ctx.arc(state.player.r * 0.3, 0, state.player.r * 0.6, Math.PI * 1.15, Math.PI * 1.85);
    ctx.fill();
  }

  ctx.restore();

  // Escudo temporário (pickup) — anel roxo pulsante mais notório que o invuln genérico
  if (state.shieldTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 120);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, state.player.r + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Halo sutil quando "Undying" está pronto (feedback de perk épico)
  if (state.player.hasUndying && state.player.undyingReady) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(performance.now() / 300);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, state.player.r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawBullets() {
  for (const b of bullets) {
    const s = worldToScreen(b.x, b.y);
    // Trilho: pequena linha na direção oposta à velocidade
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const trailLen = clamp(speed * 0.014, 4, 16);
    const tx = s.x - (b.vx / speed) * trailLen;
    const ty = s.y - (b.vy / speed) * trailLen;
    const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
    grad.addColorStop(0, 'rgba(255,232,163,0.9)');
    grad.addColorStop(1, 'rgba(255,232,163,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = PAL.bullet;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGrenades() {
  for (const g of grenades) {
    const s = worldToScreen(g.x, g.y);
    ctx.fillStyle = g.weaponName === 'Rocket' ? '#4a4a4a' : '#6b4b2d';
    ctx.beginPath();
    ctx.arc(s.x, s.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0492e';
    ctx.fillRect(s.x - 2, s.y - g.r - 3, 4, 4);
  }
}

export function drawEnemyProjectiles() {
  for (const p of enemyProjectiles) {
    const s = worldToScreen(p.x, p.y);
    if (p.type === 'acid') ctx.fillStyle = '#9cd24a';
    else if (p.type === 'shock') ctx.fillStyle = '#7ac8e6';
    else ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawAmbient() {
  for (const a of ambientParticles) {
    const s = worldToScreen(a.x, a.y);
    if (s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) continue;
    if (a.ember) {
      ctx.fillStyle = 'rgba(255,180,71,0.6)';
      ctx.fillRect(s.x, s.y, a.s, a.s);
    } else {
      ctx.fillStyle = 'rgba(140,160,120,0.08)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, a.s, a.s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawDayNightTint() {
  const map = currentMap();
  const phase = (state.dayNightClock % 80) / 80;
  const night = 0.5 + 0.5 * Math.sin((phase * Math.PI * 2) - Math.PI / 2);
  const weatherBoost = state.weatherType === 'fog' ? 0.08 : state.weatherType === 'rain' ? 0.03 : state.weatherType === 'storm' ? 0.14 : 0;
  const a = 0.12 + night * 0.26 + weatherBoost * state.weatherStrength + (map.fogBase || 0);
  ctx.fillStyle = `rgba(18,28,46,${a.toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}

export function drawWeatherFx(t) {
  if (state.weatherType === 'rain' || state.weatherType === 'storm') {
    const intensity = state.weatherType === 'storm' ? state.weatherStrength * 0.4 : state.weatherStrength * 0.25;
    ctx.strokeStyle = `rgba(122,200,230,${(0.15 + intensity).toFixed(3)})`;
    ctx.lineWidth = state.weatherType === 'storm' ? 1.4 : 1;
    const count = state.weatherType === 'storm' ? 85 : 55;
    for (let i = 0; i < count; i++) {
      const x = (i * 39 + (t * 0.45)) % (W + 40) - 20;
      const y = (i * 22 + (t * 0.9)) % (H + 40) - 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7, y + 14);
      ctx.stroke();
    }
    if (state.weatherType === 'storm') {
      // Relâmpago ocasional
      const flashChance = Math.sin(t / 1300) > 0.985;
      if (flashChance) {
        ctx.fillStyle = 'rgba(220,230,255,0.12)';
        ctx.fillRect(0, 0, W, H);
      }
    }
  } else if (state.weatherType === 'fog') {
    ctx.fillStyle = `rgba(185,198,180,${(0.03 + state.weatherStrength * 0.08).toFixed(3)})`;
    for (let i = 0; i < 7; i++) {
      const x = ((i * 150) + (t * 0.02)) % (W + 200) - 100;
      const y = 70 + i * 70;
      ctx.beginPath();
      ctx.ellipse(x, y, 120, 32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawShockwaves() {
  for (const s of shockwaves) {
    const p = worldToScreen(s.x, s.y);
    const alpha = clamp(s.life / s.maxLife, 0, 1);
    ctx.save();
    ctx.strokeStyle = `rgba(255,178,71,${(alpha * 0.7).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.35).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawParticles() {
  for (const p of particles) {
    const s = worldToScreen(p.x, p.y);
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(s.x - p.size / 2, s.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function drawFloatTexts() {
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'center';
  for (const f of floatTexts) {
    const s = worldToScreen(f.x, f.y);
    ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
}

export function drawMeleeArc() {
  if (state.meleeSwingTimer <= 0) return;
  const s = worldToScreen(state.player.x, state.player.y);
  const alpha = clamp(state.meleeSwingTimer / 0.13, 0, 1);
  ctx.save();
  ctx.strokeStyle = `rgba(216,207,168,${alpha.toFixed(3)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(s.x, s.y, state.player.meleeRange, state.player.angle - state.player.meleeArc * 0.5, state.player.angle + state.player.meleeArc * 0.5);
  ctx.stroke();
  ctx.restore();
}

export function drawLaser() {
  if (!state.player.alive) return;
  const s = worldToScreen(state.player.x, state.player.y);
  const len = 600;
  const startX = s.x + Math.cos(state.player.angle) * 16;
  const startY = s.y + Math.sin(state.player.angle) * 16;
  const endX = s.x + Math.cos(state.player.angle) * len;
  const endY = s.y + Math.sin(state.player.angle) * len;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,60,60,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}

export function drawDarknessVignette() {
  const grad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.62);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

export function drawWorldBounds() {
  const map = currentMap();
  ctx.fillStyle = map.bounds;
  const s0 = worldToScreen(0, 0);
  const s1 = worldToScreen(WORLD_W, WORLD_H);
  ctx.fillRect(s0.x - 40, s0.y - 40, WORLD_W + 80, 40);
  ctx.fillRect(s0.x - 40, s1.y, WORLD_W + 80, 40);
  ctx.fillRect(s0.x - 40, s0.y - 40, 40, WORLD_H + 80);
  ctx.fillRect(s1.x, s0.y - 40, 40, WORLD_H + 80);
}

export function drawMinimap() {
  if (!minimapCtx || !minimapCanvas) return;
  const mw = minimapCanvas.width, mh = minimapCanvas.height;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;

  minimapCtx.clearRect(0, 0, mw, mh);
  minimapCtx.fillStyle = '#0b0d08';
  minimapCtx.fillRect(0, 0, mw, mh);

  minimapCtx.fillStyle = '#5c5238';
  for (const o of obstacles) {
    if (o.hp <= 0) continue;
    minimapCtx.fillRect(o.x * sx - 1, o.y * sy - 1, 2, 2);
  }

  minimapCtx.fillStyle = '#ffd76b';
  for (const p of pickups) {
    minimapCtx.fillRect(p.x * sx - 1, p.y * sy - 1, 2, 2);
  }

  for (const z of state.zombies) {
    minimapCtx.fillStyle = z.type === 'boss' ? '#ff3b30' : (z.type === 'juggernaut' || z.type === 'tank' ? '#c0492e' : PAL.zombieSkin);
    const r = (z.type === 'boss') ? 2.6 : (z.type === 'juggernaut' || z.type === 'tank') ? 2.0 : 1.4;
    minimapCtx.beginPath();
    minimapCtx.arc(z.x * sx, z.y * sy, r, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  minimapCtx.strokeStyle = 'rgba(216,207,168,0.5)';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(camX * sx, camY * sy, W * sx, H * sy);

  const px = state.player.x * sx, py = state.player.y * sy;
  minimapCtx.fillStyle = '#8fae3c';
  minimapCtx.beginPath();
  minimapCtx.arc(px, py, 3, 0, Math.PI * 2);
  minimapCtx.fill();
  minimapCtx.strokeStyle = '#d8cfa8';
  minimapCtx.lineWidth = 1.5;
  minimapCtx.beginPath();
  minimapCtx.moveTo(px, py);
  minimapCtx.lineTo(px + Math.cos(state.player.angle) * 7, py + Math.sin(state.player.angle) * 7);
  minimapCtx.stroke();
}

export function render(t) {
  ctx.save();
  if (screenShake > 0.1) {
    ctx.translate(rand(-screenShake, screenShake), rand(-screenShake, screenShake));
  }
  drawGround();
  drawWorldBounds();
  drawBloodPools();
  drawDebris();
  drawObstacles();
  drawPickups(t);
  drawAmbient();

  // Usar state.zombies em vez de importar zombies diretamente
  const drawables = state.zombies.map(z => ({ y: z.y, draw: () => drawZombie(z) }));
  drawables.push({ y: state.player.y, draw: drawPlayer });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  drawBullets();
  drawGrenades();
  drawEnemyProjectiles();
  drawShockwaves();
  drawMeleeArc();
  drawLaser();
  drawParticles();
  drawFloatTexts();
  drawWeatherFx(t);
  drawDayNightTint();
  drawDarknessVignette();
  ctx.restore();
  drawMinimap();
}
