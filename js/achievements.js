import { S, store } from './state.js';
import { scheduleCloudSave } from './ui.js';
import { malekSay } from './characters.js';
import { tone } from './audio.js';
import { $ } from './utils.js';

/* ============================== definitions ============================== */
export const ACHIEVEMENTS = [
  { id: 'first_level',   label: 'First Bloom',       desc: 'Clear your first level',       icon: '🌸', stat: 'levels',        need: 1,   reward: { petals: 5 } },
  { id: 'level_5',       label: 'Seasoned Picker',    desc: 'Clear 5 levels',               icon: '🌼', stat: 'levels',        need: 5,   reward: { petals: 10 } },
  { id: 'level_10',      label: 'Expert Bloomer',     desc: 'Clear 10 levels',              icon: '🏆', stat: 'levels',        need: 10,  reward: { petals: 20 } },
  { id: 'level_25',      label: 'Flower Master',      desc: 'Clear 25 levels',              icon: '👑', stat: 'levels',        need: 25,  reward: { petals: 50 } },
  { id: 'flowers_10',    label: 'Flower Girl',        desc: 'Pick 10 flowers total',        icon: '💐', stat: 'flowersPicked', need: 10,  reward: { petals: 3 } },
  { id: 'flowers_50',    label: 'Garden Keeper',      desc: 'Pick 50 flowers total',        icon: '🌺', stat: 'flowersPicked', need: 50,  reward: { petals: 10 } },
  { id: 'flowers_200',   label: 'Bloom Queen',        desc: 'Pick 200 flowers total',       icon: '🌷', stat: 'flowersPicked', need: 200, reward: { petals: 25 } },
  { id: 'bee_zapper',    label: 'Bee Zapper',         desc: 'Swat 5 bees',                  icon: '⚡', stat: 'beesSwatted',   need: 5,   reward: { petals: 5 } },
  { id: 'bee_chaser',    label: 'Bee Chaser',         desc: 'Swat 25 bees',                 icon: '🪄', stat: 'beesSwatted',   need: 25,  reward: { petals: 15 } },
  { id: 'first_buy',     label: 'First Purchase',     desc: 'Buy your first item',          icon: '🛍️', stat: 'purchases',     need: 1,   reward: { petals: 5 } },
  { id: 'collector',     label: 'Collector',          desc: 'Own 5 items from the shop',    icon: '🗃️', stat: 'purchases',     need: 5,   reward: { petals: 15 } },
  { id: 'decorator',     label: 'Interior Designer',  desc: 'Place 3 pieces of furniture',  icon: '🛋️', stat: 'decorations',   need: 3,   reward: { petals: 10 } },
];

function _defaultStats() {
  return { levels: 0, flowersPicked: 0, beesSwatted: 0, decorations: 0, purchases: 0 };
}

/* ============================== unlock toast ============================== */
let _toastTimer = null;
function showToast(ach) {
  const el = $('achToast');
  if (!el) return;
  $('achToastIcon').textContent   = ach.icon;
  $('achToastLabel').textContent  = ach.label;
  $('achToastDesc').textContent   = ach.desc;
  const parts = [];
  if (ach.reward.petals) parts.push(`+${ach.reward.petals} 🌸`);
  if (ach.reward.coins)  parts.push(`+${ach.reward.coins} 🪙`);
  $('achToastReward').textContent = parts.join(' ');
  el.classList.remove('hidden', 'ach-out');
  void el.offsetWidth;
  el.classList.add('ach-in');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('ach-in');
    el.classList.add('ach-out');
    setTimeout(() => { el.classList.add('hidden'); el.classList.remove('ach-out'); }, 420);
  }, 3500);
}

/* ============================== unlock logic ============================== */
function unlockAch(ach) {
  if (S.achievements.includes(ach.id)) return;
  S.achievements.push(ach.id);
  store.set('achievements', JSON.stringify(S.achievements));
  if (ach.reward.petals) {
    S.bank.petals += ach.reward.petals;
    store.set('bank', JSON.stringify(S.bank));
    S.hudDirty = true;
  }
  if (ach.reward.coins) {
    S.bank.coins += ach.reward.coins;
    store.set('bank', JSON.stringify(S.bank));
    S.hudDirty = true;
  }
  scheduleCloudSave();
  tone(880, 0.12, 'triangle', 0.18);
  tone(1175, 0.24, 'triangle', 0.16, 0.1);
  tone(1568, 0.36, 'triangle', 0.14, 0.18);
  malekSay('ach_' + ach.id, `Achievement: ${ach.label}! ${ach.icon} rewarding you now~`);
  showToast(ach);
}

function _statValue(ach) {
  return ach.stat === 'purchases' ? S.ownedItems.length : (S.stats[ach.stat] || 0);
}

function checkAll() {
  if (!S.stats) S.stats = _defaultStats();
  if (!S.achievements) S.achievements = [];
  for (const ach of ACHIEVEMENTS) {
    if (!S.achievements.includes(ach.id) && _statValue(ach) >= ach.need) unlockAch(ach);
  }
}

/* ============================== public API ============================== */
export function trackStat(key, delta) {
  if (!S.stats) S.stats = _defaultStats();
  S.stats[key] = (S.stats[key] || 0) + delta;
  store.set('stats', JSON.stringify(S.stats));
  checkAll();
}

export function checkAchievements() {
  checkAll();
  scheduleCloudSave();
}

/* ============================== achievement panel ============================== */
export function showAchievementsPanel() {
  const el = $('achPanel');
  if (!el) return;
  if (!S.stats) S.stats = _defaultStats();
  if (!S.achievements) S.achievements = [];
  const total    = ACHIEVEMENTS.length;
  const unlocked = ACHIEVEMENTS.filter(a => S.achievements.includes(a.id)).length;
  $('achPanelStats').innerHTML =
    `<b>🏆 ${unlocked} / ${total}</b> &nbsp;·&nbsp; ` +
    `🌸 ${S.stats.flowersPicked || 0} picked &nbsp;·&nbsp; ` +
    `🐝 ${S.stats.beesSwatted || 0} swatted &nbsp;·&nbsp; ` +
    `📦 ${S.ownedItems.length} owned &nbsp;·&nbsp; ` +
    `Lv ${S.savedLevel}`;
  const grid = $('achGrid');
  grid.innerHTML = '';
  for (const ach of ACHIEVEMENTS) {
    const done = S.achievements.includes(ach.id);
    const val  = _statValue(ach);
    const pct  = Math.min(100, Math.round((val / ach.need) * 100));
    const rw   = [ach.reward.petals ? `+${ach.reward.petals} 🌸` : '', ach.reward.coins ? `+${ach.reward.coins} 🪙` : ''].filter(Boolean).join(' ');
    const card = document.createElement('div');
    card.className = 'ach-card' + (done ? ' ach-done' : '');
    card.innerHTML =
      `<div class="ach-icon">${ach.icon}</div>` +
      `<div class="ach-info">` +
        `<div class="ach-name">${ach.label}</div>` +
        `<div class="ach-desc">${ach.desc}</div>` +
        `<div class="ach-bar-wrap"><div class="ach-bar" style="width:${done ? 100 : pct}%"></div></div>` +
        (!done ? `<div class="ach-prog">${val} / ${ach.need}</div>` : '') +
        `<div class="ach-reward">${rw}</div>` +
      `</div>`;
    grid.appendChild(card);
  }
  el.classList.remove('hidden');
}

export function hideAchievementsPanel() {
  $('achPanel')?.classList.add('hidden');
}

$('achPanelClose').addEventListener('pointerdown', e => { e.preventDefault(); hideAchievementsPanel(); });
