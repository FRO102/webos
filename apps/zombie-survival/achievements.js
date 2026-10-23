import { ACHIEVEMENTS_STORAGE_KEY, STATS_STORAGE_KEY } from './constants.js';
import { state } from './state.js';
import { playSound } from './audio.js';
import { getStoredValue, setStoredValue } from './persistence.js';

// ---------------------------------------------------------------------------
// Definição de todas as conquistas. `check(ctx)` é chamado em vários pontos
// do jogo (morte de zombie, fim de wave, morte do jogador, uso de perk...)
// com um contexto relevante e deve devolver `true` quando a condição é
// cumprida. Conquistas já desbloqueadas nunca são testadas de novo.
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = [
  { id:'first_blood', icon:'🩸', name:'First Blood', desc:'Kill your first zombie', check:(ctx) => ctx.type==='kill' && state.lifetimeStats.totalKills >= 1 },
  { id:'century', icon:'💯', name:'Century', desc:'Reach 100 lifetime kills', check:(ctx) => ctx.type==='kill' && state.lifetimeStats.totalKills >= 100 },
  { id:'thousand_cuts', icon:'⚔️', name:'Thousand Cuts', desc:'Reach 1000 lifetime kills', check:(ctx) => ctx.type==='kill' && state.lifetimeStats.totalKills >= 1000 },
  { id:'survivor_5', icon:'🌙', name:'First Light', desc:'Survive to Night 5', check:(ctx) => ctx.type==='wave' && ctx.wave >= 5 },
  { id:'survivor_10', icon:'🌑', name:'Deep Night', desc:'Survive to Night 10', check:(ctx) => ctx.type==='wave' && ctx.wave >= 10 },
  { id:'survivor_20', icon:'☠️', name:'Endless Dark', desc:'Survive to Night 20', check:(ctx) => ctx.type==='wave' && ctx.wave >= 20 },
  { id:'boss_slayer', icon:'👹', name:'Boss Slayer', desc:'Kill your first boss', check:(ctx) => ctx.type==='kill' && ctx.zombieType==='boss' },
  { id:'boss_hunter', icon:'💀', name:'Boss Hunter', desc:'Kill 10 bosses', check:(ctx) => ctx.type==='kill' && ctx.zombieType==='boss' && state.lifetimeStats.bossKills >= 10 },
  { id:'melee_master', icon:'🔪', name:'Melee Master', desc:'Get 50 melee kills', check:(ctx) => ctx.type==='kill' && ctx.melee && state.lifetimeStats.meleeKills >= 50 },
  { id:'sharpshooter', icon:'🎯', name:'Sharpshooter', desc:'Land 25 headshots', check:(ctx) => ctx.type==='kill' && ctx.headshot && state.lifetimeStats.headshotKills >= 25 },
  { id:'crit_master', icon:'✨', name:'Critical Thinker', desc:'Land 50 critical hits', check:(ctx) => ctx.type==='kill' && ctx.crit && state.lifetimeStats.critKills >= 50 },
  { id:'combo_10', icon:'🔥', name:'On A Roll', desc:'Reach a x2.0 combo multiplier', check:(ctx) => ctx.type==='combo' && ctx.mult >= 2.0 },
  { id:'combo_max', icon:'🌟', name:'Unstoppable', desc:'Reach a x3.0 combo multiplier', check:(ctx) => ctx.type==='combo' && ctx.mult >= 3.0 },
  { id:'level_10', icon:'📈', name:'Veteran', desc:'Reach player level 10', check:(ctx) => ctx.type==='level' && ctx.level >= 10 },
  { id:'level_20', icon:'🏅', name:'Elite', desc:'Reach player level 20', check:(ctx) => ctx.type==='level' && ctx.level >= 20 },
  { id:'perk_collector', icon:'🧬', name:'Perk Collector', desc:'Take 10 perks in a single run', check:(ctx) => ctx.type==='perk' && state.runPerksTaken.length >= 10 },
  { id:'epic_perk', icon:'💜', name:'Epic Find', desc:'Take an Epic-rarity perk', check:(ctx) => ctx.type==='perk' && ctx.rarity==='epic' },
  { id:'no_damage_wave', icon:'🛡️', name:'Untouched', desc:'Clear a night without taking damage', check:(ctx) => ctx.type==='waveNoDamage' },
  { id:'nightmare_win', icon:'💢', name:'Nightmare Fuel', desc:'Survive Night 5 on Nightmare difficulty', check:(ctx) => ctx.type==='wave' && ctx.wave >= 5 && state.selectedDifficulty === 'nightmare' },
  { id:'weapon_master', icon:'🔫', name:'Arsenal', desc:'Get a kill with every unlocked weapon', check:(ctx) => ctx.type==='kill' && Object.keys(state.lifetimeStats.weaponKills).length >= 13 },
  { id:'explosive_expert', icon:'💥', name:'Demolitions', desc:'Kill 20 zombies with explosives', check:(ctx) => ctx.type==='explosiveKillCount' && ctx.count >= 20 },
];

