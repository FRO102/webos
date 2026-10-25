export function normalizeFsPath(path) {
  const value = String(path ?? '/');
  if (value.includes('\\') || value.includes('\0')) throw new Error('Caminho inválido.');

  const segments = [];
  for (const segment of value.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!segments.length) throw new Error('Caminho inválido.');
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return '/' + segments.join('/');
}

export function resolveScopedFsPath(path, home) {
  const value = String(path ?? '/');
  if (value.includes('\\') || value.includes('\0') || value.split('/').includes('..')) {
    throw new Error('Caminho inválido.');
  }

  const normalized = normalizeFsPath(value);
  if (normalized === '/' || normalized === '/home') return home;
  if (normalized === '/.Trash' || normalized.startsWith('/.Trash/')) return normalized;
  if (normalized === home || normalized.startsWith(home + '/')) return normalized;
  throw new Error('A aplicação só pode aceder à pasta do utilizador.');
}