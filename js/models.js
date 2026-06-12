import { GLTFLoader } from './GLTFLoader.js';

const loader = new GLTFLoader();
const cache = {};

export function loadModel(name) {
  if (cache[name]) return Promise.resolve(cache[name].clone());
  return new Promise((res, rej) => {
    loader.load('./assets/models/' + name, gltf => {
      cache[name] = gltf.scene;
      gltf.scene.traverse(c => {
        if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
      });
      res(gltf.scene.clone());
    }, undefined, rej);
  });
}
