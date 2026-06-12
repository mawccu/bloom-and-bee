import * as THREE from 'three';
import { lam, bas, $, rand, choice, lerpAngle } from './utils.js';
import { S } from './state.js';
import { scene, SKIES, paintSky } from './engine.js';
import { girl, girlRefs } from './characters.js';
import { sfx, initAudio } from './audio.js';
import { inputVec, hideJoy, showFixedJoy } from './input.js';
import { startGame, camFocus } from './gameplay.js';
import { enterHouseInterior } from './house.js';
import { onEnterShop, onExitShop, updateShopProximity } from './shop.js';

/* ============================== overworld hub ==============================
   A cute little walkable town square (far from the meadow at origin, the house
   interior at z=300 and the shop room at z=220) with three labelled entrances:
   Meadow gate / House / Shop. Same controls + follow camera as the meadow. */
const HUB_ORIGIN = new THREE.Vector3(-300, 0, 0);
const HUB_R = 18;
const SHOP_ORIGIN = new THREE.Vector3(-300, 0, 220);
const SHOP_R = 6;
const WALK_SPEED = 7;
const O = HUB_ORIGIN;

// the three entrances (world coords); buildings sit to the north, she spawns south
const BUILDINGS = [
  { key: 'meadow', label: '🌼 Enter the Meadow', x: O.x - 11, z: O.z - 8 },
  { key: 'shop',   label: '🛍️ Enter the Shop',   x: O.x,      z: O.z - 13 },
  { key: 'house',  label: '🏠 Enter the House',  x: O.x + 11, z: O.z - 8 },
];
const HOUSE = BUILDINGS[2];

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
function makeSign(G, x, z, color) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), lam(0x9a6b4f));
  pole.position.set(x, 0.75, z + 2.4); G.add(pole);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.12), lam(color));
  board.position.set(x, 1.6, z + 2.4); G.add(board);
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), bas(color, { transparent: true, opacity: 0.92, fog: false }));
  beacon.position.set(x, 3.6, z); G.add(beacon);
  beacons.push(beacon);
}

const beacons = [];
let fountainWater = null;
function buildHub() {
  const G = new THREE.Group(); scene.add(G);
  G.add(new THREE.HemisphereLight(0xeaf6ff, 0xbfe6a8, 1.25));
  const sun = new THREE.DirectionalLight(0xfff2d8, 0.7); sun.position.set(O.x - 10, 18, O.z + 8); G.add(sun);

  // layered ground: big grass disc + a couple of softer patches
  const ground = new THREE.Mesh(new THREE.CircleGeometry(HUB_R + 9, 56), lam(0x93d483));
  ground.rotation.x = -Math.PI / 2; ground.position.set(O.x, 0, O.z); G.add(ground);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(HUB_R + 1, 48), lam(0xa6e394));
  inner.rotation.x = -Math.PI / 2; inner.position.set(O.x, 0.01, O.z); G.add(inner);
  [[O.x - 7, O.z + 5, 0x9bdc86], [O.x + 8, O.z + 4, 0x8fd47e], [O.x + 2, O.z - 4, 0xa9e89a]].forEach(([px, pz, c]) => {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(rand(3, 4.5), 20), lam(c));
    patch.rotation.x = -Math.PI / 2; patch.position.set(px, 0.015, pz); G.add(patch);
  });

  // central plaza + fountain
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.2, 36), lam(0xe9d9b4));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(O.x, 0.02, O.z); G.add(plaza);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.55, 20), lam(0xcdd3da));
  rim.position.set(O.x, 0.27, O.z); G.add(rim);
  fountainWater = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), lam(0x8fd4e8));
  fountainWater.rotation.x = -Math.PI / 2; fountainWater.position.set(O.x, 0.5, O.z); G.add(fountainWater);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 8), lam(0xcdd3da));
  spout.position.set(O.x, 1.0, O.z); G.add(spout);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), bas(0xbfeaf5, { transparent: true, opacity: 0.85 }));
  top.position.set(O.x, 1.7, O.z); G.add(top);

  // paths from the plaza to each entrance, with lamp posts along them
  BUILDINGS.forEach(b => {
    makePath(G, O.x, O.z, b.x, b.z + 1.6);
    makeLamp(G, (O.x + b.x) / 2 + (b.x > O.x ? 1.4 : b.x < O.x ? -1.4 : 1.4), (O.z + b.z) / 2);
  });

  // a low picket fence around the rim
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const px = O.x + Math.cos(a) * (HUB_R + 1.5), pz = O.z + Math.sin(a) * (HUB_R + 1.5);
    // leave a gap on the south side where she spawns
    if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.45) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), lam(0xf3ead6));
    post.position.set(px, 0.45, pz); post.rotation.y = a; G.add(post);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 4), lam(0xffd9ea));
    cap.position.set(px, 0.98, pz); cap.rotation.y = a; G.add(cap);
  }

  // scattered greenery & rocks (kept off the plaza/paths)
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), r = rand(7, HUB_R - 0.5);
    const px = O.x + Math.cos(a) * r, pz = O.z + Math.sin(a) * r;
    const roll = Math.random();
    if (roll < 0.34) makeBush(G, px, pz);
    else if (roll < 0.62) makeFlowers(G, px, pz, 4 + (Math.random() * 4 | 0));
    else makeRock(G, px, pz);
  }
  // perimeter trees
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand(-0.1, 0.1);
    makeTree(G, O.x + Math.cos(a) * (HUB_R + 4), O.z + Math.sin(a) * (HUB_R + 4), rand(1.0, 1.6));
  }

  buildMeadowGate(G, BUILDINGS[0]);
  buildShopFront(G, BUILDINGS[1]);
  buildCottage(G, BUILDINGS[2]);
}

