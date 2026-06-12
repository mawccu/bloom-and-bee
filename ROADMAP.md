# Bloom & Bee — V2 Build Roadmap (hub world · shop · economy · house · achievements)

> This file is the build spec for the next session. Owner (Malek) wants to turn the game
> from "walk a meadow, gather flowers on a timer, swat bees" into a real game with a hub
> world, a buyable/decoratable house, a proper shop run by the Malek NPC, a persistent
> currency bank, and achievements/goals/challenges. BUILD INCREMENTALLY, phase by phase,
> TEST in the browser after each phase, COMMIT per phase, and DO NOT push (the orchestrator
> pushes). Keep everything working on web AND inside the Cordova APK WebView (page loads
> over file://, uses an importmap for three, all imports relative `./x.js`).

## 0. Current architecture (READ THE CODE FIRST)
Single-page Three.js game. Entry: index.html -> importmap(three) + styles.css + js/main.js.
16 ES modules in js/: state, utils, audio, engine, world, particles, characters, flowers,
enemies, upgrades, gameplay, input, ui, house, cloud, main.
- state.js  : the shared `S` object (all mutable game state) + localStorage primitives + SAVE_KEYS.
- cloud.js  : Supabase cloud sync. The save blob = the keys in SAVE_KEYS. `scheduleCloudSave()`
              (debounced) is already called on level clear, upgrade buy, and house decorate.
- house.js  : current cottage interior (this is the "glitchy" one to overhaul).
- world.js  : meadow construction. gameplay.js: levels/win-loss/picking/ult/per-frame loop.
- ui.js     : screens, HUD, buttons, save/profile UI, cloud orchestration.
KEY RULE: anything that must persist/grow goes into the `S` state AND into SAVE_KEYS so it
auto-syncs to Supabase. Reuse the existing save blob; do not invent a parallel save system.

## 1. The vision (what to build)
1) OVERWORLD HUB MAP: the "home" becomes a small external map she walks around. On it sit
   entrances/buildings: the HOUSE, the SHOP, and the MEADOW (where the flower levels start).
   Walking near an entrance shows an "Enter" prompt/button; pressing it transitions her in.
2) HOUSE (big interior): fix the current glitchy interior (items mispositioned / floating).
   Rebuild it on a clean grid/slot system. Furniture & decor are ITEMS she BUYS (petals/coins)
   and then PLACES; placement persists and syncs. The house is also the HUB that displays her
   stats, achievements, goals, and challenge progress.
3) SHOP: a dedicated building. Inside, the Malek NPC stands behind a counter/cash register.
   She walks up to him -> "Browse store" button -> a catalog UI opens -> she can actually BUY
   items (furniture, upgrades, cosmetics) with petals/coins. Purchases go to ownedItems.
4) ECONOMY: a persistent PETAL/COIN BANK (separate from per-run score). She earns currency from
   levels/achievements/challenges and spends it in the shop. Never resets on a lost run.
5) RICHER GAMEPLAY: more than timed flower-gathering + bee-swatting. Add real interaction with
   objects, bigger map, more options/buttons, multiple activity types, and meaningful goals.
6) ACHIEVEMENTS / GOALS / CHALLENGES: a defined set with progress tracking, unlock popups, and
   currency rewards. The house keeps track of all of them on a board.

## 2. Data-model additions (put in `S` and add every key to SAVE_KEYS so it cloud-syncs)
- `bank`            : { petals: number, coins: number }  (persistent currency, NOT per-run score)
- `ownedItems`      : string[]  (ids of purchased furniture/decor/cosmetics)
- `placedFurniture` : { [itemId]: { slot|x,y,z, rot } }  (house layout)
- `achievements`    : { [id]: number|boolean }  (unlocked / progress)
- `challenges`      : { [id]: { progress, done } }  (rotating/daily goals)
- `stats`           : lifetime counters used by achievements (flowers, levels, bees, runs, etc.)
- Keep existing keys (best, bestlvl, curlevel, settings, dress, hair, interior...). 
- IMPORTANT: extend the cloud merge logic so "more progressed" still works — when merging local
  vs cloud, prefer the higher saved level AND do not clobber a higher bank/ownedItems set
  (union ownedItems; take max of bank/stats). Update cloud.js merge accordingly.

