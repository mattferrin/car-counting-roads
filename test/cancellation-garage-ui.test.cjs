'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const at=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
function app(query=''){
 const dom=new JSDOM(at('cancellation-garage.html'),{url:'https://example.test/test/cancellation-garage.html'+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let clock=0;w.requestAnimationFrame=cb=>{queueMicrotask(()=>cb(clock+=100));return clock;};
 w.SVGElement.prototype.getTotalLength=()=>300;w.SVGElement.prototype.getPointAtLength=l=>({x:30+l,y:130});
 w.matchMedia=()=>({matches:false});w.localStorage.setItem('cp-sound','off');
 const errors=[];w.addEventListener('error',e=>errors.push(e.error));
 for(const f of ['counting-voice.js','cancellation-garage-engine.js','cancellation-garage.js'])w.eval(at(f));
 return {w,d:w.document,errors,close:()=>w.close(),snapshot:()=>w.CancellationGarageView.snapshot()};
}
const tick=()=>new Promise(r=>setImmediate(r));
async function idle(a){for(let i=0;i<25&&a.snapshot().busy;i++)await tick();assert.equal(a.snapshot().busy,false,'interaction lock released');assert.deepEqual(a.errors,[]);}
function check(a,blue,gold){const s=a.snapshot();assert.equal(s.blue,blue);assert.equal(s.gold,gold);assert.equal(s.difference,blue-gold);assert.equal(a.d.querySelectorAll('.garage-unit').length,blue+gold);assert.equal(a.d.querySelectorAll('.garage-unit.paired').length,2*Math.min(blue,gold));assert.equal(a.d.querySelector('#total').textContent,blue<gold?'−'+(gold-blue):String(blue-gold));}
async function drive(a,kind,n){a.d.querySelector(`[data-kind="${kind}"][data-amount="${n}"]`).dispatchEvent(new a.w.MouseEvent('click',{bubbles:true}));await idle(a);}
(async()=>{
 const a=app();assert.equal(a.d.querySelectorAll('.garage-route').length,8);check(a,10,0);
 const first=a.d.querySelector('.garage-unit');
 for(const [kind,n,b,g]of [['entry',10,20,0],['down',10,10,10],['up',1,11,9],['down',1,10,10],['exit',10,10,0],['entry',1,11,0],['down',10,1,10],['exit',1,1,9]]){await drive(a,kind,n);check(a,b,g);}
 assert.ok(first.isConnected,'survivor keeps DOM identity');
 await drive(a,'up',10);check(a,1,9);a.close();
 const b=app('?a=3&b=7');await drive(b,'up',1);check(b,4,6);await drive(b,'up',1);check(b,5,5);await drive(b,'up',1);check(b,6,4);
 const saved=Array.from(b.d.querySelectorAll('.garage-unit')).map(n=>n.dataset.id).join();b.d.querySelector('[data-theme="mermaids"]').click();check(b,6,4);assert.equal(b.snapshot().theme,'mermaids');assert.equal(Array.from(b.d.querySelectorAll('.garage-unit')).map(n=>n.dataset.id).join(),saved);
 b.d.querySelector('#clear').click();check(b,0,0);b.close();
 const c=app('?max=100&a=100&b=100');check(c,100,100);assert.equal(c.d.querySelectorAll('.garage-unit.paired').length,200);await drive(c,'entry',1);check(c,100,100);
 c.d.querySelector('#capacity').value='20';c.d.querySelector('#capacity').dispatchEvent(new c.w.Event('change'));assert.equal(c.snapshot().max,100);check(c,100,100);c.close();
 const audio=app(),spoken=[];
 audio.w.SpeechSynthesisUtterance=function(text){this.text=text;};
 audio.w.speechSynthesis={cancel(){},getVoices:()=>[{name:'Alex',lang:'en-US'},{name:'Samantha',lang:'en-US'}],speak(u){spoken.push(u);u.onstart();}};
 audio.d.querySelector('#sound-toggle').click();
 audio.d.querySelector('[data-kind="entry"][data-amount="10"]').dispatchEvent(new audio.w.MouseEvent('click',{bubbles:true}));
 // A duplicate tap cannot create another move while animation/narration owns the lock.
 audio.d.querySelector('[data-kind="entry"][data-amount="1"]').dispatchEvent(new audio.w.MouseEvent('click',{bubbles:true}));
 await tick();check(audio,20,0);assert.equal(audio.snapshot().busy,true);assert.equal(spoken.length,1);assert.equal(spoken[0].text,'two tens');assert.equal(spoken[0].voice.name,'Alex');assert.equal(audio.d.querySelectorAll('.garage-unit.speaking').length,20);
 spoken[0].onend();await idle(audio);assert.equal(audio.d.querySelectorAll('.speaking').length,0);
 audio.d.querySelector('[data-kind="down"][data-amount="10"]').dispatchEvent(new audio.w.MouseEvent('click',{bubbles:true}));await tick();assert.equal(spoken.length,2);assert.equal(spoken[1].voice.name,'Alex');assert.equal(audio.d.querySelectorAll('.garage-unit.blue.speaking').length,10);
 spoken[1].onend();await tick();assert.equal(spoken.length,3);assert.equal(spoken[2].voice.name,'Samantha');assert.equal(audio.d.querySelectorAll('.garage-unit.gold.speaking').length,10);
 audio.d.querySelector('#sound-toggle').click();await idle(audio);assert.equal(audio.d.querySelectorAll('.speaking').length,0);check(audio,10,10);audio.close();
 console.log('Garage UI passed: all eight controls, capacity/200 units, identity, themes, negative→zero→positive, invalid moves, duplicate taps, voice order, synchronized highlights, mute recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
