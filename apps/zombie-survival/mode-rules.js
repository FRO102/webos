export function getModeStartWave(mode) {
  return Math.max(1, mode?.minWave || 1);
}

export function isModeComplete(mode, wave) {
  return !!mode && !mode.endless && Number.isFinite(mode.maxWave) && wave >= mode.maxWave;
}

export function getModeResultCopy(mode, won, language = 'pt') {
  const isEnglish = language === 'en';
  const base = mode?.id === 'challenge' ? {
    title: isEnglish ? 'CHALLENGE COMPLETE' : 'MISSÃO CONCLUÍDA',
    subtitle: isEnglish ? 'You survived the full nightmare.' : 'Sobreviveste ao pesadelo completo.',
    primary: isEnglish ? 'PLAY AGAIN' : 'JOGAR DE NOVO'
  } : {
    title: won ? (isEnglish ? 'RUN COMPLETE' : 'RUN CONCLUÍDA') : (isEnglish ? 'YOU DIED' : 'FICASTE SEM PELE'),
    subtitle: won ? (isEnglish ? 'The night is yours.' : 'A noite é tua.') : (isEnglish ? 'The horde took the run.' : 'A horda levou a run.'),
    primary: won ? (isEnglish ? 'PLAY AGAIN' : 'JOGAR DE NOVO') : (isEnglish ? 'RISE AGAIN' : 'TENTAR DE NOVO')
  };
  return base;
}

export function shouldSpawnBoss(wave, bossEvery = 5) {
  return bossEvery > 0 && wave % bossEvery === 0;
}