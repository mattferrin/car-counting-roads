/* Counting Play voice — spoken place-value narration for test/index.html.
 * Reuses the recorded clips in test/audio/boy|girl/, the same clips
 * Addition Quest and Cancellation Quest speak from. No new recordings.
 *
 * Voice mapping is FIXED BY SIDE, exactly like the Quests: the left
 * (blue) side speaks with the boy recordings, the right (gold) side
 * with the girl recordings, in both themes.
 *
 * planMove(state, kind, amount) plans one move from the POST-move
 * state: entry announces only the left side, exit only the right, a
 * transfer announces left then right. A ten-unit action says the
 * resulting number of tens; a one-unit action says the resulting
 * number of ones, including zero — only that place is counted.
 * Amounts other than 1 and 10 plan nothing.
 *
 * The narrator plays each fragment from its clip when the clip is a
 * known recording (tens/ones 0-9) and falls back to the device's
 * speech with the same words otherwise — the 100-unit edge says
 * "ten tens" by device speech because the shared clip set contains
 * tens 0-9 only. Each side waits for the previous source's actual
 * onended event; speech highlights only on real onstart/onend
 * events. No timers estimate word timing. An 8-second watchdog
 * stops a stuck source and reports a retry. stop() releases
 * playback without changing the mute preference; only setSound
 * changes it. The narrator never touches storage: the caller owns
 * the stored preference (game.js reads/writes 'cp-sound').
 */
