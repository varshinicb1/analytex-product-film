/*
 * AnalyteX — product film v2
 * ─────────────────────────────────────────────────────────────
 * A real-time Three.js film. Everything on screen is driven by one
 * clock `t` (seconds), which follows the voiceover audio while it plays.
 * Scene timings come from timeline.json, written by tools/gen_vo.py, so
 * re-recording the voiceover re-times the whole film automatically.
 *
 * Product truth this film keeps to (see README "Claims"):
 *   - Device has no display in use: results live in the phone app (BLE).
 *   - Methods: CV, DPV, SWV, CA, EIS. Connectivity: Bluetooth LE + USB-C.
 *   - Heavy metals is the first assay; other sensors are "in development".
 *   - All on-screen results are labelled demonstration data.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const QS = new URLSearchParams(location.search);
const CAPTURE = QS.has('capture');              // frame-exact export mode (tools/capture.mjs)

/* ══════════════════════════════════════════════════════
   TIMELINE  (on-screen type cues; no voiceover)
══════════════════════════════════════════════════════ */
const TL = await fetch('./timeline.json').then(r => r.json());
const DUR = TL.duration;
const CUES = TL.cues;
const cuesOf = s => CUES.filter(c => c.scene === s);
const first = s => cuesOf(s)[0];

// Scene starts, a beat before each scene's first line
const T = {
  cold: 0,
  reveal: first('reveal').start - 0.8,
  methods: first('methods').start - 0.7,
  assay: first('assay').start - 0.5,
  result: first('result').start - 0.6,
  platform: first('platform').start - 0.6,
  finale: first('finale').start - 0.6,
};
// Assay beats
const A_INSERT = T.assay;                        // electrode slides into the slot
const A_DROP   = cuesOf('assay')[1].start - 0.9; // dropper arrives
const A_SWEEP  = cuesOf('assay')[2].start - 0.6; // measurement runs
const A_SWEEP_END = cuesOf('assay')[2].end + 0.6;
// The phone steps through the five methods across the first methods cue
const methodCue = cuesOf('methods')[0];
const METHOD_T = [0, 1, 2, 3, 4].map(i => methodCue.start - .4 + i * (methodCue.end - methodCue.start) / 5);

const CHAPTERS = [
  { t: T.cold,     id: 'open',     label: 'Opening' },
  { t: T.reveal,   id: 'device',   label: 'The instrument', n: '01' },
  { t: T.methods,  id: 'methods',  label: 'Five techniques', n: '02' },
  { t: T.assay,    id: 'assay',    label: 'One drop', n: '03' },
  { t: T.result,   id: 'result',   label: 'The result', n: '04' },
  { t: T.platform, id: 'platform', label: 'The platform', n: '05' },
  { t: T.finale,   id: 'finale',   label: 'AnalyteX' },
];

/* ══════════════════════════════════════════════════════
   RENDERER / SCENE / CAMERA
══════════════════════════════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: CAPTURE });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-hidden', 'true');
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// A plain graphite studio: seamless backdrop, no fog, no grid, no glow.
const STUDIO = 0x1b1c1e;
scene.background = new THREE.Color(0x0e0e0f);
scene.fog = new THREE.Fog(0x0e0e0f, 16, 34);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 120);
let distK = 1; // portrait screens pull the camera back so both objects stay in frame
function setFov() {
  const ar = innerWidth / innerHeight;
  camera.aspect = ar;
  camera.fov = ar < 0.6 ? 58 : ar < 0.85 ? 52 : ar < 1.2 ? 46 : 40;
  distK = ar < 0.6 ? 1.75 : ar < 0.85 ? 1.4 : ar < 1.2 ? 1.12 : 1;
  camera.updateProjectionMatrix();
}
setFov();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.015).texture;
scene.environmentIntensity = 0.55;

/* ── Lights: one soft key, a broad fill, a neutral back light ── */
const keyL = new THREE.DirectionalLight(0xfff4e8, 2.2);
keyL.position.set(-5, 9, 6); keyL.castShadow = true;
keyL.shadow.mapSize.set(2048, 2048); keyL.shadow.bias = -0.0002; keyL.shadow.radius = 6;
Object.assign(keyL.shadow.camera, { left: -8, right: 8, top: 12, bottom: -12 });
scene.add(keyL);
const rimL = new THREE.DirectionalLight(0xffffff, .9); rimL.position.set(5, 5, -6); scene.add(rimL);
const fillL = new THREE.DirectionalLight(0xf0f2f5, .45); fillL.position.set(6, 1, 5); scene.add(fillL);
scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, .25));

/* ── Seamless sweep: floor curving up into the back wall ── */
{
  // profile in (z, y): flat floor, a quarter-circle cove, then the back wall
  const R = 6, W = 80, D = 40, H = 30, ZC = -8, seg = 24;
  const prof = [new THREE.Vector2(D, 0)];
  for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI / 2; prof.push(new THREE.Vector2(ZC - R * Math.sin(a), R - R * Math.cos(a))); }
  prof.push(new THREE.Vector2(ZC - R, H));
  const g = new THREE.BufferGeometry(), pos = [], idx = [];
  prof.forEach(v => { pos.push(-W / 2, v.y, v.x, W / 2, v.y, v.x); });
  for (let i = 0; i < prof.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const sweep = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: STUDIO, roughness: .92, metalness: 0, envMapIntensity: .2, side: THREE.DoubleSide }));
  sweep.position.y = -3.4; sweep.receiveShadow = true; scene.add(sweep);
}

/* ══════════════════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════════════════ */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const sm2 = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10);
const lp = (a, b, t) => a + (b - a) * t;
const c01 = v => Math.max(0, Math.min(1, v));
const span = (t, a, b) => c01((t - a) / (b - a));
function place(m, x, y, z, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; }
function ctex(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return [c, c.getContext('2d'), t];
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const FONT = '"Inter", system-ui, Arial, sans-serif';
const DISPLAY = FONT;
const font = (w, s, f = FONT) => `${w} ${s}px ${f}`;

/* ══════════════════════════════════════════════════════
   MATERIALS
══════════════════════════════════════════════════════ */
const M_body = new THREE.MeshPhysicalMaterial({ color: 0x070909, roughness: .86, metalness: .04, clearcoat: .05, clearcoatRoughness: .85 });
const M_face = new THREE.MeshPhysicalMaterial({ color: 0x0c1015, roughness: .38, metalness: .18, clearcoat: .75, clearcoatRoughness: .2 });
const M_bezel = new THREE.MeshPhysicalMaterial({ color: 0x080b0e, roughness: .28, metalness: .22, clearcoat: .85 });
const M_metal = new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: .26, metalness: 1 });
const M_darkMt = new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: .34, metalness: .94 });
const M_glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1018, roughness: .06, metalness: 0, transparent: true, opacity: .1, clearcoat: 1 });
const M_gold = new THREE.MeshPhysicalMaterial({ color: 0xd4a820, roughness: .18, metalness: 1, clearcoat: .3, clearcoatRoughness: .2, envMapIntensity: 1.5 });
const M_speBase = new THREE.MeshPhysicalMaterial({ color: 0x0a0b0d, roughness: .82, metalness: .04, clearcoat: .12, clearcoatRoughness: .7 });
const nanoMat = (color, iri, ior) => new THREE.MeshPhysicalMaterial({ color, roughness: .5, metalness: .55, clearcoat: .5, clearcoatRoughness: .25, iridescence: iri, iridescenceIOR: ior, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });

