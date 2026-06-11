import * as THREE from 'three';
import { rand, choice, clamp, $, lerpAngle, easeOutBack, bas, tmpA, tmpB } from './utils.js';
import { store, S, MAX_HEARTS, SPRINT_MULT, STAM_DRAIN, STAM_REGEN, STAM_READY } from './state.js';
import { scene, SKIES, paintSky } from './engine.js';
import { FIELD_R, OBSTACLES, inObstacle, pushOut, duck, clouds } from './world.js';
import { burst, floatText, driftPetals } from './particles.js';
import {
  girl, girlRefs, girlShadow, malekChar, malekRestArms, setCarryArms, relaxGirlLimbs,
  malek, malekSay, updateMalek, malekReset, MALEK_PRAISE, MALEK_TIPS,
} from './characters.js';
import {
  FLOWER_COLORS, RAINBOW, flowers, spawnFlower, rollFlowerKind,
  removeFlower, clearFlowers, openFlowers,
} from './flowers.js';
import {
  bees, spawnBee, clearBees,
  bunny, bunnyEnter, bunnyHide, bunnyScare, updateBunny,
  rainCloud, cloudEnter, cloudHide, updateCloud,
  pickups, spawnPickup, removePickup, clearPickups,
  butterfly, spawnButterfly, hideButterfly,
  crow, crowEnter, crowHide, crowDrop, updateCrow,
} from './enemies.js';
import { UPGRADES, stat } from './upgrades.js';
import { tone, sfx } from './audio.js';
import { inputVec, showFixedJoy, hideJoy, keys } from './input.js';
import { drawMinimap } from './ui.js';

/* ============================== effect meshes ============================== */
const guideArrow = (() => {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 8), bas(0xff7ab0, { transparent: true, opacity: 0.85 }));
  cone.rotation.x = Math.PI / 2;
  g.add(cone);
  g.visible = false;
  scene.add(g);
  return g;
})();
export const tapMarker = (() => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 20), bas(0xff7ab0, { transparent: true, opacity: 0.8 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.visible = false;
  scene.add(m); return m;
})();
const swatRing = (() => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 28), bas(0xffb7d5, { transparent: true, opacity: 0 }));
  m.rotation.x = -Math.PI / 2; m.visible = false;
  scene.add(m); return m;
})();

export const camFocus = new THREE.Vector3();

/* ============================== Malek — the ULTIMATE 😎💻 (logic) ============================== */
const MALEK_ULT_CALL = [
  "Did somebody call the dev? 😎",
  "Malek.exe has entered the meadow 💻",
  "You blew me a kiss? I'm already here, habibti 💋",
  "Deploying myself to production 🚀",
];
const MALEK_ULT_BLAST = [
  "Check the gains 💪 field's all clear!",
  "Did you see that, habibti? 😎🔥",
  "I lift AND I code 💪💻 watch this!",
  "All yours, my love 💕 happy picking!",
  "Too easy 😤 flexed the bugs away!",
];

function kissTone() { tone(880, 0.12, 'sine', 0.13); tone(1245, 0.2, 'sine', 0.1, 0.07); }
function ultInTone() { [330, 440, 587, 784].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.08, i * 0.06)); }
function ultBlastTone() { [523, 659, 880, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, i * 0.05)); tone(1976, 0.6, 'sine', 0.13, 0.3); }

export function blowKiss() {
  if (S.state !== 'playing' || S.ultActive || S.stunned > 0 || S.kissCd > 0) return;
  S.kissCd = 0.85; S.kissAnimT = 0.55;
  const m = girl.position.clone(); m.y = 1.7;
  burst(m, [0xff6fa5, 0xff9ec6, 0xffffff], 9, 1.8, 2.4, 1.0, 1.0);
  floatText(girl.position.clone().setY(2.4), '😘', '');
  kissTone();
  if (navigator.vibrate) navigator.vibrate(20);
  if (S.malekCharge >= 1) triggerMalekUlt();
  else floatText(girl.position.clone().setY(2.0), `Malek ${Math.round(S.malekCharge * 100)}%`, 'time');
}

export function triggerMalekUlt() {
  S.ultActive = true; S.ultPhase = 'drop'; S.ultT = 0; S.ultDidBlast = false;
  S._ultTriggeredWin = false; S._carryTarget = null;
  S.malekCharge = 0; S.malekWasReady = false;
  S.invuln = Math.max(S.invuln, 99); // stay invincible through the whole ult
  const mc = malekChar;
  mc.landX = clamp(girl.position.x + 1.8, -FIELD_R + 2, FIELD_R - 2);
  mc.landZ = clamp(girl.position.z + 0.5, -FIELD_R + 2, FIELD_R - 2);
  mc.g.position.set(mc.landX, 10, mc.landZ);
  mc.g.scale.set(1, 1, 1); mc.g.rotation.set(0, 0, 0);
  malekRestArms();
  mc.g.visible = true; mc.shadow.visible = true;
  $('kissBtn').classList.remove('ready');
  malek.queue.length = 0; malek.showT = 0;
  malekSay('ultcall_' + Math.random(), choice(MALEK_ULT_CALL));
  ultInTone();
  if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
}

function _clearEnemies() {
  const fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  S.shake = 0.6;
  burst(malekChar.g.position.clone().setY(0.4), [0xe9dcc0, 0xffffff, 0xffe27a], 22, 4.2, 0.5, 0.7, 1.1);
  ultBlastTone();
  for (const b of bees) {
    burst(b.g.position.clone(), [0xffd24a, 0xfff3b0, 0xffffff], 8, 3.2, 2, 0.6);
    b.state = 'flee'; b.fleeT = 6; b.cooldown = rand(8, 12);
  }
  if (crow.active) { if (crow.state === 'carry') crowDrop(); else crow.state = 'fleeUp'; }
  if (bunny.active) bunnyScare();
  if (rainCloud.active) cloudHide();
  if (navigator.vibrate) navigator.vibrate(80);
}

