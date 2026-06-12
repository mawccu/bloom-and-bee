import { $ } from './utils.js';
import { store, S, PROFILE_KEY, PROFILE_DATA_KEYS, profileId, setProfile, MAX_HEARTS } from './state.js';
import { clock, applyQuality } from './engine.js';
import { FIELD_R, OBSTACLES } from './world.js';
import { DRESS_COLORS, HAIR_COLORS, girl, girlRefs } from './characters.js';
import { initAudio, sfx } from './audio.js';
import { flowers } from './flowers.js';
import { bees, bunny, crow, rainCloud, butterfly, pickups } from './enemies.js';
import {
  renderShop, startGame, toMenu, previewLine, refreshBestLine, refreshPlayBtn,
  tapMarker, doSwat, blowKiss,
} from './gameplay.js';
import { hideJoy, showFixedJoy, resetStuckInput } from './input.js';
import { cloudLoad, cloudSave } from './cloud.js';

/* ============================== save / restore ============================== */
const SAVE_KEYS = PROFILE_DATA_KEYS;

export function exportSave() {
  const data = {};
  SAVE_KEYS.forEach(k => {
    const v = store.get(k, null);
    if (v !== null) data[k] = v;
  });
  return btoa(JSON.stringify(data));
}

export function importSave(code) {
  try {
    const data = JSON.parse(atob(code.trim()));
    SAVE_KEYS.forEach(k => { if (data[k] !== undefined) store.set(k, data[k]); });
    return true;
  } catch(e) { return false; }
}

/* ============================== cloud sync (Supabase backup) ==============================
   localStorage stays the instant offline store; the cloud is a durable backup that syncs on
   top using the SAME save blob (SAVE_KEYS). All cloud calls are best-effort — if they fail
   (offline / blocked) the game is unaffected and just syncs next time a call succeeds. */
// 'bank' is the one structured value: stored as a JSON string in localStorage but carried
// in the cloud blob (jsonb) as a real object, so it round-trips as { petals, coins } — not "[object Object]".
const JSON_KEYS = ['bank'];
const safeParse = v => { try { return JSON.parse(v); } catch (e) { return null; } };
function getSaveBlob() {
  const data = {};
  SAVE_KEYS.forEach(k => {
    const v = store.get(k, null);
    if (v === null) return;
    data[k] = JSON_KEYS.includes(k) ? (safeParse(v) ?? v) : v;
  });
  return data;
}
function applySaveBlob(data) {
  SAVE_KEYS.forEach(k => {
    if (data[k] === undefined) return;
    if (JSON_KEYS.includes(k)) {
      const obj = typeof data[k] === 'string' ? safeParse(data[k]) : data[k];
      if (obj != null) {
        store.set(k, JSON.stringify(obj));
        if (k === 'bank') S.bank = Object.assign({ petals: 0, coins: 0 }, obj);
      }
    } else {
      store.set(k, data[k]);
    }
  });
}
const blobLevel = b => Math.max(1, parseInt((b && b.curlevel) || '1', 10) || 1);
// order-independent canonical form (jsonb may reorder object keys vs our local order)
const canon = v => (v && typeof v === 'object')
  ? JSON.stringify(Object.keys(v).sort().reduce((o, k) => (o[k] = v[k], o), {}))
  : String(v);
// does the cloud blob carry any value that differs from local for a key it actually defines?
const cloudBrings = (cloud, local) =>
  SAVE_KEYS.some(k => cloud[k] !== undefined && canon(cloud[k]) !== canon(local[k]));

// tiny, non-intrusive "☁️ synced" toast
let _syncEl = null, _syncTimer = null;
function showSynced(text = '☁️ synced') {
  if (!_syncEl) {
    _syncEl = document.createElement('div');
    _syncEl.id = 'cloudSync';
    _syncEl.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);' +
      'z-index:9999;font:700 13px "Baloo 2",system-ui,sans-serif;color:#fff;' +
      'background:rgba(60,92,140,.82);padding:5px 14px;border-radius:16px;' +
      'pointer-events:none;opacity:0;transition:opacity .35s;box-shadow:0 2px 10px rgba(0,0,0,.22)';
    document.body.appendChild(_syncEl);
  }
  _syncEl.textContent = text;
  _syncEl.style.opacity = '1';
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => { _syncEl.style.opacity = '0'; }, 1600);
}

// Debounced push of the current profile's save to the cloud (coalesces rapid changes).
let _saveTimer = null;
export function scheduleCloudSave() {
  if (!profileId) return; // no profile selected -> nothing to back up
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    const ok = await cloudSave(profileId, getSaveBlob());
    if (ok) showSynced();
  }, 1500);
}

