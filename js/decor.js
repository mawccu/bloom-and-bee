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
const LIFT  = 1.0;           // how far a picked-up item floats while "held"
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
  // expanded economy pieces
  stool_round:  { rx: 0.32, rz: 0.32, collide: true  },
  chair_wood:   { rx: 0.4,  rz: 0.4,  collide: true  },
  coffee_table: { rx: 0.7,  rz: 0.4,  collide: true  },
  table_round:  { rx: 0.74, rz: 0.74, collide: true  },
  rug_round:    { rx: 1.5,  rz: 1.5,  collide: false },
  plant_tall:   { rx: 0.32, rz: 0.32, collide: true  },
  sofa_pink:    { rx: 0.95, rz: 0.46, collide: true  },
  floor_lamp:   { rx: 0.3,  rz: 0.3,  collide: true  },
  fridge_mini:  { rx: 0.4,  rz: 0.38, collide: true  },
  tv_flat:      { rx: 0.78, rz: 0.26, collide: true  },
  piano_grand:  { rx: 0.82, rz: 0.62, collide: true  },
  painting_flower:{ rx: 0.5, rz: 0.4, collide: false },
  guitar_stand: { rx: 0.4,  rz: 0.3,  collide: false },
  globe_desk:   { rx: 0.25, rz: 0.25, collide: false },
  trophy_gold:  { rx: 0.2,  rz: 0.2,  collide: false },
};
const DEFAULT_FOOT = { rx: 0.5, rz: 0.5, collide: false };
const PLACE_LINES = ["Looking amazing! 🛋️✨", "Perfect spot 🥰", "Our cosy little home 💕", "Love what you did there! ✨"];

// Items that can be placed on desk / shelf surfaces (small decorations only)
const SURFACE_CAPABLE = new Set(['teapot_flower', 'candle_rose', 'cat_plush', 'vase_flowers', 'clock_wall', 'poster_stars', 'globe_desk', 'trophy_gold']);
// Surface definitions: dy = top surface y in local-room coords, hw/hd = half-extents of the top face
const SURFACE_DEF = {
  desk:  { dy: 0.97, hw: 1.5,  hd: 0.70 },
  shelf: { dy: 3.65, hw: 1.05, hd: 0.27 },
};

