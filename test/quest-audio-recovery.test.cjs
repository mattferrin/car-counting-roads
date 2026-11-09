'use strict';
/* Quest audio recovery — first-load race + speaking indicator.
 * Run: NODE_PATH=/tmp/cq-test-deps/node_modules node quest-audio-recovery.test.cjs
 * jsdom harness in the style of cancellation-ui.test.cjs, with a mock
 * AudioContext (suspended until resume() resolves), a controllable
 * fetch, and speech that either speaks, starts-but-never-ends, or
 * never starts at all — the three shapes a fresh in-app browser takes.
 *
 * Covers: (a) the core race — a first-tap clip plays when resume()
 * resolves asynchronously after the tap; (b) preload + playback share
 * one in-flight fetch per clip; (c) a transient fetch failure retries
 * on the next tap instead of caching false; (d) a fragment whose audio
 * never starts finishes promptly and releases the game; (e) watchdog
 * completion is terminal — a late end or a late fetch starts nothing;
 * (f) the speaking indicator — side-coloured glow + waveform under the
 * speaking digit, exactly synced with real audio start/end, other side
 * still; (g) the speaking scale is gone from the CSS and reduced
 * motion keeps the indicator static; (h) the boot gate — the places
 * stay off the page until the voices actually load, then the toggle,
 * status, next move and caption all transition at once, and a muted
 * game opens immediately.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const flush = async () => { for (let i = 0; i < 14; i++) await new Promise(setImmediate); };
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

function boot(game, a, b, opts) {
  opts = opts || {};
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, game + '-quest.html'), 'utf8'),
    { url: `https://example.org/${game}-quest.html?a=${a}&b=${b}`, runScripts: 'outside-only' });
  const w = dom.window, d = w.document;
  const starts = [], requests = [], spoken = [], spokenAll = [], cancels = [];
  const startTimers = [], watchdogs = [], fetchDeferreds = new Map(), contexts = [];
  let failFetch = !!opts.failFetch;
  Object.defineProperty(d, 'readyState', { value: 'complete' });
  w.matchMedia = () => ({ matches: true });
  w.HTMLElement.prototype.animate = function () { return { finished: Promise.resolve() }; };
  const timer = w.setTimeout.bind(w);
  w.setTimeout = (f, ms) => ms === 8000 ? (watchdogs.push(f), 0) : ms === 2500 ? (startTimers.push(f), 0) : timer(f, ms);
  if (opts.audio !== false) {
    // Suspended until resume() resolves. resume() is idempotent per
    // context (a real context resolves every pending resume together),
    // so the unlock and a blip racing it share one promise.
    class Context {
      constructor() { contexts.push(this); this.state = 'suspended'; this.destination = {}; this._resume = null; }
      resume() {
        if (this.state === 'running') return Promise.resolve();
        if (!this._resume) {
          this._resume = new Promise((res) => {
            this._resumeResolve = () => { this.state = 'running'; this._resume = null; res(); };
          });
        }
        return this._resume;
      }
      decodeAudioData(bytes) { return Promise.resolve(bytes); }
      createBufferSource() {
        const src = { connect() {}, disconnect() {}, start() { starts.push(src); }, stop() { src.stopped = true; } };
        return src;
      }
    }
    w.AudioContext = Context;
  }
  w.fetch = (p) => {
    requests.push(p);
    if (failFetch) return Promise.reject(new Error('offline'));
    if (opts.holdFetch) { const def = deferred(); fetchDeferreds.set(p, def); return def.promise; }
    return Promise.resolve({ ok: true, arrayBuffer: async () => ({ path: p }) });
  };
  w.SpeechSynthesisUtterance = function (text) { this.text = text; };
  w.speechSynthesis = {
    getVoices: () => [],
    cancel() { cancels.push(1); },
    speak(u) { spoken.push(u); spokenAll.push(u); if (opts.speech !== 'stuck') u.onstart && u.onstart(); },
  };
  if (opts.soundOff) w.localStorage.setItem(game === 'cancellation' ? 'cq-sound' : 'aq-sound', 'off');
  for (const name of [game + '-engine.js', game + '-layout.js', game + '-quest.js']) w.eval(fs.readFileSync(path.join(__dirname, name), 'utf8'));
  return {
    w, d, starts, requests, spoken, spokenAll, cancels, startTimers, watchdogs, fetchDeferreds,
    resolveResume() { const ctx = contexts[contexts.length - 1]; if (ctx && ctx._resumeResolve) ctx._resumeResolve(); },
    setFailFetch(v) { failFetch = v; },
    close: () => dom.window.close(),
  };
}

async function settle(t) {
  for (let i = 0; i < 80; i++) {
    await flush();
    const src = t.starts.find((s) => s.onended && !s.ended);
    if (src) { src.ended = true; src.onended(); continue; }
    const u = t.spoken.shift();
    if (u) { u.onend(); continue; }
    if (['ready', 'complete'].includes(t.d.body.dataset.phase)) return;
  }
  await flush();
  assert(['ready', 'complete'].includes(t.d.body.dataset.phase), 'settle: phase=' + t.d.body.dataset.phase);
}

const VOLUME_HINT = 'Counting out loud — if you can\'t hear it, check the device volume.';
const READY = '⏳ Getting sound ready…';
const RETRY = '🔇 Sound isn\'t playing — tap to retry';
const MUTED = '🔇 Sound off — tap to turn on';

/* (a) The core race, both Quests: resume() resolves asynchronously
 * after the tap, and the first-tap clip still plays — no speech
 * fallback, no stuck move. The toggle and the status follow the
 * audio proving itself; the waveform rides the speaking digit. */