/* Sensors. Only HM is a released assay; the rest are shown as in development. */
const SENSORS = {
  HM:   { name: 'Heavy metals', analytes: 'Pb · Cd · As · Cu', hex: '#e5484d', status: 'First release', live: true, mat: nanoMat(0x101418, .85, 1.9) },
  FM:   { name: 'Formalin', analytes: 'HCHO', hex: '#f5a524', status: 'In development', mat: nanoMat(0x141008, .6, 1.7) },
  PEST: { name: 'Pesticides', analytes: 'Organophosphates', hex: '#46a758', status: 'In development', mat: nanoMat(0x0a1208, .4, 1.52) },
  NPK:  { name: 'Soil nutrients', analytes: 'N · P · K', hex: '#a07a5a', status: 'In development', mat: nanoMat(0x12100a, .25, 1.35) },
};

/* ══════════════════════════════════════════════════════
   DEVICE — screen-less body with a status window
══════════════════════════════════════════════════════ */
const device = new THREE.Group();
{
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.6, 4.5, .9, 8, .22), M_body);
  body.castShadow = body.receiveShadow = true; device.add(body);
  device.add(place(new THREE.Mesh(new RoundedBoxGeometry(2.4, 4.3, .12, 6, .14), M_face), 0, 0, .38));
  device.add(place(new THREE.Mesh(new RoundedBoxGeometry(2.0, 2.7, .024, 4, .06), M_bezel), 0, .7, .44));
}
// Status window: emblem + LED ring. Drawn on a canvas each frame.
const [, sx, sTex] = ctex(512, 690);
const statusMesh = place(new THREE.Mesh(new THREE.PlaneGeometry(1.84, 2.48), new THREE.MeshBasicMaterial({ map: sTex, toneMapped: false })), 0, .7, .463);
statusMesh.renderOrder = 1; device.add(statusMesh);
device.add(place(new THREE.Mesh(new THREE.PlaneGeometry(1.92, 2.62), M_glass.clone()), 0, .7, .473));
// Lower nameplate
{
  const [, x, tex] = ctex(512, 192);
  x.fillStyle = '#0b0c0d'; x.fillRect(0, 0, 512, 192);
  x.textAlign = 'center';
  x.fillStyle = '#d9b24a'; x.font = font(700, 20); x.letterSpacing = '6px'; x.fillText('VIDYUTHLABS', 256, 62);
  x.fillStyle = '#e8eef5'; x.font = font(700, 44, DISPLAY); x.letterSpacing = '0px'; x.fillText('AnalyteX', 256, 116);
  x.fillStyle = '#5c6167'; x.font = font(500, 16); x.letterSpacing = '3px'; x.fillText('CV · DPV · SWV · CA · EIS', 256, 156);
  tex.needsUpdate = true;
  const m = place(new THREE.Mesh(new THREE.PlaneGeometry(2.0, .74), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })), 0, -1.12, .453);
  m.renderOrder = 1; device.add(m);
}
// Sensor slot (top)
device.add(place(new THREE.Mesh(new RoundedBoxGeometry(1.2, .52, .36, 3, .08), M_darkMt), 0, 2.24, .15));
device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.95, .2, .25), new THREE.MeshStandardMaterial({ color: 0x000000 })), 0, 2.3, .15));
[-0.26, 0, .26].forEach(x => device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.1, .04, .1), M_gold), x, 2.31, .15)));
// Side button, USB-C, screws, grip ridges
device.add(place(new THREE.Mesh(new RoundedBoxGeometry(.08, .55, .18, 3, .03), M_darkMt), 1.29, 1.0, .04));
device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.14, .27, .48), M_darkMt), -1.29, .55, 0));
device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.06, .13, .32), new THREE.MeshStandardMaterial({ color: 0x020305 })), -1.34, .55, 0));
[[-1.1, 2.1], [1.1, 2.1], [-1.1, -2.1], [1.1, -2.1]].forEach(([x, y]) => device.add(place(new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .06, 6), M_metal), x, y, .43, Math.PI / 2)));
for (let i = 0; i < 8; i++) { const gy = -1.2 + i * .35; [-1.28, 1.28].forEach(sxp => device.add(place(new THREE.Mesh(new THREE.BoxGeometry(.055, .14, .56), M_body), sxp, gy, 0))); }
scene.add(device);

