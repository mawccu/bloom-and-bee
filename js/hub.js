import * as THREE from 'three';
import { lam, bas, std, $, rand, choice, lerpAngle } from './utils.js';
import { S } from './state.js';
import { scene, SKIES, paintSky } from './engine.js';
import { girl, girlRefs } from './characters.js';
import { sfx, initAudio } from './audio.js';
import { inputVec, hideJoy, showFixedJoy } from './input.js';
import { startGame, camFocus } from './gameplay.js';
import { onEnterShop, onExitShop, updateShopProximity } from './shop.js';
import { SHOP_OBSTACLES, HOUSE_OBSTACLES, resolveObstacles } from './world.js';
import { loadModel } from './models.js';
import { enterHouseInterior } from './house.js';

/* ============================== overworld hub ==============================
   A cute little walkable town square (far from the meadow at origin, the house
   interior at z=300 and the shop room at z=220) with three labelled entrances:
   Meadow gate / House / Shop. Same controls + follow camera as the meadow. */
const HUB_ORIGIN = new THREE.Vector3(-300, 0, 0);
const HUB_R = 18;
const SHOP_ORIGIN = new THREE.Vector3(-300, 0, 220);
const SHOP_R = 9;
const WALK_SPEED = 7;
const O = HUB_ORIGIN;

/* SVG icon helpers for hub prompt labels (no emoji — consistent with Phase 6 icon pass) */
const _svgLeaf  = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="flex-shrink:0"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-11 5"/></svg>`;
const _svgBag   = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="flex-shrink:0"><path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z"/></svg>`;
const _svgHome  = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="flex-shrink:0"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;

// the three entrances (world coords); buildings sit to the north, she spawns south
// x-offsets kept to ±7 so all buildings are within the camera FOV from the spawn point
const BUILDINGS = [
  { key: 'garden', label: _svgLeaf + ' Enter the Garden',      x: O.x - 11, z: O.z - 12 },
  { key: 'shop',   label: _svgBag  + ' Enter the Shop',        x: O.x,      z: O.z - 13 },
  { key: 'house',  label: _svgHome + " Enter Ranooma's House", x: O.x + 11, z: O.z - 12 },
];

const HUB_OBSTACLES = [
  { x: O.x - 11, z: O.z - 12, rx: 3.2, rz: 1.4 },  // garden gate
  { x: O.x,      z: O.z - 13, rx: 3.0, rz: 2.6 },  // shop front
  { x: O.x + 11, z: O.z - 12, rx: 2.8, rz: 2.6 },  // ranooma's house
  { x: O.x,      z: O.z,      rx: 1.9, rz: 1.9 },  // fountain
];

