import * as THREE from 'three';
import { lam, bas, choice, clamp, $ } from './utils.js';
import { S, store } from './state.js';
import { camera } from './engine.js';
import { raycaster } from './input.js';
import { girl, malekSay } from './characters.js';
import { CATALOG } from './economy.js';
import { burst } from './particles.js';
import { sfx } from './audio.js';
import { scheduleCloudSave } from './ui.js';
import { trackStat } from './achievements.js';
import { setHouseObstacles, resolveObstacles } from './world.js';

/* ============================== free-form furniture placement ==============================
   Every piece of furniture/decor is a movable item. The player picks one up (tap it in 3-D,
   or tap its card in the panel) then taps anywhere on the floor to drop it — free position,
   no slots/dots. Positions are LOCAL to the interior origin (INT_ORIGIN = 0,0,300) and are
   persisted per item in S.placedFurniture = { itemId: {x, z, rot} } so they cloud-sync and
   restore on reload. Collision footprints are rebuilt from the live transforms on every move. */
const INT_OX = 0, INT_OZ = 300;
const CLAMP = 6.4;            // keep furniture centres inside the walls
const LIFT  = 0.5;           // how far a picked-up item floats while "held"
const ROT_STEP = Math.PI / 4; // 45° per rotate tap

// ellipse footprint half-extents (local, un-rotated) + whether it blocks walking
const FOOT = {
  bed:          { rx: 1.45, rz: 2.15, collide: true  },
  desk:         { rx: 1.6,  rz: 1.3,  collide: true  },
  shelf:        { rx: 1.15, rz: 0.6,  collide: true  },
  lamp:         { rx: 0.5,  rz: 0.5,  collide: true  },
  rug:          { rx: 3.1,  rz: 2.3,  collide: false },
  bookshelf:    { rx: 0.95, rz: 0.45, collide: true  },
  mirror_heart: { rx: 0.7,  rz: 0.45, collide: true  },
  plant_bonsai: { rx: 0.5,  rz: 0.5,  collide: true  },
  lamp_gold:    { rx: 0.45, rz: 0.45, collide: true  },
  vase_flowers: { rx: 0.4,  rz: 0.4,  collide: false },
  rug_pink:     { rx: 1.7,  rz: 1.3,  collide: false },
  rug_purple:   { rx: 1.7,  rz: 1.3,  collide: false },
  teapot_flower:{ rx: 0.4,  rz: 0.4,  collide: false },
  poster_stars: { rx: 0.5,  rz: 0.45, collide: false },
  candle_rose:  { rx: 0.3,  rz: 0.3,  collide: false },
  cat_plush:    { rx: 0.35, rz: 0.35, collide: false },
  clock_wall:   { rx: 0.3,  rz: 0.3,  collide: false },
};
const DEFAULT_FOOT = { rx: 0.5, rz: 0.5, collide: false };
const PLACE_LINES = ["Looking amazing! 🛋️✨", "Perfect spot 🥰", "Our cosy little home 💕", "Love what you did there! ✨"];

let interiorGroup = null;
const movables = {};   // id -> { id, kind, group, foot, label, lines, def:{x,z,rot}, placed }
let _decorMode  = false;
let _selectedId = null;   // currently picked-up item
let _ring = null;          // glowing ring under the held item

