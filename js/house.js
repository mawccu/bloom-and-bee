import * as THREE from 'three';
import { lam, bas, choice, $ } from './utils.js';
import { store, S } from './state.js';
import { scene, camera } from './engine.js';
import { burst } from './particles.js';
import { sfx, initAudio } from './audio.js';
import { malekSay, girl, girlRefs } from './characters.js';
import { raycaster, showFixedJoy } from './input.js';
import { scheduleCloudSave } from './ui.js';
import { camFocus } from './gameplay.js';
import { enterHub, fadeTransition } from './hub.js';
import { initDecor, enterDecorMode, exitDecorMode, isDecorMode, handleDecorTap } from './decor.js';
import { showAchievementsPanel, hideAchievementsPanel } from './achievements.js';

/* ============================== house interior ============================== */
const INT_ORIGIN = new THREE.Vector3(0, 0, 300);
const intItems = []; // { mesh, label, states, idx, mats }

const INT_BED_COLORS  = [0xffb7d5, 0x9ad0ff, 0xc9a0ff];
const INT_RUG_COLORS  = [0xff9ec6, 0xffe066, 0x9fe6b8];
const INT_VASE_COLORS = [0xff8fb7, 0xc9a0ff, 0x8fc9ff, 0xffd24a];
const INT_BOOK_COLORS = [0xff7a8c, 0xffd24a, 0x9ad0ff, 0x9fe6b8, 0xc9a0ff, 0xff9430];

const intMalekLines = {
  bed:   ["I chose the fluffiest pillow for you 😊", "Pink or blue? I coded both 💕", "Sweet dreams in here 🌙"],
  desk:  ["That's where I coded this whole game for you! 💻✨", "Still got 1000 bugs to fix 😅 but it's our game!", "The cursor blinked all night for you 🩷"],
  vase:  ["Fresh flowers just like the meadow 🌸", "Picked these digitally, no bees involved 😄", "They never wilt in here 💐"],
  rug:   ["I rolled this rug out myself 🤭", "Softest rug in 3D space 🥰", "Tap to redecorate anytime!"],
  shelf: ["All your favourite books 📚", "Top shelf is my coding journals… don't look 😳", "One day I'll fill it with our travel photos 🌍"],
  lamp:  ["Cosy glow, just for you 🪔", "I'll keep the light on 🥰", "Move it wherever feels homey ✨"],
};