/* ---------- little prop helpers ---------- */
function makeTree(G, x, z, s = 1) {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.3, 7), lam(0x9a6b4f));
  trunk.position.y = 0.65; t.add(trunk);
  [[0, 1.8, 0, 1.0], [-0.5, 1.45, 0.2, 0.66], [0.5, 1.5, -0.2, 0.6], [0.1, 2.25, 0.1, 0.55]].forEach(([fx, fy, fz, fr], i) => {
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(fr, 9, 7), lam([0x7ed489, 0x93dd9b, 0x6ecb7d][i % 3]));
    s2.position.set(fx, fy, fz); t.add(s2);
  });
  t.position.set(x, 0, z); t.scale.setScalar(s); G.add(t);
}
function makeBush(G, x, z) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.55, 0.95), 9, 7), lam(choice([0x6fc97c, 0x82d68e, 0x5fbf70])));
  b.position.set(x, 0.42, z); b.scale.y = 0.78; G.add(b);
  if (Math.random() < 0.5) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), lam(choice([0xff9ec6, 0xffd24a, 0xfff3f8])));
    f.position.set(x + rand(-0.3, 0.3), 0.9, z + rand(-0.3, 0.3)); G.add(f);
  }
}
function makeFlowers(G, x, z, n = 5) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), r = rand(0, 0.8);
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 5), lam(0x5cba6a));
    st.position.set(px, 0.2, pz); G.add(st);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), lam(choice([0xff5e7a, 0xffd24a, 0xc9a0ff, 0xff9430, 0x8fc9ff])));
    fl.position.set(px, 0.45, pz); fl.scale.set(1, 0.7, 1); G.add(fl);
  }
}
function makeRock(G, x, z) {
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.25, 0.5), 0), lam(0xc8cdd6));
  r.position.set(x, 0.12, z); r.scale.y = 0.62; r.rotation.y = rand(0, 3); G.add(r);
}
function makeLamp(G, x, z) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.5, 7), lam(0x57606e));
  post.position.set(x, 1.25, z); G.add(post);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 8), lam(0x434b58));
  cap.position.set(x, 2.7, z); G.add(cap);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), bas(0xffe6a0, { transparent: true, opacity: 0.95, fog: false }));
  bulb.position.set(x, 2.45, z); G.add(bulb);
}
function makePath(G, x1, z1, x2, z2, w = 1.7) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  const seg = new THREE.Mesh(new THREE.PlaneGeometry(w, len), lam(0xe7d6ad));
  seg.rotation.x = -Math.PI / 2; seg.rotation.z = -Math.atan2(dz, dx) + Math.PI / 2;
  seg.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2); G.add(seg);
}
/* -------- 3-D floating canvas-sprite name label -------- */
const floatingLabels = [];
const labelRedraws = [];   // re-rendered once the bundled emoji font has loaded
// 'BloomEmoji' first so emoji come from the bundled Twemoji woff2; "Baloo 2" for the Latin text
const LABEL_FONT = font => `bold ${font}px 'BloomEmoji', "Baloo 2", system-ui, sans-serif`;
function makeFloatingLabel(G, text, color, x, baseY, z) {
  const W = 480, H = 96, PAD = 8, STRIPE = 16;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    // pill background
    ctx.shadowColor = 'rgba(160,90,140,0.38)'; ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.beginPath(); ctx.roundRect(PAD, PAD, W - 2 * PAD, H - 2 * PAD, 26); ctx.fill();
    ctx.shadowBlur = 0;
    // colour top stripe
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.beginPath(); ctx.roundRect(PAD, PAD, W - 2 * PAD, STRIPE, [26, 26, 0, 0]); ctx.fill();
    // auto-fit text so nothing clips
    let fs = 38;
    ctx.font = LABEL_FONT(fs);
    while (ctx.measureText(text).width > W - 52 && fs > 20) { fs -= 2; ctx.font = LABEL_FONT(fs); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6d3f62';
    // dead-centre (both axes) of the white panel below the colour stripe
    ctx.fillText(text, W / 2, (PAD + STRIPE + (H - PAD)) / 2);
    tex.needsUpdate = true;
  };
  draw();
  labelRedraws.push(draw);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const sprite = new THREE.Sprite(mat);
  // keep aspect ratio: sprite width/height = W/H
  sprite.scale.set(5.0, 5.0 * H / W, 1);
  sprite.position.set(x, baseY, z);
  sprite.userData.baseY = baseY;
  G.add(sprite); floatingLabels.push(sprite);
}
// the woff2 isn't ready when the signs are first drawn at module load — re-render
// them with the real emoji glyphs as soon as the font finishes loading.
if (document.fonts && document.fonts.load) {
  document.fonts.load("38px 'BloomEmoji'", '🛍️🏠🌼')
    .then(() => { labelRedraws.forEach(fn => fn()); })
    .catch(() => {});
}
function makeBeacon(G, color, x, baseY, z) {
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0),
    bas(color, { transparent: true, opacity: 0.92, fog: false }));
  beacon.position.set(x, baseY, z);
  beacon.userData.baseY = baseY;
  G.add(beacon); beacons.push(beacon);
}