/* ============================== mesh builders ============================== */
function buildDecorMesh(itemId) {
  const G = new THREE.Group();
  switch (itemId) {
    case 'rug_pink':
    case 'rug_purple': {
      const col = itemId === 'rug_pink' ? 0xffaac8 : 0xc9a0ff;
      const border = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 2.4), lam(0xfff3f8));
      border.position.y = 0.02; G.add(border);
      const rug = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.07, 2.1), lam(col));
      rug.position.y = 0.04; G.add(rug);
      break;
    }
    case 'vase_flowers': {
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.44, 10), lam(0xff9ec6));
      vase.position.y = 0.22; G.add(vase);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 6), lam(0x5cba6a));
      stem.position.y = 0.55; G.add(stem);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), lam(0xffaac8));
      fl.position.y = 0.70; G.add(fl);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), lam(0xffd24a));
        petal.position.set(Math.cos(a) * 0.16, 0.72, Math.sin(a) * 0.16); G.add(petal);
      }
      break;
    }
    case 'plant_bonsai': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.30, 10), lam(0xa06840));
      pot.position.y = 0.15; G.add(pot);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.58, 8), lam(0x8a6030));
      trunk.position.y = 0.59; G.add(trunk);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = 0.12 + (i % 3) * 0.08;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14 + (i % 2) * 0.06, 7, 6), lam(0x4da860));
        leaf.scale.y = 0.70;
        leaf.position.set(Math.cos(a) * r, 0.88 + (i % 3) * 0.12, Math.sin(a) * r);
        G.add(leaf);
      }
      break;
    }
    case 'bookshelf': {
      const unit = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.5, 0.52), lam(0xb87340));
      unit.position.y = 1.25; G.add(unit);
      const bCols = [0xff7a8c, 0xffd24a, 0x9ad0ff, 0x9fe6b8, 0xc9a0ff, 0xff9430];
      for (let row = 0; row < 3; row++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.48), lam(0xa06238));
        shelf.position.y = 0.38 + row * 0.84; G.add(shelf);
        let bx = -0.65;
        for (let b = 0; b < 5; b++) {
          const bh = 0.30 + (b * 0.04);
          const bk = new THREE.Mesh(new THREE.BoxGeometry(0.15, bh, 0.38), lam(bCols[b % bCols.length]));
          bk.position.set(bx, 0.42 + row * 0.84 + bh / 2, 0.07); G.add(bk);
          bx += 0.22;
        }
      }
      break;
    }
    case 'lamp_gold': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.65, 8), lam(0xd4a030));
      pole.position.y = 0.825; G.add(pole);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.38, 10, 1, true), lam(0xffd24a, { side: THREE.DoubleSide }));
      shade.position.y = 1.74; G.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bas(0xffe8b0, { transparent: true, opacity: 0.95 }));
      bulb.position.y = 1.58; G.add(bulb);
      break;
    }
    case 'mirror_heart': {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.10, 0.40), lam(0xb87340));
      stand.position.y = 0.05; G.add(stand);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.60, 0.12), lam(0xb87340));
      frame.position.y = 1.0; G.add(frame);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.35, 0.09), bas(0xbce8f5, { transparent: true, opacity: 0.72 }));
      glass.position.y = 1.0; G.add(glass);
      const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bas(0xff5e9c));
      heart.position.set(0, 1.62, 0.08); G.add(heart);
      break;
    }
    case 'teapot_flower': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), lam(0xfff3e0));
      body.scale.y = 0.82; body.position.y = 0.30; G.add(body);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.34, 7), lam(0xfff3e0));
      spout.position.set(0.30, 0.30, 0); spout.rotation.z = -0.5; G.add(spout);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 6, 12, Math.PI), lam(0xfff3e0));
      handle.position.set(-0.28, 0.30, 0); handle.rotation.y = Math.PI / 2; G.add(handle);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lam(0xffaac8));
      lid.scale.y = 0.50; lid.position.y = 0.49; G.add(lid);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 6), lam(0xffd24a));
      fl.position.y = 0.60; G.add(fl);
      break;
    }
    case 'poster_stars': {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.65), lam(0xa06840));
      leg.position.y = 0.32; leg.rotation.x = 0.30; G.add(leg);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.06), lam(0xb87340));
      frame.position.y = 0.73; G.add(frame);
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.98, 0.05), bas(0x0e0e28));
      canvas.position.y = 0.73; G.add(canvas);
      for (let i = 0; i < 6; i++) {
        const star = new THREE.Mesh(new THREE.SphereGeometry(0.048, 6, 5), bas(0xffd24a));
        star.position.set((i % 3 - 1) * 0.2, 0.38 + Math.floor(i / 3) * 0.38, 0.04);
        G.add(star);
      }
      break;
    }
    case 'candle_rose': {
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), lam(0xfff0e0));
      plate.position.y = 0.02; G.add(plate);
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.46, 10), lam(0xffe8e8));
      candle.position.y = 0.27; G.add(candle);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), bas(0xffaa44, { transparent: true, opacity: 0.95 }));
      flame.scale.y = 1.45; flame.position.y = 0.55; G.add(flame);
      const rose = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), lam(0xff5e7c));
      rose.position.set(0.16, 0.10, 0.06); G.add(rose);
      break;
    }
    case 'cat_plush': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), lam(0xffe0b0));
      body.scale.y = 1.12; body.position.y = 0.27; G.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), lam(0xffe0b0));
      head.position.y = 0.64; G.add(head);
      [-0.10, 0.10].forEach(ex => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.11, 6), lam(0xffe0b0));
        ear.position.set(ex, 0.80, 0); G.add(ear);
      });
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), bas(0xff9ec6));
      nose.position.set(0, 0.645, 0.14); G.add(nose);
      break;
    }
    case 'clock_wall': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, 0.18), lam(0xb87340));
      base.position.y = 0.475; G.add(base);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.045, 8, 22), lam(0xb87340));
      rim.position.y = 0.92; G.add(rim);
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.09, 16), lam(0xfff8e0));
      face.rotation.x = Math.PI / 2; face.position.y = 0.92; G.add(face);
      const hHand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.04), bas(0x3a2a10));
      hHand.position.y = 0.93; G.add(hHand);
      const mHand = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), bas(0x3a2a10));
      mHand.position.y = 0.93; mHand.rotation.z = 1.05; G.add(mHand);
      break;
    }
    default: {
      const fb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), lam(0xffaac8));
      fb.position.y = 0.25; G.add(fb);
    }
  }
  return G;
}

