import * as THREE from 'three';
import { rand, choice, clamp, lam, bas, lerpAngle, tmpA, tmpB } from './utils.js';
import { S } from './state.js';
import { scene } from './engine.js';
import { FIELD_R, inObstacle, pushOut, makeBlobShadow } from './world.js';
import { girl } from './characters.js';
import { burst, floatText } from './particles.js';
import { sfx } from './audio.js';
import { flowers, openFlowers, removeFlower, freeSpot, GEO, stemMat } from './flowers.js';

/* ============================== bees & wasps ============================== */
const beeMats = {
  body: lam(0xffce3a), black: lam(0x35302e),
  waspBody: lam(0xff9430), waspDark: lam(0x4a342a),
  wing: bas(0xffffff, { transparent: true, opacity: 0.62 }),
};
export const bees = [];
export function spawnBee(wasp) {
  const g = new THREE.Group();
  const bodyMat = wasp ? beeMats.waspBody : beeMats.body;
  const darkMat = wasp ? beeMats.waspDark : beeMats.black;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
  body.scale.z = 1.35; g.add(body);
  [-0.05, -0.17].forEach(z => {
    const band = new THREE.Mesh(new THREE.SphereGeometry(0.225, 12, 10), darkMat);
    band.scale.set(1, 1, 0.22); band.position.z = z; g.add(band);
  });
  const headB = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), darkMat);
  headB.position.z = 0.3; g.add(headB);
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), bas(0xffffff));
    eye.position.set(s * 0.07, 0.05, 0.42); g.add(eye);
  });
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), darkMat);
  sting.rotation.x = -Math.PI / 2; sting.position.z = -0.37; g.add(sting);
  const wings = [];
  [-1, 1].forEach(s => {
    const piv = new THREE.Group(); piv.position.set(s * 0.06, 0.19, -0.02);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), beeMats.wing);
    w.scale.set(0.6, 0.12, 1.05); w.position.x = s * 0.15; piv.add(w);
    g.add(piv); wings.push(piv);
  });
  if (wasp) g.scale.setScalar(0.85);
  let a = rand(0, Math.PI * 2), r = rand(12, FIELD_R - 5);
  for (let t = 0; t < 10; t++) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - girl.position.x, z - girl.position.z) > 12) break;
    a = rand(0, Math.PI * 2); r = rand(12, FIELD_R - 5);
  }
  g.position.set(Math.cos(a) * r, 1.1, Math.sin(a) * r);
  scene.add(g);
  bees.push({
    g, wings, wasp: !!wasp, shadow: makeBlobShadow(0.28),
    state: 'guard', t: rand(0, 10), guardPos: new THREE.Vector3(), retarget: 0,
    cooldown: rand(1, 3), chaseT: 0, fleeT: 0, faceA: rand(0, 6),
  });
}
export function clearBees() {
  for (const b of bees) { scene.remove(b.g); scene.remove(b.shadow); }
  bees.length = 0;
}

/* ============================== bunny ============================== */
export const bunny = (() => {
  const g = new THREE.Group();
  const white = lam(0xfdfbf7);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), white);
  body.scale.set(1, 0.85, 1.2); body.position.y = 0.3; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), white);
  head.position.set(0, 0.62, 0.28); g.add(head);
  [-1, 1].forEach(s => {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.3, 4, 6), white);
    ear.position.set(s * 0.1, 0.95, 0.2); ear.rotation.x = -0.15; ear.rotation.z = s * 0.12; g.add(ear);
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.2, 4, 6), lam(0xffc9d8));
    inner.position.set(s * 0.1, 0.95, 0.24); inner.rotation.x = -0.15; inner.rotation.z = s * 0.12; g.add(inner);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), bas(0x3a2a2a));
    eye.position.set(s * 0.1, 0.68, 0.46); g.add(eye);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), lam(0xff8fa8));
  nose.position.set(0, 0.6, 0.5); g.add(nose);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), white);
  tail.position.set(0, 0.32, -0.38); g.add(tail);
  [-1, 1].forEach(s => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), white);
    foot.position.set(s * 0.16, 0.08, 0.15); foot.scale.set(1, 0.6, 1.5); g.add(foot);
  });
  g.visible = false;
  scene.add(g);
  return { g, shadow: makeBlobShadow(0.4), active: false, state: 'idle', t: 0,
    hopFrom: new THREE.Vector3(), hopTo: new THREE.Vector3(), hopK: 1, target: null, fleeN: 0, nibbleT: 0 };
})();
bunny.shadow.visible = false;