async function firstTapRace(game, a, b, landmark, firstClip, firstFrag) {
  const t = boot(game, a, b, { audio: true, speech: 'speaking' });
  const d = t.d;
  assert.equal(d.querySelector('#sound-toggle').textContent, READY, game + ': toggle starts in ready state');
  assert(d.querySelector('#sound-toggle').classList.contains('ready'), game + ': ready toggle looks pending');
  assert(d.querySelector('.landmark').disabled, game + ': landmarks locked while the voices load');
  assert.equal(d.querySelector('#progress-status').textContent, 'Getting the voices ready…', game + ': status says loading');
  await flush(); // the load-time preload settles before any tap
  assert.equal(d.querySelector('#sound-toggle').textContent, '🔊 Sound on', game + ': toggle transitions once the voices load');
  assert(!d.querySelector('.landmark').disabled, game + ': landmarks open once the voices load');
  d.querySelector(landmark).click();
  await flush();
  assert.equal(d.body.dataset.phase, 'narrating', game + ': narrating while the resume is pending');
  assert.equal(d.querySelector('#progress-status').textContent, VOLUME_HINT, game + ': volume hint while audio is unproven');
  assert.equal(t.starts.length, 0, game + ': no clip before the resume resolves');
  assert.equal(t.spoken.length, 0, game + ': no speech fallback before the resume resolves');
  t.resolveResume();
  await flush();
  assert.equal(t.starts.length, 1, game + ': first-tap clip plays once resume resolves');
  assert.equal(t.spoken.length, 0, game + ': clip wins, no speech fallback');
  assert.equal(d.querySelector('#sound-toggle').textContent, '🔊 Sound on', game + ': audio proven by the first clip');
  assert(!d.querySelector('#sound-toggle').classList.contains('ready'), game + ': ready state clears once proven');
  assert.equal(d.querySelector('#progress-status').textContent, 'Listen to the count…', game + ': status goes plain once proven');
  const leftDigit = d.querySelector('#left-num .d-tens.speaking');
  assert(leftDigit, game + ': speaking tens digit glows');
  assert(leftDigit.classList.contains('speak-left'), game + ': glow in the left side colour');
  const wave = leftDigit.querySelector('.voice-wave');
  assert(wave, game + ': waveform under the speaking digit');
  assert.equal(wave.querySelectorAll('i').length, 5, game + ': five waveform bars');
  assert(wave.classList.contains('speak-left'), game + ': waveform carries the left side colour');
  assert(!d.querySelector('#right-num .speaking'), game + ': other side stays still');
  assert(!d.querySelector('#right-num .voice-wave'), game + ': no waveform on the other side');
  t.starts[0].onended();
  await flush();
  assert.equal(t.starts.length, 2, game + ': second fragment plays its clip');
  assert(!d.querySelector('#left-num .voice-wave'), game + ': wave leaves the left digit');
  const rightDigit = d.querySelector('#right-num .d-tens.speaking');
  assert(rightDigit && rightDigit.classList.contains('speak-right'), game + ': glow moves to the right digit');
  assert(rightDigit.querySelector('.voice-wave'), game + ': waveform under the right digit');
  assert(rightDigit.querySelector('.voice-wave').classList.contains('speak-right'), game + ': right waveform carries the right side colour');
  t.starts[1].onended();
  await settle(t);
  assert.equal(d.querySelectorAll('.voice-wave').length, 0, game + ': no waveform left after the move');
  assert.equal(d.querySelectorAll('.speaking').length, 0, game + ': no glow left after the move');
  assert.equal(d.body.dataset.phase, 'ready', game + ': move completes');
  t.close();
}

