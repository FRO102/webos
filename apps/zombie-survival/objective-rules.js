export function chooseObjective(objectives, wave, chance, random = Math.random) {
  const candidates = objectives.filter(objective => (objective.minWave || 1) <= wave);
  if (!candidates.length || random() >= chance) return null;

  const totalWeight = candidates.reduce((sum, objective) => sum + (objective.weight || 1), 0);
  let roll = random() * totalWeight;
  for (const objective of candidates) {
    roll -= objective.weight || 1;
    if (roll < 0) return objective;
  }
  return candidates[candidates.length - 1];
}

export function getObjectiveOutcome(objective) {
  if (!objective || !objective.active) return null;
  if (objective.type === 'eliminate' && objective.targetLost) return 'failed';
  if (objective.type === 'protect' && objective.timer <= 0) return 'completed';
  if (objective.type === 'recover' && objective.collected) return 'completed';
  if (objective.type === 'eliminate' && objective.killed) return 'completed';
  if (objective.targetCount && objective.progress >= objective.targetCount) return 'completed';
  if (objective.timer <= 0) return 'failed';
  return null;
}

export function recordEliteKill(objective, zombieId) {
  if (!objective || !objective.active || objective.type !== 'eliminate') return false;
  if (!objective.targetId || objective.targetId !== zombieId) return false;
  objective.killed = true;
  return true;
}

export function markEliteTargetLost(objective, zombieIds) {
  if (!objective || !objective.active || objective.type !== 'eliminate' || !objective.targetId || objective.killed) return;
  if (!zombieIds.includes(objective.targetId)) objective.targetLost = true;
}

export function recordObjectiveKill(objective, headshot = false) {
  if (!objective || !objective.active) return;
  if (objective.type === 'clear' || (objective.type === 'precision' && headshot)) {
    objective.progress = (objective.progress || 0) + 1;
  }
}

export function advanceObjectiveTimer(objective, dt, player) {
  if (!objective || !objective.active || dt <= 0) return;
  if (objective.type === 'protect' && objective.target) {
    const distance = Math.hypot(player.x - objective.target.x, player.y - objective.target.y);
    if (distance > (objective.target.r || 130)) return;
  }
  objective.timer = Math.max(0, objective.timer - dt);
}

export function settleObjective(objective, completed) {
  if (!objective || !objective.active) return null;
  objective.active = false;
  objective.status = completed ? 'completed' : 'failed';
  return completed ? { ...(objective.reward || {}) } : {};
}