export function bunnyEnter() {
  bunny.active = true; bunny.g.visible = true; bunny.shadow.visible = true;
  const a = rand(0, Math.PI * 2);
  bunny.g.position.set(Math.cos(a) * (FIELD_R - 2), 0, Math.sin(a) * (FIELD_R - 2));
  bunny.state = 'idle'; bunny.t = 0.5; bunny.hopK = 1; bunny.target = null; bunny.fleeN = 0;
}
export function bunnyHide() { bunny.active = false; bunny.g.visible = false; bunny.shadow.visible = false; }
export function bunnyScare() {
  if (!bunny.active || bunny.state === 'flee') return;
  bunny.state = 'flee'; bunny.fleeN = 4; bunny.t = 0;
  floatText(bunny.g.position.clone().setY(1.3), '!', 'bad');
}

function bunnyHopToward(p, dist) {
  bunny.hopFrom.copy(bunny.g.position);
  tmpA.copy(p).sub(bunny.g.position).setY(0);
  const d = tmpA.length();
  if (d > 0.01) {
    tmpA.normalize();
    bunny.g.rotation.y = Math.atan2(tmpA.x, tmpA.z);
    bunny.hopTo.copy(bunny.g.position).addScaledVector(tmpA, Math.min(dist, d));
    const pr = Math.hypot(bunny.hopTo.x, bunny.hopTo.z);
    if (pr > FIELD_R) { bunny.hopTo.x *= FIELD_R / pr; bunny.hopTo.z *= FIELD_R / pr; }
    if (inObstacle(bunny.hopTo.x, bunny.hopTo.z)) bunny.hopTo.copy(bunny.hopFrom);
  } else bunny.hopTo.copy(bunny.g.position);
  bunny.hopK = 0;
}
export function updateBunny(dt) {
  if (!bunny.active) return;
  const distGirl = Math.hypot(bunny.g.position.x - girl.position.x, bunny.g.position.z - girl.position.z);
  if (bunny.hopK < 1) {
    bunny.hopK = Math.min(1, bunny.hopK + dt / 0.34);
    bunny.g.position.lerpVectors(bunny.hopFrom, bunny.hopTo, bunny.hopK);
    bunny.g.position.y = Math.sin(bunny.hopK * Math.PI) * 0.5;
    bunny.shadow.position.set(bunny.g.position.x, 0.026, bunny.g.position.z);
    return;
  }
  bunny.g.position.y = 0;
  bunny.shadow.position.set(bunny.g.position.x, 0.026, bunny.g.position.z);
  if (bunny.state !== 'flee' && distGirl < 2.8) bunnyScare();
  bunny.t -= dt;
  if (bunny.t > 0) return;
  if (bunny.state === 'flee') {
    tmpB.copy(bunny.g.position).sub(girl.position).setY(0);
    if (tmpB.lengthSq() < 0.01) tmpB.set(1, 0, 0);
    tmpB.normalize().multiplyScalar(8).add(bunny.g.position);
    bunnyHopToward(tmpB, 2.0);
    bunny.t = 0.12;
    if (--bunny.fleeN <= 0) { bunny.state = 'idle'; bunny.t = rand(0.8, 1.6); }
    return;
  }
  const open = openFlowers();
  if (!bunny.target || !open.includes(bunny.target)) {
    bunny.target = open.length ? choice(open) : null;
    if (!bunny.target) {
      const a = rand(0, Math.PI * 2);
      tmpB.set(bunny.g.position.x + Math.cos(a) * 3, 0, bunny.g.position.z + Math.sin(a) * 3);
      bunnyHopToward(tmpB, 1.4); bunny.t = rand(0.4, 0.9);
      return;
    }
  }
  const distT = Math.hypot(bunny.g.position.x - bunny.target.g.position.x, bunny.g.position.z - bunny.target.g.position.z);
  if (distT < 0.8) {
    if (bunny.state !== 'nibble') { bunny.state = 'nibble'; bunny.nibbleT = S.cfg.nibble; }
    bunny.nibbleT -= 0.1; bunny.t = 0.1;
    bunny.g.rotation.z = Math.sin(S.gameT * 18) * 0.07;
    if (bunny.nibbleT <= 0) {
      burst(bunny.target.g.position.clone().setY(0.5), [0x9fe6a0, 0xfdfbf7, bunny.target.baseColor.getHex()], 8, 2, 1.5, 0.7);
      floatText(bunny.target.g.position.clone().setY(1), 'nom! 🐰', 'bad');
      sfx.nom();
      removeFlower(bunny.target);
      bunny.target = null; bunny.state = 'idle'; bunny.t = rand(0.5, 1);
      bunny.g.rotation.z = 0;
    }
  } else {
    bunny.state = 'hop';
    bunnyHopToward(bunny.target.g.position, 1.5);
    bunny.t = 0.16;
  }
}