/* ---------- the three entrance buildings ---------- */
function buildMeadowGate(G, b) {
  // a flowery green archway leading out to the meadow
  [-1.6, 1.6].forEach(s => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3, 8), lam(0x7ed489));
    post.position.set(b.x + s, 1.5, b.z); G.add(post);
  });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.24, 8, 16, Math.PI), lam(0x6ecb7d));
  arch.position.set(b.x, 3, b.z); G.add(arch);
  for (let i = 0; i < 9; i++) {
    const t = i / 8, ang = Math.PI * t;
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), lam(choice([0xff8fb7, 0xffd24a, 0xc9a0ff, 0xff7a9c])));
    fl.position.set(b.x - Math.cos(ang) * 1.6, 3 + Math.sin(ang) * 1.6, b.z); G.add(fl);
  }
  // a hint of meadow grass + tulips through the gate
  for (let i = 0; i < 4; i++) makeFlowers(G, b.x - 1 + i * 0.7, b.z - 1.3, 3);
  makeSign(G, b.x, b.z, 0x6ecb7d);
}
function buildShopFront(G, b) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.6, 3), lam(0xeaf4ff));
  base.position.set(b.x, 1.3, b.z); G.add(base);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 3.6), lam(0x5aa8f0));
  roof.position.set(b.x, 2.75, b.z); G.add(roof);
  // striped awning
  for (let i = 0; i < 6; i++) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.9), lam(i % 2 ? 0xffffff : 0xff7a8c));
    a.position.set(b.x - 1.4 + i * 0.56, 2.05, b.z + 1.7); a.rotation.x = 0.42; G.add(a);
  }
  // door + windows
  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.7, 0.12), lam(0x3d7fc4));
  door.position.set(b.x, 0.85, b.z + 1.51); G.add(door);
  [-1.1, 1.1].forEach(x => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), lam(0xbfeaf5));
    w.position.set(b.x + x, 1.5, b.z + 1.52); G.add(w);
  });
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 7), lam(0xffd24a));
  bag.position.set(b.x, 3.5, b.z); G.add(bag); // little shopping-bag marker handled by sign too
  makeSign(G, b.x, b.z, 0x5aa8f0);
}
function buildCottage(G, b) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 3), lam(0xfff0dc));
  base.position.set(b.x, 1.2, b.z); G.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.8, 4), lam(0xff9ec6));
  roof.position.set(b.x, 3.2, b.z); roof.rotation.y = Math.PI / 4; G.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1, 0.45), lam(0xd8a07a));
  chimney.position.set(b.x + 0.9, 3.6, b.z - 0.3); G.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.7, 0.12), lam(0xb97a4e));
  door.position.set(b.x, 0.85, b.z + 1.51); G.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), lam(0xffd24a));
  knob.position.set(b.x + 0.3, 0.85, b.z + 1.58); G.add(knob);
  [-1, 1].forEach(x => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.1), lam(0xffffff));
    frame.position.set(b.x + x, 1.6, b.z + 1.52); G.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.11), lam(0xafe0f5));
    glass.position.set(b.x + x, 1.6, b.z + 1.54); G.add(glass);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.2), lam(0xb97a4e));
    box.position.set(b.x + x, 1.1, b.z + 1.6); G.add(box);
    for (let i = -1; i <= 1; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), lam(choice([0xff8fb7, 0xffd24a, 0xc9a0ff])));
      fl.position.set(b.x + x + i * 0.24, 1.25, b.z + 1.62); G.add(fl);
    }
  });
  makeSign(G, b.x, b.z, 0xff9ec6);
}
buildHub();

