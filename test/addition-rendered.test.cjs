/* Addition Quest — rendered-count, CSS-transform-audit and flight tests.
 * Run:  NODE_PATH=~/workspace/cancellation-quest/node_modules node addition-rendered.test.cjs
 *
 * Three things the other suites cannot see (jsdom runs no CSS animations
 * and measures no real layout):
 *  1. Rendered counts: at every state of full playthroughs, each grid
 *     must contain exactly as many .obj nodes as its labelled count, and
 *     the DOM slots must equal the layout plan's slots, with no two
 *     objects sharing a square.
 *  2. Bottom-anchored ones: the ones row sits at y = R-1 (R =
 *     floor(total/10)+1) in BOTH pools at every state, so a one-move
 *     starts and ends on the same bottom row.
 *  3. CSS audit: no transform-animating keyframes may apply to .obj.
 *     (Regression test for the 2026-11-06 live defect: the `nudge`
 *     keyframes animate `transform` and were applied to `.obj.movable`.
 *     A CSS animation overrides the inline translate() that positions
 *     each object, so every movable object collapsed to the grid origin
 *     and stacked as one car — 26 rendered as 17, 6 as 5 — while the
 *     destination panel stayed exact. jsdom cannot run the animation,
 *     so this audit reads the stylesheet directly.)
 *  4. Flight: the flying wrapper never scales below 1 and never fades,
 *     the one-move's arc lift is smaller than the ten-move's, and the
 *     arriving nodes keep their DOM identity in the destination grid.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const E = require('./addition-engine');
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};

/* ---------- CSS audit ---------- */
const CSS = fs.readFileSync(path.join(__dirname,'addition-quest.css'),'utf8');
function keyframesBody(css, name) {
  const start = css.indexOf('@keyframes ' + name);
  if (start < 0) return null;
  let i = css.indexOf('{', start), depth = 0;
  for (let j = i; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') { depth--; if (depth === 0) return css.slice(i + 1, j); }
  }
  return null;
}
function animationNames(decls) {
  const names = [];
  const m = decls.match(/animation\s*:\s*([^;]+)/);
  if (m) names.push(m[1].trim().split(/\s+/)[0]);
  const m2 = decls.match(/animation-name\s*:\s*([^;]+)/);
  if (m2) names.push(...m2[1].split(',').map(s => s.trim()));
  return names;
}
{
  const nudge = keyframesBody(CSS, 'nudge');
  assert(nudge && /transform\s*:/.test(nudge), 'test sanity: nudge keyframes animate transform');
  // Every rule that selects .obj and sets an animation must reference
  // keyframes that do NOT animate transform.
  const ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
  let m, objAnimations = [];
  while ((m = ruleRe.exec(CSS))) {
    if (m[1].includes('.obj')) {
      for (const name of animationNames(m[2])) objAnimations.push({ sel: m[1].trim(), name });
    }
  }
  assert(objAnimations.length > 0, 'expected at least one animated .obj rule (the movable pulse)');
  for (const { sel, name } of objAnimations) {
    const body = keyframesBody(CSS, name);
    assert(body !== null, `${sel} animates with unknown keyframes ${name}`);
    assert(!/transform\s*:/.test(body),
      `${sel} uses keyframes ${name} which animate transform — a CSS animation overrides the inline translate() positioning, so movable objects collapse to the grid origin (live defect 2026-11-06)`);
  }
}

