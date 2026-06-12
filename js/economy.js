import { S, store } from './state.js';
import { checkAchievements } from './achievements.js';

/* ============================== item catalog ============================== */
export const CATALOG = [
  // furniture (placed in house — Phase 4)
  { id: 'rug_pink',         name: 'Pink Rug',          emoji: '🟥', type: 'furniture', desc: 'Cozy pink rug',         price: { petals: 20, coins: 0  } },
  { id: 'rug_purple',       name: 'Purple Rug',         emoji: '🟪', type: 'furniture', desc: 'Soft purple rug',       price: { petals: 22, coins: 0  } },
  { id: 'vase_flowers',     name: 'Flower Vase',        emoji: '🏺', type: 'furniture', desc: 'Pretty vase of blooms', price: { petals: 15, coins: 0  } },
  { id: 'plant_bonsai',     name: 'Bonsai Plant',       emoji: '🌿', type: 'furniture', desc: 'Tiny cute bonsai tree', price: { petals: 25, coins: 0  } },
  { id: 'bookshelf',        name: 'Bookshelf',          emoji: '📚', type: 'furniture', desc: 'A cozy bookshelf',      price: { petals: 30, coins: 0  } },
  { id: 'lamp_gold',        name: 'Gold Lamp',          emoji: '🪔', type: 'furniture', desc: 'Warm golden lamp',      price: { petals: 0,  coins: 5  } },
  { id: 'mirror_heart',     name: 'Heart Mirror',       emoji: '🪞', type: 'furniture', desc: 'Heart-shaped mirror',   price: { petals: 0,  coins: 8  } },
  // decor
  { id: 'teapot_flower',    name: 'Flower Teapot',      emoji: '🫖', type: 'decor',     desc: 'Cute little teapot',    price: { petals: 8,  coins: 0  } },
  { id: 'poster_stars',     name: 'Star Poster',        emoji: '🌟', type: 'decor',     desc: 'Sparkly star poster',   price: { petals: 12, coins: 0  } },
  { id: 'candle_rose',      name: 'Rose Candle',        emoji: '🕯️', type: 'decor',     desc: 'Scented rose candle',   price: { petals: 5,  coins: 0  } },
  { id: 'cat_plush',        name: 'Cat Plush',          emoji: '🐱', type: 'decor',     desc: 'Adorable stuffed cat',  price: { petals: 0,  coins: 6  } },
  { id: 'clock_wall',       name: 'Flower Clock',       emoji: '⏰', type: 'decor',     desc: 'Pretty floral clock',   price: { petals: 0,  coins: 10 } },
];

export function canAfford(price) {
  return S.bank.petals >= (price.petals || 0) && S.bank.coins >= (price.coins || 0);
}

/* returns true on success; persists to localStorage (caller schedules cloud save) */
export function buy(itemId) {
  const item = CATALOG.find(i => i.id === itemId);
  if (!item || S.ownedItems.includes(itemId) || !canAfford(item.price)) return false;
  S.bank.petals -= (item.price.petals || 0);
  S.bank.coins  -= (item.price.coins  || 0);
  S.ownedItems.push(itemId);
  store.set('bank',       JSON.stringify({ petals: S.bank.petals, coins: S.bank.coins }));
  store.set('ownedItems', JSON.stringify(S.ownedItems));
  S.hudDirty = true;
  checkAchievements();
  return true;
}