function buildInterior() {
  const G = new THREE.Group();
  G.position.copy(INT_ORIGIN);
  scene.add(G);
  const regs = []; // movable built-in furniture registered with the decor system

  G.add(new THREE.HemisphereLight(0xfff2e4, 0xd49040, 1.6));
  const lamp = new THREE.PointLight(0xffe8b0, 1.8, 30);
  lamp.position.set(0, 4.0, 0); G.add(lamp);
  // Corner lights for a bigger room
  [[-5,4,-5],[5,4,-5]].forEach(([x,y,z]) => {
    const pl = new THREE.PointLight(0xffe0b0, 1.0, 14);
    pl.position.set(x, y, z); G.add(pl);
  });

  // Floor — warm hardwood, 16×16
  const floorMat = lam(0xb06a30);
  G.add(function(){ const m = new THREE.Mesh(new THREE.BoxGeometry(16,0.2,16), floorMat); m.position.y=-0.1; return m; }());
  for (let i = -7; i <= 7; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.21, 16), lam(0x966022));
    p.position.set(i * 1.07, 0, 0); G.add(p);
  }

  // Walls — 16 wide, 5 tall
  const wMat = lam(0xfdf5e2);
  const addWall = (w,h,d,x,y,z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wMat); m.position.set(x,y,z); G.add(m); };
  addWall(16,5,0.2, 0,2.5,-7.9);    // back
  addWall(0.2,5,16, -7.9,2.5,0);    // left
  addWall(0.2,5,16,  7.9,2.5,0);    // right
  // Front wall with doorway (doorway 3.6 wide centred)
  addWall(5.3,5,0.2, -6.25,2.5,7.9);
  addWall(5.3,5,0.2,  6.25,2.5,7.9);
  addWall(16,1.5,0.2,  0,4.25,7.9);  // lintel above doorway
  // Baseboard trim
  addWall(16,0.2,0.15, 0,0.1,-7.82);
  addWall(0.15,0.2,16, -7.82,0.1,0);
  addWall(0.15,0.2,16,  7.82,0.1,0);
  // Floral wallpaper stripe near ceiling
  addWall(16,0.35,0.15, 0,4.65,-7.82);
  addWall(0.15,0.35,16, -7.82,4.65,0);
  addWall(0.15,0.35,16,  7.82,4.65,0);

  // Back window (bigger, centred)
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(4.0,2.8,0.25), lam(0xffffff));
  winFrame.position.set(0,2.6,-7.8); G.add(winFrame);
  const winGlass = new THREE.Mesh(new THREE.BoxGeometry(3.6,2.4,0.12), bas(0xafe0f5,{transparent:true,opacity:0.5}));
  winGlass.position.set(0,2.6,-7.75); G.add(winGlass);
  const wb1 = new THREE.Mesh(new THREE.BoxGeometry(0.08,2.4,0.14), lam(0xffffff)); wb1.position.set(0,2.6,-7.72); G.add(wb1);
  const wb2 = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.08,0.14), lam(0xffffff)); wb2.position.set(0,2.6,-7.72); G.add(wb2);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.4), bas(0x9ed9ff)); sky.position.set(0,2.6,-8.0); G.add(sky);
  for (let c = 0; c < 4; c++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(0.22+c*0.07,8,6), bas(0xffffff,{transparent:true,opacity:0.88}));
    cl.scale.y=0.55; cl.position.set(-1.2+c*0.8, 2.8+Math.sin(c)*0.12,-7.97); G.add(cl);
  }
  // Window sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(4.0,0.14,0.38), lam(0xffffff)); sill.position.set(0,1.3,-7.86); G.add(sill);

  // Rug (center floor, bigger) — wrapped in a group so it can be freely moved
  const rugG = new THREE.Group(); rugG.position.set(0,0,0.5); G.add(rugG);
  const rugMats = INT_RUG_COLORS.map(c => lam(c));
  const rugMesh = new THREE.Mesh(new THREE.BoxGeometry(6,0.06,4.5), rugMats[+store.get('intRug',0)||0]);
  rugMesh.position.set(0,0.02,0); rugG.add(rugMesh);
  const rugBorder = new THREE.Mesh(new THREE.BoxGeometry(6.35,0.05,4.85), lam(0xfff3f8));
  rugBorder.position.set(0,0.01,0); rugG.add(rugBorder);
  intItems.push({ mesh: rugMesh, label: 'rug', lines: intMalekLines.rug, mats: rugMats, storeKey: 'intRug', idx: +store.get('intRug',0)||0 });
  regs.push({ id: 'rug', group: rugG, label: 'rug', lines: intMalekLines.rug });

  // BED (back-right corner, headboard to the back wall)
  const bedG = new THREE.Group(); bedG.position.set(4.8,0,-4.3); G.add(bedG);
  bedG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.35,4.0),lam(0xc8935a)); m.position.y=0.175; return m; }());
  bedG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.08,0.5),lam(0xc8935a)); m.position.set(0,0.44,1.9); return m; }());
  const coverMats = INT_BED_COLORS.map(c => lam(c));
  const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.18,3.4), coverMats[+store.get('intBed',0)||0]);
  coverMesh.position.set(0,0.46,-0.2); bedG.add(coverMesh);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.15,0.6), lam(0xffffff));
  pillow.position.set(0,0.55,1.4); bedG.add(pillow);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(2.7,1.4,0.2), lam(0xb87340)); hb.position.set(0,0.9,-2.1); bedG.add(hb);
  for (let hx = -0.8; hx <= 0.8; hx += 0.8) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.11,8,6), lam(0xffd24a)); sp.position.set(hx,1.5,-2.0); bedG.add(sp);
  }
  // Side table
  const sideT = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.7,0.8), lam(0xa06840)); sideT.position.set(-1.7,0.35,1.7); bedG.add(sideT);
  const sideL = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), bas(0xffe8b0,{transparent:true,opacity:0.9})); sideL.position.set(-1.7,0.9,1.7); bedG.add(sideL);
  intItems.push({ mesh: coverMesh, label: 'bed', lines: intMalekLines.bed, mats: coverMats, storeKey: 'intBed', idx: +store.get('intBed',0)||0 });
  regs.push({ id: 'bed', group: bedG, label: 'bed', lines: intMalekLines.bed });

  // DESK + LAPTOP (back-left corner, against the back wall)
  const deskG = new THREE.Group(); deskG.position.set(-4.8,0,-5.0); G.add(deskG);
  deskG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(3.0,0.12,1.4),lam(0xa06840)); m.position.y=0.95; return m; }());
  [-1.3,1.3].forEach(x=>{ const leg=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.95,0.12),lam(0x9a6030)); leg.position.set(x,0.475,0); deskG.add(leg); });
  const lapBase = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.08,0.95), lam(0x5a6070)); lapBase.position.set(0,1.06,0.05); deskG.add(lapBase);
  const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.78,0.06), lam(0x3a4050)); lapScreen.position.set(0,1.52,-0.42); lapScreen.rotation.x=-0.3; deskG.add(lapScreen);
  const screenGlo = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.68,0.05), bas(0x4a8cff,{transparent:true,opacity:0.9})); screenGlo.position.set(0,1.52,-0.39); screenGlo.rotation.x=-0.3; deskG.add(screenGlo);
  const screenHeart = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), bas(0xff5e9c)); screenHeart.position.set(0,1.58,-0.36); screenHeart.rotation.x=-0.3; deskG.add(screenHeart);
  const chairG = new THREE.Group(); chairG.position.set(0,0,0.95); deskG.add(chairG);
  chairG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.09,0.95),lam(0xff9ec6)); m.position.y=0.58; return m; }());
  chairG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.95,0.55,0.09),lam(0xff9ec6)); m.position.set(0,0.9,-0.43); return m; }());
  [-0.4,0.4].forEach(x=>{ [-0.4,0.4].forEach(z=>{ const l=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.58,6),lam(0xa06840)); l.position.set(x,0.29,z); chairG.add(l); }); });
  intItems.push({ mesh: screenGlo, label: 'desk', lines: intMalekLines.desk, mats: null, storeKey: null, idx: 0 });
  regs.push({ id: 'desk', group: deskG, label: 'desk', lines: intMalekLines.desk });

  // BOOKSHELF (left wall, mid — deterministic, tidy rows of books)
  const shelfG = new THREE.Group(); shelfG.position.set(-6.4,0,1.8); G.add(shelfG);
  shelfG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(2.2,3.6,0.55),lam(0xb87340)); m.position.y=1.8; return m; }());
  for (let row = 0; row < 4; row++) {
    let bx = -0.84;
    for (let b = 0; b < 7; b++) {
      const bh = 0.34 + ((row + b) % 3) * 0.05;   // fixed, repeatable heights
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.17, bh, 0.38), lam(INT_BOOK_COLORS[(row * 7 + b) % INT_BOOK_COLORS.length]));
      bk.position.set(bx, 0.45 + row*0.82 + bh/2, 0.09); shelfG.add(bk);
      bx += 0.235;
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.1,0.07,0.48), lam(0xa06238)); shelf.position.set(0, 0.38+row*0.82, 0.03); shelfG.add(shelf);
  }
  const plantStem = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.24,8), lam(0x8a7a60)); plantStem.position.set(0.8,3.72,0.1); shelfG.add(plantStem);
  for (let i=0;i<5;i++) { const a=(i/5)*Math.PI*2; const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.11,6,5),lam(0x5cba6a)); leaf.position.set(0.8+Math.cos(a)*0.13,3.9,0.1+Math.sin(a)*0.13); shelfG.add(leaf); }
  intItems.push({ mesh: shelfG.children[1], label: 'shelf', lines: intMalekLines.shelf, mats: null, storeKey: null, idx: 0 });
  regs.push({ id: 'shelf', group: shelfG, label: 'shelf', lines: intMalekLines.shelf });

  // FLOWER VASE (window sill — bigger room means further back)
  const vaseG = new THREE.Group(); vaseG.position.set(2.0,0,-7.6); G.add(vaseG);
  vaseG.add(function(){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.11,0.42,10),lam(0xff9ec6)); m.position.y=0.21; return m; }());
  const vaseMats = INT_VASE_COLORS.map(c=>lam(c));
  const vaseFl = new THREE.Mesh(new THREE.SphereGeometry(0.11,8,6), vaseMats[+store.get('intVase',0)||0]);
  vaseFl.position.set(0,0.54,0); vaseG.add(vaseFl);
  const vaseStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.22,6), lam(0x5cba6a)); vaseStem.position.set(0,0.38,0); vaseG.add(vaseStem);
  intItems.push({ mesh: vaseFl, label: 'vase', lines: intMalekLines.vase, mats: vaseMats, storeKey: 'intVase', idx: +store.get('intVase',0)||0 });

  // Floor lamp (front-left corner)
  const lampG = new THREE.Group(); lampG.position.set(-5.8,0,4.6); G.add(lampG);
  lampG.add(function(){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.09,1.8,8),lam(0xb06a30)); m.position.y=0.9; return m; }());
  lampG.add(function(){ const m=new THREE.Mesh(new THREE.ConeGeometry(0.32,0.38,12,1,true),lam(0xffd24a,{side:THREE.DoubleSide})); m.position.y=1.95; return m; }());
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), bas(0xffe8b0,{transparent:true,opacity:0.9})); bulb.position.set(0,1.78,0); lampG.add(bulb);
  regs.push({ id: 'lamp', group: lampG, label: 'lamp', lines: intMalekLines.lamp });

  // Vanity mirror (right wall)
  const mirrorG = new THREE.Group(); mirrorG.position.set(7.5,0,3.0); G.add(mirrorG);
  mirrorG.rotation.y = Math.PI / 2;
  const mirFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8,2.2,0.14), lam(0xb87340)); mirFrame.position.set(0,2.0,0); mirrorG.add(mirFrame);
  const mirGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.9,0.1), bas(0xc0e8f8,{transparent:true,opacity:0.7})); mirGlass.position.set(0,2.0,0.03); mirrorG.add(mirGlass);
  const dresser = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.9,0.7), lam(0xa06840)); dresser.position.set(0,0.45,0); mirrorG.add(dresser);

  // Wall art (back wall, bigger frame)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6,1.2,0.09), lam(0xb87340)); frame.position.set(-3,2.8,-7.83); G.add(frame);
  const art = new THREE.Mesh(new THREE.BoxGeometry(1.36,0.96,0.07), bas(0xffe8f5)); art.position.set(-3,2.8,-7.79); G.add(art);
  const artHeart = new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6), bas(0xff5e9c)); artHeart.position.set(-3,2.86,-7.75); G.add(artHeart);

  // Second wall art (smaller, right of window)
  const frame2 = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.85,0.09), lam(0x9a7040)); frame2.position.set(3.5,2.8,-7.83); G.add(frame2);
  const art2 = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.65,0.07), bas(0xe8f5ff)); art2.position.set(3.5,2.8,-7.79); G.add(art2);
  const artStar = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), bas(0xffd24a)); artStar.position.set(3.5,2.84,-7.75); G.add(artStar);

  // ACHIEVEMENT BOARD (left wall, back-left quadrant — tap to open achievements)
  const achBoardG = new THREE.Group();
  achBoardG.position.set(-7.82, 1.85, -4.2);
  achBoardG.rotation.y = -Math.PI / 2;
  G.add(achBoardG);
  const achFrame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.25, 0.10), lam(0x9a6830));
  achFrame.position.z = 0; achBoardG.add(achFrame);
  const achPanel = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.98, 0.07), lam(0xfff8d0));
  achPanel.position.z = 0.02; achBoardG.add(achPanel);
  const achStar = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), bas(0xffd24a));
  achStar.position.set(0, 0.18, 0.08); achBoardG.add(achStar);
  const medalColors = [0xd4a030, 0xb0b8c8, 0xcd7f32];
  for (let i = -1; i <= 1; i++) {
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 12), lam(medalColors[i + 1]));
    medal.position.set(i * 0.36, -0.28, 0.07); medal.rotation.x = Math.PI / 2; achBoardG.add(medal);
  }
  const achBoardItem = { mesh: achBoardG, label: 'board', lines: ['Tap to see your achievements! 🏆'], mats: null, storeKey: null, idx: 0, isAchBoard: true };
  achBoardG.userData.intItem = achBoardItem;
  intItems.push(achBoardItem);

  // Build raycaster targets for tap detection
  intItems.forEach(it => { it.mesh.userData.intItem = it; });
  return { G, regs };
}
const _interior = buildInterior();
initDecor(_interior.G, _interior.regs);

