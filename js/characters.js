import * as THREE from 'three';
import { lam, bas, $ } from './utils.js';
import { store, S } from './state.js';
import { scene } from './engine.js';
import { makeBlobShadow } from './world.js';
import { sfx } from './audio.js';

/* ============================== Ranooma 🌸 ============================== */
export const DRESS_COLORS = [0xff9ec6, 0xc9a0ff, 0x8fc9ff, 0x9fe6b8, 0xffbf8e, 0xff7a8c];
export const HAIR_COLORS = [0x6b4a3a, 0x2e2a2a, 0xf0c269, 0xa3502e, 0xffb7d5];
export const girl = new THREE.Group();
export const girlRefs = {};
{
  const skin = lam(0xffdcc2);
  const dressMat = lam(DRESS_COLORS[+store.get('dress', 0)] || DRESS_COLORS[0]);
  const hairMat = lam(HAIR_COLORS[+store.get('hair', 0)] || HAIR_COLORS[0]);
  girlRefs.dressMat = dressMat; girlRefs.hairMat = hairMat;

  girlRefs.legs = [];
  [-1, 1].forEach(side => {
    const hip = new THREE.Group(); hip.position.set(side * 0.13, 0.4, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.32, 8), skin);
    leg.position.y = -0.16; hip.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), lam(0xd95f87));
    shoe.position.set(0, -0.33, 0.04); shoe.scale.set(1, 0.7, 1.25); hip.add(shoe);
    girl.add(hip); girlRefs.legs.push(hip);
  });

  const dress = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.0, 18), dressMat);
  dress.position.y = 0.85; girl.add(dress);
  [[0.5, 0.55], [1.6, 0.7], [-0.8, 0.62], [2.7, 0.5], [-2.1, 0.72]].forEach(([a, y]) => {
    const t = (y - 0.35) / 1.0, r = 0.56 * (1 - t);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), lam(0xfff3f8));
    d.position.set(Math.cos(a) * r, y, Math.sin(a) * r); girl.add(d);
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), skin);
  head.position.y = 1.62; girl.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), hairMat);
  hair.position.set(0, 1.72, -0.07); girl.add(hair);
  girlRefs.pigtails = [];
  [-1, 1].forEach(side => {
    const pig = new THREE.Group(); pig.position.set(side * 0.46, 1.68, -0.05);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), hairMat);
    ball.position.set(side * 0.07, -0.06, 0); pig.add(ball);
    const band = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), lam(0xff6fa5));
    pig.add(band);
    girl.add(pig); girlRefs.pigtails.push(pig);
  });
  {
    const fg = new THREE.Group(); fg.position.set(0.28, 2.02, 0.12); fg.rotation.z = -0.4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), lam(0xfffbe8));
      p.position.set(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07); p.scale.y = 0.5; fg.add(p);
    }
    fg.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), lam(0xffd24a)));
    girl.add(fg);
  }

  const eyeMat = bas(0x3a2a2a);
  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), eyeMat);
    eye.position.set(side * 0.16, 1.66, 0.37); eye.scale.set(1, 1.35, 0.5); girl.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), bas(0xffffff));
    glint.position.set(side * 0.14, 1.7, 0.405); girl.add(glint);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), lam(0xffb3c1));
    blush.position.set(side * 0.28, 1.57, 0.3); blush.scale.set(1, 0.6, 0.4); girl.add(blush);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), eyeMat);
  smile.position.set(0, 1.55, 0.4); smile.rotation.z = Math.PI; girl.add(smile);

  girlRefs.arms = [];
  [-1, 1].forEach(side => {
    const sh = new THREE.Group(); sh.position.set(side * 0.45, 1.28, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), skin);
    arm.position.y = -0.24; sh.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
    hand.position.y = -0.46; sh.add(hand);
    girl.add(sh); girlRefs.arms.push(sh);
  });
  girlRefs.arms[1].rotation.x = -0.55;

  const basket = new THREE.Group(); basket.position.set(0, -0.62, 0);
  const bMat = lam(0xc98a4b);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.17, 10, 1, true), bMat);
  cup.material.side = THREE.DoubleSide; basket.add(cup);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), bMat);
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.085; basket.add(bottom);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 6, 12, Math.PI), bMat);
  handle.position.y = 0.08; basket.add(handle);
  girlRefs.basketBlooms = [];
  [[-0.07, 0xff8fb7], [0.06, 0xc9a0ff], [0, 0x8fc9ff]].forEach(([x, c], i) => {
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), lam(c));
    bloom.position.set(x, 0.06, (i - 1) * 0.06); bloom.visible = false;
    basket.add(bloom); girlRefs.basketBlooms.push(bloom);
  });
  girlRefs.arms[1].add(basket);
  girlRefs.basket = basket;

  const stars = new THREE.Group(); stars.position.y = 2.35;
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), bas(0xffd24a));
    const a = (i / 3) * Math.PI * 2;
    st.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42); stars.add(st);
  }
  stars.visible = false; girl.add(stars);
  girlRefs.stars = stars;

  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12),
    bas(0xff9ec6, { transparent: true, opacity: 0.16, depthWrite: false }));
  bubble.position.y = 1.1; bubble.visible = false;
  girl.add(bubble);
  girlRefs.bubble = bubble;

  scene.add(girl);
}
export const girlShadow = makeBlobShadow(0.55);

