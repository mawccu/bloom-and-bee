import * as THREE from 'three';
import { lam, bas, $, lerpAngle } from './utils.js';
import { S } from './state.js';
import { scene, SKIES, paintSky } from './engine.js';
import { girl, girlRefs } from './characters.js';
import { sfx, initAudio } from './audio.js';
import { inputVec, hideJoy, showFixedJoy } from './input.js';
import { startGame, camFocus } from './gameplay.js';
import { enterHouse } from './house.js';

/* ============================== overworld hub ==============================
   A small walkable map (far from the meadow at origin and the house interior at
   z=300) with three labeled entrances: Meadow / House / Shop. Ranooma walks it
   with the same controls as the meadow (follow camera + input.js). */
const HUB_ORIGIN = new THREE.Vector3(-300, 0, 0);
const HUB_R = 17;
const SHOP_ORIGIN = new THREE.Vector3(-300, 0, 220);
const SHOP_R = 6;
const WALK_SPEED = 7;

// the three entrances (world coords near the hub centre)
const BUILDINGS = [
  { key: 'meadow', label: '🌼 Enter the Meadow', x: HUB_ORIGIN.x - 9,  z: HUB_ORIGIN.z - 6 },
  { key: 'shop',   label: '🛍️ Enter the Shop',   x: HUB_ORIGIN.x,      z: HUB_ORIGIN.z - 11 },
  { key: 'house',  label: '🏠 Enter the House',  x: HUB_ORIGIN.x + 9,  z: HUB_ORIGIN.z - 6 },
];

/* ---------- build the hub world ---------- */
function buildSign(g, x, z, color) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), lam(0x9a6b4f));
  pole.position.set(x, 0.7, z + 2.2); g.add(pole);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 0.12), lam(color));
  board.position.set(x, 1.5, z + 2.2); g.add(board);
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), bas(color, { transparent: true, opacity: 0.9 }));
  beacon.position.set(x, 3.3, z); beacon.userData.spin = true; g.add(beacon);
  return beacon;
}
const beacons = [];
function buildHub() {
  const G = new THREE.Group(); scene.add(G);
  G.add(new THREE.HemisphereLight(0xeaf6ff, 0xbfe6a8, 1.2));

  // ground disc + a soft path ring
  const ground = new THREE.Mesh(new THREE.CircleGeometry(HUB_R + 6, 48), lam(0x9bdc86));
  ground.rotation.x = -Math.PI / 2; ground.position.set(HUB_ORIGIN.x, 0.01, HUB_ORIGIN.z); G.add(ground);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), lam(0xe6d6b0));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(HUB_ORIGIN.x, 0.02, HUB_ORIGIN.z); G.add(plaza);

  // MEADOW entrance — a flowery green arch
  {
    const b = BUILDINGS[0];
    [-1.3, 1.3].forEach(s => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.6, 8), lam(0x7ed489));
      post.position.set(b.x + s * 1.3, 1.3, b.z); G.add(post);
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 0.5), lam(0x6ecb7d));
    top.position.set(b.x, 2.7, b.z); G.add(top);
    for (let i = 0; i < 6; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), lam([0xff8fb7, 0xffd24a, 0xc9a0ff][i % 3]));
      fl.position.set(b.x - 1.4 + i * 0.56, 2.9, b.z); G.add(fl);
    }
    beacons.push(buildSign(G, b.x, b.z, 0x6ecb7d));
  }
  // SHOP entrance — blue shop with a striped awning
  {
    const b = BUILDINGS[1];
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.6), lam(0xbfe0ff));
    base.position.set(b.x, 1.2, b.z); G.add(base);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 2.9), lam(0x5aa8f0));
    roof.position.set(b.x, 2.5, b.z); G.add(roof);
    for (let i = 0; i < 5; i++) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.7), lam(i % 2 ? 0xffffff : 0xff7a8c));
      a.position.set(b.x - 1.2 + i * 0.6, 1.9, b.z + 1.5); a.rotation.x = 0.4; G.add(a);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.1), lam(0x3d7fc4));
    door.position.set(b.x, 0.75, b.z + 1.31); G.add(door);
    beacons.push(buildSign(G, b.x, b.z, 0x5aa8f0));
  }
  // HOUSE entrance — pink cottage
  {
    const b = BUILDINGS[2];
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 2.6), lam(0xfff0dc));
    base.position.set(b.x, 1.1, b.z); G.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 4), lam(0xff9ec6));
    roof.position.set(b.x, 3, b.z); roof.rotation.y = Math.PI / 4; G.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.1), lam(0xb97a4e));
    door.position.set(b.x, 0.75, b.z + 1.31); G.add(door);
    beacons.push(buildSign(G, b.x, b.z, 0xff9ec6));
  }
}
buildHub();

