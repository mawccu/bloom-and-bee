import * as THREE from 'three';
import { lam, bas, choice, $ } from './utils.js';
import { store, S } from './state.js';
import { scene, camera } from './engine.js';
import { burst } from './particles.js';
import { sfx, initAudio } from './audio.js';
import { malekSay } from './characters.js';
import { raycaster } from './input.js';

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
};

function buildInterior() {
  const G = new THREE.Group();
  G.position.copy(INT_ORIGIN);
  scene.add(G);

  G.add(new THREE.HemisphereLight(0xfff2e4, 0xd49040, 1.6));
  const lamp = new THREE.PointLight(0xffe8b0, 1.5, 22);
  lamp.position.set(0, 3.4, 0); G.add(lamp);

  // Floor
  const floorMat = lam(0xb06a30);
  G.add(function(){ const m = new THREE.Mesh(new THREE.BoxGeometry(10,0.2,10), floorMat); m.position.y=-0.1; return m; }());
  for (let i = -4; i <= 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.21, 10), lam(0x966022));
    p.position.set(i * 1.08, 0, 0); G.add(p);
  }

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(10,0.2,10), lam(0xfff5ec));
  ceil.position.y = 3.9; G.add(ceil);

  // Walls
  const wMat = lam(0xfdf5e2);
  const addWall = (w,h,d,x,y,z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wMat); m.position.set(x,y,z); G.add(m); };
  addWall(10,4,0.2, 0,2,-4.9);   // back
  addWall(0.2,4,10, -4.9,2,0);   // left
  addWall(0.2,4,10, 4.9,2,0);    // right
  // Front wall with doorway
  addWall(3.2,4,0.2, -3.4,2,4.9);
  addWall(3.2,4,0.2, 3.4,2,4.9);
  addWall(10,1.4,0.2, 0,3.3,4.9);

  // Back window
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2,2.2,0.22), lam(0xffffff));
  winFrame.position.set(0,2.1,-4.8); G.add(winFrame);
  const winGlass = new THREE.Mesh(new THREE.BoxGeometry(2.8,1.8,0.12), bas(0xafe0f5,{transparent:true,opacity:0.5}));
  winGlass.position.set(0,2.1,-4.76); G.add(winGlass);
  // Window cross bars
  const wb1 = new THREE.Mesh(new THREE.BoxGeometry(0.07,1.8,0.13), lam(0xffffff)); wb1.position.set(0,2.1,-4.73); G.add(wb1);
  const wb2 = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.07,0.13), lam(0xffffff)); wb2.position.set(0,2.1,-4.73); G.add(wb2);
  // Sky outside window
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.8,1.8), bas(0x9ed9ff)); sky.position.set(0,2.1,-5.0); G.add(sky);
  for (let c = 0; c < 3; c++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(0.25+c*0.08,8,6), bas(0xffffff,{transparent:true,opacity:0.88}));
    cl.scale.y=0.55; cl.position.set(-0.9+c*0.9, 2.3+Math.sin(c)*0.15,-4.97); G.add(cl);
  }

  // Rug (center floor)
  const rugMats = INT_RUG_COLORS.map(c => lam(c));
  const rugMesh = new THREE.Mesh(new THREE.BoxGeometry(4,0.05,3), rugMats[+store.get('intRug',0)||0]);
  rugMesh.position.set(0,0.02,0.5); G.add(rugMesh);
  const rugBorder = new THREE.Mesh(new THREE.BoxGeometry(4.3,0.04,3.3), lam(0xfff3f8));
  rugBorder.position.set(0,0.01,0.5); G.add(rugBorder);
  intItems.push({ mesh: rugMesh, label: 'rug', lines: intMalekLines.rug, mats: rugMats, storeKey: 'intRug', idx: +store.get('intRug',0)||0 });

  // BED (right side)
  const bedG = new THREE.Group(); bedG.position.set(3.2,0,1.5); G.add(bedG);
  bedG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.35,3.8),lam(0xc8935a)); m.position.y=0.175; return m; }());
  bedG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.08,0.5),lam(0xc8935a)); m.position.set(0,0.44,1.75); return m; }());
  const coverMats = INT_BED_COLORS.map(c => lam(c));
  const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1,0.16,3.2), coverMats[+store.get('intBed',0)||0]);
  coverMesh.position.set(0,0.44,-0.2); bedG.add(coverMesh);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.14,0.55), lam(0xffffff));
  pillow.position.set(0,0.54,1.3); bedG.add(pillow);
  // Headboard
  const hb = new THREE.Mesh(new THREE.BoxGeometry(2.5,1.2,0.18), lam(0xb87340)); hb.position.set(0,0.8,-1.95); bedG.add(hb);
  for (let hx = -0.7; hx <= 0.7; hx += 0.7) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), lam(0xffd24a)); sp.position.set(hx,1.35,-1.87); bedG.add(sp);
  }
  intItems.push({ mesh: coverMesh, label: 'bed', lines: intMalekLines.bed, mats: coverMats, storeKey: 'intBed', idx: +store.get('intBed',0)||0 });

  // DESK + LAPTOP (left side)
  const deskG = new THREE.Group(); deskG.position.set(-3.5,0,-2.5); G.add(deskG);
  deskG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.1,1.2),lam(0xa06840)); m.position.y=0.95; return m; }());
  [-1.1,1.1].forEach(x=>{ const leg=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.95,0.1),lam(0x9a6030)); leg.position.set(x,0.475,0); deskG.add(leg); });
  // Laptop base
  const lapBase = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.08,0.9), lam(0x5a6070));
  lapBase.position.set(0,1.04,0.05); deskG.add(lapBase);
  // Laptop screen
  const lapScreen = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.72,0.06), lam(0x3a4050));
  lapScreen.position.set(0,1.48,-0.4); lapScreen.rotation.x=-0.3; deskG.add(lapScreen);
  const screenGlo = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.62,0.05), bas(0x4a8cff,{transparent:true,opacity:0.9}));
  screenGlo.position.set(0,1.48,-0.37); screenGlo.rotation.x=-0.3; deskG.add(screenGlo);
  const screenHeart = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), bas(0xff5e9c));
  screenHeart.position.set(0,1.54,-0.34); screenHeart.rotation.x=-0.3; deskG.add(screenHeart);
  // Chair
  const chairG = new THREE.Group(); chairG.position.set(0,0,0.85); deskG.add(chairG);
  chairG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.08,0.9),lam(0xff9ec6)); m.position.y=0.58; return m; }());
  chairG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.5,0.08),lam(0xff9ec6)); m.position.set(0,0.87,-0.41); return m; }());
  [-0.38,0.38].forEach(x=>{ [-0.38,0.38].forEach(z=>{ const l=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.58,6),lam(0xa06840)); l.position.set(x,0.29,z); chairG.add(l); }); });
  intItems.push({ mesh: screenGlo, label: 'desk', lines: intMalekLines.desk, mats: null, storeKey: null, idx: 0 });

  // BOOKSHELF (back left)
  const shelfG = new THREE.Group(); shelfG.position.set(-3.8,0,-3.2); G.add(shelfG);
  shelfG.add(function(){ const m=new THREE.Mesh(new THREE.BoxGeometry(1.8,3.0,0.5),lam(0xb87340)); m.position.y=1.5; return m; }());
  for (let row = 0; row < 3; row++) {
    let bx = -0.72;
    for (let b = 0; b < 6; b++) {
      const bh = 0.34 + Math.random()*0.14;
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.16, bh, 0.36), lam(INT_BOOK_COLORS[b % INT_BOOK_COLORS.length]));
      bk.position.set(bx, 0.58 + row*0.88 + bh/2, 0.08); shelfG.add(bk);
      bx += 0.19 + Math.random()*0.04;
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.06,0.46), lam(0xa06238)); shelf.position.set(0, 0.5+row*0.88, 0.02); shelfG.add(shelf);
  }
  // Small plant on top
  const plantStem = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.22,8), lam(0x8a7a60)); plantStem.position.set(0.65,3.14,0.1); shelfG.add(plantStem);
  for (let i=0;i<5;i++) { const a=(i/5)*Math.PI*2; const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),lam(0x5cba6a)); leaf.position.set(0.65+Math.cos(a)*0.12,3.3,0.1+Math.sin(a)*0.12); shelfG.add(leaf); }
  intItems.push({ mesh: shelfG.children[1], label: 'shelf', lines: intMalekLines.shelf, mats: null, storeKey: null, idx: 0 });

  // FLOWER VASE (window sill)
  const vaseG = new THREE.Group(); vaseG.position.set(1.5,0,-4.6); G.add(vaseG);
  vaseG.add(function(){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.1,0.4,10),lam(0xff9ec6)); m.position.y=0.2; return m; }());
  const vaseMats = INT_VASE_COLORS.map(c=>lam(c));
  const vaseFl = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), vaseMats[+store.get('intVase',0)||0]);
  vaseFl.position.set(0,0.5,0); vaseG.add(vaseFl);
  const vaseStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.2,6), lam(0x5cba6a)); vaseStem.position.set(0,0.36,0); vaseG.add(vaseStem);
  intItems.push({ mesh: vaseFl, label: 'vase', lines: intMalekLines.vase, mats: vaseMats, storeKey: 'intVase', idx: +store.get('intVase',0)||0 });

  // Window sill
  const sill = new THREE.Mesh(new THREE.BoxGeometry(3.2,0.12,0.3), lam(0xffffff)); sill.position.set(0,1.15,-4.85); G.add(sill);

  // Lamp (corner)
  const lampG = new THREE.Group(); lampG.position.set(3.5,0,-3.5); G.add(lampG);
  lampG.add(function(){ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,1.5,8),lam(0xb06a30)); m.position.y=0.75; return m; }());
  lampG.add(function(){ const m=new THREE.Mesh(new THREE.ConeGeometry(0.28,0.32,12,1,true),lam(0xffd24a,{side:THREE.DoubleSide})); m.position.y=1.6; return m; }());
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), bas(0xffe8b0,{transparent:true,opacity:0.9})); bulb.position.set(0,1.48,0); lampG.add(bulb);

  // Decorative wall art (back wall)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.9,0.08), lam(0xb87340)); frame.position.set(-2,2.5,-4.82); G.add(frame);
  const art = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.7,0.06), bas(0xffe8f5)); art.position.set(-2,2.5,-4.78); G.add(art);
  const artHeart = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), bas(0xff5e9c)); artHeart.position.set(-2,2.55,-4.74); G.add(artHeart);

  // Build raycaster targets for tap detection
  intItems.forEach(it => { it.mesh.userData.intItem = it; });
}
buildInterior();

