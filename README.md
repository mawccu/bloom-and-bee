# Bloom &amp; Bee 🌸

A cute little 3D flower-picking game starring **Ranooma**. Walk the meadow, fill the basket before the flowers wilt, swat away grumpy bees, wasps, bunnies and flower-thieving crows, dodge the rain cloud, grab boosts &amp; gifts, and spend petals on upgrades between levels. **Malek** (the dev 💻) pops in with tips and cheers along the way.

> Made with 💕 by Malek, for Ranooma.

## ▶️ Play

- **Online:** open **https://mawccu.github.io/bloom-and-bee/** (GitHub Pages).
- **On a phone/tablet:** download the APK from the [Releases page](https://github.com/mawccu/bloom-and-bee/releases) and install it (you'll need to allow "install from unknown sources").
- **Locally:** serve the folder with any static server, e.g. `python -m http.server 8000`, then visit `http://localhost:8000`.

## 🎮 How to play

- **Move:** drag anywhere (floating stick), use the fixed stick, or tap-to-move — pick your control style on the title screen. Arrow keys / WASD also work.
- **Swat 💫:** tap the button (or Space / E) to whack bees, shoo the bunny, and make the crow drop stolen flowers.
- **Goal:** collect the required flowers before time runs out. Golden = worth more, rainbow = rare &amp; precious.
- **Watch out:** bees &amp; wasps sting (you have 3 hearts), bunnies eat your flowers, crows steal them, the rain cloud slows you and wilts blooms.
- **Upgrades:** earn petals, then buy Speedy Shoes, Big Basket, Magic Wand, Bee Charm, Time Petal, Lucky Petal and Petal Shield.

## 🛠️ Tech

Single-file HTML5 game using [Three.js](https://threejs.org) (bundled locally, no build step, fully offline). The Android APK is a thin WebView wrapper built automatically by GitHub Actions (Cordova) — see [`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml).

## 📦 Building the APK

Push to `main` (or run the **Build Android APK** workflow manually from the Actions tab). The workflow wraps the web game and publishes a debug `.apk` as a downloadable artifact and a GitHub Release.
