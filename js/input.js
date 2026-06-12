import * as THREE from 'three';
import { clamp, $ } from './utils.js';
import { S } from './state.js';
import { renderer, camera } from './engine.js';
import { FIELD_R, inObstacle, pushOut } from './world.js';
import { girl } from './characters.js';
import { initAudio } from './audio.js';
import { tapMarker, doSwat, blowKiss } from './gameplay.js';
import { tapInterior } from './house.js';

/* ============================== input (3 control modes) ============================== */
const joyEl = $('joy'), knobEl = $('joyKnob');
let joyId = null, joyOX = 0, joyOY = 0, joyVX = 0, joyVY = 0;
let tapPointerId = null;
let intDragId = null, intDragPrevX = 0;
const JOY_R = 56;
export const raycaster = new THREE.Raycaster();

function showJoy(x, y) {
  joyEl.style.left = x + 'px'; joyEl.style.top = y + 'px';
  knobEl.style.transform = 'translate(-50%,-50%)';
  joyEl.classList.remove('hidden');
}
export function hideJoy() { joyEl.classList.add('hidden'); joyId = null; joyVX = joyVY = 0; }
function fixedBase() { return { x: 96, y: innerHeight - 116 }; }
export function showFixedJoy() { const b = fixedBase(); showJoy(b.x, b.y); }

function setTapTarget(e) {
  raycaster.setFromCamera({ x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 }, camera);
  const t = -raycaster.ray.origin.y / raycaster.ray.direction.y;
  if (t <= 0) return;
  let x = raycaster.ray.origin.x + raycaster.ray.direction.x * t;
  let z = raycaster.ray.origin.z + raycaster.ray.direction.z * t;
  // clamp to the active walkable area (meadow by default; hub/shop set S.walkCenter+walkR)
  const wc = S.walkCenter, cx = wc ? wc.x : 0, cz = wc ? wc.z : 0, R = S.walkR || FIELD_R;
  const dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz);
  if (r > R) { x = cx + dx / r * R; z = cz + dz / r * R; }
  if (S.state === 'playing') {
    const ob = inObstacle(x, z);
    if (ob) { const pos = { x, z }; pushOut(pos, ob); x = pos.x; z = pos.z; }
  }
  S.tapTarget = { x, z };
  tapMarker.position.set(x, 0.06, z);
  tapMarker.visible = true;
}

renderer.domElement.addEventListener('pointerdown', e => {
  // Interior mode: drag to orbit, tap to interact
  if (S.insideHouse) {
    initAudio();
    if (intDragId === null) { intDragId = e.pointerId; intDragPrevX = e.clientX; }
    return;
  }
  if (S.state !== 'playing' && S.state !== 'hub' && S.state !== 'shop') return;
  $('hint').style.opacity = 0;
  if (S.ctrlMode === 'tap') {
    if (tapPointerId === null) { tapPointerId = e.pointerId; setTapTarget(e); }
    return;
  }
  if (joyId !== null) return;
  if (S.ctrlMode === 'fixed') {
    const b = fixedBase();
    if (Math.hypot(e.clientX - b.x, e.clientY - b.y) > 150) return;
    joyId = e.pointerId; joyOX = b.x; joyOY = b.y;
    moveKnob(e);
  } else {
    joyId = e.pointerId; joyOX = e.clientX; joyOY = e.clientY;
    joyVX = joyVY = 0;
    showJoy(joyOX, joyOY);
  }
});
function moveKnob(e) {
  let dx = e.clientX - joyOX, dy = e.clientY - joyOY;
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
  knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joyVX = dx / JOY_R; joyVY = dy / JOY_R;
}
addEventListener('pointermove', e => {
  if (S.insideHouse) {
    if (e.pointerId === intDragId) { S.intYaw -= (e.clientX - intDragPrevX) * 0.008; intDragPrevX = e.clientX; }
    return;
  }
  if (e.pointerId === joyId) moveKnob(e);
  else if (S.ctrlMode === 'tap' && e.pointerId === tapPointerId &&
           (S.state === 'playing' || S.state === 'hub' || S.state === 'shop')) setTapTarget(e);
});
const endPointer = e => {
  if (S.insideHouse) {
    if (e.pointerId === intDragId) {
      // if barely moved, treat as a tap for interior item
      intDragId = null;
      tapInterior(e.clientX, e.clientY);
    }
    return;
  }
  if (e.pointerId === joyId) {
    if (S.ctrlMode === 'fixed') { joyId = null; joyVX = joyVY = 0; knobEl.style.transform = 'translate(-50%,-50%)'; }
    else hideJoy();
  }
  if (e.pointerId === tapPointerId) tapPointerId = null;
};
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);

export const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'KeyE') { e.preventDefault(); doSwat(); }
  if (e.code === 'KeyK') { e.preventDefault(); blowKiss(); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('contextmenu', e => e.preventDefault());

export function inputVec() {
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
  if (x || y) { const d = Math.hypot(x, y); return [x / d, y / d]; }
  if (S.ctrlMode === 'tap') {
    if (!S.tapTarget) return [0, 0];
    const dx = S.tapTarget.x - girl.position.x, dz = S.tapTarget.z - girl.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) { S.tapTarget = null; tapMarker.visible = false; return [0, 0]; }
    const mag = clamp(d / 2, 0.35, 1);
    return [dx / d * mag, dz / d * mag];
  }
  return [joyVX, joyVY];
}

// iOS Safari (and other mobile browsers) can suspend rAF/audio while backgrounded and drop
// pointerup/pointercancel events, leaving the joystick/sprint/keys latched. Reset cleanly.
export function resetStuckInput() {
  hideJoy();
  knobEl.style.transform = 'translate(-50%,-50%)';
  tapPointerId = null;
  intDragId = null;
  S.sprintBtnHeld = false;
  keys.clear();
}
