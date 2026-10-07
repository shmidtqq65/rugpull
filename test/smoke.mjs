// Smoke test: launch the fixture pages as coins, buy words, pull the rug, check the pile and the card,
// then refund and check the page comes back exactly as it was.  Run: npm install && npm test
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('Playwright is missing. Run "npm install" first (and "npx playwright install chromium" if needed).');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css', '.woff2': 'font/woff2' };
// a heavy page for the speed check, made on the fly: 1,200 cards, about 12,000 elements
const stress = () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cards = [];
  for (let i = 1; i <= 1200; i++) {
    const chips = Array.from({ length: 2 + Math.floor(rnd() * 4) }, (_, j) => `<span class="chip">tag ${j}</span>`).join('');
    cards.push(`<article class="card"><b>Card ${i}</b><p>Lorem ipsum dolor sit amet, card number ${i} with a few words of text.</p><div class="row">${chips}</div><div class="row"><button>Open</button><a href="#">Share</a></div></article>`);
  }
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Stress test</title><style>body{margin:0;font:15px/1.5 system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:24px}.card{border:1px solid #ccd;border-radius:8px;padding:12px;background:#f7f7fb}.card b{display:block}.row{display:flex;gap:6px;margin-top:8px}.chip{background:#e3e8ff;border-radius:99px;padding:2px 8px;font-size:12px}header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:14px 24px;font-weight:700}</style></head><body><header>Stress test: 1,200 cards</header><main class="grid">' + cards.join('') + '</main></body></html>';
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/test/stress.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(stress()); return; }
    const p = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!p.startsWith(root + '/')) throw new Error('outside');
    const body = await readFile(p);
    const headers = { 'content-type': types[extname(p)] || 'application/octet-stream' };
    // ?csp=1 serves the page with a strict policy: no inline scripts, no inline styles, no data: images
    if (url.searchParams.get('csp')) headers['content-security-policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'";
    res.writeHead(200, headers);
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

// test what ships: the minified build if it exists, else the source
const built = join(root, 'rugpull.min.js');
let engine = join(root, 'src/rugpull.js');
try { await readFile(built); engine = built; } catch {}
const engineUrl = '/' + engine.replace(root + '/', '');
console.log('engine:', engineUrl.slice(1));

const results = [];
const check = (name, ok, info = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  (' + info + ')' : ''}`); };
const step = (page, seconds) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__rugpull && window.__rugpull.step(1 / 60); }, Math.round(seconds * 60));
const state = (page) => page.evaluate(() => window.__rugpull && window.__rugpull.state());
const start = async (page, opts = {}) => {
  await page.evaluate((o) => { window.__RP_MANUAL = true; window.__RP_OPTIONS = Object.assign({ seed: 42, sound: false }, o); }, opts);
  await page.addScriptTag({ url: engineUrl });
  return state(page);
};
const gone = (page) => page.evaluate(() => !window.__rugpull);
const finish = async (page) => {
  for (let i = 0; i < 60 && !(await gone(page)); i++) await step(page, 0.1);
  await page.waitForTimeout(350);
};
const snapshot = (page) => page.evaluate(() => {
  const shadow = [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).map((e) => e.shadowRoot.innerHTML + '|' + e.shadowRoot.adoptedStyleSheets.length);
  // the <script> tag the test itself adds to load the engine is not part of the comparison
  const html = document.documentElement.outerHTML.replace(/<script src="\/(src\/rugpull|rugpull\.min)\.js"><\/script>/g, '');
  return { html, text: document.body.innerText, sheets: document.adoptedStyleSheets.length, shadow: shadow.join('\n'), highlights: CSS.highlights.size };
});
const card = (page) => page.evaluate(async () => {
  const r = await window.__rugpull.save(false);
  if (!r) return null;
  const head = new Uint8Array(await r.blob.slice(0, 8).arrayBuffer());
  return { type: r.blob.type, size: r.blob.size, width: r.width, height: r.height, png: head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 };
});