/* ============================== transforms / persistence ============================== */
function curTransform(e) {
  const t = S.placedFurniture[e.id];
  return (t && typeof t === 'object' && 'x' in t) ? t : e.def;
}
function savePlaced() {
  store.set('placedFurniture', JSON.stringify(S.placedFurniture));
  scheduleCloudSave();
}

// rebuild the live house collision footprints from every placed, colliding item
function rebuildCollision() {
  const list = [];
  for (const id in movables) {
    const e = movables[id];
    if (!e.placed || !e.foot.collide) continue;
    const t = curTransform(e);
    const c = Math.abs(Math.cos(t.rot || 0)), s = Math.abs(Math.sin(t.rot || 0));
    const rx = Math.hypot(e.foot.rx * c, e.foot.rz * s);   // AABB of the rotated ellipse
    const rz = Math.hypot(e.foot.rx * s, e.foot.rz * c);
    list.push({ x: INT_OX + t.x, z: INT_OZ + t.z, rx, rz });
  }
  setHouseObstacles(list);
  if (girl) resolveObstacles(girl.position, list);   // never trap her inside a moved piece
}

/* ============================== spawn ============================== */
function spawnCatalog(id) {
  if (movables[id]) return movables[id];
  if (!CATALOG.some(i => i.id === id)) return null;
  const g = buildDecorMesh(id);
  g.userData.movableId = id;
  g.traverse(c => { c.userData.movableId = id; });
  interiorGroup.add(g);
  const e = { id, kind: 'catalog', group: g, foot: FOOT[id] || DEFAULT_FOOT, label: null, lines: null, def: { x: 0, z: 2.5, rot: 0 }, placed: false };
  movables[id] = e;
  return e;
}

/* ============================== public placement API (UI + tests) ============================== */
export function placeFurniture(id, lx, lz, rot = 0) {
  const e = movables[id] || spawnCatalog(id);
  if (!e) return;
  lx = clamp(lx, -CLAMP, CLAMP); lz = clamp(lz, -CLAMP, CLAMP);
  e.placed = true;
  S.placedFurniture[id] = { x: lx, z: lz, rot };
  e.group.position.set(lx, 0, lz);
  e.group.rotation.y = rot;
  savePlaced();
  rebuildCollision();
}
export function getPlacement(id) {
  const e = movables[id];
  if (!e || !e.placed) return null;
  const t = curTransform(e);
  return { x: t.x, z: t.z, rot: t.rot || 0 };
}
function removeItem(id) {
  const e = movables[id];
  if (!e) return;
  delete S.placedFurniture[id];
  if (e.kind === 'catalog') { interiorGroup.remove(e.group); delete movables[id]; }
  else e.placed = false;
  savePlaced();
  rebuildCollision();
}

/* ============================== selection ring ============================== */
function ensureRing() {
  if (_ring || !interiorGroup) return;
  _ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 28),
    bas(0xffd24a, { transparent: true, opacity: 0.72, side: THREE.DoubleSide }));
  _ring.rotation.x = -Math.PI / 2; _ring.position.y = 0.05; _ring.visible = false;
  interiorGroup.add(_ring);
}
function showRing(e) { ensureRing(); const t = curTransform(e); _ring.position.set(t.x, 0.05, t.z); _ring.visible = true; }
function hideRing() { if (_ring) _ring.visible = false; }