const beacons = [];
let fountainWater = null;
function buildHub() {
  const G = new THREE.Group(); scene.add(G);

  // layered ground: big grass disc + a couple of softer patches
  const ground = new THREE.Mesh(new THREE.CircleGeometry(HUB_R + 9, 56), lam(0x6aaa58));
  ground.rotation.x = -Math.PI / 2; ground.position.set(O.x, 0, O.z);
  ground.receiveShadow = true; G.add(ground);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(HUB_R + 1, 48), lam(0x7ec468));
  inner.rotation.x = -Math.PI / 2; inner.position.set(O.x, 0.01, O.z);
  inner.receiveShadow = true; G.add(inner);
  [[O.x - 7, O.z + 5, 0x88cc72], [O.x + 8, O.z + 4, 0x78bc60], [O.x + 2, O.z - 4, 0x90d07a]].forEach(([px, pz, c]) => {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(rand(3, 4.5), 20), lam(c));
    patch.rotation.x = -Math.PI / 2; patch.position.set(px, 0.015, pz);
    patch.receiveShadow = true; G.add(patch);
  });

  // central plaza + fountain
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.2, 36), lam(0xd4c090));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(O.x, 0.02, O.z);
  plaza.receiveShadow = true; G.add(plaza);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.55, 20), lam(0xa8b4be));
  rim.position.set(O.x, 0.27, O.z); rim.castShadow = true; rim.receiveShadow = true; G.add(rim);
  fountainWater = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshStandardMaterial({ color: 0x5ac9e8, roughness: 0.05, metalness: 0.3 }));
  fountainWater.rotation.x = -Math.PI / 2; fountainWater.position.set(O.x, 0.5, O.z); G.add(fountainWater);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 8), lam(0xcdd3da));
  spout.position.set(O.x, 1.0, O.z); G.add(spout);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), bas(0xbfeaf5, { transparent: true, opacity: 0.85 }));
  top.position.set(O.x, 1.7, O.z); G.add(top);

  // paths from the plaza to each entrance, with a lamp post beside each.
  // Each path leaves the plaza RIM along its own heading (not the shared fountain
  // centre) so the three routes fan out as clearly separate strips instead of
  // bunching into one overlapping wedge at the middle.
  const PLAZA_RIM = 3.4;
  BUILDINGS.forEach(b => {
    const ex = b.x, ez = b.z + 1.6;                 // path end, just in front of the building
    const dx = ex - O.x, dz = ez - O.z, len = Math.hypot(dx, dz) || 1;
    const ux = dx / len, uz = dz / len;             // unit heading toward the building
    const sx = O.x + ux * PLAZA_RIM, sz = O.z + uz * PLAZA_RIM;   // start at the plaza rim
    makePath(G, sx, sz, ex, ez, 1.5);
    // lamp offset perpendicular to the path so the post sits beside it, not on it
    makeLamp(G, (sx + ex) / 2 - uz * 1.7, (sz + ez) / 2 + ux * 1.7);
  });

  // a low picket fence around the rim
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const px = O.x + Math.cos(a) * (HUB_R + 1.5), pz = O.z + Math.sin(a) * (HUB_R + 1.5);
    // leave a gap on the south side where she spawns
    if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.45) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, 0.15), lam(0xf0ddc8));
    post.position.set(px, 0.5, pz); post.rotation.y = a; G.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.18, 4), lam(0xffc8e0));
    cap.position.set(px, 1.09, pz); cap.rotation.y = a; G.add(cap);
  }
  // Fence top rail — a thin torus ring at the top of the posts
  const fenceRail = new THREE.Mesh(new THREE.TorusGeometry(HUB_R + 1.5, 0.07, 7, 56), lam(0xe8d0b8));
  fenceRail.rotation.x = -Math.PI / 2; fenceRail.position.set(O.x, 0.72, O.z); G.add(fenceRail);

  // scattered greenery — no rocks in the cute garden hub, only bushes & flowers
  for (let i = 0; i < 28; i++) {
    const a = rand(0, Math.PI * 2), r = rand(7, HUB_R - 0.5);
    const px = O.x + Math.cos(a) * r, pz = O.z + Math.sin(a) * r;
    if (Math.random() < 0.44) makeBush(G, px, pz);
    else makeFlowers(G, px, pz, 4 + (Math.random() * 4 | 0));
  }
  // perimeter trees
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand(-0.1, 0.1);
    makeTree(G, O.x + Math.cos(a) * (HUB_R + 4), O.z + Math.sin(a) * (HUB_R + 4), rand(1.0, 1.6));
  }

  // Garden gate — improved primitive (permanent, no GLB swap)
  buildGardenGate(G, BUILDINGS[0]);
  // Shop — primitive first, then GLB swap
  const primShopGrp = new THREE.Group(); G.add(primShopGrp);
  buildShopFront(primShopGrp, BUILDINGS[1]);
  // Shop label/beacon live on G directly so they survive the GLB swap.
  // Heights match the other buildings (garden 9.2/8.2, house 8.2/7.5) so the sign
  // floats clearly above the shop roof / GLB instead of being hidden inside it.
  makeBeacon(G, 0x5aa8f0, BUILDINGS[1].x, 8.4, BUILDINGS[1].z);
  makeFloatingLabel(G, 'The Shop', 0x5aa8f0, BUILDINGS[1].x, 7.6, BUILDINGS[1].z);
  // House — primitive only
  buildCottage(G, BUILDINGS[2]);

  G.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  // Progressive GLB upgrade for shop only
  loadModel('shop_front.glb').then(m => {
    m.position.set(BUILDINGS[1].x, 0, BUILDINGS[1].z);
    m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    G.remove(primShopGrp); G.add(m);
  }).catch(() => {});

  // GLB fountain replaces inline primitives
  _swapFountainGLB(G);

  // Primitive benches around the plaza
  _makeBenches(G);
}

