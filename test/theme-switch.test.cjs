'use strict';
/* Shared theme switch: tap, keyboard, and finger-drag across cars/mermaids.
 * Run:  NODE_PATH=~/workspace/cancellation-quest/node_modules node theme-switch.test.cjs
 * Covers the Addition Play page: tap switches the world and URL, arrow
 * keys move the highlight, a drag previews the landing side (tint follows
 * the finger) without changing the theme until release, a click
 * synthesized after a drag cannot undo it, and a cancelled drag leaves
 * the theme alone. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const dom=new JSDOM(read('index.html'),{url:'https://example.test/test/index.html?theme=cars&max=20',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 let clock=0;w.requestAnimationFrame=cb=>{queueMicrotask(()=>cb(clock+=100));return clock;};
 w.matchMedia=()=>({matches:true});w.CountingVoice={createNarrator:()=>({isOn:()=>false,preload(){},stop(){},speakMove(){return Promise.resolve();}})};
 w.eval(read('play-controls.js'));w.eval(read('play-capacity.js'));w.eval(read('theme-switch.js'));w.eval(read('game.js'));
 await tick();
 const sw=d.querySelector('.theme-switch');
 const cars=d.querySelector('.theme-pill[data-theme="cars"]'),mermaids=d.querySelector('.theme-pill[data-theme="mermaids"]');
 const step=()=>sw.style.getPropertyValue('--theme-step');
 const preview=()=>sw.style.getPropertyValue('--theme-preview');
 const theme=()=>new URL(w.location).searchParams.get('theme');
 assert.ok(d.querySelector('.theme-highlight'),'a sliding highlight sits behind the pills');
 assert.equal(step(),'0');assert.equal(sw.dataset.preview,'cars');
 assert.equal(cars.getAttribute('aria-pressed'),'true');assert.equal(mermaids.getAttribute('aria-pressed'),'false');
 assert.equal(d.body.dataset.theme,'cars');
 mermaids.click();await tick();
 assert.equal(theme(),'mermaids');assert.equal(step(),'1');assert.equal(sw.dataset.preview,'mermaids');
 assert.equal(d.body.dataset.theme,'mermaids');assert.equal(d.querySelector('#world-line').textContent,"Aliya's Mermaid World · Addition Play");
 assert.equal(mermaids.getAttribute('aria-pressed'),'true');assert.equal(cars.getAttribute('aria-pressed'),'false');
 sw.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await tick();
 assert.equal(theme(),'cars');assert.equal(step(),'0');
 sw.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));await tick();
 assert.equal(theme(),'mermaids');assert.equal(step(),'1');
 // Drag back to cars with a finger: preview follows, theme waits for release.
 sw.getBoundingClientRect=()=>({left:0,width:210});
 const start=d.querySelector('.theme-pill[data-theme="mermaids"]');
 let captured;start.setPointerCapture=id=>{captured=id;};
 const pointer=(type,x,target)=>{const e=new w.Event(type,{bubbles:true});Object.assign(e,{button:0,pointerId:1,clientX:x,pointerType:'touch'});(target||start).dispatchEvent(e);};
 pointer('pointerdown',190);assert.equal(captured,1);
 pointer('pointermove',60);assert.equal(preview(),String(60/210*2-.5));assert.equal(sw.dataset.preview,'cars');
 assert.equal(theme(),'mermaids','drag preview leaves the theme unchanged');
 pointer('pointermove',30);assert.equal(preview(),'0');
 pointer('pointerup',30);await tick();
 assert.equal(theme(),'cars');assert.equal(step(),'0');assert.equal(preview(),'');
 assert.equal(d.querySelector('#world-line').textContent,"Ayan's Car World · Addition Play");
 start.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));
 assert.equal(theme(),'cars','a click synthesized on the pressed button cannot undo the drag');
 pointer('pointerdown',20);pointer('pointermove',180);pointer('pointercancel',180);
 assert.equal(preview(),'');assert.equal(step(),'0');assert.equal(theme(),'cars');
 cars.click();await tick();
 assert.equal(theme(),'cars','tapping the current side is a no-op');
 mermaids.click();await tick();
 assert.equal(theme(),'mermaids','tapping still works after a cancelled drag');
 // View Transition: the page cross-fades in the toggle's direction, and
 // the marker clears once the transition finishes.
 let vtCalls=[];
 d.startViewTransition=cb=>{vtCalls.push(d.documentElement.dataset.themeTransition);cb();return {finished:Promise.resolve()};};
 w.matchMedia=()=>({matches:false});
 cars.click();await tick();
 assert.equal(vtCalls[0],'to-cars');assert.equal(theme(),'cars');
 assert.equal(d.documentElement.getAttribute('data-theme-transition'),null);
 mermaids.click();await tick();
 assert.equal(vtCalls[1],'to-mermaids');assert.equal(theme(),'mermaids');
 assert.equal(d.documentElement.getAttribute('data-theme-transition'),null);
 dom.window.close();
 console.log('Shared theme switch passed: tap, keyboard, and finger-drag switch cars/mermaids with a following highlight; drag previews without committing; cancelled drags and post-drag clicks cannot undo the choice.');
})().catch(e=>{console.error(e);process.exitCode=1;});
