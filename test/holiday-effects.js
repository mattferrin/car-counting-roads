/* Holiday effects for Counting Worlds — test only.
 *
 * THE SWITCH (the whole toggle is this one line):
 *   'christmas'  Christmas effects on every test page.
 *   null         all holiday effects off — the script does nothing.
 *   'valentines' a future pack (add it to PACKS below + holiday-effects.css,
 *                then put its name here).
 *
 * How it works: this file only WATCHES the games. It never edits game
 * logic, art, buttons or icons, and it never replaces an existing
 * effect — it adds its own sparkle alongside. It hooks four honest
 * signals the games already produce:
 *   - body[data-phase] becomes "celebrating"  -> the problem is solved.
 *   - a .burst / .arrival-burst span appears   -> a move just landed.
 *   - .page gains .shake                        -> a new ten just regrouped.
 *   - #total changes to a round number         -> Play games only; Quests
 *     have their own solve moment, so Play celebrates landing on a
 *     multiple of 10 (or an exactly-equal 0 in the Subtraction garage).
 * With the switch off (or an unknown holiday name) it installs nothing:
 * no snow, no observers, no sound. See HOLIDAYS.md for the full pattern.
 *
 * Deliberate silences kept: Subtraction Play has no sound by design, so
 * it never gets a jingle — visuals only. A jingle only ever plays when
 * the page itself says sound is on (its #sound-toggle, or its stored
 * sound setting). Reduced-motion devices get no snow, no bursts and no
 * glow animation at all.
 */