/* ---------- the two entrance buildings ---------- */
function buildGardenGate(G, b) {
  const px = b.x, pz = b.z;
  const GW = 2.6;  // half post-gap
  const PH = 5.4;  // post height

  // Outer hedge only (away from shop center) — keeps path to shop visually open
  [-(GW + 1.3)].forEach(sx => {
    const side = sx < 0 ? -1 : 1;
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 2.0), lam(0x4cb85a));
    hedge.position.set(px + sx, 1.25, pz); G.add(hedge);
    const hTop = new THREE.Mesh(new THREE.SphereGeometry(1.0, 9, 8), lam(0x5cc864));
    hTop.position.set(px + sx, 2.7, pz); G.add(hTop);
    for (let fi = 0; fi < 4; fi++) {
      const hfl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5),
        lam(choice([0xff8fb7, 0xffd24a, 0xffffff, 0xffb4d4])));
      hfl.position.set(px + sx + rand(-0.5, 0.5), 1.4 + rand(0, 1.2), pz + 0.75 * side); G.add(hfl);
    }
  });

  // Posts — thick green cylinders with pink sphere caps
  [-GW, GW].forEach(s => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.40, PH, 10), lam(0x5cc870));
    post.position.set(px + s, PH / 2, pz); G.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 9, 8), lam(0xff9ec6));
    cap.position.set(px + s, PH + 0.24, pz); G.add(cap);
    // Vines
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.19, 6, 4), lam(0x3aaa4a));
      leaf.position.set(px + s + (i % 2 ? 0.32 : -0.32), 0.7 + i * 0.8, pz + 0.12); G.add(leaf);
    }
  });

  // Main arch — thick half-torus in XY plane (face-on from south)
  const arch = new THREE.Mesh(new THREE.TorusGeometry(GW, 0.44, 12, 28, Math.PI), lam(0x48b858));
  arch.position.set(px, PH, pz); G.add(arch);

  // Flower garland along the arch
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, ang = Math.PI * t;
    const fx = px - Math.cos(ang) * GW, fy = PH + Math.sin(ang) * GW;
    const r = i === 7 ? 0.32 : 0.22;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7),
      lam(choice([0xff8fb7, 0xffd24a, 0xc9a0ff, 0xff7a9c, 0xffffff, 0xff9ec6])));
    fl.position.set(fx, fy, pz); G.add(fl);
  }

  // Ground flower beds fanning out from the gate
  for (let i = 0; i < 8; i++) makeFlowers(G, px - 2.8 + i * 0.8, pz - 1.8, 3);

  makeBeacon(G, 0x5cc870, px, 9.2, pz);
  makeFloatingLabel(G, 'The Garden', 0x5cc870, px, 8.2, pz);
}

function buildShopFront(G, b) {
  // bigger shop — 5.2 wide × 3.4 tall × 4.2 deep
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 4.2), lam(0xc8dff5));
  base.position.set(b.x, 1.7, b.z); G.add(base);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.52, 4.8), lam(0x5aa8f0));
  roof.position.set(b.x, 3.66, b.z); G.add(roof);
  // striped awning — wider, sits below roof overhang
  for (let i = 0; i < 8; i++) {
    const aw = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 1.1), lam(i % 2 ? 0xffffff : 0xff7a8c));
    aw.position.set(b.x - 2.03 + i * 0.58, 3.05, b.z + 2.26); aw.rotation.x = 0.42; G.add(aw);
  }
  // door
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.14), lam(0x3d7fc4));
  door.position.set(b.x, 1.2, b.z + 2.11); G.add(door);
  const dTop = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 5, 0, Math.PI), lam(0x5aa8f0));
  dTop.rotation.z = Math.PI; dTop.position.set(b.x, 2.4, b.z + 2.11); G.add(dTop);
  // windows
  [-1.65, 1.65].forEach(x => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.12), lam(0xffffff));
    frame.position.set(b.x + x, 2.2, b.z + 2.12); G.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.13), std(0xaeeeff, 0.04, 0.15, { transparent: true, opacity: 0.7 }));
    glass.position.set(b.x + x, 2.2, b.z + 2.13); G.add(glass);
  });
}

