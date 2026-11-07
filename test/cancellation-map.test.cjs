/* Cancellation Quest — map-layout tests.
 * Run:  NODE_PATH=~/workspace/cancellation-quest/node_modules node test/cancellation-map.test.cjs
 *
 * The landmarks are pins on a map now, not a staggered row: they circle
 * the page in three strips — one above the equation bar (sky), one
 * above the panels (mid), two below the panels (ground) — spanning at
 * least three x-quartiles and three vertical zones. And the re-layout
 * must not change the mechanics: tapping a landmark still cancels there
 * — the flight code reads each landmark's rect at tap time, so it is
 * position-agnostic. Also the nav (test banner, back-home nav, footer)
 * is the same as on every other test page, and the celebration banner
 * sits directly under the equation bar with the only New Mystery button.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};

/* ---------- map spread, read from the stylesheet ---------- */
const CSS = fs.readFileSync(path.join(__dirname,'cancellation-quest.css'),'utf8');
{
  // One position rule per landmark, scoped to its strip: sky 1, mid 1,
  // ground 2 — genuinely spread across the page, not a row, not one band.
  const posRe = /\.(sky-strip|mid-strip|ground-strip)\s+\.landmark(?:\.pos-(\d))?\s*\{[^}]*?left:\s*([\d.]+)%[^}]*?top:\s*([\d.]+)px[^}]*\}/g;
  const positions = [];
  let m;
  while ((m = posRe.exec(CSS))) positions.push({ strip: m[1], pos: m[2] ? +m[2] : null, left: +m[3], top: +m[4] });
  assert.equal(positions.length, 4, 'four landmark positions declared');
  assert.equal(positions.filter(p => p.strip === 'sky-strip').length, 1, 'one landmark in the sky strip');
  assert.equal(positions.filter(p => p.strip === 'mid-strip').length, 1, 'one landmark in the mid strip');
  assert.equal(positions.filter(p => p.strip === 'ground-strip').length, 2, 'two landmarks on the ground');
  const xQs = new Set(positions.map(p => Math.min(3, Math.floor(p.left / 25))));
  assert(xQs.size >= 3, `landmarks span ${xQs.size} x-quartiles, expected >= 3`);
  const groundH = /\.ground-strip\s*\{[^}]*?min-height:\s*([\d.]+)px/.exec(CSS);
  assert(groundH && +groundH[1] >= 220, `ground strip is tall (${groundH && groundH[1]}px), room for a staggered pair`);
  // No two landmarks share the same x-band AND strip.
  const bands = new Set(positions.map(p =>
    `${Math.min(3, Math.floor(p.left / 25))},${p.strip}`));
  assert.equal(bands.size, 4, 'all four landmarks sit in distinct strip/x-band combinations');
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
  // before — only the positions changed — one per strip up top, two on
  // the ground, in page order sky, mid, ground.
  for (const [theme, names] of [
    ['cars', ['Castle','Magic Tree','Volcano','Car Wash']],
    ['mermaids', ['Palace','Whirlpool','Coral Reef','Giant Shell']],
  ]) {
    const t = boot(78, 35, theme), d = t.w.document;
    await settle(t);
    const lms = [...d.querySelectorAll('.landmark')];
    assert.equal(lms.length, 4, `${theme}: four landmarks render`);
    assert.deepEqual(lms.map(b => b.querySelector('.name').textContent), names);
    assert.equal(d.querySelectorAll('#sky .landmark').length, 1, `${theme}: one landmark above the equation bar`);
    assert.equal(d.querySelectorAll('#mid-map .landmark').length, 1, `${theme}: one landmark above the panels`);
    assert.equal(d.querySelectorAll('#ground-map .landmark').length, 2, `${theme}: two landmarks below the panels`);
    // DOM order: sky, equation bar, mid, panels, ground, captions.
    const order = Array.from(d.querySelectorAll('#sky, .eqbar, #mid-map, .quantities, #ground-map, .caption-bar'))
      .map(n => n.id === 'sky' ? 'sky' : n.id === 'mid-map' ? 'mid-map' : n.id === 'ground-map' ? 'ground-map'
        : n.id === 'captions' ? 'caption-bar' : n.classList.contains('eqbar') ? 'eqbar' : 'quantities');
    assert.deepEqual(order, ['sky', 'eqbar', 'mid-map', 'quantities', 'ground-map', 'caption-bar'],
      `${theme}: strips circle the page in order`);
    // Celebration banner: directly under the equation bar, the only
    // New Mystery button, hidden until solved.
    assert(d.querySelector('.eqbar + #celebrate-banner'), 'celebration banner directly under the equation bar');
    assert.equal(d.querySelectorAll('#new-mystery').length, 1, 'exactly one New Mystery button');
    assert(!d.querySelector('.celebrate'), 'old bottom celebrate div removed');
    assert(d.querySelector('#celebrate-banner').hidden, 'banner hidden before completion');
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
  console.log(`Map: ${checks} cases passed; landmarks circle the page in three strips in both themes, banner sits under the equation bar, nav matches the other test pages, and tapping a landmark still cancels (mechanics untouched).`);
})().catch(e => { console.error(e); process.exitCode = 1; });