/* ============================== Malek — the ULTIMATE 😎💻 (mesh + poses) ============================== */
// Muscular dev hero: buff, handsome & aura. Lands on the ground beside Ranooma to show off.
export const malekChar = (() => {
  const g = new THREE.Group();
  const skin = lam(0xe6b58c), top = lam(0x6a3ad0), pants = lam(0x2b3350), dark = lam(0x231f33), belt = lam(0x3a2f5a);
  const armRefs = [], legRefs = [];
  // thick legs with a slight power stance
  [-1, 1].forEach(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.2, 0.92, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 5, 10), pants);
    thigh.position.y = -0.28; hip.add(thigh);
    const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.36, 5, 10), pants);
    calf.position.set(0, -0.62, 0.02); hip.add(calf);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 7), lam(0xf2f2f2));
    shoe.position.set(0, -0.85, 0.1); shoe.scale.set(1, 0.6, 1.5); hip.add(shoe);
    g.add(hip); legRefs.push(hip);
  });
  // waist + belt + V-taper chest
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.45, 12), top);
  waist.position.y = 1.18; g.add(waist);
  const beltM = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 12), belt);
  beltM.position.y = 0.96; g.add(beltM);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), top);
  chest.scale.set(1.28, 0.95, 0.72); chest.position.y = 1.64; g.add(chest);
  [-1, 1].forEach(s => {
    const pec = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), top);
    pec.position.set(s * 0.21, 1.68, 0.36); pec.scale.set(1, 0.82, 0.6); g.add(pec);
  });
  // big deltoids + muscular arms (shoulder + elbow joints for flexing/punching)
  [-1, 1].forEach(s => {
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin);
    delt.position.set(s * 0.54, 1.92, 0); g.add(delt);
    const sh = new THREE.Group(); sh.position.set(s * 0.54, 1.9, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.32, 5, 10), skin); // bicep
    upper.position.y = -0.24; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.46; sh.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.34, 5, 10), skin);
    fore.position.y = -0.2; elbow.add(fore);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8), skin);
    fist.position.y = -0.42; elbow.add(fist);
    sh.rotation.z = s * 0.28; // arms rest out over the lats
    g.add(sh); armRefs.push({ sh, elbow, side: s });
  });
  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.18, 8), skin);
  neck.position.y = 2.08; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), skin);
  head.position.y = 2.4; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), dark);
  hair.position.set(0, 2.52, -0.03); hair.scale.set(1, 0.78, 1); g.add(hair);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.15, 0.45), dark);
  fringe.position.set(0, 2.66, 0.16); fringe.rotation.x = 0.2; g.add(fringe);
  // handsome eyes, brows + smirk
  const eyeMatM = bas(0x3a2a2a);
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), eyeMatM);
    eye.position.set(s * 0.13, 2.43, 0.32); eye.scale.set(1, 1.15, 0.5); g.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), bas(0xffffff));
    glint.position.set(s * 0.115, 2.46, 0.345); g.add(glint);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.05), dark);
    brow.position.set(s * 0.13, 2.5, 0.33); brow.rotation.z = s * -0.12; g.add(brow);
  });
  const smirk = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 10, Math.PI * 0.8), bas(0x6a3a2a));
  smirk.position.set(0.03, 2.24, 0.31); smirk.rotation.z = Math.PI + 0.5; g.add(smirk);
  // grounded golden aura ring + soft glow
  const aura = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 32),
    bas(0xffe27a, { transparent: true, opacity: 0.6, fog: false }));
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.06; g.add(aura);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 12),
    bas(0xffd76a, { transparent: true, opacity: 0.1, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.y = 1.4; g.add(glow);
  g.visible = false;
  scene.add(g);
  return { g, aura, glow, arms: armRefs, legs: legRefs, shadow: makeBlobShadow(0.62), landX: 0, landZ: 0 };
})();
malekChar.shadow.visible = false;
export function malekRestArms() {
  malekChar.arms.forEach(a => { a.sh.rotation.set(0, 0, a.side * 0.28); a.elbow.rotation.set(0, 0, 0); });
}
export function malekFlexPose(amt) {
  malekChar.arms.forEach(a => {
    a.sh.rotation.z = a.side * (0.28 + amt * 1.05);  // arms out
    a.sh.rotation.x = -amt * 0.12;
    a.elbow.rotation.x = -amt * 2.3;                  // curl up = big biceps
    a.elbow.rotation.z = 0;
  });
}
// both arms wrap forward and across his front, cradling Ranooma upright against him
export function setCarryArms(mc, k) {
  mc.arms[0].sh.rotation.z = -0.28 + k * 0.83; mc.arms[0].sh.rotation.x = -k * 0.78; mc.arms[0].elbow.rotation.x = -k * 0.9;
  mc.arms[1].sh.rotation.z =  0.28 - k * 0.83; mc.arms[1].sh.rotation.x = -k * 0.78; mc.arms[1].elbow.rotation.x = -k * 0.9;
}
// while carried, Ranooma's own limbs settle into a relaxed, dangling pose
export function relaxGirlLimbs(dt) {
  const t = Math.min(1, dt * 8);
  girlRefs.legs[0].rotation.x += (0 - girlRefs.legs[0].rotation.x) * t;
  girlRefs.legs[1].rotation.x += (0 - girlRefs.legs[1].rotation.x) * t;
  girlRefs.arms[0].rotation.x += (0.3 - girlRefs.arms[0].rotation.x) * t;
  girlRefs.arms[1].rotation.x += (-0.55 - girlRefs.arms[1].rotation.x) * t;
  girlRefs.pigtails[0].rotation.z *= 0.9; girlRefs.pigtails[1].rotation.z *= 0.9;
}

