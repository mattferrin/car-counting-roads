/* Cancellation Quest — map-layout tests.
 * Run:  NODE_PATH=~/workspace/cancellation-quest/node_modules node test/cancellation-map.test.cjs
 *
 * The landmarks are pins on a map now, not a staggered row: the four
 * positions must span at least three x-quartiles and both y-halves of
 * the taller map area, in both themes. And the re-layout must not
 * change the mechanics: tapping a landmark still cancels there — the
 * flight code reads each landmark's rect at tap time, so it is
 * position-agnostic. Also the nav (test banner, back-home nav, footer)
 * is the same as on every other test page.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};

/* ---------- map spread, read from the stylesheet ---------- */
const CSS = fs.readFileSync(path.join(__dirname,'cancellation-quest.css'),'utf8');
{
  const posRe = /\.landmark\.pos-(\d)\s*\{[^}]*?left:\s*([\d.]+)%[^}]*?top:\s*([\d.]+)px[^}]*\}/g;
  const positions = [];
  let m;
  while ((m = posRe.exec(CSS))) positions.push({ n: +m[1], left: +m[2], top: +m[3] });
  assert.equal(positions.length, 4, 'four landmark positions declared');
  const mapH = /\.landscape\s*\{[^}]*?min-height:\s*([\d.]+)px/.exec(CSS);
  assert(mapH, 'landscape min-height declared');
  const H = +mapH[1];
  assert(H >= 280, `map area is tall (${H}px), not a thin strip`);
  const xQs = new Set(positions.map(p => Math.min(3, Math.floor(p.left / 25))));
  const yHs = new Set(positions.map(p => ((p.top + 56) / H) < 0.5 ? 0 : 1));
  assert(xQs.size >= 3, `landmarks span ${xQs.size} x-quartiles, expected >= 3`);
  assert(yHs.size >= 2, 'landmarks span both y-halves');
  // No two landmarks share the same x-band AND y-band.
  const bands = new Set(positions.map(p =>
    `${Math.min(3, Math.floor(p.left / 25))},${((p.top + 56) / H) < 0.5 ? 0 : 1}`));
  assert.equal(bands.size, 4, 'all four landmarks sit in distinct map bands');
}

/* ---------- jsdom boot (same harness as the UI suite) ---------- */
function boot(a, b, theme) {
  const q = `?a=${a}&b=${b}` + (theme ? `&theme=${theme}` : '');
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname,'cancellation-quest.html'),'utf8'),
    { url: `https://example.org/${q}`, runScripts: 'outside-only' });
  const w = dom.window, pending = [], watchdogs = [];
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.animate = function () { return { finished: Promise.resolve() }; };
  const timer = w.setTimeout.bind(w);
  w.setTimeout = (f, ms) => ms === 8000 ? (watchdogs.push(f), 0) : timer(f, ms);
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  w.speechSynthesis = { getVoices: () => [], cancel: () => { pending.length = 0; },
    speak: u => { pending.push(u); u.onstart && u.onstart(); } };
  for (const name of ['cancellation-engine.js','cancellation-layout.js','cancellation-quest.js']) {
    w.eval(fs.readFileSync(path.join(__dirname,name),'utf8'));
  }
  return { w, pending, watchdogs, close: () => dom.window.close() };
}
async function settle(t, errors = false) {
  for (let i = 0; i < 40 && !['ready','complete'].includes(t.w.document.body.dataset.phase); i++) {
    await flush(); const u = t.pending.shift(); if (u) (errors ? u.onerror : u.onend)();
  }
  await flush();
  assert(['ready','complete'].includes(t.w.document.body.dataset.phase));
}

(async () => {
  let checks = 0;
  // Four landmarks render in both themes, with the same art/names as
  // before — only the positions changed.
  for (const [theme, names] of [
    ['cars', ['Volcano','Castle','Magic Tree','Car Wash']],
    ['mermaids', ['Coral Reef','Palace','Whirlpool','Giant Shell']],
  ]) {
    const t = boot(78, 35, theme), d = t.w.document;
    await settle(t);
    const lms = [...d.querySelectorAll('.landmark')];
    assert.equal(lms.length, 4, `${theme}: four landmarks render`);
    assert.deepEqual(lms.map(b => b.querySelector('.name').textContent), names);
    // Navigation, same as every other test page.
    assert(d.querySelector('nav[aria-label="Test version"] a[href="../"]').textContent.includes('Play the stable games'));
    assert.equal(d.querySelector('.game-nav a[href="index.html"]').textContent, '← Back to test games');
    assert.equal(d.querySelector('.foot a[href="index.html"]').textContent, '← Back to test games');
    assert.equal(d.querySelector('.foot a[href="../"]').textContent, 'Stable games');
    assert.equal(d.querySelectorAll('.eqbar .theme-pill').length, 2);
    assert(d.querySelector('.eqbar #sound-toggle'), 'sound toggle in the equation bar');
    t.close(); checks++;
  }
  // Mechanics untouched: tapping a landmark still cancels a ten from
  // each side (78-35 -> 68+25), in the new map layout.
  {
    const t = boot(78, 35), d = t.w.document;
    await settle(t);
    const volc = d.querySelector('[data-landmark="volcano"]');
    assert(volc, 'Volcano landmark exists');
    volc.click();
    await settle(t);
    assert.equal(+d.querySelector('#left-num').textContent, 68);
    assert.equal(+d.querySelector('#right-num').textContent, 25);
    assert.equal(d.querySelectorAll('#left-grid .obj').length, 68);
    assert.equal(d.querySelectorAll('#right-grid .obj').length, 25);
    // A second move via a different landmark keeps cancelling.
    d.querySelector('[data-landmark="castle"]').click();
    await settle(t);
    assert.equal(+d.querySelector('#left-num').textContent, 58);
    assert.equal(+d.querySelector('#right-num').textContent, 15);
    t.close(); checks++;
  }
  console.log(`Map: ${checks} cases passed; landmarks spread across the map in both themes, nav matches the other test pages, and tapping a landmark still cancels (mechanics untouched).`);
})().catch(e => { console.error(e); process.exitCode = 1; });