/* ---------- a tiny placeholder shop room (Phase 3 fills it with Malek + catalog) ---------- */
function buildShopRoom() {
  const G = new THREE.Group(); scene.add(G);
  G.add(new THREE.HemisphereLight(0xfff2e4, 0xd0b0ff, 1.5));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 14), lam(0xe9dcc0));
  floor.position.set(SHOP_ORIGIN.x, -0.1, SHOP_ORIGIN.z); G.add(floor);
  const wMat = lam(0xfdf0ff);
  const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wMat); m.position.set(SHOP_ORIGIN.x + x, y, SHOP_ORIGIN.z + z); G.add(m); };
  wall(14, 4, 0.3, 0, 2, -7); wall(0.3, 4, 14, -7, 2, 0); wall(0.3, 4, 14, 7, 2, 0);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.6), lam(0xb87340));
  counter.position.set(SHOP_ORIGIN.x, 0.55, SHOP_ORIGIN.z - 4); G.add(counter);
  const reg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), lam(0xff7a8c));
  reg.position.set(SHOP_ORIGIN.x + 1.4, 1.45, SHOP_ORIGIN.z - 4); G.add(reg);
  for (let s = -1; s <= 1; s += 2) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.4, 4), lam(0xc9a0ff));
    shelf.position.set(SHOP_ORIGIN.x + s * 5.5, 1.2, SHOP_ORIGIN.z - 1); G.add(shelf);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), lam([0xff8fb7, 0xffd24a, 0x8fc9ff, 0x9fe6b8][i]));
      g.position.set(SHOP_ORIGIN.x + s * 5.3, 0.8 + i * 0.55, SHOP_ORIGIN.z - 2 + (i % 2) * 1.4); G.add(g);
    }
  }
}
buildShopRoom();

/* ---------- walking + proximity ---------- */
function walkWorld(dt, cx, cz, R) {
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
    girl.rotation.y = lerpAngle(girl.rotation.y, Math.atan2(ix, iy), 1 - Math.exp(-12 * dt));
    S.walkT += dt * (4 + 6 * Math.min(ilen, 1));
  }
}

function hubProximity() {
  if (S.transitioning) return;
  let near = null;
  for (const b of BUILDINGS) {
    if (Math.hypot(girl.position.x - b.x, girl.position.z - b.z) < 3.8) { near = b; break; }
  }
  if (near) {
    if (S.hubTarget !== near.key) {
      S.hubTarget = near.key;
      $('hubPrompt').textContent = near.label;
      $('hubPrompt').classList.remove('hidden');
    }
  } else if (S.hubTarget) {
    S.hubTarget = null;
    $('hubPrompt').classList.add('hidden');
  }
}

// called from the main loop while in 'hub' / 'shop' / 'house'
export function updateOverworld(dt) {
  if (S.state === 'hub') { walkWorld(dt, O.x, O.z, HUB_R); hubProximity(); }
  else if (S.state === 'shop') { walkWorld(dt, SHOP_ORIGIN.x, SHOP_ORIGIN.z, SHOP_R); updateShopProximity(); }
  else if (S.state === 'house') { const wc = S.walkCenter; if (wc) walkWorld(dt, wc.x, wc.z, S.walkR || 3.4); }
  // ambient: spinning sign beacons + shimmering fountain
  for (const bc of beacons) { bc.rotation.y += dt * 1.5; bc.position.y = 3.5 + Math.sin(S.animT * 2 + bc.position.x) * 0.16; }
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
   'housePrompt', 'exitHouseBtn', 'interiorHint'].forEach(id => $(id).classList.add('hidden'));
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
  S.walkCenter = { x: O.x, z: O.z }; S.walkR = HUB_R;
  girl.position.set(O.x, 0, O.z + 8); girl.rotation.set(0, Math.PI, 0); girl.visible = true;
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
  girl.position.set(SHOP_ORIGIN.x, 0, SHOP_ORIGIN.z + 3); girl.rotation.y = Math.PI; girl.visible = true;
  camFocus.copy(girl.position);
  $('hubPrompt').classList.add('hidden'); S.hubTarget = null;
  $('hud2').classList.remove('hidden');
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
  if (t === 'meadow') { fadeTransition(() => startGame(S.savedLevel, true)); }
  else if (t === 'shop') { fadeTransition(() => enterShop()); }
  else if (t === 'house') {
    // a real walk-in: she steps to the cottage door while the screen fades, then she's inside
    S.autoWalk = { x: HOUSE.x, z: HOUSE.z + 1.4 };
    sfx.click();
    fadeTransition(() => { S.autoWalk = null; enterHouseInterior(); });
  }
});
$('exitBuildingBtn').addEventListener('click', () => exitToHub());
