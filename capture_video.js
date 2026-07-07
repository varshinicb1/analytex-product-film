/**
 * capture_video.js
 * ─────────────────────────────────────────────────────────
 * Exports the AnalyteX product film as a high-quality MP4.
 *
 * Strategy:
 *   1. Launch puppeteer (headless Chromium, 1920×1080)
 *   2. Serve the product-viewer via a local HTTP server
 *   3. Auto-click "PLAY FILM" and immediately mute audio
 *   4. Capture a JPEG screenshot every ~33ms (≈30fps) for 135 seconds
 *   5. Pipe frames into ffmpeg with the vo_ryan.mp3 + music.mp3 audio mix
 *   6. Output analytex_film.mp4
 *
 * Usage:
 *   npm install puppeteer
 *   node capture_video.js
 *
 * Output: analytex_film.mp4 (1920×1080, 30fps, H.264/AAC, ~130s)
 */

import puppeteer from 'puppeteer';
import { execSync, spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ───────────────────────────────────────────
const WIDTH       = 1920;
const HEIGHT      = 1080;
const FPS         = 30;
const DURATION_S  = 133;          // total film length + a little buffer
const FRAME_DIR   = path.join(__dirname, '.frames');
const OUTPUT_FILE = path.join(__dirname, 'analytex_film.mp4');
const PORT        = 8765;

// ── Simple static file server ───────────────────────────────
function startServer() {
  return new Promise(resolve => {
    const MIME = {
      '.html': 'text/html',
      '.js':   'text/javascript',
      '.css':  'text/css',
      '.mp3':  'audio/mpeg',
      '.png':  'image/png',
      '.jpg':  'image/jpeg',
      '.svg':  'image/svg+xml',
    };
    const server = http.createServer((req, res) => {
      let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      const ext = path.extname(filePath);
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(PORT, () => {
      console.log(`📡 Serving at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

// ── Main capture loop ────────────────────────────────────────
async function capture() {
  // Clean frame directory
  if (fs.existsSync(FRAME_DIR)) fs.rmSync(FRAME_DIR, { recursive: true });
  fs.mkdirSync(FRAME_DIR);

  const server = await startServer();

  console.log('🚀 Launching headless Chromium...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu-sandbox',
      '--enable-gpu',
      '--enable-webgl',
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
      '--disable-web-security',
      '--autoplay-policy=no-user-gesture-required',
    ],
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
  });

  const page = await browser.newPage();

  // Mute all audio (we'll add audio track in ffmpeg step)
  await page.evaluateOnNewDocument(() => {
    window.__MUTED = true;
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      this.muted = true;
      this.volume = 0;
      return origPlay.call(this);
    };
  });

  console.log(`📄 Loading http://localhost:${PORT}...`);
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });

  // Wait for WebGL scene to initialize
  await page.waitForTimeout(2000);

  // Click the PLAY FILM button
  console.log('▶️  Clicking PLAY FILM...');
  await page.click('#play');
  await page.waitForTimeout(500);

  // Inject time-override to control animation speed precisely
  await page.evaluate(() => {
    window.__captureMode = true;
    window.__captureTime = 0;
    window.__captureFrameCount = 0;
  });

  const totalFrames = Math.ceil(DURATION_S * FPS);
  const frameInterval = 1000 / FPS;

  console.log(`🎬 Capturing ${totalFrames} frames at ${FPS}fps (${DURATION_S}s)...`);

  for (let i = 0; i < totalFrames; i++) {
    const framePath = path.join(FRAME_DIR, `frame_${String(i).padStart(6, '0')}.jpg`);
    await page.screenshot({ path: framePath, type: 'jpeg', quality: 95 });

    if (i % FPS === 0) {
      const elapsed = Math.round(i / FPS);
      const pct = Math.round((i / totalFrames) * 100);
      process.stdout.write(`\r  📸 Frame ${i}/${totalFrames} — ${elapsed}s / ${DURATION_S}s (${pct}%)`);
    }

    // Let the browser animate one frame (real-time pacing)
    await page.waitForTimeout(frameInterval);
  }

  console.log('\n✅ Frame capture complete!');
  await browser.close();
  server.close();

  // ── Encode with ffmpeg ────────────────────────────────────
  console.log('\n🎥 Encoding video with ffmpeg...');
  const ffmpegCmd = [
    'ffmpeg', '-y',
    '-framerate', String(FPS),
    '-i', path.join(FRAME_DIR, 'frame_%06d.jpg'),
    '-i', path.join(__dirname, 'vo_ryan.mp3'),
    '-i', path.join(__dirname, 'music.mp3'),
    '-filter_complex',
    // Mix voice (vol 1.0) + music (vol 0.15)
    '[1:a]volume=1.0[vo];[2:a]volume=0.15[bg];[vo][bg]amix=inputs=2:duration=first[audio]',
    '-map', '0:v',
    '-map', '[audio]',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-shortest',
    OUTPUT_FILE
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegCmd[0], ffmpegCmd.slice(1), { stdio: 'inherit' });
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
  });

  // Cleanup frames
  fs.rmSync(FRAME_DIR, { recursive: true });

  const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1);
  console.log(`\n🎉 Done! → ${OUTPUT_FILE} (${sizeMB} MB)`);
  console.log(`   Resolution: ${WIDTH}×${HEIGHT} | FPS: ${FPS} | Duration: ~${DURATION_S}s`);
}

capture().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
