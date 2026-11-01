export function isValidMapSelection(value, maps) {
  return value === 'random' || Object.prototype.hasOwnProperty.call(maps, value);
}

export function restoreMapSelection(value, maps, fallback = 'forest') {
  return isValidMapSelection(value, maps) ? value : fallback;
}