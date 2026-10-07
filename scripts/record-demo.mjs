// Renders the README demo frame by frame (deterministic, so it is smooth on any machine),
// then encodes demo.mp4, assets/demo.webp and assets/demo.gif with ffmpeg.  Needs: npm install, ffmpeg on PATH.
// Usage: node scripts/record-demo.mjs [--fps 30] [--out demo] [--dpr 1]
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 30), OUT = arg('out', 'demo'), DPR = +arg('dpr', 1);
const W = 1280, H = 800;
const frames = join(root, '.demo-frames');
await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const p = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root + '/')) throw new Error('outside');
    const body = await readFile(p);
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// serve the fictional blog under a reserved example domain, so the card shows a realistic address
const HOST = 'crumb.example';
const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, locale: 'en-US' });
await page.goto(`http://${HOST}:${port}/demo/index.html?auto=0`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: '.rp-run{display:none!important}' });
// a visible cursor, kept in a closed shadow root and on top of everything
await page.evaluate(() => {
  window.__RP_MANUAL = true;
  window.__RP_OPTIONS = { seed: 20261007, sound: false };
  const host = document.createElement('demo-cursor');
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px)';
  const sr = host.attachShadow({ mode: 'closed' });
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '28'); svg.setAttribute('height', '32'); svg.setAttribute('viewBox', '0 0 28 32');
  svg.style.cssText = 'position:absolute;left:-3px;top:-2px;overflow:visible';
  const arrow = document.createElementNS(ns, 'path');
  arrow.setAttribute('d', 'M3 2 L3 24 L9 18.5 L13 27 L17 25.2 L13 17 L21 17 Z');
  arrow.setAttribute('fill', '#fff'); arrow.setAttribute('stroke', '#111'); arrow.setAttribute('stroke-width', '1.6'); arrow.setAttribute('stroke-linejoin', 'round');
  svg.append(arrow);
  const ring = document.createElement('div');
  ring.style.cssText = 'position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;border:2px solid #f7c948;opacity:0';
  sr.append(svg, ring);
  document.documentElement.appendChild(host);
  window.__demoCursor = (x, y, r) => {
    host.style.transform = `translate(${x}px, ${y}px)`;
    ring.style.opacity = String(r);
    ring.style.transform = `scale(${1.8 - r * 0.9})`;
  };
  // the cursor stays above RUGPULL's overlay
  new MutationObserver(() => { if (document.documentElement.lastElementChild !== host) document.documentElement.appendChild(host); }).observe(document.documentElement, { childList: true });
});

// where the words to buy are
const wordAt = (w, n = 0) => page.evaluate(([w, n]) => {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let t; (t = tw.nextNode());) {
    const i = t.data.indexOf(w);
    if (i < 0) continue;
    if (seen++ < n) continue;
    const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + w.length);
    const b = r.getBoundingClientRect();
    return [b.left + b.width * 0.55, b.top + b.height * 0.55];
  }
  return [640, 400];
}, [w, n]);
const inPanel = (sel, root = '.panel') => page.evaluate(([sel]) => {
  const h = document.querySelector('rugpull-overlay');
  const e = h && h.shadowRoot.querySelector(sel);
  if (!e) return [1170, 470];
  const b = e.getBoundingClientRect();
  return [b.left + b.width / 2, b.top + b.height / 2];
}, [sel, root]);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const W1 = await wordAt('weekends'), W2 = await wordAt('sourdough'), W3 = await wordAt('crackle');
// cursor keyframes [time, x, y]; the panel buttons are filled in once the panel exists
const keys = [[0, 980, 620], [0.55, 760, 520], [1.2, 760, 520], [1.9, W1[0], W1[1]], [2.15, W1[0], W1[1]], [2.75, W2[0], W2[1]], [2.95, W2[0], W2[1]], [3.55, W3[0], W3[1]], [3.8, W3[0], W3[1]]];
const events = [{ t: 0.6, what: 'start' }, { t: 2.15, what: 'click' }, { t: 2.95, what: 'click' }, { t: 3.8, what: 'click' }];
const SECONDS = 14.2;
let added = false;

function cursorAt(t) {
  let a = keys[0], b = keys[keys.length - 1];
  if (t >= b[0]) return { x: b[1], y: b[2] };
  for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
  const u = b[0] === a[0] ? 1 : ease((t - a[0]) / (b[0] - a[0]));
  return { x: a[1] + (b[1] - a[1]) * u, y: a[2] + (b[2] - a[2]) * u };
}

const engine = await readFile(join(root, 'src/rugpull.js'), 'utf8');
let ring = 0;
const total = Math.round(SECONDS * FPS);
for (let f = 0; f < total; f++) {
  const t = f / FPS;
  if (!added && t >= 1.3) {
    // aim at the red button, then at the refund button once the card is up
    added = true;
    const rugBtn = await inPanel('.rug');
    keys.push([5.0, rugBtn[0], rugBtn[1]], [5.6, rugBtn[0], rugBtn[1]]);
    events.push({ t: 5.6, what: 'click' });
    keys.push([7.4, 860, 330]);
    events.push({ t: 8.55, what: 'refund-target' });
  }
  const c = cursorAt(t);
  await page.mouse.move(c.x, c.y);
  for (const e of events) {
    if (e.done || t < e.t) continue;
    e.done = true;
    if (e.what === 'start') await page.evaluate((code) => (0, eval)(code), engine);
    else if (e.what === 'click') { ring = 1; await page.mouse.click(c.x, c.y); }
    else if (e.what === 'refund-target') {
      const rf = await inPanel('.rf');
      keys.push([9.4, rf[0], rf[1]], [10.3, rf[0], rf[1]]);
      events.push({ t: 10.3, what: 'click' });
      keys.push([12.0, 900, 560]);
    }
  }
  ring = Math.max(0, ring - 1 / (FPS * 0.4));
  await page.evaluate(({ x, y, ring, dt }) => {
    const R = window.__rugpull;
    if (R && R.alive) R.step(dt);
    window.__demoCursor(x, y, ring);
  }, { x: c.x, y: c.y, ring, dt: 1 / FPS });
  // JPEG frames at top quality: several times faster to capture than PNG, and the video is lossy anyway
  await page.screenshot({ path: join(frames, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
  if (f % 30 === 0) process.stdout.write(`frame ${f}/${total}\r`);
}
await browser.close();
server.close();
console.log('\nencoding...');
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
ff(['-framerate', String(FPS), '-i', join(frames, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', join(root, OUT + '.mp4')]);
ff(['-framerate', String(FPS), '-i', join(frames, 'f%04d.jpg'), '-vf', 'fps=20,scale=960:-1:flags=lanczos', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '72', '-compression_level', '5', '-loop', '0', join(root, 'assets', OUT + '.webp')]);
ff(['-framerate', String(FPS), '-i', join(frames, 'f%04d.jpg'), '-vf', 'fps=10,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', join(root, 'assets', OUT + '.gif')]);
console.log(`done: ${OUT}.mp4, assets/${OUT}.webp, assets/${OUT}.gif`);