/* ============================== pick up / drop / rotate ============================== */
function selectItem(id) {
  const e = movables[id];
  if (!e) return;
  if (_selectedId && _selectedId !== id && movables[_selectedId]) movables[_selectedId].group.position.y = 0;
  _selectedId = id;
  e.group.position.y = LIFT;
  showRing(e);
  $('decorRotateBtn').classList.remove('hidden');
  _rebuildPanel();
  sfx.click();
  malekSay(null, "Got it! Tap the floor to set it down, 🔄 to rotate ✨");
}

function dropAt(lx, lz) {
  if (!_selectedId) return;
  const id = _selectedId, e = movables[id];
  const wasPlaced = e.placed;
  const t = curTransform(e);
  placeFurniture(id, lx, lz, t.rot || 0);
  burst(new THREE.Vector3(INT_OX + clamp(lx, -CLAMP, CLAMP), 0.5, INT_OZ + clamp(lz, -CLAMP, CLAMP)),
    [0xff9ec6, 0xffffff, 0xffd24a], 10, 1.5, 1.2, 0.7);
  sfx.buy();
  hideRing();
  $('decorRotateBtn').classList.add('hidden');
  _selectedId = null;
  malekSay(null, choice(e.lines || PLACE_LINES));
  _rebuildPanel();
  if (!wasPlaced) trackStat('decorations', 1);
}

function rotateSelected() {
  if (!_selectedId) return;
  const e = movables[_selectedId];
  const t = curTransform(e);
  const rot = ((t.rot || 0) + ROT_STEP) % (Math.PI * 2);
  S.placedFurniture[_selectedId] = { x: t.x, z: t.z, rot };
  e.group.rotation.y = rot;
  savePlaced();
  rebuildCollision();
  sfx.click();
}