/* ============================== rain cloud ============================== */
export const rainCloud = (() => {
  const g = new THREE.Group();
  const m = lam(0xb9c4cd);
  [[0, 0, 0, 1.5], [-1.3, -0.2, 0.2, 1.05], [1.3, -0.2, -0.1, 1.1], [0.3, 0.55, 0.2, 1.0]].forEach(([x, y, z, r]) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), m);
    p.position.set(x, y, z); p.scale.y = 0.7; g.add(p);
  });
  const face = bas(0x5a6470);
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), face);
    eye.position.set(s * 0.5, 0.1, 1.42); eye.scale.set(1, 0.5, 0.4); g.add(eye);
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 6, 12, Math.PI), face);
  mouth.position.set(0, -0.42, 1.42); g.add(mouth);
  g.position.y = 7;
  g.visible = false;
  scene.add(g);
  const zone = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24),
    bas(0x6a7a90, { transparent: true, opacity: 0.13, depthWrite: false }));
  zone.rotation.x = -Math.PI / 2; zone.position.y = 0.028; zone.visible = false;
  scene.add(zone);
  const drops = [];
  const dropGeo = new THREE.BoxGeometry(0.03, 0.35, 0.03);
  const dropMat = bas(0x9fc8e8, { transparent: true, opacity: 0.7 });
  for (let i = 0; i < 16; i++) {
    const d = new THREE.Mesh(dropGeo, dropMat);
    d.visible = false; scene.add(d); drops.push(d);
  }
  return { g, zone, drops, active: false, target: new THREE.Vector3(), R: 3.6 };
})();
export function cloudEnter() {
  rainCloud.active = true; rainCloud.g.visible = true; rainCloud.zone.visible = true;
  const a = rand(0, Math.PI * 2);
  rainCloud.g.position.set(Math.cos(a) * 22, 7, Math.sin(a) * 22);
  cloudNewTarget();
  rainCloud.drops.forEach(d => {
    d.visible = true;
    d.position.set(rainCloud.g.position.x + rand(-2.5, 2.5), rand(1, 6.4), rainCloud.g.position.z + rand(-2.5, 2.5));
  });
}
export function cloudHide() {
  rainCloud.active = false; rainCloud.g.visible = false; rainCloud.zone.visible = false;
  rainCloud.drops.forEach(d => d.visible = false);
}
function cloudNewTarget() {
  if (Math.random() < 0.5) rainCloud.target.set(girl.position.x + rand(-6, 6), 7, girl.position.z + rand(-6, 6));
  else { const a = rand(0, Math.PI * 2), r = rand(5, FIELD_R - 6); rainCloud.target.set(Math.cos(a) * r, 7, Math.sin(a) * r); }
}
export function girlInCloud() {
  return rainCloud.active &&
    Math.hypot(girl.position.x - rainCloud.g.position.x, girl.position.z - rainCloud.g.position.z) < rainCloud.R;
}
export function updateCloud(dt) {
  if (!rainCloud.active) return;
  tmpA.copy(rainCloud.target).sub(rainCloud.g.position);
  if (tmpA.length() < 1) cloudNewTarget();
  else { tmpA.normalize(); rainCloud.g.position.addScaledVector(tmpA, S.cfg.cloudSpeed * dt); }
  rainCloud.zone.position.set(rainCloud.g.position.x, 0.028, rainCloud.g.position.z);
  for (const d of rainCloud.drops) {
    d.position.y -= 9 * dt;
    if (d.position.y < 0.3) {
      d.position.set(rainCloud.g.position.x + rand(-2.5, 2.5), 6.4, rainCloud.g.position.z + rand(-2.5, 2.5));
    }
  }
}