// On startup (and after a profile code is entered, which reloads): merge cloud <-> local,
// keeping the more-progressed save (higher saved level; tie -> prefer cloud).
async function syncProfile() {
  if (!profileId) return;
  const cloud = await cloudLoad(profileId);
  const local = getSaveBlob();
  if (!cloud) {
    // cloud empty / unreachable — push local up if there's anything to keep
    if (Object.keys(local).length) { const ok = await cloudSave(profileId, local); if (ok) showSynced('☁️ backed up'); }
    return;
  }
  if (blobLevel(cloud) >= blobLevel(local)) {
    if (cloudBrings(cloud, local)) {
      applySaveBlob(cloud);
      // reflect adopted progress immediately; reload at the menu so cosmetics/toggles re-init
      S.savedLevel = blobLevel(getSaveBlob());
      S.best = +store.get('best', 0); S.bestLvl = +store.get('bestlvl', 0);
      refreshPlayBtn(); refreshBestLine();
      showSynced('☁️ restored');
      if (S.state === 'menu') location.reload();
    } else {
      showSynced();
    }
  } else {
    const ok = await cloudSave(profileId, local); if (ok) showSynced('☁️ backed up');
  }
}
syncProfile();

$('saveBtn').addEventListener('click', () => {
  $('saveCodeOut').value = exportSave();
  $('saveCodeIn').value = '';
  $('copySaveBtn').textContent = '📋 Copy';
  $('saveModal').classList.remove('hidden');
});
$('closeSaveBtn').addEventListener('click', () => $('saveModal').classList.add('hidden'));
$('copySaveBtn').addEventListener('click', () => {
  const ta = $('saveCodeOut');
  ta.select(); ta.setSelectionRange(0, 99999);
  navigator.clipboard ? navigator.clipboard.writeText(ta.value).catch(() => document.execCommand('copy'))
                      : document.execCommand('copy');
  $('copySaveBtn').textContent = '✅ Copied!';
  setTimeout(() => $('copySaveBtn').textContent = '📋 Copy', 2200);
});
$('loadSaveBtn').addEventListener('click', () => {
  const code = $('saveCodeIn').value.trim();
  if (!code) { $('saveCodeIn').style.borderColor = '#ff6b9d'; setTimeout(() => $('saveCodeIn').style.borderColor = '', 1200); return; }
  if (importSave(code)) {
    $('saveModal').classList.add('hidden');
    location.reload();
  } else {
    $('saveCodeIn').style.borderColor = '#ff4444';
    setTimeout(() => $('saveCodeIn').style.borderColor = '', 1500);
  }
});

