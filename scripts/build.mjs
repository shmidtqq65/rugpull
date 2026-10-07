// Build: minify src/rugpull.js, write the bookmarklet, sync the extension and the userscript.
// Usage: npm install && npm run build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'src/rugpull.js'), 'utf8');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = (src.match(/const VERSION = '([^']+)'/) || [])[1];
if (version !== pkg.version) throw new Error(`version mismatch: src ${version} vs package.json ${pkg.version}`);

// Keep the source ASCII: a non-ASCII character costs 6 to 9 characters in the bookmarklet (%C3%97),
// so src/rugpull.js writes them as \u escapes.
if (/[^\x00-\x7f]/.test(src)) throw new Error('non-ASCII character in src/rugpull.js: ' + src.match(/[^\x00-\x7f]/)[0]);

const out = await minify(src, {
  ecma: 2020,
  compress: { passes: 3, unsafe_arrows: true, pure_getters: true },
  format: { quote_style: 1, comments: false, ascii_only: true },
});
const min = out.code.trim();
const banner = `/*! RUGPULL v${version} | Every website is a memecoin now. A parody: no coins, nothing leaves your browser | MIT | github.com/shmidtqq65/rugpull */`;
writeFileSync(resolve(root, 'rugpull.min.js'), banner + '\n' + min + '\n');

// Bookmarklet: the whole engine inline, so it also runs on sites with a strict Content-Security-Policy.
// Encode only what a javascript: URL can't carry as-is (%, #, control and non-ASCII characters).
const encode = (s) => s.replace(/[%#\u0000-\u001f\u007f-\u{10FFFF}]/gu, (c) => encodeURIComponent(c));
const bookmarklet = 'javascript:' + encode(`/*rugpull v${version}*/` + min);
// Firefox silently truncates bookmark URLs longer than 65,536 characters (bugzilla 604374).
if (bookmarklet.length > 64500) throw new Error(`bookmarklet too long for Firefox: ${bookmarklet.length} chars`);
writeFileSync(resolve(root, 'bookmarklet.txt'), bookmarklet + '\n');

// The extension ships its own copy (Manifest V3 forbids remote code).
mkdirSync(resolve(root, 'extension'), { recursive: true });
writeFileSync(resolve(root, 'extension/rugpull.js'), banner + '\n' + min + '\n');
const manifestPath = resolve(root, 'extension/manifest.json');
const mf = JSON.parse(readFileSync(manifestPath, 'utf8'));
mf.version = version;
writeFileSync(manifestPath, JSON.stringify(mf, null, 2) + '\n');

// Userscript: Alt+Shift+R launches the page as a coin; Esc refunds and puts the page back.
const raw = 'https://raw.githubusercontent.com/shmidtqq65/rugpull/main/userscript/rugpull.user.js';
const us = `// ==UserScript==
// @name         RUGPULL
// @namespace    https://github.com/shmidtqq65/rugpull
// @version      ${version}
// @description  Every website is a memecoin now. Alt+Shift+R launches the page as a coin, R pulls the rug, Esc refunds. A parody: nothing leaves your browser.
// @author       shmidtqq
// @license      MIT
// @homepageURL  https://github.com/shmidtqq65/rugpull
// @downloadURL  ${raw}
// @updateURL    ${raw}
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==
(function () {
  'use strict';
  function run() {
${min}
  }
  window.addEventListener('keydown', function (e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || e.repeat || e.code !== 'KeyR') return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    run();
  }, true);
})();
`;
mkdirSync(resolve(root, 'userscript'), { recursive: true });
writeFileSync(resolve(root, 'userscript/rugpull.user.js'), us);

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`rugpull.min.js ${kb(Buffer.byteLength(min))}, bookmarklet ${bookmarklet.length} chars (Firefox limit 65,536), v${version}`);
