export function rand(a,b) { return a + Math.random()*(b-a); }
export function randInt(a,b) { return Math.floor(rand(a,b+1)); }
export function dist(x1,y1,x2,y2) { return Math.hypot(x2-x1, y2-y1); }
export function clamp(v,a,b) { return Math.max(a, Math.min(b,v)); }
export function angleTo(x1,y1,x2,y2) { return Math.atan2(y2-y1, x2-x1); }