/* ============================== pickups (clover / heart / gift) ============================== */
export const pickups = [];
export function spawnPickup(type) {
  const spot = freeSpot(4, 1.5);
  if (!spot) return;
  const g = new THREE.Group();
  if (type === 'clover') {
    const m = lam(0x4fae5c, { emissive: 0x0a3a14 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m);
      leaf.position.set(Math.cos(a) * 0.13, 0.55, Math.sin(a) * 0.13);
      leaf.scale.set(1, 0.4, 1); g.add(leaf);
    }
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), stemMat);
    st.position.y = 0.27; g.add(st);
  } else if (type === 'heart') {
    const m = lam(0xff6fa5, { emissive: 0x4a1228 });
    [-1, 1].forEach(s => {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), m);
      lobe.position.set(s * 0.1, 0.72, 0); g.add(lobe);
    });
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 4), m);
    tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4;
    tip.position.y = 0.52; g.add(tip);
  } else { // gift box 🎁
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), lam(0xff8fb7, { emissive: 0x3a1020 }));
    box.position.y = 0.45; g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.48), lam(0xc9a0ff));
    lid.position.y = 0.66; g.add(lid);
    const ribbonV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, 0.44), lam(0xfff3b0));
    ribbonV.position.y = 0.48; g.add(ribbonV);
    const ribbonH = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.1), lam(0xfff3b0));
    ribbonH.position.y = 0.48; g.add(ribbonH);
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), lam(0xfff3b0));
    bow.position.y = 0.76; bow.scale.set(1.4, 0.7, 1.4); g.add(bow);
  }
  const ring = new THREE.Mesh(GEO.ring, bas(type === 'clover' ? 0xa0e8a0 : type === 'heart' ? 0xffc9e8 : 0xfff3b0,
    { transparent: true, opacity: 0.25, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; g.add(ring);
  g.position.set(spot.x, 0, spot.z);
  g.scale.setScalar(0.001);
  scene.add(g);
  pickups.push({ g, type, born: S.gameT, popK: 0, phase: rand(0, 9) });
}
export function removePickup(p) {
  scene.remove(p.g);
  pickups.splice(pickups.indexOf(p), 1);
}
export function clearPickups() { while (pickups.length) removePickup(pickups[0]); }

/* ============================== butterfly ============================== */
export const butterfly = (() => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 6), lam(0x7a5fb0));
  body.rotation.x = Math.PI / 2; g.add(body);
  const wingMat = lam(0xff9ed2, { side: THREE.DoubleSide, emissive: 0x551a3a });
  const wings = [];
  [-1, 1].forEach(s => {
    const piv = new THREE.Group();
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.24, 12), wingMat);
    w.rotation.x = -Math.PI / 2; w.scale.set(1, 1, 1.5); w.position.x = s * 0.2; piv.add(w);
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), wingMat);
    w2.rotation.x = -Math.PI / 2; w2.position.set(s * 0.14, 0.005, -0.22); piv.add(w2);
    g.add(piv); wings.push(piv);
  });
  g.visible = false; scene.add(g);
  return { g, wings, active: false, from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur: 9 };
})();
export function spawnButterfly() {
  const a = rand(0, Math.PI * 2);
  butterfly.from.set(Math.cos(a) * (FIELD_R - 1), 1.2, Math.sin(a) * (FIELD_R - 1));
  const a2 = a + Math.PI + rand(-0.9, 0.9);
  butterfly.to.set(Math.cos(a2) * (FIELD_R - 1), 1.2, Math.sin(a2) * (FIELD_R - 1));
  butterfly.t = 0; butterfly.dur = rand(11, 14);
  butterfly.active = true; butterfly.g.visible = true;
  butterfly.g.position.copy(butterfly.from);
}
export function hideButterfly() { butterfly.active = false; butterfly.g.visible = false; }