const HOSTS = ['crumb.example', 'the.internet', 'news.ycombinator.example'];
const browser = await chromium.launch({ args: [`--host-resolver-rules=${HOSTS.map((h) => 'MAP ' + h + ' 127.0.0.1').join(',')}`] });
// pixel comparison runs in a blank page: decode both screenshots and count the channels that differ
const cmp = await browser.newPage();
const diff = (a, b) => cmp.evaluate(async ([a, b]) => {
  const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { max: 255, loud: -1 };
  const c = document.createElement('canvas');
  c.width = ia.width; c.height = ia.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(ia, 0, 0);
  const da = g.getImageData(0, 0, c.width, c.height).data;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(ib, 0, 0);
  const db = g.getImageData(0, 0, c.width, c.height).data;
  let max = 0, loud = 0;
  for (let i = 0; i < da.length; i++) { const d = Math.abs(da[i] - db[i]); if (d > max) max = d; if (d > 40) loud++; }
  return { max, loud };
}, [a.toString('base64'), b.toString('base64')]);
// The page comes back to the byte: markup, styles and text are compared exactly. Pixels are allowed a small
// drift, because Chromium can re-sample a photo or keep a layer after the page was switched off and on.
const samePixels = (d) => d.loud === 0 && d.max <= 40;

