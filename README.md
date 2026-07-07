# AnalyteX — Cinematic Product Film

> *One device. Every threat. Anywhere.*

A premium **WebGL cinematic brand film** for **AnalyteX** by VidyuthLabs — a handheld, laboratory-grade electrochemical potentiostat with hot-swappable **NanoX** SPE cartridges for heavy metals, formalin, pesticide, and clinical health detection.

Live demo → **https://vidyuthlabs-analytex.web.app**

---

## What This Is

A fully self-contained, zero-dependency (CDN-based) Three.js WebGL interactive product film that:

- Renders a **photorealistic 3D model** of the AnalyteX device with physically correct materials (MeshPhysicalMaterial: clearcoat, transmission, anisotropy)
- Shows **5 hot-swappable NanoX SPE cartridges** (HM, FM, PEST, NPK, HLTH) orbiting the device and inserting pads-first
- Plays a **129.6-second narrated voiceover** with frame-accurate subtitle captions
- Renders **live voltammetric electrochemistry charts** (DPV, SWV, CA, CV) on an in-scene AnalyteX screen canvas
- Renders a **live phone companion app** canvas with scan results and verdict cards
- Executes **macro cinematic camera keyframes** with smooth hermite interpolation and handheld sway
- Displays animated chapter overlays with dark-dim vignette scrims for text legibility
- Shows a **gold shimmer** play button on the intro screen

---

## Technical Architecture

```
product-viewer/
├── index.html          # Single-page app, importmap for Three.js CDN
├── main.js             # ~72KB: all geometry, materials, animation, timeline
├── vo_ryan.mp3         # Cinematic narration (en-GB-RyanNeural via edge-tts)
├── music.mp3           # Ambient background score
├── vendor/
│   └── three/          # Three.js r170 (local copy for offline use)
└── gen_ryan.py         # Voiceover generation script (edge-tts + ffmpeg)
```

### Rendering Pipeline

```
main.js
  ├── WebGLRenderer (antialias, logarithmicDepthBuffer)
  ├── Scene
  │   ├── AnalyteX Device (MeshPhysicalMaterial: clearcoat, metalness, roughness)
  │   │   ├── Screen canvas (512×768, live-drawn each frame)
  │   │   └── Phone canvas (390×844, live-drawn each frame)
  │   ├── SPE Cartridge Group (hot-swappable: HM / FM / PEST / NPK / HLTH)
  │   │   ├── Substrate (FR4, polygonOffset for Z-fight elimination)
  │   │   ├── WE disc (gold, CircleGeometry, nano material layer)
  │   │   ├── Droplet dome (SphereGeometry cap, transmission)
  │   │   └── Label canvas (NanoX branding, type band, pad labels)
  │   ├── Orbital carousel (5 ghost SPEs rotating around device)
  │   ├── Bokeh dust particles (280 additive points)
  │   ├── Holographic grid floor (canvas-based, radial falloff)
  │   └── Point lights (colour-shifts with active SPE type)
  ├── Camera Keyframes (23 keyframe hermite spline, ~130s)
  └── Timeline Events (chapter overlays, cartridge swaps, subtitle captions)
```

### Key Engineering Decisions

| Problem | Solution |
|---|---|
| Z-fighting on electrode layers | `polygonOffset: true, polygonOffsetFactor: -N` per layer |
| Sensor clipping through device body | Physical geometry: pads-first insertion, electrode stays above slot |
| Droplet clipping through WE disc | `SphereGeometry(r, 32, 32, 0, Math.PI*2, 0, Math.PI/2)` dome cap |
| Canvas rendering performance | Single 512×768 canvas re-drawn per-frame with `needsUpdate=true` |
| Chapter transition aesthetics | Black cinematic curtain + radial vignette scrim behind text |
| Voiceover generation | `edge-tts` (Microsoft Neural TTS) → segment MP3s → `ffmpeg concat` |

---

## NanoX Cartridge System

Each SPE (Screen-Printed Electrode) cartridge is identified by a type string:

| Type | Name | Detection | Band Colour |
|------|------|-----------|-------------|
| `HM` | Heavy Metals SPE | Pb, Cd, As, Cu via LSASV | Red `#e53935` |
| `FM` | Formalin SPE | CH₂O in fish/food via DPV | Amber `#ff6f00` |
| `PEST` | Pesticide SPE | AChE inhibition / OPC via SWV | Green `#388e3c` |
| `NPK` | Soil Nutrient SPE | N, P, K via CA | Brown `#795548` |
| `HLTH` | Clinical Health SPE | DA, UA, Cr via DPV | Blue `#1976d2` |

