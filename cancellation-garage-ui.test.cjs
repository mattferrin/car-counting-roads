'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const at=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
function app(query=''){
 const dom=new JSDOM(at('cancellation-garage.html'),{url:'https://example.test/test/cancellation-garage.html'+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let clock=0;w.requestAnimationFrame=cb=>{queueMicrotask(()=>cb(clock+=100));return clock;};
 w.SVGElement.prototype.getTotalLength=()=>300;w.SVGElement.prototype.getPointAtLength=l=>({x:30+l,y:130});
 w.matchMedia=()=>({matches:false});
 // Silence is structural, independent of preferences and browser audio support.
 w.AudioContext=function(){throw Error('Audio must never initialize');};
 w.speechSynthesis={speak(){throw Error('Speech must never initialize');}};
 const errors=[];w.addEventListener('error',e=>errors.push(e.error));
 for(const f of ['play-controls.js','play-capacity.js','theme-switch.js','cancellation-garage-engine.js','cancellation-garage.js'])w.eval(at(f));
 return {w,d:w.document,errors,close:()=>w.close(),snapshot:()=>w.CancellationGarageView.snapshot()};
}
const tick=()=>new Promise(r=>setImmediate(r));
async function idle(a){for(let i=0;i<25&&a.snapshot().busy;i++)await tick();assert.equal(a.snapshot().busy,false);assert.deepEqual(a.errors,[]);}
function check(a,blue,gold){const s=a.snapshot();assert.equal(s.blue,blue);assert.equal(s.gold,gold);assert.equal(s.difference,blue-gold);assert.equal(a.d.querySelectorAll('.garage-unit').length,blue+gold);assert.equal(a.d.querySelectorAll('.garage-unit.paired').length,2*Math.min(blue,gold));assert.equal(a.d.querySelector('#total').textContent,blue<gold?'−'+(gold-blue):String(blue-gold));}
async function drive(a,kind,n){a.d.querySelector(`[data-kind="${kind}"][data-amount="${n}"]`).dispatchEvent(new a.w.MouseEvent('click',{bubbles:true}));await idle(a);}
// Sample the actual rendered rounded-road paths; crossings are the visual defect.
function samplePath(d){
 const tokens=d.match(/[MHVQ]|-?\d+(?:\.\d+)?/g);let i=0,p={x:0,y:0},points=[];
 const num=()=>Number(tokens[i++]);
 while(i<tokens.length){const cmd=tokens[i++];let end,control;
  if(cmd==='M'){p={x:num(),y:num()};points.push(p);continue;}
  if(cmd==='H')end={x:num(),y:p.y};
  else if(cmd==='V')end={x:p.x,y:num()};
  else if(cmd==='Q'){control={x:num(),y:num()};end={x:num(),y:num()};}
  else throw Error('Unexpected road command '+cmd);
  const start=p;
  for(let j=1;j<=16;j++){const t=j/16,u=1-t;points.push(control?{x:u*u*start.x+2*u*t*control.x+t*t*end.x,y:u*u*start.y+2*u*t*control.y+t*t*end.y}:{x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t});}
  p=end;
 }return points;
}
function roadCrossings(paths){const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);const hits=[];
 for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){let hit=false;
  for(let a=1;a<paths[i].length&&!hit;a++)for(let b=1;b<paths[j].length;b++){
   const A=paths[i][a-1],B=paths[i][a],C=paths[j][b-1],D=paths[j][b];
   if(cross(A,B,C)*cross(A,B,D)<-.0001&&cross(C,D,A)*cross(C,D,B)<-.0001){hit=true;break;}
  }if(hit)hits.push([i,j]);
 }return hits;
}
(async()=>{
 for(const max of [20,50,100]){const layout=app('?max='+max);
  const paths=Array.from(layout.d.querySelectorAll('.garage-road')).map(p=>samplePath(p.getAttribute('d')));
  assert.deepEqual(roadCrossings(paths),[],'no road crossings at '+max);
  const plates=Array.from(layout.d.querySelectorAll('.garage-route')).map(b=>{
   const xy=b.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/);return {x:Number(xy[1]),y:Number(xy[2])};
  });
  for(let road=0;road<paths.length;road++)for(let button=0;button<plates.length;button++){
   if(road===button)continue;
   const c=plates[button];
   assert.ok(!paths[road].some(p=>Math.abs(p.x-c.x)<40&&Math.abs(p.y-c.y)<40),`road ${road} crowds unrelated button ${button} at ${max}`);
  }

  const buttons=Array.from(layout.d.querySelectorAll('.route-target'));
  const centers=buttons.map(b=>Number(b.parentNode.getAttribute('transform').match(/translate\((\d+)/)[1]));
  assert.equal(centers[0],centers[6],'+10 and −10 share the left column');
  assert.equal(centers[1],centers[7],'+1 and −1 share the right column');
  assert.ok(centers[0]<centers[1]);layout.close();
 }
 const a=app();assert.equal(a.d.title,'Subtraction Play — Counting Worlds');assert.equal(a.d.querySelectorAll('.garage-route').length,8);check(a,10,0);
 for(const selector of ['#sound-toggle','script[src*="voice"]','#capacity','#clear','.test-banner','.garage-help','.garage-intro'])assert.equal(a.d.querySelector(selector),null,selector+' removed');
 for(const button of a.d.querySelectorAll('.garage-route')){
  assert.equal(button.querySelectorAll('.route-unit').length,Number(button.dataset.amount),'one real character per unit on each button');
  assert.equal(button.querySelector('image'),null,'landmark images removed');
  assert.equal(button.querySelector('.route-target').getAttribute('width'),'68');
 }
 const first=a.d.querySelector('.garage-unit');
 for(const [kind,n,b,g]of [['entry',10,20,0],['down',10,10,10],['up',1,11,9],['down',1,10,10],['exit',10,10,0],['entry',1,11,0],['down',10,1,10],['exit',1,1,9]]){await drive(a,kind,n);check(a,b,g);}
 assert.ok(first.isConnected);await drive(a,'up',10);check(a,1,9);a.close();
 const b=app('?a=3&b=7');await drive(b,'up',1);check(b,4,6);await drive(b,'up',1);check(b,5,5);await drive(b,'up',1);check(b,6,4);
 const saved=Array.from(b.d.querySelectorAll('.garage-unit')).map(n=>n.dataset.id).join();b.d.querySelector('[data-theme="mermaids"]').click();check(b,6,4);assert.equal(b.snapshot().theme,'mermaids');assert.equal(Array.from(b.d.querySelectorAll('.garage-unit')).map(n=>n.dataset.id).join(),saved);assert.ok(b.d.querySelector('.route-unit use').getAttribute('href').includes('mermaid'));b.close();
 const c=app('?max=100&a=100&b=100');check(c,100,100);await drive(c,'entry',1);check(c,100,100);const tall=c.d.querySelector('#garage-map').getAttribute('viewBox');
 c.d.querySelector('[data-max="20"]').click();assert.equal(c.snapshot().busy,true);assert.equal(c.d.querySelectorAll('.capacity-burning').length,160);
 assert.equal(c.d.querySelector('[data-max="100"]').disabled,true);await new Promise(r=>setTimeout(r,750));await idle(c);check(c,20,20);assert.equal(c.snapshot().max,20);assert.notEqual(c.d.querySelector('#garage-map').getAttribute('viewBox'),tall);c.close();
 const duplicate=app();duplicate.d.querySelector('[data-kind="entry"][data-amount="10"]').dispatchEvent(new duplicate.w.MouseEvent('click'));duplicate.d.querySelector('[data-kind="entry"][data-amount="1"]').dispatchEvent(new duplicate.w.MouseEvent('click'));await idle(duplicate);check(duplicate,20,0);duplicate.close();
 // Both free-play chooser cards select their capacity independently.
 const home=new JSDOM(at('index.html'),{url:'https://example.test/test/index.html',runScripts:'outside-only'});home.window.eval(at('play-capacity.js'));home.window.eval(at('theme-switch.js'));home.window.eval(at('game.js'));
 const d=home.window.document,cards=Array.from(d.querySelectorAll('.choose-game'));
 assert.deepEqual(cards.map(c=>c.querySelector('h2').textContent),['Addition Quest','Addition Play','Subtraction Quest','Subtraction Play']);
 assert.equal(d.querySelector('.test-banner'),null);
 const addition=cards[1],subtraction=cards[3];subtraction.querySelector('[data-max="100"]').click();
 for(const link of subtraction.querySelectorAll('.choose-world'))assert.ok(link.href.endsWith('max=100'));
 for(const link of addition.querySelectorAll('.choose-world'))assert.ok(link.href.endsWith('max=20'));
 addition.querySelector('[data-max="50"]').click();
 for(const link of addition.querySelectorAll('.choose-world'))assert.ok(link.href.endsWith('max=50'));
 for(const link of subtraction.querySelectorAll('.choose-world'))assert.ok(link.href.endsWith('max=100'));
 home.window.close();
 console.log('Silent Play UI passed: eight one/ten character buttons, no audio dependency, noncrossing nested roads, aligned columns, duplicate taps, 200 objects, signed transitions, identities, themes, chooser naming and independent 20/50/100 selections.');
})().catch(e=>{console.error(e);process.exitCode=1;});
