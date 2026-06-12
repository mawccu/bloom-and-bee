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
  // ── Phase: expanded economy — petal-priced furniture ──
  { id: 'stool_round',      name: 'Round Stool',        emoji: '🪑', type: 'furniture', desc: 'Comfy little stool',    price: { petals: 10, coins: 0  } },
  { id: 'painting_flower',  name: 'Flower Painting',    emoji: '🖼️', type: 'decor',     desc: 'Hand-painted bloom',    price: { petals: 16, coins: 0  } },
  { id: 'chair_wood',       name: 'Wooden Chair',       emoji: '🪑', type: 'furniture', desc: 'Sturdy wooden chair',   price: { petals: 18, coins: 0  } },
  { id: 'globe_desk',       name: 'Desk Globe',         emoji: '🌍', type: 'decor',     desc: 'A spinning world',      price: { petals: 14, coins: 0  } },
  { id: 'coffee_table',     name: 'Coffee Table',       emoji: '🪵', type: 'furniture', desc: 'Low cosy table',        price: { petals: 24, coins: 0  } },
  { id: 'rug_round',        name: 'Round Rug',          emoji: '🟢', type: 'furniture', desc: 'Soft minty rug',        price: { petals: 24, coins: 0  } },
  { id: 'plant_tall',       name: 'Tall Plant',         emoji: '🪴', type: 'furniture', desc: 'Leafy floor plant',     price: { petals: 26, coins: 0  } },
  { id: 'table_round',      name: 'Round Table',        emoji: '🛎️', type: 'furniture', desc: 'Pedestal dining table', price: { petals: 32, coins: 0  } },
  { id: 'guitar_stand',     name: 'Acoustic Guitar',    emoji: '🎸', type: 'decor',     desc: 'Strums on its stand',   price: { petals: 34, coins: 0  } },
  { id: 'sofa_pink',        name: 'Pink Sofa',          emoji: '🛋️', type: 'furniture', desc: 'Squishy two-seater',    price: { petals: 48, coins: 0  } },
  // ── coin-priced premium pieces (earn via exchange / achievements) ──
  { id: 'floor_lamp',       name: 'Floor Lamp',         emoji: '💡', type: 'furniture', desc: 'Tall standing lamp',    price: { petals: 0,  coins: 4  } },
  { id: 'trophy_gold',      name: 'Gold Trophy',        emoji: '🏆', type: 'decor',     desc: 'For the best girl',     price: { petals: 0,  coins: 6  } },
  { id: 'fridge_mini',      name: 'Mini Fridge',        emoji: '🧊', type: 'furniture', desc: 'Keeps snacks cool',     price: { petals: 0,  coins: 9  } },
  { id: 'tv_flat',          name: 'Flat-screen TV',     emoji: '📺', type: 'furniture', desc: 'Movie nights in!',      price: { petals: 0,  coins: 13 } },
  { id: 'piano_grand',      name: 'Grand Piano',        emoji: '🎹', type: 'furniture', desc: 'Play me a song 🎵',     price: { petals: 0,  coins: 22 } },
];

/* ============================== petals → coins exchange ==============================
   Coins are the premium currency that buys the nicer shop pieces. Let her convert
   farmed petals into coins at a fixed rate so the loop earn → exchange → buy works. */
export const EXCHANGE_RATE = 10;   // petals per 1 coin

export function maxExchangeableCoins() {
  return Math.floor(S.bank.petals / EXCHANGE_RATE);
}

/* convert `coins` worth of petals into coins. returns true on success. */
export function exchangePetalsForCoins(coins) {
  coins = Math.floor(coins);
  const cost = coins * EXCHANGE_RATE;
  if (coins <= 0 || S.bank.petals < cost) return false;
  S.bank.petals -= cost;
  S.bank.coins  += coins;
  store.set('bank', JSON.stringify({ petals: S.bank.petals, coins: S.bank.coins }));
  S.hudDirty = true;
  return true;
}

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