function buildCottage(G, b) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.2, 4.2), lam(0xfff0dc));
  base.position.set(b.x, 1.6, b.z); G.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.6, 4), lam(0xff9ec6));
  roof.position.set(b.x, 4.5, b.z); roof.rotation.y = Math.PI / 4; G.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), lam(0xd8a07a));
  chimney.position.set(b.x + 1.2, 5.2, b.z - 0.4); G.add(chimney);
  const chimTop = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.85), lam(0xb87a5a));
  chimTop.position.set(b.x + 1.2, 5.95, b.z - 0.4); G.add(chimTop);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.14), lam(0xb97a4e));
  door.position.set(b.x, 1.2, b.z + 2.11); G.add(door);
  const arch = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 5, 0, Math.PI), lam(0xd49a66));
  arch.rotation.z = Math.PI; arch.position.set(b.x, 2.4, b.z + 2.11); G.add(arch);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), lam(0xffd24a));
  knob.position.set(b.x + 0.45, 1.3, b.z + 2.18); G.add(knob);
  [-1.55, 1.55].forEach(x => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.12), lam(0xffffff));
    frame.position.set(b.x + x, 2.3, b.z + 2.12); G.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.84, 0.13), std(0xaeeeff, 0.04, 0.15, { transparent: true, opacity: 0.7 }));
    glass.position.set(b.x + x, 2.3, b.z + 2.14); G.add(glass);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 0.28), lam(0xb97a4e));
    box.position.set(b.x + x, 1.62, b.z + 2.18); G.add(box);
    for (let i = -1; i <= 1; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), lam(choice([0xff8fb7, 0xffd24a, 0xc9a0ff])));
      fl.position.set(b.x + x + i * 0.3, 1.8, b.z + 2.2); G.add(fl);
    }
  });
  makeBeacon(G, 0xff9ec6, b.x, 8.2, b.z);
  makeFloatingLabel(G, "Ranooma's House", 0xff9ec6, b.x, 7.5, b.z);
}

/* ---------- GLB swap helpers ---------- */
function _swapFountainGLB(G) {
  loadModel('fountain.glb').then(m => {
    m.position.set(O.x, 0, O.z);
    m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    // hide primitive fountain parts tracked by fountainWater
    if (fountainWater) { fountainWater.visible = false; }
    G.add(m);
  }).catch(() => {});
}

const BENCH_SPOTS = [
  [O.x - 5,   O.z + 3.5, Math.PI],      // south-left  → face north
  [O.x + 5,   O.z + 3.5, Math.PI],      // south-right → face north
  [O.x - 3.5, O.z - 5,   0],            // north-left  → face south
  [O.x + 3.5, O.z - 5,   0],            // north-right → face south
];
function _makeBenches(G) {
  BENCH_SPOTS.forEach(([bx, bz, ry]) => {
    const bg = new THREE.Group();
    bg.position.set(bx, 0, bz);
    bg.rotation.y = ry;
    // seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.13, 0.62), lam(0xc98a4b));
    seat.position.y = 0.58; bg.add(seat);
    // back rest
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.48, 0.11), lam(0xc98a4b));
    back.position.set(0, 0.87, -0.27); bg.add(back);
    // four legs
    [[-0.82, -0.22], [-0.82, 0.22], [0.82, -0.22], [0.82, 0.22]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.58, 0.11), lam(0xa06838));
      leg.position.set(lx, 0.29, lz); bg.add(leg);
    });
    bg.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    G.add(bg);
  });
}

buildHub();