const INT_SPAWN = new THREE.Vector3(INT_ORIGIN.x, 0, INT_ORIGIN.z + 6.5); // just inside the wider doorway
const INT_R = 6.5;

// the actual swap into the interior (runs under a fade cover). The room is a normal
// open-top walkable area with the standard follow camera — no orbit, no jitter.
export function enterHouseInterior() {
  S.insideHouse = false;
  S.state = 'house';
  S.autoWalk = null;
  S.tapTarget = null;
  S.walkCenter = { x: INT_ORIGIN.x, z: INT_ORIGIN.z }; S.walkR = INT_R;
  girl.position.copy(INT_SPAWN); girl.rotation.set(0, Math.PI, 0); girl.visible = true;
  girlRefs.bubble.visible = false;
  camFocus.copy(girl.position);
  $('hud').classList.add('hidden');
  $('mini').classList.add('hidden'); $('swatBtn').classList.add('hidden');
  $('sprintBtn').classList.add('hidden'); $('stamWrap').classList.add('hidden'); S.sprintBtnHeld = false;
  $('kissBtn').classList.add('hidden'); $('hint').classList.add('hidden'); $('housePrompt').classList.add('hidden');
  $('hud2').classList.remove('hidden');
  $('exitHouseBtn').classList.remove('hidden');
  $('decorBtn').classList.remove('hidden');
  $('interiorHint').textContent = 'Walk around! Tap 🛋️ to decorate ✨';
  $('interiorHint').classList.remove('hidden'); $('interiorHint').style.opacity = 1;
  setTimeout(() => { $('interiorHint').style.opacity = 0; setTimeout(() => $('interiorHint').classList.add('hidden'), 600); }, 2600);
  if (S.ctrlMode === 'fixed') showFixedJoy();
  malekSay('house', "Welcome home! 🏠 Walk around, then tap 🛋️ to place your furniture ✨");
  S.hudDirty = true;
}

