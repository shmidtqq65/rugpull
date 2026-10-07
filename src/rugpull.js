/* RUGPULL: every website is a memecoin now. One file, no dependencies, nothing leaves your browser.
   https://github.com/shmidtqq65/rugpull  (MIT)

   A parody. There is no coin, no wallet, no chain and no server: the market, the buyers and the crash
   are made up in your tab out of the page itself, and Esc gives everything back.

   How it works, in short:
   - The page gets a ticker from its name or address and a trading panel: price, candles, holders,
     a bonding curve and a feed of buyers named after words on the page.
   - Clicking a word buys it, and the crowd keeps buying too. Bought words light up through the CSS
     Custom Highlight API, so the text itself is never touched.
   - R, the red button, or the bonding curve hitting 100% pulls the rug: every word, picture and coloured
     box on screen is copied onto a canvas, the page underneath is switched off with one stylesheet,
     and everything falls into a pile at the bottom of the screen.
   - Esc refunds: the pile flies back into place and the page is switched on again, exactly as it was. */
(() => {
  'use strict';
  const W = window, D = document, DE = D.documentElement;
  const prior = W.__rugpull;
  if (prior && prior.alive) { prior.toggle(); return; }
  if (!DE || !D.body || !(D.body instanceof HTMLElement)) return;
  if (!('adoptedStyleSheets' in D) || typeof CSSStyleSheet !== 'function') {
    console.warn('RUGPULL needs constructable stylesheets (Chrome 73+, Firefox 101+, Safari 16.4+).');
    return;
  }

  const VERSION = '1.0.0';
  const OPT = Object.assign({ seed: 0, sound: true, tape: true, autorug: true, credit: true }, W.__RP_OPTIONS || {});
  const MANUAL = !!W.__RP_MANUAL;
  const MOTION = OPT.motion !== false && !(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const now = () => performance.now();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const TAU = Math.PI * 2;

  // a small seeded random, so a recording comes out the same every time
  let seed = (OPT.seed >>> 0) || ((Date.now() ^ (Math.random() * 4294967296)) >>> 0) || 1;
  const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
  const pick = (a) => a[(rnd() * a.length) | 0];
  const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); };
  const hex = (n) => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[(rnd() * 16) | 0]; return s; };

  // ---------------------------------------------------------------- look
  const C = { bg: '#0b0e13', panel: '#10141b', line: '#232a35', text: '#e8edf4', muted: '#8892a2', green: '#1ec584', red: '#f23b4c', gold: '#f7c948' };
  const SANS = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  const MONO = 'ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace';
  const X = '\u00d7', DOT = '\u00b7', ELL = '\u2026', UP = '\u25b2', DN = '\u25bc', MINUS = '\u2212';

  // ---------------------------------------------------------------- the coin
  const host = (location.hostname || '').replace(/^www\d?\./, '');
  const STOP = new Set('the a an and or of to in on for with at by from is are was were be been being it its this that these those as but not no nor so if then than too very can could will would should just into over under about after before more most other some such only own same your yours you we our ours they their them he she his her him i me my mine what which who whom when where why how all any both each few here there out up down off again once also does did doing have has had having do one two three four five'.split(' '));
  const LABEL = /^(www\d?|m|en|de|fr|es|ru|it|nl|pt|ja|zh|app|web|blog|news|docs|the|my|go|home|shop|store|online|beta|com|org|net|io|co|uk|us|ai|dev|xyz|info|biz|me|tv|gg|so|sh|to|ly|fm|edu|gov|example|test|local|localhost)$/;
  const clean = (s) => s.replace(/[^A-Za-z0-9]/g, '');
  function tickerOf() {
    const tries = [];
    const meta = D.querySelector('meta[property="og:site_name"],meta[name="application-name"]');
    if (meta && meta.content) tries.push(meta.content.trim().split(/\s+/));
    if (host && !/^[\d.:[\]]+$/.test(host)) {
      const labels = host.split('.').filter((l) => !LABEL.test(l));
      if (labels.length) tries.push([labels[labels.length - 1]]);
    }
    tries.push((D.title || '').split(/[\s|:,.\-]+/).filter((w) => w.length > 2 && !STOP.has(w.toLowerCase())).slice(0, 1));
    for (const t of tries) {
      const words = t.map(clean).filter((w) => w && !/^the$/i.test(w));
      if (!words.length) continue;
      let s = words.join('');
      if (s.length > 10) s = words.length >= 3 ? words.map((w) => w[0]).join('') : words[0];
      if (s.length > 10) s = s[0] + s.slice(1).replace(/[aeiou]/gi, '');   // ycombinator -> YCMBNTR
      if (s.length >= 2) return s.toUpperCase().slice(0, 10);
    }
    return 'PAGE';
  }
  const TICKER = tickerOf();
  const NAME = ((D.querySelector('meta[property="og:title"]') || {}).content || D.title || host || 'This page').replace(/\s+/g, ' ').trim();
  const HUE = [...TICKER].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  // words of the page, for buyer names and the ticker tape
  const bank = (() => {
    const txt = (D.body.innerText || '').slice(0, 30000);
    const count = new Map();
    for (const m of txt.matchAll(/\p{L}[\p{L}']{3,11}/gu)) {
      const w = m[0].toLowerCase().replace(/'.*$/, '');
      if (w.length < 4 || STOP.has(w)) continue;
      count.set(w, (count.get(w) || 0) + 1);
    }
    const list = [...count.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    return list.length ? list.slice(0, 60) : ['anon', 'degen', 'whale', 'ape', 'moon'];
  })();
  function buyer() {
    const w = bank[(Math.pow(rnd(), 1.6) * bank.length) | 0];
    const r = rnd();
    if (r < 0.16) return '0x' + hex(4) + ELL + hex(4);
    if (r < 0.38) return w + '.eth';
    if (r < 0.52) return w + '.sol';
    if (r < 0.64) return w + '_maxi';
    if (r < 0.77) return w + ((rnd() * 999) | 0);
    if (r < 0.88) return 'degen' + w;
    return w + 'lord';
  }

  // ---------------------------------------------------------------- the market (all made up, all local)
  const SUPPLY = 1e9, SOLUSD = 152;
  let lp = Math.log(0.0000032 + rnd() * 0.0000026);   // log of the price in dollars
  const lp0 = lp;
  let ath = lp, holders = 19 + ((rnd() * 24) | 0), volume = 0, curve = 0.06 + rnd() * 0.05;
  let youBuys = 0, youSol = 0, crowdWords = 0, trades = 0;
  const candles = [];
  let cur = { o: lp, h: lp, l: lp, c: lp }, candleT = 0;
  const CANDLE = 0.42;
  let rugged = false, rugFrom = 0, rugTo = 0, rugAt = 0, devSol = 0, candleN = 0, rugN = 0;
  const price = () => Math.exp(lp);
  const mcap = () => price() * SUPPLY;
  const money = (v) => (v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'K' : '$' + v.toFixed(0));
  const priceStr = (v) => {
    if (v >= 1) return '$' + v.toFixed(2);
    const z = Math.max(0, -Math.floor(Math.log10(v)) - 1);
    return '$' + v.toFixed(Math.min(12, z + 4));
  };
  const pct = (v) => (v >= 0 ? '+' : MINUS) + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + '%';
  const change = () => (Math.exp(lp - lp0) - 1) * 100;

  function market(dt) {
    if (phase === 'pump') {
      const mu = 0.12 + curve * 0.16;
      lp += mu * dt + 0.085 * Math.sqrt(dt) * gauss();
      if (rnd() < dt * 0.3) lp -= 0.03 + rnd() * 0.07;      // someone takes profit
      curve = Math.min(1, curve + dt * 0.018);
      if (rnd() < dt * 7) holders++;
      if (curve >= 1 && OPT.autorug) rug();
    } else if (rugged) {
      const t = clock - rugAt;
      if (t < 0.5) lp = lerp(rugFrom, rugTo, ease(t / 0.5)) + 0.02 * gauss();
      else if (t < 1.3) lp = rugTo + 0.35 * Math.sin(((t - 0.5) / 0.8) * Math.PI) * 0.3 + 0.01 * gauss();   // the dead cat bounces
      else lp = rugTo + 0.012 * gauss();
    }
    ath = Math.max(ath, lp);
    cur.h = Math.max(cur.h, lp); cur.l = Math.min(cur.l, lp); cur.c = lp;
    candleT += dt;
    if (candleT >= CANDLE) {
      candles.push(cur);
      candleN++;
      if (candles.length > 160) candles.shift();
      cur = { o: lp, h: lp, l: lp, c: lp };
      candleT = 0;
    }
  }

  // the trade feed
  const feed = [];
  let feedT = 0.4;
  function trade(who, side, sol, kind, verb) {
    trades++;
    volume += sol * SOLUSD;
    feed.unshift({ who, side, sol, kind: kind || '', verb: verb || (side === 'buy' ? 'bought' : 'sold'), t: clock });
    if (feed.length > 14) feed.length = 14;
    feedDirty = true;
  }
  function crowd(dt) {
    feedT -= dt;
    if (feedT > 0) return;
    if (phase === 'pump') {
      feedT = 0.16 + rnd() * 0.46;
      const sell = rnd() < 0.18;
      const sol = Math.min(40, Math.exp(gauss() * 0.95) * 0.55);
      trade(buyer(), sell ? 'sell' : 'buy', sol);
      lp += (sell ? -1 : 1) * (0.003 + sol * 0.0035);
      curve = Math.min(1, curve + (sell ? 0 : sol * 0.0012));
      if (!sell && rnd() < 0.6) buyWord(false);
    } else if (phase === 'rug' || phase === 'card') {
      const t = clock - rugAt;
      if (t > 6) { feedT = 1e9; return; }
      feedT = 0.06 + rnd() * 0.16 + t * 0.05;
      trade(buyer(), 'sell', Math.exp(gauss() * 0.8) * 0.004, 'panic');
    }
  }

  // ---------------------------------------------------------------- styles: highlights, and the switch that turns the page off
  const newSheet = (css) => { const s = new CSSStyleSheet(); s.replaceSync(css); return s; };
  const BASE = newSheet('::highlight(rugpull-crowd){background-color:rgba(30,197,132,.24)}::highlight(rugpull-you){background-color:rgba(247,201,72,.55);color:#111}');
  const HIDE = newSheet('');
  const unadopt = (root, sheet) => { try { root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => s !== sheet); } catch (e) {} };
  const hasHL = !!(W.CSS && CSS.highlights && W.Highlight);
  const hlCrowd = hasHL ? new Highlight() : null, hlYou = hasHL ? new Highlight() : null;
  if (hasHL) { CSS.highlights.set('rugpull-crowd', hlCrowd); CSS.highlights.set('rugpull-you', hlYou); }
  D.adoptedStyleSheets = [...D.adoptedStyleSheets, BASE];

  // ---------------------------------------------------------------- the overlay
  const css = `
:host{all:initial}
.w{position:fixed;inset:0;pointer-events:none;font:13px/1.35 ${SANS};color:${C.text};-webkit-font-smoothing:antialiased;text-align:left;direction:ltr}
canvas.fx{position:absolute;inset:0;width:100%;height:100%}
.tape{position:absolute;left:0;right:0;top:0;height:28px;background:#06080b;border-bottom:1px solid ${C.line};overflow:hidden;pointer-events:auto;font:700 12px/28px ${MONO};white-space:nowrap;cursor:default}
.track{position:absolute;left:0;top:0;will-change:transform}
.track span{display:inline-block;margin:0 16px}
.track .t{color:${C.text}}
.track .u{color:${C.green}}
.track .d{color:${C.red}}
.panel{position:absolute;right:12px;top:40px;bottom:12px;width:360px;display:flex;flex-direction:column;gap:10px;padding:14px 14px 10px;box-sizing:border-box;background:${C.panel};border:1px solid ${C.line};border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.5);pointer-events:auto;overflow:hidden;cursor:default}
.hd{display:flex;align-items:center;gap:10px}
.ava{flex:0 0 40px;height:40px;border-radius:50%;display:grid;place-items:center;font:800 18px/1 ${SANS};color:#0b0e13}
.id{min-width:0}
.id b{display:block;font:800 19px/1.1 ${SANS};letter-spacing:.01em}
.id span{display:block;margin-top:2px;color:${C.muted};font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
button{all:unset;box-sizing:border-box;cursor:pointer;text-align:center}
button:focus-visible{outline:2px solid ${C.gold};outline-offset:2px}
.x{margin-left:auto;flex:0 0 auto;color:${C.muted};font:400 22px/1 ${SANS};padding:2px 7px;border-radius:7px}
.x:hover{background:#1a2029;color:${C.text}}
.px{display:flex;align-items:baseline;gap:10px;white-space:nowrap}
.px b{font:800 27px/1 ${MONO};letter-spacing:-.02em}
.px span{font:700 14px/1 ${MONO}}
.px small{margin-left:auto;color:${C.muted};font:600 11px/1 ${MONO}}
canvas.chart{display:block;width:100%;height:150px;border-radius:9px;background:#090c11;border:1px solid #1a2029}
.st{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.st div{background:#0c1016;border:1px solid #1d232d;border-radius:9px;padding:7px 9px}
.st span{display:block;color:${C.muted};font:600 10px/1.2 ${SANS};text-transform:uppercase;letter-spacing:.07em}
.st b{display:block;margin-top:3px;font:700 15px/1.1 ${MONO};white-space:nowrap}
.cv .l{display:flex;justify-content:space-between;color:${C.muted};font:600 10px/1 ${SANS};text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
.cv .l b{color:${C.text};font:700 11px/1 ${MONO}}
.bar{height:8px;border-radius:99px;background:#1a2029;overflow:hidden}
.bar i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#16a56d,#5dffb4)}
.ac{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ac button{padding:12px 0;border-radius:10px;font:800 14px/1 ${SANS};letter-spacing:.02em}
.buy{background:${C.green};color:#03140c}
.rug{background:${C.red};color:#fff}
.buy:hover,.rug:hover{filter:brightness(1.1)}
.ac button[disabled]{opacity:.35;cursor:default;filter:none}
.fh{display:flex;justify-content:space-between;color:${C.muted};font:600 10px/1 ${SANS};text-transform:uppercase;letter-spacing:.07em}
.fh i{font-style:normal;color:${C.green}}
.fh i::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:5px;vertical-align:1px}
ul{list-style:none;margin:-4px 0 0;padding:0;flex:1 1 auto;min-height:40px;overflow:hidden}
li{display:grid;grid-template-columns:minmax(0,1fr) auto 62px 30px;gap:8px;align-items:center;padding:5px 2px;border-bottom:1px solid #161b23;font:12px/1.2 ${MONO};white-space:nowrap}
li .w0{overflow:hidden;text-overflow:ellipsis;color:#c4ccd8}
li .s{font-weight:700}
li .a{text-align:right}
li .t0{text-align:right;color:${C.muted};font-size:11px}
li.buy0 .s{color:${C.green}}
li.sell0 .s{color:${C.red}}
li.you .w0{color:${C.gold};font-weight:700}
li.dev{background:rgba(242,59,76,.12)}
li.dev .w0,li.dev .s{color:${C.red};font-weight:800}
.ft{display:flex;justify-content:space-between;gap:8px;color:#5f6876;font-size:10.5px;line-height:1.3}
.ft a{color:${C.muted};text-decoration:none;white-space:nowrap}
.ft a:hover{color:${C.text}}
.cardw{position:absolute;left:50%;top:50%;display:none;pointer-events:auto}
canvas.card{display:block;border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.6)}
.cb{display:flex;justify-content:center;gap:10px;margin-top:12px}
.cb button{padding:11px 18px;border-radius:10px;font:800 13px/1 ${SANS};background:#1a2029;color:${C.text};border:1px solid #2a3240}
.cb .rf{background:${C.green};color:#03140c;border-color:${C.green}}
.toast{position:absolute;left:50%;top:44px;transform:translateX(-50%);padding:8px 14px;border-radius:9px;background:#1a2029;border:1px solid #2a3240;font:600 12px/1.3 ${SANS};opacity:0;transition:opacity .3s;white-space:nowrap}
.toast.on{opacity:1}
@media (max-width:820px){
  .panel{left:8px;right:8px;top:auto;bottom:8px;width:auto;height:min(46vh,400px);gap:8px;padding:12px 12px 8px}
  canvas.chart{height:92px}
  .px b{font-size:22px}
  .st{grid-template-columns:repeat(4,1fr);gap:5px}
  .st div{padding:6px}
  .st b{font-size:12px}
  .ft span{display:none}
}`;
  let hostEl, shadow, fx, gx, tape, track, panel, chart, gc, feedEl, cardW, card, toastEl;
  const el = (tag, cls, parent, text) => { const e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
  const ui = {};
  function build() {
    hostEl = D.createElement('rugpull-overlay');
    hostEl.setAttribute('data-rugpull', '');
    hostEl.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;background:none!important;border:0!important;margin:0!important;padding:0!important;opacity:1!important;visibility:visible!important';
    shadow = hostEl.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [newSheet(css)];
    const w = el('div', 'w', shadow);
    fx = el('canvas', 'fx', w);
    gx = fx.getContext('2d');
    if (OPT.tape !== false) {
      tape = el('div', 'tape', w);
      track = el('div', 'track', tape);
      fillTape();
    }
    panel = el('section', 'panel', w);
    panel.setAttribute('aria-label', 'RUGPULL trading panel');
    const hd = el('div', 'hd', panel);
    const ava = el('div', 'ava', hd, TICKER[0]);
    ava.style.background = `radial-gradient(circle at 32% 28%,hsl(${HUE} 95% 78%),hsl(${(HUE + 40) % 360} 85% 52%))`;
    const id = el('div', 'id', hd);
    el('b', '', id, '$' + TICKER);
    el('span', '', id, NAME + (host ? ' ' + DOT + ' ' + host : ''));
    const x = el('button', 'x', hd, X);
    x.setAttribute('aria-label', 'Close RUGPULL');
    x.addEventListener('click', () => esc());
    const px = el('div', 'px', panel);
    ui.price = el('b', '', px);
    ui.chg = el('span', '', px);
    ui.age = el('small', '', px);
    chart = el('canvas', 'chart', panel);
    gc = chart.getContext('2d');
    const st = el('div', 'st', panel);
    const stat = (k) => { const d = el('div', '', st); el('span', '', d, k); return el('b', '', d); };
    ui.mc = stat('Market cap'); ui.hold = stat('Holders'); ui.vol = stat('Volume'); ui.liq = stat('Liquidity');
    const cv = el('div', 'cv', panel);
    const l = el('div', 'l', cv);
    el('span', '', l, 'Bonding curve');
    ui.cv = el('b', '', l);
    ui.bar = el('i', '', el('div', 'bar', cv));
    const ac = el('div', 'ac', panel);
    ui.buy = el('button', 'buy', ac, 'Buy');
    ui.rug = el('button', 'rug', ac, 'Rug pull');
    ui.buy.addEventListener('click', () => buyWord(true));
    ui.rug.addEventListener('click', () => rug());
    const fh = el('div', 'fh', panel);
    el('span', '', fh, 'Trades');
    ui.live = el('i', '', fh, 'live');
    feedEl = el('ul', '', panel);
    const ft = el('div', 'ft', panel);
    el('span', '', ft, 'Parody. No coins, no wallets, nothing leaves your browser.');
    if (OPT.credit !== false) {
      const a = el('a', '', ft, 'rugpull by @shmidtqq');
      a.href = 'https://github.com/shmidtqq65/rugpull';
      a.target = '_blank';
      a.rel = 'noopener';
    }
    cardW = el('div', 'cardw', w);
    card = el('canvas', 'card', cardW);
    const cb = el('div', 'cb', cardW);
    ui.save = el('button', 'sv', cb, 'Save PNG');
    ui.refund = el('button', 'rf', cb, 'Refund (Esc)');
    ui.save.addEventListener('click', () => saveCard(true));
    ui.refund.addEventListener('click', () => esc());
    toastEl = el('div', 'toast', w);
    DE.appendChild(hostEl);
    resize();
  }
  function fillTape() {
    const items = [[TICKER, 0]].concat(bank.slice(0, 16).map((w) => [w.toUpperCase().slice(0, 10), 0]));
    tapeItems = items.map(([t]) => ({ t, v: t === TICKER ? 0 : (rnd() < 0.78 ? 1 : -1) * Math.exp(rnd() * 5.2) }));
    track.textContent = '';
    for (let k = 0; k < 2; k++) for (const it of tapeItems) {
      const s = el('span', '', track);
      el('b', 't', s, '$' + it.t + ' ');
      it.els = (it.els || []).concat(el('b', 'u', s, ''));
    }
    tapeW = 0;
  }
  let tapeItems = [], tapeW = 0, tapeX = 0;
  let toastT = 0;
  const toast = (msg) => { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl && toastEl.classList.remove('on'), 2400); };

  let vw = 0, vh = 0, dpr = 1;
  function resize() {
    vw = DE.clientWidth || W.innerWidth;
    vh = W.innerHeight;
    dpr = Math.min(2, W.devicePixelRatio || 1);
    fx.width = Math.round(vw * dpr); fx.height = Math.round(vh * dpr);
    const r = chart.getBoundingClientRect();
    chart.width = Math.max(1, Math.round(r.width * dpr)); chart.height = Math.max(1, Math.round(r.height * dpr));
    if (piles) makePiles();
    if (phase === 'card') drawCard();
  }

  // ---------------------------------------------------------------- buying words
  const caret = (x, y) => {
    if (D.caretPositionFromPoint) { const p = D.caretPositionFromPoint(x, y); return p && { node: p.offsetNode, off: p.offset }; }
    if (D.caretRangeFromPoint) { const r = D.caretRangeFromPoint(x, y); return r && { node: r.startContainer, off: r.startOffset }; }
    return null;
  };
  const owned = new Set();
  function wordAt(x, y) {
    const c = caret(x, y);
    if (!c || !c.node || c.node.nodeType !== 3) return null;
    const t = c.node.data;
    let a = Math.min(c.off, t.length), b = a;
    const isW = (ch) => /[\p{L}\p{N}$'_-]/u.test(ch);
    while (a > 0 && isW(t[a - 1])) a--;
    while (b < t.length && isW(t[b])) b++;
    if (b - a < 2) return null;
    const r = D.createRange();
    r.setStart(c.node, a);
    r.setEnd(c.node, b);
    const rc = r.getBoundingClientRect();
    if (rc.width < 2 || x < rc.left - 2 || x > rc.right + 2 || y < rc.top - 2 || y > rc.bottom + 2) return null;
    const p = c.node.parentElement;
    if (!p || (hostEl && hostEl.contains(p))) return null;
    return { range: r, text: t.slice(a, b), key: c.node, a, rc };
  }
  function buyWord(you, x, y) {
    if (phase !== 'pump') return false;
    let w = null;
    if (x != null) w = wordAt(x, y);
    else {
      // somewhere on screen, but not under the panel or the tape
      const pr = panel ? panel.getBoundingClientRect() : { left: vw, top: vh };
      for (let i = 0; i < 14 && !w; i++) {
        const px0 = rnd() * (vw > 820 ? pr.left - 16 : vw), py0 = 34 + rnd() * ((vw > 820 ? vh : pr.top) - 44);
        const cand = wordAt(px0, py0);
        if (cand && !owned.has(keyOf(cand.key) + ':' + cand.a)) w = cand;
      }
    }
    if (you) {
      const sol = +(0.2 + rnd() * 1.8).toFixed(2);
      youBuys++;
      youSol += sol;
      trade('you', 'buy', sol, 'you');
      lp += 0.05 + rnd() * 0.07;
      curve = Math.min(1, curve + 0.025);
      holders++;
      chime();
      const fx0 = x != null ? x : w ? w.rc.left + w.rc.width / 2 : vw / 2;
      const fy0 = y != null ? y : w ? w.rc.top : vh / 2;
      floats.push({ x: fx0, y: fy0, t: clock, text: '+' + sol.toFixed(2) + ' SOL' + (w ? ' ' + DOT + ' $' + w.text.toUpperCase().slice(0, 12) : '') });
    }
    if (!w || !hasHL) return !!w;
    const k = keyOf(w.key) + ':' + w.a;
    if (owned.has(k)) { if (you) { hlCrowd.delete(w.range); hlYou.add(w.range); } return true; }
    owned.add(k);
    (you ? hlYou : hlCrowd).add(w.range);
    if (!you) crowdWords++;
    return true;
  }
  let keySeq = 0;
  const keys = new WeakMap();
  const keyOf = (n) => { let k = keys.get(n); if (!k) keys.set(n, (k = ++keySeq)); return k; };
  const floats = [];

  // ---------------------------------------------------------------- the rug: copy what is on screen, switch the page off, let it fall
  const SKIP = new Set(['script', 'style', 'noscript', 'template', 'head', 'meta', 'link', 'title', 'br', 'wbr', 'source', 'track', 'param', 'area', 'map', 'datalist', 'option', 'optgroup', 'rugpull-overlay', 'textarea', 'select']);
  const parseColor = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? (/%/.test(m[1].split(/[\s,/]+/).filter(Boolean)[3]) ? p[3] / 100 : p[3]) : 1];
  };
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (+(c[3] * a).toFixed(3)) + ')';
  let parts = [], backdrop = [], piles = null, pileB = null, pileF = null, heights = null, saved = { x: 0, y: 0 }, settledN = 0;
  const COL = 6, G = 2700;
  const measureCtx = D.createElement('canvas').getContext('2d');

  function capture() {
    const out = [], words = [], boxes = [], media = [];
    const area = vw * vh;
    const visit = (parent, op, clip) => {
      for (let e = parent.firstElementChild; e; e = e.nextElementSibling) {
        const tag = e.localName;
        if (SKIP.has(tag) || e === hostEl) continue;
        let cs;
        try { cs = getComputedStyle(e); } catch (err) { continue; }
        if (cs.display === 'none') continue;
        const o = op * (+cs.opacity || 0);
        if (o < 0.04) continue;
        const r = e.getBoundingClientRect();
        // whole sections far above or below the screen are skipped
        if (r.height > 0 && (r.top > vh * 2 || r.bottom < -vh) && cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        const vis = cs.visibility === 'visible';
        const cl = clip ? meet(clip, r) : { x: r.left, y: r.top, w: r.width, h: r.height };
        const onScreen = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
        if (vis && onScreen) {
          if (/^(img|video|canvas)$/.test(tag) && media.length < 90) {
            const ok = tag === 'img' ? e.complete && e.naturalWidth > 0 : tag === 'video' ? e.readyState >= 2 : e.width > 0 && e.height > 0;
            if (ok && r.width >= 8 && r.height >= 8 && inClip(r, clip)) media.push({ kind: 'img', src: e, fit: cs.objectFit, r, o, rad: px(cs.borderTopLeftRadius) });
          } else {
            const bg = parseColor(cs.backgroundColor);
            let fill = bg && bg[3] > 0.12 ? bg : null;
            if (!fill && /gradient/.test(cs.backgroundImage)) fill = parseColor((cs.backgroundImage.match(/rgba?\([^)]+\)/) || [])[0]);
            const sw = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)), sh = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)), a = sw * sh;
            if (fill && a >= 60 && e !== D.body && inClip(r, clip) && boxes.length < 260) {
              // a fill that covers half the screen, or a column as tall as the screen, is the page's backdrop:
              // it stays, and the rest falls onto it
              const bg = a >= area * 0.5 || (sh >= vh * 0.7 && sw >= vw * 0.4);
              boxes.push({ kind: bg ? 'bg' : 'box', fill: rgba(fill, o), r, o, rad: Math.min(px(cs.borderTopLeftRadius), r.width / 2, r.height / 2) });
            }
          }
        }
        if (/^(img|video|canvas|svg|iframe|object|embed)$/.test(tag)) continue;
        // its own words
        if (vis) for (let n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.data)) textOf(n, e, cs, o, clip, words);
        let inner = clip;
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') inner = cl;
        visit(e, o, inner);
        if (e.shadowRoot && e.shadowRoot.mode === 'open') visit(e.shadowRoot, o, inner);
      }
    };
    visit(D.body, 1, null);
    words.sort((a, b) => a.y - b.y);
    backdrop = boxes.filter((b) => b.kind === 'bg').map((b) => Object.assign(mk('box', b.r.left, b.r.top, b.r.width, b.r.height, b), { kind: 'box' }));
    for (const b of boxes) if (b.kind === 'box') out.push(mk(b.kind, b.r.left, b.r.top, b.r.width, b.r.height, b));
    media.sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
    for (const m of media) out.push(mk('img', m.r.left, m.r.top, m.r.width, m.r.height, m));
    for (const w of words.slice(0, 4200)) out.push(w);
    return out;
  }
  const px = (v) => parseFloat(v) || 0;
  const meet = (c, r) => { const x = Math.max(c.x, r.left), y = Math.max(c.y, r.top); return { x, y, w: Math.max(0, Math.min(c.x + c.w, r.right) - x), h: Math.max(0, Math.min(c.y + c.h, r.bottom) - y) }; };
  const inClip = (r, c) => !c || (r.left + r.width / 2 >= c.x && r.left + r.width / 2 <= c.x + c.w && r.top + r.height / 2 >= c.y && r.top + r.height / 2 <= c.y + c.h);
  function mk(kind, x, y, w, h, extra) {
    return Object.assign({ kind, x: x + w / 2, y: y + h / 2, w, h, a: 0, vx: 0, vy: 0, va: 0, hx: x + w / 2, hy: y + h / 2, delay: 0, done: false }, extra || {});
  }
  function textOf(n, e, cs, o, clip, words) {
    const col = parseColor(cs.color) || [0, 0, 0, 1];
    if (col[3] * o < 0.04) return;
    const font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const tt = cs.textTransform;
    const range = D.createRange();
    const re = /\S+/g;
    let m;
    while ((m = re.exec(n.data)) && words.length < 4200) {
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const rs = range.getClientRects();
      if (!rs.length) continue;
      const r = rs[0];
      if (r.width < 1 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      if (clip && !inClip(r, clip)) continue;
      let text = m[0];
      if (tt === 'uppercase') text = text.toUpperCase();
      else if (tt === 'lowercase') text = text.toLowerCase();
      else if (tt === 'capitalize') text = text.charAt(0).toUpperCase() + text.slice(1);
      measureCtx.font = font;
      const mt = measureCtx.measureText(text);
      const k = mt.width > 0 ? clamp(r.width / mt.width, 0.75, 1.3) : 1;
      const base = ((mt.fontBoundingBoxAscent || r.height * 0.8) - (mt.fontBoundingBoxDescent || r.height * 0.2)) / 2;
      words.push(mk('word', r.left, r.top, r.width, r.height, { text, font, color: rgba(col, o), k, base, tw: mt.width }));
    }
  }
  function hidePage() {
    // the page goes dark underneath the copies; html keeps the page colour so the empty site still looks like itself
    const hc = parseColor(getComputedStyle(DE).backgroundColor), bc = parseColor(getComputedStyle(D.body).backgroundColor);
    const bg = hc && hc[3] > 0.5 ? null : bc && bc[3] > 0.5 ? bc : [255, 255, 255, 1];
    HIDE.replaceSync('body{opacity:0!important;pointer-events:none!important;transition:none!important}' + (bg ? 'html{background-color:' + rgba(bg, 1) + '!important}' : ''));
    D.adoptedStyleSheets = [...D.adoptedStyleSheets, HIDE];
  }
  function showPage() { unadopt(D, HIDE); }
  function makePiles() {
    const mkc = () => { const c = D.createElement('canvas'); c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { c, g }; };
    pileB = mkc(); pileF = mkc();
    piles = true;
    heights = new Float32Array(Math.ceil(vw / COL) + 2);
    for (const p of parts) if (p.done) drawPart((p.kind === 'word' ? pileF : pileB).g, p);
  }

  let flash = 0, shake = 0;
  function rug() {
    if (phase !== 'pump' || !alive) return;
    phase = 'rug';
    rugged = true;
    rugAt = clock;
    rugN = candleN;
    rugFrom = lp;
    rugTo = ath + Math.log(0.0022 + rnd() * 0.0016);
    devSol = 180 + rnd() * 420;
    trade('DEV', 'sell', devSol * 0.62, 'dev', 'pulled LP');
    trade('DEV', 'sell', devSol * 0.38, 'dev', 'sold');
    curve = Math.min(curve, 0.999);
    if (ui.buy) { ui.buy.disabled = true; ui.rug.disabled = true; }
    womp();
    flash = MOTION ? 1 : 0.35;
    shake = MOTION ? 1 : 0;
    saved = { x: W.scrollX, y: W.scrollY };
    if (MOTION) {
      parts = capture();
      for (const p of parts) {
        p.delay = (1 - clamp(p.hy / vh, 0, 1)) * 0.28 + rnd() * 0.14;
        p.vx = (rnd() - 0.5) * (p.kind === 'word' ? 110 : 60);
        p.vy = -rnd() * 90;
        p.va = (rnd() - 0.5) * (p.kind === 'word' ? 5 : p.kind === 'img' ? 1.2 : 2.2);
      }
      makePiles();
    }
    hidePage();
  }

  // Words and small things pile up on a height map. Big pictures and panels are heavy: they drop to the
  // bottom edge and sink half out of view, so the pile stays a pile and not a wall.
  const heavy = (p) => p.kind !== 'word' && p.w * p.h > 9000;
  function relax(c0, c1) {
    // a pile keeps its slope: no column stands far above its neighbours
    const n = heights.length;
    for (let pass = 0; pass < 2; pass++) {
      for (let c = Math.max(1, c0 - 14); c <= Math.min(n - 1, c1 + 14); c++) heights[c] = Math.max(heights[c], heights[c - 1] - COL * 1.25);
      for (let c = Math.min(n - 2, c1 + 14); c >= Math.max(0, c0 - 14); c--) heights[c] = Math.max(heights[c], heights[c + 1] - COL * 1.25);
    }
  }
  function span(p) {
    const ca = Math.abs(Math.cos(p.a)), sa = Math.abs(Math.sin(p.a));
    const hw = (p.w * ca + p.h * sa) / 2, hh = (p.w * sa + p.h * ca) / 2;
    const n = heights.length - 1;
    return { hw, hh, c0: clamp(Math.floor((p.x - hw * 0.8) / COL), 0, n), c1: clamp(Math.floor((p.x + hw * 0.8) / COL), 0, n) };
  }
  function land(p) {
    p.done = true;
    p.vx = p.vy = p.va = 0;
    settledN++;
    drawPart((p.kind === 'word' ? pileF : pileB).g, p);
  }
  function settle(p, top) {
    // lie down on the nearest flat side, with a little tilt
    const flat = Math.abs(Math.atan2(Math.sin(p.a), Math.cos(p.a))) < Math.PI / 2 ? 0 : Math.PI;
    p.a = flat + (rnd() - 0.5) * (p.kind === 'word' ? 0.5 : 0.24);
    const s0 = span(p);
    let t = top;
    for (let c = s0.c0; c <= s0.c1; c++) if (heights[c] > t) t = heights[c];
    p.y = vh - t - s0.hh * 0.62;
    const add = Math.max(4, p.h * (p.kind === 'word' ? 0.34 : 0.46));
    for (let c = s0.c0; c <= s0.c1; c++) heights[c] = Math.max(heights[c], t + add);
    relax(s0.c0, s0.c1);
    land(p);
  }
  function settleHeavy(p) {
    p.a = p.a * 0.2 + (rnd() - 0.5) * 0.12;
    const s0 = span(p);
    const vis = Math.min(s0.hh * 2 * 0.38, 150);
    p.y = vh + s0.hh - vis;
    for (let c = s0.c0; c <= s0.c1; c++) heights[c] = Math.max(heights[c], vis - 8);
    relax(s0.c0, s0.c1);
    land(p);
  }
  function fall(dt) {
    for (const p of parts) {
      if (p.done) continue;
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.vy += G * dt;
      p.vx *= 1 - 0.4 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.va * dt;
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) * 0.4; }
      if (p.x > vw) { p.x = vw; p.vx = -Math.abs(p.vx) * 0.4; }
      const s0 = span(p);
      if (heavy(p)) {
        if (p.y - s0.hh > vh - Math.min(s0.hh * 2 * 0.38, 150)) settleHeavy(p);
        continue;
      }
      let top = 0;
      for (let c = s0.c0; c <= s0.c1; c++) if (heights[c] > top) top = heights[c];
      // only things moving down can land, so a word that starts below the pile line drops into place first
      if (p.vy > 0 && p.y + s0.hh >= vh - top) settle(p, top);
    }
  }

  // ---------------------------------------------------------------- the refund
  let refT = 0;
  function refund() {
    phase = 'refund';
    refT = 0;
    if (cardW) cardW.style.display = 'none';
    try { W.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' }); } catch (e) { W.scrollTo(saved.x, saved.y); }
    for (const p of parts) {
      p.fx = p.x; p.fy = p.y; p.fa = Math.atan2(Math.sin(p.a), Math.cos(p.a));
      p.rd = rnd() * 0.22 + (p.kind === 'word' ? 0.12 : 0);
      p.lift = 40 + rnd() * 120;
    }
    piles = null; pileB = pileF = null;
    tada();
    if (!MOTION || !parts.length) finish();
  }
  const REFUND = 0.95;
  function finish() {
    // the page comes back in this frame with its transitions held, and the hold is lifted a moment later
    HIDE.replaceSync('body{transition:none!important}');
    const hold = HIDE;
    teardown(true);
    setTimeout(() => unadopt(D, hold), 120);
  }

  // ---------------------------------------------------------------- drawing
  function drawPart(g, p) {
    g.save();
    g.translate(p.x, p.y);
    if (p.a) g.rotate(p.a);
    if (p.kind === 'word') {
      g.font = p.font;
      g.fillStyle = p.color;
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      if (p.k !== 1) g.scale(p.k, 1);
      g.fillText(p.text, -p.tw / 2, p.base);
    } else if (p.kind === 'box') {
      g.fillStyle = p.fill;
      g.beginPath();
      if (g.roundRect && p.rad > 0.5) g.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, p.rad); else g.rect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.fill();
    } else {
      if (p.o < 1) g.globalAlpha = p.o;
      try { drawMedia(g, p); } catch (e) {}
    }
    g.restore();
  }
  function drawMedia(g, p) {
    const s = p.src;
    const nw = s.naturalWidth || s.videoWidth || s.width, nh = s.naturalHeight || s.videoHeight || s.height;
    if (!nw || !nh) return;
    let dx = -p.w / 2, dy = -p.h / 2, dw = p.w, dh = p.h, sx = 0, sy = 0, sw = nw, sh = nh;
    const ri = nw / nh, rb = p.w / p.h;
    if (p.fit === 'cover') { if (ri > rb) { sw = nh * rb; sx = (nw - sw) / 2; } else { sh = nw / rb; sy = (nh - sh) / 2; } }
    else if (p.fit === 'contain' || p.fit === 'scale-down') { if (ri > rb) { dh = p.w / ri; dy = -dh / 2; } else { dw = p.h * ri; dx = -dw / 2; } }
    if (p.rad > 1 && g.roundRect) { g.beginPath(); g.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, Math.min(p.rad, p.w / 2, p.h / 2)); g.clip(); }
    g.drawImage(s, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  function frame(dt) {
    clock += dt;
    market(dt);
    crowd(dt);
    if (phase === 'rug' || phase === 'card') { if (MOTION) fall(dt); }
    if (phase === 'rug' && clock - rugAt > (MOTION ? 2.4 : 0.6)) showCard();
    if (phase === 'refund') {
      refT += dt;
      if (refT > REFUND + 0.4) { finish(); return; }
    }
    if (phase === 'out') {
      outT += dt;
      if (outT > 0.32 || !MOTION) { teardown(); return; }
    }
    paint(dt);
    paintPanel(dt);
  }

  function paint(dt) {
    const g = gx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, vw, vh);
    shake = Math.max(0, shake - dt * 1.6);
    const sxo = shake > 0 ? (rnd() - 0.5) * 26 * shake * shake : 0, syo = shake > 0 ? (rnd() - 0.5) * 20 * shake * shake : 0;
    g.setTransform(dpr, 0, 0, dpr, sxo * dpr, syo * dpr);
    if (phase === 'rug' || phase === 'card' || phase === 'refund') for (const b of backdrop) drawPart(g, b);
    if (phase === 'rug' || phase === 'card') {
      if (pileB) g.drawImage(pileB.c, 0, 0, vw, vh);
      for (const p of parts) if (!p.done && p.kind !== 'word') drawPart(g, p);
      if (pileF) g.drawImage(pileF.c, 0, 0, vw, vh);
      for (const p of parts) if (!p.done && p.kind === 'word') drawPart(g, p);
      if (phase === 'card') {
        const a = clamp((clock - cardAt) / 0.4, 0, 1) * 0.5;
        g.fillStyle = 'rgba(5,7,10,' + a + ')';
        g.fillRect(-40, -40, vw + 80, vh + 80);
      }
    } else if (phase === 'refund') {
      for (const p of parts) {
        const t = ease(clamp((refT - p.rd) / REFUND, 0, 1));
        const x = lerp(p.fx, p.hx, t), y = lerp(p.fy, p.hy, t) - Math.sin(t * Math.PI) * p.lift, a = p.fa * (1 - t);
        const ox = p.x, oy = p.y, oa = p.a;
        p.x = x; p.y = y; p.a = a;
        drawPart(g, p);
        p.x = ox; p.y = oy; p.a = oa;
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the buy confirmations
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], t = (clock - f.t) / 1.1;
      if (t >= 1) { floats.splice(i, 1); continue; }
      g.globalAlpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4);
      g.font = '800 15px ' + SANS;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const y = f.y - 18 - easeOut(t) * 46;
      const w = g.measureText(f.text).width + 18;
      g.fillStyle = 'rgba(11,14,19,.92)';
      g.beginPath();
      if (g.roundRect) g.roundRect(f.x - w / 2, y - 13, w, 26, 13); else g.rect(f.x - w / 2, y - 13, w, 26);
      g.fill();
      g.fillStyle = C.gold;
      g.fillText(f.text, f.x, y + 1);
      g.globalAlpha = 1;
    }
    if (flash > 0) {
      g.fillStyle = 'rgba(242,59,76,' + (flash * 0.4).toFixed(3) + ')';
      g.fillRect(0, 0, vw, vh);
      flash = Math.max(0, flash - dt * 2.2);
    }
  }

  // the panel: numbers, candles, feed and the tape
  let feedDirty = true, feedAgeT = 0, inT = 0, outT = 0, cardAt = 0;
  function paintPanel(dt) {
    if (!panel) return;
    inT += dt;
    // slide in, slide out (driven here, so a recording frame by frame looks the same)
    const pin = MOTION ? easeOut(inT / 0.45) : 1;
    let pout = phase === 'out' ? clamp(outT / 0.3, 0, 1) : 0;
    if (phase === 'card' || phase === 'refund') pout = Math.max(pout, clamp((clock - cardAt) / 0.35, 0, 1));
    const narrow = vw <= 820;
    panel.style.transform = narrow ? `translateY(${((1 - pin) + pout) * 110}%)` : `translateX(${((1 - pin) + pout) * 115}%)`;
    panel.style.opacity = String(1 - pout * 0.6);
    if (tape) tape.style.transform = `translateY(${-((1 - pin) + (phase === 'out' || phase === 'refund' ? clamp(phase === 'out' ? outT / 0.3 : refT / 0.3, 0, 1) : 0)) * 100}%)`;
    const crashed = phase !== 'pump' && phase !== 'out';
    const up = change() >= 0 && !crashed;
    ui.price.textContent = priceStr(price());
    ui.price.style.color = crashed ? C.red : C.text;
    ui.chg.textContent = pct(crashed ? (Math.exp(lp - ath) - 1) * 100 : change());
    ui.chg.style.color = up ? C.green : C.red;
    ui.age.textContent = crashed ? 'RUGGED' : 'age ' + Math.floor(clock) + 's';
    ui.age.style.color = crashed ? C.red : C.muted;
    ui.mc.textContent = money(mcap());
    ui.hold.textContent = holders.toLocaleString('en-US');
    ui.vol.textContent = money(volume);
    ui.liq.textContent = crashed ? '$0' : money(mcap() * 0.17);
    ui.liq.style.color = crashed ? C.red : '';
    ui.cv.textContent = (curve * 100).toFixed(1) + '%';
    ui.bar.style.width = (curve * 100).toFixed(2) + '%';
    if (crashed) ui.bar.style.background = C.red;
    ui.live.style.color = crashed ? C.red : C.green;
    ui.live.textContent = crashed ? 'everyone is selling' : 'live';
    drawChart();
    feedAgeT -= dt;
    if (feedDirty || feedAgeT <= 0) { renderFeed(); feedDirty = false; feedAgeT = 0.5; }
    // the newest row slides in
    const first = feedEl.firstChild;
    if (first && feed[0]) { const a = clamp((clock - feed[0].t) / 0.22, 0, 1); first.style.opacity = String(a); first.style.transform = `translateX(${(1 - a) * -14}px)`; }
    if (tape && track) {
      if (!tapeW) tapeW = track.scrollWidth / 2;
      tapeX = (tapeX + dt * 58) % Math.max(1, tapeW);
      track.style.transform = `translateX(${-tapeX}px)`;
      for (const it of tapeItems) {
        const v = it.t === TICKER ? (crashed ? (Math.exp(lp - ath) - 1) * 100 : change()) : crashed ? -(88 + (Math.abs(it.v) % 11.9)) : it.v;
        for (const b of it.els) { b.textContent = (v >= 0 ? UP : DN) + ' ' + pct(v); b.className = v >= 0 ? 'u' : 'd'; }
      }
    }
  }
  function renderFeed() {
    const rows = feed.slice(0, 12);
    while (feedEl.children.length < rows.length) {
      const li = el('li', '', feedEl);
      el('span', 'w0', li); el('span', 's', li); el('span', 'a', li); el('span', 't0', li);
    }
    while (feedEl.children.length > rows.length) feedEl.lastChild.remove();
    rows.forEach((f, i) => {
      const li = feedEl.children[i];
      li.className = (f.side === 'buy' ? 'buy0' : 'sell0') + (f.kind === 'you' ? ' you' : f.kind === 'dev' ? ' dev' : '');
      li.children[0].textContent = f.who;
      li.children[1].textContent = f.verb;
      li.children[2].textContent = (f.sol >= 100 ? f.sol.toFixed(0) : f.sol >= 1 ? f.sol.toFixed(2) : f.sol.toFixed(3)) + ' SOL';
      const age = Math.max(0, clock - f.t);
      li.children[3].textContent = age < 60 ? Math.floor(age) + 's' : Math.floor(age / 60) + 'm';
      if (i) { li.style.opacity = ''; li.style.transform = ''; }
    });
  }
  function drawChart() {
    const g = gc, w = chart.width / dpr, h = chart.height / dpr;
    if (w < 10) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const list = candles.concat([cur]);
    const n = Math.min(list.length, Math.max(24, Math.floor(w / 7)));
    const vis = list.slice(-n);
    let lo = Infinity, hi = -Infinity;
    for (const c of vis) { lo = Math.min(lo, Math.exp(c.l)); hi = Math.max(hi, Math.exp(c.h)); }
    if (hi - lo < hi * 0.02) { hi *= 1.01; lo *= 0.99; }
    const pad = 10, Y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);
    g.strokeStyle = 'rgba(255,255,255,.05)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 4; i++) { const y = Math.round((h / 4) * i) + 0.5; g.moveTo(0, y); g.lineTo(w, y); }
    g.stroke();
    const cw = w / Math.max(n, 24);
    vis.forEach((c, i) => {
      const x = i * cw + cw / 2;
      const o = Math.exp(c.o), cl = Math.exp(c.c), up = cl >= o;
      g.strokeStyle = g.fillStyle = up ? C.green : C.red;
      g.beginPath(); g.moveTo(Math.round(x) + 0.5, Y(Math.exp(c.h))); g.lineTo(Math.round(x) + 0.5, Y(Math.exp(c.l))); g.stroke();
      const y0 = Y(Math.max(o, cl)), y1 = Y(Math.min(o, cl));
      g.fillRect(Math.round(x - cw * 0.34), y0, Math.max(1, Math.round(cw * 0.68)), Math.max(1, y1 - y0));
    });
    // last price
    const yl = Y(price());
    const crashed = phase !== 'pump' && phase !== 'out';
    g.strokeStyle = crashed ? C.red : C.green;
    g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(0, Math.round(yl) + 0.5); g.lineTo(w, Math.round(yl) + 0.5); g.stroke();
    g.setLineDash([]);
    if (crashed && clock - rugAt < 3) {
      g.font = '800 22px ' + SANS;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(242,59,76,' + clamp((clock - rugAt) / 0.2, 0, 1) + ')';
      g.save(); g.translate(w / 2, h / 2); g.rotate(-0.12);
      g.strokeStyle = C.red; g.lineWidth = 2.5;
      const t = 'RUG PULLED';
      const tw = g.measureText(t).width + 22;
      g.strokeRect(-tw / 2, -18, tw, 36);
      g.fillText(t, 0, 1);
      g.restore();
    }
  }

  // ---------------------------------------------------------------- the card
  function showCard() {
    if (phase !== 'rug') return;
    phase = 'card';
    cardAt = clock;
    drawCard();
    cardW.style.display = 'block';
  }
  const CW = 640, CH = 360;
  function drawCard(target) {
    const s = Math.min(1, (vw - 24) / CW);
    const k = target ? 2 : dpr;
    const c = target || card;
    c.width = CW * k; c.height = CH * k;
    if (!target) {
      c.style.width = CW * s + 'px'; c.style.height = CH * s + 'px';
      cardW.style.transform = `translate(-50%, -62%)`;
    }
    const g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, 0, 0);
    // background
    const bg = g.createLinearGradient(0, 0, CW, CH);
    bg.addColorStop(0, '#120d12'); bg.addColorStop(1, '#0a0d12');
    g.fillStyle = bg;
    if (g.roundRect) { g.beginPath(); g.roundRect(0, 0, CW, CH, 16); g.fill(); } else g.fillRect(0, 0, CW, CH);
    g.save();
    g.beginPath(); if (g.roundRect) g.roundRect(0, 0, CW, CH, 16); else g.rect(0, 0, CW, CH); g.clip();
    g.strokeStyle = 'rgba(255,255,255,.035)';
    g.lineWidth = 1;
    for (let x = 0; x < CW; x += 32) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, CH); g.stroke(); }
    for (let y = 0; y < CH; y += 32) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(CW, y + 0.5); g.stroke(); }
    // the price history: up, then off a cliff
    const hist = candles.concat([cur]).map((x) => x.c);
    const lo = Math.min(...hist), hi = Math.max(...hist);
    const X0 = 300, X1 = CW - 28, Y0 = 92, Y1 = 250;
    const px0 = (i) => X0 + (i / Math.max(1, hist.length - 1)) * (X1 - X0), py0 = (v) => Y1 - ((v - lo) / Math.max(1e-9, hi - lo)) * (Y1 - Y0);
    const iRug = clamp(candles.length - (candleN - rugN), 0, hist.length - 1);
    const area = g.createLinearGradient(0, Y0, 0, Y1);
    area.addColorStop(0, 'rgba(30,197,132,.28)'); area.addColorStop(1, 'rgba(30,197,132,0)');
    g.beginPath();
    hist.forEach((v, i) => (i ? g.lineTo(px0(i), py0(v)) : g.moveTo(px0(i), py0(v))));
    g.lineTo(px0(hist.length - 1), Y1); g.lineTo(px0(0), Y1); g.closePath();
    g.fillStyle = area; g.fill();
    g.lineWidth = 2.5; g.lineJoin = 'round';
    g.strokeStyle = C.green;
    g.beginPath();
    for (let i = 0; i <= Math.min(iRug, hist.length - 1); i++) (i ? g.lineTo(px0(i), py0(hist[i])) : g.moveTo(px0(i), py0(hist[i])));
    g.stroke();
    g.strokeStyle = C.red;
    g.beginPath();
    for (let i = iRug; i < hist.length; i++) (i > iRug ? g.lineTo(px0(i), py0(hist[i])) : g.moveTo(px0(i), py0(hist[i])));
    g.stroke();
    // the coin
    g.fillStyle = `hsl(${HUE} 90% 66%)`;
    g.beginPath(); g.arc(46, 50, 20, 0, TAU); g.fill();
    g.fillStyle = '#0b0e13';
    g.font = '800 18px ' + SANS;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(TICKER[0], 46, 51);
    g.textAlign = 'left';
    g.fillStyle = C.text;
    g.font = '900 30px ' + SANS;
    g.fillText(fitText(g, '$' + TICKER, 230), 76, 46);
    g.fillStyle = C.muted;
    g.font = '600 12px ' + SANS;
    g.fillText(fitText(g, host || NAME, 220), 77, 70);
    // the numbers
    const drop = (Math.exp(lp - ath) - 1) * 100;
    g.fillStyle = C.red;
    g.font = '900 64px ' + SANS;
    g.textBaseline = 'alphabetic';
    g.fillText(pct(drop), 26, 162);
    g.font = '700 14px ' + MONO;
    g.fillStyle = C.text;
    const lines = [
      ['ATH', money(Math.exp(ath) * SUPPLY) + ' \u2192 ' + money(mcap())],
      ['Holders', holders.toLocaleString('en-US') + ' left holding the bag'],
      ['You bought', youBuys ? youBuys + (youBuys === 1 ? ' time, ' : ' times, ') + youSol.toFixed(2) + ' SOL' : 'nothing. Smart.'],
      ['The dev', 'walked away with ' + devSol.toFixed(0) + ' SOL'],
    ];
    lines.forEach(([kk, vv], i) => {
      const y = 200 + i * 26;
      g.fillStyle = C.muted; g.font = '600 11px ' + SANS;
      g.fillText(kk.toUpperCase(), 28, y);
      g.fillStyle = C.text; g.font = '700 13.5px ' + MONO;
      g.fillText(fitText(g, vv, 300), 110, y);
    });
    // the stamp
    g.save();
    g.translate(470, 70);
    g.rotate(-0.16);
    g.strokeStyle = C.red; g.fillStyle = C.red; g.lineWidth = 3;
    g.font = '900 30px ' + SANS;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const sw = g.measureText('RUGGED').width + 30;
    g.strokeRect(-sw / 2, -24, sw, 48);
    g.strokeRect(-sw / 2 + 5, -19, sw - 10, 38);
    g.fillText('RUGGED', 0, 2);
    g.restore();
    // footer
    g.fillStyle = 'rgba(255,255,255,.07)';
    g.fillRect(0, CH - 40, CW, 40);
    g.font = '800 13px ' + SANS;
    g.fillStyle = C.text;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('RUGPULL', 26, CH - 20);
    g.font = '600 11.5px ' + SANS;
    g.fillStyle = C.muted;
    g.fillText('a parody: no coins, no wallets, nothing left the browser', 104, CH - 20);
    if (OPT.credit !== false) {
      g.textAlign = 'right';
      g.fillStyle = C.gold;
      g.font = '800 13px ' + SANS;
      g.fillText('@shmidtqq', CW - 24, CH - 20);
    }
    g.restore();
  }
  const fitText = (g, t, w) => {
    if (g.measureText(t).width <= w) return t;
    while (t.length > 1 && g.measureText(t + ELL).width > w) t = t.slice(0, -1);
    return t + ELL;
  };
  async function saveCard(download = true) {
    if (phase !== 'card' && phase !== 'rug') { toast('Pull the rug first (R)'); return null; }
    const c = D.createElement('canvas');
    drawCard(c);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    if (download && blob) {
      const a = D.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rugpull-' + TICKER.toLowerCase() + '.png';
      a.style.display = 'none';
      shadow.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Saved ' + a.download);
    }
    return { blob, width: c.width, height: c.height };
  }

  // ---------------------------------------------------------------- sound: a register, a sad trombone, a refund jingle
  let ac = null, muted = !OPT.sound;
  function audio() {
    if (muted) return null;
    try { ac = ac || new (W.AudioContext || W.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch (e) { return null; }
  }
  function tone(type, f0, f1, at, len, vol) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + len + 0.05);
  }
  const chime = () => { tone('sine', 1318, 1318, 0, 0.09, 0.05); tone('sine', 1976, 1976, 0.07, 0.16, 0.045); };
  const womp = () => { [392, 370, 349].forEach((f, i) => tone('triangle', f, f * 0.98, i * 0.32, 0.3, 0.09)); tone('triangle', 330, 262, 0.96, 1.1, 0.1); tone('sawtooth', 120, 38, 0, 1.2, 0.035); };
  const tada = () => { [523, 659, 784, 1046].forEach((f, i) => tone('sine', f, f, i * 0.07, 0.22, 0.045)); };

  // ---------------------------------------------------------------- flow
  let alive = true, phase = 'pump', clock = 0, raf = 0, last = 0;
  function esc() {
    if (!alive) return;
    if (phase === 'pump') { phase = 'out'; outT = 0; clearHighlights(); return; }
    if (phase === 'rug' || phase === 'card') refund();
  }
  function clearHighlights() { if (hasHL) { hlCrowd.clear(); hlYou.clear(); } }
  function teardown(keepHold) {
    if (!alive) return;
    alive = false;
    unbind();
    cancelAnimationFrame(raf);
    if (!keepHold) showPage();
    unadopt(D, BASE);
    if (hasHL) { CSS.highlights.delete('rugpull-crowd'); CSS.highlights.delete('rugpull-you'); }
    if (hostEl) hostEl.remove();
    hostEl = shadow = null;
    parts = []; backdrop = [];
    if (ac) { try { ac.close(); } catch (e) {} ac = null; }
    clearTimeout(toastT);
    if (W.__rugpull === api) delete W.__rugpull;
  }
  function loop(t) {
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    safe(dt);
    if (alive) raf = requestAnimationFrame(loop);
  }
  function safe(dt) { try { frame(dt); } catch (err) { showPage(); teardown(); throw err; } }
  function step(dt) { if (alive) safe(dt); }

  // ---------------------------------------------------------------- input
  const inUi = (e) => hostEl && e.composedPath && e.composedPath().indexOf(hostEl) >= 0;
  const passes = (e) => !!(e.target && e.target.closest && e.target.closest('[data-rugpull-ignore]'));
  const onClick = (e) => {
    if (!alive || inUi(e) || passes(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (phase === 'pump' && e.button === 0) buyWord(true, e.clientX, e.clientY);
  };
  const swallow = (e) => { if (alive && !inUi(e) && !passes(e)) { e.preventDefault(); e.stopPropagation(); } };
  const onKey = (e) => {
    if (!alive || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && e.key !== 'Escape') return;
    const k = e.key;
    let used = true;
    if (k === 'Escape') esc();
    else if (k === 'r' || k === 'R') rug();
    else if (k === 'b' || k === 'B') buyWord(true);
    else if (k === 's' || k === 'S') saveCard(true);
    else if (k === 'm' || k === 'M') { muted = !muted; toast(muted ? 'Sound off' : 'Sound on'); }
    else used = false;
    if (used) { e.preventDefault(); e.stopPropagation(); }
  };
  const onResize = () => resize();
  function bind() {
    W.addEventListener('click', onClick, true);
    W.addEventListener('mousedown', swallow, true);
    W.addEventListener('mouseup', swallow, true);
    W.addEventListener('auxclick', swallow, true);
    W.addEventListener('keydown', onKey, true);
    W.addEventListener('resize', onResize);
  }
  function unbind() {
    W.removeEventListener('click', onClick, true);
    W.removeEventListener('mousedown', swallow, true);
    W.removeEventListener('mouseup', swallow, true);
    W.removeEventListener('auxclick', swallow, true);
    W.removeEventListener('keydown', onKey, true);
    W.removeEventListener('resize', onResize);
  }

  const api = {
    version: VERSION,
    get alive() { return alive; },
    toggle: esc,
    stop: () => { showPage(); teardown(); },
    rug,
    buy: (x, y) => buyWord(true, x, y),
    save: (download) => saveCard(download),
    step,
    state: () => ({
      phase, ticker: TICKER, price: price(), marketCap: mcap(), athMarketCap: Math.exp(ath) * SUPPLY, holders, curve,
      you: youBuys, crowd: crowdWords, trades, particles: parts.length, settled: settledN,
    }),
  };
  W.__rugpull = api;
  build();
  bind();
  for (let i = 0; i < 18; i++) market(CANDLE);   // a short history before you arrived
  for (let i = 0; i < 4; i++) trade(buyer(), 'buy', Math.exp(gauss()) * 0.5);
  feed.forEach((f, i) => { f.t = -i * 2 - 1; });
  if (!MANUAL) { last = now(); raf = requestAnimationFrame(loop); }
  else paint(0), paintPanel(0);
})();