/* ---------- shop room interior ---------- */
function buildShopRoom() {
  const G = new THREE.Group(); scene.add(G);
  G.add(new THREE.HemisphereLight(0xfff2e4, 0xd0b0ff, 1.6));
  // warm overhead point lights
  [-5, 5].forEach(ox => {
    const pl = new THREE.PointLight(0xffe0b0, 1.2, 18);
    pl.position.set(SHOP_ORIGIN.x + ox, 4.8, SHOP_ORIGIN.z - 3);
    G.add(pl);
  });

  // Floor — cream tiles
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20), lam(0xf0e6ce));
  floor.position.set(SHOP_ORIGIN.x, -0.1, SHOP_ORIGIN.z); G.add(floor);
  // Tile grout lines
  for (let i = -4; i <= 4; i++) {
    const gr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.21, 20), lam(0xd8cbb0));
    gr.position.set(SHOP_ORIGIN.x + i * 2.2, 0, SHOP_ORIGIN.z); G.add(gr);
    const gz = new THREE.Mesh(new THREE.BoxGeometry(20, 0.21, 0.04), lam(0xd8cbb0));
    gz.position.set(SHOP_ORIGIN.x, 0, SHOP_ORIGIN.z + i * 2.2); G.add(gz);
  }

  // Walls
  const wMat = lam(0xfdf0ff);
  const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wMat); m.position.set(SHOP_ORIGIN.x + x, y, SHOP_ORIGIN.z + z); G.add(m); };
  wall(20, 5.5, 0.35,  0, 2.75, -10);   // back
  wall(0.35, 5.5, 20, -10, 2.75,  0);   // left
  wall(0.35, 5.5, 20,  10, 2.75,  0);   // right
  // Baseboard trim
  wall(20, 0.22, 0.2,  0, 0.11, -9.85);
  wall(0.2, 0.22, 20, -9.85, 0.11, 0);
  wall(0.2, 0.22, 20,  9.85, 0.11, 0);
  // Wall colour stripe
  wall(20, 0.4, 0.3,  0, 4.5, -9.85);
  wall(0.3, 0.4, 20, -9.85, 4.5, 0);
  wall(0.3, 0.4, 20,  9.85, 4.5, 0);

  // Counter (wide, further north)
  const ctr = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 2.0), lam(0xb87340));
  ctr.position.set(SHOP_ORIGIN.x, 0.6, SHOP_ORIGIN.z - 6); G.add(ctr);
  // Counter top slab
  const ctrTop = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.14, 2.4), lam(0xd4a060));
  ctrTop.position.set(SHOP_ORIGIN.x, 1.27, SHOP_ORIGIN.z - 6); G.add(ctrTop);
  // Register
  const reg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), lam(0xff7a8c));
  reg.position.set(SHOP_ORIGIN.x + 2.4, 1.67, SHOP_ORIGIN.z - 6); G.add(reg);
  const regScr = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.1), bas(0x3a4050));
  regScr.position.set(SHOP_ORIGIN.x + 2.4, 2.08, SHOP_ORIGIN.z - 5.55); G.add(regScr);
  // Flowers on counter
  for (let fx = -2; fx <= 2; fx += 2) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), lam(0x5cba6a));
    stem.position.set(SHOP_ORIGIN.x + fx, 1.55, SHOP_ORIGIN.z - 5.2); G.add(stem);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), lam(choice([0xff8fb7, 0xffd24a, 0xc9a0ff])));
    fl.position.set(SHOP_ORIGIN.x + fx, 1.72, SHOP_ORIGIN.z - 5.2); G.add(fl);
  }

  // Side shelves — tall, full of items
  const itemCols = [0xff8fb7, 0xffd24a, 0x8fc9ff, 0x9fe6b8, 0xc9a0ff, 0xff9430];
  for (let s = -1; s <= 1; s += 2) {
    // Shelf unit back panel
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 9), lam(0xc9a0ff));
    back.position.set(SHOP_ORIGIN.x + s * 8.7, 2.1, SHOP_ORIGIN.z - 1.5); G.add(back);
    // Three shelf boards
    for (let row = 0; row < 4; row++) {
      const sb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 9), lam(0xb08fd8));
      sb.position.set(SHOP_ORIGIN.x + s * 8.35, 0.6 + row * 1.0, SHOP_ORIGIN.z - 1.5); G.add(sb);
      // Items on each shelf
      for (let col = -3; col <= 3; col++) {
        if (Math.random() < 0.7) {
          const gi = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), lam(itemCols[(row * 4 + col + 6) % itemCols.length]));
          gi.position.set(SHOP_ORIGIN.x + s * 8.0, 0.92 + row * 1.0, SHOP_ORIGIN.z - 1.5 + col * 1.2); G.add(gi);
        }
      }
    }
  }

  // Back wall display — hanging items
  for (let hx = -3; hx <= 3; hx += 2) {
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), lam(0xb87340));
    hook.position.set(SHOP_ORIGIN.x + hx, 4.0, SHOP_ORIGIN.z - 9.7); G.add(hook);
    const hang = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.1), lam(itemCols[(hx + 4) % itemCols.length]));
    hang.position.set(SHOP_ORIGIN.x + hx, 3.45, SHOP_ORIGIN.z - 9.7); G.add(hang);
  }

  // Decorative back wall sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 0.14), lam(0xffd24a));
  sign.position.set(SHOP_ORIGIN.x, 3.0, SHOP_ORIGIN.z - 9.82); G.add(sign);
  const signInner = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.7, 0.1), lam(0xff9ec6));
  signInner.position.set(SHOP_ORIGIN.x, 3.0, SHOP_ORIGIN.z - 9.76); G.add(signInner);

  // Ceiling lamp fixtures
  for (let lx = -4; lx <= 4; lx += 4) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 7), lam(0xb0a090));
    rod.position.set(SHOP_ORIGIN.x + lx, 5.15, SHOP_ORIGIN.z - 2); G.add(rod);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 10, 1, true), lam(0xffd24a, { side: THREE.DoubleSide }));
    shade.position.set(SHOP_ORIGIN.x + lx, 4.58, SHOP_ORIGIN.z - 2); G.add(shade);
  }

  // Entry mat
  const mat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.07, 1.8), lam(0xff9ec6));
  mat.position.set(SHOP_ORIGIN.x, 0.04, SHOP_ORIGIN.z + 7.5); G.add(mat);
}
buildShopRoom();