## 3. New modules to add (keep focused; reuse utils/engine/state)
- `economy.js`     : currency bank get/add/spend, the ITEM CATALOG (id, name, price, type, mesh
                     factory or asset), helpers `canAfford`, `buy(itemId)`.
- `hub.js`         : the overworld map mesh + player walking on it + building trigger zones +
                     "Enter" prompts + transitions (meadow / house / shop). Becomes the new
                     default screen after the title (Play -> Hub, not straight into a level).
- `shop.js`        : shop interior build + Malek NPC behind counter + proximity "Browse store"
                     trigger + the store catalog UI + purchase flow (calls economy.buy).
- `decor.js`       : placeable-furniture system — slot grid in the house, place/move/remove an
                     owned item, render placedFurniture, persist via S+SAVE_KEYS.
- `achievements.js`: achievement/goal/challenge DEFINITIONS + progress checks (hook into events:
                     level clear, flower pick, bee swat, purchase, decorate) + unlock toast +
                     reward payout into bank. Plus the in-house tracking board UI.
- Overhaul `house.js` into the clean interior that uses decor.js for furniture.
NOTE: index.html still loads only js/main.js; the APK workflow already does `cp -r js`, so any
new js/*.js ships automatically — no workflow change needed. main.js imports the new modules.

## 4. Build order (phases — do in this order, test+commit each)
PHASE 1 — Economy & bank (foundation):
  Add bank{petals,coins} to S + SAVE_KEYS; show a small currency HUD; award currency on level
  clear (and convert/keep existing petals logic). Verify it persists + cloud-syncs. No UI shop yet.
PHASE 2 — Hub overworld:
  Build hub.js: a walkable map with 3 building trigger zones (Meadow/House/Shop). Title "Play"
  -> Hub. Walking to a zone shows "Enter X". Meadow entrance launches the existing level flow;
  House/Shop entrances open their interiors (stub interiors ok this phase). Reuse input.js
  movement. Test: walk around, enter each, come back to hub.
PHASE 3 — Shop:
  shop.js interior + Malek NPC behind a counter (reuse characters.js Malek mesh). Proximity to
  him shows "Browse store" -> catalog UI listing economy.js items with prices -> buy with
  bank currency -> adds to ownedItems, deducts currency, "purchased" feedback. Test buying.
PHASE 4 — House overhaul + decor:
  Rebuild house.js interior cleanly (fix floating/misplaced items). decor.js: owned furniture
  can be placed on a slot grid, moved, removed; layout persists in placedFurniture + syncs.
  Furniture is bought in the shop (Phase 3 catalog). Test: buy -> place -> reload -> still there.
PHASE 5 — Achievements / goals / challenges:
  achievements.js definitions + event hooks + progress + unlock toast + currency rewards. A
  board in the house shows them and overall stats. Test a few unlocks end-to-end.
PHASE 6 — Richer gameplay / interactions:
  More than the timed flower run: add object interactions, more level/activity types, bigger
  meadow, more buttons/options. Driven by what feels fun once Phases 1–5 exist.

## 5. Rules for the building session
- Work on a clean origin/main: `git fetch && git reset --hard origin/main && git clean -fd`.
- Reuse the `S` state + SAVE_KEYS + cloud.js sync for ALL persistence. Don't fork the save system.
- Keep modules focused and relative-imported; must run over file:// in the APK WebView.
- TEST in the browser preview after each phase (zero console errors + the new flow works);
  COMMIT per phase with a clear message; DO NOT push (orchestrator handles pushing).
- The Supabase project + table are already set up and working; cloud sync is already wired.
