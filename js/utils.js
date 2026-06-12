import * as THREE from 'three';

/* ============================== helpers ============================== */
export const rand = (a, b) => a + Math.random() * (b - a);
export const choice = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const $ = id => document.getElementById(id);
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}
export const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export function lam(c, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0.04, ...opts });
}
export function bas(c, opts = {}) { return new THREE.MeshBasicMaterial({ color: c, ...opts }); }
/* Convenience — explicit PBR override (roughness, metalness as positional params). */
export function std(c, roughness = 0.82, metalness = 0.04, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: c, roughness, metalness, ...opts });
}

// shared scratch vectors (reused across the per-frame update code)
export const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpV = new THREE.Vector3();