/* ---------- walking + proximity ---------- */
function walkWorld(dt, cx, cz, R, obstacles) {
  let ix, iy;
  if (S.autoWalk) {
    const dx = S.autoWalk.x - girl.position.x, dz = S.autoWalk.z - girl.position.z, d = Math.hypot(dx, dz);
    if (d < 0.12) { ix = 0; iy = 0; } else { ix = dx / d; iy = dz / d; }
  } else {
    [ix, iy] = inputVec();
  }
  const ilen = Math.hypot(ix, iy);
  S.moving = false;
  if (ilen > 0.12) {
    S.moving = true;
    girl.position.x += ix * WALK_SPEED * dt;
    girl.position.z += iy * WALK_SPEED * dt;
    const dx = girl.position.x - cx, dz = girl.position.z - cz, r = Math.hypot(dx, dz);
    if (r > R) { girl.position.x = cx + dx / r * R; girl.position.z = cz + dz / r * R; }
    resolveObstacles(girl.position, obstacles);   // solid furniture: she stops / slides
    girl.rotation.y = lerpAngle(girl.rotation.y, Math.atan2(ix, iy), 1 - Math.exp(-12 * dt));
    S.walkT += dt * (4 + 6 * Math.min(ilen, 1));
  }
}

function hubProximity() {
  if (S.transitioning) return;
  let near = null;
  for (const b of BUILDINGS) {
    if (Math.hypot(girl.position.x - b.x, girl.position.z - b.z) < 4.5) { near = b; break; }
  }
  if (near) {
    if (S.hubTarget !== near.key) {
      S.hubTarget = near.key;
      $('hubPrompt').innerHTML = near.label;
      $('hubPrompt').classList.remove('hidden');
    }
  } else if (S.hubTarget) {
    S.hubTarget = null;
    $('hubPrompt').classList.add('hidden');
  }
}

// called from the main loop while in 'hub' / 'shop' / 'house'
export function updateOverworld(dt) {
  if (S.state === 'hub') { walkWorld(dt, O.x, O.z, HUB_R, HUB_OBSTACLES); hubProximity(); }
  else if (S.state === 'shop') { walkWorld(dt, SHOP_ORIGIN.x, SHOP_ORIGIN.z, SHOP_R, SHOP_OBSTACLES); updateShopProximity(); }
  else if (S.state === 'house') { const wc = S.walkCenter; if (wc) walkWorld(dt, wc.x, wc.z, S.walkR || 3.4, HOUSE_OBSTACLES); }
  // ambient: spinning beacons + floating label bob + shimmering fountain
  for (const bc of beacons) {
    bc.rotation.y += dt * 1.6;
    bc.position.y = bc.userData.baseY + Math.sin(S.animT * 2.2 + bc.position.x) * 0.22;
  }
  for (const lb of floatingLabels) {
    lb.position.y = lb.userData.baseY + Math.sin(S.animT * 1.4 + lb.position.x * 0.7) * 0.18;
  }
  if (fountainWater) fountainWater.material.opacity = 1;
}