// Status window states: 'off' | 'idle' | 'ble' | 'ready' | 'run' | 'done'
function drawStatus(t, state, prog = 0) {
  const c = sx, W = 512, H = 690, cx = W / 2, cy = 300;
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#0b0c0d'; c.fillRect(0, 0, W, H);
  if (state === 'off') { sTex.needsUpdate = true; return; }
  const col = { idle: '#cfd3d8', ble: '#cfd3d8', ready: '#cfd3d8', run: '#d9b24a', done: '#7fc79a' }[state];
  const breathe = .55 + .45 * Math.sin(t * 2.2);
  // faint track
  c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.07)';
  c.beginPath(); c.arc(cx, cy, 150, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 4;
  c.strokeStyle = col; c.lineCap = 'round';
  if (state === 'run') {
    c.beginPath(); c.arc(cx, cy, 150, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.02, prog)); c.stroke();
  } else if (state === 'ble') {
    const a = (t * 1.4) % 1;
    c.globalAlpha = 1 - a; c.beginPath(); c.arc(cx, cy, 150 + a * 40, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1; c.beginPath(); c.arc(cx, cy, 150, 0, Math.PI * 2); c.stroke();
  } else {
    c.globalAlpha = state === 'idle' ? .55 + .2 * breathe : 1;
    c.beginPath(); c.arc(cx, cy, 150, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
  }
  c.shadowBlur = 0;
  // emblem: gold dot in an orbit
  c.strokeStyle = 'rgba(217,178,74,.55)'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(cx, cy, 64, 26, -0.5, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#d9b24a';
  c.beginPath(); c.arc(cx, cy, 15, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
  // small state word under the ring
  const word = { idle: 'READY', ble: 'PHONE CONNECTED', ready: 'SENSOR IN', run: 'MEASURING', done: 'COMPLETE' }[state];
  c.fillStyle = '#8d9298'; c.globalAlpha = 1; c.font = font(500, 22); c.letterSpacing = '5px'; c.textAlign = 'center';
  c.fillText(word, cx, 540); c.globalAlpha = 1; c.letterSpacing = '0px';
  sTex.needsUpdate = true;
}

/* ══════════════════════════════════════════════════════
   ELECTRODE (screen-printed, NanoX)
══════════════════════════════════════════════════════ */
const spe = new THREE.Group();
const speW = .9, speH = 2.4, speD = .052, WE_Y = .72, WE_R = .3;
{
  const b = new THREE.Mesh(new RoundedBoxGeometry(speW, speH, speD, 4, .04), M_speBase); b.castShadow = true; spe.add(b);
  [-.28, 0, .28].forEach(px => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.21, .58, .014), M_gold); pad.position.set(px, -.88, speD / 2 + .007); spe.add(pad);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(.007, .38, .006), M_gold); tr.position.set(px, -.32, speD / 2 + .003); spe.add(tr);
  });
  spe.add(place(new THREE.Mesh(new THREE.BoxGeometry(speW - .14, .007, .006), M_gold), 0, -.14, speD / 2 + .003));
  spe.add(place(new THREE.Mesh(new THREE.BoxGeometry(.007, .44, .006), M_gold), 0, .1, speD / 2 + .003));
  // label
  const [, x, tex] = ctex(512, 256);
  x.textAlign = 'center';
  x.fillStyle = '#e5484dcc'; x.font = font(600, 18); x.letterSpacing = '3px'; x.fillText('Pb · Cd · As · Cu', 256, 60);
  x.fillStyle = '#d4a820'; x.font = font(800, 58, DISPLAY); x.letterSpacing = '-1px'; x.fillText('NanoX', 256, 130);
  x.fillStyle = '#8a7450'; x.font = font(500, 20); x.letterSpacing = '1px'; x.fillText('Vidyuthlabs · HM-1', 256, 170);
  x.fillStyle = '#d4a820'; x.font = font(700, 22); ['RE', 'WE', 'CE'].forEach((l, i) => x.fillText(l, [90, 256, 422][i], 226));
  tex.needsUpdate = true;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(speW - .06, .48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  lab.position.set(0, -.1, speD / 2 + .001); spe.add(lab);
  // working electrode
  const ring = new THREE.Mesh(new THREE.RingGeometry(WE_R - .012, WE_R + .005, 72), M_gold.clone());
  Object.assign(ring.material, { polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 });
  ring.position.set(0, WE_Y, speD / 2 + .006); spe.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(WE_R - .015, 72), SENSORS.HM.mat); disc.position.set(0, WE_Y, speD / 2 + .009); spe.add(disc);
  const band = new THREE.Mesh(new THREE.BoxGeometry(speW, .08, .065), new THREE.MeshStandardMaterial({ color: 0xb8383c, roughness: .6, metalness: 0 }));
  band.position.set(0, speH / 2 - .04, speD / 2 + .033); spe.add(band);
}
scene.add(spe);
const SPE_REST = { p: V(3.4, -3.3, 1.6), r: new THREE.Euler(-Math.PI / 2, 0, .4) };
const SPE_ABOVE = V(0, 6.0, .15);
const SPE_IN = V(0, 3.12, .15);
const WE_LOCAL = V(0, WE_Y, .08);

/* ── Sample dropper + droplet ── */
const waterMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe9ee, transmission: .5, transparent: true, opacity: .85, roughness: .04, clearcoat: 1, ior: 1.33 });
const dropper = new THREE.Group();
dropper.add(new THREE.Mesh(new THREE.CapsuleGeometry(.1, .38, 8, 16), new THREE.MeshPhysicalMaterial({ color: 0x2a2b2d, roughness: .55, clearcoat: .2 })));
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xe8edf2, roughness: .08, transmission: .7, transparent: true, opacity: .45, ior: 1.47 });
dropper.add(place(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .5, 18), glassMat), 0, -.48, 0));
dropper.add(place(new THREE.Mesh(new THREE.ConeGeometry(.045, .22, 18), glassMat), 0, -.81, 0, Math.PI));
const dropLiq = place(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .34, 16), waterMat), 0, -.48, 0); dropper.add(dropLiq);
dropper.visible = false; scene.add(dropper);
const fallDrop = new THREE.Mesh(new THREE.SphereGeometry(.045, 20, 16), waterMat); fallDrop.visible = false; scene.add(fallDrop);
const weDrop = new THREE.Mesh(new THREE.SphereGeometry(.13, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), waterMat); weDrop.visible = false; scene.add(weDrop);

/* ══════════════════════════════════════════════════════
   PHONE — the AnalyteX app is where results live
══════════════════════════════════════════════════════ */
const PW = 512, PH = 1135;
const [, pc, pTex] = ctex(PW, PH);
const phone = new THREE.Group();
{
  const shell = new THREE.Mesh(new RoundedBoxGeometry(1.6, 3.3, .16, 6, .18), new THREE.MeshPhysicalMaterial({ color: 0x0c1018, roughness: .26, metalness: .64, clearcoat: .95 }));
  shell.castShadow = true; phone.add(shell);
  phone.add(place(new THREE.Mesh(new RoundedBoxGeometry(1.5, 3.2, .024, 4, .12), new THREE.MeshPhysicalMaterial({ color: 0x05080d, roughness: .2, clearcoat: .6 })), 0, 0, .084));
  const scr = place(new THREE.Mesh(new THREE.PlaneGeometry(1.38, 3.06), new THREE.MeshBasicMaterial({ map: pTex, toneMapped: false })), 0, 0, .097);
  scr.renderOrder = 1; phone.add(scr);
  phone.add(place(new THREE.Mesh(new THREE.PlaneGeometry(1.48, 3.18), M_glass.clone()), 0, 0, .1));
  phone.add(place(new THREE.Mesh(new THREE.BoxGeometry(.16, .02, .38), M_darkMt), .82, .3, 0));
}
phone.visible = false; scene.add(phone);
const PHONE_SIDE = { p: V(-2.05, .05, 1.35), ry: .28 };