// entered from the meadow cottage prompt — fade straight in
export function enterHouse() { initAudio(); sfx.click(); fadeTransition(() => enterHouseInterior()); }

// walk to the door, fade, and step back out into the hub
export function exitHouse() {
  hideAchievementsPanel();
  // leave decor mode FIRST — exitDecorMode re-shows decorBtn, so hide everything after it
  if (isDecorMode()) exitDecorMode();
  $('exitHouseBtn').classList.add('hidden');
  $('interiorHint').classList.add('hidden');
  $('decorBtn').classList.add('hidden');
  $('decorPanel').classList.add('hidden');
  $('decorDoneBtn').classList.add('hidden');
  sfx.click();
  malekSay('houseOut', "Back to the hub! Where to next? 🌸");
  S.autoWalk = { x: INT_ORIGIN.x, z: INT_ORIGIN.z + 8.5 };
  fadeTransition(() => { S.autoWalk = null; enterHub(); });
}

export function updateInteriorCamera() {
  const R = 8, H = 14;
  const cx = INT_ORIGIN.x + Math.sin(S.intYaw) * R;
  const cz = INT_ORIGIN.z + Math.cos(S.intYaw) * R;
  camera.position.set(cx, INT_ORIGIN.y + H, cz);
  camera.lookAt(INT_ORIGIN.x, INT_ORIGIN.y + 0.8, INT_ORIGIN.z);
}

