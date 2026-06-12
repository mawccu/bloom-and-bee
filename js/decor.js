import * as THREE from 'three';
import { lam, bas, $ } from './utils.js';
import { S, store } from './state.js';
import { scene, camera } from './engine.js';
import { raycaster } from './input.js';
import { CATALOG } from './economy.js';
import { burst } from './particles.js';
import { sfx } from './audio.js';
import { malekSay } from './characters.js';
import { scheduleCloudSave } from './ui.js';

/* ============================== slot grid ==============================
   8 floor positions inside the house (INT_ORIGIN = 0,0,300), laid out as an
   even 4×2 grid across the open central/front floor (clear of the built-in
   bed/desk/bookshelf). World coords = (INT_OX + slot.lx, 0, INT_OZ + slot.lz). */
const INT_OX = 0, INT_OZ = 300;

const SLOTS = [
  { id: 'g0', lx: -3.6, lz: 1.0 },
  { id: 'g1', lx: -1.2, lz: 1.0 },
  { id: 'g2', lx:  1.2, lz: 1.0 },
  { id: 'g3', lx:  3.6, lz: 1.0 },
  { id: 'g4', lx: -3.6, lz: 4.0 },
  { id: 'g5', lx: -1.2, lz: 4.0 },
  { id: 'g6', lx:  1.2, lz: 4.0 },
  { id: 'g7', lx:  3.6, lz: 4.0 },
];

const slotMarkers  = {};   // slotId → THREE.Mesh
const placedMeshes = {};   // slotId → THREE.Group
let _decorMode     = false;
let _selectedId    = null;

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

