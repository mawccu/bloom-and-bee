import { $ } from './utils.js';
import { S } from './state.js';
import { girl, malekChar, malekRestArms } from './characters.js';
import { sfx } from './audio.js';
import { CATALOG, canAfford, buy, EXCHANGE_RATE, exchangePetalsForCoins, maxExchangeableCoins } from './economy.js';
import { scheduleCloudSave } from './ui.js';

/* ============================== shop NPC constants ==============================
   SHOP_ORIGIN = (-300, 0, 220) — matches hub.js. Malek stands behind the counter
   which sits at z=216 (SHOP_ORIGIN.z - 4). He faces +Z toward the player entry. */
const NPC_X = -300, NPC_Z = 212.5;   // behind the wider counter at SHOP_ORIGIN.z - 7.5
const BROWSE_DIST = 5.5;

/* ============================== NPC enter / exit ============================== */
export function onEnterShop() {
  malekRestArms();
  malekChar.g.position.set(NPC_X, 0, NPC_Z);
  malekChar.g.rotation.set(0, 0, 0);    // face +Z = toward player entry
  malekChar.g.visible = true;
  malekChar.shadow.position.set(NPC_X, 0.02, NPC_Z);
  malekChar.shadow.visible = true;
  _browseVisible = false;
  $('browseStoreBtn').classList.add('hidden');
}

export function onExitShop() {
  malekChar.g.visible = false;
  malekChar.shadow.visible = false;
  _browseVisible = false;
  $('browseStoreBtn').classList.add('hidden');
  $('shopCatalog').classList.add('hidden');
}

/* ============================== per-frame proximity ============================== */
let _browseVisible = false;

export function updateShopProximity() {
  const d = Math.hypot(girl.position.x - NPC_X, girl.position.z - NPC_Z);
  const near = d < BROWSE_DIST;
  if (near !== _browseVisible) {
    _browseVisible = near;
    $('browseStoreBtn').classList.toggle('hidden', !near);
  }
}

/* ============================== catalog UI ============================== */
function priceLabel(price) {
  const p = [];
  if (price.petals) p.push(`${price.petals} 🌸`);
  if (price.coins)  p.push(`${price.coins} 🪙`);
  return p.join(' + ') || 'Free!';
}

function updateCatalogBal() {
  $('shopBalPetals').textContent = S.bank.petals;
  $('shopBalCoins').textContent  = S.bank.coins;
}

function buildCatalogGrid() {
  const grid = $('shopCatalogGrid');
  grid.innerHTML = '';
  for (const item of CATALOG) {
    const owned  = S.ownedItems.includes(item.id);
    const afford = !owned && canAfford(item.price);
    const card = document.createElement('button');
    card.className = 'shopCatalogCard' + (owned ? ' owned' : !afford ? ' cant' : '');
    card.innerHTML =
      `<span class="sc-em">${item.emoji}</span>` +
      `<span class="sc-nm">${item.name}</span>` +
      `<span class="sc-ds">${item.desc}</span>` +
      `<span class="sc-cost">${owned ? '✅ Owned' : priceLabel(item.price)}</span>`;
    if (!owned) {
      card.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (!buy(item.id)) return;
        scheduleCloudSave();
        buildCatalogGrid();
        updateCatalogBal();
        showFeedback(`✅ ${item.name} purchased!`);
        sfx.click();
      });
    }
    grid.appendChild(card);
  }
}

function showFeedback(msg) {
  const el = $('shopPurchaseFeedback');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._bbTimer);
  el._bbTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

/* ============================== petals → coins exchange UI ==============================
   Injected into the existing shop modal (no markup changes) so she can turn farmed
   petals into the coins that buy premium pieces. */
function doExchange(coins) {
  const want = coins === 'max' ? maxExchangeableCoins() : coins;
  if (exchangePetalsForCoins(want)) {
    sfx.click();
    scheduleCloudSave();
    updateCatalogBal();
    buildCatalogGrid();   // refresh what she can now afford
    showFeedback(`✅ Exchanged ${want * EXCHANGE_RATE}🌸 → ${want}🪙`);
  } else {
    showFeedback(`Need ${EXCHANGE_RATE}🌸 per 🪙 — keep picking flowers! 🌸`);
  }
}

function buildExchangeUI() {
  if ($('shopExchange')) return;   // build once, persists in the modal
  const wrap = document.createElement('div');
  wrap.id = 'shopExchange';
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;margin:2px 0 6px;padding:8px 10px;background:rgba(255,240,205,.6);border-radius:14px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-weight:800;font-size:13px;color:#7a4f6d;';
  title.textContent = `💱 Exchange  ${EXCHANGE_RATE}🌸 → 1🪙`;
  wrap.appendChild(title);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;';
  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'btn alt';
    b.style.cssText = 'font-size:13px;padding:6px 12px;margin:0;';
    b.textContent = label;
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); fn(); });
    return b;
  };
  row.appendChild(mkBtn('+1 🪙', () => doExchange(1)));
  row.appendChild(mkBtn('+5 🪙', () => doExchange(5)));
  row.appendChild(mkBtn('Max 🪙', () => doExchange('max')));
  wrap.appendChild(row);
  $('shopCatalogBal').insertAdjacentElement('afterend', wrap);
}

/* ============================== button wiring ============================== */
$('browseStoreBtn').addEventListener('pointerdown', e => {
  e.preventDefault();
  sfx.click();
  buildExchangeUI();
  buildCatalogGrid();
  updateCatalogBal();
  $('shopCatalog').classList.remove('hidden');
});

$('shopCatalogClose').addEventListener('pointerdown', e => {
  e.preventDefault();
  sfx.click();
  $('shopCatalog').classList.add('hidden');
});
