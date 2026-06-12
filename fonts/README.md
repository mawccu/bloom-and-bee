# Bundled fonts

## twemoji.woff2

A COLR/CPAL colour-emoji web font (Twemoji 15.0) bundled so emoji render
**identically on every device** (Android, iPhone, desktop) and **fully offline**
inside the Cordova/WebView APK — the OS emoji font is never used.

- Source: [twemoji-colr-font](https://github.com/mrdrogdrog/twemoji-color-font) `v15.0.3`
- Emoji artwork: Twemoji by Twitter / the Twemoji contributors
- Font licence: **SIL Open Font License 1.1 (OFL-1.1)**
- Emoji graphics licence: **CC-BY 4.0**

Wired up via `@font-face { font-family:'BloomEmoji' }` in `styles.css` and placed
first in the emoji unicode-range of every UI font stack. The 3-D building-sign
labels (canvas textures in `js/hub.js`) also use it and re-render once it loads.