/* ---------- jsdom boot (stubbed clientWidth so transforms are real) ---------- */
function boot(a, b, theme) {
  const q = `?a=${a}&b=${b}` + (theme ? `&theme=${theme}` : '');
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname,'addition-quest.html'),'utf8'),
    { url: `https://example.org/${q}`, runScripts: 'outside-only' });
  const w = dom.window, pending = [], watchdogs = [], anims = [];
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.animate = function (kf, opts) {
    anims.push({ el: this, kf, opts });
    return { finished: Promise.resolve() };
  };
  const timer = w.setTimeout.bind(w);
  w.setTimeout = (f, ms) => ms === 8000 ? (watchdogs.push(f), 0) : timer(f, ms);
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  w.speechSynthesis = { getVoices: () => [], cancel: () => { pending.length = 0; },
    speak: u => { pending.push(u); u.onstart && u.onstart(); } };
  for (const id of ['left-grid', 'right-grid']) {
    Object.defineProperty(w.document.getElementById(id), 'clientWidth', { value: 250, configurable: true });
  }
  for (const name of ['addition-engine.js','addition-layout.js','addition-quest.js']) {
    w.eval(fs.readFileSync(path.join(__dirname,name),'utf8'));
  }
  return { w, pending, watchdogs, anims, close: () => dom.window.close() };
}
async function settle(t, errors) {
  for (let i = 0; i < 40 && !['ready','complete'].includes(t.w.document.body.dataset.phase); i++) {
    await flush(); const u = t.pending.shift(); if (u) (errors ? u.onerror : u.onend)();
  }
  await flush();
  assert(['ready','complete'].includes(t.w.document.body.dataset.phase));
}

/* ---------- rendered counts + slots + bottom-anchored ones ---------- */
function assertRendered(t, sol, step) {
  const d = t.w.document;
  const L = t.w.AdditionLayout;
  const plan = L.plan(sol, step);
  const R = Math.floor(sol.total / 10) + 1;
  assert.equal(plan.rows, R, `plan rows == ${R} at step ${step} of ${sol.a}+${sol.b}`);
  for (const side of ['left','right']) {
    const grid = d.querySelector('#' + side + '-grid');
    const nodes = Array.from(grid.querySelectorAll('.obj'));
    const st = sol.states[step];
    assert.equal(nodes.length, st[side],
      `rendered count ${side} == ${st[side]} at step ${step} of ${sol.a}+${sol.b}`);
    assert.equal(+d.querySelector('#' + side + '-num').textContent, st[side]);
    const domSlots = nodes.map(n => `${n.dataset.x},${n.dataset.y}`).sort();
    // Array.from: plan comes from the jsdom realm, whose Array has a
    // different prototype — deepStrictEqual would fail a cross-realm
    // array on prototypes alone, so materialise it in this realm.
    const planSlots = Array.from(plan[side], o => `${o.x},${o.y}`).sort();
    assert.deepEqual(domSlots, planSlots,
      `DOM slots == plan slots ${side} at step ${step} of ${sol.a}+${sol.b}`);
    assert.equal(new Set(domSlots).size, nodes.length,
      `distinct slots ${side} at step ${step} of ${sol.a}+${sol.b}`);
    const trs = nodes.map(n => n.style.transform);
    assert.equal(new Set(trs).size, nodes.length,
      `distinct transforms ${side} at step ${step} of ${sol.a}+${sol.b} (no stacked objects)`);
    // Ones live on the bottom row (DOM order is canonical, so the tail
    // of each pool's list is its ones).
    const tenCount = Math.floor(st[side] / 10) * 10;
    nodes.forEach((n, j) => {
      if (j >= tenCount) {
        assert.equal(+n.dataset.y, R - 1,
          `ones on bottom row y=${R - 1}, ${side} node ${j} at step ${step} of ${sol.a}+${sol.b}`);
      }
    });
  }
}

function translateOf(frame) {
  const m = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(frame.transform || '');
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
}
function liftOf(frames) {
  const [, midY] = translateOf(frames[1]);
  const [, endY] = translateOf(frames[2]);
  return endY * 0.5 - midY; // the arc lift subtracted in the middle keyframe
}
function assertFullSizeFlight(frames, what) {
  assert.equal(frames.length, 3, `${what}: flight has 3 keyframes`);
  const scales = frames.map(f => {
    const m = /scale\(([\d.]+)\)/.exec(f.transform || '');
    return m ? parseFloat(m[1]) : 1;
  });
  assert(scales.every(s => s >= 1), `${what}: flight never scales below 1, got ${scales}`);
  assert(frames.every(f => f.opacity === 1 || f.opacity === undefined),
    `${what}: flight never fades`);
}

