import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ===================== renderer =====================
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x05070c, 12, 30);
const bgC = document.createElement('canvas'); bgC.width = 4; bgC.height = 512;
const bx = bgC.getContext('2d'); const bg = bx.createLinearGradient(0, 0, 0, 512);
bg.addColorStop(0, '#28303b'); bg.addColorStop(0.5, '#131922'); bg.addColorStop(1, '#04060a');
bx.fillStyle = bg; bx.fillRect(0, 0, 4, 512);
scene.background = Object.

updateCaption(t);
}

// ===================== playback =====================
const vo = document.getElementById('vo'), music = document.getElementById('music');
const startOv = document.getElementById('start'), replay = document.getElementById('replay');
let playing = false, startT = 0;
function begin() {
startT = performance.now(); playing = true;
startOv.style.opacity = '0'; setTimeout(() => startOv.style.display = 'none', 800);
replay.style.opacity = '1';
try { vo.currentTime = 0; music.currentTime = 0; music.volume = 0.32; vo.volume = 1; vo.play(); music.play(); } catch (e) {}
}
document.getElementById('play').onclick = begin;
replay.onclick = () => { startOv.style.display = 'flex'; requestAnimationFrame(() => startOv.style.opacity = '1'); playing = false; };

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });

let previewT = 0, held = false, heldT = 0;
function render(t) { frame(t); const { p, l } = camAt(t); camera.position.copy(p); camera.lookAt(l); composer.render(); }
function loop() {
if (held) { render(heldT); requestAnimationFrame(loop); return; }
const t = playing ? Math.min(DUR, (performance.now() - startT) / 1000) : (previewT = (previewT + 0.006) % 6);
render(t);
if (playing && t >= DUR) { playing = false; capEl.style.opacity = 0; }
requestAnimationFrame(loop);
}
// expose for headless verification (freezes the loop on a fixed t)
window.__seek = (t) => { held = true; heldT = t; render(t); };
window.__ready = true;
loop();
