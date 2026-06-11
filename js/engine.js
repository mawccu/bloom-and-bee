import * as THREE from 'three';
import { S } from './state.js';

/* ============================== renderer / scene ============================== */
export const renderer = new THREE.WebGLRenderer({ antialias: true });
export function applyQuality() { renderer.setPixelRatio(S.hdOn ? Math.min(devicePixelRatio, 2) : 1); renderer.setSize(innerWidth, innerHeight); }
applyQuality();
renderer.domElement.className = 'game3d';
document.body.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
const skyCanvas = document.createElement('canvas'); skyCanvas.width = 2; skyCanvas.height = 512;
const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
scene.fog = new THREE.Fog(0xdcf0fb, 55, 160);

export const SKIES = {
  noon:    { stops: ['#9ed9ff', '#d6f0ff', '#ffeaf5'], fog: 0xdcf0fb, hemi: 0xd8edff, ground: 0xb2dba0 },
  morning: { stops: ['#ffd2a8', '#ffe9d0', '#fff7ec'], fog: 0xffeeda, hemi: 0xffe9cf, ground: 0xc4dba0 },
  sunset:  { stops: ['#ff9fc0', '#ffd0c0', '#ffe8da'], fog: 0xffe0d8, hemi: 0xffd8e2, ground: 0xbcd49c },
  rush:    { stops: ['#ffe18f', '#fff0c0', '#fffae6'], fog: 0xfff2cc, hemi: 0xfff0c0, ground: 0xc8dd9a },
};
export function paintSky(sk) {
  const ctx = skyCanvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, sk.stops[0]); g.addColorStop(0.55, sk.stops[1]); g.addColorStop(1, sk.stops[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 512);
  skyTex.needsUpdate = true;
  scene.fog.color.setHex(sk.fog);
  hemiLight.color.setHex(sk.hemi);
  hemiLight.groundColor.setHex(sk.ground);
}

export const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 320);
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.8 ? 68 : 58;
  camera.updateProjectionMatrix();
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); fitCamera(); });
fitCamera();

export const hemiLight = new THREE.HemisphereLight(0xd8edff, 0xb2dba0, 1.3);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xfff2d8, 1.0);
sunLight.position.set(-12, 20, 8);
scene.add(sunLight);
paintSky(SKIES.noon);

// shared frame clock (used by the main loop and the visibility/refocus handler)
export const clock = new THREE.Clock();