export function enterHouse() {
  S.insideHouse = true;
  S.state = 'house';
  S.intYaw = 0;
  $('housePrompt').classList.add('hidden');
  $('hud').classList.add('hidden');
  $('hud2').classList.add('hidden');
  $('mini').classList.add('hidden');
  $('swatBtn').classList.add('hidden');
  $('sprintBtn').classList.add('hidden'); $('stamWrap').classList.add('hidden'); S.sprintBtnHeld = false;
  $('kissBtn').classList.add('hidden');
  $('exitHouseBtn').classList.remove('hidden');
  $('interiorHint').classList.remove('hidden');
  $('interiorHint').style.opacity = 1;
  setTimeout(() => { $('interiorHint').style.opacity = 0; setTimeout(()=>$('interiorHint').classList.add('hidden'),600); }, 3200);
  malekSay('house', "Welcome to your cozy room! 🏠 I decorated it just for you 💕");
  sfx.click();
}

export function exitHouse() {
  S.insideHouse = false;
  S.state = 'playing';
  $('exitHouseBtn').classList.add('hidden');
  $('interiorHint').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hud2').classList.remove('hidden');
  $('mini').classList.remove('hidden');
  $('swatBtn').classList.remove('hidden');
  $('sprintBtn').classList.remove('hidden'); $('stamWrap').classList.remove('hidden');
  $('kissBtn').classList.remove('hidden');
  sfx.click();
  malekSay('houseOut', "Back to the meadow! Don't forget to pick flowers 🌸");
}

export function updateInteriorCamera() {
  const R = 5.5, H = 2.8;
  const cx = INT_ORIGIN.x + Math.sin(S.intYaw) * R;
  const cz = INT_ORIGIN.z + Math.cos(S.intYaw) * R;
  camera.position.set(cx, INT_ORIGIN.y + H, cz);
  camera.lookAt(INT_ORIGIN.x, INT_ORIGIN.y + 1.2, INT_ORIGIN.z);
}

export function tapInterior(clientX, clientY) {
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
  // cycle state
  if (item.mats && item.storeKey) {
    item.idx = (item.idx + 1) % item.mats.length;
    item.mesh.material = item.mats[item.idx];
    store.set(item.storeKey, item.idx);
  }
  burst(camera.position.clone().lerp(item.mesh.getWorldPosition(new THREE.Vector3()), 0.6), [0xff9ec6,0xffffff,0xffd24a], 8, 1.4, 1.0, 0.6);
  sfx.buy();
  malekSay(null, choice(item.lines));
  if (navigator.vibrate) navigator.vibrate(20);
}

$('housePrompt').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); enterHouse(); });
$('exitHouseBtn').addEventListener('click', () => { exitHouse(); });
