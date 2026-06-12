import { rand } from './utils.js';
import { S, profileId, setProfile } from './state.js';
import { renderer, scene, camera, clock } from './engine.js';
import { updateParticles } from './particles.js';
import { girl, malek, malekSay, malekChar } from './characters.js';
import { flowers } from './flowers.js';
import { bees, bunny, rainCloud, pickups, butterfly, crow } from './enemies.js';
import { stat } from './upgrades.js';
import {
  camFocus, gameplay, cosmetics, updateMalekUlt,
  startGame, setupLevel, levelCfg, renderShop, doSwat,
  blowKiss, triggerMalekUlt, _doLevelWon, refreshPlayBtn,
} from './gameplay.js';
import { refreshHud, setCtrl, exportSave, importSave } from './ui.js';
import { updateInteriorCamera } from './house.js';
import { updateOverworld, enterHub } from './hub.js';
// input.js / ui.js / house.js are pulled in transitively for their event wiring + scene setup

/* ============================== camera + main loop ============================== */
function updateCamera(dt) {
  if (S.insideHouse) { updateInteriorCamera(); return; }
  camFocus.lerp(girl.position, 1 - Math.exp(-5 * dt));
  S.shake = Math.max(0, S.shake - dt);
  const sx = S.shake > 0 ? rand(-1, 1) * S.shake * 0.5 : 0;
  const sy = S.shake > 0 ? rand(-1, 1) * S.shake * 0.5 : 0;
  camera.position.set(camFocus.x + sx, camFocus.y + 8.8 + sy, camFocus.z + 11.0);
  camera.lookAt(camFocus.x, 1.3, camFocus.z - 3.8);
}

function tick(dt) {
  S.animT += dt;
  if (S.state === 'playing') gameplay(dt);
  else if (S.state === 'hub' || S.state === 'shop' || S.state === 'house') updateOverworld(dt);
  updateMalekUlt(dt); // runs regardless of state so carry/kiss/leave survive the 'won' transition
  cosmetics(dt);
  updateParticles(dt);
  updateCamera(dt);
  refreshHud();
  renderer.render(scene, camera);
}
function frame() {
  requestAnimationFrame(frame);
  // clamp dt so a backgrounded tab/app can't inject a giant step on return,
  // and guard the whole frame so one bad frame can't kill the rAF loop.
  const dt = Math.max(0, Math.min(clock.getDelta(), 0.05));
  try { tick(dt); } catch (e) { console.error('tick error', e); }
}
camFocus.copy(girl.position);
frame();

// debug handle (used by automated tests; harmless in production)
window.__bb = {
  renderer, scene, camera, tick, girl, flowers, bees, bunny, rainCloud, pickups, butterfly, crow,
  startGame, setupLevel, levelCfg, stat, renderShop, doSwat, malekSay, malek,
  get state() { return S.state; }, set state(v) { S.state = v; },
  get progress() { return S.progress; }, get score() { return S.score; },
  get timeLeft() { return S.timeLeft; }, get hearts() { return S.hearts; },
  get petals() { return S.petals; }, set petals(v) { S.petals = v; S.hudDirty = true; },
  get upg() { return S.upg; }, get cfg() { return S.cfg; }, get level() { return S.level; },
  get shieldCharges() { return S.shieldCharges; }, get boostT() { return S.boostT; },
  get swatCd() { return S.swatCd; },
  get stamina() { return S.stamina; }, get exhausted() { return S.exhausted; }, get sprinting() { return S.sprinting; },
  set sprintBtnHeld(v) { S.sprintBtnHeld = v; },
  get ctrlMode() { return S.ctrlMode; }, setCtrl,
  get tapTarget() { return S.tapTarget; },
  blowKiss, triggerMalekUlt, malekChar,
  get malekCharge() { return S.malekCharge; }, set malekCharge(v) { S.malekCharge = v; },
  get ultActive() { return S.ultActive; }, get ultPhase() { return S.ultPhase; },
  get savedLevel() { return S.savedLevel; }, get profileId() { return profileId; },
  setProfile, _doLevelWon, refreshPlayBtn, exportSave, importSave, enterHub,
};