/* ── Synthetic, labelled-demo curves ── */
const curve = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
const CV_PTS = (() => { // a reversible-couple "duck" voltammogram
  const fw = curve(120, u => { const E = -.2 + u * .8; return [E, 1 / (1 + Math.exp(-(E - .2) / .03)) * (.55 + .5 * gauss(E, .24, .05)) + .06 * E]; });
  const bw = curve(120, u => { const E = .6 - u * .8; return [E, -(1 / (1 + Math.exp((E - .16) / .03))) * (.55 + .5 * gauss(E, .14, .05)) + .06 * E + .02]; });
  return fw.concat(bw);
})();
const HM_PEAKS = [{ s: 'Cd', E: -.80, h: .78 }, { s: 'Pb', E: -.55, h: 1.0 }, { s: 'Cu', E: -.12, h: .42 }, { s: 'As', E: .12, h: .55 }];
const DPV_PTS = curve(200, u => { const E = -1.1 + u * 1.45; let y = .05 + .03 * (E + 1.1); for (const p of HM_PEAKS) y += p.h * gauss(E, p.E, .045); return [E, y]; });
const SWV_PTS = curve(160, u => { const E = -.3 + u * .8; return [E, .06 + 1.0 * gauss(E, .12, .07)]; });
const CA_PTS = curve(160, u => { const t = .02 + u * 6; return [t, 1 / Math.sqrt(t) * .32 + .06]; });
const EIS_PTS = curve(160, u => { // Randles: semicircle then Warburg tail (Nyquist)
  if (u < .7) { const a = Math.PI * (1 - u / .7); return [.15 + .4 + .4 * Math.cos(a), .4 * Math.sin(a)]; }
  const v = (u - .7) / .3; return [.95 + v * .45, v * .45];
});
function plot(c, x, y, w, h, pts, col, frac = 1, opt = {}) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = opt.x0 ?? Math.min(...xs), x1 = opt.x1 ?? Math.max(...xs), y0 = opt.y0 ?? Math.min(...ys), y1 = opt.y1 ?? Math.max(...ys) * 1.12;
  const X = v => x + (v - x0) / (x1 - x0) * w, Y = v => y + h - (v - y0) / (y1 - y0) * h;
  c.fillStyle = '#141619'; rr(c, x - 14, y - 14, w + 28, h + 28, 14); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
  for (let g = 0; g <= 4; g++) { const gy = y + h * g / 4; c.beginPath(); c.moveTo(x, gy); c.lineTo(x + w, gy); c.stroke(); }
  const n = Math.max(2, Math.floor(frac * (pts.length - 1)) + 1);
  if (opt.fill) {
    const gr = c.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, col + '30'); gr.addColorStop(1, col + '00');
    c.beginPath(); c.moveTo(X(pts[0][0]), y + h); for (let i = 0; i < n; i++) c.lineTo(X(pts[i][0]), Y(pts[i][1])); c.lineTo(X(pts[n - 1][0]), y + h); c.closePath(); c.fillStyle = gr; c.fill();
  }
  c.strokeStyle = col; c.lineWidth = 3; c.lineJoin = c.lineCap = 'round';
  c.beginPath(); for (let i = 0; i < n; i++) { const [a, b] = pts[i]; i ? c.lineTo(X(a), Y(b)) : c.moveTo(X(a), Y(b)); } c.stroke(); c.shadowBlur = 0;
  const [ha, hb] = pts[n - 1]; c.fillStyle = '#fff'; c.beginPath(); c.arc(X(ha), Y(hb), 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#6b7178'; c.font = font(500, 17); c.textAlign = 'left'; if (opt.xl) c.fillText(opt.xl, x, y + h + 40);
  c.textAlign = 'right'; if (opt.yl) c.fillText(opt.yl, x + w, y + h + 40);
  return { X, Y, n };
}

