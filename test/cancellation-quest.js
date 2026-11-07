/* Cancellation Quest — game UI.
 * The maths lives in cancellation-engine.js. This file only renders the
 * engine's states, flies the objects, speaks the place-value counts and
 * plays the effects. It never invents a move: every tap plays exactly
 * solution.moves[stepIndex], and the state only advances after the
 * objects have visibly arrived at the landmark.
 */
(function () {
  'use strict';
  var E = window.CancellationEngine;

  /* ---------- tiny helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function store(k, v) { try { localStorage.setItem('cq-' + k, v); } catch (e) {} }
  function read(k, d) { try { var v = localStorage.getItem('cq-' + k); return v == null ? d : v; } catch (e) { return d; } }

  /* ---------- themes ---------- */
  var THEMES = {
    cars: {
      label: "Ayan's Car World", thing: 'car', things: 'cars',
      leftName: 'Ayan', rightName: 'Aliya',
      leftSym: 'car-blue', rightSym: 'car-gold',
      landmarks: [
        { id: 'volcano', art: '🌋', name: 'Volcano', hint: 'poof in a puff!', fx: ['🔥', '⭐', '💥'] },
        { id: 'castle', art: '🏰', name: 'Castle', hint: 'magic sparkles!', fx: ['✨', '💫', '⭐'] },
        { id: 'tree', art: '🌳', name: 'Magic Tree', hint: 'swirling leaves!', fx: ['🍃', '🍂', '🌿'] },
        { id: 'wash', art: '🫧', name: 'Car Wash', hint: 'bubbles pop!', fx: ['🫧', '💧', '✨'] }
      ],
      scenery: [['☀️', '6%', '8%'], ['☁️', '38%', '4%'], ['☁️', '68%', '10%'], ['🌼', '88%', '30%'], ['🚗', '12%', '62%']]
    },
    mermaids: {
      label: "Aliya's Mermaid World", thing: 'mermaid', things: 'mermaids',
      leftName: 'Ayan', rightName: 'Aliya',
      leftSym: 'mermaid-teal', rightSym: 'mermaid-pink',
      landmarks: [
        { id: 'reef', art: '🪸', name: 'Coral Reef', hint: 'bubbles bloom!', fx: ['🫧', '🪸', '✨'] },
        { id: 'palace', art: '🏰', name: 'Palace', hint: 'pearl sparkles!', fx: ['✨', '🤍', '💫'] },
        { id: 'whirlpool', art: '🌀', name: 'Whirlpool', hint: 'round and round!', fx: ['🌀', '💧', '🫧'] },
        { id: 'shell', art: '🐚', name: 'Giant Shell', hint: 'a pearl pops out!', fx: ['🤍', '✨', '⭐'] }
      ],
      scenery: [['🐠', '8%', '12%'], ['🫧', '40%', '6%'], ['🐢', '62%', '16%'], ['⭐', '86%', '26%'], ['🐟', '22%', '58%']]
    }
  };

  /* ---------- state ---------- */
  var theme = 'cars';
  var level = 'easy';
  var soundOn = true;
  var solution = null;      // engine result for the current problem
  var stepIndex = 0;        // next move to play
  var animating = false;
  var solved = false;
  var speechToken = 0;      // invalidates in-flight speech
  var audioCtx = null;
  var leftZeroTensSaid = false, rightZeroTensSaid = false;
  var prevLeftTens = null, prevRightTens = null;

  var eqA, eqB, eqQ, leftNum, rightNum, leftCap, rightCap, leftGrid, rightGrid,
      leftSide, rightSide, captionBar, nextChip, newMysteryBtn, cheerEl, landscapeEl;

  /* ---------- speech: two voices, place-value words only ---------- */
  function voices() {
    if (!('speechSynthesis' in window)) return { boy: null, girl: null };
    var all = window.speechSynthesis.getVoices().filter(function (v) {
      return v.lang && v.lang.toLowerCase().indexOf('en') === 0;
    });
    if (!all.length) all = window.speechSynthesis.getVoices();
    function pick(rx, fallback) {
      for (var i = 0; i < all.length; i++) if (rx.test(all[i].name)) return all[i];
      return fallback;
    }
    var boy = pick(/daniel|alex|fred|james|david|guy|george|google us english/i, all[0] || null);
    var girl = pick(/samantha|victoria|karen|moira|zira|susan|aria|jenny|google uk english female/i,
      all.filter(function (v) { return v !== boy; })[0] || boy);
    return { boy: boy, girl: girl };
  }

  function stopSpeech() {
    speechToken++;
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  /* Speak phrases in order: [{text, kind:'boy'|'girl'}]. Captions are set
   * by the caller at the same time, so words and screen always agree. */
  function speak(phrases) {
    if (!soundOn || !('speechSynthesis' in window)) return;
    var token = speechToken;
    var vs = voices();
    var i = 0;
    function next() {
      if (token !== speechToken || i >= phrases.length) return;
      var p = phrases[i++];
      var u = new SpeechSynthesisUtterance(p.text);
      u.lang = 'en-US';
      u.rate = 0.88;
      u.pitch = p.kind === 'boy' ? 0.85 : 1.3;
      var v = p.kind === 'boy' ? vs.boy : vs.girl;
      if (v) u.voice = v;
      u.onend = function () { next(); };
      u.onerror = function () { next(); };
      try { window.speechSynthesis.speak(u); } catch (e) { next(); }
    }
    next();
  }

  /* Place-value phrase for one side, with the one-time "zero tens"
   * transition when its tens have just run out. */
  function describeSide(n, side) {
    var pv = E.placeValue(n);
    var saidFlag = side === 'left' ? leftZeroTensSaid : rightZeroTensSaid;
    var prevTens = side === 'left' ? prevLeftTens : prevRightTens;
    var sayZero = false;
    if (pv.tens === 0 && pv.ones > 0 && !saidFlag && prevTens !== null && prevTens > 0) {
      sayZero = true;
      if (side === 'left') leftZeroTensSaid = true; else rightZeroTensSaid = true;
    }
    if (side === 'left') prevLeftTens = pv.tens; else prevRightTens = pv.tens;
    return E.describeCount(n, sayZero);
  }

  /* ---------- little sounds (WebAudio, no files) ---------- */
  function blip(freq, dur, type, vol) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  function popSound() { blip(520, 0.12, 'triangle', 0.09); setTimeout(function () { blip(760, 0.14, 'triangle', 0.07); }, 90); }
  function cheerSound() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { blip(f, 0.25, 'sine', 0.1); }, i * 130); }); }

  /* ---------- rendering ---------- */
  function digitSpans(n) {
    var pv = E.placeValue(n);
    var html = '';
    if (pv.hundreds > 0) html += '<span class="d-hun">' + pv.hundreds + '</span>';
    if (pv.hundreds > 0 || pv.tens > 0) html += '<span class="d-tens">' + pv.tens + '</span>';
    html += '<span class="d-ones">' + pv.ones + '</span>';
    return html;
  }
  function captionHtml(n) {
    var pv = E.placeValue(n);
    var parts = [];
    if (pv.hundreds > 0) parts.push('<span class="h">' + pv.hundreds + ' hundred' + (pv.hundreds > 1 ? 's' : '') + '</span>');
    if (pv.tens > 0) parts.push('<span class="t">' + pv.tens + ' ten' + (pv.tens > 1 ? 's' : '') + '</span>');
    if (pv.ones > 0 || parts.length === 0) parts.push('<span class="o">' + pv.ones + ' one' + (pv.ones === 1 ? '' : 's') + '</span>');
    return parts.join(' · ');
  }

  function buildGrid(grid, count, sym) {
    grid.innerHTML = '';
    grid.classList.toggle('empty', count === 0);
    var remaining = count;
    while (remaining > 0) {
      var take = Math.min(10, remaining);
      var row = el('div', 'ten-row' + (take < 10 ? ' single' : ''));
      for (var i = 0; i < take; i++) {
        var obj = el('span', 'obj');
        obj.innerHTML = '<svg viewBox="0 0 44 26" aria-hidden="true"><use href="#' + sym + '"></use></svg>';
        if (sym.indexOf('mermaid') === 0) obj.firstChild.setAttribute('viewBox', '0 0 30 44');
        row.appendChild(obj);
      }
      grid.appendChild(row);
      remaining -= take;
    }
  }

  function renderSide(which, value, flash) {
    var T = THEMES[theme];
    var num = which === 'left' ? leftNum : rightNum;
    var cap = which === 'left' ? leftCap : rightCap;
    var grid = which === 'left' ? leftGrid : rightGrid;
    var sym = which === 'left' ? T.leftSym : T.rightSym;
    var old = num.innerHTML;
    num.innerHTML = digitSpans(value);
    if (flash && old !== num.innerHTML) {
      num.classList.remove('changed');
      void num.offsetWidth; // restart the flash animation
      num.classList.add('changed');
    }
    cap.innerHTML = captionHtml(value);
    buildGrid(grid, value, sym);
  }

  function renderEquation() {
    eqA.innerHTML = digitSpans(solution.a);
    eqB.innerHTML = digitSpans(solution.b);
    if (solved) {
      eqQ.innerHTML = digitSpans(solution.answer);
      eqQ.classList.add('revealed');
    } else {
      eqQ.textContent = '?';
      eqQ.classList.remove('revealed');
    }
  }

  function renderNextMove() {
    if (solved || stepIndex >= solution.moves.length) {
      nextChip.innerHTML = 'All cancelled! 🎉';
      return;
    }
    var amt = solution.moves[stepIndex];
    nextChip.innerHTML = 'Next: <span class="amt">' + E.describeMove(amt) + '</span> from each side — tap a place!';
  }

  function setCaption(lines) {
    // lines: [{cls, tag, text}] — the exact words the voices say.
    captionBar.innerHTML = '';
    lines.forEach(function (l) {
      var p = el('p', 'line ' + l.cls);
      if (l.tag) { var tag = el('span', 'who-tag', l.tag); p.appendChild(tag); }
      p.appendChild(document.createTextNode(l.text));
      captionBar.appendChild(p);
    });
  }

  function sayCounts() {
    var st = solution.states[stepIndex];
    var leftPhrase = describeSide(st.left, 'left');
    var rightPhrase = describeSide(st.right, 'right');
    var T = THEMES[theme];
    setCaption([
      { cls: 'left-voice', tag: T.leftName, text: leftPhrase + '.' },
      { cls: 'right-voice', tag: T.rightName, text: rightPhrase + '.' }
    ]);
    speak([
      { text: leftPhrase, kind: 'boy' },
      { text: rightPhrase, kind: 'girl' }
    ]);
  }

  /* ---------- landmarks ---------- */
  function buildLandmarks() {
    var T = THEMES[theme];
    landscapeEl.innerHTML = '';
    var scenery = el('div', 'scenery');
    T.scenery.forEach(function (s) {
      var sp = el('span', null, s[0]);
      sp.style.left = s[1]; sp.style.top = s[2];
      scenery.appendChild(sp);
    });
    landscapeEl.appendChild(scenery);
    T.landmarks.forEach(function (lm, i) {
      var b = el('button', 'landmark pos-' + (i + 1));
      b.type = 'button';
      b.dataset.landmark = lm.id;
      b.setAttribute('aria-label', lm.name + ' — tap here to cancel ' + THEMES[theme].things);
      b.innerHTML = '<span class="art" aria-hidden="true">' + lm.art + '</span>' +
        '<span class="name">' + lm.name + '</span>' +
        '<span class="hint">' + lm.hint + '</span>';
      b.addEventListener('click', function () { onLandmark(b, lm); });
      landscapeEl.appendChild(b);
    });
    var gl = el('div', 'ground-label', T.label + ' — tap a place to cancel!');
    landscapeEl.appendChild(gl);
    updateLandmarkState();
  }

  function updateLandmarkState() {
    $all('.landmark', landscapeEl).forEach(function (b) {
      b.disabled = animating || solved;
      b.classList.toggle('nudge', !animating && !solved && stepIndex === 0);
    });
    $all('.theme-pill').forEach(function (b) { b.disabled = animating; });
  }

  function burst(landmarkEl, chars) {
    var host = landscapeEl;
    var r = landmarkEl.getBoundingClientRect();
    var hr = host.getBoundingClientRect();
    var cx = r.left - hr.left + r.width / 2;
    var cy = r.top - hr.top + r.height / 2;
    for (var i = 0; i < 14; i++) {
      var s = el('span', 'burst', chars[i % chars.length]);
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      var ang = (i / 14) * Math.PI * 2 + Math.random() * 0.6;
      var dist = 46 + Math.random() * 55;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist - 24) + 'px');
      host.appendChild(s);
      setTimeout(function (n) { n.remove(); }.bind(null, s), 950);
    }
  }

  /* Collect the last `amount` objects from a side, grouped by their row,
   * and lift each group into a fixed wrapper at its current screen spot.
   * Returns [{wrapper, nodes}]. The nodes are the REAL objects, so the
   * children watch the actual cars/mermaids leave — nothing teleports. */
  function liftObjects(grid, amount) {
    var objs = $all('.obj', grid);
    var take = objs.slice(-amount);
    var groups = [];
    take.forEach(function (obj) {
      var row = obj.parentNode;
      var g = groups[groups.length - 1];
      if (!g || g.row !== row) { g = { row: row, nodes: [] }; groups.push(g); }
      g.nodes.push(obj);
    });
    return groups.map(function (g) {
      var first = g.nodes[0].getBoundingClientRect();
      var last = g.nodes[g.nodes.length - 1].getBoundingClientRect();
      var wrap = el('div', 'flying flying-row');
      wrap.style.left = first.left + 'px';
      wrap.style.top = first.top + 'px';
      wrap.style.width = (last.right - first.left) + 'px';
      wrap.style.height = first.height + 'px';
      wrap.style.gridTemplateColumns = 'repeat(' + g.nodes.length + ', 1fr)';
      g.nodes.forEach(function (n) { wrap.appendChild(n); });
      if (!g.row.hasChildNodes()) g.row.remove();
      document.body.appendChild(wrap);
      return wrap;
    });
  }

  function flyTo(wrapper, targetRect, delay) {
    var r = wrapper.getBoundingClientRect();
    var dx = targetRect.left + targetRect.width / 2 - (r.left + r.width / 2);
    var dy = targetRect.top + targetRect.height / 2 - (r.top + r.height / 2);
    var dur = reducedMotion() ? 180 : 620;
    var anim = wrapper.animate([
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 64) + 'px) scale(1.06) rotate(-3deg)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.3)', opacity: 0.85 }
    ], { duration: dur, delay: delay, easing: 'ease-in-out', fill: 'forwards' });
    return anim.finished.catch(function () {}).then(function () { wrapper.remove(); });
  }

  /* ---------- one cancellation tap ---------- */
  function onLandmark(btn, lm) {
    if (animating || solved || stepIndex >= solution.moves.length) return;
    stopSpeech();
    animating = true;
    updateLandmarkState();
    var amount = solution.moves[stepIndex];
    var target = btn.getBoundingClientRect();
    var leftWraps = liftObjects(leftGrid, amount);
    var rightWraps = liftObjects(rightGrid, amount);
    var flights = [];
    leftWraps.concat(rightWraps).forEach(function (w, i) {
      flights.push(flyTo(w, target, i * 90));
    });
    btn.classList.add('busy');
    setTimeout(function () { btn.classList.remove('busy'); }, 650);
    Promise.all(flights).then(function () {
      burst(btn, lm.fx);
      popSound();
      stepIndex++;
      var st = solution.states[stepIndex];
      renderSide('left', st.left, true);
      renderSide('right', st.right, true);
      animating = false;
      renderNextMove();
      if (E.isSolved(st)) {
        solved = true;
        celebrate();
      } else {
        sayCounts();
      }
      updateLandmarkState();
    });
  }

  /* ---------- celebration ---------- */
  function celebrate() {
    renderEquation();
    leftSide.classList.add('done');
    var answer = solution.answer;
    var phrase = E.describeCount(answer, false);
    setCaption([
      { cls: 'note', text: 'Nothing is left to cancel — what stayed is the answer!' },
      { cls: 'left-voice', tag: 'Answer', text: 'The answer is ' + phrase + '!' }
    ]);
    cheerEl.textContent = '🎉 ' + solution.a + ' − ' + solution.b + ' = ' + answer + ' — you did it! 🎉';
    cheerEl.hidden = false;

    // The surviving number flies from its panel into the "?" spot.
    var from = leftNum.getBoundingClientRect();
    var to = eqQ.getBoundingClientRect();
    var flyer = el('div', 'answer-flyer');
    flyer.innerHTML = digitSpans(answer);
    flyer.style.left = from.left + 'px';
    flyer.style.top = from.top + 'px';
    document.body.appendChild(flyer);
    var dx = to.left + to.width / 2 - (from.left + from.width / 2);
    var dy = to.top + to.height / 2 - (from.top + from.height / 2);
    var dur = reducedMotion() ? 200 : 900;
    var anim = flyer.animate([
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 80) + 'px) scale(1.25)', opacity: 1, offset: 0.6 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1)', opacity: 1 }
    ], { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
    anim.finished.catch(function () {}).then(function () {
      flyer.remove();
      renderEquation(); // swaps "?" for the answer with a pop
      starBurst();
      cheerSound();
      newMysteryBtn.classList.add('show');
      newMysteryBtn.focus();
    });
    speak([{ text: 'The answer is ' + phrase + '!', kind: 'girl' }]);
  }

  function starBurst() {
    var host = el('div', 'stars');
    var chars = ['⭐', '✨', '🎉', '💛'];
    for (var i = 0; i < 26; i++) {
      var s = el('span', null, chars[i % chars.length]);
      s.style.left = (4 + Math.random() * 92) + 'vw';
      s.style.top = (-4 - Math.random() * 10) + 'vh';
      s.style.animationDelay = (Math.random() * 0.5) + 's';
      host.appendChild(s);
    }
    document.body.appendChild(host);
    setTimeout(function () { host.remove(); }, 2600);
  }

  /* ---------- problem lifecycle ---------- */
  function syncUrl() {
    var q = '?theme=' + theme + '&a=' + solution.a + '&b=' + solution.b + '&level=' + level;
    try { history.replaceState(null, '', q); } catch (e) {}
  }

  function newProblem(a, b, opts) {
    opts = opts || {};
    stopSpeech();
    solution = E.solve(a, b);
    stepIndex = 0;
    animating = false;
    solved = false;
    leftZeroTensSaid = false; rightZeroTensSaid = false;
    // Seed with the starting tens so the one-time "zero tens" phrase is
    // spoken even when the tens run out on the very first move.
    prevLeftTens = E.placeValue(a).tens; prevRightTens = E.placeValue(b).tens;
    leftSide.classList.remove('done');
    newMysteryBtn.classList.remove('show');
    cheerEl.hidden = true;
    cheerEl.textContent = '';
    renderEquation();
    renderSide('left', solution.a, false);
    renderSide('right', solution.b, false);
    renderNextMove();
    updateLandmarkState();
    syncUrl();
    if (solution.moves.length === 0) {
      // e.g. 7 − 0: nothing to cancel; the answer is already there.
      solved = true;
      setCaption([{ cls: 'note', text: 'Nothing to cancel — the answer was there all along!' }]);
      celebrate();
      return;
    }
    if (opts.announce) {
      sayCounts();
    } else {
      setCaption([
        { cls: 'note', text: 'Tap a place below to cancel ' + E.describeMove(solution.moves[0]) + ' from each side.' },
        { cls: 'note', text: 'The two voices will count what is left — in tens and ones.' }
      ]);
    }
  }

  function newRandomProblem(announce) {
    var p = E.randomProblem(level);
    newProblem(p.a, p.b, { announce: announce });
  }

  /* ---------- theme / level / sound ---------- */
  function setTheme(t, keepProblem) {
    if (animating) return;
    theme = THEMES[t] ? t : 'cars';
    document.body.dataset.theme = theme;
    $all('.theme-pill').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    });
    $('.world-line').textContent = THEMES[theme].label + ' · Cancellation Quest';
    buildLandmarks();
    if (solution) {
      var st = solution.states[stepIndex];
      renderSide('left', st.left, false);
      renderSide('right', st.right, false);
    }
    store('theme', theme);
    if (solution) syncUrl();
  }

  function setLevel(l, startNew) {
    level = E.LEVELS[l] ? l : 'easy';
    $all('.level-pill').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.level === level));
    });
    store('level', level);
    if (startNew && !animating) newRandomProblem(false);
  }

  /* ---------- boot ---------- */
  function parseParams() {
    var q = new URLSearchParams(location.search);
    var t = q.get('theme');
    if (THEMES[t]) theme = t; else theme = read('theme', 'cars');
    if (!THEMES[theme]) theme = 'cars';
    var l = q.get('level');
    level = E.LEVELS[l] ? l : read('level', 'easy');
    if (!E.LEVELS[level]) level = 'easy';
    var a = parseInt(q.get('a'), 10), b = parseInt(q.get('b'), 10);
    var specific = null;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      try { E.validate(a, b); specific = { a: a, b: b }; } catch (e) { specific = null; }
    }
    return specific;
  }

  function init() {
    eqA = $('#eq-a'); eqB = $('#eq-b'); eqQ = $('#eq-q');
    leftNum = $('#left-num'); rightNum = $('#right-num');
    leftCap = $('#left-cap'); rightCap = $('#right-cap');
    leftGrid = $('#left-grid'); rightGrid = $('#right-grid');
    leftSide = $('#side-left'); rightSide = $('#side-right');
    captionBar = $('#captions');
    nextChip = $('#next-chip');
    newMysteryBtn = $('#new-mystery');
    cheerEl = $('#cheer');
    landscapeEl = $('#landscape');

    var specific = parseParams();
    soundOn = read('sound', 'on') !== 'off';
    var soundBtn = $('#sound-toggle');
    soundBtn.textContent = soundOn ? '🔊 Sound on' : '🔇 Muted';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundBtn.addEventListener('click', function () {
      soundOn = !soundOn;
      store('sound', soundOn ? 'on' : 'off');
      soundBtn.textContent = soundOn ? '🔊 Sound on' : '🔇 Muted';
      soundBtn.setAttribute('aria-pressed', String(soundOn));
      if (!soundOn) stopSpeech();
    });

    $all('.theme-pill').forEach(function (b) {
      b.addEventListener('click', function () { setTheme(b.dataset.theme); });
    });
    $all('.level-pill').forEach(function (b) {
      b.addEventListener('click', function () { setLevel(b.dataset.level, true); });
    });
    $all('.test-problem').forEach(function (b) {
      b.addEventListener('click', function () {
        if (animating) return;
        newProblem(parseInt(b.dataset.a, 10), parseInt(b.dataset.b, 10), { announce: false });
      });
    });
    newMysteryBtn.addEventListener('click', function () { newRandomProblem(false); });

    document.body.dataset.theme = theme;
    $all('.theme-pill').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    });
    $all('.level-pill').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.level === level));
    });
    $('.world-line').textContent = THEMES[theme].label + ' · Cancellation Quest';
    buildLandmarks();
    if (specific) newProblem(specific.a, specific.b, { announce: false });
    else newRandomProblem(false);

    // Warm up the voice list (some browsers load it late).
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () {};
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