export function tapInterior(clientX, clientY) {
  if (isDecorMode()) { handleDecorTap(clientX, clientY); return; }
  raycaster.setFromCamera({ x: (clientX/innerWidth)*2-1, y: -(clientY/innerHeight)*2+1 }, camera);
  const meshes = intItems.map(it => it.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  if (!hits.length) return;
  // walk up to find the intItem
  let item = null;
  for (const h of hits) {
    let obj = h.object;
    while (obj) { if (obj.userData.intItem) { item = obj.userData.intItem; break; } obj = obj.parent; }
    if (item) break;
  }
  if (!item) return;
  if (item.isAchBoard) {
    showAchievementsPanel();
    sfx.buy();
    if (navigator.vibrate) navigator.vibrate(20);
    return;
  }
  // cycle state
  if (item.mats && item.storeKey) {
    item.idx = (item.idx + 1) % item.mats.length;
    item.mesh.material = item.mats[item.idx];
    store.set(item.storeKey, item.idx);
    scheduleCloudSave();
  }
  burst(camera.position.clone().lerp(item.mesh.getWorldPosition(new THREE.Vector3()), 0.6), [0xff9ec6,0xffffff,0xffd24a], 8, 1.4, 1.0, 0.6);
  sfx.buy();
  malekSay(null, choice(item.lines));
  if (navigator.vibrate) navigator.vibrate(20);
}

$('housePrompt').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); enterHouse(); });
$('exitHouseBtn').addEventListener('click', () => { exitHouse(); });
