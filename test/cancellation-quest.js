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
        { id: 'castle', art: '🏰', name: 'Castle', hint: 'magic sparkles!', fx: ['✨', '💫', '⭐'], strip: 'above' },
        { id: 'tree', art: '🌳', name: 'Magic Tree', hint: 'swirling leaves!', fx: ['🍃', '🍂', '🌿'], strip: 'above' },
        { id: 'hill', art: '☀️', name: 'Sunny Hill', hint: 'sunny and warm!', fx: ['☀️', '🌼', '✨'], strip: 'above' },
        { id: 'track', art: '🏁', name: 'Race Track', hint: 'zoom around!', fx: ['🏁', '💨', '⭐'], strip: 'above' },
        { id: 'volcano', art: '🌋', name: 'Volcano', hint: 'poof in a puff!', fx: ['🔥', '⭐', '💥'], strip: 'below' },
        { id: 'wash', art: '🫧', name: 'Car Wash', hint: 'bubbles pop!', fx: ['🫧', '💧', '✨'], strip: 'below' },
        { id: 'station', art: '⛽', name: 'Gas Station', hint: 'fill up and go!', fx: ['⛽', '💛', '✨'], strip: 'below' },
        { id: 'bridge', art: '🌉', name: 'Bridge', hint: 'over the river!', fx: ['🌉', '💧', '⭐'], strip: 'below' }
      ]
    },
    mermaids: {
      label: "Aliya's Mermaid World", thing: 'mermaid', things: 'mermaids',
      leftName: 'Ayan', rightName: 'Aliya',
      leftSym: 'mermaid-teal', rightSym: 'mermaid-pink',
      emoji: '🧜‍♀️', // the same mermaid emoji as on Aliya's theme button
      leftColor: 'Teal', rightColor: 'Pink',
      landmarks: [
        { id: 'palace', art: '🏰', name: 'Palace', hint: 'pearl sparkles!', fx: ['✨', '🤍', '💫'], strip: 'above' },
        { id: 'whirlpool', art: '🌀', name: 'Whirlpool', hint: 'round and round!', fx: ['🌀', '💧', '🫧'], strip: 'above' },
        { id: 'turtle', art: '🐢', name: 'Turtle Rock', hint: 'slow and steady!', fx: ['🐢', '⭐', '🫧'], strip: 'above' },
        { id: 'cove', art: '🐬', name: 'Dolphin Cove', hint: 'dolphins jump!', fx: ['🐬', '💧', '✨'], strip: 'above' },
        { id: 'reef', art: '🪸', name: 'Coral Reef', hint: 'bubbles bloom!', fx: ['🫧', '🪸', '✨'], strip: 'below' },
        { id: 'shell', art: '🐚', name: 'Giant Shell', hint: 'a pearl pops out!', fx: ['🤍', '✨', '⭐'], strip: 'below' },
        { id: 'wreck', art: '⚓', name: 'Shipwreck', hint: 'sunken treasure!', fx: ['⚓', '💰', '✨'], strip: 'below' },
        { id: 'chest', art: '💰', name: 'Treasure Chest', hint: 'gold inside!', fx: ['💰', '✨', '⭐'], strip: 'below' }
      ]
    }
  };


  /* Storybook scene (A★), one per theme, painted INSIDE each panel
   * behind the grid: a winding dirt path through a meadow for cars,
   * a sandy sea floor with shells, starfish and bubbles for mermaids.
   * Verbatim from the Phase 3 refined concept pages. The SVG stretches
   * with the grid (preserveAspectRatio="none") so it fits R rows. */
  var SCENE_SVG = {
    cars: '<svg class="scene" viewBox="0 0 162 220" preserveAspectRatio="none" aria-hidden="true"><path d="M81 0 C 30 45 140 80 81 120 C 30 155 120 185 81 220" fill="none" stroke="#e8c98a" stroke-width="14" stroke-linecap="round" opacity="0.55"/><path d="M81 0 C 30 45 140 80 81 120 C 30 155 120 185 81 220" fill="none" stroke="#d9b36c" stroke-width="2" stroke-dasharray="7 9" opacity="0.7"/><g fill="#ff8fb3"><circle cx="12" cy="96" r="3"/><circle cx="150" cy="70" r="3"/><circle cx="140" cy="150" r="3"/></g><g fill="#fff"><circle cx="12" cy="96" r="1.2"/><circle cx="150" cy="70" r="1.2"/><circle cx="140" cy="150" r="1.2"/></g><g fill="#7fc96b"><circle cx="24" cy="130" r="3"/><circle cx="138" cy="104" r="3"/></g></svg>',
    mermaids: '<svg class="scene" viewBox="0 0 162 220" preserveAspectRatio="none" aria-hidden="true"><g stroke="#d9bd7a" stroke-width="2" fill="none" opacity="0.8"><path d="M0 190 Q 40 182 81 190 T 162 190"/><path d="M0 200 Q 40 192 81 200 T 162 200"/><path d="M0 210 Q 40 202 81 210 T 162 210"/></g><g fill="#ffb3c8"><path d="M18 92 l3 6 6 1 -4 5 1 6 -6 -3 -6 3 1 -6 -4 -5 6 -1z"/><path d="M142 128 l3 6 6 1 -4 5 1 6 -6 -3 -6 3 1 -6 -4 -5 6 -1z"/></g><g fill="#fff" opacity="0.85"><circle cx="130" cy="60" r="3.5"/><circle cx="140" cy="78" r="2.5"/><circle cx="26" cy="150" r="3"/><circle cx="36" cy="166" r="2.2"/></g><g fill="#ff9a3d"><path d="M148 88 l2.5 5 5 1 -3.5 4 1 5 -5 -2.5 -5 2.5 1 -5 -3.5 -4 5 -1z"/></g><g fill="#e85a9b"><circle cx="14" cy="60" r="4"/><circle cx="14" cy="60" r="1.6" fill="#fff"/></g></svg>'
  };

  /* ---------- state ---------- */
  var theme = 'cars';
  var level = 'easy';
  var soundOn = true;
  var solution = null;      // engine result for the current problem
  var stepIndex = 0;        // next move to play
  var animating = false;
  var phase = 'ready';
  var cancelPlayback = null;
  var solved = false;
  var speechToken = 0;      // invalidates in-flight speech
  var audioCtx = null;
  var leftZeroTensSaid = false, rightZeroTensSaid = false;
  var prevLeftTens = null, prevRightTens = null;

  var eqA, eqB, eqQ, leftNum, rightNum, leftCap, rightCap, leftGrid, rightGrid,
      leftSide, rightSide, captionBar, nextChip, newMysteryBtn, cheerEl, celebrateBanner,
      pageEl, aboveEl, belowEl, cancelledTally;

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
    if (cancelPlayback) cancelPlayback();
    clearEmphasis();
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
  function clearEmphasis() {
    $all('.speaking').forEach(function (n) { n.classList.remove('speaking'); });
  }
  /* Which objects a fragment names: N tens are the first N rows of ten in
   * that side's pool, N ones are the last N single objects, N hundreds
   * are the first N hundreds. A "zero tens" names no objects. */
  function objectsForFrag(grid, frag) {
    var m = frag.match(/^(hundreds|tens|ones)-(\d)$/);
    if (!m) return [];
    var n = Number(m[2]);
    if (n === 0) return [];
    var nodes = $all('.obj', grid);
    if (m[1] === 'ones') return nodes.slice(-n);
    return nodes.slice(0, n * (m[1] === 'hundreds' ? 100 : 10));
  }

  function emphasize(p, frag) {
    clearEmphasis();
    var side = p.answer ? 'left' : p.kind === 'boy' ? 'left' : 'right';
    var grid = side === 'left' ? leftGrid : rightGrid;
    if (frag === 'answer') {
      // The whole answer first: the full number, and every object left in
      // the pool — then its tens, then its ones, in that order.
      eqQ.classList.add('speaking');
      $all('.obj', grid).forEach(function (n) { n.classList.add('speaking'); });
      var answerLine = $('.left-voice', captionBar);
      if (answerLine) answerLine.classList.add('speaking');
      return;
    }
    var num = p.answer ? eqQ : p.kind === 'boy' ? leftNum : rightNum;
    var cls = frag.indexOf('hundreds') === 0 ? '.d-hun' : frag.indexOf('tens') === 0 ? '.d-tens' : '.d-ones';
    var cap = p.kind === 'boy' ? leftCap : rightCap;
    var digit = $(cls, num) || (frag === 'tens-0' ? $('.t', cap) : null) || num;
    digit.classList.add('speaking');
    var line = $((p.kind === 'girl' && !p.answer) ? '.right-voice' : '.left-voice', captionBar);
    if (line) line.classList.add('speaking');
    // And the actual objects this place names, in that side's pool.
    objectsForFrag(grid, frag).forEach(function (n) { n.classList.add('speaking'); });
  }

  // Each short recorded fragment completes via onended. Synthesized
  // fragments use actual start/boundary/end events, never guessed timing.
  function playFragment(p, frag, token) {
    if (!soundOn || token !== speechToken) return Promise.resolve();
    return new Promise(function (resolve) {
      var finished = false, src = null, utterance = null;
      var watchdog = setTimeout(function () {
        // Failure recovery only, not synchronization. Stop failed audio
        // before releasing the queue so it cannot overlap the next phrase.
        soundOn = false;
        var toggle = $('#sound-toggle');
        if (toggle) { toggle.textContent = '🔇 Tap to retry sound'; toggle.setAttribute('aria-pressed', 'false'); }
        finish(true);
      }, 8000);
      function finish(abort) {
        if (finished) return;
        finished = true;
        clearTimeout(watchdog);
        if (abort) {
          if (src) { try { src.stop(); } catch (e) {} }
          if (utterance) { try { window.speechSynthesis.cancel(); } catch (e) {} }
        }
        if (src) { src.disconnect(); clipSources = clipSources.filter(function (s) { return s !== src; }); }
        cancelPlayback = null;
        clearEmphasis();
        resolve();
      }
      cancelPlayback = function () { finish(true); };
      var ctx = ensureAudioCtx();
      var buffer = clipBuffers[p.kind + ':' + frag];
      if (ctx && ctx.state === 'running' && buffer) {
        try {
          src = ctx.createBufferSource(); src.buffer = buffer;
          src.connect(ctx.destination); clipSources.push(src);
          src.onended = function () { finish(false); };
          src.start(); emphasize(p, frag);
          return;
        } catch (e) { finish(true); return; }
      }
      if (!('speechSynthesis' in window)) { finish(false); return; }
      try {
        utterance = new SpeechSynthesisUtterance(FRAG_WORDS[frag]);
        var vs = pickVoices();
        utterance.lang = 'en-US'; utterance.rate = 0.88;
        utterance.pitch = p.kind === 'boy' ? 0.85 : 1.3;
        if (vs[p.kind]) utterance.voice = vs[p.kind];
        utterance.onstart = utterance.onboundary = function () { if (!finished) emphasize(p, frag); };
        utterance.onend = utterance.onerror = function () { finish(false); };
        window.speechSynthesis.speak(utterance);
      } catch (e) { finish(true); }
    });
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
  async function playPhrases(list) {
    var token = speechToken;
    for (var p of list) {
      for (var frag of p.frags) {
        if (token !== speechToken) return;
        await playFragment(p, frag, token);
      }
    }
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
    if (pv.tens >= 0) parts.push('<span class="t">' + pv.tens + ' ten' + (pv.tens !== 1 ? 's' : '') + '</span>');
    if (pv.ones > 0 || parts.length === 0) parts.push('<span class="o">' + pv.ones + ' one' + (pv.ones === 1 ? '' : 's') + '</span>');
    return parts.join(' · ');
  }

  function buildGrid(grid, count, sym, emoji) {
    // Created only at problem/theme initialization. Survivors retain DOM identity.
    grid.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var obj = el('span', 'obj'); obj.dataset.id = i;
      if (emoji) { obj.classList.add('emoji'); obj.textContent = emoji; }
      else obj.innerHTML = '<svg viewBox="' + (sym.indexOf('mermaid') === 0 ? '0 0 44 30' : '0 0 44 26') + '" aria-hidden="true"><use href="#' + sym + '"></use></svg>';
      grid.appendChild(obj);
    }
  }
  function layoutPools(animate, beforeAlignment) {
    var layout = window.CancellationLayout.plan(solution, stepIndex, beforeAlignment);
    var jobs = [];
    ['left', 'right'].forEach(function (side) {
      var grid = side === 'left' ? leftGrid : rightGrid;
      var byId = new Map($all('.obj', grid).map(function (n) { return [Number(n.dataset.id), n]; }));
      var positions = layout[side];
      var width = grid.clientWidth / 10;
      var rowHeight = theme === 'mermaids' ? Math.max(20, width * 30 / 44 + 8) : Math.max(22, width * .65 + 10);
      grid.style.height = (layout.rows * rowHeight) + 'px';
      grid.classList.toggle('empty', positions.length === 0);
      // Storybook scene (A★): repaint the backdrop + one band per row
      // from the current plan, behind the objects. A row holding ten
      // objects is a ten band, a row holding a few is the ones band,
      // an empty row is unpainted so the scene shows through. Rebuilt
      // on every layout so the bands track the rows and counts at
      // every step. These are <div>/<svg> decoration, never .obj.
      var deco = grid.querySelectorAll('.scene, .rowband');
      for (var di = 0; di < deco.length; di++) deco[di].remove();
      var perRow = {};
      positions.forEach(function (p) { perRow[p.y] = (perRow[p.y] || 0) + 1; });
      var decoHtml = SCENE_SVG[theme];
      for (var ry = 0; ry < layout.rows; ry++) {
        var bandCls = perRow[ry] === 10 ? 'ten' : perRow[ry] ? 'one' : 'empty';
        decoHtml += '<div class="rowband ' + bandCls + '" style="top:' + (ry * rowHeight) + 'px;height:' + rowHeight + 'px"></div>';
      }
      grid.insertAdjacentHTML('afterbegin', decoHtml);

      positions.forEach(function (pos) {
        var n = byId.get(pos.id);
        var old = n.style.transform;
        var target = 'translate(' + (pos.x * width) + 'px,' + (pos.y * rowHeight) + 'px)';
        n.style.width = width + 'px'; n.style.height = (rowHeight - 8) + 'px';
        if (n.classList.contains('emoji')) n.style.fontSize = Math.max(10, Math.round(Math.min(width, rowHeight - 8) * 0.9)) + 'px';
        n.dataset.x = pos.x; n.dataset.y = pos.y;
        n.style.transform = target;
        if (animate && old && old !== target && n.animate) {
          jobs.push(n.animate([{ transform: old }, { transform: target }], {
            duration: reducedMotion() ? 100 : 620, easing: 'cubic-bezier(.25,.7,.3,1)'
          }).finished.catch(function () {}));
        }
      });
    });
    return Promise.all(jobs);
  }
  function selectedObjects(amount) {
    return [leftGrid, rightGrid].flatMap(function (grid) {
      var nodes = $all('.obj', grid);
      return amount === 1 ? nodes.slice(-1) : nodes.slice(0, amount);
    });
  }
  function setPhase(value) {
    phase = value; animating = value !== 'ready' && value !== 'complete';
    document.body.dataset.phase = phase;
    updateLandmarkState();
    var status = $('#progress-status');
    if (status) status.textContent = phase === 'narrating' ? 'Listen to the count…' :
      phase === 'moving' ? 'Watch them move together…' : phase === 'celebrating' ? 'You found the answer!' : '';
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
    // Mermaid objects are the N1 SVG now, not the picker emoji —
    // the emoji field stays for Aliya's theme BUTTON only.
    if (!flash) buildGrid(grid, value, sym, theme === 'mermaids' ? null : T.emoji);
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
    return playPhrases([
      { kind: 'boy', frags: leftFrags, text: leftText },
      { kind: 'girl', frags: rightFrags, text: rightText }
    ]);
  }

  function speakAnswer(answer) {
    var phrase = E.describeCount(answer, false);
    return playPhrases([{ kind: 'girl', answer: true, frags: ['answer'].concat(fragmentsFor(answer, false)), text: 'The answer is ' + phrase + '!' }]);
  }

  /* ---------- landmarks ----------
   * Eight landmarks in two tight rows hugging the panels — four above,
   * four below — instead of scattered around the page. Compactness is
   * the point: the equation, the landmarks and the panels read as one
   * tight display. */
  function buildLandmarks() {
    var T = THEMES[theme];
    // [strip element, landmarks whose strip matches]
    var zones = [
      { el: aboveEl, strip: 'above' },
      { el: belowEl, strip: 'below' }
    ];
    zones.forEach(function (zone) {
      if (!zone.el) return;
      zone.el.innerHTML = '';
      T.landmarks.filter(function (lm) { return lm.strip === zone.strip; }).forEach(function (lm) {
        var b = el('button', 'landmark');
        b.type = 'button';
        b.dataset.landmark = lm.id;
        b.setAttribute('aria-label', lm.name + ' — tap here to cancel ' + THEMES[theme].things);
        b.innerHTML = '<span class="art" aria-hidden="true">' + '<img src="art/landmarks/' + lm.id + '.png?v=5" width="28" height="28" alt="" draggable="false">' + '</span>' +
          '<span class="name">' + lm.name + '</span>' +
          '<span class="hint">' + lm.hint + '</span>';
        b.addEventListener('click', function () { onLandmark(b, lm); });
        zone.el.appendChild(b);
      });
    });
    updateLandmarkState();
  }

  function updateLandmarkState() {
    $all('.landmark').forEach(function (b) {
      b.disabled = animating || solved;
      b.classList.toggle('nudge', !animating && !solved && stepIndex === 0);
    });
    $all('.theme-pill, .level-pill, .test-problem').forEach(function (b) { b.disabled = animating; });
    newMysteryBtn.disabled = animating || !solved;
  }

  function burst(landmarkEl, chars) {
    // Collision bursts are hosted by the page (landmarks live in two
    // different strips now), so they are positioned against the page.
    var host = pageEl;
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
    var host = pageEl;
    var r = landmarkEl.getBoundingClientRect();
    var hr = host.getBoundingClientRect();
    var s = el('span', 'shockwave');
    s.style.left = (r.left - hr.left + r.width / 2) + 'px';
    s.style.top = (r.top - hr.top + r.height / 2) + 'px';
    host.appendChild(s);
    setTimeout(function () { s.remove(); }, 650);
  }

  /* A tiny buzz when the rows collide — phones only, harmless elsewhere. */
  function vibrate(amount) {
    try { if (navigator.vibrate) navigator.vibrate(amount >= 10 ? 30 : 12); } catch (e) {}
  }

  /* ---------- flight to the pressed button ----------
   * The cancellation first shows in place: the matching objects sit
   * highlighted in their aligned positions while the amount is narrated,
   * so it is obvious exactly which ones cancel. Then the REAL objects
   * lift off together — one whole group per side, never a partial row —
   * and fly down to the landmark the kid just tapped, arriving together
   * to collide and explode there. Only then do the survivors slide up
   * together to take their place. */
  function liftObjects(grid, amount) {
    // The glow colour is the place that is moving: blue for a ten,
    // orange for a one, purple for a hundred — the same colours as the
    // digits, so the flight and the numbers teach the same thing.
    var glow = amount === 100 ? 'glow-hun' : amount === 10 ? 'glow-ten' : 'glow-one';
    var nodes = $all('.obj', grid);
    // Same picks as selectedObjects: a whole top row for a ten, the whole
    // top ten rows for a hundred, the last single object for a one.
    var picked = amount === 1 ? nodes.slice(-1) : nodes.slice(0, amount);
    if (!picked.length) return null;
    var rects = picked.map(function (n) { return n.getBoundingClientRect(); });
    var left = Math.min.apply(null, rects.map(function (r) { return r.left; }));
    var top = Math.min.apply(null, rects.map(function (r) { return r.top; }));
    var right = Math.max.apply(null, rects.map(function (r) { return r.right; }));
    var bottom = Math.max.apply(null, rects.map(function (r) { return r.bottom; }));
    var wrap = el('div', 'flying telegraph ' + glow);
    wrap.style.left = left + 'px';
    wrap.style.top = top + 'px';
    wrap.style.width = (right - left) + 'px';
    wrap.style.height = (bottom - top) + 'px';
    picked.forEach(function (n, i) {
      var r = rects[i];
      n.style.position = 'absolute';
      n.style.left = (r.left - left) + 'px';
      n.style.top = (r.top - top) + 'px';
      n.style.width = r.width + 'px';
      n.style.height = r.height + 'px';
      n.style.transform = 'none';
      var svg = n.querySelector('svg');
      if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; }
      wrap.appendChild(n);
    });
    document.body.appendChild(wrap);
    return wrap;
  }

  /* Fly one whole group to the pressed landmark. Both sides start at the
   * same moment with the same timing, so they arrive together and smash
   * into each other — never one after the other. */
  function flyTo(wrapper, targetRect, delay) {
    if (!wrapper) return Promise.resolve();
    var r = wrapper.getBoundingClientRect();
    var dx = targetRect.left + targetRect.width / 2 - (r.left + r.width / 2);
    var dy = targetRect.top + targetRect.height / 2 - (r.top + r.height / 2);
    var dur = reducedMotion() ? 180 : 620;
    if (!wrapper.animate) { wrapper.remove(); return Promise.resolve(); }
    var anim = wrapper.animate([
      { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 64) + 'px) scale(1.06) rotate(-3deg)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.3)', opacity: 0.85 }
    ], { duration: dur, delay: delay, easing: 'ease-in-out', fill: 'forwards' });
    return anim.finished.catch(function () {}).then(function () { wrapper.remove(); });
  }

  /* A few sparkles trail behind a flying group, so the flight reads as
   * magic in motion — only for the big moves; ones stay quiet. */
  function trailSparkles(wrappers) {
    [0, 160, 320].forEach(function (delay) {
      setTimeout(function () {
        wrappers.forEach(function (w) {
          if (!w || !w.isConnected) return;
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

  /* ---------- one cancellation tap ---------- */
  async function onLandmark(btn, lm) {
    if (animating || solved || stepIndex >= solution.moves.length) return;
    ensureAudioCtx();
    setPhase('moving');
    var amount = solution.moves[stepIndex];
    // No announcement of the amount: the matching objects just light up in
    // place for a beat (the telegraph), then fly to the button. The counting
    // afterwards still names the new totals, tens then ones.
    var TELEGRAPH = 260;
    try {
      selectedObjects(amount).forEach(function (n) { n.classList.add('speaking'); });
      nextChip.classList.add('speaking');
      var target = btn.getBoundingClientRect();
      var leftWrap = liftObjects(leftGrid, amount);
      var rightWrap = liftObjects(rightGrid, amount);
      var flights = [flyTo(leftWrap, target, TELEGRAPH), flyTo(rightWrap, target, TELEGRAPH)];
      whooshSound();
      if (amount >= 10) trailSparkles([leftWrap, rightWrap]);
      await Promise.all(flights);
      if (amount >= 10) { bigBurst(btn, lm, amount); boomSound(); }
      else { burst(btn, lm.fx); popSound(); }
      vibrate(amount);
      stepIndex++;
      var st = solution.states[stepIndex];
      renderSide('left', st.left, true); renderSide('right', st.right, true);
      // First compact both pools upward, then let the gold ones descend.
      var transition = amount >= 10 && st.right > 0 && st.right < 10;
      await layoutPools(true, transition);
      if (transition) await layoutPools(true, false);
      renderNextMove();
      if (E.isSolved(st)) {
        solved = true;
        setPhase('celebrating');
        await celebrate();
      } else {
        setPhase('narrating');
        // Regrouping changes two digits; name the full value in that case.
        var prev = solution.states[stepIndex - 1];
        await sayCounts(amount === 1 && Math.floor(prev.left / 10) !== Math.floor(st.left / 10) ? undefined : amount);
      }
    } finally {
      clearEmphasis();
      setPhase(solved ? 'complete' : 'ready');
    }
  }

  /* ---------- celebration ---------- */
  async function celebrate() {
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
    await anim.finished.catch(function () {});
    {
      flyer.remove();
      renderEquation(); // swaps "?" for the answer with a pop
      starBurst();
    }
    await speakAnswer(answer);
    cheerSound();
    // The banner sits right under the sticky equation bar, in their
    // face: big cheer plus a big pulsing New Mystery button — the same
    // treatment Addition Quest has.
    if (celebrateBanner) { celebrateBanner.hidden = false; celebrateBanner.classList.add('show'); }
    newMysteryBtn.hidden = false;
    newMysteryBtn.disabled = false;
    newMysteryBtn.classList.add('show');
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
    if (animating) return;
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
    newMysteryBtn.hidden = true;
    newMysteryBtn.disabled = true;
    if (celebrateBanner) { celebrateBanner.classList.remove('show'); celebrateBanner.hidden = true; }
    cheerEl.hidden = true;
    cheerEl.textContent = '';
    renderEquation();
    renderSide('left', solution.a, false);
    renderSide('right', solution.b, false);
    layoutPools(false);
    setPhase('ready');
    renderNextMove();
    updateLandmarkState();
    syncUrl();
    if (solution.moves.length === 0) {
      // e.g. 7 − 0: nothing to cancel; the answer is already there.
      solved = true;
      setCaption([{ cls: 'note', text: 'Nothing to cancel — the answer was there all along!' }]);
      setPhase('celebrating');
      celebrate().finally(function () { setPhase('complete'); });
      return;
    }
    if (opts.announce) {
      setPhase('narrating');
      sayCounts().finally(function () { setPhase('ready'); });
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
      // Recreate surviving identities when changing the theme.
      [leftGrid, rightGrid].forEach(function (grid, side) {
        var poses = window.CancellationLayout.plan(solution, stepIndex)[side ? 'right' : 'left'];
        $all('.obj', grid).forEach(function (n, i) { n.dataset.id = poses[i].id; });
      });
      layoutPools(false);
    }
    store('theme', theme);
    if (solution) syncUrl();
  }

  function setLevel(l, startNew) {
    if (animating) return;
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
    var a = q.has('a') && q.get('a').trim() !== '' ? Number(q.get('a')) : NaN;
    var b = q.has('b') && q.get('b').trim() !== '' ? Number(q.get('b')) : NaN;
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
    celebrateBanner = $('#celebrate-banner');
    pageEl = $('.page');
    aboveEl = $('#landmarks-above');
    belowEl = $('#landmarks-below');
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
    newMysteryBtn.addEventListener('click', function () { if (!animating && solved) newRandomProblem(false); });
    window.addEventListener('resize', function () { if (!animating) layoutPools(false); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopSpeech(); });

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
