// Export the film to MP4, frame-exact.
//
//   node tools/capture.mjs [--width 1920] [--height 1080] [--fps 30] [--out analytex_film.mp4] [--to 10]
//
// Opens the film in ?capture mode (no start screen, no controls, no CSS
// transitions), seeks to every frame with window.__film.seek(t), screenshots it,
// and pipes the frames to ffmpeg, then adds music.mp3 faded out over the last 3 s
// (the same mix the player uses). Needs: playwright (with Chromium) and ffmpeg.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('width', 1920), H = +arg('height', 1080), FPS = +arg('fps', 30);
const OUT = path.resolve(arg('out', path.join(ROOT, 'analytex_film.mp4')));
const SILENT = path.join(path.dirname(OUT), '.video_only.mp4');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
await new Promise(r => server.once('listening', r));

const run = (args) => new Promise((ok, bad) => {
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  p.on('exit', c => c === 0 ? ok() : bad(new Error('ffmpeg exited ' + c)));
  return p;
});

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/?capture`);
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
const DUR = await page.evaluate(() => window.__film.DUR);
const N = Math.ceil(Math.min(DUR, +arg('to', DUR)) * FPS); // --to N: export only the first N seconds (for a quick check)

const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', SILENT], { stdio: ['pipe', 'inherit', 'inherit'] });
const encDone = new Promise((ok, bad) => enc.on('exit', c => c === 0 ? ok() : bad(new Error('ffmpeg exited ' + c))));

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  await page.evaluate(t => window.__film.seek(t), i / FPS);
  const jpg = await page.screenshot({ type: 'jpeg', quality: 94 });
  if (!enc.stdin.write(jpg)) await new Promise(r => enc.stdin.once('drain', r));
  if (i % FPS === 0) {
    const el = (Date.now() - t0) / 1000, eta = el / (i + 1) * (N - i - 1);
    process.stdout.write(`\rframe ${i}/${N}  ${(i / FPS).toFixed(0)}s of film  eta ${(eta / 60).toFixed(1)} min   `);
  }
}
enc.stdin.end();
await encDone;
await browser.close();
server.close();
console.log('\nvideo done, mixing audio…');

const END = N / FPS;
await run(['-y', '-loglevel', 'error', '-i', SILENT, '-i', path.join(ROOT, 'music.mp3'),
  '-filter_complex', `[1:a]volume=0.7,afade=t=out:st=${(END - 3).toFixed(2)}:d=3,atrim=0:${END.toFixed(2)}[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT]);
fs.unlinkSync(SILENT);
console.log('wrote', OUT);