/* App chrome */
function appChrome(c, t, title, sub) {
  c.fillStyle = '#0d0e10'; c.fillRect(0, 0, PW, PH);
  c.fillStyle = '#c9d6e3'; c.font = font(600, 22); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('9:41', 34, 40);
  c.textAlign = 'right'; c.fillStyle = '#4d8dff'; c.fillText('ᛒ', PW - 92, 40);
  c.strokeStyle = '#c9d6e3'; c.lineWidth = 2; rr(c, PW - 76, 30, 40, 20, 5); c.stroke(); c.fillStyle = '#c9d6e3'; rr(c, PW - 73, 33, 28, 14, 3); c.fill();
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  // app bar
  c.fillStyle = '#d9b24a'; c.beginPath(); c.arc(46, 112, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e9eff5'; c.font = font(700, 30, DISPLAY); c.fillText('AnalyteX', 66, 122);
  c.fillStyle = 'rgba(61,220,151,.12)'; rr(c, PW - 210, 92, 180, 40, 20); c.fill();
  c.fillStyle = '#3ddc97'; c.beginPath(); c.arc(PW - 188, 112, 6, 0, Math.PI * 2); c.fill();
  c.font = font(600, 17); c.fillText('AnalyteX-7F2A', PW - 174, 118);
  if (title) { c.fillStyle = '#f2f6fa'; c.font = font(700, 40, DISPLAY); c.fillText(title, 34, 212); }
  if (sub) { c.fillStyle = '#7f858c'; c.font = font(500, 20); c.fillText(sub, 34, 248); }
}
function demoTag(c, y) {
  c.fillStyle = 'rgba(255,194,74,.1)'; rr(c, 34, y, PW - 68, 46, 12); c.fill();
  c.fillStyle = '#ffc24a'; c.font = font(600, 17); c.textAlign = 'center';
  c.fillText('Demonstration data · simulated sample', PW / 2, y + 29); c.textAlign = 'left';
}

const METHODS = [
  { k: 'Cyclic voltammetry', a: 'CV', col: '#8b7dff', pts: CV_PTS, xl: 'E / V', yl: 'i' },
  { k: 'Differential pulse', a: 'DPV', col: '#e5484d', pts: DPV_PTS, xl: 'E / V', yl: 'Δi', fill: true },
  { k: 'Square wave', a: 'SWV', col: '#38d6ff', pts: SWV_PTS, xl: 'E / V', yl: 'Δi', fill: true },
  { k: 'Chronoamperometry', a: 'CA', col: '#f5a524', pts: CA_PTS, xl: 't / s', yl: 'i' },
  { k: 'Impedance (EIS)', a: 'EIS', col: '#3ddc97', pts: EIS_PTS, xl: "Z' / Ω", yl: "−Z''", x0: 0, x1: 1.5, y0: 0, y1: .7 },
];

function drawPhone(t, mode) {
  const c = pc;
  if (mode === 'methods') {
    const idx = Math.max(0, METHOD_T.findLastIndex(x => t >= x - .25));
    const m = METHODS[idx];
    appChrome(c, t, 'Methods', 'Pick a technique. Set parameters. Run.');
    // chips
    let cx = 34;
    METHODS.forEach((mm, i) => {
      c.font = font(700, 19); const w = c.measureText(mm.a).width + 34;
      c.fillStyle = i === idx ? mm.col : '#17191c'; rr(c, cx, 286, w, 46, 23); c.fill();
      c.fillStyle = i === idx ? '#04101a' : '#8a9096'; c.fillText(mm.a, cx + 17, 316); cx += w + 10;
    });
    c.fillStyle = '#e9eff5'; c.font = font(700, 30, DISPLAY); c.fillText(m.k, 34, 400);
    const u = span(t, METHOD_T[idx] - .25, (METHOD_T[idx + 1] ?? methodCue.end + .6) - .4);
    plot(c, 50, 440, PW - 100, 420, m.pts, m.col, sm(u), m);
    c.fillStyle = '#17191c'; rr(c, 34, 920, PW - 68, 150, 18); c.fill();
    c.fillStyle = '#7f858c'; c.font = font(500, 18);
    ['Range', 'Step', 'Rate'].forEach((l, i) => c.fillText(l, 60 + i * 150, 965));
    c.fillStyle = '#e9eff5'; c.font = font(600, 24);
    const vals = { CV: ['−0.2…0.6 V', '5 mV', '50 mV/s'], DPV: ['−1.1…0.4 V', '5 mV', '50 mV'], SWV: ['−0.3…0.5 V', '4 mV', '25 Hz'], CA: ['+0.4 V', '—', '10 ms'], EIS: ['0.1 Hz…100 kHz', '10/dec', '10 mV'] }[m.a];
    vals.forEach((v, i) => c.fillText(v, 60 + i * 150, 1010));
  } else if (mode === 'paired') {
    appChrome(c, t, 'Connected', 'Bluetooth LE · USB-C for power and data');
    const rows = [['Device', 'AnalyteX-7F2A'], ['Firmware', 'Signed updates'], ['Methods', 'CV · DPV · SWV · CA · EIS'], ['Sensor', 'Insert electrode']];
    rows.forEach(([k, v], i) => {
      const y = 300 + i * 112, a = span(t, cuesOf('methods')[1].start + i * .35, cuesOf('methods')[1].start + i * .35 + .5);
      c.globalAlpha = a; c.fillStyle = '#17191c'; rr(c, 34, y, PW - 68, 92, 16); c.fill();
      c.fillStyle = '#7f858c'; c.font = font(500, 19); c.fillText(k, 60, y + 38);
      c.fillStyle = '#e9eff5'; c.font = font(600, 24); c.fillText(v, 60, y + 70); c.globalAlpha = 1;
    });
  } else if (mode === 'run') {
    const dep = span(t, A_SWEEP, A_SWEEP + 2.2), sw = span(t, A_SWEEP + 2.2, A_SWEEP_END - .4);
    appChrome(c, t, 'Heavy metals', 'Stripping voltammetry · NanoX HM-1');
    c.fillStyle = '#17191c'; rr(c, 34, 280, PW - 68, 96, 16); c.fill();
    c.fillStyle = '#7f858c'; c.font = font(500, 18); c.fillText(dep < 1 ? 'Step 1 · Deposition at −1.2 V' : 'Step 2 · DPV stripping sweep', 60, 316);
    c.fillStyle = '#24272b'; rr(c, 60, 336, PW - 120, 14, 7); c.fill();
    c.fillStyle = dep < 1 ? '#4d8dff' : '#ffc24a'; rr(c, 60, 336, (PW - 120) * Math.max(.03, dep < 1 ? dep : sw), 14, 7); c.fill();
    const r = plot(c, 50, 440, PW - 100, 440, DPV_PTS, '#e5484d', sw, { xl: 'E / V vs Ag/AgCl', yl: 'Δi', fill: true });
    HM_PEAKS.forEach(p => {
      const i = DPV_PTS.findIndex(q => q[0] >= p.E);
      if (i < r.n - 4) {
        const X = r.X(p.E), Y = r.Y(DPV_PTS[i][1]);
        c.fillStyle = '#f2f6fa'; c.font = font(700, 24); c.textAlign = 'center'; c.fillText(p.s, X, Y - 22); c.textAlign = 'left';
      }
    });
    demoTag(c, 960);
  } else if (mode === 'result') {
    appChrome(c, t, 'Borewell sample 03', 'Checked against IS 10500 : 2012');
    const r0 = first('result').start;
    c.fillStyle = 'rgba(229,72,77,.12)'; rr(c, 34, 282, PW - 68, 74, 16); c.fill();
    c.fillStyle = '#ff6b6f'; c.font = font(700, 23); c.fillText('2 of 4 above the drinking-water limit', 58, 328);
    const rows = [['Cadmium', 'Cd', 4.0, 3], ['Arsenic', 'As', 12.0, 10], ['Lead', 'Pb', 6.0, 10], ['Copper', 'Cu', 30, 50]];
    rows.forEach(([n, s, v, lim], i) => {
      const a = span(t, r0 + .3 + i * .45, r0 + .8 + i * .45); if (a <= 0) return;
      const y = 378 + i * 132, over = v > lim, col = over ? '#ff6b6f' : '#3ddc97';
      c.globalAlpha = a;
      c.fillStyle = '#17191c'; rr(c, 34, y, PW - 68, 116, 16); c.fill();
      c.fillStyle = '#e9eff5'; c.font = font(600, 24); c.fillText(n, 60, y + 44);
      c.fillStyle = '#7f858c'; c.font = font(500, 18); c.fillText(`limit ${lim} µg/L`, 60, y + 76);
      c.fillStyle = col; c.font = font(700, 36, DISPLAY); c.textAlign = 'right'; c.fillText(v.toFixed(1), PW - 120, y + 52);
      c.fillStyle = '#7f858c'; c.font = font(500, 18); c.fillText('µg/L', PW - 60, y + 52);
      c.fillStyle = col; c.font = font(700, 15); c.fillText(over ? 'ABOVE LIMIT' : 'WITHIN LIMIT', PW - 60, y + 86); c.textAlign = 'left';
      c.fillStyle = '#24272b'; rr(c, 60, y + 96, PW - 120, 6, 3); c.fill();
      c.fillStyle = col; rr(c, 60, y + 96, (PW - 120) * Math.min(1, v / lim / 2) * sm(a), 6, 3); c.fill();
      c.globalAlpha = 1;
    });
    demoTag(c, 922);
    c.fillStyle = '#d9b24a'; rr(c, 34, 994, PW - 68, 74, 37); c.fill();
    c.fillStyle = '#1a1206'; c.font = font(700, 22); c.textAlign = 'center'; c.fillText('Export report', PW / 2, 1039); c.textAlign = 'left';
  } else if (mode === 'sensors') {
    appChrome(c, t, 'Sensors', 'Swap the electrode to change the test');
    Object.values(SENSORS).forEach((s, i) => {
      const y = 290 + i * 160, a = span(t, T.platform + .4 + i * .5, T.platform + .9 + i * .5);
      c.globalAlpha = a;
      c.fillStyle = '#17191c'; rr(c, 34, y, PW - 68, 140, 18); c.fill();
      c.fillStyle = s.hex; rr(c, 34, y, 10, 140, 5); c.fill();
      c.fillStyle = '#e9eff5'; c.font = font(700, 28, DISPLAY); c.fillText(s.name, 70, y + 56);
      c.fillStyle = '#7f858c'; c.font = font(500, 19); c.fillText(s.analytes, 70, y + 92);
      const live = s.live, w = live ? 170 : 190;
      c.fillStyle = live ? 'rgba(61,220,151,.14)' : 'rgba(150,170,190,.1)'; rr(c, PW - 68 - w, y + 30, w, 40, 20); c.fill();
      c.fillStyle = live ? '#3ddc97' : '#8ea2b5'; c.font = font(600, 17); c.textAlign = 'center'; c.fillText(s.status, PW - 68 - w / 2, y + 56); c.textAlign = 'left';
      c.globalAlpha = 1;
    });
  }
  pTex.needsUpdate = true;
}

/* ══════════════════════════════════════════════════════
   PLATFORM — four electrodes orbit the device
══════════════════════════════════════════════════════ */
const orbit = Object.entries(SENSORS).map(([k, s], i) => {
  const g = new THREE.Group();
  g.add(Object.assign(new THREE.Mesh(new RoundedBoxGeometry(.55, 1.5, .05, 3, .025), M_speBase), { castShadow: true }));
  const col = new THREE.Color(s.hex);
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(.55, .068, .07), new THREE.MeshStandardMaterial({ color: col, roughness: .6 })), 0, .69, .032));
  g.add(place(new THREE.Mesh(new THREE.CircleGeometry(.18, 40), s.mat), 0, .32, .028));
  g.add(place(new THREE.Mesh(new THREE.RingGeometry(.185, .21, 40), M_gold), 0, .32, .03));
  [-.16, 0, .16].forEach(px => g.add(place(new THREE.Mesh(new THREE.BoxGeometry(.12, .25, .01), M_gold), px, -.62, .028)));
  // name tag
  const [, x, tex] = ctex(512, 160);
  x.textAlign = 'center';
  x.fillStyle = '#e8eaed'; x.font = font(600, 40); x.fillText(s.name, 256, 64);
  x.fillStyle = s.live ? '#d9b24a' : '#7f858c'; x.font = font(500, 28); x.fillText(s.status, 256, 118);
  tex.needsUpdate = true;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
  tag.scale.set(1.9, .6, 1); tag.visible = false; scene.add(tag);
  g.visible = false; scene.add(g);
  return { g, tag, a0: i / 4 * Math.PI * 2 };
});

