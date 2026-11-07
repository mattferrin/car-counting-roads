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
 *     so this audit reads the stylesheet directly.) Round 3 removed the
 *     .movable invite entirely — the landmarks carry it now — so the
 *     audit also asserts no `.movable` selector survives in the CSS and
 *     the landmark nudge is still there.
 *  4. Flight: ONE continuous spline — a single animation, sampled at
 *     equal arclength, from the source slots around the tapped landmark
 *     in a genuine loop and on into the destination slots at full size.
 *     No jumps between consecutive samples, the path passes all four
 *     sides of the landmark, and the arrivals keep their DOM identity
 *     in the destination grid. A ten arcs higher on the approach than
 *     a one. The landmark's fx burst / shockwave fire as the group
 *     reaches the loop, and the landmark booms.
 *  5. Map layout: eight landmarks in two compact strips hugging the
 *     panels — four above, four below — as tight as possible. The
 *     strips are flex rows, so the four cards share the width; the
 *     arithmetic is checked from the stylesheet at iPhone portrait
 *     (390px): four cards fit side by side with room to read their
 *     names, and each strip stays short. No sky strip, no top nav.
 *  6. New Mystery banner: hidden until solved, then the big banner
 *     directly under the sticky equation bar holds the only New Mystery
 *     button, in both directions and both themes.
 *  7. Badge sizes: the bigger/smaller/same badge classes render at
 *     18/12/14px — the word matches what it says.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const E = require('./addition-engine');
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};

/* ---------- CSS audit ---------- */
const CSS = fs.readFileSync(path.join(__dirname,'addition-quest.css'),'utf8')
  // Strip comments first: a comment mentioning .obj must not count as
  // a rule selecting .obj (it sits directly above .arrival-burst).
  .replace(/\/\*[\s\S]*?\*\//g, '');
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
  assert(objAnimations.length === 0,
    `no .obj rule may animate at all now — the movable invite moved to the landmarks, found: ${objAnimations.map(a => a.sel + ' ' + a.name).join(', ')}`);
  // The movable invite is gone entirely: no .movable selector survives.
  assert(!/\.movable/.test(CSS), 'no .movable selector in the stylesheet (landmarks carry the invite now)');
  // ...and the landmarks do carry it: the nudge still animates them.
  assert(/\.landmark\.nudge\s*\{[^}]*animation:\s*nudge/.test(CSS), 'landmarks still nudge on the first move');
}

/* ---------- jsdom boot (stubbed clientWidth so transforms are real) ---------- */
function boot(a, b, theme, reduced = true) {
  const q = `?a=${a}&b=${b}` + (theme ? `&theme=${theme}` : '');
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname,'addition-quest.html'),'utf8'),
    { url: `https://example.org/${q}`, runScripts: 'outside-only' });
  const w = dom.window, pending = [], watchdogs = [], anims = [];
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  // iPhone portrait: the loop-radius clamp and the flight geometry are
  // viewport-aware, so the tests run in the real viewport.
  Object.defineProperty(w, 'innerWidth', { value: 390, configurable: true });
  Object.defineProperty(w, 'innerHeight', { value: 844, configurable: true });
  w.matchMedia = () => ({ matches: reduced });
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
function stepSizes(frames) {
  const pts = frames.map(translateOf);
  const steps = [];
  for (let i = 1; i < pts.length; i++) steps.push(Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]));
  return steps;
}
/* One continuous spline: many evenly spaced keyframes, full size,
 * never fading, no jump between consecutive samples, passing all four
 * sides of the landmark's centre (the loop is required for the two
 * far sides — the source and destination sit on the near side), and
 * ending in the destination slots. In jsdom the wrapper starts at
 * (0,0) — every rect is zero — so the keyframe translates are absolute
 * page coords and the first keyframe must be (0,0). */