let unlocked = {};
let explosiveKillCount = 0;

export function loadAchievements() {
  try {
    const raw = getStoredValue(ACHIEVEMENTS_STORAGE_KEY);
    if (raw) unlocked = JSON.parse(raw) || {};
  } catch (err) { unlocked = {}; }
}

export function loadLifetimeStats() {
  try {
    const raw = getStoredValue(STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) Object.assign(state.lifetimeStats, parsed);
    }
  } catch (err) { /* ignore */ }
}

export function saveLifetimeStats() {
  setStoredValue(STATS_STORAGE_KEY, JSON.stringify(state.lifetimeStats));
}

function saveAchievements() {
  setStoredValue(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(unlocked));
}

export function isUnlocked(id) { return !!unlocked[id]; }

export function unlockedCount() { return Object.keys(unlocked).length; }

let toastQueue = [];
let toastShowing = false;

function showNextToast() {
  if (toastShowing || toastQueue.length === 0) return;
  const ach = toastQueue.shift();
  const toast = document.getElementById('achievement-toast');
  const nameEl = document.getElementById('ach-toast-name');
  const iconEl = document.getElementById('ach-toast-icon');
  if (!toast || !nameEl || !iconEl) return;
  toastShowing = true;
  iconEl.textContent = ach.icon;
  nameEl.textContent = ach.name.toUpperCase();
  toast.classList.add('show');
  playSound(880, 0.1, 'triangle', 0.05);
  setTimeout(() => playSound(1180, 0.12, 'triangle', 0.05), 90);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toastShowing = false; showNextToast(); }, 350);
  }, 2600);
}

function unlock(ach) {
  if (unlocked[ach.id]) return;
  unlocked[ach.id] = true;
  saveAchievements();
  state.newAchievementsThisRun.push(ach);
  toastQueue.push(ach);
  showNextToast();
}

/**
 * Verifica todas as conquistas ainda não desbloqueadas contra o contexto dado.
 * ctx.type identifica o tipo de evento: 'kill' | 'wave' | 'combo' | 'level' | 'perk' | 'waveNoDamage' | 'explosiveKillCount'
 */
export function checkAchievements(ctx) {
  if (ctx.type === 'explosiveKillEvent') {
    explosiveKillCount++;
    checkAchievements({ type:'explosiveKillCount', count: explosiveKillCount });
    return;
  }
  for (const ach of ACHIEVEMENTS) {
    if (unlocked[ach.id]) continue;
    try {
      if (ach.check(ctx)) unlock(ach);
    } catch (err) { /* achievement mal formada não deve travar o jogo */ }
  }
}

export function resetExplosiveKillCounter() { explosiveKillCount = 0; }

export function renderAchievementsScreen() {
  const list = document.getElementById('achievements-list');
  const progress = document.getElementById('achievements-progress');
  if (!list || !progress) return;
  list.innerHTML = '';
  let count = 0;
  for (const ach of ACHIEVEMENTS) {
    const isUn = !!unlocked[ach.id];
    if (isUn) count++;
    const row = document.createElement('div');
    row.className = 'ach-row' + (isUn ? '' : ' locked');
    row.innerHTML = `
      <div class="ach-icon">${isUn ? ach.icon : '🔒'}</div>
      <div class="ach-text">
        <div class="ach-name">${ach.name.toUpperCase()}</div>
        <div class="ach-desc">${ach.desc}</div>
      </div>
    `;
    list.appendChild(row);
  }
  progress.textContent = count + ' / ' + ACHIEVEMENTS.length + ' UNLOCKED';
}
