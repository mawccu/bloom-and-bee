import { $ } from './utils.js';
import { S } from './state.js';
import { girl, malekChar, malekRestArms } from './characters.js';
import { sfx } from './audio.js';
import { CATALOG, canAfford, buy } from './economy.js';
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
        showPurchaseFeedback(item.name);
        sfx.click();
      });
    }
    grid.appendChild(card);
  }
}

function showPurchaseFeedback(name) {
  const el = $('shopPurchaseFeedback');
  el.textContent = `✅ ${name} purchased!`;
  el.classList.remove('hidden');
  clearTimeout(el._bbTimer);
  el._bbTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

/* ============================== button wiring ============================== */
$('browseStoreBtn').addEventListener('pointerdown', e => {
  e.preventDefault();
  sfx.click();
  buildCatalogGrid();
  updateCatalogBal();
  $('shopCatalog').classList.remove('hidden');
});

$('shopCatalogClose').addEventListener('pointerdown', e => {
  e.preventDefault();
  sfx.click();
  $('shopCatalog').classList.add('hidden');
});