/* ============================== slot markers ============================== */
function makeSlotMarker(slotId, lx, lz) {
  const geo = new THREE.CylinderGeometry(0.65, 0.65, 0.045, 18);
  const mat = bas(0xffd24a, { transparent: true, opacity: 0.55 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(INT_OX + lx, 0.03, INT_OZ + lz);
  mesh.userData.slotId = slotId;
  mesh.visible = false;
  scene.add(mesh);
  slotMarkers[slotId] = mesh;
}

/* ============================== spawn / despawn ============================== */
function spawnMesh(slotId, itemId) {
  despawnMesh(slotId);
  const slot = SLOTS.find(s => s.id === slotId);
  if (!slot) return;
  const G = buildDecorMesh(itemId);
  G.position.set(INT_OX + slot.lx, 0, INT_OZ + slot.lz);
  G.userData.decorSlotId = slotId;
  G.traverse(c => { c.userData.decorSlotId = slotId; });
  scene.add(G);
  placedMeshes[slotId] = G;
}

function despawnMesh(slotId) {
  if (placedMeshes[slotId]) { scene.remove(placedMeshes[slotId]); delete placedMeshes[slotId]; }
}

/* ============================== init (called from house.js) ============================== */
export function initDecor() {
  SLOTS.forEach(s => makeSlotMarker(s.id, s.lx, s.lz));
  // drop saved placements that point at retired slot ids (old random layout)
  Object.keys(S.placedFurniture).forEach(slotId => {
    if (!SLOTS.some(s => s.id === slotId)) delete S.placedFurniture[slotId];
  });
  Object.entries(S.placedFurniture).forEach(([slotId, itemId]) => spawnMesh(slotId, itemId));
}

/* ============================== persist ============================== */
function savePlaced() {
  store.set('placedFurniture', JSON.stringify(S.placedFurniture));
  scheduleCloudSave();
}

export function placeItem(slotId, itemId) {
  S.placedFurniture[slotId] = itemId;
  savePlaced();
  spawnMesh(slotId, itemId);
  _refreshMarkers();
}

export function removeItem(slotId) {
  delete S.placedFurniture[slotId];
  savePlaced();
  despawnMesh(slotId);
  _refreshMarkers();
}

/* ============================== decor mode ============================== */
export function isDecorMode() { return _decorMode; }

function _refreshMarkers() {
  SLOTS.forEach(s => {
    const m = slotMarkers[s.id];
    if (!m) return;
    const occ = !!S.placedFurniture[s.id];
    m.material.color.setHex(occ ? 0xff9ec6 : 0xffd24a);
    m.material.opacity = occ ? 0.30 : 0.55;
    m.visible = _decorMode;
  });
}

function _rebuildPanel() {
  const panel = $('decorPanel');
  panel.innerHTML = '';

  const ownedCatalog = CATALOG.filter(it => S.ownedItems.includes(it.id));
  if (!ownedCatalog.length) {
    const msg = document.createElement('div');
    msg.className = 'decorEmpty';
    msg.textContent = 'Buy items in the shop first! 🛍️';
    panel.appendChild(msg);
    return;
  }

  ownedCatalog.forEach(item => {
    const placedEntry = Object.entries(S.placedFurniture).find(([, v]) => v === item.id);
    const isSelected  = item.id === _selectedId;
    const card = document.createElement('button');
    card.className = 'decorCard' + (placedEntry ? ' placed' : '') + (isSelected ? ' selected' : '');
    card.innerHTML =
      `<span class="dc-em">${item.emoji}</span>` +
      `<span class="dc-nm">${item.name}</span>` +
      (placedEntry ? `<span class="dc-tag">placed</span>` : '');

    card.addEventListener('pointerdown', e => {
      e.preventDefault();
      sfx.click();
      if (isSelected && placedEntry) {
        // second tap on an already-placed selected item → remove it
        removeItem(placedEntry[0]);
        _selectedId = null;
        _rebuildPanel();
        malekSay(null, "Stored away! 📦");
      } else {
        _selectedId = item.id;
        _rebuildPanel();
        malekSay(null, placedEntry
          ? "Tap a glowing spot to move it, or tap here again to remove 🗑️"
          : "Now tap a glowing spot on the floor! ✨");
      }
    });
    panel.appendChild(card);
  });
}

export function enterDecorMode() {
  _decorMode  = true;
  _selectedId = null;
  S.insideHouse = true;   // switch input to orbit+tap mode (updateInteriorCamera takes over)
  _refreshMarkers();
  _rebuildPanel();
  $('decorPanel').classList.remove('hidden');
  $('decorDoneBtn').classList.remove('hidden');
  $('decorBtn').classList.add('hidden');
  malekSay('decor', "Decor mode! 🛋️ Pick an item below, then tap a glowing floor spot ✨");
}

export function exitDecorMode() {
  _decorMode  = false;
  _selectedId = null;
  S.insideHouse = false;  // back to walk mode
  _refreshMarkers();      // hides all markers
  $('decorPanel').classList.add('hidden');
  $('decorDoneBtn').classList.add('hidden');
  $('decorBtn').classList.remove('hidden');
}

/* ============================== tap handler (called from house.js tapInterior) ============================== */
export function handleDecorTap(clientX, clientY) {
  raycaster.setFromCamera(
    { x: (clientX / innerWidth) * 2 - 1, y: -(clientY / innerHeight) * 2 + 1 },
    camera
  );

  // collect raycast targets: visible slot markers + all placed mesh children
  const targets = Object.values(slotMarkers).filter(m => m.visible);
  Object.values(placedMeshes).forEach(g => g.traverse(c => { if (c.isMesh) targets.push(c); }));

  const hits = raycaster.intersectObjects(targets, false);
  if (!hits.length) return;

  // hit a slot marker?
  for (const h of hits) {
    const slotId = h.object.userData.slotId;
    if (!slotId) continue;
    if (!_selectedId) {
      malekSay(null, "Pick an item from the panel below first! 👇");
      sfx.click();
      return;
    }
    // move from any current slot, then place here
    const cur = Object.entries(S.placedFurniture).find(([, v]) => v === _selectedId);
    if (cur) removeItem(cur[0]);
    placeItem(slotId, _selectedId);
    const slot = SLOTS.find(s => s.id === slotId);
    burst(new THREE.Vector3(INT_OX + slot.lx, 0.5, INT_OZ + slot.lz), [0xff9ec6, 0xffffff, 0xffd24a], 10, 1.5, 1.2, 0.7);
    sfx.buy();
    malekSay(null, "Looking amazing! 🛋️✨");
    _selectedId = null;
    _rebuildPanel();
    return;
  }

  // hit a placed decor mesh?
  for (const h of hits) {
    const slotId = h.object.userData.decorSlotId;
    if (!slotId) continue;
    const itemId = S.placedFurniture[slotId];
    if (!itemId) continue;
    if (_selectedId && _selectedId !== itemId) {
      // swap: place selected item here, remove old
      const cur = Object.entries(S.placedFurniture).find(([, v]) => v === _selectedId);
      if (cur) removeItem(cur[0]);
      removeItem(slotId);
      placeItem(slotId, _selectedId);
      sfx.buy();
      malekSay(null, "Swapped! 🔄✨");
      _selectedId = null;
    } else {
      // select this item for moving
      _selectedId = itemId;
      malekSay(null, "Tap a glowing spot to move it, or tap the panel card again to remove 🗑️");
      sfx.click();
    }
    _rebuildPanel();
    return;
  }
}

/* ============================== button wiring ============================== */
$('decorBtn').addEventListener('pointerdown',    e => { e.preventDefault(); enterDecorMode(); });
$('decorDoneBtn').addEventListener('pointerdown', e => { e.preventDefault(); exitDecorMode(); });
