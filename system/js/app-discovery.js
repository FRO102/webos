const appIdPattern = /^[a-z0-9][a-z0-9-]*$/;

export function parseAppDirectoryListing(html) {
  const ids = new Set();
  const links = html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gis);

  for (const [, , href] of links) {
    const path = href.split(/[?#]/, 1)[0];
    if (!path.endsWith('/')) continue;
    const segment = path.split('/').filter(Boolean).at(-1);
    if (!segment) continue;

    let id;
    try { id = decodeURIComponent(segment); } catch { continue; }
    if (appIdPattern.test(id)) ids.add(id);
  }

  return [...ids].sort();
}