/* ---------- walking + proximity ---------- */
function walkWorld(dt, cx, cz, R) {
  const [ix, iy] = inputVec();
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

// called from the main loop while in 'hub' or 'shop'
export function updateOverworld(dt) {
  if (S.state === 'hub') { walkWorld(dt, HUB_ORIGIN.x, HUB_ORIGIN.z, HUB_R); hubProximity(); }
  else if (S.state === 'shop') { walkWorld(dt, SHOP_ORIGIN.x, SHOP_ORIGIN.z, SHOP_R); }
  for (const bc of beacons) { bc.rotation.y += dt * 1.5; bc.position.y = 3.3 + Math.sin(S.animT * 2 + bc.position.x) * 0.18; }
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
  S.tapTarget = null;
  S.walkCenter = { x: HUB_ORIGIN.x, z: HUB_ORIGIN.z }; S.walkR = HUB_R;
  girl.position.set(HUB_ORIGIN.x, 0, HUB_ORIGIN.z + 6); girl.rotation.set(0, 0, 0); girl.visible = true;
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
}

export function exitToHub() { $('exitBuildingBtn').classList.add('hidden'); sfx.click(); enterHub(); }

/* ---------- a tiny placeholder shop room (Phase 3 fills it with Malek + catalog) ---------- */
function buildShopRoom() {
  const G = new THREE.Group(); scene.add(G);
  G.add(new THREE.HemisphereLight(0xfff2e4, 0xd0b0ff, 1.5));
  const floor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 14), lam(0xe9dcc0));
  floor.position.set(SHOP_ORIGIN.x, -0.1, SHOP_ORIGIN.z); G.add(floor);
  const wMat = lam(0xfdf0ff);
  const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wMat); m.position.set(SHOP_ORIGIN.x + x, y, SHOP_ORIGIN.z + z); G.add(m); };
  wall(14, 4, 0.3, 0, 2, -7); wall(0.3, 4, 14, -7, 2, 0); wall(0.3, 4, 14, 7, 2, 0);
  // counter + register (placeholder for the Phase 3 Malek shop)
  const counter = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.6), lam(0xb87340));
  counter.position.set(SHOP_ORIGIN.x, 0.55, SHOP_ORIGIN.z - 4); G.add(counter);
  const reg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), lam(0xff7a8c));
  reg.position.set(SHOP_ORIGIN.x + 1.4, 1.45, SHOP_ORIGIN.z - 4); G.add(reg);
  // shelves of (placeholder) goodies
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

/* ---------- button wiring ---------- */
$('hubPrompt').addEventListener('pointerdown', e => {
  e.preventDefault(); initAudio();
  const t = S.hubTarget;
  $('hubPrompt').classList.add('hidden'); S.hubTarget = null;
  if (t === 'meadow') startGame(S.savedLevel, true);
  else if (t === 'house') enterHouse();
  else if (t === 'shop') enterShop();
});
$('exitBuildingBtn').addEventListener('click', () => exitToHub());
