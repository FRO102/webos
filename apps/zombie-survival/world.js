import { PAL, WORLD_W, WORLD_H, TILE, WEATHER_TYPES, MAPS } from './constants.js';
import { rand, randInt, clamp } from './utils.js';
import { state } from './state.js';

export let groundTiles = [];
export let debris = [];
export let obstacles = [];
export let ambientParticles = [];
export let dayNightClock = 0;

export function currentMap() {
  return MAPS[state.selectedMap] || MAPS.forest;
}

export function buildGround() {
  const map = currentMap();
  groundTiles = [];
  for(let y=0; y<WORLD_H; y+=TILE) {
    for(let x=0; x<WORLD_W; x+=TILE) {
      const r = Math.random();
      let c = map.ground.g1;
      if(r<0.15) c = map.ground.g2;
      else if(r<0.22) c = map.ground.g3;
      groundTiles.push({x,y,c});
    }
  }
}

function weightedPick(mix) {
  const entries = Object.entries(mix);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[0][0];
}

export function buildDebris() {
  const map = currentMap();
  debris = [];
  for(let i=0; i<70; i++) {
    debris.push({
      x: rand(0,WORLD_W), y: rand(0,WORLD_H),
      type: weightedPick(map.debrisMix),
      size: rand(6,14)
    });
  }
}

export function buildObstacles() {
  const map = currentMap();
  obstacles = [];
  for(let i=0; i<26; i++) {
    const type = weightedPick(map.obstacleMix);
    obstacles.push({
      x: rand(80,WORLD_W-80), y: rand(80,WORLD_H-80),
      w: type === 'grave' ? 22 : 28,
      h: type === 'grave' ? 30 : 28,
      type, hp:40
    });
  }
}

export function spawnAmbientParticle(nearX, nearY) {
  const map = currentMap();
  const ember = Math.random() < (map.fogBase > 0.04 ? 0.15 : 0.38);
  ambientParticles.push({
    x: nearX + rand(-window.innerWidth * 0.7, window.innerWidth * 0.7),
    y: nearY + rand(-window.innerHeight * 0.7, window.innerHeight * 0.7),
    vx: ember ? rand(-4,4) : rand(-9,9),
    vy: ember ? rand(-20,-8) : rand(-2,2),
    s: ember ? rand(1.2,2.3) : rand(10,24),
    ember,
    life: rand(8,20)
  });
}

export function initAmbient() {
  ambientParticles = [];
  for(let i=0; i<70; i++) spawnAmbientParticle(WORLD_W/2, WORLD_H/2);
}

// NOTA: o estado de meteorologia vive em state.weatherType/weatherTimer/weatherStrength
// (antes havia uma cópia local neste módulo que nunca era lida pelo resto do jogo,
// pelo que a mudança de tempo nunca aparecia de facto no jogo — corrigido numa ronda anterior).
export function updateWeather(dt) {
  state.weatherTimer -= dt;
  if (state.weatherTimer > 0) return;
  state.weatherType = WEATHER_TYPES[randInt(0, WEATHER_TYPES.length - 1)];
  state.weatherStrength = rand(0.35, 0.95);
  state.weatherTimer = rand(18, 34);
  const label = document.getElementById('weather-label');
  if (label) label.textContent = state.weatherType.toUpperCase();
}

export function updateAmbient(dt) {
  dayNightClock += dt;
  for (let i = ambientParticles.length - 1; i >= 0; i--) {
    const a = ambientParticles[i];
    a.life -= dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (!a.ember) {
      a.vx += Math.sin((dayNightClock * 0.8) + i) * 0.6 * dt;
      a.vy += Math.cos((dayNightClock * 0.45) + i) * 0.35 * dt;
    }
    const off = Math.abs(a.x - state.player.x) > window.innerWidth ||
                Math.abs(a.y - state.player.y) > window.innerHeight;
    if (a.life <= 0 || off) {
      ambientParticles.splice(i, 1);
      spawnAmbientParticle(state.player.x, state.player.y);
    }
  }
}