/* Post */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

/* ══════════════════════════════════════════════════════
   CAMERA — shots. Each shot eases from [p0,l0] to [p1,l1].
   Shots that don't share an endpoint are hard cuts (hidden by a dip).
══════════════════════════════════════════════════════ */
const PH_L = V(PHONE_SIDE.p.x, PHONE_SIDE.p.y, PHONE_SIDE.p.z);
const SHOTS = [
  // cold open: slow push on the unlit device
  [T.cold, T.reveal, V(0, .9, 14.5), V(0, .5, 0), V(0, .8, 11.5), V(0, .5, 0)],
  // reveal: low three-quarter, slow arc to the front
  [T.reveal, T.reveal + 5.2, V(3.6, -.2, 7.0), V(0, .2, 0), V(2.6, .5, 8.0), V(0, .3, 0)],
  [T.reveal + 5.2, T.methods, V(2.6, .5, 8.0), V(0, .3, 0), V(-1.9, 1.1, 8.6), V(0, .4, 0)],
  // methods: phone in, device behind
  [T.methods, A_INSERT, V(-1.4, .3, 8.6), V(-1.0, -.05, .9), V(-.9, .45, 8.0), V(-.9, -.05, .9)],
  // assay: electrode descends into the slot
  [A_INSERT, A_DROP, V(1.6, 4.5, 4.4), V(0, 3.4, .15), V(.7, 4.1, 3.0), V(0, 3.4, .15)],
  // the drop, macro on the working electrode
  [A_DROP, A_SWEEP, V(.55, 4.6, 2.35), V(0, 3.82, .15), V(.3, 4.3, 1.9), V(0, 3.84, .15)],
  // the sweep: device and phone together
  [A_SWEEP, T.result, V(-.7, 1.0, 9.4), V(-.8, .45, .5), V(-1.0, .8, 8.6), V(-.85, .4, .6)],
  // result: phone fills the frame
  [T.result, T.platform, V(-1.5, .1, 6.6), PH_L.clone().add(V(0, -.25, 0)), V(-1.7, 0, 5.9), PH_L.clone().add(V(0, -.25, 0))],
  // platform: high orbit
  [T.platform, T.finale, V(1.0, 3.0, 10.6), V(0, .8, 0), V(-1.0, 1.8, 9.4), V(0, .9, 0)],
  // finale
  [T.finale, DUR + 1, V(2.0, .8, 7.0), V(0, 1.0, 0), V(0, 1.6, 11.5), V(0, 1.2, 0)],
];
const CUTS = SHOTS.slice(1).filter((s, i) => !s[2].equals(SHOTS[i][4])).map(s => s[0]);
const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _off = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function camAt(t) {
  const s = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const u = sm2(span(t, s[0], s[1]));
  _p.lerpVectors(s[2], s[4], u); _l.lerpVectors(s[3], s[5], u);
  _p.sub(_l).multiplyScalar(distK).add(_l);
  // On wide screens, slide the frame so the subject sits right of centre and the
  // type on the left has clear space. Off for the finale (centred end card).
  if (camera.aspect > 1.2) {
    const k = .2 * (1 - span(t, T.finale - 1.5, T.finale)) * _off.subVectors(_p, _l).length() * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
    _off.subVectors(_l, _p).cross(_up).normalize().multiplyScalar(-k);
    _p.add(_off); _l.add(_off);
  }
  return { p: _p, l: _l };
}

