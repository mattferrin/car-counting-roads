/* npm install --prefix /tmp/cq-test-deps jsdom
 * NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-ui.test.cjs
 * DOM integration tests with controlled speech/animation completion events.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const path = require('node:path');
const flush = async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate)};
function boot(a,b,mode='speech') {
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'cancellation-quest.html'),'utf8'),{url:`https://example.org/?a=${a}&b=${b}`,runScripts:'outside-only'});
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
 for(const name of ['cancellation-engine.js','cancellation-layout.js','theme-switch.js','cancellation-quest.js'])w.eval(fs.readFileSync(path.join(__dirname,name),'utf8'));
 return {w,pending,watchdogs,close:()=>dom.window.close()};
}
async function settle(t, errors=false){
 for(let i=0;i<40 && !['ready','complete'].includes(t.w.document.body.dataset.phase);i++) {
   await flush(); const u=t.pending.shift(); if(u)(errors?u.onerror:u.onend)();
 }
 await flush(); assert(['ready','complete'].includes(t.w.document.body.dataset.phase));
}
(async()=>{
 let checks=0;
 for(const [a,b] of [[78,35],[59,25],[42,17],[100,47],[10,10],[0,0],[7,0]]) {
  const t=boot(a,b),d=t.w.document;
  await settle(t);
  const E=require('./cancellation-engine');const sol=E.solve(a,b);
  for(let i=0;i<sol.moves.length;i++) {
   const button=d.querySelector('.landmark');
   const survivor=d.querySelectorAll('#left-grid .obj')[sol.moves[i]===1?0:sol.moves[i]];
   button.click(); button.click(); d.querySelector('.theme-pill:not([aria-pressed="true"])').click(); d.querySelector('#new-mystery').click();
   assert.equal(d.body.dataset.phase,'moving');
   assert(button.disabled);assert(d.querySelector('.theme-pill').disabled);
   assert.equal(d.querySelectorAll('.obj.speaking').length,sol.moves[i]*2);
   assert(!d.querySelector('#new-mystery').classList.contains('show'));
   await settle(t);
   assert.equal(+d.querySelector('#left-num').textContent,sol.states[i+1].left);
   assert.equal(d.querySelectorAll('#left-grid .obj').length,sol.states[i+1].left);
   assert.equal(d.querySelectorAll('#right-grid .obj').length,sol.states[i+1].right);
   if(survivor && sol.states[i+1].left)assert(survivor.isConnected);
   checks++;
  }
  assert.equal(d.querySelector('#eq-q').textContent,String(a-b));
  assert(d.querySelector('#new-mystery').classList.contains('show'));
  assert.equal(d.body.dataset.phase,'complete');
  t.close();
 }
 for(const failure of ['error','mute','timeout','unsupported']) {
  const t=boot(9,5,failure),d=t.w.document;
  d.querySelector('.landmark').click();await flush();
  if(failure==='mute')d.querySelector('#sound-toggle').click();
  if(failure==='timeout') { t.watchdogs[0](); await flush(); }
  await settle(t,failure==='error');
  assert.equal(d.querySelector('#left-num').textContent,'8');assert(!d.querySelector('.landmark').disabled);
  t.close(); checks++;
 }
 // --- New Mystery banner: directly under the equation bar, the only
 // New Mystery button, hidden until solved, shown after — both themes.
 for (const theme of ['cars','mermaids']) {
  const t=boot(78,35),d=t.w.document;
  await settle(t);
  if (theme==='mermaids') { d.querySelector('[data-theme="mermaids"]').click(); await flush(); }
  const E=require('./cancellation-engine');const sol=E.solve(78,35);
  assert(d.querySelector('.eqbar + #celebrate-banner'), 'celebration banner directly under the equation bar');
  assert(d.querySelector('#celebrate-banner').contains(d.querySelector('#new-mystery')));
  assert.equal(d.querySelectorAll('#new-mystery').length,1);
  assert(!d.querySelector('.celebrate'), 'old bottom celebrate div removed');
  assert(d.querySelector('#celebrate-banner').hidden);
  assert(d.querySelector('#new-mystery').hidden && d.querySelector('#new-mystery').disabled);
  for(let i=0;i<sol.moves.length;i++){ d.querySelector('.landmark').click(); await settle(t); }
  assert.equal(d.querySelector('#eq-q').textContent,'43');
  assert.equal(d.querySelector('#celebrate-banner').hidden,false);
  assert(d.querySelector('#celebrate-banner').classList.contains('show'));
  assert(!d.querySelector('#new-mystery').hidden && !d.querySelector('#new-mystery').disabled);
  assert(d.querySelector('#new-mystery').classList.contains('show'));
  t.close(); checks++;
 }
 // Count highlights follow speech start/end, and controls stay locked throughout.
 // (No amount is announced before the move: the rows just light up and fly,
 // so the first spoken fragment after a tap is the new count itself.)
 const t=boot(78,35),d=t.w.document;
 d.querySelector('.landmark').click(); await flush();
 assert.equal(t.pending[0].text,'six tens');assert(d.querySelector('#left-num .d-tens.speaking'));
 t.pending.shift().onend();await flush();
 assert.equal(t.pending[0].text,'two tens');assert(d.querySelector('#right-num .d-tens.speaking'));assert(d.querySelector('.landmark').disabled);
 await settle(t);assert.equal(d.querySelectorAll('.speaking').length,0);t.close();
 console.log(`UI: ${checks} move/recovery cases passed; duplicate taps, identity, speech highlights, locks, completion, banner placement and failures verified.`);
})().catch(e=>{console.error(e);process.exitCode=1});
