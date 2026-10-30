import { WEAPONS } from './constants.js';
import { clamp } from './utils.js';
import { state } from './state.js';
import { isWeaponUnlocked } from './state.js';
import { initBuffsUI, renderBuffsHUD, getActiveBuffs } from './buffs.js';

// Referências DOM
export const dom = {};

let slotEls = [];
let previousUnlocked = [];

export function initUI() {
  dom.healthInner = document.getElementById('healthbar-inner');
  dom.staminaInner = document.getElementById('staminabar-inner');
  dom.armorInner = document.getElementById('armorbar-inner');
  dom.dashInner = document.getElementById('dashbar-inner');
  dom.xpInner = document.getElementById('xpbar-inner');
  dom.medkitCount = document.getElementById('medkit-count');
  dom.runTime = document.getElementById('run-time');
  dom.waveRemaining = document.getElementById('wave-remaining');
  dom.weatherLabel = document.getElementById('weather-label');
  dom.levelNum = document.getElementById('level-num');
  dom.bossbarWrap = document.getElementById('bossbar-wrap');
  dom.bossbarInner = document.getElementById('bossbar-inner');
  dom.bossbarName = document.getElementById('bossbar-name');
  dom.rightStatus = document.getElementById('right-status');
  dom.rightStatusTitle = document.getElementById('right-status-title');
  dom.rightStatusBody = document.getElementById('right-status-body');
  dom.bottomStatus = document.getElementById('bottom-status');
  dom.bottomStatusTitle = document.getElementById('bottom-status-title');
  dom.bottomStatusBody = document.getElementById('bottom-status-body');
  dom.objectiveWrap = document.getElementById('objective-wrap');
  dom.objectiveText = document.getElementById('objective-text');
  dom.objectiveBar = document.getElementById('objective-bar-inner');
  dom.waveNum = document.getElementById('wave-num');
  dom.killCount = document.getElementById('kill-count');
  dom.ammoActiveName = document.getElementById('ammo-active-name');
  dom.ammoActiveCount = document.getElementById('ammo-active-count');
  dom.ammoActiveBar = document.getElementById('ammo-active-bar-inner');
  dom.bestRun = document.getElementById('best-run');
  dom.statBest = document.getElementById('stat-best');
  dom.dmgTop = document.getElementById('dmg-top');
  dom.dmgRight = document.getElementById('dmg-right');
  dom.dmgBottom = document.getElementById('dmg-bottom');
  dom.dmgLeft = document.getElementById('dmg-left');
  dom.comboEl = document.getElementById('combo-indicator');
  dom.spinupOuter = document.getElementById('spinup-outer');
  dom.spinupInner = document.getElementById('spinup-inner');

  buildWeaponSlots();
  initBuffsUI();
}

function keyLabelForIndex(i) {
  // 1-9 para as primeiras 9 armas, depois 0 para a 10ª (índice 9)
  if (i < 9) return String(i + 1);
  if (i === 9) return '0';
  return '·'; // fallback visual — alcançável apenas via scroll
}

function buildWeaponSlots() {
  const container = document.getElementById('bottomcenter');
  if (!container) return;
  container.innerHTML = '';
  slotEls = [];
  previousUnlocked = WEAPONS.map(() => false);
  WEAPONS.forEach((w, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === 0 ? ' active' : '');
    slot.id = 'slot' + (i + 1);
    slot.title = w.name;
    slot.innerHTML = `<span class="key">${keyLabelForIndex(i)}</span>${w.icon}`;
    slot.addEventListener('click', () => {
      import('./player.js').then(m => m.switchWeapon(i));
    });
    container.appendChild(slot);
    slotEls.push(slot);
  });
}

export let damageIndicators = { top: 0, right: 0, bottom: 0, left: 0 };

export function triggerDamageIndicator(fromX, fromY, power) {
  const ang = Math.atan2(state.player.y - fromY, state.player.x - fromX);
  const cx = Math.cos(ang);
  const sy = Math.sin(ang);
  const p = clamp(power || 0.75, 0.25, 1);
  if (Math.abs(cx) > Math.abs(sy)) {
    if (cx > 0) damageIndicators.right = Math.max(damageIndicators.right, p);
    else damageIndicators.left = Math.max(damageIndicators.left, p);
  } else {
    if (sy > 0) damageIndicators.bottom = Math.max(damageIndicators.bottom, p);
    else damageIndicators.top = Math.max(damageIndicators.top, p);
  }
}

export function updateDamageIndicators(dt) {
  const d = dt * 1.6;
  damageIndicators.top = Math.max(0, damageIndicators.top - d);
  damageIndicators.right = Math.max(0, damageIndicators.right - d);
  damageIndicators.bottom = Math.max(0, damageIndicators.bottom - d);
  damageIndicators.left = Math.max(0, damageIndicators.left - d);
  dom.dmgTop.style.opacity = damageIndicators.top.toFixed(3);
  dom.dmgRight.style.opacity = damageIndicators.right.toFixed(3);
  dom.dmgBottom.style.opacity = damageIndicators.bottom.toFixed(3);
  dom.dmgLeft.style.opacity = damageIndicators.left.toFixed(3);
}