function _findNearestFlower() {
  const open = openFlowers();
  if (!open.length) return null;
  let best = null, bestD = Infinity;
  const px = malekChar.g.position.x, pz = malekChar.g.position.z;
  for (const f of open) {
    const d = Math.hypot(f.g.position.x - px, f.g.position.z - pz);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

function endMalekUlt() {
  S.ultActive = false; S.ultPhase = ''; S.ultDidBlast = false;
  malekChar.g.visible = false; malekChar.shadow.visible = false;
  girl.rotation.z = 0; girl.rotation.y = 0;
}

export function updateMalekUlt(dt) {
  if (!S.ultActive) return;
  S.ultT += dt;
  const mc = malekChar;
  mc.aura.rotation.z += dt * 1.8;
  mc.aura.material.opacity = 0.4 + Math.sin(S.animT * 7) * 0.22;
  mc.glow.material.opacity = 0.08 + Math.sin(S.animT * 5) * 0.04;
  mc.glow.scale.setScalar(1 + Math.sin(S.animT * 4) * 0.06);
  mc.shadow.position.set(mc.g.position.x, 0.028, mc.g.position.z);

  /* --- drop from sky --- */
  if (S.ultPhase === 'drop') {
    mc.g.position.y = Math.max(0, mc.g.position.y - 28 * dt);
    mc.g.rotation.y += dt * 3;
    mc.shadow.material.opacity = clamp(0.32 - mc.g.position.y * 0.02, 0.05, 0.32);
    if (mc.g.position.y <= 0.001) {
      mc.g.position.set(mc.landX, 0, mc.landZ);
      mc.g.rotation.y = 0;
      _clearEnemies();
      S.ultPhase = 'pickup'; S.ultT = 0;
    }
    return;
  }

  mc.shadow.material.opacity = 0.3;

  /* --- reach arms out, scoop Ranooma up onto his front, upright --- */
  if (S.ultPhase === 'pickup') {
    mc.g.position.set(mc.landX, 0, mc.landZ); mc.g.scale.set(1, 1, 1);
    const k = Math.min(1, S.ultT / 0.5);
    const ease = k * k * (3 - 2 * k);
    setCarryArms(mc, ease);
    // girl rises off the ground, upright, snug against his front, facing the way he faces
    const fwd = new THREE.Vector3(Math.sin(mc.g.rotation.y), 0, Math.cos(mc.g.rotation.y));
    girl.position.x += (mc.g.position.x + fwd.x * 0.4 - girl.position.x) * Math.min(1, dt * 9);
    girl.position.z += (mc.g.position.z + fwd.z * 0.4 - girl.position.z) * Math.min(1, dt * 9);
    girl.position.y = ease * 0.55;
    girl.rotation.x = 0; girl.rotation.z = 0;
    girl.rotation.y = mc.g.rotation.y;
    relaxGirlLimbs(dt);
    girl.visible = true;
    if (S.ultT > 0.55) {
      S._carryTarget = _findNearestFlower();
      S.ultPhase = 'carry'; S.ultT = 0;
      malekSay('ultcarry_' + Math.random(), "Hold on tight, ya amar 💕 I've got every flower for you! 🌸");
    }
    return;
  }

  /* --- carry Ranooma upright, zoom to flowers until the level's met --- */
  if (S.ultPhase === 'carry') {
    girl.visible = true;
    // running legs
    mc.legs[0].rotation.x = -Math.sin(S.ultT * 12) * 1.05;
    mc.legs[1].rotation.x =  Math.sin(S.ultT * 12) * 1.05;
    mc.g.position.y = Math.abs(Math.sin(S.ultT * 12)) * 0.14;
    mc.g.scale.set(1, 1, 1);
    setCarryArms(mc, 1);

    if (S._carryTarget && !S._carryTarget.picked) {
      const tx = S._carryTarget.g.position.x, tz = S._carryTarget.g.position.z;
      const dx = tx - mc.g.position.x, dz = tz - mc.g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.9) {
        const sp = 19 * dt;
        mc.g.position.x += (dx / dist) * sp;
        mc.g.position.z += (dz / dist) * sp;
        mc.g.rotation.y = Math.atan2(dx, dz);
      } else {
        if (S.state === 'playing') pickFlower(S._carryTarget);
        // stop collecting the moment the level's flower goal is met
        S._carryTarget = (S.progress >= S.need) ? null : _findNearestFlower();
      }
    } else {
      S._carryTarget = (S.progress >= S.need) ? null : _findNearestFlower();
    }

    // girl rides upright, tucked against Malek's front, facing the way he runs
    const fwd = new THREE.Vector3(Math.sin(mc.g.rotation.y), 0, Math.cos(mc.g.rotation.y));
    girl.position.x = mc.g.position.x + fwd.x * 0.4;
    girl.position.y = mc.g.position.y + 0.5;
    girl.position.z = mc.g.position.z + fwd.z * 0.4;
    girl.rotation.x = 0; girl.rotation.z = 0;
    girl.rotation.y = mc.g.rotation.y;
    relaxGirlLimbs(dt);

    // heart trail
    if (Math.random() < dt * 5)
      burst(girl.position.clone(), [0xff6fa5, 0xff9ec6, 0xffffff], 2, 1.4, 1.8, 0.5, 0.6);

    if (!S._carryTarget) { S.ultPhase = 'kiss'; S.ultT = 0; }
    return;
  }

  /* --- kiss scene 💋 --- */
  if (S.ultPhase === 'kiss') {
    mc.g.scale.set(1, 1, 1);
    mc.legs[0].rotation.x *= 0.8; mc.legs[1].rotation.x *= 0.8;
    mc.g.position.y = 0;

    // both turn to face each other as girl steps down beside Malek
    mc.g.rotation.y = lerpAngle(mc.g.rotation.y, Math.PI / 2, Math.min(1, dt * 6));
    girl.rotation.y = lerpAngle(girl.rotation.y, -Math.PI / 2, Math.min(1, dt * 6));
    girl.position.x += (mc.g.position.x + 0.52 - girl.position.x) * Math.min(1, dt * 5);
    girl.position.y += (0 - girl.position.y) * Math.min(1, dt * 7);
    girl.position.z += (mc.g.position.z - 0.08 - girl.position.z) * Math.min(1, dt * 5);
    girl.visible = true;
    relaxGirlLimbs(dt);

    // lean toward each other
    const lean = Math.min(1, S.ultT / 0.55);
    girl.rotation.z = -lean * 0.24;
    mc.g.rotation.z = lean * 0.20;

    // Malek's near arm wraps around girl's back, far arm relaxed at his side
    mc.arms[0].sh.rotation.z = 0.9;  mc.arms[0].sh.rotation.x = -0.45; mc.arms[0].elbow.rotation.x = -0.6;
    mc.arms[1].sh.rotation.z = -0.28; mc.arms[1].sh.rotation.x = -0.1; mc.arms[1].elbow.rotation.x = -0.3;

    // continuous heart burst
    if (Math.random() < dt * 9) {
      const hp = new THREE.Vector3(
        (mc.g.position.x + girl.position.x) * 0.5,
        1.9 + Math.random() * 0.6,
        (mc.g.position.z + girl.position.z) * 0.5);
      burst(hp, [0xff4488, 0xff9ec6, 0xffa0cc, 0xffffff], 3, 1.6, 2.4, 0.9, 0.7);
    }

    // 💋 pop at the moment of the kiss
    if (S.ultT > 0.52 && S.ultT < 0.62) {
      floatText(new THREE.Vector3(
        (mc.g.position.x + girl.position.x) * 0.5,
        2.6,
        (mc.g.position.z + girl.position.z) * 0.5), '💋', '');
      kissTone(); kissTone();
    }

    if (S.ultT > 2.4) { S.ultPhase = 'setdown'; S.ultT = 0; }
    return;
  }

  /* --- gently set her down --- */
  if (S.ultPhase === 'setdown') {
    const k = Math.min(1, S.ultT / 0.4);
    mc.g.rotation.z = (1 - k) * 0.20;
    girl.rotation.z = -(1 - k) * 0.24;
    girl.rotation.y = lerpAngle(girl.rotation.y, 0, Math.min(1, dt * 4));
    girl.position.y = (1 - k) * 0.15;
    malekRestArms();
    girl.visible = true;
    if (S.ultT > 0.45) {
      girl.rotation.z = 0; girl.rotation.y = 0; mc.g.rotation.z = 0; girl.position.y = 0;
      // trigger the level win if all flowers were collected during carry
      if (S._ultTriggeredWin) {
        S._ultTriggeredWin = false;
        _doLevelWon(true);   // pass true = don't call endMalekUlt yet
      }
      S.ultPhase = 'leave'; S.ultT = 0;
    }
    return;
  }

  /* --- heroic exit --- */
  if (S.ultPhase === 'leave') {
    mc.g.position.y += 10 * dt;
    mc.g.rotation.y += dt * 4;
    mc.g.scale.multiplyScalar(Math.max(0.001, 1 - dt * 1.1));
    if (S.ultT > 0.8) endMalekUlt();
  }
}

/* ============================== game state ============================== */
S.cfg = levelCfg(1);

export function levelCfg(n) {
  const rush = n % 4 === 0;
  if (rush) return {
    rush: true, need: 12, time: 28 + Math.round(stat.extraTime() * 0.5),
    maxField: 14, lifespan: 5.5, bees: 0, wasps: 0,
    bunny: false, cloud: false, crow: false, beeChase: 0, cloudSpeed: 0, nibble: 99, spawnCd: 0.32,
  };
  const need = 8 + 2 * n;
  return {
    rush: false, need,
    time: Math.round(34 + need * 2.6 - Math.min(n, 8)) + stat.extraTime(),
    maxField: Math.min(8 + n, 16),
    lifespan: Math.max(13 - n * 0.6, 7),
    bees: Math.min(1 + Math.floor(n / 2), 6),
    wasps: n >= 5 ? Math.min(Math.floor((n - 3) / 2), 3) : 0,
    bunny: n >= 2, cloud: n >= 3, crow: n >= 6,
    beeChase: Math.min(3.3 + n * 0.15, 5.2),
    cloudSpeed: Math.min(1.1 + n * 0.06, 1.9),
    nibble: Math.max(1.0, 1.9 - n * 0.09),
    spawnCd: 0.5,
  };
}

export function setupLevel(n) {
  S.level = n; S.cfg = levelCfg(n);
  clearFlowers(false); clearBees(); clearPickups(); hideButterfly(); bunnyHide(); cloudHide(); crowHide();
  for (let i = 0; i < S.cfg.bees; i++) spawnBee(false);
  for (let i = 0; i < S.cfg.wasps; i++) spawnBee(true);
  if (S.cfg.bunny) { bunnyEnter(); malekSay('bunny', "That bunny 🐰 munches your flowers — walk at it or SWAT to shoo it!"); }
  if (S.cfg.cloud) { malekSay('cloud', "I made that cloud on a sad day 🌧️ don't stand under it, it slows you!"); }
  if (S.cfg.cloud) cloudEnter();
  if (S.cfg.wasps) malekSay('wasp', "Orange wasps are meaner than bees. Run, habibti! 🏃‍♀️");
  S.progress = 0; S.need = S.cfg.need;
  S.timeMax = S.timeLeft = S.cfg.time;
  S.combo = 0; S.lastPickAt = -99; S.stunned = 0; S.invuln = 0; S.shake = 0; S.boostT = 0;
  S.swatCd = 0; S.swatAnimT = 0; S.lowTimeWarned = false; S.idleWarned = false; S.lastMoveT = S.gameT;
  S.sprintBtnHeld = false; S.stamina = 1; S.exhausted = false; S.sprinting = false;
  S.kissCd = 0; S.kissAnimT = 0; if (S.ultActive) endMalekUlt();   // charge persists across levels
  S.shieldCharges = S.upg.shield;
  girlRefs.bubble.visible = S.shieldCharges > 0;
  S.spawnCd = 0;
  girl.position.set(0, 0, 0); girl.rotation.set(0, 0, 0); girl.visible = true;
  S.tapTarget = null; tapMarker.visible = false;
  for (let i = 0; i < 7; i++) spawnFlower(S.cfg.rush ? 'golden' : 'normal');
  S.nextButterflyAt = S.gameT + rand(7, 12);
  S.nextPickupAt = S.gameT + rand(9, 15);
  S.nextCrowAt = S.gameT + rand(10, 16);
  S.nextTipAt = S.gameT + rand(20, 30);
  if (S.cfg.rush) malekSay('rush' + n, "GOLDEN RUSH ✨ I filled the field with gold, just for you. GO GO GO!");
  paintSky(S.cfg.rush ? SKIES.rush : [SKIES.noon, SKIES.morning, SKIES.sunset][(n - 1) % 3]);
  S.hudDirty = true;
}

function startCountdown(then) {
  S.state = 'count';
  $('lvlBanner').textContent = S.cfg.rush ? '✨ GOLDEN RUSH! ✨' : `Level ${S.level}`;
  const seq = ['3', '2', '1', 'GO!'];
  let i = 0;
  const step = () => {
    if (S.state !== 'count') return;
    if (i < seq.length) {
      $('countNum').innerHTML = `<span>${seq[i]}</span>`;
      sfx.count(seq[i] === 'GO!');
      i++; setTimeout(step, 750);
    } else { $('countNum').innerHTML = ''; $('lvlBanner').textContent = ''; then(); }
  };
  step();
}

const CTRL_HINTS = { stick: 'Drag anywhere to walk! 👉', fixed: 'Use the stick to walk! 🎮', tap: 'Tap where Ranooma should go! 👆' };
export function startGame(fromLevel, fresh = fromLevel === 1) {
  if (fresh) {
    S.score = 0; S.totalPicked = 0; S.petals = 0; S.hearts = MAX_HEARTS;
    S.upg = { shoes: 0, basket: 0, wand: 0, charm: 0, time: 0, lucky: 0, shield: 0 };
    S.malekCharge = 0; S.malekWasReady = false;
    malekReset();
    malekSay('hi', "Hey Ranooma 💕 welcome to the meadow I coded for you!");
    malekSay('hi2', CTRL_HINTS[S.ctrlMode] + " Tap 💫 to swat!");
  }
  setupLevel(fromLevel);
  hideAllScreens();
  $('hud').classList.remove('hidden');
  $('hud2').classList.remove('hidden');
  $('mini').classList.remove('hidden');
  $('swatBtn').classList.remove('hidden');
  $('sprintBtn').classList.remove('hidden'); $('stamWrap').classList.remove('hidden');
  $('kissBtn').classList.remove('hidden');
  if (fresh) { $('hint').textContent = CTRL_HINTS[S.ctrlMode]; $('hint').classList.remove('hidden'); $('hint').style.opacity = 1;
    malekSay('sprint', "Hold 💨 (or press Shift on PC) to sprint — but you'll get tired, so pace yourself! 🏃‍♀️"); }
  startCountdown(() => { S.state = 'playing'; if (S.ctrlMode === 'fixed') showFixedJoy(); });
}

function levelWon() {
  // while Malek is carrying Ranooma, hold the win until after the kiss
  if (S.ultActive) { S._ultTriggeredWin = true; return; }
  _doLevelWon(false);
}
export function _doLevelWon(fromUlt) {
  S.state = 'won'; S.winT = 0;
  const bonus = Math.round(S.timeLeft) * 5;
  const petalBonus = 2 + S.level;
  S.score += bonus; S.petals += petalBonus;
  S.hearts = Math.min(MAX_HEARTS, S.hearts + 1);
  S.best = Math.max(S.best, S.score); store.set('best', S.best);
  S.bestLvl = Math.max(S.bestLvl, S.level); store.set('bestlvl', S.bestLvl);
  S.savedLevel = Math.max(S.savedLevel, S.level + 1); store.set('curlevel', S.savedLevel);
  sfx.win();
  if (!fromUlt) endMalekUlt(); // let ult finish its leave animation on its own
  clearFlowers(true); clearPickups(); crowHide();
  const pos = girl.position.clone().setY(1.5);
  burst(pos, FLOWER_COLORS, 26, 3.4, 2.6, 1.1, 1.2);
  hideJoy();
  S._winShopData = {
    title: S.cfg.rush ? `Golden Rush done! ✨` : `Level ${S.level} clear! 🎉`,
    sub: `⏱️ +${bonus} time bonus · 🌸 +${petalBonus} petals · 💗 +1 heart`,
    nextLevel: S.level + 1,
  };
  const delay = fromUlt ? 1800 : 900; // extra breathing room after the kiss scene
  setTimeout(() => {
    if (S.state !== 'won') return;
    $('malekWinTitle').textContent = S._winShopData.title;
    $('malekWinSub').innerHTML = S._winShopData.sub;
    $('malekWinMsg').textContent = fromUlt
      ? choice(["Every flower, just for you 💕😘", "You felt that? I coded it 😎💘", "Level clear AND a kiss — best day ever 💋✨"])
      : choice(MALEK_PRAISE);
    $('malekWin').classList.remove('hidden');
  }, delay);
}
export function previewLine(n) {
  const c = levelCfg(n);
  if (c.rush) return `Next: ✨ GOLDEN RUSH ✨ — all golden, no enemies, be quick!`;
  let s = `Next: 🌼×${c.need} · 🐝×${c.bees}`;
  if (c.wasps) s += ` · 🟠×${c.wasps}`;
  if (c.bunny) s += ' · 🐰';
  if (c.cloud) s += ' · 🌧️';
  if (c.crow) s += ' · 🐦‍⬛';
  return s;
}

function gameOver(reason) {
  S.state = 'over';
  S.best = Math.max(S.best, S.score); store.set('best', S.best);
  S.bestLvl = Math.max(S.bestLvl, S.level); store.set('bestlvl', S.bestLvl);
  sfx.lose();
  hideJoy(); endMalekUlt();
  setTimeout(() => {
    if (S.state !== 'over') return;
    $('overDeco').innerHTML = reason === 'stung'
      ? '<span>🐝</span><span>😵</span><span>🐝</span>' : '<span>🥀</span><span>😢</span><span>🥀</span>';
    $('overTitle').textContent = reason === 'stung' ? 'Too many stings!' : "Time's up!";
    $('overScore').textContent = `⭐ ${S.score}`;
    $('overStats').innerHTML =
      `🌼 ${S.totalPicked} flowers · reached level ${S.level}<br>🏆 Best: ${S.best} (level ${S.bestLvl})<br><small>petals &amp; upgrades reset 🌸</small>`;
    $('overScreen').classList.remove('hidden');
  }, 1000);
}

export function toMenu() {
  S.state = 'menu';
  endMalekUlt();
  clearFlowers(false); clearBees(); clearPickups(); hideButterfly(); bunnyHide(); cloudHide(); crowHide();
  girl.position.set(0, 0, 0); girl.rotation.set(0, 0, 0); girl.visible = true;
  girlRefs.bubble.visible = false;
  S.tapTarget = null; tapMarker.visible = false;
  paintSky(SKIES.noon);
  hideAllScreens();
  $('hud').classList.add('hidden'); $('hud2').classList.add('hidden');
  $('mini').classList.add('hidden'); $('swatBtn').classList.add('hidden');
  $('sprintBtn').classList.add('hidden'); $('stamWrap').classList.add('hidden'); S.sprintBtnHeld = false;
  $('kissBtn').classList.add('hidden');
  $('malek').classList.remove('show');
  refreshBestLine();
  refreshPlayBtn();
  $('titleScreen').classList.remove('hidden');
}
function hideAllScreens() {
  ['titleScreen', 'levelScreen', 'overScreen', 'pauseScreen'].forEach(id => $(id).classList.add('hidden'));
  $('saveModal').classList.add('hidden');
  $('malekWin').classList.add('hidden');
  $('hint').classList.add('hidden');
  $('housePrompt').classList.add('hidden');
  S.housePromptVisible = false;
  hideJoy();
}
export function refreshBestLine() {
  if (S.best > 0) {
    $('bestLine').textContent = `🏆 Best: ${S.best} · reached level ${S.bestLvl}`;
    $('bestLine').classList.remove('hidden');
  }
}
export function refreshPlayBtn() {
  if (S.savedLevel > 1) {
    $('playBtn').textContent = `▶ Continue (Lv ${S.savedLevel})`;
    $('newGameBtn').classList.remove('hidden');
  } else {
    $('playBtn').textContent = '▶ Play';
    $('newGameBtn').classList.add('hidden');
  }
}

/* ============================== shop ============================== */
export function renderShop() {
  $('petalBal').textContent = `🌸 ${S.petals} petals`;
  const grid = $('shopGrid');
  grid.innerHTML = '';
  for (const [key, u] of Object.entries(UPGRADES)) {
    const tier = S.upg[key];
    const maxed = tier >= u.costs.length;
    const cost = maxed ? null : u.costs[tier];
    const card = document.createElement('button');
    card.className = 'shopCard' + (maxed ? ' maxed' : (S.petals < cost ? ' cant' : ''));
    card.innerHTML = `<div class="em">${u.emoji}</div><div class="nm">${u.name}</div>` +
      `<div class="ds">${u.desc}</div>` +
      `<div class="pips">${'●'.repeat(tier)}${'○'.repeat(u.costs.length - tier)}</div>` +
      `<div class="cost">${maxed ? 'MAX ✓' : '🌸 ' + cost}</div>`;
    card.addEventListener('click', () => {
      if (maxed || S.petals < cost) { tone(220, 0.1, 'square', 0.06); return; }
      S.petals -= cost; S.upg[key]++;
      sfx.buy();
      S.hudDirty = true;
      renderShop();
    });
    grid.appendChild(card);
  }
}

/* ============================== picking / hits / swat ============================== */
const basketWorld = new THREE.Vector3();
function pickFlower(f) {
  f.picked = true; f.pickT = 0;
  f.fromPos = f.g.position.clone();
  f.curScale = f.g.scale.x;
  if (S.gameT - S.lastPickAt < 4) S.combo = Math.min(S.combo + 1, 6); else S.combo = 1;
  S.lastPickAt = S.gameT;
  const basePts = f.rainbow ? 50 : f.golden ? (S.cfg.rush ? 15 : 30) : 10;
  const pts = basePts * S.combo;
  S.score += pts;
  S.progress += f.rainbow ? 3 : f.golden ? (S.cfg.rush ? 1 : 2) : 1;
  S.petals += f.rainbow ? 6 : f.golden ? (S.cfg.rush ? 2 : 3) : 1;
  S.totalPicked++;
  S.timeLeft = Math.min(S.timeLeft + (f.rainbow ? 3 : f.golden ? 2.5 : 1.2), S.timeMax);
  const headPos = f.g.position.clone().setY(0.8);
  burst(headPos,
    f.rainbow ? RAINBOW : f.golden ? [0xffd24a, 0xfff3b0, 0xffffff] : [f.baseColor.getHex(), 0xffffff, 0xffe066],
    f.rainbow ? 18 : 12, 2.4, 1.8, 0.7);
  f.rainbow ? sfx.rainbow() : f.golden ? sfx.gold() : sfx.pick(S.combo);
  floatText(headPos, `+${pts}`, f.rainbow ? 'rainbow' : f.golden ? 'gold' : '');
  if (S.combo >= 2) {
    const c = $('combo');
    c.textContent = S.combo >= 4 ? `Combo x${S.combo}! ✨🌟` : `Combo x${S.combo}! ✨`;
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  }
  if (S.combo >= 5) malekSay('combo5', "x5 combo?! That's MY girlfriend, everyone 😎💘");
  if (f.rainbow) malekSay(null, "A RAINBOW one!! Lucky girl 🌈😍");
  if ((f.golden || f.rainbow) && navigator.vibrate) navigator.vibrate(25);
  // charge the Malek ultimate — slowly (hard to call!)
  if (!S.ultActive) {
    S.malekCharge = Math.min(1, S.malekCharge + (f.rainbow ? 0.16 : f.golden ? 0.09 : 0.04));
    if (S.malekCharge >= 1 && !S.malekWasReady) {
      S.malekWasReady = true;
      malekSay('ultready', "I'm charged up 😎💪 blow me a kiss (💋) to call me in!");
      tone(784, 0.1, 'triangle', 0.14); tone(1175, 0.22, 'triangle', 0.13, 0.08);
    }
  }
  S.hudDirty = true;
  if (S.progress >= S.need) levelWon();
}

function collectPickup(p) {
  const pos = p.g.position.clone().setY(0.9);
  if (p.type === 'clover') {
    S.boostT = 5.5;
    sfx.clover();
    burst(pos, [0x4fae5c, 0xa0e8a0, 0xffffff], 12, 2.4, 1.8, 0.8);
    floatText(pos, 'Zoom! 🍀', 'time');
  } else if (p.type === 'heart') {
    S.hearts = Math.min(MAX_HEARTS, S.hearts + 1);
    sfx.heart();
    burst(pos, [0xff6fa5, 0xffc9e8, 0xffffff], 12, 2.4, 1.8, 0.8);
    floatText(pos, '+💗', '');
  } else { // gift
    sfx.gift();
    burst(pos, [0xff8fb7, 0xc9a0ff, 0xfff3b0], 16, 2.6, 2, 0.9);
    const roll = Math.random();
    if (roll < 0.3) { S.petals += 10; floatText(pos, '+10 🌸', 'gold'); }
    else if (roll < 0.55) { S.score += 50; floatText(pos, '+50 ⭐', 'gold'); }
    else if (roll < 0.8) { S.timeLeft = Math.min(S.timeLeft + 8, S.timeMax); floatText(pos, '+8s ⏱️', 'time'); }
    else { S.shieldCharges++; girlRefs.bubble.visible = true; floatText(pos, '🛡️ Shield!', 'time'); }
    malekSay('gift', "Found one of my gift boxes! 🎁 I hid a few around~");
  }
  S.hudDirty = true;
  removePickup(p);
}

export function doSwat() {
  if (S.state !== 'playing' || S.swatCd > 0 || S.stunned > 0) return;
  S.swatCd = stat.swatCd(); S.swatAnimT = 0.32; S.swatArmT = 0.42;
  sfx.swat();
  const R = stat.swatR();
  let hit = 0;
  for (const b of bees) {
    const d = Math.hypot(b.g.position.x - girl.position.x, b.g.position.z - girl.position.z);
    if (d < R + 0.4 && b.state !== 'flee') {
      b.state = 'flee'; b.fleeT = 1.8; b.cooldown = rand(5, 6.5);
      burst(b.g.position.clone(), [0xffd24a, 0xffffff], 8, 3, 2, 0.6);
      S.score += 5; hit++;
      if (S.upg.wand >= 2) { S.petals += 1; }
      floatText(b.g.position.clone().setY(1.6), S.upg.wand >= 2 ? '+5 ⭐ +1🌸' : '+5 ⭐', 'gold');
    }
  }
  if (bunny.active && Math.hypot(bunny.g.position.x - girl.position.x, bunny.g.position.z - girl.position.z) < R + 0.8) {
    bunnyScare(); hit++;
  }
  if (crow.active && crow.g.position.y < 2.5 &&
      Math.hypot(crow.g.position.x - girl.position.x, crow.g.position.z - girl.position.z) < R + 1) {
    if (crowDrop()) hit++;
    else if (crow.state === 'fly') { crow.state = 'fleeUp'; hit++; }
  }
  if (hit) { sfx.swatHit(); if (navigator.vibrate) navigator.vibrate(30); S.hudDirty = true; }
}

function hitGirl(bee) {
  if (S.invuln > 0 || S.state !== 'playing') return;
  if (S.shieldCharges > 0) {
    S.shieldCharges--;
    girlRefs.bubble.visible = S.shieldCharges > 0;
    S.invuln = 1.6;
    sfx.shield();
    burst(girl.position.clone().setY(1.2), [0xff9ec6, 0xffffff], 14, 2.8, 1.8, 0.8);
    floatText(girl.position.clone().setY(2.2), 'Shield! 🛡️', 'time');
    bee.state = 'flee'; bee.fleeT = 1.2; bee.cooldown = rand(4, 5.5);
    return;
  }
  S.stunned = 1.2; S.invuln = 2.8; S.shake = 0.4; S.combo = 0;
  S.hearts--;
  if (S.progress > 0) {
    S.progress--;
    floatText(girl.position.clone().setY(2.2), '-1 🌸', 'bad');
    burst(girl.position.clone().setY(1.4), [0xff8fb7, 0xffffff], 8, 2.6, 1.6, 0.8);
  } else {
    floatText(girl.position.clone().setY(2.2), 'Ouch!', 'bad');
  }
  S.score = Math.max(0, S.score - 5);
  sfx.bee();
  if (navigator.vibrate) navigator.vibrate(90);
  bee.state = 'flee'; bee.fleeT = 1.2; bee.cooldown = rand(4, 5.5);
  S.hudDirty = true;
  malekSay('sting1', "Ranooma!! You okay?? 😖 Swat them before they get close!");
  if (S.hearts === 1) malekSay('lastheart', "Last heart!! Careful habibti, my heart can't take it either 🙈💕");
  if (S.hearts <= 0) gameOver('stung');
}

/* ============================== gameplay update ============================== */
export function gameplay(dt) {
  S.gameT += dt;
  if (!S.ultActive) S.timeLeft -= dt;            // Malek freezes the clock while he's here 😎
  if (S.timeLeft <= 0) { S.timeLeft = 0; gameOver('time'); return; }
  if (S.timeLeft < 10 && !S.lowTimeWarned && !S.ultActive) { S.lowTimeWarned = true; malekSay(null, "10 seconds left babe, hurry!! ⏰"); }
  S.stunned = Math.max(0, S.stunned - dt);
  S.invuln = Math.max(0, S.invuln - dt);
  S.boostT = Math.max(0, S.boostT - dt);
  S.swatCd = Math.max(0, S.swatCd - dt);
  S.kissCd = Math.max(0, S.kissCd - dt);

  /* --- movement --- */
  const [ix, iy] = inputVec();
  const ilen = Math.hypot(ix, iy);
  S.moving = false;
  // sprint stamina: drain while sprinting, recover otherwise; lock out when exhausted until refilled past STAM_READY
  const wantSprint = (S.sprintBtnHeld || keys.has('ShiftLeft') || keys.has('ShiftRight'));
  S.sprinting = wantSprint && ilen > 0.12 && S.stunned <= 0 && !S.exhausted && S.stamina > 0;
  if (S.sprinting) {
    S.stamina -= STAM_DRAIN * dt;
    if (S.stamina <= 0) {
      S.stamina = 0; S.exhausted = true; S.sprinting = false;
      sfx.poof(); if (navigator.vibrate) navigator.vibrate(40);
      floatText(girl.position.clone().setY(2.2), 'tired! 😮‍💨', 'bad');
      malekSay('tired', "Catch your breath, habibti 😮‍💨 sprint recharges when you slow down!");
    }
  } else {
    S.stamina = Math.min(1, S.stamina + STAM_REGEN * dt);
    if (S.exhausted && S.stamina >= STAM_READY) S.exhausted = false;
  }
  if (ilen > 0.12 && S.stunned <= 0) {
    S.moving = true;
    S.lastMoveT = S.gameT;
    const sp = stat.speed() * (S.sprinting ? SPRINT_MULT : 1);
    girl.position.x += ix * sp * dt;
    girl.position.z += iy * sp * dt;
    if (S.sprinting && Math.random() < dt * 18)
      burst(girl.position.clone().setY(0.2), [0xffffff, 0xd0f0ff], 1, 0.9, 0.7, 0.4, 0.7);
    const pr = Math.hypot(girl.position.x, girl.position.z);
    if (pr > FIELD_R) { girl.position.x *= FIELD_R / pr; girl.position.z *= FIELD_R / pr; }
    const ob = inObstacle(girl.position.x, girl.position.z);
    if (ob) {
      pushOut(girl.position, ob);
      if (ob.pond) malekSay('pond', "No swimming!! I didn't code water physics 😂");
    }
    const target = Math.atan2(ix, iy);
    girl.rotation.y = lerpAngle(girl.rotation.y, target, 1 - Math.exp(-12 * dt));
    S.walkT += dt * (4 + 6 * Math.min(ilen, 1));
    if (S.boostT > 0 && Math.random() < dt * 14)
      burst(girl.position.clone().setY(0.25), [0xa0e8a0, 0x4fae5c], 1, 0.8, 0.8, 0.45, 0.7);
  } else if (S.gameT - S.lastMoveT > 8 && !S.idleWarned && S.state === 'playing') {
    S.idleWarned = true;
    malekSay(null, "Ranoomaaa, you there? The flowers miss you (me too) 🥺");
  }

  /* --- flower spawning --- */
  S.spawnCd -= dt;
  if (openFlowers().length < S.cfg.maxField && S.spawnCd <= 0) {
    spawnFlower(rollFlowerKind());
    S.spawnCd = S.cfg.spawnCd;
  }

  /* --- flowers: wilt, pick, fly-to-basket --- */
  girlRefs.basket.getWorldPosition(basketWorld);
  const pickR = stat.pickR();
  for (let i = flowers.length - 1; i >= 0; i--) {
    const f = flowers[i];
    if (f.carried) continue; // crow has it
    if (f.picked) {
      f.pickT += dt;
      const k = f.pickT / 0.28;
      if (k >= 1) { removeFlower(f); continue; }
      f.g.position.lerpVectors(f.fromPos, basketWorld, k * k);
      f.g.scale.setScalar(Math.max(0.001, (1 - k) * f.curScale));
      continue;
    }
    if (rainCloud.active &&
        Math.hypot(f.g.position.x - rainCloud.g.position.x, f.g.position.z - rainCloud.g.position.z) < rainCloud.R)
      f.ageBoost += dt * 1.6;
    const t = (S.gameT - f.born + f.ageBoost) / f.lifespan;
    if (t >= 1) {
      burst(f.g.position.clone().setY(0.5), [0xa8b08a, 0x8a9b78], 6, 1.4, 1.2, 0.6, 0.8);
      sfx.poof();
      removeFlower(f);
      continue;
    }
    f.wiltK = t > 0.62 ? (t - 0.62) / 0.38 : 0;
    if (f.wiltK > 0) {
      f.head.rotation.x = f.wiltK * 1.05;
      if (!f.rainbow) f.petalMat.color.copy(f.baseColor).lerp(new THREE.Color(0x9b8d72), f.wiltK * 0.85);
    }
    if (S.stunned <= 0 &&
        Math.hypot(f.g.position.x - girl.position.x, f.g.position.z - girl.position.z) < pickR) {
      pickFlower(f);
      if (S.state !== 'playing') return;
    }
  }

  /* --- pickups --- */
  if (S.gameT > S.nextPickupAt && pickups.length < 2 && S.level >= 2 && !S.cfg.rush) {
    const roll = Math.random();
    spawnPickup(S.hearts < MAX_HEARTS && roll < 0.4 ? 'heart' : (S.level >= 3 && roll < 0.7 ? 'gift' : 'clover'));
    S.nextPickupAt = S.gameT + rand(12, 18);
  }
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (S.gameT - p.born > 12) {
      burst(p.g.position.clone().setY(0.5), 0xffffff, 5, 1.4, 1.2, 0.5, 0.7);
      removePickup(p); continue;
    }
    if (S.stunned <= 0 &&
        Math.hypot(p.g.position.x - girl.position.x, p.g.position.z - girl.position.z) < pickR) {
      collectPickup(p);
    }
  }

  /* --- bees & wasps --- */
  const aggroR = stat.aggro();
  for (const b of bees) {
    b.t += dt; b.cooldown -= dt;
    if (S.ultActive) {
      // Malek's ult keeps every bee scared off — no stings reach him or Ranooma
      b.state = 'flee'; b.fleeT = 1.5;
      tmpB.copy(b.g.position).sub(girl.position).setY(0).normalize().multiplyScalar(5).add(b.g.position);
      tmpB.y = 2.2;
      moveBee(b, tmpB, 4.5, dt);
      continue;
    }
    const distGirl = b.g.position.distanceTo(tmpA.copy(girl.position).setY(b.g.position.y));
    const chaseSpd = (S.cfg.beeChase + (b.wasp ? 1.15 : 0)) * stat.beeSpeedMul();
    if (b.state === 'guard') {
      b.retarget -= dt;
      if (b.retarget <= 0) {
        b.retarget = rand(4, 7);
        const open = openFlowers();
        if (open.length && Math.random() < 0.75) b.guardPos.copy(choice(open).g.position);
        else { const a = rand(0, Math.PI * 2); b.guardPos.set(Math.cos(a) * rand(4, FIELD_R - 6), 0, Math.sin(a) * rand(4, FIELD_R - 6)); }
      }
      tmpB.set(
        b.guardPos.x + Math.cos(b.t * 1.5) * 1.5,
        1.0 + Math.sin(b.t * 3) * 0.18,
        b.guardPos.z + Math.sin(b.t * 1.5) * 1.5);
      moveBee(b, tmpB, 2.3, dt);
      if (b.cooldown <= 0 && distGirl < aggroR * (b.wasp ? 1.25 : 1) && S.invuln <= 0) {
        b.state = 'chase'; b.chaseT = stat.chaseDur() + (b.wasp ? 0.8 : 0); sfx.buzz();
        malekSay('chase1', "Uh oh, angry bee incoming! Tap 💫 to swat it away!");
      }
    } else if (b.state === 'chase') {
      b.chaseT -= dt;
      tmpB.copy(girl.position); tmpB.y = 1.0;
      moveBee(b, tmpB, chaseSpd, dt);
      if (distGirl < 0.85) hitGirl(b);
      else if (b.chaseT <= 0 || S.invuln > 0) { b.state = 'flee'; b.fleeT = 1.0; b.cooldown = rand(3, 4.5); }
    } else {
      b.fleeT -= dt;
      tmpB.copy(b.g.position).sub(girl.position).setY(0).normalize().multiplyScalar(5).add(b.g.position);
      tmpB.y = 2.2;
      moveBee(b, tmpB, 3.5, dt);
      if (b.fleeT <= 0) { b.state = 'guard'; b.retarget = 0; }
    }
    b.shadow.position.set(b.g.position.x, 0.026, b.g.position.z);
  }

  updateBunny(dt);
  updateCloud(dt);

  /* --- crow --- */
  if (S.cfg.crow && !crow.active && S.gameT > S.nextCrowAt) {
    crowEnter();
    S.nextCrowAt = S.gameT + rand(16, 24);
    if (crow.active) malekSay('crow', "HEY! That crow steals flowers! Swat it to make it drop them! 🐦‍⬛");
  }
  updateCrow(dt);

  /* --- butterfly --- */
  if (!butterfly.active && S.gameT > S.nextButterflyAt) spawnButterfly();
  if (butterfly.active) {
    butterfly.t += dt;
    const k = butterfly.t / butterfly.dur;
    if (k >= 1) { hideButterfly(); S.nextButterflyAt = S.gameT + rand(10, 16); }
    else {
      const px = THREE.MathUtils.lerp(butterfly.from.x, butterfly.to.x, k) + Math.sin(butterfly.t * 1.7) * 3;
      const pz = THREE.MathUtils.lerp(butterfly.from.z, butterfly.to.z, k) + Math.cos(butterfly.t * 1.3) * 3;
      const py = 1.15 + Math.sin(butterfly.t * 4) * 0.25;
      tmpB.set(px, py, pz);
      tmpA.copy(tmpB).sub(butterfly.g.position);
      if (tmpA.lengthSq() > 0.0001) butterfly.g.rotation.y = Math.atan2(tmpA.x, tmpA.z);
      butterfly.g.position.copy(tmpB);
      if (Math.hypot(px - girl.position.x, pz - girl.position.z) < 1.3) {
        S.timeLeft = Math.min(S.timeLeft + 7, S.timeMax);
        S.score += 25; S.petals += 1; S.hudDirty = true;
        sfx.fly();
        burst(butterfly.g.position, [0xff9ed2, 0xffffff, 0xc9a0ff], 14, 2.2, 1.8, 0.8);
        floatText(butterfly.g.position, '+7s 🦋', 'time');
        hideButterfly(); S.nextButterflyAt = S.gameT + rand(11, 17);
      }
    }
  }

  /* --- house proximity --- */
  const houseDist = Math.hypot(girl.position.x - OBSTACLES[2].x, girl.position.z - OBSTACLES[2].z);
  if (houseDist < 4.8 && !S.housePromptVisible) {
    S.housePromptVisible = true;
    $('housePrompt').classList.remove('hidden');
    malekSay('houseNear', "That's your little cottage! 🏠 Go inside and make it your own 💕");
  } else if (houseDist >= 4.8 && S.housePromptVisible) {
    S.housePromptVisible = false;
    $('housePrompt').classList.add('hidden');
  }

  /* --- occasional dev tip --- */
  if (S.gameT > S.nextTipAt) {
    S.nextTipAt = S.gameT + rand(16, 26);
    if (!malek.queue.length && malek.showT <= 0) malekSay(null, choice(MALEK_TIPS));
  }
}