try {
  // 1. The baking blog: launch, buy, the crowd, the rug, the pile, the card, the refund
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://crumb.example:${port}/demo/index.html?auto=0`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    const before = await page.screenshot();
    const snapBefore = await snapshot(page);
    const st0 = await start(page);
    check('launches the page as a coin', st0.phase === 'pump' && st0.ticker === 'CRUMB' && st0.price > 0 && st0.holders > 10, `$${st0.ticker} at $${st0.price.toPrecision(3)}`);
    const ui = await page.evaluate(() => { const h = document.querySelector('rugpull-overlay'); return h && h.shadowRoot ? h.shadowRoot.textContent : ''; });
    check('trading panel with the disclaimer and the credit', /\$CRUMB/.test(ui) && /Bonding curve/.test(ui) && /Rug pull/.test(ui) && /Parody\. No coins, no wallets, nothing leaves your browser\./.test(ui) && /rugpull by @shmidtqq/.test(ui));
    await step(page, 0.6);
    // the words "weekends" in the headline and "Jump to recipe", a link
    const w = await page.evaluate(() => {
      const h1 = document.querySelector('h1').firstChild, r = document.createRange();
      const i = h1.data.indexOf('weekends'); r.setStart(h1, i); r.setEnd(h1, i + 8);
      const a = r.getBoundingClientRect(), b = document.querySelector('.jump .btn').getBoundingClientRect();
      return { word: [a.left + a.width / 2, a.top + a.height / 2], link: [b.left + b.width / 2, b.top + b.height / 2] };
    });
    await page.mouse.click(w.word[0], w.word[1]);
    await page.mouse.click(w.link[0], w.link[1]);
    const bought = await page.evaluate(() => ({ you: window.__rugpull.state().you, hl: CSS.highlights.get('rugpull-you').size, hash: location.hash }));
    check('a click buys the word under the cursor and links stay put', bought.you === 2 && bought.hl >= 1 && bought.hash === '', `${bought.hl} words highlighted`);
    await page.keyboard.press('b');
    await step(page, 6);
    const st1 = await state(page);
    check('B buys a random word, and the crowd keeps buying', st1.you === 3 && st1.crowd >= 3 && st1.trades >= 15 && st1.marketCap > st0.marketCap, `${st1.crowd} words bought by the crowd, ${st1.trades} trades, ${st1.holders} holders`);

    await page.keyboard.press('r');
    await step(page, 0.05);
    const rug = await page.evaluate(() => ({ s: window.__rugpull.state(), body: getComputedStyle(document.body).opacity }));
    check('R pulls the rug: the page is copied and switched off', rug.s.phase === 'rug' && rug.body === '0' && rug.s.particles >= 120, `${rug.s.particles} pieces`);
    await step(page, 2.6);
    const st2 = await state(page);
    check('everything falls into a pile, then the card', st2.phase === 'card' && st2.settled >= st2.particles * 0.97 && st2.price < st1.price * 0.02, `${st2.settled} of ${st2.particles} settled, ${((st2.price / st1.price - 1) * 100).toFixed(1)}%`);
    const cd = await card(page);
    check('the card saves as a PNG', cd && cd.png && cd.width === 1280 && cd.height === 720, cd ? `${cd.width}x${cd.height}, ${Math.round(cd.size / 1024)} KB` : 'none');
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.keyboard.press('s')]);
    check('S downloads it', download.suggestedFilename() === 'rugpull-crumb.png', download.suggestedFilename());

    await page.keyboard.press('Escape');
    await step(page, 0.3);
    check('Esc refunds: the pieces fly home', (await state(page)).phase === 'refund');
    await finish(page);
    const snapAfter = await snapshot(page);
    const d = await diff(before, await page.screenshot());
    check('and switches off', await gone(page) && !(await page.$('rugpull-overlay')));
    check('markup, styles, text and highlights are exactly as before', snapAfter.html === snapBefore.html && snapAfter.text === snapBefore.text && snapAfter.sheets === snapBefore.sheets && snapAfter.highlights === snapBefore.highlights);
    check('pixels are back', samePixels(d), `max channel difference ${d.max}`);
    check('no page errors', errors.length === 0, errors.join('; '));
    await page.close();
  }

  // 2. Esc before the rug just closes
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://crumb.example:${port}/demo/index.html?auto=0`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const before = await page.screenshot();
    const snapBefore = await snapshot(page);
    await start(page);
    await step(page, 3);
    await page.keyboard.press('Escape');
    await finish(page);
    const snapAfter = await snapshot(page);
    const d = await diff(before, await page.screenshot());
    check('Esc before the rug closes and cleans up', await gone(page) && snapAfter.html === snapBefore.html && snapAfter.highlights === 0 && samePixels(d));
    await page.close();
  }

  // 3. Strict Content-Security-Policy
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://crumb.example:${port}/demo/index.html?auto=0&csp=1`, { waitUntil: 'load' });
    await page.evaluate(() => { window.__violations = []; document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(e.violatedDirective + ' ' + e.blockedURI)); });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const before = await page.screenshot();
    const snapBefore = await snapshot(page);
    await start(page);
    await step(page, 2);
    await page.evaluate(() => window.__rugpull.rug());
    await step(page, 2.8);
    const st = await state(page);
    const cd = await card(page);
    await page.keyboard.press('Escape');
    await finish(page);
    const v = await page.evaluate(() => window.__violations);
    const snapAfter = await snapshot(page);
    const d = await diff(before, await page.screenshot());
    check('works under a strict CSP', st.phase === 'card' && st.particles > 100 && cd && cd.png && v.length === 0 && errors.length === 0, v.concat(errors).join('; '));
    check('and refunds there too', snapAfter.html === snapBefore.html && samePixels(d));
    await page.close();
  }

  // 4. Tickers come from the site name or the address
  {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const tick = async (url) => {
      await page.goto(url, { waitUntil: 'load' });
      const st = await start(page);
      await page.evaluate(() => window.__rugpull.stop());
      return st.ticker;
    };
    const t1 = await tick(`http://the.internet:${port}/test/fixtures/plain.html`);
    const t2 = await tick(`http://news.ycombinator.example:${port}/test/fixtures/plain.html`);
    const t3 = await tick(`${base}/test/fixtures/plain.html`);
    const t4 = await tick(`${base}/test/fixtures/app.html`);
    check('names the coin after the site', t1 === 'INTERNET' && t2 === 'YCMBNTR' && t3 === 'WELCOME' && t4 === 'ORBIT', [t1, t2, t3, t4].map((t) => '$' + t).join(', '));
    await page.close();
  }

  // 5. Dashboard: open shadow roots, a scroll box, form fields and the page's own button
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/test/fixtures/app.html`, { waitUntil: 'load' });
    await page.waitForTimeout(200);
    const before = await page.screenshot();
    const snapBefore = await snapshot(page);
    await start(page);
    await page.click('#help');
    const own = await page.evaluate(() => document.querySelector('#clicks').textContent);
    check('the page\'s own button (data-rugpull-ignore) still works', own === '1');
    await page.evaluate(() => { document.querySelector('#clicks').textContent = '0'; document.activeElement.blur(); });
    await page.evaluate(() => window.__rugpull.rug());
    await step(page, 0.03);
    const words = await page.evaluate(() => window.__rugpull.state().particles);
    await step(page, 2.8);
    await page.keyboard.press('Escape');
    await page.mouse.move(0, 0);
    await finish(page);
    const snapAfter = await snapshot(page);
    const d = await diff(before, await page.screenshot());
    check('shadow roots, scroll boxes and forms come back', snapAfter.html === snapBefore.html && snapAfter.shadow === snapBefore.shadow && samePixels(d) && words > 60 && errors.length === 0, `${words} pieces, max channel difference ${d.max}`);
    await page.close();
  }

  // 6. The bonding curve: wait long enough and the dev pulls the rug for you
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`http://crumb.example:${port}/demo/index.html?auto=0`, { waitUntil: 'load' });
    await start(page);
    let st = await state(page);
    for (let i = 0; i < 90 && st.phase === 'pump'; i++) { await step(page, 1); st = await state(page); }
    check('the bonding curve hits 100% and the rug pulls itself', st.phase !== 'pump' && st.curve > 0.95, `curve ${(st.curve * 100).toFixed(1)}%`);
    await page.evaluate(() => window.__rugpull.stop());
    await page.close();
  }

  // 7. The bookmarklet: runs as-is, and a second click switches it off
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://crumb.example:${port}/demo/index.html?auto=0`, { waitUntil: 'load' });
    const bm = (await readFile(join(root, 'bookmarklet.txt'), 'utf8')).trim();
    const code = decodeURIComponent(bm.slice('javascript:'.length));
    await page.evaluate(() => { window.__RP_MANUAL = true; window.__RP_OPTIONS = { sound: false }; });
    await page.evaluate((c) => (0, eval)(c), code);
    await step(page, 1);
    const on = (await state(page)).phase;
    await page.evaluate((c) => (0, eval)(c), code);
    const out = (await state(page)).phase;
    await finish(page);
    check('bookmarklet runs and toggles', bm.length < 64500 && on === 'pump' && out === 'out' && (await gone(page)) && errors.length === 0, `${bm.length} chars`);
    await page.close();
  }

  // 8. Reduced motion: no fall, the card comes at once, the refund is instant
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(`http://crumb.example:${port}/demo/index.html?auto=0`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const before = await page.screenshot();
    await start(page);
    await page.keyboard.press('r');
    await step(page, 0.7);
    const st = await state(page);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    const d = await diff(before, await page.screenshot());
    check('respects reduced motion', st.phase === 'card' && st.particles === 0 && (await gone(page)) && samePixels(d));
    await page.close();
  }

  // 9. Phone
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://crumb.example:${port}/demo/index.html?auto=0`, { waitUntil: 'load' });
    await start(page);
    await step(page, 1);
    const box = await page.evaluate(() => { const r = document.querySelector('rugpull-overlay').shadowRoot.querySelector('.panel').getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; });
    await page.evaluate(() => window.__rugpull.rug());
    await step(page, 2.8);
    const cardBox = await page.evaluate(() => { const r = document.querySelector('rugpull-overlay').shadowRoot.querySelector('canvas.card').getBoundingClientRect(); return [r.left, r.right]; });
    check('fits a phone screen', box[0] >= 0 && box[1] <= 390 && box[3] <= 844 && cardBox[0] >= 0 && cardBox[1] <= 390 && errors.length === 0, `panel ${box.map(Math.round).join(',')}, card ${cardBox.map(Math.round).join('-')}`);
    await page.evaluate(() => window.__rugpull.stop());
    await page.close();
  }

  // 10. A heavy page: 12,000 elements
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${base}/test/stress.html`, { waitUntil: 'load' });
    await start(page);
    await step(page, 1);
    const t = await page.evaluate(() => { const t0 = performance.now(); window.__rugpull.rug(); return performance.now() - t0; });
    const frame = await page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 60; i++) window.__rugpull.step(1 / 60); return (performance.now() - t0) / 60; });
    const st = await state(page);
    check('stays fast on a heavy page', t < 600 && frame < 16, `${st.particles} pieces, rug ${t.toFixed(0)} ms, ${frame.toFixed(2)} ms a frame`);
    await page.evaluate(() => window.__rugpull.stop());
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
