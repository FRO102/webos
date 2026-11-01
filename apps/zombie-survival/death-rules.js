export function claimZombieDeath(zombie) {
  if (!zombie || zombie.deathResolved) return false;
  zombie.deathResolved = true;
  zombie.hp = 0;
  return true;
}

export function isPlayerCreditedDeath(options = {}) {
  return options.attributed !== false;
}