/* ============================== tap handler (from house.js tapInterior) ============================== */
function rayFloorPoint(cx, cy) {
  raycaster.setFromCamera({ x: (cx / innerWidth) * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (Math.abs(d.y) < 1e-6) return null;
  const t = -o.y / d.y;
  if (t <= 0) return null;
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}
function pickMovable(cx, cy) {
  raycaster.setFromCamera({ x: (cx / innerWidth) * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, camera);
  const meshes = [];
  for (const id in movables) {
    const e = movables[id];
    if (e.placed) e.group.traverse(c => { if (c.isMesh) meshes.push(c); });
  }
  const hits = raycaster.intersectObjects(meshes, false);
  for (const h of hits) {
    let o = h.object;
    while (o) { if (o.userData.movableId) return o.userData.movableId; o = o.parent; }
  }
  return null;
}
export function handleDecorTap(clientX, clientY) {
  if (_selectedId) {
    const p = rayFloorPoint(clientX, clientY);
    if (p) dropAt(p.x - INT_OX, p.z - INT_OZ);
    return;
  }
  const id = pickMovable(clientX, clientY);
  if (id) selectItem(id);
  else malekSay(null, "Tap a piece of furniture to pick it up 👆");
}

/* ============================== panel (owned catalog items) ============================== */
function _rebuildPanel() {
  const panel = $('decorPanel');
  panel.innerHTML = '';
  const owned = CATALOG.filter(it => S.ownedItems.includes(it.id));
  if (!owned.length) {
    const msg = document.createElement('div');
    msg.className = 'decorEmpty';
    msg.textContent = 'Buy items in the shop first! 🛍️';
    panel.appendChild(msg);
    return;
  }
  owned.forEach(item => {
    const placed = !!(movables[item.id] && movables[item.id].placed);
    const selected = item.id === _selectedId;
    const card = document.createElement('button');
    card.className = 'decorCard' + (placed ? ' placed' : '') + (selected ? ' selected' : '');
    card.innerHTML =
      `<span class="dc-em">${item.emoji}</span>` +
      `<span class="dc-nm">${item.name}</span>` +
      (placed ? `<span class="dc-tag">${selected ? 'holding' : 'placed'}</span>` : '');
    card.addEventListener('pointerdown', e => {
      e.preventDefault(); sfx.click();
      const isPlaced = !!(movables[item.id] && movables[item.id].placed);
      if (selected && isPlaced) {
        removeItem(item.id);
        _selectedId = null; hideRing();
        $('decorRotateBtn').classList.add('hidden');
        _rebuildPanel();
        malekSay(null, "Stored away! 📦");
        return;
      }
      if (!isPlaced) placeFurniture(item.id, 0, 2.5, 0);   // bring it into the room first
      selectItem(item.id);
    });
    panel.appendChild(card);
  });
}

/* ============================== decor mode ============================== */
export function isDecorMode() { return _decorMode; }

export function enterDecorMode() {
  _decorMode = true; _selectedId = null;
  S.insideHouse = true;   // orbit + tap mode (updateInteriorCamera takes over)
  _rebuildPanel();
  $('decorPanel').classList.remove('hidden');
  $('decorDoneBtn').classList.remove('hidden');
  $('decorBtn').classList.add('hidden');
  $('decorRotateBtn').classList.add('hidden');
  malekSay('decor', "Decor mode! 🛋️ Tap any furniture to pick it up, then tap the floor to place it anywhere ✨");
}

export function exitDecorMode() {
  if (_selectedId && movables[_selectedId]) movables[_selectedId].group.position.y = 0;
  _selectedId = null; hideRing();
  _decorMode = false;
  S.insideHouse = false;  // back to walk mode
  $('decorPanel').classList.add('hidden');
  $('decorDoneBtn').classList.add('hidden');
  $('decorRotateBtn').classList.add('hidden');
  $('decorBtn').classList.remove('hidden');
}

/* ============================== init (called from house.js) ============================== */
// migrate the old slot→itemId save format to the new itemId→{x,z,rot} format
const OLD_SLOTS = { g0:[-3.6,1.0], g1:[-1.2,1.0], g2:[1.2,1.0], g3:[3.6,1.0], g4:[-3.6,4.0], g5:[-1.2,4.0], g6:[1.2,4.0], g7:[3.6,4.0] };
function migrate() {
  const pf = S.placedFurniture; let changed = false;
  for (const k of Object.keys(pf)) {
    const v = pf[k];
    if (typeof v === 'string') {                 // old: k=slotId, v=itemId
      const s = OLD_SLOTS[k];
      pf[v] = { x: s ? s[0] : 0, z: s ? s[1] : 2.5, rot: 0 };
      delete pf[k]; changed = true;
    } else if (!v || typeof v !== 'object' || !('x' in v)) {
      delete pf[k]; changed = true;              // unknown shape — drop it
    }
  }
  if (changed) savePlaced();
}

export function initDecor(group, builtinRegs) {
  interiorGroup = group;
  migrate();
  // register built-in furniture (always present in the room, but movable)
  (builtinRegs || []).forEach(reg => {
    const g = reg.group;
    g.userData.movableId = reg.id;
    g.traverse(c => { c.userData.movableId = reg.id; });
    const def = { x: g.position.x, z: g.position.z, rot: g.rotation.y };
    movables[reg.id] = { id: reg.id, kind: 'builtin', group: g, foot: FOOT[reg.id] || DEFAULT_FOOT, label: reg.label, lines: reg.lines, def, placed: true };
    const t = S.placedFurniture[reg.id];
    if (t && typeof t === 'object' && 'x' in t) { g.position.set(t.x, 0, t.z); g.rotation.y = t.rot || 0; }
  });
  // spawn any saved catalog placements at their stored transforms
  Object.keys(S.placedFurniture).forEach(id => {
    if (movables[id]) return;                    // built-in, already applied above
    if (!CATALOG.some(i => i.id === id)) { delete S.placedFurniture[id]; return; }
    const e = spawnCatalog(id);
    const t = S.placedFurniture[id];
    e.placed = true;
    e.group.position.set(t.x, 0, t.z); e.group.rotation.y = t.rot || 0;
  });
  rebuildCollision();
}

/* ============================== button wiring ============================== */
$('decorBtn').addEventListener('pointerdown',     e => { e.preventDefault(); enterDecorMode(); });
$('decorDoneBtn').addEventListener('pointerdown',  e => { e.preventDefault(); exitDecorMode(); });
$('decorRotateBtn').addEventListener('pointerdown', e => { e.preventDefault(); rotateSelected(); });
