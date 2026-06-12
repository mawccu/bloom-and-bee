import * as THREE from 'three';
import { rand, choice, lam, bas } from './utils.js';
import { scene } from './engine.js';

/* ============================== meadow world ============================== */
export const FIELD_R = 44;
// no-walk / no-spawn zones: ponds (ellipses) + cottage (circle)
export const OBSTACLES = [
  { x: 20, z: -16, rx: 7, rz: 5, pond: true },
  { x: -24, z: -22, rx: 4.5, rz: 3.5, pond: true },
  { x: -26, z: 20, rx: 3.4, rz: 3.4, pond: false },
];
export function inObstacle(x, z, pad = 1.12) {
  for (const o of OBSTACLES) {
    const dx = (x - o.x) / o.rx, dz = (z - o.z) / o.rz;
    if (dx * dx + dz * dz < pad * pad) return o;
  }
  return null;
}
export function pushOut(pos, o, pad = 1.13) {
  const dx = (pos.x - o.x) / o.rx, dz = (pos.z - o.z) / o.rz;
  const d = Math.hypot(dx, dz) || 0.001;
  pos.x = o.x + dx / d * o.rx * pad;
  pos.z = o.z + dz / d * o.rz * pad;
}

/* ---------- interior furniture collision ----------
   Solid ellipse footprints (WORLD coords) for the shop room (SHOP_ORIGIN =
   -300,0,220) and the house interior (INT_ORIGIN = 0,0,300). She slides along /
   is stopped by these just like the meadow ponds. Keep in sync with the meshes
   built in hub.js (buildShopRoom) and house.js (buildInterior). */
export const SHOP_OBSTACLES = [
  { x: -300,    z: 214,   rx: 4.3, rz: 1.3 },  // counter + top slab
  { x: -300,    z: 212.5, rx: 1.0, rz: 1.0 },  // Malek the shopkeeper
  { x: -308.35, z: 218.5, rx: 0.9, rz: 4.7 },  // left shelf unit
  { x: -291.65, z: 218.5, rx: 0.9, rz: 4.7 },  // right shelf unit
];
export const HOUSE_OBSTACLES = [
  { x:  4.8, z: 295.7, rx: 1.6, rz: 2.4 },  // bed (back-right corner)
  { x: -4.8, z: 295.4, rx: 1.7, rz: 1.4 },  // desk + chair (back-left corner)
  { x: -6.4, z: 301.8, rx: 1.2, rz: 0.7 },  // bookshelf (left wall)
];

// push pos out of every furniture ellipse it overlaps (a couple of passes so
// she resolves cleanly even when wedged between two pieces)
export function resolveObstacles(pos, list) {
  if (!list) return;
  for (let pass = 0; pass < 2; pass++) {
    for (const o of list) {
      const dx = (pos.x - o.x) / o.rx, dz = (pos.z - o.z) / o.rz;
      if (dx * dx + dz * dz < 1) pushOut(pos, o, 1.001);
    }
  }
}

scene.add(new THREE.Mesh(new THREE.CircleGeometry(130, 48), lam(0x93d483)).rotateX(-Math.PI / 2));
const playDisc = new THREE.Mesh(new THREE.CircleGeometry(FIELD_R + 2.5, 64), lam(0xa9e394));
playDisc.rotation.x = -Math.PI / 2; playDisc.position.y = 0.01;
scene.add(playDisc);

// ponds + lily pads
for (const o of OBSTACLES) {
  if (!o.pond) continue;
  const rim = new THREE.Mesh(new THREE.CircleGeometry(1, 32), lam(0xd8c8a0));
  rim.scale.set(o.rx + 0.7, o.rz + 0.6, 1);
  rim.rotation.x = -Math.PI / 2; rim.position.set(o.x, 0.02, o.z);
  scene.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 32), lam(0x8fd4e8));
  water.scale.set(o.rx, o.rz, 1);
  water.rotation.x = -Math.PI / 2; water.position.set(o.x, 0.03, o.z);
  scene.add(water);
  for (let i = 0; i < 4; i++) {
    const a = rand(0, Math.PI * 2), r = rand(0.3, 0.75);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(rand(0.35, 0.55), 12), lam(0x55b06a));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(o.x + Math.cos(a) * o.rx * r, 0.05, o.z + Math.sin(a) * o.rz * r);
    scene.add(pad);
    if (i < 2) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lam(0xfff3f8));
      fl.position.copy(pad.position).y = 0.14; scene.add(fl);
    }
  }
}
// duck paddles in the big pond
export const duck = (() => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), lam(0xffe066));
  body.scale.set(1, 0.8, 1.25); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lam(0xffe066));
  head.position.set(0, 0.34, 0.3); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), lam(0xff9430));
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.32, 0.47); g.add(beak);
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), bas(0x3a2a2a));
    eye.position.set(s * 0.09, 0.4, 0.42); g.add(eye);
  });
  g.position.set(OBSTACLES[0].x, 0.18, OBSTACLES[0].z);
  scene.add(g);
  return g;
})();