(async () => {
  let checks = 0;
  await firstTapRace('cancellation', 78, 35, '.landmark', 'audio/boy/tens-6.mp3');
  checks++;
  await firstTapRace('addition', 47, 26, '[data-landmark="volcano"]', 'audio/boy/tens-5.mp3');
  checks++;

  // (b) Preload runs at page load and playback shares its fetches: all
  // 63 clips are requested before any tap, the places stay locked
  // while the load is held, and once it settles the first clip plays
  // from the preloaded buffer with no second fetch.
  {
    const t = boot('cancellation', 78, 35, { audio: true, speech: 'speaking', holdFetch: true });
    const d = t.d;
    assert.equal(t.requests.length, 63, 'all 63 clips fetch at page load');
    assert(d.querySelector('.landmark').disabled, 'landmarks locked while the preload is held');
    assert.equal(d.querySelector('#progress-status').textContent, 'Getting the voices ready…');
    d.querySelector('.landmark').click();
    await flush();
    assert.equal(d.body.dataset.phase, 'ready', 'locked landmarks do not start a move');
    assert.equal(t.starts.length, 0, 'nothing plays before the voices load');
    for (const def of t.fetchDeferreds.values()) def.resolve({ ok: true, arrayBuffer: async () => ({}) });
    await flush();
    assert.equal(d.querySelector('#sound-toggle').textContent, '🔊 Sound on', 'toggle transitions once the preload settles');
    assert(!d.querySelector('.landmark').disabled, 'landmarks open once the voices load');
    d.querySelector('.landmark').click();
    await flush();
    t.resolveResume();
    await flush();
    const first = 'audio/boy/tens-6.mp3', second = 'audio/girl/tens-2.mp3';
    assert.equal(t.requests.filter((p) => p === first).length, 1, 'preload + playback share one in-flight fetch');
    assert.equal(t.starts.length, 1, 'clip plays from the preloaded buffer once resumed');
    t.starts[0].onended();
    await flush();
    assert.equal(t.requests.filter((p) => p === second).length, 1, 'second fragment also deduped');
    t.starts[1].onended();
    await settle(t);
    assert.equal(d.body.dataset.phase, 'ready');
    t.close(); checks++;
  }

  // (c) A transient fetch failure retries on the next tap instead of
  // caching false — and the retried clip plays. The boot preload
  // fetches once and opens degraded; each tap's honest attempt fetches
  // again.
  {
    const t = boot('cancellation', 78, 35, { audio: true, speech: 'speaking', failFetch: true });
    const d = t.d;
    await flush();
    assert.equal(d.querySelector('#sound-toggle').textContent, RETRY, 'failed preload opens degraded with retry');
    d.querySelector('.landmark').click();
    await flush();
    t.resolveResume();
    await settle(t);
    assert.equal(t.requests.filter((p) => p === 'audio/boy/tens-6.mp3').length, 2, 'boot preload + first tap fetch the failed clip');
    assert(t.spokenAll.length > 0, 'first move fell back to speech');
    assert.equal(t.starts.length, 0, 'no clip while every fetch fails');
    t.setFailFetch(false);
    d.querySelector('.landmark').click();
    await flush();
    assert.equal(t.requests.filter((p) => p === 'audio/boy/tens-6.mp3').length, 3, 'transient failure retries on the next tap');
    assert.equal(t.starts.length, 1, 'retried clip plays');
    t.starts[0].onended();
    await settle(t);
    assert.equal(d.body.dataset.phase, 'ready');
    t.close(); checks++;
  }

  // (d) Audio that never starts: the fragment finishes promptly (well
  // under 8s), the move completes, the stuck utterance is cancelled
  // so it cannot speak late, and the toggle offers retry / mute.
  {
    const t = boot('cancellation', 78, 35, { audio: false, speech: 'stuck' });
    const d = t.d;
    // No AudioContext at all: there are no clips to load, so the gate
    // opens at once (speech is the fallback) instead of waiting.
    assert.equal(d.querySelector('#sound-toggle').textContent, '🔊 Sound on');
    d.querySelector('.landmark').click();
    await flush();
    assert.equal(d.body.dataset.phase, 'narrating');
    assert.equal(d.querySelector('#progress-status').textContent, VOLUME_HINT);
    assert.equal(t.spokenAll.length, 1, 'one speech attempt queued');
    assert.equal(t.startTimers.length, 1, 'fragment waits on its start timer');
    const cancelsBefore = t.cancels.length; // newProblem already cancelled once at boot
    t.startTimers[0]();
    await flush();
    assert.equal(d.body.dataset.phase, 'ready', 'move completes without waiting 8s');
    assert(!d.querySelector('.landmark').disabled, 'landmarks unlock');
    assert.equal(t.spokenAll.length, 1, 'degraded move does not queue speech for every fragment');
    assert.equal(t.cancels.length, cancelsBefore + 1, 'stuck utterance cancelled so it cannot speak late');
    assert.equal(d.querySelector('#sound-toggle').textContent, RETRY);
    d.querySelector('#sound-toggle').click(); await flush();
    assert.equal(d.querySelector('#sound-toggle').textContent, '🔊 Sound on', 'retry clears degraded');
    d.querySelector('#sound-toggle').click(); await flush();
    assert.equal(d.querySelector('#sound-toggle').textContent, MUTED, 'mute after retry');
    d.querySelector('#sound-toggle').click(); await flush();
    assert.equal(d.querySelector('#sound-toggle').textContent, '🔊 Sound on', 'unmute returns to on');
    t.close(); checks++;
  }

  // (e1) Watchdog completion is terminal: speech that started but
  // never ended is cut by the watchdog, and a late onend starts nothing.
  {
    const t = boot('cancellation', 78, 35, { audio: false, speech: 'started' });
    const d = t.d;
    d.querySelector('.landmark').click();
    await flush();
    assert.equal(d.body.dataset.phase, 'narrating');
    assert.equal(t.spokenAll.length, 1, 'speech started');
    assert.equal(t.watchdogs.length, 1, 'watchdog armed for the started fragment');
    t.watchdogs[0]();
    await flush();
    assert.equal(d.body.dataset.phase, 'ready', 'watchdog releases the move');
    assert.equal(d.querySelector('#sound-toggle').textContent, RETRY);
    t.spokenAll[0].onend();
    await flush();
    assert.equal(d.body.dataset.phase, 'ready', 'late onend changes nothing');
    assert.equal(t.starts.length, 0, 'late end starts no clip');
    assert.equal(t.spokenAll.length, 1, 'late end queues no new speech');
    t.close(); checks++;
  }

  // (e2) A hung load is terminal too: the preload timeout opens the
  // game degraded, the start timer finishes the fragment whose clip
  // never lands, and the fetch landing late caches but starts nothing.
  {
    const t = boot('cancellation', 78, 35, { audio: true, speech: 'speaking', holdFetch: true });
    const d = t.d;
    assert(d.querySelector('.landmark').disabled, 'landmarks locked while the preload hangs');
    assert.equal(t.watchdogs.length, 1, 'preload timeout armed while the load hangs');
    t.watchdogs[0](); // the 8s preload fallback opens the game degraded
    await flush();
    assert(!d.querySelector('.landmark').disabled, 'preload timeout opens the game');
    assert.equal(d.querySelector('#sound-toggle').textContent, RETRY, 'hung preload opens degraded with retry');
    d.querySelector('.landmark').click();
    await flush();
    t.resolveResume();
    await flush();
    assert.equal(t.starts.length, 0, 'clip waits for its held fetch');
    assert.equal(t.startTimers.length, 1, 'start timer armed while the load hangs');
    t.startTimers[0]();
    await flush();
    assert.equal(d.body.dataset.phase, 'ready', 'hung load releases the move');
    t.fetchDeferreds.get('audio/boy/tens-6.mp3').resolve({ ok: true, arrayBuffer: async () => ({}) });
    await flush();
    assert.equal(t.starts.length, 0, 'late fetch starts no clip');
    t.close(); checks++;
  }

  // (f) "Zero tens": the speaking place has no digit on screen, so the
  // waveform underlines the whole number instead of the caption.
  {
    const t = boot('cancellation', 25, 15, { audio: true, speech: 'speaking' });
    const d = t.d;
    await flush(); // the load-time preload settles before any tap
    d.querySelector('.landmark').click();
    await flush();
    t.resolveResume();
    await flush();
    t.starts[0].onended();
    await flush();
    assert.equal(t.starts.length, 2, 'zero-tens fragment plays its clip');
    assert(d.querySelector('#right-cap .t.speaking'), 'zero tens glows in the caption');
    const wholeWave = d.querySelector('#right-num > .voice-wave');
    assert(wholeWave, 'wave underlines the whole number for zero tens');
    assert(wholeWave.classList.contains('speak-right'), 'whole-number wave carries the right side colour');
    assert(!d.querySelector('#right-cap .voice-wave'), 'no waveform under the caption');
    t.starts[1].onended();
    await settle(t);
    assert.equal(d.body.dataset.phase, 'ready');
    t.close(); checks++;
  }

  // (h) The boot gate: the places stay off the page until the voices
  // actually load, then the toggle, status, next move and caption all
  // transition at once; a muted game opens immediately.
  {
    const t = boot('cancellation', 78, 35, { audio: true, speech: 'speaking' });
    const d = t.d;
    assert.equal(d.querySelector('#sound-toggle').textContent, READY, 'toggle starts loading');
    assert(d.querySelector('.landmark').disabled, 'landmarks locked while loading');
    assert.equal(d.body.dataset.audio, 'loading', 'page marks itself loading');
    assert.equal(d.querySelector('#progress-status').textContent, 'Getting the voices ready…', 'status says loading');
    assert.equal(d.querySelector('#next-chip').textContent, 'Getting the voices ready…', 'next move says loading');
    assert(d.querySelector('#captions').textContent.includes('Getting the voices ready'), 'caption says loading');
    await flush();
    assert.equal(d.querySelector('#sound-toggle').textContent, '🔊 Sound on', 'toggle transitions once loaded');
    assert(!d.querySelector('.landmark').disabled, 'landmarks open once loaded');
    assert.equal(d.body.dataset.audio, 'ready', 'page marks itself ready');
    assert(d.querySelector('#next-chip').textContent.includes('tap a place'), 'next move invites a tap once loaded');
    assert(d.querySelector('#captions').textContent.includes('Tap a place'), 'caption invites a tap once loaded');
    t.close(); checks++;
    // Muted opens at once: there is no audio to wait for.
    const m = boot('cancellation', 78, 35, { audio: true, speech: 'speaking', soundOff: true });
    const md = m.d;
    assert.equal(md.querySelector('#sound-toggle').textContent, MUTED, 'muted toggle at boot');
    assert(!md.querySelector('.landmark').disabled, 'muted landmarks open at boot');
    assert.equal(md.body.dataset.audio, 'ready', 'muted page marks itself ready');
    m.close(); checks++;
  }

  // (g) CSS: the speaking scale is gone, the indicator rules exist,
  // and reduced motion keeps the indicator static.
  for (const game of ['cancellation', 'addition']) {
    const css = fs.readFileSync(path.join(__dirname, game + '-quest.css'), 'utf8');
    assert(!css.includes('scale(1.16)'), game + ': speaking scale removed');
    assert(!/\.bignum \.speaking, \.equation \.speaking \{[^}]*transform/.test(css), game + ': no transform on speaking numbers');
    assert(css.includes('.voice-wave'), game + ': waveform rule present');
    assert(css.includes('speak-pulse'), game + ': outline pulse present');
    assert(css.includes('--speak-color'), game + ': side-coloured speaking state');
    assert(css.includes('body[data-audio="loading"] .landmark-strip { display: none; }'), game + ': loading gate hides the places');
    const rm = css.split('@media (prefers-reduced-motion: reduce)').slice(1).join('\n');
    assert(rm && rm.includes('.voice-wave i') && rm.includes('animation: none'), game + ': reduced-motion waveform static');
    assert(rm && rm.includes('speak-left') && rm.includes('animation: none'), game + ': reduced-motion outline steady');
    const html = fs.readFileSync(path.join(__dirname, game + '-quest.html'), 'utf8');
    assert(html.includes(game + '-quest.css?v=18'), game + ': stylesheet cache-busted');
    assert(html.includes(game + '-quest.js?v=19'), game + ': script cache-busted');
    checks++;
  }

  console.log(`Quest audio recovery passed: ${checks} cases — first-tap race, in-flight dedup, transient retry, prompt never-starts finish, terminal watchdog/late fetch, speaking glow + waveform sync, zero-tens underline, no speaking scale, static reduced motion, boot gate.`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
