'use strict';
/* Holiday effects — toggleable per-holiday layer, test only.
 * Run:  NODE_PATH=~/workspace/cancellation-quest/node_modules node holiday-effects.test.cjs
 * Covers: the switch (christmas on, null off, unknown name inert),
 * reduced-motion (no flakes), the solve hook (phase -> celebrating
 * fires a snowfall + no crash without audio), the move-burst hook
 * (holiday sparkle rides the game's own burst), the Play hook (total
 * landing on a multiple of 10 celebrates; a plain +1 does not), and
 * that an off layer stays inert when the game keeps playing.
 * The game files are NOT loaded here: the layer only watches DOM
 * signals, so index.html alone supplies every hook it needs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const read = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };

function boot(reducedMotion) {
  const dom = new JSDOM(read('index.html'), {
    url: 'https://example.test/test/index.html?theme=cars&max=20',
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window, d = w.document;
  w.matchMedia = q => ({ matches: !!reducedMotion && q.indexOf('reduce') !== -1 });
  w.eval(read('holiday-effects.js'));
  return { w, d };
}

(async () => {
  /* 1. Christmas on: flag set, snow + lights appear. */
  {
    const { d } = boot(false);
    assert.equal(d.body.dataset.holiday, 'christmas', 'switch defaults to christmas');
    assert.ok(d.querySelector('.holiday-snow'), 'snow container exists');
    assert.ok(d.querySelectorAll('.holiday-flake').length >= 10, 'a dozenish flakes fall');
    assert.equal(d.querySelectorAll('.holiday-light').length, 16, 'a string of lights');
  }

  /* 2. Off: init(null) leaves nothing behind, and re-on works. */
  {
    const { w, d } = boot(false);
    assert.equal(w.HolidayFX.init(null), false, 'null switches off');
    assert.equal(d.body.dataset.holiday, undefined, 'no holiday flag when off');
    assert.equal(d.querySelector('.holiday-snow'), null, 'snow removed when off');
    assert.equal(w.HolidayFX.init('christmas'), true, 'christmas switches back on');
    assert.equal(d.body.dataset.holiday, 'christmas');
    assert.ok(d.querySelector('.holiday-snow'), 'snow returns');
  }

  /* 3. Unknown holiday: inert, no crash. */
  {
    const { w, d } = boot(false);
    assert.equal(w.HolidayFX.init('easter'), false, 'unknown pack is inert');
    assert.equal(d.body.dataset.holiday, undefined);
    assert.equal(d.querySelector('.holiday-snow'), null);
  }

  /* 4. Reduced motion: flag set (CSS gates the rest), but no flakes built. */
  {
    const { w, d } = boot(true);
    w.HolidayFX.init('christmas');
    assert.equal(d.body.dataset.holiday, 'christmas');
    assert.equal(d.querySelector('.holiday-flake'), null, 'no flakes under reduced motion');
    assert.equal(d.querySelector('.holiday-light'), null, 'no lights under reduced motion');
  }

  /* 5. Solve hook: phase -> celebrating fires a snowfall, no audio crash. */
  {
    const { d } = boot(false);
    d.body.setAttribute('data-phase', 'celebrating');
    await tick();
    assert.ok(d.querySelector('.holiday-stars'), 'solve fires a snowfall');
    assert.ok(d.querySelectorAll('.holiday-stars span').length >= 30, 'a big solve snowfall');
  }

  /* 6. Move-burst hook: holiday sparkle rides the game's own burst. */
  {
    const { d } = boot(false);
    const host = d.createElement('div');
    host.className = 'side';
    d.body.appendChild(host);
    const burst = d.createElement('span');
    burst.className = 'arrival-burst';
    burst.style.left = '40px'; burst.style.top = '30px';
    burst.style.setProperty('--dx', '50px'); burst.style.setProperty('--dy', '-30px');
    host.appendChild(burst);
    await tick();
    const sparkles = host.querySelectorAll('.holiday-burst');
    assert.equal(sparkles.length, 2, 'two holiday flakes ride each burst batch');
    assert.equal(sparkles[0].style.left, '40px', 'sparkle starts where the burst started');
    assert.equal(sparkles[0].style.getPropertyValue('--dx'), '50px', 'sparkle flies the same way');
  }

  /* 7. Play hook: total landing on 20 celebrates; a plain +1 does not. */
  {
    const { d } = boot(false);
    const total = d.querySelector('#total');
    assert.equal(total.textContent, '10', 'play page starts at 10');
    total.textContent = '11';
    await tick();
    assert.equal(d.querySelector('.holiday-stars'), null, 'no celebration for 11');
  }
  {
    const { d } = boot(false);
    const total = d.querySelector('#total');
    total.textContent = '20'; /* a +10 move landing on a round number */
    await tick();
    assert.ok(d.querySelector('.holiday-stars'), 'landing on 20 celebrates');
  }

  /* 8. Off stays inert while the game keeps playing. */
  {
    const { w, d } = boot(false);
    w.HolidayFX.init(null);
    const host = d.createElement('div');
    d.body.appendChild(host);
    const burst = d.createElement('span');
    burst.className = 'arrival-burst';
    host.appendChild(burst);
    d.body.setAttribute('data-phase', 'celebrating');
    await tick();
    assert.equal(d.querySelector('.holiday-burst'), null, 'no sparkle when off');
    assert.equal(d.querySelector('.holiday-stars'), null, 'no snowfall when off');
  }

  console.log('8 holiday-effects cases passed: switch, reduced motion, solve, move-burst, round-number, off-inert.');
})().catch(e => { console.error(e); process.exit(1); });
