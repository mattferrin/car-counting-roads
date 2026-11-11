/* NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-highlight.test.cjs
 * Per-fragment highlights: when the voice says "two tens" the two tens
 * themselves glow; "seven ones" glows the seven ones. The answer is
 * highlighted whole first, then its tens, then its ones — never ones
 * before tens. Mermaid objects are the shared mermaid SVG symbols
 * (viewBox 460x266), not emoji: the theme buttons show the same Classic E
 * icons (the shared mermaid asset on Aliya's, car symbol on Ayan's), not emoji.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };

function boot(query) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'cancellation-quest.html'), 'utf8'),
    { url: `https://example.org/?${query}`, runScripts: 'outside-only' });
  const w = dom.window, pending = [], watchdogs = [], anims = [];
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.animate = function () {
    const rec = { el: this };
    rec.finished = new Promise(function (res) { rec.resolve = res; });
    anims.push(rec);
    return rec;
  };
  const timer = w.setTimeout.bind(w);
  w.setTimeout = (f, ms) => ms === 8000 ? (watchdogs.push(f), 0) : timer(f, ms);
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  w.speechSynthesis = { getVoices: () => [], cancel: () => { pending.length = 0; }, speak: u => { pending.push(u); u.onstart && u.onstart(); } };
  for (const name of ['cancellation-engine.js', 'cancellation-layout.js', 'theme-switch.js', 'cancellation-quest.js'])
    w.eval(fs.readFileSync(path.join(__dirname, name), 'utf8'));
  return { w, pending, watchdogs, anims, close: () => dom.window.close() };
}
function resolveAnims(t, pred) {
  for (let i = t.anims.length - 1; i >= 0; i--) {
    if (!pred || pred(t.anims[i])) { t.anims[i].resolve(); t.anims.splice(i, 1); }
  }
}
async function settle(t) {
  for (let i = 0; i < 80 && !['ready', 'complete'].includes(t.w.document.body.dataset.phase); i++) {
    await flush();
    const u = t.pending.shift(); if (u && u.onend) u.onend();
    resolveAnims(t);
  }
  await flush();
  assert(['ready', 'complete'].includes(t.w.document.body.dataset.phase));
}
// Fire the next spoken fragment and return its words.
function fireNext(t) {
  const u = t.pending.shift();
  assert(u, 'expected a spoken fragment to be playing');
  if (u.onend) u.onend();
  return u.text;
}
const speakingObjs = (t, side) => t.w.document.querySelectorAll('#' + side + '-grid .obj.speaking').length;

// Play one full move (tap through to ready/complete), without asserting
// the fragments in between.
async function playMove(t) {
  t.w.document.querySelector('.landmark').click();
  for (let i = 0; i < 120 && !['ready', 'complete'].includes(t.w.document.body.dataset.phase); i++) {
    await flush();
    const u = t.pending.shift(); if (u && u.onend) u.onend();
    resolveAnims(t);
  }
  await flush();
  assert(['ready', 'complete'].includes(t.w.document.body.dataset.phase));
}

(async () => {
  let checks = 0;
  // 1. After a ten-move on 78-35, "six tens" glows the six tens (60 cars)
  //    and "two tens" glows the two tens (20 cars) — objects, not digits.
  let t = boot('a=78&b=35');
  await settle(t);
  let d = t.w.document;
  d.querySelector('.landmark').click();
  await flush();
  assert.equal(d.body.dataset.phase, 'moving');
  resolveAnims(t, r => r.el.classList.contains('flying'));
  await flush(); resolveAnims(t); await flush(); // survivors slide up, counts start
  assert.equal(t.pending[0] && t.pending[0].text, 'six tens');
  assert(d.querySelector('#left-num .d-tens.speaking'), 'six-tens digit glows');
  assert.equal(speakingObjs(t, 'left'), 60, '"six tens" glows 60 blue cars');
  assert.equal(speakingObjs(t, 'right'), 0, 'other side stays dark');
  fireNext(t); await flush();
  assert.equal(t.pending[0] && t.pending[0].text, 'two tens');
  assert(d.querySelector('#right-num .d-tens.speaking'), 'two-tens digit glows');
  assert.equal(speakingObjs(t, 'right'), 20, '"two tens" glows 20 gold cars');
  assert.equal(speakingObjs(t, 'left'), 0, 'previous side clears');
  fireNext(t); await settle(t);
  assert.equal(d.querySelector('#left-num').textContent, '68');
  assert.equal(d.querySelector('#right-num').textContent, '25');
  checks++;
  t.close();

  // 2. The answer is highlighted whole first, then its tens, then its
  //    ones — never the ones place before the tens place. (9-5 = 4.)
  t = boot('a=9&b=5');
  await settle(t);
  d = t.w.document;
  for (let i = 0; i < 4; i++) await playMove(t);
  d.querySelector('.landmark').click(); // fifth one-move solves it
  await flush();
  resolveAnims(t, r => r.el.classList.contains('flying'));
  await flush(); resolveAnims(t); await flush(); // flyer to the "?" spot
  resolveAnims(t); await flush();
  assert.equal(t.pending[0] && t.pending[0].text, 'The answer is');
  assert(d.querySelector('#eq-q.speaking'), 'whole answer glows first');
  assert.equal(d.querySelectorAll('#eq-q .speaking').length, 0, 'no single digit glows yet');
  assert.equal(speakingObjs(t, 'left'), 4, 'whole answer glows: all 4 cars left');
  fireNext(t); await flush();
  assert.equal(t.pending[0] && t.pending[0].text, 'four ones');
  assert(d.querySelector('#eq-q .d-ones.speaking'), 'then the ones digit glows');
  assert(!d.querySelector('#eq-q.speaking'), 'whole-answer glow clears');
  assert.equal(speakingObjs(t, 'left'), 4, '"four ones" glows the 4 cars');
  fireNext(t); await settle(t);
  assert.equal(d.querySelector('#eq-q').textContent, '4');
  assert.equal(d.body.dataset.phase, 'complete');
  checks++;
  t.close();

  // 3. Mermaids use the shared Classic E symbols, cars are still SVG cars; the
  //    theme buttons show the new mermaid icons, not emoji.
  t = boot('theme=mermaids&a=84&b=27');
  await settle(t);
  d = t.w.document;
  const aliyaBtn = d.querySelector('.theme-pill[data-theme="mermaids"]');
  const aliyaImage = aliyaBtn.querySelector('img');
  assert(aliyaImage && aliyaImage.getAttribute('src') === 'art/classic-e-mermaid.png?v=1', 'Aliya theme button shows Classic E, the production mermaid');
  assert(!/🧜/.test(aliyaBtn.textContent), 'no mermaid emoji on the theme button');
  const ayanBtn = d.querySelector('.theme-pill[data-theme="cars"]');
  const ayanUse = ayanBtn.querySelector('svg use');
  assert(ayanUse && ayanUse.getAttribute('href') === '#car-gold', 'Ayan theme button shows the gold camper van (single-vehicle default)');
  assert(!/🚗/.test(ayanBtn.textContent), 'no car emoji on the theme button');
  const mermaids = [...d.querySelectorAll('#left-grid .obj, #right-grid .obj')];
  assert(mermaids.length > 0);
  assert(mermaids.every(n => !n.classList.contains('emoji') && n.textContent === ''), 'no emoji mermaid objects');
  assert(mermaids.every(n => {
    const svg = n.querySelector('svg');
    const use = svg && svg.querySelector('use');
    return svg && svg.getAttribute('viewBox') === '0 0 460 266' &&
      use && (use.getAttribute('href') === '#mermaid-teal' || use.getAttribute('href') === '#mermaid-pink');
  }), 'every mermaid is the shared Classic E symbol (460x266, teal/pink)');
  t.close();
  t = boot('a=84&b=27');
  await settle(t);
  d = t.w.document;
  const cars = [...d.querySelectorAll('#left-grid .obj, #right-grid .obj')];
  assert(cars.length > 0);
  assert(cars.every(n => n.querySelector('svg') && n.textContent === ''), 'cars are still SVG cars');
  t.close();

  console.log(`Highlight: ${checks} fragment cases + mermaid asset checks passed; spoken places glow their objects, answer glows whole then tens then ones.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
