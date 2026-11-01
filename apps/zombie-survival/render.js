import { PAL, WORLD_W, WORLD_H, TILE, HAT_PRESETS, BACKPACK_PRESETS, MASK_PRESETS } from './constants.js';
import { state } from './state.js';
import { bullets, grenades, enemyProjectiles, shockwaves } from './projectiles.js';
import { groundTiles, debris, obstacles, ambientParticles, currentMap, currentMapMechanics } from './world.js';
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
    if (o.type === 'tree') {
      ctx.fillStyle = '#49351f';
      ctx.fillRect(s.x - 6, s.y - 3, 12, 24);
      ctx.fillStyle = '#24371d';
      ctx.beginPath(); ctx.arc(s.x, s.y - 12, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#38502a';
      ctx.beginPath(); ctx.arc(s.x - 8, s.y - 18, 12, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === 'car') {
      ctx.fillStyle = '#34434a';
      ctx.fillRect(s.x - 25, s.y - 7, 50, 20);
      ctx.fillStyle = '#697a78';
      ctx.fillRect(s.x - 17, s.y - 15, 34, 13);
      ctx.fillStyle = '#a4c6c1';
      ctx.fillRect(s.x - 13, s.y - 12, 11, 8);
      ctx.fillRect(s.x + 3, s.y - 12, 10, 8);
      ctx.fillStyle = '#111416';
      ctx.beginPath(); ctx.arc(s.x - 16, s.y + 12, 6, 0, Math.PI * 2); ctx.arc(s.x + 16, s.y + 12, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d6a64b';
      ctx.fillRect(s.x + 22, s.y - 2, 4, 4);
      ctx.fillStyle = '#a84a34';
      ctx.fillRect(s.x - 22, s.y + 7, 5, 3);
    } else if (o.type === 'crypt') {
      ctx.fillStyle = '#525750';
      ctx.fillRect(s.x - 24, s.y - 9, 48, 25);
      ctx.fillStyle = '#72776e';
      ctx.beginPath(); ctx.moveTo(s.x - 27, s.y - 9); ctx.lineTo(s.x - 19, s.y - 21); ctx.lineTo(s.x + 19, s.y - 21); ctx.lineTo(s.x + 27, s.y - 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#252b27';
      ctx.fillRect(s.x - 7, s.y - 2, 14, 18);
      ctx.fillStyle = '#989b8d';
      ctx.fillRect(s.x - 1, s.y - 17, 2, 9); ctx.fillRect(s.x - 4, s.y - 14, 8, 2);
    } else if (o.type === 'deadTree') {
      ctx.strokeStyle = '#56402b'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y + 18); ctx.lineTo(s.x, s.y - 18); ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x - 13, s.y - 17); ctx.moveTo(s.x, s.y - 1); ctx.lineTo(s.x + 14, s.y - 14); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(s.x - 13, s.y - 17); ctx.lineTo(s.x - 17, s.y - 23); ctx.moveTo(s.x + 14, s.y - 14); ctx.lineTo(s.x + 18, s.y - 21); ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (o.type === 'toxicDrum') {
      ctx.fillStyle = '#68713a'; ctx.fillRect(s.x - 12, s.y - 14, 24, 28);
      ctx.fillStyle = '#a6b54d'; ctx.beginPath(); ctx.ellipse(s.x, s.y - 14, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#333b25'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(s.x - 12, s.y - 5); ctx.lineTo(s.x + 12, s.y - 5); ctx.moveTo(s.x - 12, s.y + 5); ctx.lineTo(s.x + 12, s.y + 5); ctx.stroke();
      ctx.fillStyle = '#d7d879'; ctx.fillRect(s.x - 8, s.y - 1, 16, 5);
      ctx.fillStyle = '#333b25'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', s.x, s.y + 4); ctx.textAlign = 'left';
    } else if (o.type === 'ruinedTank') {
      ctx.fillStyle = '#39433a'; ctx.fillRect(s.x - 25, s.y - 10, 50, 22);
      ctx.fillStyle = '#202822'; ctx.fillRect(s.x - 29, s.y + 8, 58, 8);
      ctx.fillStyle = '#52604a'; ctx.fillRect(s.x - 11, s.y - 17, 23, 12);
      ctx.fillStyle = '#66715a'; ctx.fillRect(s.x + 8, s.y - 14, 24, 5);
      ctx.fillStyle = '#9b6438'; ctx.beginPath(); ctx.arc(s.x - 18, s.y - 7, 5, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === 'cactus') {
      ctx.strokeStyle = '#42633b'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y + 17); ctx.lineTo(s.x, s.y - 17); ctx.moveTo(s.x, s.y + 1); ctx.lineTo(s.x - 9, s.y + 1); ctx.lineTo(s.x - 9, s.y - 8); ctx.moveTo(s.x, s.y + 7); ctx.lineTo(s.x + 9, s.y + 7); ctx.lineTo(s.x + 9, s.y - 3); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#a8bd83'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x - 3, s.y - 10); ctx.lineTo(s.x + 3, s.y - 7); ctx.moveTo(s.x - 3, s.y + 5); ctx.lineTo(s.x + 3, s.y + 8); ctx.stroke();
    } else if (o.type === 'rockPillar') {
      ctx.fillStyle = '#76684d'; ctx.beginPath(); ctx.moveTo(s.x - 16, s.y + 18); ctx.lineTo(s.x - 13, s.y - 10); ctx.lineTo(s.x - 4, s.y - 20); ctx.lineTo(s.x + 12, s.y - 16); ctx.lineTo(s.x + 17, s.y + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#988465'; ctx.beginPath(); ctx.moveTo(s.x - 4, s.y - 20); ctx.lineTo(s.x + 12, s.y - 16); ctx.lineTo(s.x + 5, s.y + 14); ctx.lineTo(s.x - 4, s.y + 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#514735'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x - 11, s.y - 4); ctx.lineTo(s.x - 2, s.y + 3); ctx.lineTo(s.x - 5, s.y + 12); ctx.stroke();
    } else if (o.type === 'subwayCar') {
      ctx.fillStyle = '#47585a'; ctx.fillRect(s.x - 39, s.y - 17, 78, 34);
      ctx.fillStyle = '#20292b'; ctx.fillRect(s.x - 33, s.y - 12, 66, 15);
      ctx.fillStyle = '#79a7a5';
      for (let windowX = -28; windowX <= 22; windowX += 17) ctx.fillRect(s.x + windowX, s.y - 9, 11, 9);
      ctx.fillStyle = '#9b4d38'; ctx.fillRect(s.x - 4, s.y - 12, 9, 28);
      ctx.fillStyle = '#252b2b'; ctx.fillRect(s.x - 32, s.y + 14, 64, 5);
      ctx.fillStyle = '#d3b45e'; ctx.fillRect(s.x - 35, s.y + 7, 5, 3); ctx.fillRect(s.x + 30, s.y + 7, 5, 3);
    } else if (o.type === 'signalBox') {
      ctx.fillStyle = '#465456'; ctx.fillRect(s.x - 14, s.y - 17, 28, 34);
      ctx.fillStyle = '#20292a'; ctx.fillRect(s.x - 9, s.y - 12, 18, 20);
      ctx.fillStyle = '#ba4d3d'; ctx.beginPath(); ctx.arc(s.x, s.y - 7, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b456'; ctx.beginPath(); ctx.arc(s.x, s.y + 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#828f8a'; ctx.fillRect(s.x - 18, s.y + 17, 36, 4);
    } else if (o.type === 'furnace') {
      ctx.fillStyle = '#4d4036'; ctx.fillRect(s.x - 22, s.y - 24, 44, 46);
      ctx.fillStyle = '#796553'; ctx.fillRect(s.x - 17, s.y - 19, 34, 7);
      ctx.fillStyle = '#211b17'; ctx.fillRect(s.x - 12, s.y - 8, 24, 24);
      ctx.fillStyle = '#e27734'; ctx.fillRect(s.x - 8, s.y - 3, 16, 15);
      ctx.fillStyle = '#ffd36e'; ctx.fillRect(s.x - 3, s.y + 2, 6, 8);
      ctx.fillStyle = '#292522'; ctx.fillRect(s.x - 16, s.y + 18, 32, 5);
    } else if (o.type === 'pipeStack') {
      for (let pipe = 0; pipe < 3; pipe++) {
        const py = s.y - 9 + pipe * 9;
        ctx.fillStyle = pipe === 1 ? '#56656a' : '#69777a';
        ctx.fillRect(s.x - 26, py - 4, 52, 8);
        ctx.fillStyle = '#313b3e'; ctx.beginPath(); ctx.ellipse(s.x - 25, py, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#293235'; ctx.lineWidth = 1; ctx.strokeRect(s.x - 26, py - 4, 52, 8);
      }
    } else if (o.type === 'crate') {
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
      // LÃƒÆ’Ã‚Â¡pide: base retangular com topo arredondado
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
    } else if (o.type === 'barrel') {
      ctx.fillStyle = PAL.crateMetal;
      ctx.fillRect(s.x - o.w / 2 + 2, s.y - o.h / 2, o.w - 4, o.h);
      ctx.fillStyle = '#a84a34'; ctx.beginPath(); ctx.ellipse(s.x, s.y - o.h / 2, o.w / 2 - 2, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a1810'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y + o.h / 2, o.w / 2 - 2, 5, 0, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x - o.w / 2 + 2, s.y - 5); ctx.lineTo(s.x + o.w / 2 - 2, s.y - 5); ctx.moveTo(s.x - o.w / 2 + 2, s.y + 5); ctx.lineTo(s.x + o.w / 2 - 2, s.y + 5); ctx.stroke();
    } else {
      ctx.fillStyle = '#5a5a52';
      ctx.fillRect(s.x - o.w / 2, s.y - o.h / 2, o.w, o.h);
      ctx.strokeStyle = '#343a35'; ctx.lineWidth = 2; ctx.strokeRect(s.x - o.w / 2, s.y - o.h / 2, o.w, o.h);
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
  // Tank: linhas de "couraÃƒÆ’Ã‚Â§a"
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

  // Mochila ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â desenhada atrÃƒÆ’Ã‚Â¡s do corpo, do lado oposto ÃƒÆ’Ã‚Â  direÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do olhar
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

  // MÃƒÆ’Ã‚Â¡scara ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sobre a cara, virada para a direÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do olhar
  if (playerLook.mask && playerLook.mask !== 'none') {
    ctx.fillStyle = (MASK_PRESETS[playerLook.mask] || {}).color || '#1a1a1a';
    ctx.fillRect(state.player.r * 0.15, -state.player.r * 0.3, state.player.r * 0.55, state.player.r * 0.6);
  }

  // ChapÃƒÆ’Ã‚Â©u ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â sobre a cabeÃƒÆ’Ã‚Â§a
  if (playerLook.hat && playerLook.hat !== 'none') {
    ctx.fillStyle = (HAT_PRESETS[playerLook.hat] || {}).color || '#3a4a26';
    ctx.beginPath();
    ctx.arc(state.player.r * 0.3, 0, state.player.r * 0.6, Math.PI * 1.15, Math.PI * 1.85);
    ctx.fill();
  }

  ctx.restore();

  // Escudo temporÃƒÆ’Ã‚Â¡rio (pickup) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â anel roxo pulsante mais notÃƒÆ’Ã‚Â³rio que o invuln genÃƒÆ’Ã‚Â©rico
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

  // Halo sutil quando "Undying" estÃƒÆ’Ã‚Â¡ pronto (feedback de perk ÃƒÆ’Ã‚Â©pico)
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
    // Trilho: pequena linha na direÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o oposta ÃƒÆ’Ã‚Â  velocidade
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

export function drawLightningBeams() {
  for (const beam of state.lightningBeams) {
    const start = worldToScreen(beam.x1, beam.y1);
    const end = worldToScreen(beam.x2, beam.y2);
    const alpha = clamp(beam.life / beam.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#63f3ff';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#63f3ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = '#e8ffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

function drawMinion(minion) {
  const point = worldToScreen(minion.x, minion.y);
  const alpha = clamp(minion.life / minion.maxLife, 0.35, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = '#63f3ff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#31bfc9';
  ctx.beginPath();
  ctx.arc(point.x, point.y, minion.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8ffff';
  ctx.beginPath();
  ctx.arc(point.x + 2, point.y - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
      // RelÃƒÆ’Ã‚Â¢mpago ocasional
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
  const mech = currentMapMechanics();
  const map = currentMap();
  const vis = Math.min(1.2, Math.max(0.5, mech.visibility || 1));
  const color = (map && map.vignetteColor) ? map.vignetteColor : 'rgba(0,0,0,0.55)';
  const grad = ctx.createRadialGradient(W / 2, H / 2, 80 * vis, W / 2, H / 2, W * (0.62 / vis));
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, color);
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

export function drawInteractables() {
  try {
    const mech = currentMapMechanics();
    const list = mech.interactives || [];
    for (const it of list) {
      if (it.used) continue;
      const s = worldToScreen(it.x, it.y);
      if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) continue;
      const isCache = it.type === 'cache';
      const isAltar = it.type === 'altar';
      const label = isCache ? 'C' : (isAltar ? 'A' : 'D');
      ctx.fillStyle = isCache ? 'rgba(216,207,168,0.95)' : (isAltar ? 'rgba(143,174,60,0.95)' : 'rgba(192,73,46,0.95)');
      ctx.font = '12px Courier New';
      ctx.fillText(label, s.x - 5, s.y + 4);
      ctx.beginPath();
      ctx.arc(s.x, s.y, isCache ? 9 : 11, 0, Math.PI * 2);
      ctx.strokeStyle = isCache ? 'rgba(216,207,168,0.7)' : (isAltar ? 'rgba(143,174,60,0.7)' : 'rgba(192,73,46,0.7)');
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } catch (e) {}
}

export function drawHazards() {
  try {
    const mech = currentMapMechanics();
    for (const h of (mech.hazards || [])) {
      if (h.x != null) {
        const ss = worldToScreen(h.x, h.y);
        const color = h.type === 'poison' ? 'rgba(118,222,126,0.35)' : (h.type === 'damage' ? 'rgba(228,89,89,0.35)' : 'rgba(143,174,60,0.25)');
        ctx.strokeStyle = color;
        ctx.fillStyle = color.replace(/0\.\d+\)/, '0.12)');
        ctx.beginPath();
        ctx.arc(ss.x, ss.y, h.r || 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  } catch(e) {}
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

export function drawObjectiveZone() {
  if (!state || !state.objective || !state.objective.active) return;
  const o = state.objective;
  if (o.type === 'protect' && o.target) {
    const s = worldToScreen(o.target.x, o.target.y);
    ctx.strokeStyle = 'rgba(143,174,60,0.65)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, o.target.r || 130, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(143,174,60,0.18)';
    ctx.fill();
    ctx.fillStyle = '#d8cfa8';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('PROTECT', s.x, s.y - 140);
    ctx.textAlign = 'left';
  } else if (o.type === 'eliminate' && state.objective.targetId) {
    const z = state.zombies.find(z => z.id === state.objective.targetId && z.hp > 0);
    if (z) {
      const s = worldToScreen(z.x, z.y);
      ctx.strokeStyle = 'rgba(192,73,46,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, z.r + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c0492e';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('ELITE', s.x, s.y - z.r - 12);
      ctx.textAlign = 'left';
    }
  }
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
  drawHazards();
  drawAmbient();
  drawInteractables();
  drawObjectiveZone();

  // Usar state.zombies em vez de importar zombies diretamente
  const drawables = state.zombies.map(z => ({ y: z.y, draw: () => drawZombie(z) }));
  drawables.push(...state.minions.map(minion => ({ y: minion.y, draw: () => drawMinion(minion) })));
  drawables.push({ y: state.player.y, draw: drawPlayer });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  drawBullets();
  drawLightningBeams();
  drawGrenades();
  drawEnemyProjectiles();
  drawShockwaves();
  drawMeleeArc();
  drawLaser();
  drawPickups(t);
  drawParticles();
  drawFloatTexts();
  drawWeatherFx(t);
  drawDayNightTint();
  drawDarknessVignette();
  ctx.restore();
  drawMinimap();
}
