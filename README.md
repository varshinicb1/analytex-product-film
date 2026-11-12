# AnalyteX — product film

A real-time WebGL film of **AnalyteX**, the portable potentiostat from
[Vidyuthlabs](https://vidyuthlabs.co.in). It runs in the browser (Three.js), is
1 min 18 s long, and plays on phones as well as desktops.

The look is deliberately plain: a graphite studio sweep, one soft key light, real
shadows, no bloom, glow, particles, sci-fi grid or synthetic voiceover. The only
words are short on-screen type lines; the sound is the music bed.

Live: **https://vidyuthlabs-analytex.web.app**

## The story

| # | Chapter | What the viewer sees |
|---|---|---|
| — | Cold open | The unlit device: "Lead. Cadmium. Arsenic. You can't see them in water." |
| 01 | The instrument | AnalyteX is lit up and introduced as a portable potentiostat |
| 02 | Five techniques | CV, DPV, SWV, CA and EIS, chosen in the phone app and sent over Bluetooth |
| 03 | One drop | A NanoX screen-printed electrode goes in, a drop of sample goes on, the sweep runs |
| 04 | The result | The phone shows each metal against IS 10500:2012 drinking-water limits |
| 05 | The platform | Change the electrode, change the test: heavy metals first, other sensors in development |

## What the film claims (and what it doesn't)

The film is held to what the hardware and firmware
([esp32-potentiostat](https://github.com/varshinicb1/esp32-potentiostat)) actually do today:

- **Methods:** CV, DPV, SWV, CA, EIS.
- **Connectivity:** Bluetooth LE and USB-C. **No Wi-Fi** (removed from the firmware).
- **No on-device display.** The firmware keeps the TFT off because it shares the SPI bus with the
  analog front end, so results are shown in the phone app. The device has status lights only.
- **Results shown are demonstration data** from a simulated sample, and are labelled so on screen.
- **Heavy metals is the first assay.** Formalin, pesticide and soil-nutrient electrodes are shown
  as *in development*. No clinical use, no certifications, no detection limits, no IP rating.

`npm run check` (also run in CI) fails the build if banned claims such as Wi-Fi,
touchscreen, IP ratings, certifications, clinical use or detection limits reappear, or if the
"simulated" and "in development" labels go missing. Update `tools/check_claims.mjs` when a claim
becomes true.

## Files

```
index.html          page, overlays, controls, start screen and end card
main.js             the whole film: scene, device, electrode, phone app, camera, playback
timeline.json       on-screen type cues (start/end/text); drives scene and camera timing
music.mp3           music bed (78 s; the film's clock)
vendor/three/       Three.js, vendored so the film works offline
tools/capture.mjs   exports the film to MP4, frame-exact
tools/check_claims.mjs  product-claims guard
```

There is one clock: the music. Every scene, camera shot and type line is placed relative to the
cue times in `timeline.json`, so moving a cue moves the picture with it. Edit the text or times
there directly; keep the number of cues per scene the same (`main.js` reads the assay beats from
them).

## Viewer features

- Play/pause, seek bar with chapter marks, mute.
- Keys: <kbd>Space</kbd>/<kbd>K</kbd> play/pause, <kbd>←</kbd>/<kbd>→</kbd> seek 5 s,
  <kbd>M</kbd> mute. Pauses when the tab is hidden.
- `?t=42` opens paused at 42 s (deep link to a chapter).
- Portrait phones get a wider camera so the device and phone stay in frame. On wide screens the
  subject is framed right of centre so the type has clear space on the left.

## Export to MP4

```bash
npm install                    # playwright
npx playwright install chromium
node tools/capture.mjs --width 1920 --height 1080 --fps 30
# → analytex_film.mp4
```

It opens the film with `?capture`, which hides the UI, turns off CSS transitions and stops the
render loop, then seeks to every frame with `window.__film.seek(t)`. Frames are encoded with
ffmpeg with the music bed, faded out over the last 3 s. Use `--to 10` to export only the first 10 seconds for a quick check.

## Deploy

Pushes to `master` deploy to Firebase Hosting (project `vidyuthlabs-analytex`); pull requests
get a preview channel. Both need the `FIREBASE_SERVICE_ACCOUNT` repository secret. By hand:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

## License

MIT © Vidyuthlabs Technologies Private Limited