/* ============================== Malek the dev 💻 (chat) ============================== */
export const malek = { queue: [], shown: {}, showT: 0, gapT: 0 };
export function malekSay(id, text) {
  if (id && malek.shown[id]) return;
  if (id) malek.shown[id] = true;
  if (malek.queue.length > 2) return;
  malek.queue.push(text);
}
export const MALEK_PRAISE = [
  "That's my girl! 😍",
  "Flawless! I'd hire you as my QA tester 💼🌸",
  "You make my game look easy 💕",
  "Another level down! Amazing, ya amar ✨",
  "I coded this level to be hard… you broke it 😂💘",
];
export const MALEK_TIPS = [
  "Golden flowers give triple petals 🌟",
  "Butterflies give +7 seconds — chase them! 🦋",
  "Save petals for Speedy Shoes, trust me 👟",
  "Rainbow flowers are SUPER rare. Grab them!! 🌈",
  "The Magic Wand makes your swat huge 🪄",
  "Shield bubble = one free bee mistake 🛡️",
  "Don't fall in the pond… I didn't code swimming 😅",
  "Check the minimap, I drew it myself 🗺️",
];
export function updateMalek(dt) {
  if (malek.showT > 0) {
    malek.showT -= dt;
    if (malek.showT <= 0) { $('malek').classList.remove('show'); malek.gapT = 1.2; }
    return;
  }
  if (malek.gapT > 0) { malek.gapT -= dt; return; }
  if (malek.queue.length && (S.state === 'playing' || S.state === 'count' || S.state === 'won')) {
    $('malekTxt').textContent = malek.queue.shift();
    $('malek').classList.add('show');
    malek.showT = 5.8;
    sfx.msg();
  }
}
export function malekReset() { malek.queue.length = 0; malek.shown = {}; malek.showT = 0; $('malek').classList.remove('show'); }