/* ============================== crow (flower thief) ============================== */
export const crow = (() => {
  const g = new THREE.Group();
  const dark = lam(0x3a3f4a);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), dark);
  body.scale.z = 1.35; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), dark);
  head.position.set(0, 0.16, 0.38); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 8), lam(0xff9430));
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.14, 0.6); g.add(beak);
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), bas(0xffe066));
    eye.position.set(s * 0.09, 0.24, 0.48); g.add(eye);
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 6), dark);
  tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.05, -0.5); tail.scale.y = 0.5; g.add(tail);
  const wings = [];
  [-1, 1].forEach(s => {
    const piv = new THREE.Group(); piv.position.set(s * 0.12, 0.1, 0);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.3), dark);
    w.position.x = s * 0.32; piv.add(w);
    g.add(piv); wings.push(piv);
  });
  g.visible = false; scene.add(g);
  return { g, wings, shadow: makeBlobShadow(0.34), active: false, state: 'fly',
    target: null, exit: new THREE.Vector3(), faceA: 0 };
})();
crow.shadow.visible = false;
export function crowEnter() {
  const open = openFlowers();
  if (!open.length) return;
  crow.active = true; crow.g.visible = true; crow.shadow.visible = true;
  crow.state = 'fly';
  crow.target = choice(open);
  const a = rand(0, Math.PI * 2);
  crow.g.position.set(Math.cos(a) * (FIELD_R + 8), 6, Math.sin(a) * (FIELD_R + 8));
  crow.exit.set(Math.cos(a + Math.PI + rand(-0.6, 0.6)) * (FIELD_R + 10), 6, Math.sin(a + Math.PI + rand(-0.6, 0.6)) * (FIELD_R + 10));
  sfx.crow();
}
export function crowHide() {
  if (crow.active && crow.state === 'carry' && crow.target && flowers.includes(crow.target)) {
    crow.target.carried = false;
  }
  crow.active = false; crow.g.visible = false; crow.shadow.visible = false; crow.target = null;
}
export function crowDrop() {
  if (crow.state !== 'carry' || !crow.target || !flowers.includes(crow.target)) return false;
  const f = crow.target;
  f.carried = false;
  let x = clamp(crow.g.position.x, -FIELD_R + 2, FIELD_R - 2);
  let z = clamp(crow.g.position.z, -FIELD_R + 2, FIELD_R - 2);
  const pos = { x, z };
  const ob = inObstacle(x, z);
  if (ob) { pushOut(pos, ob); x = pos.x; z = pos.z; }
  f.g.position.set(x, 0, z);
  f.born = S.gameT - f.lifespan * 0.2; // give it some life back
  f.ageBoost = 0;
  crow.target = null;
  crow.state = 'fleeUp';
  S.score += 10; S.hudDirty = true;
  floatText(crow.g.position.clone(), '+10 😤', 'gold');
  sfx.swatHit();
  return true;
}
export function updateCrow(dt) {
  if (!crow.active) return;
  const flap = Math.sin(S.animT * 16) * 0.7;
  crow.wings[0].rotation.z = flap; crow.wings[1].rotation.z = -flap;
  let target = null, speed = 6;
  if (crow.state === 'fly') {
    if (!crow.target || !flowers.includes(crow.target) || crow.target.picked || crow.target.carried) {
      const open = openFlowers();
      if (!open.length) { crow.state = 'fleeUp'; }
      else crow.target = choice(open);
    }
    if (crow.state === 'fly' && crow.target) {
      target = tmpB.set(crow.target.g.position.x, 1.0, crow.target.g.position.z);
      const d = crow.g.position.distanceTo(target);
      if (d < 0.6) {
        crow.target.carried = true;
        crow.state = 'carry';
        sfx.crow();
        floatText(crow.g.position.clone().setY(1.6), 'mine! 🐦‍⬛', 'bad');
      }
    }
  }
  if (crow.state === 'carry') {
    target = tmpB.copy(crow.exit);
    speed = 5;
    if (crow.target && flowers.includes(crow.target)) {
      crow.target.g.position.set(crow.g.position.x, Math.max(0, crow.g.position.y - 0.9), crow.g.position.z);
    }
    if (Math.hypot(crow.g.position.x, crow.g.position.z) > FIELD_R + 7) {
      if (crow.target && flowers.includes(crow.target)) removeFlower(crow.target);
      crow.target = null;
      crowHide();
      return;
    }
  } else if (crow.state === 'fleeUp') {
    target = tmpB.copy(crow.exit); target.y = 9;
    speed = 8;
    if (Math.hypot(crow.g.position.x, crow.g.position.z) > FIELD_R + 7) { crowHide(); return; }
  }
  if (target) {
    tmpA.copy(target).sub(crow.g.position);
    const d = tmpA.length();
    if (d > 0.05) {
      tmpA.normalize();
      crow.g.position.addScaledVector(tmpA, Math.min(speed * dt, d));
      crow.faceA = lerpAngle(crow.faceA, Math.atan2(tmpA.x, tmpA.z), 1 - Math.exp(-7 * dt));
      crow.g.rotation.y = crow.faceA;
    }
  }
  crow.shadow.position.set(crow.g.position.x, 0.027, crow.g.position.z);
}
