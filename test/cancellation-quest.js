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
      leftColor: 'Blue', rightColor: 'Gold',
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
      leftColor: 'Teal', rightColor: 'Pink',
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
      leftSide, rightSide, captionBar, nextChip, newMysteryBtn, cheerEl, landscapeEl,
      cancelledTally;

  /* ---------- voices: pre-recorded clips, two distinct voices ---------- */
  /* Counts are spoken from short recorded clips — one male voice for the
   * left side, one female voice for the right — so the two voices are
   * unmistakably different on every device (the device's built-in speech
   * could only shift one voice's pitch, which sounded like one person).
   * A count is played as its place-value fragments in order ("five tens"
   * + "three ones"), which is also why the counting pattern is audible:
   * tens count down, then ones. If a clip is missing or audio is
   * unavailable, the same words fall back to the device's speech — the
   * captions always show the same words either way. */
  var clipBuffers = {};   // "boy:tens-8" -> AudioBuffer, false = missing
  var clipsPreloading = false;
  var clipSources = [];   // live buffer sources, so stopSpeech can cut them
  var clipTimer = null;

  function ensureAudioCtx() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }

  function stopSpeech() {
    speechToken++;
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    clipSources.forEach(function (s) { try { s.stop(); } catch (e) {} });
    clipSources = [];
    if (clipTimer) { clearTimeout(clipTimer); clipTimer = null; }
  }

  /* Fragment names for a count, mirroring E.describeCount exactly. */
  function fragmentsFor(n, sayZeroTens) {
    var pv = E.placeValue(n);
    var frags = [];
    if (pv.hundreds > 0) frags.push('hundreds-' + pv.hundreds);
    if (pv.tens > 0) frags.push('tens-' + pv.tens);
    else if (pv.ones > 0 && sayZeroTens && pv.hundreds === 0) frags.push('tens-0');
    if (pv.tens > 0) { if (pv.ones > 0) frags.push('ones-' + pv.ones); }
    else if (pv.ones > 0) frags.push('ones-' + pv.ones);
    if (frags.length === 0) frags.push('zero');
    return frags;
  }

  /* The word each clip says, so the fallback speech and the captions can
   * be built from the same fragments the clips play. */
  var FRAG_WORDS = {
    'zero': 'zero',
    'tens-0': 'zero tens', 'tens-1': 'one ten', 'tens-2': 'two tens', 'tens-3': 'three tens',
    'tens-4': 'four tens', 'tens-5': 'five tens', 'tens-6': 'six tens', 'tens-7': 'seven tens',
    'tens-8': 'eight tens', 'tens-9': 'nine tens',
    'ones-0': 'zero ones', 'ones-1': 'one one', 'ones-2': 'two ones', 'ones-3': 'three ones',
    'ones-4': 'four ones', 'ones-5': 'five ones', 'ones-6': 'six ones', 'ones-7': 'seven ones',
    'ones-8': 'eight ones', 'ones-9': 'nine ones',
    'hundreds-0': 'zero hundreds', 'hundreds-1': 'one hundred', 'hundreds-2': 'two hundreds',
    'hundreds-3': 'three hundreds', 'hundreds-4': 'four hundreds', 'hundreds-5': 'five hundreds',
    'hundreds-6': 'six hundreds', 'hundreds-7': 'seven hundreds', 'hundreds-8': 'eight hundreds',
    'hundreds-9': 'nine hundreds',
    'answer': 'The answer is'
  };
  function fragsText(frags) { return frags.map(function (f) { return FRAG_WORDS[f]; }).join(', '); }

  /* Only the place that just changed — the changing place is what the
   * children should be counting, not the places that stayed the same.
   * A tens move speaks only the tens, a ones move only the ones, a
   * hundred move only the hundreds; when a place runs out it is named
   * once ("zero tens" / "zero ones" / "zero hundreds"). The full count
   * is still always visible in the panels, and the answer is spoken
   * in full. */
  function changingFragments(n, amount) {
    var pv = E.placeValue(n);
    if (amount === 100) {
      if (pv.hundreds > 0) return ['hundreds-' + pv.hundreds];
      return ['hundreds-0'];
    }
    if (amount === 10) {
      if (pv.tens > 0) return ['tens-' + pv.tens];
      return ['tens-0'];
    }
    if (pv.ones > 0) return ['ones-' + pv.ones];
    return ['ones-0'];
  }

  var CLIP_FRAGS = ['tens-0', 'tens-1', 'tens-2', 'tens-3', 'tens-4', 'tens-5', 'tens-6', 'tens-7', 'tens-8', 'tens-9',
    'ones-0', 'ones-1', 'ones-2', 'ones-3', 'ones-4', 'ones-5', 'ones-6', 'ones-7', 'ones-8', 'ones-9',
    'hundreds-0', 'hundreds-1', 'hundreds-2', 'hundreds-3', 'hundreds-4', 'hundreds-5', 'hundreds-6', 'hundreds-7', 'hundreds-8', 'hundreds-9',
    'zero'];

  /* Fetch + decode every clip in the background; playback uses whatever is
   * ready and falls back to device speech for the rest. Fetching is silent
   * (no gesture needed); only playing needs the tap that already happened. */
  function preloadClips() {
    if (clipsPreloading) return;
    clipsPreloading = true;
    if (typeof fetch !== 'function') return;
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    ['boy', 'girl'].forEach(function (kind) {
      CLIP_FRAGS.forEach(function (f) { loadClip(ctx, kind, f); });
    });
    loadClip(ctx, 'girl', 'answer');
  }
  function loadClip(ctx, kind, frag) {
    var key = kind + ':' + frag;
    fetch('audio/' + kind + '/' + frag + '.mp3').then(function (r) {
      if (!r.ok) throw new Error('missing clip ' + key);
      return r.arrayBuffer();
    }).then(function (buf) { return ctx.decodeAudioData(buf); })
    .then(function (decoded) { clipBuffers[key] = decoded; })
    .catch(function () { clipBuffers[key] = false; });
  }

  /* One side's count, spoken in its voice. Clips when every fragment is
   * buffered, device speech otherwise. Resolves when the phrase ends.
   * p.frags is the exact fragment list to play (changing place, or the
   * full count for the answer); p.text is the same words, for the
   * device-speech fallback and for nothing else. */
  function playPhrase(p, token) {
    if (!soundOn) return Promise.resolve();
    var frags = p.frags;
    var ctx = ensureAudioCtx();
    var ready = ctx && frags.every(function (f) { return clipBuffers[p.kind + ':' + f]; });
    if (ready) {
      var t = ctx.currentTime + 0.05;
      frags.forEach(function (f) {
        var src = ctx.createBufferSource();
        src.buffer = clipBuffers[p.kind + ':' + f];
        src.connect(ctx.destination);
        src.start(t);
        clipSources.push(src);
        t += src.buffer.duration + 0.18;
      });
      var total = Math.max(0, (t - ctx.currentTime) * 1000);
      return new Promise(function (res) {
        clipTimer = setTimeout(function () { clipTimer = null; res(); }, total);
      });
    }
    return new Promise(function (res) {
      speakUtterance(p.text, p.kind, token, res);
    });
  }

  /* Device speech for one phrase (fallback when clips are not ready). */
  function speakUtterance(text, kind, token, done) {
    if (!soundOn || !('speechSynthesis' in window)) { done(); return; }
    var vs = pickVoices();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.88;
    u.pitch = kind === 'boy' ? 0.85 : 1.3;
    var v = kind === 'boy' ? vs.boy : vs.girl;
    if (v) u.voice = v;
    u.onend = function () { done(); };
    u.onerror = function () { done(); };
    try { window.speechSynthesis.speak(u); } catch (e) { done(); }
  }

  function pickVoices() {
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

  /* Play phrases in order: [{kind, frags, text}]. Captions are set by
   * the caller at the same time, so words and screen agree. */
  function playPhrases(list) {
    if (!soundOn) return;
    var token = speechToken;
    var i = 0;
    function next() {
      if (token !== speechToken || i >= list.length) return;
      var p = list[i++];
      playPhrase(p, token).then(function () { next(); });
    }
    next();
  }

  /* Whether this side gets the one-time "zero tens" transition phrase:
   * its tens have just run out and this is the first time. */
  function zeroTensFlag(n, side) {
    var pv = E.placeValue(n);
    var said = side === 'left' ? leftZeroTensSaid : rightZeroTensSaid;
    var prev = side === 'left' ? prevLeftTens : prevRightTens;
    var say = pv.tens === 0 && pv.ones > 0 && !said && prev !== null && prev > 0;
    if (say) { if (side === 'left') leftZeroTensSaid = true; else rightZeroTensSaid = true; }
    if (side === 'left') prevLeftTens = pv.tens; else prevRightTens = pv.tens;
    return say;
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
  function boomSound() { blip(170, 0.3, 'sine', 0.12); setTimeout(function () { blip(95, 0.35, 'sine', 0.12); }, 110); popSound(); }
  /* A rising whoosh as the rows leave — the sound of the flight. */
  function whooshSound() {
    if (!soundOn) return;
    try {
      var ctx = ensureAudioCtx(); if (!ctx) return;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(280, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(920, ctx.currentTime + 0.45);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.55);
    } catch (e) {}
  }
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
    if (n === 0) return 'zero';
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

  /* The quantity panels are labelled by colour, never by a child's name:
   * the piles stay lopsided the whole game, and a name on the bigger pile
   * reads as "they have more than me". */
  function renderWho() {
    var T = THEMES[theme];
    var leftWho = $('.side.left .who-label');
    var rightWho = $('.side.right .who-label');
    if (leftWho) leftWho.textContent = T.leftColor + ' ' + T.things;
    if (rightWho) rightWho.textContent = T.rightColor + ' ' + T.things;
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
    renderCancelled();
    if (solved || stepIndex >= solution.moves.length) {
      nextChip.innerHTML = 'All cancelled! 🎉';
      return;
    }
    var amt = solution.moves[stepIndex];
    nextChip.innerHTML = 'Next: <span class="amt">' + E.describeMove(amt) + '</span> from each side — tap a place!';
  }

  /* What has been cancelled so far, in place-value words — the moves
   * already made, added up: two tens and three ones is the 27 coming
   * apart as the children play it. */
  function renderCancelled() {
    var cancelled = solution.b - solution.states[stepIndex].right;
    if (cancelled > 0) {
      cancelledTally.textContent = 'Cancelled: ' + E.captionCount(cancelled);
      cancelledTally.hidden = false;
    } else {
      cancelledTally.hidden = true;
    }
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

  /* After a move, only the place that just changed is counted — the
   * changing place is the counting; the rest is already on screen.
   * No name tags on the lines: the voices don't belong to the kids,
   * and the two lines are told apart by colour and order, left then
   * right. (The answer is still spoken — and captioned — in full.) */
  function sayCounts(amount) {
    var st = solution.states[stepIndex];
    var lz = zeroTensFlag(st.left, 'left');
    var rz = zeroTensFlag(st.right, 'right');
    var leftFrags, rightFrags;
    if (amount === 1 || amount === 10 || amount === 100) {
      leftFrags = changingFragments(st.left, amount);
      rightFrags = changingFragments(st.right, amount);
    } else {
      leftFrags = fragmentsFor(st.left, lz);
      rightFrags = fragmentsFor(st.right, rz);
    }
    var leftText = fragsText(leftFrags);
    var rightText = fragsText(rightFrags);
    setCaption([
      { cls: 'left-voice', text: leftText + '.' },
      { cls: 'right-voice', text: rightText + '.' }
    ]);
    playPhrases([
      { kind: 'boy', frags: leftFrags, text: leftText },
      { kind: 'girl', frags: rightFrags, text: rightText }
    ]);
  }

  function speakAnswer(answer) {
    var phrase = E.describeCount(answer, false);
    playPhrases([{ kind: 'girl', frags: ['answer'].concat(fragmentsFor(answer, false)), text: 'The answer is ' + phrase + '!' }]);
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

  /* Lift the objects for one move. A move NEVER splits a row: a ten lifts
   * one whole ten-row, a hundred lifts ten whole ten-rows, a one lifts a
   * single object. The rows taken are the last complete rows, so the
   * leftover ones stay put at the bottom and children see a whole group
   * of ten leave — never a partial row here and a partial row there.
   * (Always possible: a ten-move only happens while the side holds at
   * least ten, a hundred-move while it holds at least a hundred.)
   * Returns the fixed wrappers. The nodes are the REAL objects, so the
   * children watch the actual cars/mermaids leave — nothing teleports. */
  function liftObjects(grid, amount) {
    // The glow colour is the place that is moving: blue for a ten,
    // orange for a one, purple for a hundred — the same colours as the
    // digits, so the flight and the numbers teach the same thing.
    var glow = amount === 100 ? 'glow-hun' : amount === 10 ? 'glow-ten' : 'glow-one';
    var wraps = [];
    if (amount === 1) {
      var objs = $all('.obj', grid);
      var last = objs[objs.length - 1];
      wraps.push(wrapNodes([last], last.parentNode, glow));
      return wraps;
    }
    var need = amount / 10; // 1 whole row for a ten, 10 for a hundred
    var fullRows = $all('.ten-row', grid).filter(function (r) { return r.children.length === 10; });
    fullRows.slice(-need).forEach(function (row) {
      wraps.push(wrapNodes($all('.obj', row), row, glow));
    });
    return wraps;
  }

  /* Move real nodes into a fixed wrapper at their current screen spot. */
  function wrapNodes(nodes, row, glow) {
    var first = nodes[0].getBoundingClientRect();
    var last = nodes[nodes.length - 1].getBoundingClientRect();
    // 'telegraph': the row glows in place a beat before it flies, so the
    // eye is already on the right group when it leaves.
    var wrap = el('div', 'flying flying-row telegraph' + (glow ? ' ' + glow : ''));
    wrap.style.left = first.left + 'px';
    wrap.style.top = first.top + 'px';
    wrap.style.width = (last.right - first.left) + 'px';
    wrap.style.height = first.height + 'px';
    wrap.style.gridTemplateColumns = 'repeat(' + nodes.length + ', 1fr)';
    nodes.forEach(function (n) { wrap.appendChild(n); });
    if (row && !row.hasChildNodes()) row.remove();
    document.body.appendChild(wrap);
    return wrap;
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

  /* The collision: two whole rows meeting at the landmark explode into a
   * double burst of the landmark's magic plus star-bursts, and the
   * landmark itself thumps. Single objects keep the small burst above. */
  function bigBurst(landmarkEl, lm, amount) {
    burst(landmarkEl, lm.fx.concat(['💥', '⭐', '💥']));
    setTimeout(function () { burst(landmarkEl, ['💥', '✨', '⭐', '💥']); }, 130);
    shockwave(landmarkEl);
    if (amount >= 100) {
      // A hundred is the biggest smash in the game: a third burst and a
      // little shake of the whole page.
      setTimeout(function () { burst(landmarkEl, ['💥', '⭐', '✨', '💥']); }, 260);
      var page = document.querySelector('.page');
      if (page) {
        page.classList.add('shake');
        setTimeout(function () { page.classList.remove('shake'); }, 350);
      }
    }
    landmarkEl.classList.add('boom');
    setTimeout(function () { landmarkEl.classList.remove('boom'); }, 550);
  }

  /* An expanding ring at the collision point — the smash, drawn. */
  function shockwave(landmarkEl) {
    var host = landscapeEl;
    var r = landmarkEl.getBoundingClientRect();
    var hr = host.getBoundingClientRect();
    var s = el('span', 'shockwave');
    s.style.left = (r.left - hr.left + r.width / 2) + 'px';
    s.style.top = (r.top - hr.top + r.height / 2) + 'px';
    host.appendChild(s);
    setTimeout(function () { s.remove(); }, 650);
  }

  /* A few sparkles trail behind a flying row, so the flight reads as
   * magic in motion — only for the big moves; ones stay quiet. */
  function trailSparkles(wrappers) {
    [0, 160, 320].forEach(function (delay) {
      setTimeout(function () {
        wrappers.forEach(function (w) {
          if (!w.isConnected) return;
          var r = w.getBoundingClientRect();
          var s = el('span', 'trail', '✨');
          s.style.left = (r.left + Math.random() * r.width) + 'px';
          s.style.top = (r.top + Math.random() * r.height) + 'px';
          document.body.appendChild(s);
          setTimeout(function () { s.remove(); }, 750);
        });
      }, delay);
    });
  }

  /* A tiny buzz when the rows collide — phones only, harmless elsewhere. */
  function vibrate(amount) {
    try { if (navigator.vibrate) navigator.vibrate(amount >= 10 ? 30 : 12); } catch (e) {}
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
    // Whole rows meet at the landmark: both rows leave at once and arrive
    // together, so they smash into each other and explode. Single objects
    // keep the gentle stagger they already had. Every flight waits a
    // beat (the telegraph) so the glowing row is seen before it goes.
    var TELEGRAPH = 260;
    leftWraps.forEach(function (w) { flights.push(flyTo(w, target, TELEGRAPH)); });
    rightWraps.forEach(function (w) { flights.push(flyTo(w, target, TELEGRAPH + (amount >= 10 ? 0 : 90))); });
    whooshSound();
    if (amount >= 10) trailSparkles(leftWraps.concat(rightWraps));
    btn.classList.add('busy');
    setTimeout(function () { btn.classList.remove('busy'); }, 950);
    Promise.all(flights).then(function () {
      if (amount >= 10) { bigBurst(btn, lm, amount); boomSound(); }
      else { burst(btn, lm.fx); popSound(); }
      vibrate(amount);
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
        sayCounts(amount);
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
    speakAnswer(answer);
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
        { cls: 'note', text: 'The two voices will count the place that just changed — tens first, then ones.' }
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
    renderWho();
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
    cancelledTally = $('#cancelled-tally');

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
      else preloadClips();
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
    renderWho();
    if (specific) newProblem(specific.a, specific.b, { announce: false });
    else newRandomProblem(false);

    // Warm up the voice list (some browsers load it late).
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () {};
    }
    if (soundOn) preloadClips();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
