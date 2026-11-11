/* NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-flight.test.cjs
 * Flight-to-button tests: the matching objects highlight in place, then the
 * REAL objects lift off together — one whole group per side — and fly down
 * to the landmark the kid tapped, arriving together to burst there. Only
 * then do the survivors slide up together. jsdom gives every rect as zero,
 * so this proves grouping, identity, simultaneity and counts; the real
 * geometry (rows airborne together, heading for the button) needs the live
 * browser check after deploy.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const E = require('./cancellation-engine');
const flush = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };

function boot(a, b) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'cancellation-quest.html'), 'utf8'),
    { url: `https://example.org/?a=${a}&b=${b}`, runScripts: 'outside-only' });
  const w = dom.window, pending = [], watchdogs = [], anims = [];
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  w.matchMedia = () => ({ matches: true });
  // Controllable animations: every animate() call records its element and
  // waits until the test resolves it, so mid-flight state is observable.
  w.HTMLElement.prototype.animate = function (keyframes) {
    const rec = { el: this, keyframes };
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

function drainSpeech(t) {
  let u;
  while ((u = t.pending.shift())) { if (u.onend) u.onend(); }
}
function resolveAnims(t, pred) {
  for (let i = t.anims.length - 1; i >= 0; i--) {
    if (!pred || pred(t.anims[i])) { t.anims[i].resolve(); t.anims.splice(i, 1); }
  }
}
async function settle(t) {
  for (let i = 0; i < 60 && !['ready', 'complete'].includes(t.w.document.body.dataset.phase); i++) {
    await flush(); drainSpeech(t); resolveAnims(t);
  }
  await flush();
  assert(['ready', 'complete'].includes(t.w.document.body.dataset.phase));
}
const ids = (t, side) => [...t.w.document.querySelectorAll('#' + side + '-grid .obj')].map(n => Number(n.dataset.id));
const flying = t => [...t.w.document.querySelectorAll('.flying')];

async function playOneMove(t, a, b, moveIndex) {
  const sol = E.solve(a, b);
  const amount = sol.moves[moveIndex];
  const d = t.w.document;
  const preLeft = ids(t, 'left'), preRight = ids(t, 'right');
  const expected = amount === 1
    ? { left: preLeft.slice(-1), right: preRight.slice(-1) }
    : { left: preLeft.slice(0, amount), right: preRight.slice(0, amount) };
  d.querySelector('.landmark').click();
  await flush(); drainSpeech(t); await flush();
  assert.equal(d.body.dataset.phase, 'moving');
  // Both groups are airborne at the same time, carrying the real nodes.
  const wraps = flying(t);
  assert.equal(wraps.length, 2, 'one flying group per side');
  for (const [i, side] of ['left', 'right'].entries()) {
    const nodes = [...wraps[i].querySelectorAll('.obj')];
    assert.equal(nodes.length, amount, side + ' group size');
    assert.deepEqual(nodes.map(n => Number(n.dataset.id)), expected[side], side + ' group is the picked objects');
  }
  // Both flights started before either finished: simultaneity, not stagger.
  const flightAnims = t.anims.filter(r => r.el.classList.contains('flying'));
  assert.equal(flightAnims.length, 2, 'both flights started together');
  // Nothing is cancelled yet mid-flight: survivors + flyers still add up.
  assert.equal(ids(t, 'left').length + wraps[0].querySelectorAll('.obj').length, sol.states[moveIndex].left);
  // Let both flights land together, then let the survivors slide up.
  const burstsBefore = d.querySelectorAll('.burst').length;
  resolveAnims(t, r => r.el.classList.contains('flying'));
  await flush();
  assert.equal(flying(t).length, 0, 'wrappers removed after landing');
  // The collision fires at the pressed button: burst spans for every move,
  // and the landmark thump for big moves (ones keep the small burst only).
  assert.equal(d.querySelectorAll('.burst').length, burstsBefore + 14, 'burst fires at the pressed button');
  if (amount >= 10) assert(d.querySelector('.landmark.boom'), 'landmark thumps at the collision');
  resolveAnims(t); await flush(); drainSpeech(t);
  await settle(t);
  const st = sol.states[moveIndex + 1];
  assert.equal(+d.querySelector('#left-num').textContent, st.left);
  assert.equal(+d.querySelector('#right-num').textContent, st.right);
  assert.deepEqual(ids(t, 'left'), preLeft.filter(id => !expected.left.includes(id)), 'left survivors keep identity');
  assert.deepEqual(ids(t, 'right'), preRight.filter(id => !expected.right.includes(id)), 'right survivors keep identity');
  return st;
}

(async () => {
  let checks = 0;
  // Ten-move: 78-35, first move cancels one whole row of 10 per side.
  let t = boot(78, 35);
  await settle(t);
  await playOneMove(t, 78, 35, 0); checks++;
  t.close();
  // One-move: 9-5, a single object per side flies to the button.
  t = boot(9, 5);
  await settle(t);
  await playOneMove(t, 9, 5, 0); checks++;
  t.close();
  // Hundred-move: 100-100 solves in one move, 100 objects per side.
  t = boot(100, 100);
  await settle(t);
  await playOneMove(t, 100, 100, 0); checks++;
  assert.equal(t.w.document.querySelector('#eq-q').textContent, '0');
  assert.equal(t.w.document.body.dataset.phase, 'complete');
  t.close();
  console.log(`Flight: ${checks} moves passed; whole groups fly together to the pressed button, burst there, survivors keep identity.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