(function (root) {
  'use strict';

  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  var CLIP_FRAGS = ['tens-0', 'tens-1', 'tens-2', 'tens-3', 'tens-4', 'tens-5', 'tens-6', 'tens-7', 'tens-8', 'tens-9',
    'ones-0', 'ones-1', 'ones-2', 'ones-3', 'ones-4', 'ones-5', 'ones-6', 'ones-7', 'ones-8', 'ones-9'];

  function placeWord(place, count) {
    if (place === 'tens') return count === 1 ? 'ten' : 'tens';
    return count === 1 ? 'one' : 'ones';
  }

  /* One move -> the ordered fragments to speak. state is POST-move. */
  function planMove(state, kind, amount) {
    if (amount !== 1 && amount !== 10) return [];
    var sides = kind === 'entry' ? ['blue'] : kind === 'exit' ? ['gold'] : ['blue', 'gold'];
    var place = amount === 10 ? 'tens' : 'ones';
    return sides.map(function (side) {
      var count = amount === 10 ? Math.floor(state[side] / 10) : state[side] % 10;
      return { side: side, kind: side === 'blue' ? 'boy' : 'girl', count: count, place: place, text: WORDS[count] + ' ' + placeWord(place, count) };
    });
  }

  function createNarrator(deps) {
    deps = deps || {};
    var win = deps.root || root;
    var soundOn = true;
    if (deps.soundOn !== undefined) soundOn = !!deps.soundOn;
    else if (win.localStorage) { try { soundOn = win.localStorage.getItem('cp-sound') !== 'off'; } catch (e) {} }
    var speechToken = 0;
    var audioCtx = null;
    var clipBuffers = {};   // "audio/boy/tens-8.mp3" -> AudioBuffer, false = missing
    var clipSources = [];   // live buffer sources, so stop() can cut them
    var cancelPlayback = null;
    var highlight = typeof deps.highlight === 'function' ? deps.highlight : function () {};
    var clear = typeof deps.clear === 'function' ? deps.clear : function () {};
    var onSoundChange = typeof deps.onSoundChange === 'function' ? deps.onSoundChange : function () {};
    var setT = typeof win.setTimeout === 'function' ? function (fn, ms) { return win.setTimeout(fn, ms); } : setTimeout;
    var clearT = typeof win.clearTimeout === 'function' ? function (id) { return win.clearTimeout(id); } : clearTimeout;

    /* (Re)create the AudioContext when missing OR closed; resume
     * whenever it is not running. */
    function ensureAudioCtx() {
      try {
        var Ctor = win.AudioContext || win.webkitAudioContext;
        if (!Ctor) return null;
        if (!audioCtx || audioCtx.state === 'closed') audioCtx = new Ctor();
        if (audioCtx.state !== 'running') { try { var r = audioCtx.resume(); if (r && r.catch) r.catch(function () {}); } catch (e) {} }
        return audioCtx;
      } catch (e) { return null; }
    }

    function stop() {
      speechToken++;
      if (win.speechSynthesis) { try { win.speechSynthesis.cancel(); } catch (e) {} }
      clipSources.forEach(function (s) { try { s.stop(); } catch (e) {} });
      clipSources = [];
      if (cancelPlayback) cancelPlayback();
      clear();
    }

    function setSound(v) {
      soundOn = !!v;
      if (!soundOn) stop();
      return soundOn;
    }

    function clipPath(item) {
      return 'audio/' + item.kind + '/' + item.place + '-' + item.count + '.mp3';
    }

    function loadClip(ctx, item) {
      var path = clipPath(item);
      if (clipBuffers[path] !== undefined) return Promise.resolve(clipBuffers[path] || null);
      if (typeof win.fetch !== 'function') { clipBuffers[path] = false; return Promise.resolve(null); }
      return win.fetch(path).then(function (r) {
        if (!r.ok) throw new Error('missing clip ' + path);
        return r.arrayBuffer();
      }).then(function (buf) { return ctx.decodeAudioData(buf); })
        .then(function (decoded) { clipBuffers[path] = decoded; return decoded; })
        .catch(function () { clipBuffers[path] = false; return null; });
    }

    /* Fetch + decode every known clip in the background; playback
     * uses whatever is ready and falls back to device speech for
     * the rest. */
    function preload() {
      if (typeof win.fetch !== 'function') return;
      var ctx = ensureAudioCtx();
      if (!ctx) return;
      ['boy', 'girl'].forEach(function (kind) {
        CLIP_FRAGS.forEach(function (frag) {
          loadClip(ctx, { kind: kind, place: frag.split('-')[0], count: Number(frag.split('-')[1]) });
        });
      });
    }

    function pickVoices() {
      if (!win.speechSynthesis) return { boy: null, girl: null };
      var all = win.speechSynthesis.getVoices().filter(function (v) {
        return v.lang && v.lang.toLowerCase().indexOf('en') === 0;
      });
      if (!all.length) all = win.speechSynthesis.getVoices();
      function pick(rx, fallback) {
        for (var i = 0; i < all.length; i++) if (rx.test(all[i].name)) return all[i];
        return fallback;
      }
      var boy = pick(/daniel|alex|fred|james|david|guy|george|google us english/i, all[0] || null);
      var girl = pick(/samantha|victoria|karen|moira|zira|susan|aria|jenny|google uk english female/i,
        all.filter(function (v) { return v !== boy; })[0] || boy);
      return { boy: boy, girl: girl };
    }

    /* One fragment, in its voice. Resolves immediately when muted
     * or when the token is stale. A known clip plays from its
     * recording; anything else (the "ten tens" edge, a missing
     * clip, no audio) falls back to device speech with the same
     * words. Highlight turns on with the fragment — at source
     * start for a clip, only on real onstart/onboundary for
     * speech — and clears when it ends. */
    function playFragment(item, token) {
      if (!soundOn || token !== speechToken) return Promise.resolve();
      return new Promise(function (resolve) {
        var finished = false, src = null, utterance = null;
        var watchdog = setT(function () {
          // Failure recovery only, not synchronization. Stop the
          // stuck source before releasing the queue so it cannot
          // overlap the next phrase, and offer a sound retry. The
          // stored preference is untouched.
          soundOn = false;
          onSoundChange(false, true);
          finish(true);
        }, 8000);
        function finish(abort) {
          if (finished) return;
          finished = true;
          clearT(watchdog);
          if (abort) {
            if (src) { try { src.stop(); } catch (e) {} }
            if (utterance && win.speechSynthesis) { try { win.speechSynthesis.cancel(); } catch (e) {} }
          }
          if (src) { try { src.disconnect(); } catch (e) {} clipSources = clipSources.filter(function (s) { return s !== src; }); }
          cancelPlayback = null;
          clear();
          resolve();
        }
        cancelPlayback = function () { finish(true); };
        function speechFallback() {
          if (!win.speechSynthesis || typeof win.SpeechSynthesisUtterance !== 'function') { finish(false); return; }
          try {
            utterance = new win.SpeechSynthesisUtterance(item.text);
            var vs = pickVoices();
            utterance.lang = 'en-US'; utterance.rate = 0.88;
            utterance.pitch = item.kind === 'boy' ? 0.85 : 1.3;
            if (vs[item.kind]) utterance.voice = vs[item.kind];
            utterance.onstart = utterance.onboundary = function () { if (!finished) highlight(item); };
            utterance.onend = utterance.onerror = function () { finish(false); };
            win.speechSynthesis.speak(utterance);
          } catch (e) { finish(true); }
        }
        (async function () {
          var ctx = null, buffer = null;
          if (item.count <= 9) {
            try {
              ctx = ensureAudioCtx();
              if (ctx) {
                if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {} }
                if (ctx.state === 'running') buffer = await loadClip(ctx, item);
              }
            } catch (e) { buffer = null; }
          }
          if (!soundOn || token !== speechToken) { finish(false); return; }
          if (ctx && ctx.state === 'running' && buffer) {
            try {
              src = ctx.createBufferSource(); src.buffer = buffer;
              src.connect(ctx.destination); clipSources.push(src);
              src.onended = function () { finish(false); };
              src.start(); highlight(item);
              return;
            } catch (e) { finish(true); return; }
          }
          speechFallback();
        })();
      });
    }

    function speakMove(state, kind, amount) {
      var token = speechToken;
      var plan = planMove(state, kind, amount);
      var chain = Promise.resolve();
      plan.forEach(function (item) {
        chain = chain.then(function () {
          if (!soundOn || token !== speechToken) return;
          return playFragment(item, token);
        });
      });
      return chain.then(function () { clear(); });
    }

    return {
      isOn: function () { return soundOn; },
      setSound: setSound,
      stop: stop,
      preload: preload,
      speakMove: speakMove,
      playFragment: playFragment,
      _buffers: clipBuffers
    };
  }

  var api = { planMove: planMove, createNarrator: createNarrator };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CountingVoice = api;
})(typeof window === 'undefined' ? globalThis : window);
