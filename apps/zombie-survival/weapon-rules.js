export function selectLightningTargets(zombies, origin, angle, range, chainCount, chainRange = 180) {
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const firstTarget = zombies.map(zombie => {
    const dx = zombie.x - origin.x;
    const dy = zombie.y - origin.y;
    return {
      zombie,
      distance: dx * directionX + dy * directionY,
      offset: Math.abs(dx * directionY - dy * directionX)
    };
  }).filter(hit => hit.zombie.hp > 0 && hit.distance >= 0 && hit.distance <= range && hit.offset <= hit.zombie.r + 16)
    .sort((a, b) => a.distance - b.distance)[0]?.zombie;

  if (!firstTarget || chainCount <= 0) return [];
  const targets = [firstTarget];
  while (targets.length < chainCount) {
    const source = targets[targets.length - 1];
    const next = zombies.filter(zombie => zombie.hp > 0 && !targets.includes(zombie))
      .map(zombie => ({ zombie, distance: Math.hypot(source.x - zombie.x, source.y - zombie.y) }))
      .filter(hit => hit.distance <= chainRange)
      .sort((a, b) => a.distance - b.distance)[0]?.zombie;
    if (!next) break;
    targets.push(next);
  }
  return targets;
}

export function hasSummonCapacity(minions, limit) {
  return minions.filter(minion => minion.life > 0).length < limit;
}