/* ============================== profile UI ============================== */
function showProfileScreen(isFirstRun) {
  $('profileInput').value = isFirstRun ? '' : profileId;
  $('profileTitle').textContent = isFirstRun ? "Who's playing? 🌸" : 'Switch profile';
  $('profileCancelBtn').classList.toggle('hidden', isFirstRun);
  $('profileModal').classList.remove('hidden');
  $('profileInput').focus();
}
$('profileGoBtn').addEventListener('click', () => {
  const id = $('profileInput').value.trim();
  if (!id) {
    $('profileInput').style.borderColor = '#ff4444';
    setTimeout(() => $('profileInput').style.borderColor = '', 1200);
    return;
  }
  setProfile(id);
});
$('profileInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('profileGoBtn').click(); });
$('profileCancelBtn').addEventListener('click', () => $('profileModal').classList.add('hidden'));
$('switchProfileBtn').addEventListener('click', () => { sfx.click(); showProfileScreen(false); });
if (!localStorage.getItem(PROFILE_KEY)) showProfileScreen(true);

/* ============================== UI wiring ============================== */
$('malekWinOk').addEventListener('click', () => {
  sfx.click();
  $('malekWin').classList.add('hidden');
  if (!S._winShopData) return;
  $('lvlTitle').textContent = S._winShopData.title;
  $('lvlSub').innerHTML = S._winShopData.sub;
  renderShop();
  $('nextBtn').textContent = `Level ${S._winShopData.nextLevel} ➜`;
  $('nextPreview').innerHTML = previewLine(S._winShopData.nextLevel);
  $('levelScreen').classList.remove('hidden');
  S._winShopData = null;
});
$('playBtn').addEventListener('click', () => { initAudio(); sfx.click(); startGame(S.savedLevel, true); });
$('newGameBtn').addEventListener('click', () => {
  sfx.click();
  S.savedLevel = 1; store.set('curlevel', 1);
  refreshPlayBtn();
});
$('nextBtn').addEventListener('click', () => { initAudio(); sfx.click(); startGame(S.level + 1); });
$('againBtn').addEventListener('click', () => { initAudio(); sfx.click(); startGame(S.level, true); });
$('menuBtn').addEventListener('click', () => { sfx.click(); toMenu(); });
$('quitBtn').addEventListener('click', () => { sfx.click(); toMenu(); });
$('pauseBtn').addEventListener('click', () => {
  if (S.state === 'playing') { S.state = 'paused'; hideJoy(); $('pauseScreen').classList.remove('hidden'); sfx.click(); }
});
$('resumeBtn').addEventListener('click', () => {
  if (S.state === 'paused') {
    $('pauseScreen').classList.add('hidden'); sfx.click(); S.state = 'playing';
    if (S.ctrlMode === 'fixed') showFixedJoy();
  }
});
$('swatBtn').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); doSwat(); });
// sprint: hold the button to run
const sprintBtn = $('sprintBtn');
const sprintDown = e => { e.preventDefault(); initAudio(); S.sprintBtnHeld = true; };
const sprintUp = () => { S.sprintBtnHeld = false; };
sprintBtn.addEventListener('pointerdown', sprintDown);
sprintBtn.addEventListener('pointerup', sprintUp);
sprintBtn.addEventListener('pointercancel', sprintUp);
sprintBtn.addEventListener('pointerleave', sprintUp);
// kiss: blow a kiss (summons the Malek ultimate when charged)
$('kissBtn').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); blowKiss(); });
function syncSndBtn() { $('sndBtn').textContent = S.soundOn ? '🔊' : '🔇'; }
$('sndBtn').addEventListener('click', () => {
  S.soundOn = !S.soundOn; store.set('snd', S.soundOn ? '1' : '0');
  syncSndBtn(); syncToggles();
  if (S.soundOn) { initAudio(); sfx.click(); }
});
// iOS Safari (and other mobile browsers) can suspend rAF/audio while backgrounded and drop
// pointerup/pointercancel events, leaving the joystick/sprint/keys latched and the clock
// holding a huge elapsed time. Reset everything cleanly on the way out and back in.
function onAppHidden() {
  resetStuckInput();
  if (S.state === 'playing') { S.state = 'paused'; $('pauseScreen').classList.remove('hidden'); }
}
function onAppVisible() {
  clock.getDelta(); // discard time spent backgrounded so the next frame's dt stays tiny
  resetStuckInput();
  if (S.AC && S.AC.state === 'suspended') S.AC.resume().catch(() => {});
}
document.addEventListener('visibilitychange', () => { document.hidden ? onAppHidden() : onAppVisible(); });
addEventListener('pagehide', onAppHidden);
addEventListener('pageshow', onAppVisible);
addEventListener('blur', onAppHidden);
addEventListener('focus', onAppVisible);

// dress-up swatches
function buildSwatches(elId, colors, key, mat) {
  const wrap = $(elId);
  colors.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'sw' + (+store.get(key, 0) === i ? ' sel' : '');
    d.style.background = '#' + c.toString(16).padStart(6, '0');
    d.addEventListener('click', () => {
      store.set(key, i);
      mat.color.setHex(c);
      wrap.querySelectorAll('.sw').forEach(s => s.classList.remove('sel'));
      d.classList.add('sel');
      initAudio(); sfx.click();
      scheduleCloudSave();
    });
    wrap.appendChild(d);
  });
}
buildSwatches('dressSw', DRESS_COLORS, 'dress', girlRefs.dressMat);
buildSwatches('hairSw', HAIR_COLORS, 'hair', girlRefs.hairMat);

// control mode picker
function syncCtrl() {
  $('ctrlStick').classList.toggle('sel', S.ctrlMode === 'stick');
  $('ctrlFixed').classList.toggle('sel', S.ctrlMode === 'fixed');
  $('ctrlTap').classList.toggle('sel', S.ctrlMode === 'tap');
}
export function setCtrl(mode) {
  S.ctrlMode = mode; store.set('ctrl', mode);
  hideJoy(); S.tapTarget = null; tapMarker.visible = false;
  syncCtrl(); initAudio(); sfx.click();
}
$('ctrlStick').addEventListener('click', () => setCtrl('stick'));
$('ctrlFixed').addEventListener('click', () => setCtrl('fixed'));
$('ctrlTap').addEventListener('click', () => setCtrl('tap'));

// toggles
function syncToggles() {
  $('togSnd').classList.toggle('off', !S.soundOn);
  $('togChime').classList.toggle('off', !S.chimesOn);
  $('togHD').classList.toggle('off', !S.hdOn);
}
$('togSnd').addEventListener('click', () => {
  S.soundOn = !S.soundOn; store.set('snd', S.soundOn ? '1' : '0');
  syncSndBtn(); syncToggles(); if (S.soundOn) { initAudio(); sfx.click(); }
});
$('togChime').addEventListener('click', () => {
  S.chimesOn = !S.chimesOn; store.set('chime', S.chimesOn ? '1' : '0');
  syncToggles(); initAudio(); sfx.click();
});
$('togHD').addEventListener('click', () => {
  S.hdOn = !S.hdOn; store.set('hd', S.hdOn ? '1' : '0');
  applyQuality(); syncToggles(); initAudio(); sfx.click();
});
syncSndBtn(); syncToggles(); syncCtrl(); refreshBestLine(); refreshPlayBtn();

