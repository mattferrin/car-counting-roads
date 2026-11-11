'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
const tick=()=>new Promise(setImmediate);
function app(sub,query){
 const dom=new JSDOM(read(sub?'cancellation-garage.html':'index.html'),{url:'https://example.test/'+(sub?'cancellation-garage.html':'index.html')+query,runScripts:'outside-only'}),w=dom.window,d=w.document,frames=[];
 let time=0,release,unlocks=0;
 w.matchMedia=()=>({matches:true});w.requestAnimationFrame=cb=>{frames.push(()=>cb(time+=3000));return frames.length;};
 w.SVGElement.prototype.getTotalLength=()=>300;w.SVGElement.prototype.getPointAtLength=n=>({x:n,y:n});
 w.CountingVoice={createNarrator:()=>({isOn:()=>false,unlock(){unlocks++;},preload(){},stop(){},speakMove:()=>new Promise(r=>{release=r;})})};
 for(const f of ['play-controls.js','play-capacity.js','theme-switch.js',...(sub?['cancellation-garage-engine.js','cancellation-garage.js']:['game.js'])])w.eval(read(f));
 const controls=()=>[...d.querySelectorAll(sub?'.garage-route':'.route')];
 const shown=()=>controls().map(n=>n.getAttribute('aria-hidden'));
 const check=()=>{
  const blue=Number(d.querySelector('#left').textContent),gold=Number(d.querySelector('#right').textContent),max=Number(new URL(w.location).searchParams.get('max'));
  for(const c of controls()){
   const kind=c.dataset.kind,n=Number(c.dataset.amount);
   const valid=kind==='entry'?(sub?blue+n<=max:blue+gold+n<=max):(kind==='exit'?gold>=n:(kind==='top'||kind==='down')?blue>=n&&(!sub||gold+n<=max):gold>=n&&(!sub||blue+n<=max));
   const visual=sub?c:c.querySelector('.route-sign'),hit=sub?d.querySelectorAll('.garage-road-hit')[Number(c.dataset.route)]:c.querySelector('.road-hit');
   assert.equal(c.getAttribute('aria-hidden'),String(!valid));assert.equal(c.getAttribute('tabindex'),valid?'0':'-1');
   assert.equal(visual.style.display,valid?'':'none');assert.equal(hit.style.display,valid?'':'none');
   assert.equal(hit.style.pointerEvents,valid?'':'none');
  }
  assert.equal(d.querySelectorAll(sub?'.garage-road':'.road').length,8,'all useful roads retained');
  for(const road of d.querySelectorAll(sub?'.garage-road,.garage-edge':'.road,.edge'))assert.equal(road.getAttribute('pointer-events'),'none');
 };
 const drive=async(kind,n)=>{
  const c=controls().find(c=>c.dataset.kind===kind&&Number(c.dataset.amount)===n),before=shown();
  const priorUnlocks=unlocks;c.dispatchEvent(new w.MouseEvent('click'));if(!sub)assert.equal(unlocks,priorUnlocks+1,'audio unlock occurs in the initiating tap');assert.deepEqual(shown(),before,'busy start retains controls');
  for(const c of controls())assert.equal(c.getAttribute('tabindex'),'-1','busy controls cannot focus');
  for(let i=0;i<10;i++){while(frames.length)frames.shift()();await tick();if(!sub&&release)break;}
  if(!sub){assert.deepEqual(shown(),before,'post-animation narration retains controls');release();release=null;await tick();}
  check();
 };
 return {w,d,check,drive,close:()=>w.close()};
}
(async()=>{
 let cases=0;
 for(const theme of ['cars','mermaids'])for(const max of [20,50,100]){
  for(const blue of [0,1,9,10,max-1,max])for(const gold of [0,1,9,10,max-1,max]){
   const a=app(true,`?theme=${theme}&max=${max}&a=${blue}&b=${gold}`);a.check();a.close();cases++;
  }
  const a=app(false,`?theme=${theme}&max=${max}`);a.check();await a.drive('top',10);await a.drive('exit',10);
  for(let i=0;i<max/10;i++)await a.drive('entry',10);
  await a.drive('top',1);await a.drive('exit',1);await a.drive('entry',1);a.close();
  const b=app(true,`?theme=${theme}&max=${max}`);await b.drive('down',10);await b.drive('exit',10);await b.drive('entry',10);b.close();
 }
 console.log(`Play controls passed: ${cases} boundary states, both themes/all capacities, empty/full/source/destination limits, animation and narration visibility, keyboard/pointer removal, roads retained.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