function moveBee(b, target, speed, dt) {
  tmpA.copy(target).sub(b.g.position);
  const d = tmpA.length();
  if (d > 0.02) {
    tmpA.normalize();
    b.g.position.addScaledVector(tmpA, Math.min(speed * dt, d));
    b.faceA = lerpAngle(b.faceA, Math.atan2(tmpA.x, tmpA.z), 1 - Math.exp(-8 * dt));
    b.g.rotation.y = b.faceA;
  }
}

/* ============================== cosmetic update ============================== */
export function cosmetics(dt) {
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 80) c.position.x = -80;
  }
  duck.position.x = OBSTACLES[0].x + Math.cos(S.animT * 0.35) * 2.4;
  duck.position.z = OBSTACLES[0].z + Math.sin(S.animT * 0.35) * 1.7;
  duck.position.y = 0.18 + Math.sin(S.animT * 2.2) * 0.04;
  duck.rotation.y = -S.animT * 0.35 + Math.PI / 2;

  // drifting blossom petals
  for (const dp of driftPetals) {
    dp.y -= dt * 0.55;
    if (dp.y < 0.1) { dp.y = rand(5, 8); dp.x = rand(-14, 14); dp.z = rand(-14, 14); }
    dp.m.position.set(
      camFocus.x + dp.x + Math.sin(S.animT * 0.8 + dp.off) * 1.2,
      dp.y,
      camFocus.z + dp.z + Math.cos(S.animT * 0.6 + dp.off) * 1.2);
    dp.m.rotation.y += dt * dp.spin;
    dp.m.rotation.z = Math.sin(S.animT * 2 + dp.off) * 0.6;
  }

  for (const f of flowers) {
    if (f.popK < 1) f.popK = Math.min(1, f.popK + dt / 0.35);
    if (!f.picked && !f.carried) {
      const s = easeOutBack(f.popK) * (1 - 0.22 * f.wiltK) * (f.golden ? 1.18 : f.rainbow ? 1.3 : 1);
      f.g.scale.setScalar(Math.max(0.001, s));
      f.head.rotation.z = Math.sin(S.animT * 2 + f.phase) * 0.07 * (1 - f.wiltK);
      f.ring.material.opacity = 0.16 + 0.1 * Math.sin(S.animT * 3 + f.phase);
      if (f.golden || f.rainbow) {
        f.head.rotation.y += dt * 2.2;
        if (Math.random() < dt * 2.5)
          burst(f.g.position.clone().setY(0.75), f.rainbow ? choice(RAINBOW) : 0xffe27a, 1, 0.5, 0.9, 0.5, 0.7);
      }
    }
  }
  for (const p of pickups) {
    if (p.popK < 1) { p.popK = Math.min(1, p.popK + dt / 0.35); p.g.scale.setScalar(Math.max(0.001, easeOutBack(p.popK))); }
    p.g.position.y = Math.sin(S.animT * 2.5 + p.phase) * 0.08;
    p.g.rotation.y += dt * 1.8;
  }
  for (const b of bees) {
    const flap = Math.sin(S.animT * (b.wasp ? 55 : 42) + b.t) * 0.55 + 0.45;
    b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
  }
  if (butterfly.active) {
    const flap = Math.sin(S.animT * 14) * 0.85;
    butterfly.wings[0].rotation.z = flap; butterfly.wings[1].rotation.z = -flap;
  }
  if (rainCloud.active) rainCloud.g.position.y = 7 + Math.sin(S.animT * 1.4) * 0.25;

  // tap marker pulse
  if (tapMarker.visible) {
    const k = 1 + Math.sin(S.animT * 6) * 0.15;
    tapMarker.scale.setScalar(k);
  }
  // swat ring effect
  if (S.swatAnimT > 0) {
    S.swatAnimT = Math.max(0, S.swatAnimT - dt);
    const k = 1 - S.swatAnimT / 0.32;
    swatRing.visible = true;
    swatRing.position.set(girl.position.x, 0.5, girl.position.z);
    swatRing.scale.setScalar(0.4 + k * stat.swatR());
    swatRing.material.opacity = (1 - k) * 0.7;
  } else swatRing.visible = false;

  // guide arrow toward nearest flower
  let nearest = null, nd = 1e9;
  for (const f of flowers) {
    if (f.picked || f.carried) continue;
    const d = Math.hypot(f.g.position.x - girl.position.x, f.g.position.z - girl.position.z);
    if (d < nd) { nd = d; nearest = f; }
  }
  if (S.state === 'playing' && nearest && nd > 7) {
    guideArrow.visible = true;
    tmpA.copy(nearest.g.position).sub(girl.position).setY(0).normalize();
    guideArrow.position.copy(girl.position).addScaledVector(tmpA, 1.6);
    guideArrow.position.y = 0.5 + Math.sin(S.animT * 4) * 0.1;
    guideArrow.rotation.y = Math.atan2(tmpA.x, tmpA.z);
    guideArrow.children[0].material.color.setHex(nearest.rainbow ? 0x9d5eff : nearest.golden ? 0xf5a800 : 0xff7ab0);
  } else guideArrow.visible = false;

  // Ranooma
  girlRefs.stars.visible = S.stunned > 0;
  if (S.stunned > 0) {
    girlRefs.stars.rotation.y += dt * 9;
    girl.rotation.z = Math.sin(S.animT * 22) * 0.06;
  } else if (!S.ultActive) girl.rotation.z *= 0.8;
  girl.visible = !(S.invuln > 0 && !S.ultActive && S.stunned <= 0 && Math.floor(S.animT * 12) % 2 === 0);
  if (girlRefs.bubble.visible) {
    girlRefs.bubble.scale.setScalar(1 + Math.sin(S.animT * 3) * 0.05);
    girlRefs.bubble.material.opacity = 0.13 + Math.sin(S.animT * 3) * 0.04;
  }

  if (S.ultActive) {
    // pose (position/rotation/limbs) fully driven by updateMalekUlt
  } else if (S.state === 'won') {
    S.winT += dt;
    if (S.winT < 1.5) {
      girl.rotation.y += dt * 7;
      girl.position.y = Math.abs(Math.sin(S.winT * 9)) * 0.35;
    } else girl.position.y = 0;
  } else if (S.moving && S.state === 'playing') {
    const sw = Math.sin(S.walkT * 2.2);
    girlRefs.arms[0].rotation.x = sw * 0.75;
    if (S.swatArmT <= 0) girlRefs.arms[1].rotation.x = -0.55 + sw * 0.12;
    girlRefs.legs[0].rotation.x = -sw * 0.85;
    girlRefs.legs[1].rotation.x = sw * 0.85;
    girl.position.y = Math.abs(Math.sin(S.walkT * 2.2)) * 0.07;
    girlRefs.pigtails[0].rotation.z = sw * 0.12;
    girlRefs.pigtails[1].rotation.z = -sw * 0.12;
  } else {
    girl.position.y = Math.sin(S.animT * 2) * 0.03 + 0.03;
    girlRefs.arms[0].rotation.x *= 0.85;
    girlRefs.legs[0].rotation.x *= 0.85;
    girlRefs.legs[1].rotation.x *= 0.85;
    if (S.swatArmT <= 0) girlRefs.arms[1].rotation.x += (-0.55 - girlRefs.arms[1].rotation.x) * 0.15;
  }
  // Swat melee: right arm swings forward like hitting with hand / basket
  if (S.swatArmT > 0) {
    S.swatArmT = Math.max(0, S.swatArmT - dt);
    const k = 1 - S.swatArmT / 0.42;
    const swing = Math.sin(k * Math.PI);
    girlRefs.arms[1].rotation.x = -0.55 - swing * 2.1; // forward smash
    girlRefs.arms[1].rotation.z = swing * 0.6;          // cross-body arc
  } else {
    girlRefs.arms[1].rotation.z *= 0.8;
  }
  // blow-a-kiss: left hand to lips then flings outward
  if (S.kissAnimT > 0) {
    S.kissAnimT = Math.max(0, S.kissAnimT - dt);
    const k = 1 - S.kissAnimT / 0.55;
    const lift = Math.sin(clamp(k * 1.4, 0, 1) * Math.PI);
    girlRefs.arms[0].rotation.x = -lift * 1.9;   // hand up to mouth then out
    girlRefs.arms[0].rotation.z = -lift * 0.4;
  }
  girlRefs.basketBlooms.forEach((bl, i) => { bl.visible = S.progress > i * Math.ceil(S.need / 3); });
  girlShadow.position.set(girl.position.x, 0.025, girl.position.z);

  updateMalek(dt);

  if (S.state === 'playing' && S.soundOn && S.chimesOn && S.AC && S.animT > S.nextChime) {
    tone(choice([523, 587, 659, 784, 880, 1047]), 1.4, 'triangle', 0.028);
    S.nextChime = S.animT + rand(1.4, 3.2);
  }
  if (S.state === 'playing' || S.state === 'count' || S.state === 'won') drawMinimap();
}
