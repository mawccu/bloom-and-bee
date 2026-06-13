import * as THREE from 'three';
import { rand, choice, lam, bas, $, tmpV } from './utils.js';
import { scene, camera } from './engine.js';

/* ============================== particles ============================== */
const PARTS = [];
let _partFree = 0;
const partGeo = new THREE.OctahedronGeometry(0.07, 0);
export function burst(pos, colors, n = 10, spd = 2.4, up = 1.4, life = 0.7, size = 1) {
  const palette = Array.isArray(colors) ? colors : [colors];
  for (let i = 0; i < n; i++) {
    let p = null;
    for (let j = 0; j < PARTS.length; j++) {
      const idx = (_partFree + j) % PARTS.length;
      if (!PARTS[idx].active) { p = PARTS[idx]; _partFree = (idx + 1) % PARTS.length; break; }
    }
    if (!p) {
      if (PARTS.length > 120) return;
      p = { mesh: new THREE.Mesh(partGeo, bas(0xffffff, { transparent: true })), active: false, vel: new THREE.Vector3(), life: 0, maxLife: 1 };
      scene.add(p.mesh); PARTS.push(p);
    }
    p.active = true; p.maxLife = p.life = life * rand(0.7, 1.3);
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.set(choice(palette));
    p.mesh.material.opacity = 1;
    p.mesh.scale.setScalar(size * rand(0.6, 1.4));
    p.vel.set(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize().multiplyScalar(spd * rand(0.5, 1.2));
    p.vel.y += up;
  }
}
export function updateParticles(dt) {
  for (const p of PARTS) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) { p.active = false; p.mesh.visible = false; continue; }
    p.vel.y -= 6.5 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 6; p.mesh.rotation.y += dt * 8;
    p.mesh.material.opacity = p.life / p.maxLife;
  }
}

// ambient drifting blossom petals 🌸
export const driftPetals = [];
{
  const pGeo = new THREE.SphereGeometry(0.09, 6, 5);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(pGeo, lam(choice([0xffb7d5, 0xffd0e4, 0xfff0f6])));
    m.scale.set(1, 0.25, 0.7);
    scene.add(m);
    driftPetals.push({ m, off: rand(0, 99), x: rand(-12, 12), z: rand(-12, 12), y: rand(0, 7), spin: rand(2, 5) });
  }
}

/* ============================== floating text ============================== */
const ftLayer = $('ft');
export function floatText(worldPos, str, cls = '') {
  tmpV.copy(worldPos).project(camera);
  if (tmpV.z > 1) return;
  const el = document.createElement('div');
  el.className = 'ft ' + cls;
  el.textContent = str;
  el.style.left = ((tmpV.x * 0.5 + 0.5) * innerWidth) + 'px';
  el.style.top = ((-tmpV.y * 0.5 + 0.5) * innerHeight) + 'px';
  ftLayer.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}