function assertSpline(frames, cx, cy, end, what) {
  assert(frames.length >= 20, `${what}: spline sampled into ${frames.length} keyframes`);
  const scales = frames.map(f => {
    const m = /scale\(([\d.]+)\)/.exec(f.transform || '');
    return m ? parseFloat(m[1]) : 1;
  });
  assert(scales.every(s => s === 1), `${what}: flight stays full size, got ${[...new Set(scales)]}`);
  assert(frames.every(f => f.opacity === 1), `${what}: flight never fades`);
  const steps = stepSizes(frames);
  const sorted = [...steps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = Math.max(...steps);
  assert(max <= 2 * median, `${what}: no jump between samples (max step ${max.toFixed(1)} vs median ${median.toFixed(1)})`);
  const pts = frames.map(translateOf);
  const quads = new Set(pts.map(([x, y]) => (x >= cx ? 1 : 0) + (y >= cy ? 2 : 0)));
  assert.equal(quads.size, 4, `${what}: path visits all four sides of the landmark centre`);
  const first = pts[0];
  assert(Math.abs(first[0]) < 1.5 && Math.abs(first[1]) < 1.5, `${what}: spline starts at the source slots`);
  const last = pts[pts.length - 1];
  assert(Math.abs(last[0] - end[0]) < 1.5 && Math.abs(last[1] - end[1]) < 1.5,
    `${what}: spline ends in the destination slots (${last.map(v => v.toFixed(1))} vs ${end})`);
}
/* The centre of the destination slots for move `step` (the layout
 * plan's slots, in the stubbed 250px-wide grid), so the spline's end
 * can be checked against the real slots. */
function destCentre(t, sol, step, side) {
  const L = t.w.AdditionLayout;
  const moving = Array.from(L.movingIds(sol, step));
  const plan = L.plan(sol, step + 1);
  const slots = plan[side].filter(p => moving.includes(p.id));
  const cellW = 250 / 10, rowH = Math.max(22, cellW * 0.65 + 10);
  const xs = slots.map(p => p.x), ys = slots.map(p => p.y);
  return [((Math.min(...xs) + Math.max(...xs) + 1) / 2) * cellW,
    ((Math.min(...ys) + Math.max(...ys)) / 2) * rowH + (rowH - 8) / 2];
}
/* The waypoint burst fires mid-flight (on a timer at the loop's
 * arclength fraction), so poll for it in real time — then the boom
 * class must still be present (it is removed 550ms later). */
async function waitForBurst(t, ms = 2500) {
  const d = t.w.document;
  for (let i = 0; i < ms / 100; i++) {
    if (d.querySelector('.page .burst')) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return !!d.querySelector('.page .burst');
}
function flyingAnims(t) {
  return t.anims.filter(a => a.el.classList && a.el.classList.contains('flying'));
}

(async () => {
  let checks = 0;
  // Rendered counts at every state, both directions, both themes.
  for (const [a, b, theme] of [[47,26,'cars'],[47,26,'mermaids'],[26,47,'cars'],[30,30,'cars'],[69,4,'cars'],[4,69,'cars'],[100,47,'cars']]) {
    const t = boot(a, b, theme), d = t.w.document;
    await settle(t);
    const sol = E.solve(a, b);
    assertRendered(t, sol, 0); checks++;
    // New Mystery banner: hidden until solved, in both directions and
    // both themes.
    assert(d.querySelector('#celebrate-banner').hidden, 'banner hidden before completion');
    assert(d.querySelector('#new-mystery').hidden, 'New Mystery hidden before completion');
    for (let i = 0; i < sol.moves.length; i++) {
      d.querySelector('.landmark').click();
      await settle(t);
      assertRendered(t, sol, i + 1); checks++;
      assert.equal(+d.querySelector('#left-num').textContent, sol.states[i + 1].left);
      assert.equal(+d.querySelector('#right-num').textContent, sol.states[i + 1].right);
    }
    assert.equal(d.querySelector('#eq-q').textContent, String(sol.answer));
    assert.equal(d.querySelector('#celebrate-banner').hidden, false, 'banner shown after completion');
    assert(d.querySelector('#celebrate-banner').classList.contains('show'));
    assert.equal(d.querySelector('#new-mystery').hidden, false);
    t.close();
  }
  // One-move starts and ends on the same bottom row (47+26, step 2->3).
  {
    const t = boot(47, 26), d = t.w.document;
    await settle(t);
    const sol = E.solve(47, 26), L = t.w.AdditionLayout;
    const R = Math.floor(sol.total / 10) + 1;
    for (let i = 0; i < 2; i++) { d.querySelector('.landmark').click(); await settle(t); }
    const moving = Array.from(L.movingIds(sol, 2));
    assert.deepEqual(moving, [72]);
    const before = L.plan(sol, 2), after = L.plan(sol, 3);
    const from = before.right.find(o => o.id === 72), to = after.left.find(o => o.id === 72);
    assert.equal(from.y, R - 1, 'one-move starts on the bottom row');
    assert.equal(to.y, R - 1, 'one-move ends on the bottom row');
    assert.equal(to.x, 7, 'one-move lands in the next free ones square');
    checks++; t.close();
  }
  // Spline builder, unit level: the same geometry for a ten and a one.
  // Both are one continuous curve that loops the landmark once and
  // ends in the destination slots; the ten arcs higher on the approach.
  {
    const t = boot(47, 26), d = t.w.document;
    await settle(t);
    const S = t.w.AdditionQuestSpline;
    assert(S, 'spline builder exposed for tests');
    const start = [100, 400];
    const rect = { left: 250, top: 350, width: 95, height: 104 };
    const dest = [500, 400];
    const cx = 297.5, cy = 402; // the landmark's centre
    const R = S.loopRadius(rect);
    function checkPath(path, amount) {
      const samples = Array.from(path.samples);
      assert(samples.length >= 20, `spline(${amount}): ${samples.length} samples`);
      assert(Math.abs(samples[0][0] - start[0]) < 0.5 && Math.abs(samples[0][1] - start[1]) < 0.5,
        `spline(${amount}): starts at the source`);
      const last = samples[samples.length - 1];
      assert(Math.abs(last[0] - dest[0]) < 0.5 && Math.abs(last[1] - dest[1]) < 0.5,
        `spline(${amount}): ends at the destination`);
      const steps = [];
      for (let i = 1; i < samples.length; i++) steps.push(Math.hypot(samples[i][0] - samples[i-1][0], samples[i][1] - samples[i-1][1]));
      const sorted = [...steps].sort((a, b) => a - b);
      assert(Math.max(...steps) <= 2 * sorted[Math.floor(sorted.length / 2)],
        `spline(${amount}): no jump between samples`);
      // The loop region: samples near the landmark cover all four sides.
      const loopPts = samples.filter(p => Math.hypot(p[0] - cx, p[1] - cy) <= R + 6);
      const quads = new Set(loopPts.map(([x, y]) => (x >= cx ? 1 : 0) + (y >= cy ? 2 : 0)));
      assert.equal(quads.size, 4, `spline(${amount}): loop visits all four sides of the landmark`);
      assert(path.loopFraction > 0.15 && path.loopFraction < 0.65,
        `spline(${amount}): loop starts ${path.loopFraction.toFixed(2)} of the way along`);
      // Approach lift: the highest point before the first loop sample.
      const firstLoop = samples.findIndex(p => Math.hypot(p[0] - cx, p[1] - cy) <= R + 6);
      return Math.min(...samples.slice(0, firstLoop).map(p => p[1]));
    }
    const tenMinY = checkPath(S.buildSplinePath(start, rect, dest, 10), 10);
    const oneMinY = checkPath(S.buildSplinePath(start, rect, dest, 1), 1);
    assert(tenMinY < 350, `ten approach arcs high (min y ${tenMinY.toFixed(1)})`);
    assert(oneMinY > 370, `one approach stays flat (min y ${oneMinY.toFixed(1)})`);
    assert(oneMinY - tenMinY > 20, `ten arcs ${Math.round(oneMinY - tenMinY)}px higher than one on the approach`);
    checks++; t.close();
  }
  // Flight: ONE continuous spline — a single animation, no jumps, a
  // genuine loop around the tapped landmark, landing full-size in the
  // destination slots. Ten-move via the Volcano.
  {
    const t = boot(47, 26, undefined, false), d = t.w.document;
    await settle(t);
    const sol = E.solve(47, 26);
    const volc = d.querySelector('[data-landmark="volcano"]');
    assert(volc, 'Volcano landmark renders');
    volc.getBoundingClientRect = () => ({
      left: 40, top: 500, width: 95, height: 104,
      right: 135, bottom: 604, x: 40, y: 500, toJSON: () => ({}),
    });
    const tenIds = Array.from(t.w.AdditionLayout.movingIds(sol, 0));
    const tenNodes = Array.from(d.querySelectorAll('#right-grid .obj'))
      .filter(n => tenIds.includes(Number(n.dataset.id)));
    assert.equal(tenNodes.length, 10, 'ten moving nodes before the first move');
    t.anims.length = 0;
    volc.click();
    await flush();
    const flyAnims = flyingAnims(t);
    assert.equal(flyAnims.length, 1, 'ten-move: ONE flight animation, not three phases');
    assert.equal(flyAnims[0].opts.duration, 1300, 'spline runs 1300ms');
    assert.equal(flyAnims[0].opts.delay, 260, '260ms telegraph before the spline');
    assert.equal(flyAnims[0].opts.easing, 'linear', 'steady speed along the spline');
    // The Volcano's centre is (87, 552) in the mocked iPhone-portrait
    // rect; the spline must loop it and end in the destination slots.
    assertSpline(flyAnims[0].kf, 87, 552, destCentre(t, sol, 0, 'left'), 'volcano ten-move spline');
    // The burst fires as the group reaches the loop, mid-flight.
    assert(await waitForBurst(t), 'Volcano waypoint bursts mid-flight');
    const bursts = Array.from(d.querySelectorAll('.page .burst'));
    assert(bursts.length === 14, 'Volcano waypoint bursts 14 sparks');
    assert(bursts.some(s => s.textContent === '🔥'), 'Volcano burst carries fire');
    assert(d.querySelector('.page .shockwave'), 'Volcano waypoint has a shockwave ring');
    assert(volc.classList.contains('boom'), 'Volcano booms at the waypoint');
    await settle(t);
    tenNodes.forEach(n => assert.equal(n.parentElement.id, 'left-grid',
      'landmark ten-move arrivals kept their identity'));
    assert.equal(+d.querySelector('#left-num').textContent, 57);
    assert.equal(+d.querySelector('#right-num').textContent, 16);
    checks++; t.close();
  }
  // One-move via a tapped landmark (Car Wash): the same single spline,
  // and the one still lands in the next free ones square.
  {
    const t = boot(47, 26, undefined, false), d = t.w.document;
    await settle(t);
    const sol = E.solve(47, 26);
    for (let i = 0; i < 2; i++) { d.querySelector('[data-landmark="volcano"]').click(); await settle(t); }
    const wash = d.querySelector('[data-landmark="wash"]');
    wash.getBoundingClientRect = () => ({
      left: 250, top: 600, width: 80, height: 100,
      right: 330, bottom: 700, x: 250, y: 600, toJSON: () => ({}),
    });
    const oneIds = Array.from(t.w.AdditionLayout.movingIds(sol, 2));
    assert.deepEqual(oneIds, [72]);
    const oneNode = Array.from(d.querySelectorAll('#right-grid .obj'))
      .find(n => Number(n.dataset.id) === 72);
    assert(oneNode, 'a moving one exists');
    t.anims.length = 0;
    wash.click();
    await flush();
    const flyAnims = flyingAnims(t);
    assert.equal(flyAnims.length, 1, 'one-move: ONE flight animation');
    assert.equal(flyAnims[0].opts.duration, 1300, 'one-move spline runs 1300ms');
    // The Car Wash centre is (290, 650); the spline loops it and ends
    // in the next free ones square.
    assertSpline(flyAnims[0].kf, 290, 650, destCentre(t, sol, 2, 'left'), 'car wash one-move spline');
    assert(await waitForBurst(t), 'Car Wash waypoint bursts mid-flight');
    const bursts = Array.from(d.querySelectorAll('.page .burst'));
    assert(bursts.some(s => s.textContent === '🫧'), 'Car Wash burst carries bubbles');
    await settle(t);
    assert.equal(oneNode.parentElement.id, 'left-grid', 'landmark one-move arrival kept its identity');
    assert.equal(+d.querySelector('#left-num').textContent, 68);
    checks++; t.close();
  }
  // Map layout: two compact strips hugging the panels — four landmarks
  // above, four below — 8 total per theme, as tight as possible. The
  // strips are flex rows, so check the sizing arithmetic from the
  // stylesheet at iPhone portrait (390px): four cards fit side by side
  // with room to read their names, and each strip stays short. The sky
  // strip above the equation bar and the top back-home nav are gone.
  {
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
    for (const theme of ['cars', 'mermaids']) {
      const t = boot(47, 26, theme), dd = t.w.document;
      await settle(t);
      assert.equal(dd.querySelectorAll('.landmark').length, 8, `${theme}: eight landmarks render`);
      assert.equal(dd.querySelectorAll('#landmarks-above .landmark').length, 4, `${theme}: four landmarks above the panels`);
      assert.equal(dd.querySelectorAll('#landmarks-below .landmark').length, 4, `${theme}: four landmarks below the panels`);
      assert(!dd.querySelector('#sky, #mid-map, #ground-map, .map-strip, .game-nav'),
        `${theme}: no sky/mid/ground strip and no top game-nav`);
      // DOM order: equation bar, banner, above strip, panels, below
      // strip, captions — the strips hug the panels.
      const order = Array.from(dd.querySelectorAll('.eqbar, #celebrate-banner, #landmarks-above, .quantities, #landmarks-below, .caption-bar'))
        .map(n => n.id === 'landmarks-above' ? 'above' : n.id === 'landmarks-below' ? 'below'
          : n.id === 'celebrate-banner' ? 'banner' : n.id === 'captions' ? 'caption-bar'
          : n.classList.contains('eqbar') ? 'eqbar' : 'quantities');
      assert.deepEqual(order, ['eqbar', 'banner', 'above', 'quantities', 'below', 'caption-bar'],
        `${theme}: strips hug the panels in order`);
      // The back link lives in the footer now.
      assert.equal(dd.querySelector('.foot a[href="index.html"]').textContent, '← Back to test games');
      t.close();
    }
    checks++;
  }
  // Badge sizes: the word matches what it says — bigger is bigger.
  {
    const bigger = /\.size-badge\.bigger\s*\{[^}]*?font-size:\s*([\d.]+)px/.exec(CSS);
    const smaller = /\.size-badge\.smaller\s*\{[^}]*?font-size:\s*([\d.]+)px/.exec(CSS);
    const same = /\.size-badge\.same\s*\{[^}]*?font-size:\s*([\d.]+)px/.exec(CSS);
    assert(bigger && smaller && same, 'badge size classes declared in the stylesheet');
    assert(+bigger[1] >= 17 && +smaller[1] <= 12,
      `bigger ${bigger[1]}px vs smaller ${smaller[1]}px — unmistakably different`);
    assert(+smaller[1] < +same[1] && +same[1] < +bigger[1],
      `same ${same[1]}px sits between smaller ${smaller[1]}px and bigger ${bigger[1]}px`);
    checks++;
  }
  console.log(`Rendered: ${checks} cases passed; rendered counts == labelled counts at every state, ones bottom-anchored in both pools, no transform animation on .obj and no .movable left, one continuous spline flight per move (no jumps, genuine loop, fx burst at the loop, flatter one-move arc), eight landmarks in two compact strips hugging the panels, banner placement, badge sizes.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
