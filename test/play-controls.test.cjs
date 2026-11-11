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
  const blue=Number(d.querySelector('#left').textContent),gold=Number(d.querySelector('#right').textContent),max=Number(new URL(w.location).searchParams.get('max')),th=new URL(w.location).searchParams.get('theme')||'cars';
  for(const c of controls()){
   const kind=c.dataset.kind,n=Number(c.dataset.amount);
   const valid=kind==='entry'?(sub?blue+n<=max:blue+gold+n<=max):(kind==='exit'?gold>=n:(kind==='top'||kind==='down')?blue>=n&&(!sub||gold+n<=max):gold>=n&&(!sub||blue+n<=max));
   const visual=sub?c:c.querySelector('.route-sign'),hit=sub?d.querySelectorAll('.garage-road-hit')[Number(c.dataset.route)]:c.querySelector('.road-hit');
   assert.equal(c.getAttribute('aria-hidden'),String(!valid));assert.equal(c.getAttribute('tabindex'),valid?'0':'-1');
   assert.equal(visual.style.display,valid?'':'none');assert.equal(hit.style.display,valid?'':'none');
   assert.equal(hit.style.pointerEvents,valid?'':'none');
  }
  assert.equal(d.querySelectorAll(sub?'.garage-road':'.road').length,8,'all useful roads retained');
  for(const road of d.querySelectorAll(sub?'.garage-road,.garage-edge,.garage-road-next,.garage-edge-next':'.road,.edge,.road-next,.edge-next'))assert.equal(road.getAttribute('pointer-events'),'none');
  // Every theme-dependent surface carries its incoming twin, hidden, so
  // a drag can wipe it in from the finger's side.
  assert.equal(d.querySelector('#world-line').dataset.next,(th==='cars'?"Aliya's Mermaid World":"Ayan's Car World")+(sub?' · Subtraction Play':' · Addition Play'));
  if(sub){
   assert.equal(d.querySelectorAll('.garage-road-next').length,8,'twin garage roads ride along');
   assert.equal(d.querySelectorAll('.garage-edge-next').length,8);
   assert.equal(d.querySelectorAll('.route-plate-next').length,8);
   assert.equal(d.querySelectorAll('.garage-shell-next').length,2);
   assert.deepEqual([...d.querySelectorAll('.garage-road-next')].map(p=>p.getAttribute('d')),[...d.querySelectorAll('.garage-road')].map(p=>p.getAttribute('d')));
   assert.deepEqual([...d.querySelectorAll('.garage-edge-next')].map(p=>p.getAttribute('d')),[...d.querySelectorAll('.garage-edge')].map(p=>p.getAttribute('d')));
   for(const u of d.querySelectorAll('.garage-unit')){
    const side=u.classList.contains('gold')?'gold':'blue';
    assert.equal(u.querySelector('.unit-next use').getAttribute('href'),'#'+(th==='cars'?'mermaid-'+(side==='blue'?'teal':'pink'):'car-'+side));
    assert.equal(u.querySelector('svg:not(.unit-next) use').getAttribute('href'),'#'+(th==='cars'?'car-'+side:'mermaid-'+(side==='blue'?'teal':'pink')));
   }
  }else{
   assert.equal(d.querySelectorAll('.road-next').length,8,'twin roads ride along');
   assert.equal(d.querySelectorAll('.edge-next').length,8);
   assert.equal(d.querySelectorAll('.route-plate-next').length,8);
   assert.equal(d.querySelectorAll('.garage-shell-next').length,2);
   assert.equal(d.querySelector('.garage-shell-next.blue').getAttribute('fill'),'url(#'+(th==='cars'?'pool-left':'garage-left')+')');
   assert.equal(d.querySelectorAll('.count-band-next').length,d.querySelectorAll('.count-band').length);
   assert.equal(d.querySelectorAll('.ones-band-next').length,d.querySelectorAll('.ones-band').length);
   assert.equal(d.querySelectorAll('.garage-drive-next').length,th==='cars'?0:2);
   assert.equal(d.querySelectorAll('.pool-sand-next').length,th==='cars'?2:0);
   for(const r of controls()){
    assert.equal(r.querySelector('.road-next').getAttribute('d'),r.querySelector('.road').getAttribute('d'));
    assert.equal(r.querySelector('.edge-next').getAttribute('d'),r.querySelector('.edge').getAttribute('d'));
   }
   const garages=[...d.querySelectorAll('#garages > g')];
   for(const u of d.querySelectorAll('.parked-unit')){
    const side=garages.indexOf(u.parentElement)===0?'blue':'gold';
    assert.equal(u.querySelector('.svg-next use').getAttribute('href'),'#'+(th==='cars'?'mermaid-'+(side==='blue'?'teal':'pink'):'car-'+(side==='blue'?'blue':'gold')));
    assert.equal(u.querySelector('svg:not(.svg-next) use').getAttribute('href'),'#'+(th==='cars'?'car-'+(side==='blue'?'blue':'gold'):'mermaid-'+(side==='blue'?'teal':'pink')));
   }
  }
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
