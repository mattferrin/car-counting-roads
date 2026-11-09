/* Addition Quest — game UI.
 * The maths lives in addition-engine.js, the positions in
 * addition-layout.js. This file only renders the engine's states, flies
 * the objects from the smaller side to the bigger side, speaks the
 * place-value counts and plays the effects. It never invents a move:
 * every tap plays exactly solution.moves[stepIndex], and the state only
 * advances after the objects have visibly arrived in the bigger pool.
 *
 * Panels keep the order of the problem: left is always the first addend
 * (a), right is always the second (b). The transfer always goes from
 * the SMALLER side to the BIGGER side, whichever side that is.
 */
(function () {
  'use strict';
  var E = window.AdditionEngine;

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
  function store(k, v) { try { localStorage.setItem('aq-' + k, v); } catch (e) {} }
  function read(k, d) { try { var v = localStorage.getItem('aq-' + k); return v == null ? d : v; } catch (e) { return d; } }

  /* ---------- themes ---------- */
  var THEMES = {
    cars: {
      label: "Ayan's Car World", thing: 'car', things: 'cars',
      leftSym: 'car-blue', rightSym: 'car-gold',
      leftColor: 'Blue', rightColor: 'Gold',
      // Places on the map — the child taps one to send the cars there.
      // Two compact strips hugging the panels: four above, four below.
      // Each landmark carries its strip, so the builder just groups them.
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
      leftSide, rightSide, captionBar, newMysteryBtn, cheerEl, celebrateBanner, pageEl,
      aboveEl, belowEl, movedTally, totalBadge, leftSize, rightSize;
  var flightToken = 0;  // each move takes a token; a stale burst (from a
  // previous move's timer) checks it and stands down.

  /* ---------- voices: pre-recorded clips, two distinct voices ---------- */
  /* Counts are spoken from short recorded clips — one male voice for the
   * left side, one female voice for the right — so the two voices are
   * unmistakably different on every device. A count is played as its
   * place-value fragments in order ("five tens" + "three ones"). If a
   * clip is missing or audio is unavailable, the same words fall back
   * to the device's speech — the captions always show the same words
   * either way. Clips live in audio/boy|girl/, shared with
   * Cancellation Quest; nothing is copied or re-recorded. */
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
   * A tens move speaks only the tens, a ones move only the ones; when a
   * place runs out it is named once ("zero tens" / "zero ones"). The
   * full count is still always visible in the panels, and the answer is
   * spoken in full. */
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
   * are the first N hundreds. A "zero tens" names no objects. DOM order
   * in each grid is canonical (layoutPools keeps it so), so slices work. */
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
    var side = p.answer ? solution.destSide : p.kind === 'boy' ? 'left' : 'right';
    var grid = side === 'left' ? leftGrid : rightGrid;
    if (frag === 'answer') {
      // The whole answer first: the full number, and every object left in
      // the pool — then its tens, then its ones, in that order.
      eqQ.classList.add('speaking');
      $all('.obj', grid).forEach(function (n) { n.classList.add('speaking'); });
      var answerLine = $('.dest-voice', captionBar);
      if (answerLine) answerLine.classList.add('speaking');
      return;
    }
    var num = p.answer ? eqQ : p.kind === 'boy' ? leftNum : rightNum;
    var cls = frag.indexOf('hundreds') === 0 ? '.d-hun' : frag.indexOf('tens') === 0 ? '.d-tens' : '.d-ones';
    var cap = p.kind === 'boy' ? leftCap : rightCap;
    var digit = $(cls, num) || (frag === 'tens-0' ? $('.t', cap) : null) || num;
    digit.classList.add('speaking');
    var line = p.answer ? $('.dest-voice', captionBar) :
      $((p.kind === 'girl') ? '.right-voice' : '.left-voice', captionBar);
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
  /* A rising whoosh as the objects leave — the sound of the flight. */
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

  function buildGrid(grid, ids, sym, emoji) {
    // Created only at problem/theme initialization. Survivors retain DOM identity.
    grid.innerHTML = '';
    for (var i = 0; i < ids.length; i++) {
      var obj = el('span', 'obj'); obj.dataset.id = ids[i];
      if (emoji) { obj.classList.add('emoji'); obj.textContent = emoji; }
      else obj.innerHTML = '<svg viewBox="' + (sym.indexOf('mermaid') === 0 ? '0 0 460 266' : '0 0 44 26') + '" aria-hidden="true"><use href="#' + sym + '"></use></svg>';
      grid.appendChild(obj);
    }
  }

  function rowHeightFor(grid) {
    var width = grid.clientWidth / 10;
    return theme === 'mermaids' ? Math.max(20, width * 266 / 460 + 8) : Math.max(22, width * 0.65 + 10);
  }

  /* Lay both pools out from the plan at `step` (default: the current
   * step). Survivors animate gradually (FLIP) from their previous
   * slots; objects not found in a grid — the ones mid-flight in the
   * wrapper — are skipped. The preview call during a move lays the
   * survivors out from the NEXT plan, so the destination's rows slide
   * down to open the top row (or, for a regrouping one, the ones rise
   * to form the new ten) while the group is still flying. */
  function layoutPools(animate, step) {
    var layout = window.AdditionLayout.plan(solution, step == null ? stepIndex : step);
    var jobs = [];
    ['left', 'right'].forEach(function (side) {
      var grid = side === 'left' ? leftGrid : rightGrid;
      var byId = new Map($all('.obj', grid).map(function (n) { return [Number(n.dataset.id), n]; }));
      var positions = layout[side];
      var width = grid.clientWidth / 10;
      var rowHeight = rowHeightFor(grid);
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
        if (!n) return;
        grid.appendChild(n); // keep DOM order canonical, so slices name the right objects
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

  /* Viewport rect of the destination slots the moving ids will land in. */
  function destSlotsRect(dstGrid, dstPositions, moving) {
    var gridRect = dstGrid.getBoundingClientRect();
    var width = dstGrid.clientWidth / 10;
    var rowHeight = rowHeightFor(dstGrid);
    var slots = dstPositions.filter(function (p) { return moving.indexOf(p.id) !== -1; });
    if (!slots.length) return { left: gridRect.left, top: gridRect.top, width: gridRect.width, height: gridRect.height };
    var minX = Math.min.apply(null, slots.map(function (p) { return p.x; }));
    var maxX = Math.max.apply(null, slots.map(function (p) { return p.x; }));
    var minY = Math.min.apply(null, slots.map(function (p) { return p.y; }));
    var maxY = Math.max.apply(null, slots.map(function (p) { return p.y; }));
    return {
      left: gridRect.left + minX * width,
      top: gridRect.top + minY * rowHeight,
      width: (maxX - minX + 1) * width,
      // Objects are rowHeight-8 tall, so this is the objects' box, not
      // the full row box — the flight must end with each object exactly
      // on its slot, not a few pixels above it.
      height: (maxY - minY) * rowHeight + (rowHeight - 8)
    };
  }

  function setPhase(value) {
    phase = value; animating = value !== 'ready' && value !== 'complete';
    document.body.dataset.phase = phase;
    updateControls();
    var status = $('#progress-status');
    if (status) status.textContent = phase === 'narrating' ? 'Listen to the count…' :
      phase === 'moving' ? 'Watch them move over…' : phase === 'celebrating' ? 'You found the answer!' : '';
  }

  function updateControls() {
    $all('.theme-pill, .level-pill, .test-problem').forEach(function (b) { b.disabled = animating; });
    if (newMysteryBtn) newMysteryBtn.disabled = animating || !solved;
    // Landmarks are the ONLY move trigger: locked while a move is in
    // flight or the problem is solved, and they nudge on the first
    // move only.
    $all('.landmark').forEach(function (b) {
      b.disabled = animating || solved;
      b.classList.toggle('nudge', !animating && !solved && stepIndex === 0);
    });
  }

  /* The quantity panels are labelled by colour, never by a child's name,
   * and by size: the bigger/smaller badge follows the numbers, so it
   * swaps sides when the problem does. */
  function renderWho() {
    var T = THEMES[theme];
    var leftWho = $('.side.left .who-label');
    var rightWho = $('.side.right .who-label');
    if (leftWho) leftWho.textContent = T.leftColor + ' ' + T.things;
    if (rightWho) rightWho.textContent = T.rightColor + ' ' + T.things;
    var equal = solution && solution.a === solution.b;
    if (!solution) {
      if (leftSize) leftSize.textContent = '';
      if (rightSize) rightSize.textContent = '';
      return;
    }
    if (leftSize) {
      leftSize.textContent = equal ? 'same size' : (solution.destSide === 'left' ? 'bigger' : 'smaller');
      // The word itself matches what it says: "bigger" is big, "smaller"
      // is small — never let "smaller" look bigger than "bigger".
      leftSize.classList.remove('bigger', 'smaller', 'same');
      leftSize.classList.add(equal ? 'same' : (solution.destSide === 'left' ? 'bigger' : 'smaller'));
    }
    if (rightSize) {
      rightSize.textContent = equal ? 'same size' : (solution.destSide === 'right' ? 'bigger' : 'smaller');
      rightSize.classList.remove('bigger', 'smaller', 'same');
      rightSize.classList.add(equal ? 'same' : (solution.destSide === 'right' ? 'bigger' : 'smaller'));
    }
    leftSide.classList.toggle('dest', solution.destSide === 'left');
    leftSide.classList.toggle('source', solution.sourceSide === 'left');
    rightSide.classList.toggle('dest', solution.destSide === 'right');
    rightSide.classList.toggle('source', solution.sourceSide === 'right');
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
    if (!flash) {
      var ids = window.AdditionLayout.plan(solution, stepIndex)[which].map(function (p) { return p.id; });
      // Mermaid objects are the N1 SVG now, not the picker emoji —
      // the emoji field stays for Aliya's theme BUTTON only.
      buildGrid(grid, ids, sym, theme === 'mermaids' ? null : T.emoji);
    }
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

  /* How much has moved over so far, in place-value words. */
  function renderMoved() {
    var moved = solution.small - solution.states[stepIndex][solution.sourceSide];
    if (moved > 0) {
      movedTally.textContent = 'Moved over: ' + E.captionCount(moved);
      movedTally.hidden = false;
    } else {
      movedTally.hidden = true;
    }
  }

  function renderTotal() {
    totalBadge.textContent = 'Total stays ' + solution.total;
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
   * Regrouping (a ones move that changes the tens digit of the
   * destination) names the destination's full value instead. No name
   * tags on the lines: the voices don't belong to the kids, and the two
   * lines are told apart by colour and order, left then right. (The
   * answer is still spoken — and captioned — in full.) */
  function sayCounts(amount, regroup) {
    var st = solution.states[stepIndex];
    var lz = zeroTensFlag(st.left, 'left');
    var rz = zeroTensFlag(st.right, 'right');
    function fragsFor(side, n) {
      if (regroup && side === solution.destSide) return fragmentsFor(n, false);
      return changingFragments(n, amount);
    }
    var leftFrags = fragsFor('left', st.left);
    var rightFrags = fragsFor('right', st.right);
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

  /* ---------- the map: two compact strips of tappable places ----------
   * Eight landmarks in two tight rows hugging the panels — four above,
   * four below — instead of scattered around the page. Compactness is
   * the point: the equation, the landmarks and the panels read as one
   * tight display. Tapping one IS the move: the cars fly there in one
   * smooth swoop, loop around it, then carry on to the bigger side.
   * Landmarks are the ONLY move trigger — there is no button and no
   * source tap. */
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
        b.setAttribute('aria-label', lm.name + ' — tap here to send the ' + T.things + ' around!');
        b.innerHTML = '<span class="art" aria-hidden="true">' + '<img src="art/landmarks/' + lm.id + '.png?v=5" width="28" height="28" alt="" draggable="false">' + '</span>' +
          '<span class="name">' + lm.name + '</span>' +
          '<span class="hint">' + lm.hint + '</span>';
        b.addEventListener('click', function () {
          doMove({ kind: 'landmark', el: b, lm: lm, name: lm.name, fx: lm.fx, rect: b.getBoundingClientRect() });
        });
        zone.el.appendChild(b);
      });
    });
    updateControls();
  }

  /* A burst of sparkles at a point inside a host element. */
  function burstAt(host, clientX, clientY, chars, cls) {
    var hr = host.getBoundingClientRect();
    var cx = clientX - hr.left;
    var cy = clientY - hr.top;
    for (var i = 0; i < 14; i++) {
      var s = el('span', cls || 'arrival-burst', chars[i % chars.length]);
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      var ang = (i / 14) * Math.PI * 2 + Math.random() * 0.6;
      var dist = 46 + Math.random() * 55;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist - 24) + 'px');
      host.appendChild(s);
      setTimeout(function (n) { n.remove(); }.bind(null, s), 950);
    }
  }

  /* A tiny buzz when objects arrive — phones only, harmless elsewhere. */
  function vibrate(amount) {
    try { if (navigator.vibrate) navigator.vibrate(amount >= 10 ? 30 : 12); } catch (e) {}
  }

  /* ---------- flight from the smaller pool to the bigger pool ----------
   * The move first shows in place: the moving objects sit highlighted
   * in their positions for a beat (the telegraph), then the REAL objects
   * lift off together — one whole row for a ten, one single object for
   * a one — and fly across to their destination slots in the bigger
   * pool, arriving together. While they fly, the survivors make room:
   * the destination's rows slide down to open the top row and the
   * source's survivors close up. The flight travels at FULL size and
   * opacity all the way into the slots — the objects arrive and stay,
   * so nothing shrinks, fades, or pops on arrival. Nothing ever
   * vanishes from one side and appears on the other. */
  function liftObjects(grid, amount, moving) {
    // The glow colour is the place that is moving: blue for a ten,
    // orange for a one — the same colours as the digits, so the flight
    // and the numbers teach the same thing.
    var glow = amount === 10 ? 'glow-ten' : 'glow-one';
    var byId = new Map($all('.obj', grid).map(function (n) { return [Number(n.dataset.id), n]; }));
    var picked = moving.map(function (id) { return byId.get(id); }).filter(Boolean);
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

  /* ---------- the spline: one continuous curve, source -> landmark loop -> destination ----------
   * A move is ONE curve, not three phases: a Catmull-Rom spline from
   * the source slots, sweeping around the tapped landmark in a loop
   * that is PART of the same curve, and flowing on into the destination
   * slots — like one continuous interstate loop road. No stops, no
   * jumps, no separate orbit phase, no teleporting between phases.
   * The spline is sampled at equal arclength (~14px between keyframes)
   * and animated with a SINGLE WAAPI animation at a steady speed, so
   * consecutive keyframes are evenly spaced. The loop is a genuine
   * loop: control points circle the landmark once (entry angle ->
   * entry angle + 360), entered from the source side and left toward
   * the destination. Tens arc higher on the approach than ones. The
   * whole spline runs 1300ms (180ms with reduced motion), after the
   * 260ms telegraph. The landmark's burst fires as the group reaches
   * the loop, at the loop's arclength fraction of the path. */
  function loopRadius(waypointRect) {
    var cx = waypointRect.left + waypointRect.width / 2;
    var cy = waypointRect.top + waypointRect.height / 2;
    var vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1024;
    var vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 768;
    // Clear the landmark itself, and stay on screen: the loop must
    // never swing off the viewport edge.
    return Math.max(44, Math.min(waypointRect.height / 2 + 22,
      cx - 16, vw - cx - 16, cy - 16, vh - cy - 16));
  }
  function catmullRom(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return [
      0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
      0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
    ];
  }
  /* Returns { samples: [[x, y], ...] (absolute coords, start ->
   * destination), loopFraction: 0..1 (arclength share at the first
   * loop point — when the group reaches the loop). */
  function buildSplinePath(start, waypointRect, dest, amount) {
    var cx = waypointRect.left + waypointRect.width / 2;
    var cy = waypointRect.top + waypointRect.height / 2;
    var R = loopRadius(waypointRect);
    var lift = amount === 1 ? 16 : 64;
    // Enter the loop from the source side: the loop starts at the
    // angle the group arrives from, and runs a full 360 from there.
    var entry = Math.atan2(start[1] - cy, start[0] - cx);
    var approach = [start[0] + (cx - start[0]) * 0.45, start[1] + (cy - start[1]) * 0.45 - lift];
    var ctrl = [start, approach];
    for (var k = 0; k <= 6; k++) {
      var th = entry + k * Math.PI / 3;
      ctrl.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]);
    }
    var exit = [cx + (dest[0] - cx) * 0.5, cy + (dest[1] - cy) * 0.5 - lift * 0.5];
    ctrl.push(exit, dest);
    // Dense Catmull-Rom samples (16 per segment), then resample at
    // equal arclength so the group moves at a steady speed.
    var dense = [];
    for (var i = 0; i < ctrl.length - 1; i++) {
      var p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (var s = 0; s < 16; s++) dense.push(catmullRom(p0, p1, p2, p3, s / 16));
    }
    dense.push(dest);
    var cum = [0];
    for (var j = 1; j < dense.length; j++) {
      cum.push(cum[j - 1] + Math.hypot(dense[j][0] - dense[j - 1][0], dense[j][1] - dense[j - 1][1]));
    }
    var total = cum[cum.length - 1] || 1;
    // The first loop point is ctrl[2]: the end of segment 1, dense
    // index 32 (16 samples per segment).
    var loopFraction = cum[Math.min(32, cum.length - 1)] / total;
    var step = 14; // px between keyframes
    var count = Math.max(2, Math.round(total / step));
    var samples = [], idx = 0;
    for (var n = 0; n <= count; n++) {
      var target = total * n / count;
      while (idx < cum.length - 2 && cum[idx + 1] < target) idx++;
      var segLen = cum[idx + 1] - cum[idx] || 1;
      var f = (target - cum[idx]) / segLen;
      samples.push([dense[idx][0] + (dense[idx + 1][0] - dense[idx][0]) * f,
        dense[idx][1] + (dense[idx + 1][1] - dense[idx][1]) * f]);
    }
    return { samples: samples, loopFraction: loopFraction };
  }

  /* One continuous spline flight: a single WAAPI animation along the
   * sampled path, at full size and full opacity throughout. Returns
   * { finished, loopDelay, duration } — loopDelay is when the group
   * reaches the loop, so the caller can fire the landmark's burst
   * then. The wrapper is left in place (still holding its final
   * transform) so the caller can land the real objects from exactly
   * where the flight left them. */
  function flySpline(wrapper, start, waypointRect, dest, amount) {
    var path = buildSplinePath(start, waypointRect, dest, amount);
    var dur = reducedMotion() ? 180 : 1300;
    var delay = 260; // the telegraph: the group glows in place first
    if (!wrapper || !wrapper.animate) {
      if (wrapper) wrapper.remove();
      return { finished: Promise.resolve(), loopDelay: 0, duration: dur };
    }
    var frames = path.samples.map(function (p) {
      return {
        transform: 'translate(' + (p[0] - start[0]).toFixed(1) + 'px,' + (p[1] - start[1]).toFixed(1) + 'px) scale(1)',
        opacity: 1
      };
    });
    var anim = wrapper.animate(frames, { duration: dur, delay: delay, easing: 'linear', fill: 'forwards' });
    return { finished: anim.finished.catch(function () {}), loopDelay: delay + path.loopFraction * dur, duration: dur };
  }

  /* A few sparkles trail behind a flying group, so the flight reads as
   * magic in motion — only for the big moves; ones stay quiet. The
   * sparkles sample the wrapper's position as it travels the spline,
   * so they fall along the whole curve, not just the start. */
  function trailSparkles(wrappers) {
    [0, 180, 360, 540, 720, 900].forEach(function (delay) {
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

  function shockwaveIn(host, clientX, clientY) {
    var hr = host.getBoundingClientRect();
    var s = el('span', 'shockwave');
    s.style.left = (clientX - hr.left) + 'px';
    s.style.top = (clientY - hr.top) + 'px';
    host.appendChild(s);
    setTimeout(function () { s.remove(); }, 650);
  }

  /* The burst at the waypoint: the landmark's own fx, a shockwave
   * ring, and the landmark itself booms. Bursts are hosted by the page
   * (landmarks live in two different strips now), so they are
   * positioned against the page, not one strip. */
  function waypointBurst(waypoint) {
    var cx = waypoint.rect.left + waypoint.rect.width / 2;
    var cy = waypoint.rect.top + waypoint.rect.height / 2;
    var host = pageEl;
    burstAt(host, cx, cy, waypoint.fx, 'burst');
    shockwaveIn(host, cx, cy);
    if (waypoint.el) {
      waypoint.el.classList.add('boom');
      setTimeout(function () { waypoint.el.classList.remove('boom'); }, 550);
    }
  }

  /* ---------- one move ---------- */
  async function doMove(waypoint) {
    // Landmarks are the only trigger: no button, no source tap.
    if (!waypoint || animating || solved || stepIndex >= solution.moves.length) return;
    ensureAudioCtx();
    var moveToken = ++flightToken;
    waypoint.el.setAttribute('data-flight-target','');
    setPhase('moving');
    var amount = solution.moves[stepIndex];
    var srcSide = solution.sourceSide, dstSide = solution.destSide;
    var srcGrid = srcSide === 'left' ? leftGrid : rightGrid;
    var dstGrid = dstSide === 'left' ? leftGrid : rightGrid;
    var dstSideEl = dstSide === 'left' ? leftSide : rightSide;
    var moving = window.AdditionLayout.movingIds(solution, stepIndex);
    // No announcement of the amount: the moving objects just light up in
    // place for a beat (the telegraph), then fly over. The counting
    // afterwards still names the new totals, tens then ones.
    try {
      var srcById = new Map($all('.obj', srcGrid).map(function (n) { return [Number(n.dataset.id), n]; }));
      moving.forEach(function (id) { var n = srcById.get(id); if (n) n.classList.add('speaking'); });
      // The trigger lights up too — the tapped landmark.
      waypoint.el.classList.add('speaking');
      var nextPlan = window.AdditionLayout.plan(solution, stepIndex + 1);
      var targetRect = destSlotsRect(dstGrid, nextPlan[dstSide], moving);
      var wrap = liftObjects(srcGrid, amount, moving);
      // The survivors make room while the group flies: the
      // destination's rows slide down to open the top row (or, for a
      // regrouping one, the ones rise to form the new ten), and the
      // source's survivors close up. The moving objects are in the
      // wrapper, so the preview lays out only the survivors.
      layoutPools(true, stepIndex + 1);
      // One continuous spline: source slots -> loop around the tapped
      // landmark -> destination slots, a single animation at full size.
      var wr = wrap ? wrap.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      var start = [wr.left + wr.width / 2, wr.top + wr.height / 2];
      var dest = [targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2];
      var flight = flySpline(wrap, start, waypoint.rect, dest, amount);
      whooshSound();
      if (amount >= 10) trailSparkles([wrap]);
      var status = $('#progress-status');
      if (status) status.textContent = 'Flying around the ' + waypoint.name + '…';
      // The burst fires as the group reaches the loop — mid-flight, not
      // before it and not after it. Guarded by the move token: a newer
      // move cancels a stale burst.
      setTimeout(function () {
        if (moveToken !== flightToken) return;
        waypointBurst(waypoint);
        if (amount >= 10) boomSound(); else popSound();
        vibrate(amount);
      }, flight.loopDelay);
      await flight.finished;
      // The real objects arrive: move them into the destination pool.
      // Read their flight-end positions first — the wrapper still holds
      // its final transform — so the reflow below animates each object
      // from exactly where the flight left it into its slot. No pop,
      // no shrink: the objects arrive and stay.
      var dstRect = dstGrid.getBoundingClientRect();
      var cellW = dstGrid.clientWidth / 10;
      var rowH = rowHeightFor(dstGrid);
      var arrived = wrap ? Array.prototype.slice.call(wrap.childNodes) : [];
      var landed = arrived.map(function (n) {
        var r = (wrap && wrap.isConnected) ? n.getBoundingClientRect() : null;
        return { node: n, x: r ? r.left - dstRect.left : 0, y: r ? r.top - dstRect.top : 0, ok: !!r };
      });
      landed.forEach(function (item) {
        var n = item.node;
        n.style.position = ''; n.style.left = ''; n.style.top = '';
        n.style.width = cellW + 'px'; n.style.height = (rowH - 8) + 'px';
        if (n.classList.contains('emoji')) n.style.fontSize = Math.max(10, Math.round(Math.min(cellW, rowH - 8) * 0.9)) + 'px';
        var svg = n.querySelector('svg');
        if (svg) { svg.style.width = ''; svg.style.height = ''; }
        dstGrid.appendChild(n);
        if (item.ok) n.style.transform = 'translate(' + item.x + 'px,' + item.y + 'px)';
        else n.style.transform = '';
      });
      if (wrap) wrap.remove();
      var prev = solution.states[stepIndex];
      stepIndex++;
      var st = solution.states[stepIndex];
      var regroup = amount === 1 && Math.floor(prev[dstSide] / 10) !== Math.floor(st[dstSide] / 10);
      var cx = targetRect.left + targetRect.width / 2;
      var cy = targetRect.top + targetRect.height / 2;
      if (regroup) {
        // A new ten has just completed: a double burst, a boom, and a
        // little shake of the whole page — the regrouping, celebrated.
        burstAt(dstSideEl, cx, cy, ['💥', '✨', '⭐', '💥']);
        setTimeout(function () { burstAt(dstSideEl, cx, cy, ['💥', '✨', '⭐']); }, 130);
        var page = document.querySelector('.page');
        if (page) { page.classList.add('shake'); setTimeout(function () { page.classList.remove('shake'); }, 350); }
        boomSound();
      } else if (amount >= 10) {
        burstAt(dstSideEl, cx, cy, ['✨', '⭐', '💛']);
        popSound();
      } else {
        burstAt(dstSideEl, cx, cy, ['✨', '💛']);
        popSound();
      }
      renderSide('left', st.left, true); renderSide('right', st.right, true);
      // Settle everything into its final slots: the arrivals animate
      // the last short step from where the flight left them, and any
      // survivors the preview did not already move reflow now.
      await layoutPools(true);
      renderMoved();
      if (E.isSolved(st, solution)) {
        solved = true;
        setPhase('celebrating');
        await celebrate();
      } else {
        setPhase('narrating');
        await sayCounts(amount, regroup);
      }
    } finally {
      waypoint.el.removeAttribute('data-flight-target');
      clearEmphasis();
      setPhase(solved ? 'complete' : 'ready');
    }
  }

  /* ---------- celebration ---------- */
  async function celebrate() {
    renderEquation();
    var destNum = solution.destSide === 'left' ? leftNum : rightNum;
    var destSideEl = solution.destSide === 'left' ? leftSide : rightSide;
    destSideEl.classList.add('done');
    var answer = solution.answer;
    var phrase = E.describeCount(answer, false);
    setCaption([
      { cls: 'note', text: 'Nothing is left to move — what moved over is the answer!' },
      { cls: (solution.destSide === 'left' ? 'left-voice' : 'right-voice') + ' dest-voice', tag: 'Answer', text: 'The answer is ' + phrase + '!' }
    ]);
    cheerEl.textContent = '🎉 ' + solution.a + ' + ' + solution.b + ' = ' + answer + ' — you did it! 🎉';
    cheerEl.hidden = false;

    // The surviving number flies from its panel into the "?" spot.
    var from = destNum.getBoundingClientRect();
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
    // face: big cheer plus a big pulsing New Mystery button.
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

  function newProblem(a, b) {
    if (animating) return;
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
    rightSide.classList.remove('done');
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
    renderWho();
    renderTotal();
    renderMoved();
    setPhase('ready');
    syncUrl();
    if (solution.moves.length === 0) {
      // e.g. 47 + 0: nothing to move; the answer is already there.
      solved = true;
      setCaption([{ cls: 'note', text: 'Nothing to move — the answer was there all along!' }]);
      setPhase('celebrating');
      celebrate().finally(function () { setPhase('complete'); });
      return;
    }
    /* Load caption is ONE line (Phase 5): the second sentence repeated
     * the conservation message the "Total stays N" badge already shows
     * one glance up — and the two sentences together made the bar
     * 100px tall, pushing it 32px below the fold at 390x844. */
    if (solution.a === solution.b) {
      setCaption([
        { cls: 'note', text: 'Same size! Tap a place on the map to move — tens first, then ones.' }
      ]);
    } else {
      setCaption([
        { cls: 'note', text: 'Tap a place on the map to send ' + E.describeMove(solution.moves[0]) + ' from the smaller side to the bigger side!' }
      ]);
    }
  }

  function newRandomProblem() {
    var p = E.randomProblem(level);
    newProblem(p.a, p.b);
  }

  /* ---------- theme / level / sound ---------- */
  function setTheme(t) {
    if (animating) return;
    theme = THEMES[t] ? t : 'cars';
    document.body.dataset.theme = theme;
    $all('.theme-pill').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    });
    $('.world-line').textContent = THEMES[theme].label + ' · Addition Quest';
    buildLandmarks();
    renderWho();
    if (solution) {
      var st = solution.states[stepIndex];
      renderSide('left', st.left, false);
      renderSide('right', st.right, false);
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
    if (startNew && !animating) newRandomProblem();
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
    newMysteryBtn = $('#new-mystery');
    celebrateBanner = $('#celebrate-banner');
    cheerEl = $('#cheer');
    pageEl = $('.page');
    aboveEl = $('#landmarks-above');
    belowEl = $('#landmarks-below');
    movedTally = $('#moved-tally');
    totalBadge = $('#total-badge');
    leftSize = $('#left-size'); rightSize = $('#right-size');

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
        newProblem(parseInt(b.dataset.a, 10), parseInt(b.dataset.b, 10));
      });
    });
    newMysteryBtn.addEventListener('click', function () { if (!animating && solved) newRandomProblem(); });
    window.addEventListener('resize', function () { if (!animating) layoutPools(false); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stopSpeech(); });

    document.body.dataset.theme = theme;
    $all('.theme-pill').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.theme === theme));
    });
    $all('.level-pill').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.level === level));
    });
    $('.world-line').textContent = THEMES[theme].label + ' · Addition Quest';
    buildLandmarks();
    renderWho();
    if (specific) newProblem(specific.a, specific.b);
    else newRandomProblem();

    // Warm up the voice list (some browsers load it late).
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () {};
    }
    if (soundOn) preloadClips();
  }

  /* Test hook: the rendered suite unit-tests the spline builder
   * directly (same geometry for a ten and a one, arc and loop), and
   * reads the recorded flight animations for the live path. */
  if (typeof window !== 'undefined') {
    window.AdditionQuestSpline = { buildSplinePath: buildSplinePath, loopRadius: loopRadius };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
