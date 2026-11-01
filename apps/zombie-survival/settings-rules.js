export function mergeSettings(rawSettings, updates) {
  let current = {};
  try {
    const parsed = JSON.parse(rawSettings || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) current = parsed;
  } catch (error) {}
  return JSON.stringify({ ...current, ...updates });
}