/* ---------- fade transition helper ---------- */
export function fadeTransition(midFn, ms = 380) {
  S.transitioning = true;
  const f = $('fade'); f.classList.add('show');
  setTimeout(() => {
    try { midFn(); } catch (e) { console.error('transition error', e); }
    S.transitioning = false;
    // let the swapped scene render one frame under the cover, then fade back in
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('show')));
  }, ms);
}

/* ---------- transitions ---------- */
function hideMeadowHud() {
  ['hud', 'mini', 'swatBtn', 'sprintBtn', 'stamWrap', 'kissBtn', 'hint',
   'housePrompt', 'exitHouseBtn', 'interiorHint',
   'decorBtn', 'decorPanel', 'decorDoneBtn'].forEach(id => $(id).classList.add('hidden'));
}
function hideScreens() {
  ['titleScreen', 'levelScreen', 'overScreen', 'pauseScreen', 'malekWin', 'saveModal']
    .forEach(id => $(id).classList.add('hidden'));
}

export function enterHub() {
  S.state = 'hub';
  S.insideHouse = false;
  S.ultActive = false;
  S.autoWalk = null;
  S.tapTarget = null;
  // clear any lingering bee-sting state so the menu/hub is visually clean (no dizzy
  // stars, body wobble or camera shake carrying over from a stung game-over)
  S.stunned = 0; S.shake = 0; S.invuln = 0;
  S.walkCenter = { x: O.x, z: O.z }; S.walkR = HUB_R;
  girl.position.set(O.x, 0, O.z + 8); girl.rotation.set(0, Math.PI, 0); girl.visible = true;
  girl.rotation.z = 0;
  if (girlRefs.stars) girlRefs.stars.visible = false;
  girlRefs.bubble.visible = false;
  camFocus.copy(girl.position);
  paintSky(SKIES.morning);
  hideScreens();
  hideMeadowHud();
  $('exitBuildingBtn').classList.add('hidden');
  $('hubPrompt').classList.add('hidden'); S.hubTarget = null;
  $('hud2').classList.remove('hidden'); // bank chip lives here
  $('malek').classList.remove('show');
  hideJoy();
  if (S.ctrlMode === 'fixed') showFixedJoy();
  S.hudDirty = true;
}

export function enterShop() {
  S.state = 'shop';
  S.autoWalk = null;
  S.tapTarget = null;
  S.walkCenter = { x: SHOP_ORIGIN.x, z: SHOP_ORIGIN.z }; S.walkR = SHOP_R;
  girl.position.set(SHOP_ORIGIN.x, 0, SHOP_ORIGIN.z + 6); girl.rotation.y = Math.PI; girl.visible = true;
  camFocus.copy(girl.position);
  $('hubPrompt').classList.add('hidden'); S.hubTarget = null;
  $('hud2').classList.remove('hidden');
  ['decorBtn', 'decorPanel', 'decorDoneBtn'].forEach(id => $(id).classList.add('hidden'));
  $('exitBuildingBtn').classList.remove('hidden');
  hideJoy();
  if (S.ctrlMode === 'fixed') showFixedJoy();
  sfx.click();
  onEnterShop();
}

export function exitToHub() {
  onExitShop();
  $('exitBuildingBtn').classList.add('hidden');
  sfx.click();
  enterHub();
}

/* ---------- button wiring ---------- */
$('hubPrompt').addEventListener('pointerdown', e => {
  e.preventDefault(); initAudio();
  const t = S.hubTarget;
  $('hubPrompt').classList.add('hidden'); S.hubTarget = null;
  if (t === 'garden') { fadeTransition(() => startGame(S.savedLevel, true)); }
  else if (t === 'shop') { fadeTransition(() => enterShop()); }
  else if (t === 'house') { fadeTransition(() => enterHouseInterior()); }
});
$('exitBuildingBtn').addEventListener('click', () => exitToHub());