let interiorGroup = null;
const movables = {};   // id -> { id, kind, group, foot, label, lines, def:{x,z,rot}, placed }
let _decorMode  = false;
let _selectedId = null;   // currently picked-up item
let _ring = null;          // glowing ring under the held item
let _ghost = null;         // ghost footprint indicator
let _ghostItemId = null;
let _ghostFillMat = null;
let _ghostEdgeMat = null;
let _ptrX = 0, _ptrY = 0; // last pointer position

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
    case 'stool_round': {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16), lam(0xff9ec6));
      seat.position.y = 0.5; G.add(seat);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), lam(0x9a6030));
        l.position.set(Math.cos(a) * 0.18, 0.25, Math.sin(a) * 0.18); l.rotation.x = 0.08; G.add(l);
      }
      break;
    }
    case 'chair_wood': {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), lam(0xb07a45));
      seat.position.y = 0.5; G.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.09), lam(0xb07a45));
      back.position.set(0, 0.82, -0.23); G.add(back);
      [-0.22, 0.22].forEach(x => [-0.22, 0.22].forEach(z => {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), lam(0x9a6030));
        l.position.set(x, 0.25, z); G.add(l);
      }));
      break;
    }
    case 'coffee_table': {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.7), lam(0xc8935a));
      top.position.y = 0.45; G.add(top);
      [-0.55, 0.55].forEach(x => [-0.27, 0.27].forEach(z => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), lam(0x9a6030));
        l.position.set(x, 0.2, z); G.add(l);
      }));
      break;
    }
    case 'table_round': {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 20), lam(0xc8935a));
      top.position.y = 0.95; G.add(top);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 10), lam(0x9a6030));
      col.position.y = 0.5; G.add(col);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 16), lam(0x9a6030));
      base.position.y = 0.06; G.add(base);
      break;
    }
    case 'rug_round': {
      const border = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.04, 28), lam(0xfff3f8));
      border.position.y = 0.02; G.add(border);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.05, 28), lam(0x9fe6b8));
      top.position.y = 0.035; G.add(top);
      break;
    }
    case 'plant_tall': {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.4, 12), lam(0xc96a4a));
      pot.position.y = 0.2; G.add(pot);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 8), lam(0x6a8a4a));
      stem.position.y = 1.0; G.add(stem);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 6), lam(0x4da860));
        leaf.scale.set(0.5, 1.1, 0.5);
        leaf.position.set(Math.cos(a) * 0.22, 1.35 + (i % 3) * 0.18, Math.sin(a) * 0.22);
        leaf.rotation.z = Math.cos(a) * 0.5; G.add(leaf);
      }
      break;
    }
    case 'sofa_pink': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.8), lam(0xff9ec6));
      base.position.y = 0.4; G.add(base);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.7), lam(0xffb7d5));
      seat.position.set(0, 0.62, 0.03); G.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.25), lam(0xff9ec6));
      back.position.set(0, 0.75, -0.4); G.add(back);
      [-0.9, 0.9].forEach(x => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.55, 0.8), lam(0xff86b8));
        arm.position.set(x, 0.55, 0); G.add(arm);
      });
      break;
    }
    case 'floor_lamp': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.07, 14), lam(0x57606e));
      base.position.y = 0.04; G.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 8), lam(0x8a93a0));
      pole.position.y = 0.9; G.add(pole);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.42, 12, 1, true), lam(0xfff0c0, { side: THREE.DoubleSide }));
      shade.position.y = 1.8; G.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bas(0xffe8b0, { transparent: true, opacity: 0.95 }));
      bulb.position.y = 1.66; G.add(bulb);
      break;
    }
    case 'fridge_mini': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.65), lam(0xf0f4f8));
      body.position.y = 0.7; G.add(body);
      const split = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.66), lam(0xc8d0d8));
      split.position.y = 0.95; G.add(split);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), lam(0xb0bcc8));
      handle.position.set(0.28, 1.15, 0.34); G.add(handle);
      break;
    }
    case 'tv_flat': {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.4), lam(0x5a4636));
      stand.position.y = 0.25; G.add(stand);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 0.08), lam(0x1a1a22));
      screen.position.set(0, 1.05, 0); G.add(screen);
      const glo = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.74, 0.05), bas(0x6ab0ff, { transparent: true, opacity: 0.85 }));
      glo.position.set(0, 1.05, 0.05); G.add(glo);
      break;
    }
    case 'piano_grand': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.1), lam(0x201a1a));
      body.position.y = 0.7; G.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.1), lam(0x2a2222));
      lid.position.set(0, 0.98, 0); G.add(lid);
      const openLid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 1.0), lam(0x150f0f));
      openLid.position.set(0, 1.35, -0.1); openLid.rotation.x = -0.5; G.add(openLid);
      const keys = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.25), lam(0xfaf8f0));
      keys.position.set(0, 0.5, 0.62); G.add(keys);
      [[-0.65, -0.45], [0.65, -0.45], [0, 0.45]].forEach(([x, z]) => {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), lam(0x150f0f));
        l.position.set(x, 0.22, z); G.add(l);
      });
      break;
    }
    case 'painting_flower': {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.6), lam(0xa06840));
      leg.position.y = 0.3; leg.rotation.x = 0.28; G.add(leg);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.06), lam(0xd4a030));
      frame.position.y = 0.72; G.add(frame);
      const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.9, 0.05), bas(0xeaf6ff));
      canvas.position.y = 0.72; G.add(canvas);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), lam(0x5cba6a));
      stem.position.set(0, 0.6, 0.05); G.add(stem);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lam(0xff7aa0));
      fl.position.set(0, 0.78, 0.06); G.add(fl);
      break;
    }
    case 'guitar_stand': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), lam(0xd98a3a));
      body.scale.set(0.7, 1.0, 0.32); body.position.y = 0.5; G.add(body);
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), bas(0x2a1a10));
      hole.rotation.x = Math.PI / 2; hole.position.set(0, 0.55, 0.1); G.add(hole);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.07), lam(0x6a4a30));
      neck.position.y = 1.2; G.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.06), lam(0x3a2a1a));
      head.position.y = 1.72; G.add(head);
      break;
    }
    case 'globe_desk': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 12), lam(0x9a6030));
      base.position.y = 0.04; G.add(base);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 16, Math.PI), lam(0xd4a030));
      arc.position.y = 0.28; arc.rotation.z = 0.2; G.add(arc);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), lam(0x5aa8f0));
      ball.position.y = 0.28; G.add(ball);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const land = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), lam(0x6ec07a));
        land.position.set(Math.cos(a) * 0.12, 0.28 + Math.sin(a) * 0.06, 0.1); G.add(land);
      }
      break;
    }
    case 'trophy_gold': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.22), lam(0x6a4a30));
      base.position.y = 0.05; G.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.18, 8), lam(0xf5c542));
      stem.position.y = 0.19; G.add(stem);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.24, 12), lam(0xffd24a));
      cup.position.y = 0.4; G.add(cup);
      [-0.16, 0.16].forEach(x => {
        const h = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12), lam(0xffd24a));
        h.position.set(x, 0.42, 0); h.rotation.y = Math.PI / 2; G.add(h);
      });
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
  if (t && typeof t === 'object' && 'x' in t) return { y: 0, ...t };
  return { ...e.def, y: 0 };
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
    if ((t.y || 0) > 0.5) continue; // surface-mounted items don't block floor movement
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
export function placeFurniture(id, lx, lz, rot = 0, ly = 0) {
  const e = movables[id] || spawnCatalog(id);
  if (!e) return;
  lx = clamp(lx, -CLAMP, CLAMP); lz = clamp(lz, -CLAMP, CLAMP);
  e.placed = true;
  S.placedFurniture[id] = { x: lx, z: lz, rot, y: ly };
  e.group.position.set(lx, ly, lz);
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

/* ============================== ghost footprint indicator ============================== */
function buildGhost(itemId) {
  if (_ghost) { interiorGroup.remove(_ghost); _ghost = null; }
  if (!interiorGroup) return;
  const foot = FOOT[itemId] || DEFAULT_FOOT;
  const W = foot.rx * 2, D = foot.rz * 2;
  const G = new THREE.Group();

  _ghostFillMat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(W, D), _ghostFillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.022; G.add(fill);

  _ghostEdgeMat = new THREE.LineBasicMaterial({ color: 0xffd24a });
  const pts = [
    new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, -D / 2),
    new THREE.Vector3(W / 2, 0,  D / 2),  new THREE.Vector3(-W / 2, 0, D / 2),
    new THREE.Vector3(-W / 2, 0, -D / 2),
  ];
  G.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), _ghostEdgeMat));

  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]].forEach(([cx, cz]) => {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.065, 8), dotMat);
    dot.rotation.x = -Math.PI / 2; dot.position.set(cx, 0.04, cz); G.add(dot);
  });

  G.visible = false;
  interiorGroup.add(G);
  _ghost = G; _ghostItemId = itemId;
}

