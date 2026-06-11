import { S } from './state.js';
import { girlInCloud } from './enemies.js';

/* ============================== upgrades / run state ============================== */
export const UPGRADES = {
  shoes:  { emoji: '👟', name: 'Speedy Shoes', desc: 'walk faster',         costs: [8, 18, 32] },
  basket: { emoji: '🧺', name: 'Big Basket',   desc: 'longer pick reach',   costs: [8, 18, 32] },
  wand:   { emoji: '🪄', name: 'Magic Wand',   desc: 'bigger, faster swat', costs: [10, 20, 34] },
  charm:  { emoji: '🎀', name: 'Bee Charm',    desc: 'calmer, slower bees', costs: [10, 22, 38] },
  time:   { emoji: '⏰', name: 'Time Petal',   desc: '+8s every level',     costs: [8, 16, 28] },
  lucky:  { emoji: '🍀', name: 'Lucky Petal',  desc: 'more golden blooms',  costs: [10, 20, 34] },
  shield: { emoji: '🛡️', name: 'Petal Shield', desc: 'blocks a sting',      costs: [12, 24, 40] },
};
export const stat = {
  speed: () => (6.6 + S.upg.shoes * 0.6) * (S.boostT > 0 ? 1.55 : 1) * (girlInCloud() ? 0.55 : 1),
  pickR: () => 1.35 + S.upg.basket * 0.3,
  swatR: () => 2.4 + S.upg.wand * 0.45,
  swatCd: () => Math.max(1.0, 2.2 - S.upg.wand * 0.35),
  aggro: () => Math.max(2.6, 4.6 - S.upg.charm * 0.7),
  chaseDur: () => Math.max(1.8, 3.4 - S.upg.charm * 0.55),
  beeSpeedMul: () => 1 - S.upg.charm * 0.08,
  goldenChance: () => 0.09 + S.upg.lucky * 0.04,
  extraTime: () => S.upg.time * 8,
};