/* ══════════════════════════════════════════════════════
   DOM HOOKS
══════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const capEl = $('cap');
const dipEl = $('dip'), endEl = $('endcard');
const musicEl = $('music'), voEl = musicEl; // one audio track: the music

/* ══════════════════════════════════════════════════════
   FRAME — pure function of t (seek-safe)
══════════════════════════════════════════════════════ */
function frame(t) {
  const inScene = s => t >= T[s] && t < ({ cold: T.reveal, reveal: T.methods, methods: T.assay, assay: T.result, result: T.platform, platform: T.finale, finale: Infinity })[s];

  /* Light: the device is a silhouette until the reveal */
  const lit = sm(span(t, T.reveal - 1.2, T.reveal + 1.5));
  keyL.intensity = lp(.05, 2.2, lit); fillL.intensity = lp(0, .45, lit);
  scene.environmentIntensity = lp(.05, .45, lit);
  rimL.intensity = lp(.35, .9, lit); // only an edge of the device shows before the reveal

  /* Electrode position */
  if (t < A_INSERT) {
    spe.visible = t >= A_INSERT - .2;
    spe.position.copy(SPE_ABOVE).add(V(0, 3, 0)); spe.rotation.set(0, 0, 0);
  } else {
    spe.visible = true;
    const u = sm2(span(t, A_INSERT, A_INSERT + 3.0));
    spe.position.set(0, lp(SPE_ABOVE.y, SPE_IN.y, u), SPE_IN.z);
    spe.rotation.set(0, lp(.35, 0, u), 0);
  }
  spe.updateMatrixWorld(true);
  const we = spe.localToWorld(WE_LOCAL.clone());

  /* Dropper */
  const d = t - A_DROP;
  if (d > -1.4 && d < 4.2) {
    dropper.visible = true;
    const arrive = sm(span(d, -1.4, 0)), leave = sm(span(d, 2.4, 3.8));
    dropper.position.set(lp(we.x + .9, we.x, arrive), we.y + .95 + leave * 1.8 + (1 - arrive) * .6, lp(we.z + .4, we.z, arrive));
    dropper.rotation.z = lp(-.4, 0, arrive);
    dropLiq.scale.y = Math.max(.001, 1 - span(d, .6, 1.4));
  } else dropper.visible = false;
  if (d > .6 && d < 1.2) { const u = span(d, .6, 1.2); fallDrop.visible = true; fallDrop.position.set(we.x, lp(we.y + .7, we.y + .04, u * u), we.z); fallDrop.scale.set(1, 1 + u * .4, 1); }
  else fallDrop.visible = false;
  weDrop.visible = t >= A_DROP + 1.2 && t < T.platform;
  if (weDrop.visible) { const s = sm(span(d, 1.2, 1.6)); weDrop.position.copy(we); weDrop.scale.set(s, s * .55, s); }

  /* Device status window */
  let st = 'idle', prog = 0;
  if (t < T.reveal - .5) st = 'off';
  else if (t >= T.methods && t < A_INSERT) st = 'ble';
  else if (t >= A_INSERT + 3 && t < A_SWEEP) st = 'ready';
  else if (t >= A_SWEEP && t < A_SWEEP_END) { st = 'run'; prog = span(t, A_SWEEP, A_SWEEP_END); }
  else if (t >= A_SWEEP_END && t < T.platform) st = 'done';
  drawStatus(t, st, prog);

  /* Device idle motion */
  device.rotation.y = inScene('reveal') ? Math.sin((t - T.reveal) * .35) * .18 : 0;

  /* Phone */
  const phoneIn = (t >= T.methods && t < A_INSERT) || (t >= A_SWEEP - .8 && t < T.platform + .9);
  if (phoneIn) {
    phone.visible = true;
    const enter = t < A_INSERT ? T.methods : A_SWEEP - .8;
    const u = sm2(span(t, enter, enter + 1.6));
    const out = t < A_INSERT ? sm(span(t, A_INSERT - .9, A_INSERT)) : sm(span(t, T.platform, T.platform + .9));
    phone.position.set(lp(-5.5, PHONE_SIDE.p.x, u) - out * 3.5, PHONE_SIDE.p.y, PHONE_SIDE.p.z);
    phone.rotation.set(0, lp(.9, PHONE_SIDE.ry, u), 0);
    const mode = t < cuesOf('methods')[1].start - .3 ? 'methods'
      : t < A_INSERT ? 'paired'
      : t < T.result ? 'run'
      : 'result';
    drawPhone(t, mode);
  } else phone.visible = false;

  /* Platform orbit */
  const pu = sm(span(t, T.platform, T.platform + 1.6)) * (1 - sm(span(t, T.finale - 1, T.finale)));
  orbit.forEach(({ g, tag, a0 }, i) => {
    g.visible = tag.visible = pu > .01;
    if (g.visible) {
      // fan out beside the device (never between camera and device), gentle drift
      const slot = [[-4.1, -1.1], [-2.45, .35], [2.45, .35], [4.1, -1.1]][i];
      const k = (t - T.platform);
      g.position.set(slot[0] + Math.sin(k * .5 + i) * .12, 1.0 + Math.sin(k * .8 + i * 1.7) * .18, slot[1]);
      g.rotation.set(0, -slot[0] * .07 + Math.sin(k * .6 + i) * .25, Math.sin(k * .4 + i) * .04); g.scale.setScalar(pu * 1.3);
      tag.position.copy(g.position).add(V(0, -1.45, 0)); tag.material.opacity = pu;
    }
  });

  /* Dips at hard cuts */
  let dip = 0;
  for (const c of CUTS) dip = Math.max(dip, 1 - Math.abs(t - c) / .32);
  dip = Math.max(dip, 1 - span(t, 0, 1.0));            // fade up from black
  dip = Math.max(dip, span(t, DUR - 1.2, DUR) * .0);   // end card covers the tail
  dipEl.style.opacity = c01(dip).toFixed(3);

  /* On-screen type */
  const cue = CUES.find(c => t >= c.start - .05 && t < c.end + .35);
  const txt = cue ? cue.text : '';
  if (capEl.dataset.txt !== txt) { capEl.dataset.txt = txt; capEl.textContent = txt; }
  capEl.classList.toggle('on', !!txt);

  /* End card */
  endEl.classList.toggle('on', t >= T.finale + 3.6);

  /* Progress */
  ui.setProgress(t);
}

/* ══════════════════════════════════════════════════════
   PLAYBACK — the music is the master clock
══════════════════════════════════════════════════════ */
const MUSIC_OFF = 0;
let state = 'idle';   // idle | playing | paused | ended
let t = 0, lastNow = performance.now(), audioOK = true;