// Ranooma's cottage 🏡
{
  const o = OBSTACLES[2];
  const c = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 3.6), lam(0xfff0dc));
  base.position.y = 1.3; c.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.2, 4), lam(0xff9ec6));
  roof.position.y = 3.7; roof.rotation.y = Math.PI / 4; c.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), lam(0xd8a07a));
  chimney.position.set(1.1, 4.1, 0.5); c.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.6, 0.12), lam(0xb97a4e));
  door.position.set(0, 0.8, 1.81); c.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), lam(0xffd24a));
  knob.position.set(0.3, 0.8, 1.9); c.add(knob);
  [-1.3, 1.3].forEach(x => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.1), lam(0xffffff));
    frame.position.set(x, 1.55, 1.82); c.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.12), lam(0xafe0f5));
    glass.position.set(x, 1.55, 1.83); c.add(glass);
  });
  // window flower boxes
  [-1.3, 1.3].forEach(x => {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.22), lam(0xb97a4e));
    box.position.set(x, 1.05, 1.9); c.add(box);
    for (let i = -1; i <= 1; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), lam(choice([0xff8fb7, 0xffd24a, 0xc9a0ff])));
      fl.position.set(x + i * 0.26, 1.2, 1.92); c.add(fl);
    }
  });
  c.position.set(o.x, 0, o.z);
  c.lookAt(0, 0, 0);
  scene.add(c);
  // stepping stones toward the meadow
  for (let i = 1; i <= 4; i++) {
    const st = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), lam(0xcfd4dc));
    st.rotation.x = -Math.PI / 2;
    const t = i / 4;
    st.position.set(o.x * (1 - t) + o.x * 0.5 * t - t * 2, 0.02, o.z * (1 - t) + o.z * 0.5 * t);
    st.position.x = o.x - (o.x / Math.hypot(o.x, o.z)) * (3.6 + i * 1.1);
    st.position.z = o.z - (o.z / Math.hypot(o.x, o.z)) * (3.6 + i * 1.1);
    scene.add(st);
  }
}

// tulip garden patch (decorative)
{
  const cx = 12, cz = 28;
  for (let gx = 0; gx < 4; gx++) for (let gz = 0; gz < 3; gz++) {
    const x = cx + gx * 1.1 - 1.65, z = cz + gz * 1.1 - 1.1;
    const tg = new THREE.Group();
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5), lam(0x5cba6a));
    st.position.y = 0.25; tg.add(st);
    const col = choice([0xff5e7a, 0xffd24a, 0xc9a0ff, 0xff9430]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), lam(col));
      p.position.set(Math.cos(a) * 0.07, 0.56, Math.sin(a) * 0.07);
      p.scale.set(0.7, 1.4, 0.7); tg.add(p);
    }
    tg.position.set(x + rand(-0.15, 0.15), 0, z + rand(-0.15, 0.15));
    scene.add(tg);
  }
  for (let i = 0; i < 10; i++) { // little fence posts
    const a = (i / 10) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6), lam(0xd8b48a));
    post.position.set(cx + Math.cos(a) * 3, 0.25, cz + Math.sin(a) * 2.4);
    scene.add(post);
  }
}

// grass tufts
{
  const geo = new THREE.ConeGeometry(0.07, 0.34, 5);
  const inst = new THREE.InstancedMesh(geo, lam(0x76c87e), 700);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const col = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < 700 && guard++ < 5000) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (FIELD_R + 1.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inObstacle(x, z)) continue;
    e.set(rand(-0.2, 0.2), rand(0, Math.PI), rand(-0.2, 0.2)); q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 0.15, z), q, new THREE.Vector3(1, rand(0.7, 1.5), 1));
    inst.setMatrixAt(placed, m);
    inst.setColorAt(placed, col.setHSL(0.33, 0.5, rand(0.45, 0.6)));
    placed++;
  }
  scene.add(inst);
}

// boundary bushes
{
  const bushMat = [lam(0x6fc97c), lam(0x82d68e), lam(0x5fbf70)];
  for (let i = 0; i < 56; i++) {
    const a = (i / 56) * Math.PI * 2 + rand(-0.04, 0.04);
    const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.8, 1.3), 10, 8), choice(bushMat));
    b.position.set(Math.cos(a) * (FIELD_R + 2.3), 0.4, Math.sin(a) * (FIELD_R + 2.3));
    b.scale.y = 0.72; scene.add(b);
    if (Math.random() < 0.5) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), lam(choice([0xff9ec6, 0xfff3f8, 0xffd24a])));
      f.position.copy(b.position); f.position.y += b.scale.y * 1.05; f.position.x += rand(-0.4, 0.4);
      scene.add(f);
    }
  }
}