function updateGhost() {
  if (!_selectedId || !interiorGroup) { if (_ghost) _ghost.visible = false; return; }
  if (_ghostItemId !== _selectedId) buildGhost(_selectedId);
  if (!_ghost) return;
  const p = rayTarget(_ptrX, _ptrY);
  if (!p) { _ghost.visible = false; return; }
  const lx = clamp(p.x - INT_OX, -CLAMP, CLAMP);
  const lz = clamp(p.z - INT_OZ, -CLAMP, CLAMP);
  const e = movables[_selectedId];
  const t = curTransform(e);
  _ghost.position.set(lx, p.y || 0, lz);
  _ghost.rotation.y = t.rot || 0;
  const col = p.onSurface ? 0x9fe6b8 : 0xffd24a;
  if (_ghostFillMat) _ghostFillMat.color.setHex(col);
  if (_ghostEdgeMat) _ghostEdgeMat.color.setHex(col);
  _ghost.visible = true;
}

/* ============================== surface detection ============================== */
function raySurface(cx, cy) {
  if (!SURFACE_CAPABLE.has(_selectedId)) return null;
  raycaster.setFromCamera({ x: (cx / innerWidth) * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  for (const [surfId, def] of Object.entries(SURFACE_DEF)) {
    const e = movables[surfId];
    if (!e || !e.placed) continue;
    const t = curTransform(e);
    if (Math.abs(d.y) < 1e-6) continue;
    const tr = (def.dy - o.y) / d.y;
    if (tr <= 0) continue;
    const hx = o.x + d.x * tr - (INT_OX + t.x);
    const hz = o.z + d.z * tr - (INT_OZ + t.z);
    const cos = Math.cos(-(t.rot || 0)), sin = Math.sin(-(t.rot || 0));
    const lx = hx * cos - hz * sin, lz = hx * sin + hz * cos;
    if (Math.abs(lx) <= def.hw && Math.abs(lz) <= def.hd) {
      return { x: o.x + d.x * tr, z: o.z + d.z * tr, y: def.dy, onSurface: true };
    }
  }
  return null;
}

function rayTarget(cx, cy) {
  const sp = raySurface(cx, cy);
  if (sp) return sp;
  raycaster.setFromCamera({ x: (cx / innerWidth) * 2 - 1, y: -(cy / innerHeight) * 2 + 1 }, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  if (Math.abs(d.y) < 1e-6) return null;
  const t = -o.y / d.y;
  if (t <= 0) return null;
  return { x: o.x + d.x * t, z: o.z + d.z * t, y: 0, onSurface: false };
}

/* ============================== pick up / drop / rotate ============================== */
function selectItem(id) {
  const e = movables[id];
  if (!e) return;
  if (_selectedId && _selectedId !== id && movables[_selectedId]) {
    const pt = curTransform(movables[_selectedId]);
    movables[_selectedId].group.position.y = pt.y || 0;
  }
  _selectedId = id;
  const t = curTransform(e);
  e.group.position.y = (t.y || 0) + LIFT;
  buildGhost(id);
  updateGhost();
  if ((t.y || 0) < 0.5) showRing(e); else hideRing();
  $('decorRotateBtn').classList.remove('hidden');
  _rebuildPanel();
  sfx.click();
  malekSay(null, "Got it! Tap the floor to place it, 🔄 to rotate ✨");
}

function dropAt(lx, lz, ly = 0) {
  if (!_selectedId) return;
  const id = _selectedId, e = movables[id];
  const wasPlaced = e.placed;
  const t = curTransform(e);
  placeFurniture(id, lx, lz, t.rot || 0, ly);
  burst(new THREE.Vector3(INT_OX + clamp(lx, -CLAMP, CLAMP), (ly || 0) + 0.5, INT_OZ + clamp(lz, -CLAMP, CLAMP)),
    [0xff9ec6, 0xffffff, 0xffd24a], 10, 1.5, 1.2, 0.7);
  sfx.buy();
  hideRing();
  if (_ghost) _ghost.visible = false;
  $('decorRotateBtn').classList.add('hidden');
  _selectedId = null;
  malekSay(null, choice(ly > 0.5 ? ["Cute on the desk! 🥰", "Perfect little touch ✨", "Love it up there! 💕"] : (e.lines || PLACE_LINES)));
  _rebuildPanel();
  if (!wasPlaced) trackStat('decorations', 1);
}

function rotateSelected() {
  if (!_selectedId) return;
  const e = movables[_selectedId];
  const t = curTransform(e);
  const rot = ((t.rot || 0) + ROT_STEP) % (Math.PI * 2);
  S.placedFurniture[_selectedId] = { x: t.x, z: t.z, rot, y: t.y || 0 };
  e.group.rotation.y = rot;
  if (_ghost) _ghost.rotation.y = rot;
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
  _ptrX = clientX; _ptrY = clientY;
  if (_selectedId) {
    const p = rayTarget(clientX, clientY);
    if (p) dropAt(p.x - INT_OX, p.z - INT_OZ, p.y || 0);
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
  if (_selectedId && movables[_selectedId]) {
    const pt = curTransform(movables[_selectedId]);
    movables[_selectedId].group.position.y = pt.y || 0;
  }
  _selectedId = null; hideRing();
  if (_ghost) _ghost.visible = false;
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
    e.group.position.set(t.x, t.y || 0, t.z); e.group.rotation.y = t.rot || 0;
  });
  rebuildCollision();
}

/* ============================== button wiring ============================== */
$('decorBtn').addEventListener('pointerdown',     e => { e.preventDefault(); enterDecorMode(); });
$('decorDoneBtn').addEventListener('pointerdown',  e => { e.preventDefault(); exitDecorMode(); });
$('decorRotateBtn').addEventListener('pointerdown', e => { e.preventDefault(); rotateSelected(); });

window.addEventListener('pointermove', e => {
  _ptrX = e.clientX; _ptrY = e.clientY;
  if (_selectedId && _decorMode) updateGhost();
}, { passive: true });
