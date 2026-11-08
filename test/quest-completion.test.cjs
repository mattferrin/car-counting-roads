'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
const tick=()=>new Promise(setImmediate);
function boot(game,theme,a,b){
 const dom=new JSDOM(read(game+'-quest.html'),{url:`https://example.test/${game}-quest.html?theme=${theme}&a=${a}&b=${b}`,runScripts:'outside-only'}),w=dom.window,d=w.document,pending=[];
 Object.defineProperty(d,'readyState',{value:'complete'});w.matchMedia=()=>({matches:true});
 w.HTMLElement.prototype.animate=()=>({finished:Promise.resolve()});
 const style=d.createElement('style');style.textContent=read(game+'-quest.css')+'\n'+read('storybook.css');d.head.append(style);
 w.SpeechSynthesisUtterance=function(text){this.text=text;};
 w.speechSynthesis={getVoices:()=>[],cancel(){pending.length=0;},speak:u=>{pending.push(u);u.onstart?.();}};
 for(const f of [game+'-engine.js',game+'-layout.js',game+'-quest.js'])w.eval(read(f));
 return {w,d,pending,close:()=>w.close()};
}
async function settle(t){
 for(let i=0;i<80;i++){
  await tick();
  if(['narrating','celebrating'].includes(t.d.body.dataset.phase)){
   for(const strip of t.d.querySelectorAll('.landmark-strip')){
    const style=t.w.getComputedStyle(strip);
    assert.equal(style.visibility,'hidden','audio wait hides landmarks');
    assert.notEqual(style.display,'none','audio wait preserves landmark space');
    assert.equal(style.pointerEvents,'none','invisible landmarks cannot intercept taps');
   }
  }
  const u=t.pending.shift();if(u)u.onend();
  if(['ready','complete'].includes(t.d.body.dataset.phase)&&!t.pending.length)return;
 }
 throw Error('Quest failed to settle: '+t.d.body.dataset.phase);
}
function strips(t,hidden){for(const s of t.d.querySelectorAll('.landmark-strip')){const style=t.w.getComputedStyle(s);assert.equal(style.display==='none',hidden);if(!hidden)assert.equal(style.visibility,'visible','landmarks visible when ready/moving');}}
(async()=>{
 let cases=0;
 for(const game of ['addition','cancellation'])for(const theme of ['cars','mermaids'])for(const [a,b]of [[47,26],[26,47],[10,10],[0,0],[7,0],[0,7],[99,99]]){
  if(game==='cancellation'&&b>a)continue;
  const t=boot(game,theme,a,b),d=t.d,E=require('./'+game+'-engine'),solution=E.solve(a,b);await settle(t);
  for(const move of solution.moves){
   strips(t,false);d.querySelector('.landmark').click();strips(t,false);
   assert.equal(d.body.dataset.phase,'moving','strips remain during final flight');
   assert.ok([...d.querySelectorAll('.landmark')].every(b=>b.disabled));await settle(t);
  }
  assert.equal(d.body.dataset.phase,'complete');strips(t,true);
  assert.equal(Number(d.querySelector('#eq-q').textContent),solution.answer);
  const surviving=game==='addition'?a+b:Math.abs(a-b);
  assert.equal(d.querySelectorAll('.grid .obj').length,surviving,'every surviving object retained');
  assert.notEqual(t.w.getComputedStyle(d.querySelector('.equation')).display,'none');
  const next=d.querySelector('#new-mystery');assert.equal(next.hidden,false);assert.equal(next.disabled,false);assert.equal(d.querySelector('#celebrate-banner').hidden,false);
  d.querySelector('.theme-pill:not([aria-pressed="true"])').click();strips(t,true);assert.equal(Number(d.querySelector('#eq-q').textContent),solution.answer,'theme switch retains final answer');
  t.w.Math.random=()=>.4;next.click();await settle(t);assert.equal(d.body.dataset.phase,'ready');strips(t,false);assert.ok([...d.querySelectorAll('.landmark')].every(b=>!b.disabled));assert.equal(next.hidden,true);assert.equal(d.querySelector('#eq-q').textContent,'?');
  t.close();cases++;
 }
 console.log(`Quest completion passed: ${cases} game/theme/problem cases, both directions, equal/zero/99 boundaries, final flights, surviving objects/equation/answer, theme changes and restart.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