export function refreshWeaponSlotsUI() {
  for (let i = 0; i < WEAPONS.length; i++) {
    const slot = slotEls[i];
    if (!slot) continue;
    const unlocked = isWeaponUnlocked(i);
    slot.classList.toggle('locked', !unlocked);
    slot.classList.toggle('active', state.player.weaponIdx === i);
    // Badge "NEW" temporário quando a arma acabou de desbloquear nesta wave
    const justUnlocked = unlocked && !previousUnlocked[i] && state.wave === WEAPONS[i].unlockedWave && state.wave > 0;
    let badge = slot.querySelector('.slot-new-badge');
    if (justUnlocked) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'slot-new-badge';
        badge.textContent = 'NEW';
        slot.appendChild(badge);
      }
    } else if (badge && !justUnlocked && state.wave !== WEAPONS[i].unlockedWave) {
      badge.remove();
    }
    previousUnlocked[i] = unlocked;
  }
}

export function syncAmmoUI() {
  const idx = state.player.weaponIdx;
  const w = WEAPONS[idx];
  const st = state.ammoState[idx];
  if (!dom.ammoActiveName || !dom.ammoActiveCount || !w || !st) return;
  dom.ammoActiveName.textContent = w.icon + ' ' + w.name.toUpperCase();
  let pct = 1;
  if (w.type === 'grenade') {
    dom.ammoActiveCount.textContent = String(st.mag);
    pct = w.mag > 0 ? st.mag / w.mag : 1;
  } else if (w.type === 'melee') {
    dom.ammoActiveCount.textContent = '∞';
    pct = 1;
  } else {
    dom.ammoActiveCount.textContent = st.mag + ' / ' + st.reserve;
    pct = w.mag > 0 ? st.mag / w.mag : 1;
  }
  if (dom.ammoActiveBar) {
    dom.ammoActiveBar.style.width = clamp(pct * 100, 0, 100) + '%';
    dom.ammoActiveBar.classList.toggle('low', pct <= 0.25 && w.type !== 'melee');
  }
  // Spin-up (Minigun)
  if (dom.spinupOuter && dom.spinupInner) {
    if (w.spinUp) {
      dom.spinupOuter.classList.add('show');
      dom.spinupInner.style.width = clamp((state.spinUpLevel || 0) * 100, 0, 100) + '%';
    } else {
      dom.spinupOuter.classList.remove('show');
    }
  }
  refreshWeaponSlotsUI();
}

export function syncHUD(gameStartTime) {
  dom.healthInner.style.width = clamp(state.player.hp / state.player.maxHp * 100, 0, 100) + '%';
  dom.staminaInner.style.width = clamp(state.player.stamina / state.player.maxStamina * 100, 0, 100) + '%';
  dom.armorInner.style.width = clamp(state.player.armor / state.player.maxArmor * 100, 0, 100) + '%';
  dom.dashInner.style.width = ((1 - clamp(state.dashCooldown / state.dashMaxCooldown, 0, 1)) * 100).toFixed(2) + '%';
  dom.xpInner.style.width = clamp(state.player.xp / state.player.nextXp * 100, 0, 100) + '%';
  dom.medkitCount.textContent = state.medkits;
  const elapsed = (performance.now() - gameStartTime) / 1000;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  dom.runTime.textContent = mins + ':' + String(secs).padStart(2, '0');
  dom.waveRemaining.textContent = Math.max(0, state.waveSpawnQueue.length + state.zombies.length);
  dom.weatherLabel.textContent = state.weatherType.toUpperCase();
  dom.levelNum.textContent = state.player.level;
  const liveBoss = state.zombies.find(z => z.type === 'boss' && z.hp > 0);
  if (liveBoss) {
    dom.bossbarWrap.classList.remove('hidden');
    dom.bossbarInner.style.width = clamp(liveBoss.hp / liveBoss.maxHp * 100, 0, 100) + '%';
    const variantLabel = liveBoss.bossVariant ? liveBoss.bossVariant.toUpperCase() : '';
    dom.bossbarName.textContent = 'BOSS NIGHT ' + state.wave + (variantLabel ? ' — ' + variantLabel : '');
  } else {
    dom.bossbarWrap.classList.add('hidden');
  }
  syncAmmoUI();
  dom.waveNum.textContent = state.wave;
  dom.killCount.textContent = state.killCount;
  renderBuffsHUD();
}

export function decayCombo(dt) {
  if (state.comboTimer > 0) state.comboTimer -= dt;
  if (state.comboTimer <= 0 && state.comboCount > 0) {
    state.comboCount = 0;
    state.comboMult = 1;
    dom.comboEl.classList.remove('show');
    dom.comboEl.textContent = 'COMBO x1.0';
  }
}

