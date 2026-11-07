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
 *     Every move now has a waypoint (the tapped landmark or the Move
 *     button): phase 1 flies to the top of a loop, phase 2 is one full
 *     orbit around the waypoint (~400ms, 9 keyframes), the waypoint
 *     bursts with its own fx, and phase 3 flies on to the destination
 *     slots at full size.
 *  5. Map spread: the four landmark positions span at least three
 *     x-quartiles and both y-halves of the map — genuinely spread, not
 *     a row — and four landmarks render in both themes.
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
/* An orbit: 9 keyframes whose wrapper-centre points all sit on one
 * circle of radius R around the waypoint centre, covering all four
 * quadrants — a real visible loop, not a pass-through. */
function assertOrbit(frames, cx, cy, R, what) {
  assert.equal(frames.length, 9, `${what}: orbit has 9 keyframes`);
  const pts = frames.map(translateOf);
  pts.forEach(([x, y]) => {
    const dist = Math.hypot(x - cx, y - cy);
    assert(Math.abs(dist - R) < 1.5,
      `${what}: orbit point (${x},${y}) is ${dist.toFixed(1)} from centre (${cx},${cy}), expected radius ${R}`);
  });
  const quads = new Set(pts.map(([x, y]) => (x >= cx ? 1 : 0) + (y >= cy ? 2 : 0)));
  assert.equal(quads.size, 4, `${what}: orbit visits all four quadrants`);
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
      d.querySelector('#move-btn').click();
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
  // arrivals keep their DOM nodes. Every move is three phases now:
  // phase 1 to the waypoint, the orbit loop, phase 2 to the slots.
  {
    const t = boot(47, 26), d = t.w.document;
    await settle(t);
    const tenNodes = Array.from(d.querySelectorAll('#right-grid .obj.movable'));
    assert.equal(tenNodes.length, 10, 'ten movable nodes before the first move');
    t.anims.length = 0;
    d.querySelector('#move-btn').click();
    await flush();
    const flyTenAnims = flyingAnims(t);
    assert.equal(flyTenAnims.length, 3, 'ten-move via Move button: phase 1, orbit, phase 2');
    assertFullSizeFlight(flyTenAnims[0].kf, 'ten-move phase 1');
    // The Move button's rect is all-zero in jsdom, so its orbit is a
    // 22px circle around the origin — still a real full loop.
    assertOrbit(flyTenAnims[1].kf, 0, 0, 22, 'move-button orbit');
    const p1end = translateOf(flyTenAnims[0].kf[2]);
    const oStart = translateOf(flyTenAnims[1].kf[0]);
    assert(Math.abs(p1end[0] - oStart[0]) < 1 && Math.abs(p1end[1] - oStart[1]) < 1,
      'phase 1 flows into the orbit without a jump');
    const flyTen = flyTenAnims[2];
    assertFullSizeFlight(flyTen.kf, 'ten-move phase 2');
    const liftTen = liftOf(flyTen.kf);
    assert(liftTen > 0, 'ten-move flight arcs');
    // The Move-button waypoint bursts sparkles into the move row.
    const btnBursts = Array.from(d.querySelectorAll('.move-row .burst'));
    assert(btnBursts.length === 14, 'Move-button waypoint bursts 14 sparkles');
    assert(btnBursts.some(s => s.textContent === '✨'), 'Move-button burst is sparkles');
    assert(d.querySelector('.move-row .shockwave'), 'Move-button waypoint has a shockwave ring');
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
    const flyOneAnims = flyingAnims(t);
    assert.equal(flyOneAnims.length, 3, 'one-move via Move button: phase 1, orbit, phase 2');
    assertOrbit(flyOneAnims[1].kf, 0, 0, 22, 'one-move move-button orbit');
    const flyOne = flyOneAnims[2];
    assertFullSizeFlight(flyOne.kf, 'one-move phase 2');
    const liftOne = liftOf(flyOne.kf);
    assert(liftOne > 0 && liftOne < liftTen,
      `one-move arc (${liftOne}) is flatter than ten-move arc (${liftTen})`);
    await settle(t);
    assert.equal(oneNode.parentElement.id, 'left-grid', 'arrived one kept its identity in the dest grid');
    assert.equal(+d.querySelector('#left-num').textContent, 68);
    checks++; t.close();
  }
  // Ten-move via a tapped landmark (Volcano): the flight visits the
  // landmark, loops around it, bursts with its fx, then lands full-size.
  {
    const t = boot(47, 26), d = t.w.document;
    await settle(t);
    const volc = d.querySelector('[data-landmark="volcano"]');
    assert(volc, 'Volcano landmark renders');
    volc.getBoundingClientRect = () => ({
      left: 300, top: 600, width: 92, height: 104,
      right: 392, bottom: 704, x: 300, y: 600, toJSON: () => ({}),
    });
    const tenNodes = Array.from(d.querySelectorAll('#right-grid .obj.movable'));
    t.anims.length = 0;
    volc.click();
    await flush();
    const flyAnims = flyingAnims(t);
    assert.equal(flyAnims.length, 3, 'landmark ten-move: phase 1, orbit, phase 2');
    assertFullSizeFlight(flyAnims[0].kf, 'landmark ten-move phase 1');
    assertFullSizeFlight(flyAnims[2].kf, 'landmark ten-move phase 2');
    // The orbit circles the Volcano's centre (346, 652) at radius
    // 104/2 + 22 = 74 — the flight really visits the tapped place.
    assertOrbit(flyAnims[1].kf, 346, 652, 74, 'volcano orbit');
    const p1end = translateOf(flyAnims[0].kf[2]);
    const oStart = translateOf(flyAnims[1].kf[0]);
    assert(Math.abs(p1end[0] - oStart[0]) < 1 && Math.abs(p1end[1] - oStart[1]) < 1,
      'phase 1 flows into the Volcano orbit without a jump');
    // The waypoint bursts with the Volcano's own fx and the landmark booms.
    const bursts = Array.from(d.querySelectorAll('#landscape .burst'));
    assert(bursts.length === 14, 'Volcano waypoint bursts 14 sparks');
    assert(bursts.some(s => s.textContent === '🔥'), 'Volcano burst carries fire');
    assert(d.querySelector('#landscape .shockwave'), 'Volcano waypoint has a shockwave ring');
    assert(volc.classList.contains('boom'), 'Volcano booms at the waypoint');
    await settle(t);
    tenNodes.forEach(n => assert.equal(n.parentElement.id, 'left-grid',
      'landmark ten-move arrivals kept their identity'));
    assert.equal(+d.querySelector('#left-num').textContent, 57);
    assert.equal(+d.querySelector('#right-num').textContent, 16);
    checks++; t.close();
  }
  // One-move via a tapped landmark (Car Wash): same three phases, and
  // the one still lands in the next free ones square.
  {
    const t = boot(47, 26), d = t.w.document;
    await settle(t);
    for (let i = 0; i < 2; i++) { d.querySelector('#move-btn').click(); await settle(t); }
    const wash = d.querySelector('[data-landmark="wash"]');
    wash.getBoundingClientRect = () => ({
      left: 440, top: 700, width: 84, height: 100,
      right: 524, bottom: 800, x: 440, y: 700, toJSON: () => ({}),
    });
    const oneNode = d.querySelector('#right-grid .obj.movable');
    assert(oneNode, 'a movable one exists');
    t.anims.length = 0;
    wash.click();
    await flush();
    const flyAnims = flyingAnims(t);
    assert.equal(flyAnims.length, 3, 'landmark one-move: phase 1, orbit, phase 2');
    assertFullSizeFlight(flyAnims[2].kf, 'landmark one-move phase 2');
    assertOrbit(flyAnims[1].kf, 482, 750, 72, 'car wash orbit');
    const bursts = Array.from(d.querySelectorAll('#landscape .burst'));
    assert(bursts.some(s => s.textContent === '🫧'), 'Car Wash burst carries bubbles');
    await settle(t);
    assert.equal(oneNode.parentElement.id, 'left-grid', 'landmark one-move arrival kept its identity');
    assert.equal(+d.querySelector('#left-num').textContent, 68);
    checks++; t.close();
  }
  // Map spread: the four landmark positions span at least three
  // x-quartiles and both y-halves of the map — genuinely spread, not a
  // row. Positions are declared in the stylesheet, so parse them there.
  {
    const posRe = /\.landmark\.pos-(\d)\s*\{[^}]*?left:\s*([\d.]+)%[^}]*?top:\s*([\d.]+)px[^}]*\}/g;
    const positions = [];
    let m;
    while ((m = posRe.exec(CSS))) positions.push({ n: +m[1], left: +m[2], top: +m[3] });
    assert.equal(positions.length, 4, 'four landmark positions declared');
    const mapH = /\.landscape\s*\{[^}]*?min-height:\s*([\d.]+)px/.exec(CSS);
    assert(mapH, 'landscape min-height declared');
    const H = +mapH[1];
    const xQs = new Set(positions.map(p => Math.min(3, Math.floor(p.left / 25))));
    const yHs = new Set(positions.map(p => ((p.top + 56) / H) < 0.5 ? 0 : 1));
    assert(xQs.size >= 3, `landmarks span ${xQs.size} x-quartiles, expected >= 3`);
    assert(yHs.size >= 2, 'landmarks span both y-halves');
    for (const theme of ['cars', 'mermaids']) {
      const t = boot(47, 26, theme), dd = t.w.document;
      await settle(t);
      assert.equal(dd.querySelectorAll('.landmark').length, 4, `${theme}: four landmarks render`);
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
  console.log(`Rendered: ${checks} cases passed; rendered counts == labelled counts at every state, ones bottom-anchored in both pools, no transform animation on .obj, full-size three-phase flights (waypoint visit, full orbit, fx burst) with flatter one-move arcs, map spread, banner placement, badge sizes.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
