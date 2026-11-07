/* Addition Quest — DOM integration tests with controlled speech/animation.
 * Run:  NODE_PATH=~/workspace/cancellation-quest/node_modules node addition-ui.test.cjs
 * Covers the full playthrough in both directions, the exact 47+26 trace,
 * rapid-tap locking, New Mystery gating, theme switching, the equal and
 * zero cases, regrouping in both directions, tapping the source group
 * NOT moving (only a landmark tap moves — there is no Move button and
 * no source tap), captions in tens/ones words only, no pre-move amount
 * announcement, and speech-failure recovery. Also the map: tapping a
 * landmark performs the move, landmarks lock while a move is in flight,
 * the bigger/smaller badge size classes follow the numbers, the
 * celebration banner sits directly under the equation bar with the only
 * New Mystery button, and the nav (test banner, back-home nav, footer)
 * is the same as on every other test page.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};
function boot(a,b,mode='speech') {
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'addition-quest.html'),'utf8'),{url:`https://example.org/?a=${a}&b=${b}`,runScripts:'outside-only'});
 const w=dom.window, pending=[],watchdogs=[];
 Object.defineProperty(w.document,'readyState',{value:'complete'});
 w.matchMedia=()=>({matches:true});
 w.HTMLElement.prototype.animate=function(){return {finished:Promise.resolve()}};
 const timer=w.setTimeout.bind(w);
 w.setTimeout=(f,ms)=>ms===8000?(watchdogs.push(f),0):timer(f,ms);
 if(mode!=='unsupported') {
  w.SpeechSynthesisUtterance=function(text){this.text=text};
  w.speechSynthesis={getVoices:()=>[],cancel:()=>{pending.length=0},speak:u=>{pending.push(u);u.onstart?.()}};
 }
 for(const name of ['addition-engine.js','addition-layout.js','addition-quest.js'])w.eval(fs.readFileSync(path.join(__dirname,name),'utf8'));
 return {w,pending,watchdogs,close:()=>dom.window.close()};
}
async function settle(t, errors=false){
 for(let i=0;i<40 && !['ready','complete'].includes(t.w.document.body.dataset.phase);i++) {
   await flush(); const u=t.pending.shift(); if(u)(errors?u.onerror:u.onend)();
 }
 await flush(); assert(['ready','complete'].includes(t.w.document.body.dataset.phase));
}
const E=require('./addition-engine');
(async()=>{
 let checks=0;
 // --- Full 47+26 playthrough, exact trace, source right -> dest left ----
 {
  const t=boot(47,26),d=t.w.document;
  await settle(t);
  const sol=E.solve(47,26);
  assert.equal(d.querySelector('#total-badge').textContent,'Total stays 73');
  // No Move button anywhere: landmarks are the only move trigger.
  assert(!d.querySelector('#move-btn'), 'Move button removed from the DOM');
  assert(!d.querySelector('.move-row'), 'move row removed');
  assert.equal(d.querySelectorAll('.obj.movable').length,0, 'objects carry no tap invite');
  assert(d.querySelector('#captions').textContent.includes('Tap a place on the map'), 'step-0 caption directs the child to a landmark');
  assert.equal(d.querySelector('#left-size').textContent,'bigger');
  assert.equal(d.querySelector('#right-size').textContent,'smaller');
  // The word matches what it says: "bigger" is big, "smaller" is small.
  assert(d.querySelector('#left-size').classList.contains('bigger'));
  assert(d.querySelector('#right-size').classList.contains('smaller'));
  assert(d.querySelector('#new-mystery').hidden && d.querySelector('#new-mystery').disabled);
  // The celebration banner sits directly under the sticky equation bar
  // and holds the ONLY New Mystery button; the old bottom placement
  // is gone.
  assert(d.querySelector('.eqbar + #celebrate-banner'), 'celebration banner directly under the equation bar');
  assert(d.querySelector('#celebrate-banner').contains(d.querySelector('#new-mystery')));
  assert.equal(d.querySelectorAll('#new-mystery').length,1);
  assert(!d.querySelector('.celebrate'), 'old bottom celebrate div removed');
  assert(d.querySelector('#celebrate-banner').hidden);
  // Navigation, same as every other test page: test banner up top with
  // the stable-games escape, back-home nav + footer links.
  assert(d.querySelector('nav[aria-label="Test version"] a[href="../"]').textContent.includes('Play the stable games'));
  assert.equal(d.querySelector('.game-nav a[href="index.html"]').textContent,'← Back to test games');
  assert.equal(d.querySelector('.foot a[href="index.html"]').textContent,'← Back to test games');
  assert.equal(d.querySelector('.foot a[href="../"]').textContent,'Stable games');
  assert.equal(d.querySelectorAll('.eqbar .theme-pill').length,2);
  assert(d.querySelector('.eqbar #sound-toggle'), 'sound toggle in the equation bar');
  // The map: four landmarks, cars theme, in page order — sky, mid, ground.
  const lms=[...d.querySelectorAll('.landmark')];
  assert.equal(lms.length,4);
  assert.deepEqual(lms.map(b=>b.querySelector('.name').textContent),['Castle','Magic Tree','Volcano','Car Wash']);
  for(let i=0;i<sol.moves.length;i++) {
   const lm=d.querySelector('[data-landmark="volcano"]');
   lm.click(); lm.click(); lm.click(); // rapid triple-tap must equal one move
   d.querySelector('.test-problem').click(); d.querySelector('#new-mystery').click();
   assert.equal(d.body.dataset.phase,'moving');
   assert(lm.disabled);assert(d.querySelector('.level-pill').disabled);assert(d.querySelector('.theme-pill').disabled);
   assert(d.querySelector('.landmark').disabled, 'landmarks locked while a move is in flight');
   assert.equal(d.querySelectorAll('.obj.speaking').length,sol.moves[i]);
   // No pre-move amount announcement: nothing is spoken at the moment of
   // the tap — the first spoken fragment comes only after the flight,
   // and it is the new count itself.
   assert.equal(t.pending.length,0);
   assert(!d.querySelector('#new-mystery').classList.contains('show'));
   await flush();
   assert(t.pending.length>0);
   const WORDS=['zero','one','two','three','four','five','six','seven','eight','nine'];
   const st1=sol.states[i+1], pv=E.placeValue(st1.left);
   const expectedLeft = i===sol.moves.length-1 ? 'The answer is'
     : sol.moves[i]===10 || Math.floor(sol.states[i].left/10)!==Math.floor(st1.left/10)
     ? WORDS[pv.tens]+(pv.tens===1?' ten':' tens')
     : WORDS[pv.ones]+(pv.ones===1?' one':' ones');
   assert.equal(t.pending[0].text,expectedLeft);
   if(i===0) assert.equal(t.pending[0].text,'five tens');
   await settle(t);
   assert.equal(+d.querySelector('#left-num').textContent,sol.states[i+1].left);
   assert.equal(+d.querySelector('#right-num').textContent,sol.states[i+1].right);
   assert.equal(d.querySelectorAll('#left-grid .obj').length,sol.states[i+1].left);
   assert.equal(d.querySelectorAll('#right-grid .obj').length,sol.states[i+1].right);
   assert.equal(d.querySelector('#total-badge').textContent,'Total stays 73');
   assert.equal(d.querySelectorAll('#left-grid .obj').length+d.querySelectorAll('#right-grid .obj').length,73);
   // Captions are tens/ones words only — no fused number names.
   const cap=d.querySelector('#captions').textContent;
   assert(!/forty|fifty|sixty|seventy|eighty|ninety|twenty|thirty|eleven|twelve/.test(cap),`fused number word in captions: ${cap}`);
   assert(/tens|ones/.test(cap));
   checks++;
  }
  assert.equal(d.querySelector('#eq-q').textContent,'73');
  assert.equal(d.querySelector('#cheer').hidden,false);
  assert(d.querySelector('#cheer').textContent.includes('47 + 26 = 73'));
  assert.equal(d.querySelector('#celebrate-banner').hidden,false);
  assert(d.querySelector('#celebrate-banner').classList.contains('show'));
  assert(!d.querySelector('#new-mystery').hidden && !d.querySelector('#new-mystery').disabled);
  assert(d.querySelector('#new-mystery').classList.contains('show'));
  assert.equal(d.body.dataset.phase,'complete');
  assert.equal(d.querySelector('#moved-tally').textContent,'Moved over: 2 tens · 6 ones');
  t.close();
 }
 // --- Tapping a landmark IS the move: 47+26 via the Volcano ------------
 {
  const t=boot(47,26),d=t.w.document;
  await settle(t);
  const sol=E.solve(47,26);
  const volc=d.querySelector('[data-landmark="volcano"]');
  assert(volc, 'Volcano landmark exists');
  volc.click();
  assert.equal(d.body.dataset.phase,'moving');
  assert(volc.disabled, 'tapped landmark locks while its move is in flight');
  assert.equal(d.querySelectorAll('.obj.speaking').length,sol.moves[0]);
  assert.equal(t.pending.length,0, 'no pre-move amount announcement via landmark either');
  await settle(t);
  assert.equal(+d.querySelector('#left-num').textContent,57);
  assert.equal(+d.querySelector('#right-num').textContent,16);
  assert(!volc.disabled, 'landmarks unlock after the move');
  // A second move via a different landmark keeps the total.
  d.querySelector('[data-landmark="castle"]').click();
  await settle(t);
  assert.equal(+d.querySelector('#left-num').textContent,67);
  assert.equal(+d.querySelector('#right-num').textContent,6);
  checks++; t.close();
 }
 // --- 26+47: the other direction — source left, dest right ---------------
 {
  const t=boot(26,47),d=t.w.document;
  await settle(t);
  const sol=E.solve(26,47);
  assert.equal(d.querySelector('#left-size').textContent,'smaller');
  assert.equal(d.querySelector('#right-size').textContent,'bigger');
  assert(d.querySelector('#left-size').classList.contains('smaller'));
  assert(d.querySelector('#right-size').classList.contains('bigger'));
  for(let i=0;i<sol.moves.length;i++) {
   d.querySelector('[data-landmark="volcano"]').click();
   await settle(t);
   assert.equal(+d.querySelector('#left-num').textContent,sol.states[i+1].left);
   assert.equal(+d.querySelector('#right-num').textContent,sol.states[i+1].right);
   checks++;
  }
  assert.equal(d.querySelector('#eq-q').textContent,'73');
  assert.equal(d.body.dataset.phase,'complete');
  t.close();
 }
 // --- Equal case 30+30: source right, "Same size" -------------------------
 {
  const t=boot(30,30),d=t.w.document;
  await settle(t);
  assert(d.querySelector('#captions').textContent.includes('Same size'));
  assert.equal(d.querySelector('#left-size').textContent,'same size');
  assert.equal(d.querySelector('#right-size').textContent,'same size');
  assert(d.querySelector('#left-size').classList.contains('same'));
  assert(d.querySelector('#right-size').classList.contains('same'));
  for(let i=0;i<3;i++){d.querySelector('[data-landmark="volcano"]').click();await settle(t);}
  assert.equal(d.querySelector('#eq-q').textContent,'60');
  assert.equal(d.querySelectorAll('#right-grid .obj').length,0);
  assert.equal(d.querySelectorAll('#left-grid .obj').length,60);
  checks++; t.close();
 }
 // --- Zero case 47+0: no moves, celebrate immediately ----------------------
 {
  const t=boot(47,0),d=t.w.document;
  await settle(t);
  assert.equal(d.querySelector('#eq-q').textContent,'47');
  assert(d.querySelector('#new-mystery').classList.contains('show'));
  assert.equal(d.body.dataset.phase,'complete');
  checks++; t.close();
 }
 // --- Regroup both directions ----------------------------------------------
 for(const [a,b] of [[69,4],[4,69]]) {
  const t=boot(a,b),d=t.w.document;
  await settle(t);
  const sol=E.solve(a,b);
  d.querySelector('[data-landmark="volcano"]').click(); await flush();
  // The regrouping move names the destination's full new value (first
  // for 69+4 where the destination is left, second for 4+69 — the second
  // phrase only queues once the first finishes, so drive it).
  assert(d.querySelector('#captions').textContent.includes('seven tens'));
  const seen=[...t.pending.map(u=>u.text)];
  if(t.pending[0]){ t.pending.shift().onend(); await flush(); }
  seen.push(...t.pending.map(u=>u.text));
  assert(seen.includes('seven tens'), 'regroup names seven tens, heard: '+seen.join(', '));
  await settle(t);
  for(let i=1;i<sol.moves.length;i++){d.querySelector('[data-landmark="volcano"]').click();await settle(t);}
  assert.equal(d.querySelector('#eq-q').textContent,'73');
  checks++; t.close();
 }
 // --- Tapping the source group does NOT move; only a landmark moves -------
 {
  const t=boot(47,26),d=t.w.document;
  await settle(t);
  // No tap invite on the objects at all — the landmarks carry it.
  assert.equal(d.querySelectorAll('.obj.movable').length,0);
  const srcObj=d.querySelector('#right-grid .obj');
  assert(srcObj, 'a source object exists to tap');
  srcObj.click(); await flush();
  assert.equal(+d.querySelector('#left-num').textContent,47);
  assert.equal(+d.querySelector('#right-num').textContent,26);
  assert.equal(d.body.dataset.phase,'ready');
  // Tapping a non-moving object in the destination does nothing either.
  const plain=d.querySelector('#left-grid .obj');
  plain.click(); await flush();
  assert.equal(d.querySelector('#left-num').textContent,'47');
  assert.equal(d.body.dataset.phase,'ready');
  // Only a landmark tap moves.
  d.querySelector('[data-landmark="volcano"]').click(); await settle(t);
  assert.equal(+d.querySelector('#left-num').textContent,57);
  assert.equal(+d.querySelector('#right-num').textContent,16);
  checks++; t.close();
 }
 // --- Theme switch keeps counts ---------------------------------------------
 {
  const t=boot(47,26),d=t.w.document;
  await settle(t);
  d.querySelector('[data-landmark="volcano"]').click(); await settle(t);
  d.querySelector('[data-theme="mermaids"]').click(); await flush();
  assert.equal(+d.querySelector('#left-num').textContent,57);
  assert.equal(+d.querySelector('#right-num').textContent,16);
  assert.equal(d.querySelectorAll('#left-grid .obj').length,57);
  assert.equal(d.querySelectorAll('#right-grid .obj').length,16);
  // The next move is still a whole ten, found from the layout — the
  // objects no longer carry a .movable marker.
  assert.equal(t.w.AdditionLayout.movingIds(E.solve(47,26),1).length,10);
  // Mermaid map: same four places, mermaid names, same page order.
  const mlms=[...d.querySelectorAll('.landmark')];
  assert.equal(mlms.length,4);
  assert.deepEqual(mlms.map(b=>b.querySelector('.name').textContent),['Palace','Whirlpool','Coral Reef','Giant Shell']);
  checks++; t.close();
 }
 // --- Speech-failure recovery (mirror of Cancellation Quest) -----------------
 for(const failure of ['error','mute','timeout','unsupported']) {
  const t=boot(9,5,failure),d=t.w.document;
  d.querySelector('.landmark').click();await flush();
  if(failure==='mute')d.querySelector('#sound-toggle').click();
  if(failure==='timeout') { t.watchdogs[0](); await flush(); }
  await settle(t,failure==='error');
  assert.equal(d.querySelector('#left-num').textContent,'10');assert(!d.querySelector('.landmark').disabled);
  t.close(); checks++;
 }
 console.log(`UI: ${checks} move/recovery cases passed; both directions, exact traces, rapid taps, gating, theme, equal/zero/regroup cases, landmark-only moves, source-tap does nothing, captions and failures verified.`);
})().catch(e=>{console.error(e);process.exitCode=1});
