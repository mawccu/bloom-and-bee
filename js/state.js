/* ============================== profiles / storage ============================== */
export const PROFILE_KEY = 'bloombee_profile';
export const PROFILE_DATA_KEYS = ['best','bestlvl','curlevel','hd','snd','chime','ctrl','dress','hair','intRug','intBed','intVase','bank','ownedItems','placedFurniture'];
export let profileId = localStorage.getItem(PROFILE_KEY) || '';
const nsKey = k => profileId ? `bloombee_${profileId}_${k}` : 'bloombee_' + k;
export const store = {
  get: (k, d) => { const v = localStorage.getItem(nsKey(k)); return v === null ? d : v; },
  set: (k, v) => localStorage.setItem(nsKey(k), v),
};
export function setProfile(id) {
  id = id.trim().slice(0, 24);
  if (!id) return false;
  if (!localStorage.getItem(PROFILE_KEY)) {
    // first-ever profile pick: bring along any pre-profile saves so progress isn't lost
    PROFILE_DATA_KEYS.forEach(k => {
      const legacy = localStorage.getItem('bloombee_' + k);
      if (legacy !== null) {
        localStorage.setItem(`bloombee_${id}_${k}`, legacy);
        localStorage.removeItem('bloombee_' + k);
      }
    });
  }
  localStorage.setItem(PROFILE_KEY, id);
  location.reload();
  return true;
}

/* ============================== run / game constants ============================== */
export const MAX_HEARTS = 3;
export const SPRINT_MULT = 1.7, STAM_DRAIN = 1 / 2.6, STAM_REGEN = 1 / 4.2, STAM_READY = 0.45;

/* ============================== shared mutable state ==============================
   A single live object every module reads & writes, so reassignments are visible
   everywhere (plain exported `let` reassignments don't cross module boundaries). */
export const S = {
  // quality / audio toggles
  hdOn: store.get('hd', '1') === '1',
  AC: null,
  soundOn: store.get('snd', '1') === '1',
  chimesOn: store.get('chime', '1') === '1',

  // Malek ultimate
  malekCharge: 0, malekWasReady: false,
  ultActive: false, ultPhase: '', ultT: 0, ultDidBlast: false,
  kissCd: 0, kissAnimT: 0,
  _ultTriggeredWin: false, _carryTarget: null,

  // upgrades / run resources
  upg: { shoes: 0, basket: 0, wand: 0, charm: 0, time: 0, lucky: 0, shield: 0 },
  hearts: 3, petals: 0, shieldCharges: 0, boostT: 0,

  // persistent currency bank (survives lost runs; stored as JSON under the 'bank' save key)
  bank: (() => { try { return Object.assign({ petals: 0, coins: 0 }, JSON.parse(store.get('bank', '') || 'null') || {}); } catch (e) { return { petals: 0, coins: 0 }; } })(),

  // owned items (purchased from the shop; stored as JSON array)
  ownedItems: (() => { try { return JSON.parse(store.get('ownedItems', '[]') || '[]') || []; } catch (e) { return []; } })(),

  // placed furniture (slot → itemId map; persists house layout)
  placedFurniture: (() => { try { return JSON.parse(store.get('placedFurniture', '{}') || '{}') || {}; } catch (e) { return {}; } })(),

  // game flow
  state: 'menu',
  level: 1, score: 0,
  best: +store.get('best', 0), bestLvl: +store.get('bestlvl', 0),
  savedLevel: Math.max(1, parseInt(store.get('curlevel', '1'), 10) || 1),
  totalPicked: 0,
  progress: 0, need: 10, timeLeft: 55, timeMax: 55,
  combo: 0, lastPickAt: -99,
  stunned: 0, invuln: 0, shake: 0, winT: 0,
  gameT: 0, animT: 0,
  swatArmT: 0,
  spawnCd: 0, nextButterflyAt: 10, nextPickupAt: 14, nextCrowAt: 20, nextTipAt: 30, nextChime: 0,
  moving: false, walkT: 0, lastMoveT: 0,
  swatCd: 0, swatAnimT: 0,
  lowTimeWarned: false, idleWarned: false,

  // sprint / stamina
  sprintBtnHeld: false, stamina: 1, exhausted: false, sprinting: false,

  // current level config (set once levelCfg is available)
  cfg: null,

  // input
  ctrlMode: store.get('ctrl', 'stick'), // 'stick' | 'fixed' | 'tap'
  tapTarget: null,

  // house interior
  insideHouse: false, intYaw: 0, housePromptVisible: false,

  // win/shop hand-off + HUD
  _winShopData: null,
  hudDirty: true,
};