Swapping triggers a **60-frame mechanical eject-reinsert animation** with:
- Cartridge rising, translating, descending
- Nano material layer dissolving and re-drawing
- Working electrode glow colour transitioning
- Phone app and device screen updating to new analyte context

---

## Voiceover Generation

```bash
# Install dependencies
pip install edge-tts

# Generate narration (British cinematic voice, -5% rate)
cd product-viewer
python gen_ryan.py
# → produces vo_ryan.mp3 (129.8s, 128kbps MP3)
```

The script uses **Microsoft Edge Neural TTS** (`en-GB-RyanNeural`) for a rich, documentary-style narration, precisely segmented and padded with silence to match the subtitle caption timing array in `main.js`.

---

## Export as Video

```bash
# Install puppeteer + ffmpeg
npm install puppeteer

# Run the capture script (headless Chromium → frames → ffmpeg → MP4)
node capture_video.js
# → produces analytex_film.mp4 (1920×1080, 30fps, H.264)
```

See [`capture_video.js`](./capture_video.js) for details.

---

## Deployment

### Firebase Hosting (live)

```bash
# One-time setup
npm install -g firebase-tools
firebase login
firebase use vidyuthlabs-analytex

# Deploy
firebase deploy --only hosting
```

### CI/CD (GitHub Actions)

On every push to `main`, GitHub Actions automatically deploys to Firebase Hosting. See [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

Required GitHub secrets:
- `FIREBASE_SERVICE_ACCOUNT` — Firebase service account JSON (base64)

---

## What I Learned Building This

### 1. WebGL Geometry is Physics, Not Just Graphics
The biggest breakthrough was treating the SPE cartridge insertion as a *physically correct simulation*. Early attempts tried to hide geometry clipping with `renderOrder` overlays — a hack that breaks at oblique camera angles. The correct fix: **move the geometry so it literally cannot clip**. The electrode substrate physically sits above the device slot; only the contact pads enter. This is architectural, not cosmetic.

### 2. `polygonOffset` is the Z-fighting Silver Bullet
Coplanar layered geometry (substrate → trace → electrode → nano material → glow) will always Z-fight unless you use `polygonOffset`. Each layer needs a unique `polygonOffsetFactor`. This is far more robust than trying to epsilon-offset Z positions by hand.

### 3. Canvas-as-Texture is Supremely Powerful
Drawing a live voltammetry chart, animated DPV sweep, and phone companion UI *entirely in 2D canvas*, then projecting it onto a 3D mesh surface, is far more flexible than instancing Three.js primitives. You get full 2D drawing API (fonts, gradients, bezier curves) mapped perfectly onto any surface.

### 4. Hermite Spline Camera is Indispensable
Linear lerp between camera keyframes produces robotic, jarring motion. Even a basic `smoothstep(smoothstep(x))` (6th-order) on the interpolation parameter transforms camera movement into something that feels like real cinema — slow into a keyframe, slow out of the next.

### 5. Neural TTS + ffmpeg = Free Professional Narration
Microsoft Edge Neural TTS (`edge-tts`) produces output indistinguishable from studio narration at zero cost. The trick is to generate each caption segment independently (so timing is predictable), pad with silence to match the visual timeline, then concatenate with `ffmpeg`.

### 6. Cinematic UI Hierarchy
Text overlay legibility against 3D backgrounds requires a **dark scrim** — not a flat background, but a radial gradient with `backdrop-filter: blur(2px)`. This adds perceived depth to the text while staying aesthetically premium. Paired with `drop-shadow` on the text itself, the hierarchy becomes unambiguous.

---

## Tech Stack

- **Three.js r170** — 3D rendering
- **WebGL 2.0** — GPU rendering context
- **Canvas 2D API** — all in-scene screens and charts
- **edge-tts** (Python) — voiceover generation
- **ffmpeg** — audio/video processing
- **Firebase Hosting** — deployment
- **GitHub Actions** — CI/CD
- **Puppeteer** — headless video capture

---

## License

MIT © VidyuthLabs 2025

---

*Built by AI-assisted pair programming with Antigravity / Google DeepMind.*
