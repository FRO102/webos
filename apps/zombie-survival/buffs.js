import { PERKS, RARITY_COLOR } from './constants.js';
import { state } from './state.js';

// ---------------------------------------------------------------------------
// Sistema de "Active Effects" — traduz o estado atual do jogador (perks
// permanentes tomados + efeitos temporários como shield/berserker/sprint)
// numa lista de ícones com tooltip para o HUD. Não guarda estado próprio:
// é sempre recalculado a partir de state, por isso nunca pode dessincronizar.
// ---------------------------------------------------------------------------

let buffsRowEl = null;

export function initBuffsUI() {
  buffsRowEl = document.getElementById('buffs-row');
}

function permanentPerkBuffs() {
  const out = [];
  for (const perkId of state.runPerksTaken) {
    const def = PERKS.find(p => p.id === perkId || p.name === perkId);
    if (!def) continue;
    out.push({
      key: 'perk_' + (def.id || def.name),
      icon: def.icon || '★',
      label: def.name,
      desc: def.desc,
      rarity: def.rarity || 'common',
      cssClass: def.rarity || 'common'
    });
  }
  return out;
}

function temporaryBuffs() {
  const out = [];
  const p = state.player;

  if (state.shieldTimer > 0) {
    out.push({
      key: 'shield',
      icon: '🔰',
      label: 'Shielded',
      desc: 'Immune to damage — ' + state.shieldTimer.toFixed(1) + 's left',
      cssClass: 'temp'
    });
  }

  if (p.invuln > 0 && state.shieldTimer <= 0) {
    out.push({
      key: 'invuln',
      icon: '✨',
      label: 'Invulnerable',
      desc: 'Brief post-hit / dash invulnerability',
      cssClass: 'temp'
    });
  }

  if (p.hasBerserker && p.hp / p.maxHp < 0.30) {
    out.push({
      key: 'berserker_active',
      icon: '🔥',
      label: 'Berserker ACTIVE',
      desc: '+35% damage, +20% move speed while below 30% HP',
      cssClass: 'warn'
    });
  }

  if (p.hasUndying) {
    out.push({
      key: 'undying_status',
      icon: '💜',
      label: p.undyingReady ? 'Undying — Ready' : 'Undying — Spent',
      desc: p.undyingReady
        ? 'Next lethal hit this night leaves you at 1 HP'
        : 'Already used this night — recharges next wave',
      cssClass: p.undyingReady ? 'epic' : ''
    });
  }

  if (state.comboMult >= 1.5) {
    out.push({
      key: 'combo_hot',
      icon: '⚡',
      label: 'Combo x' + state.comboMult.toFixed(1),
      desc: 'Kill streak bonus XP multiplier — fades if you stop killing',
      cssClass: state.comboMult >= 2.5 ? 'epic' : 'temp'
    });
  }

  const spinBuff = getSpinUpBuff();
  if (spinBuff) out.push(spinBuff);

  return out;
}

function getSpinUpBuff() {
  if (state.spinUpLevel > 0.05) {
    return {
      key: 'spinup',
      icon: '🌀',
      label: 'Spinning Up',
      desc: 'Minigun at ' + Math.round(state.spinUpLevel * 100) + '% rate of fire',
      cssClass: state.spinUpLevel >= 1 ? 'epic' : 'temp'
    };
  }
  return null;
}

export function getActiveBuffs() {
  return [...temporaryBuffs(), ...permanentPerkBuffs()];
}

let lastSignature = '';

export function renderBuffsHUD() {
  if (!buffsRowEl) return;
  const buffs = getActiveBuffs();
  const signature = buffs.map(b => b.key + ':' + b.label).join('|');
  if (signature === lastSignature && buffsRowEl.children.length === buffs.length) {
    return; // nada mudou de forma relevante — evita interromper hover do tooltip
  }
  lastSignature = signature;
  buffsRowEl.innerHTML = '';
  for (const b of buffs) {
    const el = document.createElement('div');
    el.className = 'buff-icon' + (b.cssClass ? ' ' + b.cssClass : '');
    el.innerHTML = `${b.icon}<div class="buff-tooltip">${b.label}${b.desc ? ' — ' + b.desc : ''}</div>`;
    buffsRowEl.appendChild(el);
  }
}