/* ============================== HUD + minimap ============================== */
let lastBarW = -1;
export function refreshHud() {
  if (S.hudDirty) {
    $('cnt').textContent = `${S.progress}/${S.need}`;
    $('score').textContent = S.score;
    $('lvl').textContent = S.level;
    $('petals').textContent = S.petals;
    $('bankPetals').textContent = S.bank.petals;
    $('bankCoins').textContent = S.bank.coins;
    $('hearts').textContent = '💗'.repeat(Math.max(0, S.hearts)) + '🤍'.repeat(Math.max(0, MAX_HEARTS - S.hearts));
    S.hudDirty = false;
  }
  const frac = Math.max(0, Math.min(1, S.timeLeft / S.timeMax));
  const w = Math.round(frac * 200) / 2;
  if (w !== lastBarW) {
    lastBarW = w;
    const bar = $('timerBar');
    bar.style.width = w + '%';
    bar.style.background = `hsl(${Math.round(frac * 110)}, 75%, 55%)`;
  }
  $('swatBtn').classList.toggle('cool', S.swatCd > 0);
  // stamina bar
  const sb = $('stamBar');
  sb.style.width = (S.stamina * 100) + '%';
  sb.style.background = S.exhausted ? '#e2724f' : (S.stamina < 0.3 ? '#f0b54f' : '#4fc28a');
  const spb = $('sprintBtn');
  spb.classList.toggle('tired', S.exhausted);
  spb.classList.toggle('go', S.sprinting);
  spb.textContent = S.exhausted ? '😮‍💨' : '💨';
  // Malek ultimate charge
  const ready = S.malekCharge >= 1;
  $('malekPct').textContent = ready ? 'READY!' : Math.round(S.malekCharge * 100) + '%';
  $('malekChip').classList.toggle('full', ready);
  $('kissBtn').classList.toggle('ready', ready && !S.ultActive);
  if (S.state === 'playing' && S.ctrlMode === 'fixed' && $('joy').classList.contains('hidden')) showFixedJoy();
}

const miniCtx = $('mini').getContext('2d');
let miniFrame = 0;
export function drawMinimap() {
  if ((miniFrame = (miniFrame + 1) % 4) !== 0) return;
  const C = miniCtx, SZ = 184, half = SZ / 2, k = half / (FIELD_R + 2.5);
  C.clearRect(0, 0, SZ, SZ);
  C.save();
  C.beginPath(); C.arc(half, half, half - 2, 0, Math.PI * 2); C.clip();
  C.fillStyle = 'rgba(255,255,255,.55)'; C.fillRect(0, 0, SZ, SZ);
  for (const o of OBSTACLES) {
    C.fillStyle = o.pond ? 'rgba(143,212,232,.85)' : 'rgba(255,158,198,.9)';
    C.beginPath();
    C.ellipse(half + o.x * k, half + o.z * k, o.rx * k, o.rz * k, 0, 0, Math.PI * 2); C.fill();
  }
  const dot = (x, z, r, col) => { C.fillStyle = col; C.beginPath(); C.arc(half + x * k, half + z * k, r, 0, Math.PI * 2); C.fill(); };
  for (const f of flowers) if (!f.picked)
    dot(f.g.position.x, f.g.position.z, 2.6, f.rainbow ? '#9d5eff' : f.golden ? '#f5a800' : '#ffffff');
  for (const p of pickups) dot(p.g.position.x, p.g.position.z, 2.6,
    p.type === 'clover' ? '#4fae5c' : p.type === 'heart' ? '#ff6fa5' : '#f5d142');
  for (const b of bees) dot(b.g.position.x, b.g.position.z, 2.4, b.wasp ? '#ff7430' : '#35302e');
  if (bunny.active) dot(bunny.g.position.x, bunny.g.position.z, 2.8, '#bbb4ae');
  if (crow.active) dot(crow.g.position.x, crow.g.position.z, 2.8, '#3a3f4a');
  if (rainCloud.active) {
    C.fillStyle = 'rgba(106,122,144,.5)';
    C.beginPath(); C.arc(half + rainCloud.g.position.x * k, half + rainCloud.g.position.z * k, rainCloud.R * k, 0, Math.PI * 2); C.fill();
  }
  if (butterfly.active) dot(butterfly.g.position.x, butterfly.g.position.z, 2.6, '#ff9ed2');
  dot(girl.position.x, girl.position.z, 3.4, '#ff5e9c');
  C.restore();
  C.strokeStyle = 'rgba(255,255,255,.9)'; C.lineWidth = 3;
  C.beginPath(); C.arc(half, half, half - 2, 0, Math.PI * 2); C.stroke();
}
