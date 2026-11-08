const {assertNavigation}=require('./ui-contracts.cjs');
/* Cancellation Quest — map-layout tests.
 * Run:  NODE_PATH=~/workspace/cancellation-quest/node_modules node test/cancellation-map.test.cjs
 *
 * The landmarks sit in two compact strips hugging the panels — four
 * above, four below, 8 total per theme — as tight as possible, not
 * scattered around the page and not one band. And the re-layout must
 * not change the mechanics: tapping a landmark still cancels there —
 * the flight code reads each landmark's rect at tap time, so it is
 * position-agnostic. Also the nav (test banner, footer back-home link)
 * is the same as on every other test page, and the celebration banner
 * sits directly under the equation bar with the only New Mystery button.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};

/* ---------- map layout, read from the stylesheet ---------- */
const CSS = fs.readFileSync(path.join(__dirname,'cancellation-quest.css'),'utf8')
  // Strip comments first: a comment mentioning a strip must not count.
  .replace(/\/\*[\s\S]*?\*\//g, '');
{
  // Two flex-row strips, one above and one below the panels — four
  // landmarks each, sharing the width. No sky/mid/ground strip rules.
  const stripRe = /\.(above-strip|below-strip)\s*\{[^}]*?background:/g;
  const strips = new Set();
  let m;
  while ((m = stripRe.exec(CSS))) strips.add(m[1]);
  assert.deepEqual([...strips].sort(), ['above-strip', 'below-strip'], 'exactly two landmark strips');
  assert(!/\.sky-strip|\.mid-strip|\.ground-strip|\.map-strip/.test(CSS), 'no sky/mid/ground/map strip rules survive');
  assert(!/\.game-nav\s*\{/.test(CSS), 'no top game-nav rule survives');
  const stripFlex = /\.landmark-strip\s*\{[^}]*?display:\s*flex[^}]*?gap:\s*([\d.]+)px[^}]*?padding:\s*([\d.]+)px/.exec(CSS);
  assert(stripFlex, 'landmark strip is a flex row with a gap and padding');
  const gap = +stripFlex[1], pad = +stripFlex[2];
  // iPhone portrait: content width = 390 - 2*12 page padding.
  const cardW = (390 - 24 - 2 * pad - 3 * gap) / 4;
  assert(cardW >= 80, `four cards fit at iPhone portrait: ${cardW.toFixed(1)}px each`);
  // Strip height bound, from the stylesheet: art + up to two lines of
  // name + up to two lines of hint + card gaps/padding + strip padding.
  const art = +/\.landmark \.art\s*\{[^}]*?font-size:\s*([\d.]+)px/.exec(CSS)[1];
  const name = +/\.landmark \.name\s*\{[^}]*?font-size:\s*([\d.]+)px/.exec(CSS)[1];
  const hint = +/\.landmark \.hint\s*\{[^}]*?font-size:\s*([\d.]+)px/.exec(CSS)[1];
  const stripH = 2 * pad + (5 + 6) + art + 2 * 1 + 2 * (name * 1.15) + 2 * (hint * 1.1);
  assert(stripH <= 120, `each strip stays short: ~${stripH.toFixed(0)}px tall`);
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
  // Eight landmarks render in both themes, with the same art/names as
  // before for the original four plus four new ones — four above the
  // panels, four below, in page order above, panels, below.
  for (const [theme, names] of [
    ['cars', ['Castle','Magic Tree','Sunny Hill','Race Track','Volcano','Car Wash','Gas Station','Bridge']],
    ['mermaids', ['Palace','Whirlpool','Turtle Rock','Dolphin Cove','Coral Reef','Giant Shell','Shipwreck','Treasure Chest']],
  ]) {
    const t = boot(78, 35, theme), d = t.w.document;
    await settle(t);
    const lms = [...d.querySelectorAll('.landmark')];
    assert.equal(lms.length, 8, `${theme}: eight landmarks render`);
    assert.deepEqual(lms.map(b => b.querySelector('.name').textContent), names);
    assert.equal(d.querySelectorAll('#landmarks-above .landmark').length, 4, `${theme}: four landmarks above the panels`);
    assert.equal(d.querySelectorAll('#landmarks-below .landmark').length, 4, `${theme}: four landmarks below the panels`);
    assert(!d.querySelector('#sky, #mid-map, #ground-map, .map-strip, .game-nav'),
      `${theme}: no sky/mid/ground strip and no top game-nav`);
    // DOM order: equation bar, banner, above strip, panels, below
    // strip, captions — the strips hug the panels.
    const order = Array.from(d.querySelectorAll('.eqbar, #celebrate-banner, #landmarks-above, .quantities, #landmarks-below, .caption-bar'))
      .map(n => n.id === 'landmarks-above' ? 'above' : n.id === 'landmarks-below' ? 'below'
        : n.id === 'celebrate-banner' ? 'banner' : n.id === 'captions' ? 'caption-bar'
        : n.classList.contains('eqbar') ? 'eqbar' : 'quantities');
    assert.deepEqual(order, ['eqbar', 'banner', 'above', 'quantities', 'below', 'caption-bar'],
      `${theme}: strips hug the panels in order`);
    // Celebration banner: directly under the equation bar, the only
    // New Mystery button, hidden until solved.
    assert(d.querySelector('.eqbar + #celebrate-banner'), 'celebration banner directly under the equation bar');
    assert.equal(d.querySelectorAll('#new-mystery').length, 1, 'exactly one New Mystery button');
    assert(!d.querySelector('.celebrate'), 'old bottom celebrate div removed');
    assert(d.querySelector('#celebrate-banner').hidden, 'banner hidden before completion');
    assertNavigation(d);
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
  console.log(`Map: ${checks} cases passed; eight landmarks in two compact strips hugging the panels in both themes, banner sits under the equation bar, nav matches the other test pages, and tapping a landmark still cancels (mechanics untouched).`);
})().catch(e => { console.error(e); process.exitCode = 1; });