(function () {
  'use strict';

  var ACTIVE_HOLIDAY = 'christmas';

  var PACKS = {
    christmas: {
      /* Falling-snow character (plain text flake, not emoji: light). */
      snowChar: '\u2744',
      /* Extra sparkle riding on each existing move burst. */
      moveChars: ['\u2744\uFE0F', '\u2728'],
      /* Solve / regroup / round-number snowfall. */
      solveChars: ['\u2744\uFE0F', '\uD83C\uDF84', '\u2B50', '\u2728', '\uD83C\uDF81'],
      /* Jingle Bells opening: E E E, E E E, E G C D E. 0 is a rest. */
      jingle: [659, 659, 659, 0, 659, 659, 659, 0, 659, 784, 523, 587, 659],
      jingleStep: 0.16
    }
  };

  var activePack = null;
  var activeHoliday = null;
  var reducedMotion = false;
  var observersInstalled = false;
  var audioCtx = null;
  var lastSolvedAt = 0;
  var lastShakeAt = 0;
  var lastTotal = null;

  function $(sel) { return document.querySelector(sel); }

  function prefersReducedMotion() {
    try {
      return typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function removeAll(sel) {
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
  }

  /* ---------- ambient: snowfall + twinkle lights ---------- */

  function buildAmbient(pack) {
    if (reducedMotion) return;
    var snow = el('div', 'holiday-snow');
    snow.setAttribute('aria-hidden', 'true');
    var count = (typeof window.innerWidth === 'number' && window.innerWidth < 400) ? 10 : 14;
    for (var i = 0; i < count; i++) {
      var f = el('span', 'holiday-flake', pack.snowChar);
      f.style.left = (Math.random() * 100).toFixed(1) + '%';
      f.style.fontSize = (10 + Math.random() * 8).toFixed(0) + 'px';
      f.style.opacity = (0.45 + Math.random() * 0.45).toFixed(2);
      f.style.setProperty('--fall', (9 + Math.random() * 7).toFixed(1) + 's');
      f.style.setProperty('--delay', (-Math.random() * 14).toFixed(1) + 's');
      f.style.setProperty('--sway', ((Math.random() * 70) - 35).toFixed(0) + 'px');
      snow.appendChild(f);
    }
    document.body.appendChild(snow);

    var garland = el('div', 'holiday-garland');
    garland.setAttribute('aria-hidden', 'true');
    for (var j = 0; j < 16; j++) garland.appendChild(el('span', 'holiday-light'));
    document.body.appendChild(garland);
  }

  /* ---------- falling-burst helper (solve / regroup / round number) ---------- */

  function snowBurst(count, chars) {
    if (!activePack || reducedMotion) return;
    var host = el('div', 'holiday-stars');
    host.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < count; i++) {
      var s = el('span', null, chars[i % chars.length]);
      s.style.left = (4 + Math.random() * 92).toFixed(1) + 'vw';
      s.style.top = (-4 - Math.random() * 10).toFixed(1) + 'vh';
      s.style.fontSize = (18 + Math.random() * 10).toFixed(0) + 'px';
      s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      host.appendChild(s);
    }
    document.body.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 2600);
  }

  /* ---------- jingle (only when the page says sound is on) ---------- */

  function soundOn() {
    var toggle = document.getElementById('sound-toggle');
    if (toggle) return toggle.getAttribute('aria-pressed') === 'true';
    var keys = ['aq-sound', 'cq-sound', 'cp-sound'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var v = window.localStorage.getItem(keys[i]);
        if (v != null) return v !== 'off';
      } catch (e) { /* storage unavailable: treat as unknown below */ }
    }
    return false; /* no evidence sound is on (e.g. the silent garage) */
  }

  function jingle() {
    if (!activePack || !soundOn()) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var notes = activePack.jingle, step = activePack.jingleStep || 0.16;
      var t0 = audioCtx.currentTime + 0.02;
      for (var i = 0; i < notes.length; i++) {
        if (!notes[i]) continue;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = notes[i];
        gain.gain.setValueAtTime(0.0001, t0 + i * step);
        gain.gain.exponentialRampToValueAtTime(0.07, t0 + i * step + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * step + 0.24);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0 + i * step);
        osc.stop(t0 + i * step + 0.26);
      }
    } catch (e) { /* sound is a bonus, never a breakage */ }
  }

  /* ---------- hooks ---------- */

  function onSolved() {
    var now = Date.now();
    if (now - lastSolvedAt < 1000) return;
    lastSolvedAt = now;
    snowBurst(36, activePack.solveChars);
    jingle();
  }

  function onRegroup() {
    var now = Date.now();
    if (now - lastShakeAt < 500) return;
    lastShakeAt = now;
    snowBurst(12, activePack.solveChars);
  }

  function onMoveBurst(host, origin) {
    if (!activePack || reducedMotion || !host || !origin) return;
    for (var i = 0; i < 2; i++) {
      var s = el('span', 'holiday-burst', activePack.moveChars[i % activePack.moveChars.length]);
      s.style.left = origin.style.left || '0px';
      s.style.top = origin.style.top || '0px';
      var dx = origin.style.getPropertyValue('--dx');
      var dy = origin.style.getPropertyValue('--dy');
      if (dx) s.style.setProperty('--dx', dx);
      if (dy) s.style.setProperty('--dy', dy);
      host.appendChild(s);
      (function (n) {
        setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 950);
      })(s);
    }
  }

  function onTotalChanged(text) {
    if (!activePack) return;
    var value = parseInt(text, 10);
    if (isNaN(value)) return;
    var prev = lastTotal;
    lastTotal = value;
    if (prev === null || prev === value) return;
    var delta = value - prev;
    if (Math.abs(delta) !== 1 && Math.abs(delta) !== 10) return; /* a real move, not a reset */
    var totalEl = document.getElementById('total');
    var isGarage = !!(totalEl && totalEl.classList.contains('garage-result'));
    var round = (value % 10 === 0) || (isGarage && value === 0);
    if (!round) return;
    snowBurst(16, activePack.solveChars);
    jingle();
  }

  /* ---------- observers (installed once, gated on the active pack) ---------- */

  function installObservers() {
    if (observersInstalled || typeof MutationObserver === 'undefined') return;
    observersInstalled = true;

    /* Solved? body[data-phase] -> "celebrating" only ever means solved. */
    new MutationObserver(function (mutations) {
      if (!activePack) return;
      for (var i = 0; i < mutations.length; i++) {
        if (document.body.dataset.phase === 'celebrating') onSolved();
      }
    }).observe(document.body, { attributes: true, attributeFilter: ['data-phase'] });

    /* Move landed / ten regrouped? Watch for the games' own signals. */
    new MutationObserver(function (mutations) {
      if (!activePack) return;
      var hosts = [];
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes' && m.target.classList &&
            m.target.classList.contains('page') && m.target.classList.contains('shake')) {
          onRegroup();
          continue;
        }
        if (m.type !== 'childList') continue;
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1 || !n.classList) continue;
          if ((n.classList.contains('burst') || n.classList.contains('arrival-burst')) &&
              hosts.indexOf(n.parentNode) === -1) {
            hosts.push(n.parentNode);
            onMoveBurst(n.parentNode, n);
          }
        }
      }
    }).observe(document.body, { childList: true, attributes: true, subtree: true, attributeFilter: ['class'] });

    /* Play games: watch the total for round numbers. */
    var totalEl = document.getElementById('total');
    if (totalEl) {
      lastTotal = parseInt(totalEl.textContent, 10);
      if (isNaN(lastTotal)) lastTotal = null;
      new MutationObserver(function () {
        if (!activePack) return;
        onTotalChanged(totalEl.textContent);
      }).observe(totalEl, { childList: true, characterData: true, subtree: true });
    }
  }

  /* ---------- the switch ---------- */

  function init(holiday) {
    removeAll('.holiday-snow, .holiday-garland, .holiday-stars');
    if (document.body) delete document.body.dataset.holiday;
    activePack = null;
    activeHoliday = null;
    if (!holiday || !PACKS[holiday]) return false; /* off, or unknown: do nothing */
    activeHoliday = holiday;
    activePack = PACKS[holiday];
    reducedMotion = prefersReducedMotion();
    if (document.body) {
      document.body.dataset.holiday = holiday;
      buildAmbient(activePack);
      installObservers();
    }
    return true;
  }

  window.HolidayFX = { init: init, PACKS: PACKS, ACTIVE_HOLIDAY: ACTIVE_HOLIDAY };

  if (document.body) {
    init(ACTIVE_HOLIDAY);
  } else if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function () { init(ACTIVE_HOLIDAY); });
  }
})();