// trees
function makeTree(x, z, s) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8), lam(0x9a6b4f));
  trunk.position.y = 0.7; t.add(trunk);
  const greens = [0x7ed489, 0x93dd9b, 0x6ecb7d];
  [[0, 1.9, 0, 1.0], [-0.55, 1.55, 0.2, 0.7], [0.5, 1.6, -0.2, 0.65], [0.1, 2.4, 0.1, 0.6]].forEach(([fx, fy, fz, fr], i) => {
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(fr, 10, 8), lam(greens[i % 3]));
    s2.position.set(fx, fy, fz); t.add(s2);
  });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), lam(0xffb7d5));
    const a = Math.random() * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.85, 1.8 + rand(-0.3, 0.6), Math.sin(a) * 0.85);
    t.add(b);
  }
  t.position.set(x, 0, z); t.scale.setScalar(s);
  scene.add(t);
}
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2 + rand(-0.15, 0.15);
  const r = FIELD_R + rand(5, 13);
  makeTree(Math.cos(a) * r, Math.sin(a) * r, rand(1.5, 2.6));
}
[[-18, 10], [-6, -32], [28, 16], [4, 36], [36, -6], [-36, -6]].forEach(([x, z]) => {
  if (!inObstacle(x, z, 1.5)) makeTree(x, z, rand(1.1, 1.5));
});

// mushrooms + rocks
function makeMushroom(x, z) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), lam(0xfff4ea));
  stem.position.y = 0.1; g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xff7d7d));
  cap.position.y = 0.18; g.add(cap);
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), bas(0xffffff));
    const a = rand(0, Math.PI * 2);
    d.position.set(Math.cos(a) * 0.1, 0.28, Math.sin(a) * 0.1); g.add(d);
  }
  g.position.set(x, 0, z); scene.add(g);
}
for (let i = 0; i < 16; i++) {
  const a = rand(0, Math.PI * 2), r = rand(8, FIELD_R - 1);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (!inObstacle(x, z)) makeMushroom(x, z);
}
for (let i = 0; i < 12; i++) {
  const a = rand(0, Math.PI * 2), r = rand(6, FIELD_R - 1);
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (inObstacle(x, z)) continue;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.2, 0.45), 0), lam(0xc8cdd6));
  rock.position.set(x, 0.1, z);
  rock.scale.y = 0.6; rock.rotation.y = rand(0, 3); scene.add(rock);
}

// sky clouds
export const clouds = [];
for (let i = 0; i < 9; i++) {
  const c = new THREE.Group();
  const m = bas(0xffffff, { transparent: true, opacity: 0.92, fog: false });
  const n = 3 + Math.floor(Math.random() * 2);
  for (let j = 0; j < n; j++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(rand(1, 1.8), 10, 8), m);
    p.position.set(j * 1.4 - n * 0.7, rand(-0.2, 0.3), rand(-0.4, 0.4));
    p.scale.y = 0.62; c.add(p);
  }
  c.position.set(rand(-70, 70), rand(16, 26), rand(-65, 12));
  c.userData.speed = rand(0.25, 0.6);
  scene.add(c); clouds.push(c);
}

// smiling sun
{
  const sun = new THREE.Group();
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(3.2, 18, 14), bas(0xffe48a, { fog: false })));
  const face = bas(0x9a6a3a, { fog: false });
  [[-1, 0.5], [1, 0.5]].forEach(([sx, sy]) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), face);
    e.position.set(sx, sy, 3.0); sun.add(e);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 6, 14, Math.PI), face);
  smile.position.set(0, -0.2, 3.0); smile.rotation.z = Math.PI; sun.add(smile);
  [[-1.5, -0.1], [1.5, -0.1]].forEach(([sx, sy]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bas(0xffb38a, { fog: false }));
    b.position.set(sx, sy, 2.95); sun.add(b);
  });
  sun.position.set(-42, 36, -60);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
}

const shadowGeo = new THREE.CircleGeometry(1, 16);
export function makeBlobShadow(scale) {
  const s = new THREE.Mesh(shadowGeo, bas(0x3a7a3a, { transparent: true, opacity: 0.22, depthWrite: false }));
  s.rotation.x = -Math.PI / 2; s.position.y = 0.025; s.scale.setScalar(scale);
  scene.add(s); return s;
}
