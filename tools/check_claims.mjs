// Guards the film against product claims the hardware does not support.
// The device firmware has no Wi-Fi and keeps its display off; nothing is
// certified; the heavy-metal results shown are simulated demo data.
// Run: node tools/check_claims.mjs   (also runs in CI)
import fs from 'node:fs';

const FILES = ['index.html', 'main.js', 'timeline.json'];
const BANNED = [
  [/wi-?fi/i, 'Wi-Fi (firmware is Bluetooth LE + USB-C only)'],
  [/touch ?screen|tft/i, 'touchscreen (the display is disabled in firmware)'],
  [/\bIP6\d\b/, 'an IP rating (not tested)'],
  [/certified|FDA|\bCE[- ]mark|BIS[- ]approved|\bNABL\b/i, 'a certification claim'],
  [/clinical|diagnos/i, 'clinical use'],
  [/limit of detection|\bLOD\b|\bppt\b/i, 'a detection-limit figure (not yet validated)'],
  [/VidyutX/, 'old VidyutX branding'],
];
const REQUIRED = [
  [/simulated/i, 'a "simulated sample" label on demo results'],
  [/in development/i, 'an "in development" label on unreleased sensors'],
];

let bad = 0;
const all = FILES.map(f => [f, fs.readFileSync(f, 'utf8')]);
for (const [f, src] of all) {
  src.split('\n').forEach((line, i) => {
    for (const [re, why] of BANNED) if (re.test(line)) { console.error(`${f}:${i + 1}: mentions ${why}\n    ${line.trim().slice(0, 140)}`); bad++; }
  });
}
for (const [re, why] of REQUIRED) if (!all.some(([, s]) => re.test(s))) { console.error(`missing ${why}`); bad++; }
const tl = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
if (!(tl.duration > 0 && tl.cues.length)) { console.error('timeline.json has no cues'); bad++; }
for (const f of ['music.mp3']) if (!fs.existsSync(f)) { console.error(`missing ${f}`); bad++; }
if (bad) { console.error(`\n${bad} claim problem(s)`); process.exit(1); }
console.log(`claims OK (${FILES.join(', ')})`);