(async () => {
  let checks = 0;
  // Rendered counts at every state, both directions, both themes.
  for (const [a, b, theme] of [[47,26,'cars'],[47,26,'mermaids'],[26,47,'cars'],[30,30,'cars'],[69,4,'cars'],[4,69,'cars'],[100,47,'cars']]) {
    const t = boot(a, b, theme), d = t.w.document;
    await settle(t);
    const sol = E.solve(a, b);
    assertRendered(t, sol, 0); checks++;
    for (let i = 0; i < sol.moves.length; i++) {
      d.querySelector('#move-btn').click();
      await settle(t);
      assertRendered(t, sol, i + 1); checks++;
      assert.equal(+d.querySelector('#left-num').textContent, sol.states[i + 1].left);
      assert.equal(+d.querySelector('#right-num').textContent, sol.states[i + 1].right);
    }
    assert.equal(d.querySelector('#eq-q').textContent, String(sol.answer));
    t.close();
  }
  // One-move starts and ends on the same bottom row (47+26, step 2->3).
  {
    const t = boot(47, 26), d = t.w.document;
    await settle(t);
    const sol = E.solve(47, 26), L = t.w.AdditionLayout;
    const R = Math.floor(sol.total / 10) + 1;
    for (let i = 0; i < 2; i++) { d.querySelector('#move-btn').click(); await settle(t); }
    const moving = Array.from(L.movingIds(sol, 2));
    assert.deepEqual(moving, [72]);
    const before = L.plan(sol, 2), after = L.plan(sol, 3);
    const from = before.right.find(o => o.id === 72), to = after.left.find(o => o.id === 72);
    assert.equal(from.y, R - 1, 'one-move starts on the bottom row');
    assert.equal(to.y, R - 1, 'one-move ends on the bottom row');
    assert.equal(to.x, 7, 'one-move lands in the next free ones square');
    checks++; t.close();
  }
  // Flight: full-size, no fade; one-move arc flatter than ten-move arc;
  // arrivals keep their DOM nodes.
  {
    const t = boot(47, 26), d = t.w.document;
    await settle(t);
    const tenNodes = Array.from(d.querySelectorAll('#right-grid .obj.movable'));
    assert.equal(tenNodes.length, 10, 'ten movable nodes before the first move');
    t.anims.length = 0;
    d.querySelector('#move-btn').click();
    await flush();
    const flyTen = t.anims.find(a => a.el.classList && a.el.classList.contains('flying'));
    assert(flyTen, 'a flying wrapper animation was recorded for the ten-move');
    assertFullSizeFlight(flyTen.kf, 'ten-move flight');
    const liftTen = liftOf(flyTen.kf);
    assert(liftTen > 0, 'ten-move flight arcs');
    await settle(t);
    tenNodes.forEach(n => assert.equal(n.parentElement.id, 'left-grid',
      'arrived ten node kept its identity in the dest grid'));
    // Second ten, then the first one-move.
    d.querySelector('#move-btn').click(); await settle(t);
    const oneNode = d.querySelector('#right-grid .obj.movable');
    assert(oneNode, 'a movable one exists for the ones phase');
    t.anims.length = 0;
    d.querySelector('#move-btn').click();
    await flush();
    const flyOne = t.anims.find(a => a.el.classList && a.el.classList.contains('flying'));
    assert(flyOne, 'a flying wrapper animation was recorded for the one-move');
    assertFullSizeFlight(flyOne.kf, 'one-move flight');
    const liftOne = liftOf(flyOne.kf);
    assert(liftOne > 0 && liftOne < liftTen,
      `one-move arc (${liftOne}) is flatter than ten-move arc (${liftTen})`);
    await settle(t);
    assert.equal(oneNode.parentElement.id, 'left-grid', 'arrived one kept its identity in the dest grid');
    assert.equal(+d.querySelector('#left-num').textContent, 68);
    checks++; t.close();
  }
  console.log(`Rendered: ${checks} cases passed; rendered counts == labelled counts at every state, ones bottom-anchored in both pools, no transform animation on .obj, full-size flights with flatter one-move arcs.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