function syncAudio(play) {
  if (CAPTURE) return;
  try {
    voEl.currentTime = Math.min(t, voEl.duration || t);
    const mt = t - MUSIC_OFF;
    musicEl.currentTime = Math.max(0, mt);
    if (play) {
      voEl.play().catch(() => { audioOK = false; });
      if (mt >= 0) musicEl.play().catch(() => {}); else musicEl.pause();
    } else { voEl.pause(); musicEl.pause(); }
  } catch (e) { audioOK = false; }
}
function play() {
  if (state === 'ended') t = 0;
  state = 'playing'; lastNow = performance.now(); syncAudio(true); ui.update();
}
function pause() { if (state !== 'playing') return; state = 'paused'; syncAudio(false); ui.update(); }
function seek(nt) {
  t = Math.max(0, Math.min(DUR, nt));
  if (state === 'ended') state = 'paused';
  syncAudio(state === 'playing'); frame(t); ui.update();
}
function start() {
  $('start').classList.add('gone');
  $('stage').focus({ preventScroll: true });
  t = 0; play();
}

/* ══════════════════════════════════════════════════════
   UI CONTROLS
══════════════════════════════════════════════════════ */
const ui = (() => {
  const bar = $('controls'), btn = $('pp'), track = $('track'), fill = $('fill'), timeEl = $('time');
  const muteBtn = $('mute');
  let hideTimer = 0, muted = false;
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // chapter ticks
  CHAPTERS.slice(1).forEach(c => {
    const b = document.createElement('button');
    b.className = 'tick'; b.style.left = `${c.t / DUR * 100}%`;
    b.title = c.label; b.setAttribute('aria-label', `Jump to ${c.label}`);
    b.onclick = e => { e.stopPropagation(); seek(c.t + .01); if (state !== 'playing') play(); };
    track.appendChild(b);
  });
  track.onclick = e => { const r = track.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * DUR); };
  track.onkeydown = e => {
    if (e.key === 'ArrowRight') { seek(t + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { seek(t - 5); e.preventDefault(); }
  };
  btn.onclick = () => state === 'playing' ? pause() : play();
  muteBtn.onclick = () => {
    muted = !muted; voEl.muted = musicEl.muted = muted;
    muteBtn.setAttribute('aria-pressed', String(muted)); muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
  };
  function wake() {
    bar.classList.add('on'); document.body.classList.add('ctl'); clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (state === 'playing') { bar.classList.remove('on'); document.body.classList.remove('ctl'); } }, 2600);
  }
  addEventListener('pointermove', wake); addEventListener('pointerdown', wake);
  $('stage').onclick = () => { if (state === 'playing' || state === 'paused') { btn.click(); wake(); } };
  addEventListener('keydown', e => {
    if ($('start').classList.contains('gone') === false) return;
    if (e.target.closest && e.target.closest('button,a') && (e.key === ' ' || e.key === 'Enter')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { btn.click(); e.preventDefault(); }
    else if (k === 'arrowright') seek(t + 5);
    else if (k === 'arrowleft') seek(t - 5);
    else if (k === 'm') muteBtn.click();
    else return;
    wake();
  });
  return {
    setProgress(t) {
      fill.style.transform = `scaleX(${(t / DUR).toFixed(4)})`;
      const s = fmt(t); if (timeEl.dataset.s !== s) { timeEl.dataset.s = s; timeEl.textContent = `${s} / ${fmt(DUR)}`; }
      track.setAttribute('aria-valuenow', String(Math.round(t)));
    },
    update() {
      const playing = state === 'playing';
      btn.textContent = playing ? 'Pause' : state === 'ended' ? 'Replay' : 'Play';
      btn.setAttribute('aria-label', playing ? 'Pause film' : 'Play film');
      document.body.classList.toggle('paused', state === 'paused');
      if (!playing) { bar.classList.add('on'); document.body.classList.add('ctl'); } else wake();
    },
  };
})();
$('track').setAttribute('aria-valuemax', String(Math.round(DUR)));
$('play').onclick = start;
$('replay').onclick = () => { seek(0); play(); };
$('play').textContent = `Play film · ${Math.floor(DUR / 60)}:${String(Math.round(DUR % 60)).padStart(2, '0')}`;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

addEventListener('resize', () => {
  setFov(); renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

/* ══════════════════════════════════════════════════════
   LOOP
══════════════════════════════════════════════════════ */
function render(now) {
  // locked-off camera moves only; no fake handheld shake
  const { p, l } = camAt(t);
  camera.position.copy(p); camera.lookAt(l);
  composer.render();
}
function loop(now) {
  if (state === 'capture') return; // export mode renders only on __film.seek()
  requestAnimationFrame(loop);
  const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
  if (state === 'playing') {
    t += dt;
    // follow the music; it is the source of truth when audible
    if (audioOK && !voEl.paused && !voEl.seeking && Math.abs(voEl.currentTime - t) > .12 && voEl.currentTime < (voEl.duration || 1e9) - .05) t = voEl.currentTime;
    if (!musicEl.muted && musicEl.paused && t >= MUSIC_OFF && t < DUR - .5 && !musicEl.ended) { try { musicEl.currentTime = t - MUSIC_OFF; musicEl.play().catch(() => {}); } catch (e) {} }
    // fade the music out at the end
    const target = .7 * (1 - span(t, DUR - 3, DUR));
    musicEl.volume = c01(lp(musicEl.volume, target, Math.min(1, dt * 3)));
    if (t >= DUR) { t = DUR; state = 'ended'; syncAudio(false); ui.update(); }
    frame(t);
  } else if (state === 'idle') {
    // attract loop behind the start screen: slow orbit of the lit device
    const a = now * .00012;
    frame(T.methods - 1.2);
    camera.position.set(Math.sin(a) * 7, 1.2, Math.cos(a) * 7); camera.lookAt(0, .4, 0);
    capEl.classList.remove('on'); composer.render(); return;
  }
  render(now);
}

/* Export / deep-link hooks */
window.__film = { DUR, T, CHAPTERS, seek: (s) => { t = s; frame(t); render(0); } };
if (QS.has('t')) { const s = parseFloat(QS.get('t')); if (!isNaN(s)) { $('start').classList.add('gone'); t = s; state = 'paused'; frame(t); ui.update(); } }
if (CAPTURE) { $('start').classList.add('gone'); document.body.classList.add('capture'); state = 'capture'; frame(0); }
window.__ready = true;
requestAnimationFrame(loop);
