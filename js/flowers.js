import * as THREE from 'three';
import { rand, choice, lam, bas } from './utils.js';
import { S } from './state.js';
import { scene } from './engine.js';
import { FIELD_R, inObstacle } from './world.js';
import { girl } from './characters.js';
import { burst } from './particles.js';
import { stat } from './upgrades.js';

/* ============================== flowers ============================== */
export const FLOWER_COLORS = [0xff8fb7, 0xc9a0ff, 0x8fc9ff, 0xfff6fb, 0xffb46e, 0xff7a9c];
export const RAINBOW = [0xff5e7a, 0xffb14a, 0xffe24a, 0x5ed47a, 0x5aa8f0, 0x9d5eff];
export const GEO = {
  stem: new THREE.CylinderGeometry(0.035, 0.045, 0.55, 6),
  leaf: new THREE.SphereGeometry(0.09, 6, 5),
  petal: new THREE.SphereGeometry(0.13, 8, 6),
  center: new THREE.SphereGeometry(0.1, 8, 6),
  ring: new THREE.CircleGeometry(0.34, 16),
};
export const stemMat = lam(0x5cba6a), leafMat = lam(0x6fcf7a);
export const flowers = [];

export function freeSpot(minGirl = 3, minOther = 2) {
  for (let tries = 0; tries < 18; tries++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (FIELD_R - 1.8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inObstacle(x, z)) continue;
    if (Math.hypot(x - girl.position.x, z - girl.position.z) < minGirl) continue;
    if (!flowers.every(f => Math.hypot(x - f.g.position.x, z - f.g.position.z) > minOther)) continue;
    return { x, z };
  }
  return null;
}

export function spawnFlower(kind) { // 'normal' | 'golden' | 'rainbow'
  const spot = freeSpot();
  if (!spot) return;
  const golden = kind === 'golden', rainbow = kind === 'rainbow';
  const tulip = !golden && !rainbow && Math.random() < 0.4;
  const g = new THREE.Group();
  g.position.set(spot.x, 0, spot.z);
  const stem = new THREE.Mesh(GEO.stem, stemMat); stem.position.y = 0.275; g.add(stem);
  [-1, 1].forEach(s => {
    const leaf = new THREE.Mesh(GEO.leaf, leafMat);
    leaf.position.set(s * 0.1, 0.22, 0); leaf.scale.set(1.3, 0.35, 0.6); leaf.rotation.z = s * 0.5;
    g.add(leaf);
  });
  const head = new THREE.Group(); head.position.y = 0.55; g.add(head);
  const color = golden ? 0xffd24a : rainbow ? 0xffffff : choice(FLOWER_COLORS);
  const petalMat = new THREE.MeshLambertMaterial({ color, emissive: golden ? 0x8a6200 : rainbow ? 0x303030 : 0x000000 });
  const centerMat = lam(golden || rainbow ? 0xfff3b0 : 0xffe066);
  const petalMats = [];
  if (tulip) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const p = new THREE.Mesh(GEO.petal, petalMat);
      p.position.set(Math.cos(a) * 0.08, 0.08, Math.sin(a) * 0.08);
      p.scale.set(0.75, 1.5, 0.75);
      head.add(p);
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const mat = rainbow ? new THREE.MeshLambertMaterial({ color: RAINBOW[i], emissive: 0x202020 }) : petalMat;
      if (rainbow) petalMats.push(mat);
      const p = new THREE.Mesh(GEO.petal, mat);
      p.position.set(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
      p.scale.set(1, 0.35, 0.55); p.rotation.y = -a;
      head.add(p);
    }
    const center = new THREE.Mesh(GEO.center, centerMat);
    center.scale.y = 0.6; center.position.y = 0.02; head.add(center);
  }
  const ring = new THREE.Mesh(GEO.ring, bas(golden ? 0xffe27a : rainbow ? 0xffc9e8 : 0xffffff,
    { transparent: true, opacity: 0.22, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; g.add(ring);

  g.scale.setScalar(0.001);
  scene.add(g);
  flowers.push({
    g, head, ring, petalMat, centerMat, petalMats, golden, rainbow,
    baseColor: new THREE.Color(color),
    born: S.gameT, ageBoost: 0, carried: false,
    lifespan: S.cfg.lifespan * (golden ? 0.75 : rainbow ? 1.5 : 1),
    popK: 0, wiltK: 0, phase: rand(0, 9), picked: false, pickT: 0, fromPos: null,
  });
}
export function rollFlowerKind() {
  if (S.cfg.rush) return 'golden';
  const r = Math.random();
  if (r < 0.018) return 'rainbow';
  if (r < 0.018 + stat.goldenChance()) return 'golden';
  return 'normal';
}
export function removeFlower(f) {
  scene.remove(f.g);
  f.petalMat.dispose(); f.centerMat.dispose(); f.ring.material.dispose();
  if (f.petalMats) f.petalMats.forEach(m => m.dispose());
  flowers.splice(flowers.indexOf(f), 1);
}
export function clearFlowers(withPoof) {
  while (flowers.length) {
    const f = flowers[0];
    if (withPoof) burst(f.g.position.clone().setY(0.6), [f.baseColor.getHex(), 0xffffff], 6, 2.2, 1.8, 0.8);
    removeFlower(f);
  }
}
export const openFlowers = () => flowers.filter(f => !f.picked && !f.carried);