export function syncObjectiveUI() {
  if (!dom || !dom.objectiveWrap) return;
  const o = (state && state.objective) ? state.objective : null;
  if (!o || !o.active) {
    dom.objectiveWrap.classList.add('hidden');
    return;
  }
  dom.objectiveWrap.classList.remove('hidden');
  let text = (String(o.icon || '') + ' ' + String(o.label || '')).trim().toUpperCase();
  if (o.type === 'protect') text += ' (' + Math.ceil(o.timer || 0) + 's)';
  if (o.type === 'eliminate') text += o.killed ? ' (DONE)' : '';
  if (o.type === 'recover') text += o.collected ? ' (COLLECTED)' : '';
  if (dom.objectiveText) dom.objectiveText.textContent = text;
  if (dom.objectiveBar) {
    const total = (o.initialTime && o.initialTime > 0) ? o.initialTime : ((o.timer && o.timer > 0) ? o.timer : 1);
    const pct = Math.max(0, Math.min(1, (o.timer || 0) / total));
    dom.objectiveBar.style.width = (pct * 100).toFixed(1) + '%';
  }
}


export function syncRightStatusPanel() {
  if (dom && dom.rightStatus) dom.rightStatus.classList.add('hidden');
  if (!dom || !dom.rightStatusBody) return;
  if (state.gameRunning && state.player && state.player.alive) {
    dom.rightStatus.classList.remove('hidden');
  } else {
    dom.rightStatus.classList.add('hidden');
  }
  const rows = [
    ['HP', String(Math.round(state.player.hp)) + ' / ' + state.player.maxHp],
    ['Armor', String(Math.round(state.player.armor)) + ' / ' + state.player.maxArmor],
    ['Level', String(state.player.level)],
    ['Night', String(state.wave)],
    ['Kills', String(state.killCount)],
    ['Combo', 'x' + state.comboMult.toFixed(2)],
    ['Ammo', (state.ammoState[state.player.weaponIdx] ? state.ammoState[state.player.weaponIdx].mag + ' / ' + state.ammoState[state.player.weaponIdx].reserve : '∞')],
    ['Weight', state.player.spreadMul.toFixed(2)],
    ['Role', state.selectedClass.toUpperCase()],
    ['Mode', state.runMode.toUpperCase()]
  ];
  dom.rightStatusBody.innerHTML = '';
  const buffsSection = document.createElement('div');
  buffsSection.className = 'right-status-section';
  const buffsTitle = document.createElement('div');
  buffsTitle.className = 'right-status-section-title';
  buffsTitle.textContent = 'BUFFS';
  buffsSection.appendChild(buffsTitle);
  try {
    const buffs = (typeof getActiveBuffs === 'function') ? getActiveBuffs() : [];
    for (const b of buffs) {
      const row = document.createElement('div');
      row.className = 'right-status-row buff-row';
      row.innerHTML = '<span class="right-label">' + String(b.icon || '?') + ' ' + String(b.label || '') + '</span><span class="right-value">' + String(b.desc || '').slice(0,40) + '</span>';
      buffsSection.appendChild(row);
    }
    if (buffs.length === 0) {
      const row = document.createElement('div');
      row.className = 'right-status-row';
      row.innerHTML = '<span class="right-label">NONE</span><span class="right-value">-</span>';
      buffsSection.appendChild(row);
    }
  } catch (e) {}
  dom.rightStatusBody.appendChild(buffsSection);

  for (const [label, val] of rows) {
    const row = document.createElement('div');
    row.className = 'right-status-row';
    row.innerHTML = '<span class="right-label">' + label + '</span><span class="right-value">' + val + '</span>';
    dom.rightStatusBody.appendChild(row);
  }
}


export function syncBottomStatusPanel() {
  if (!dom || !dom.bottomStatus || !dom.bottomStatusBody) return;
  if (state.gameRunning && state.player && state.player.alive) dom.bottomStatus.classList.remove('hidden');
  else dom.bottomStatus.classList.add('hidden');
  dom.bottomStatusBody.innerHTML = '';
  const buffs = (typeof getActiveBuffs === 'function') ? getActiveBuffs() : [];
  // status rows
  const rows = [
    ['HP', String(Math.round(state.player.hp)) + '/' + state.player.maxHp],
    ['Armor', String(Math.round(state.player.armor)) + '/' + state.player.maxArmor],
    ['Level', String(state.player.level)],
    ['Night', String(state.wave)],
    ['Kills', String(state.killCount)],
    ['Combo', 'x' + state.comboMult.toFixed(2)],
    ['Ammo', (state.ammoState[state.player.weaponIdx] ? state.ammoState[state.player.weaponIdx].mag + '/' + state.ammoState[state.player.weaponIdx].reserve : '∞')],
    ['Mode', state.runMode.toUpperCase()]
  ];
  for (const [label,val] of rows) {
    const row=document.createElement('div');
    row.className='bottom-status-row';
    row.innerHTML='<span>'+label+'</span><span>'+val+'</span>';
    dom.bottomStatusBody.appendChild(row);
  }
  // effects section
  const eff=document.createElement('div');
  eff.className='bottom-status-effects';
  eff.textContent='EFFECTS: ' + (buffs.length ? buffs.map(b=> (b.icon||'') + ' ' + (b.label||'')).join(' | ') : 'NONE');
  dom.bottomStatusBody.appendChild(eff);
}
