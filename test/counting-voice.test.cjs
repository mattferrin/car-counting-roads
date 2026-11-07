const assert=require('node:assert/strict');
const {planMove, createNarrator}=require('./counting-voice.js');
let plans=0;
for(let blue=0;blue<=100;blue++)for(let gold=0;gold<=100-blue;gold++)for(const kind of ['entry', 'exit', 'top', 'bottom'])for(const amount of [1, 10]){
  const result=planMove({blue, gold}, kind, amount), sides=kind==='entry'?['blue']:kind==='exit'?['gold']:['blue', 'gold'];
  assert.deepEqual(result.map(p=>p.side), sides);
  result.forEach(p=>{
    assert.equal(p.kind, p.side==='blue'?'boy':'girl');
    assert.equal(p.count, amount===10?Math.floor(({blue, gold})[p.side]/10):({blue, gold})[p.side]%10);
    assert.equal(p.place, amount===10?'tens':'ones');
  });plans++;
}
assert.equal(planMove({blue:20, gold:0}, 'entry', 10)[0].text, 'two tens');
assert.equal(planMove({blue:0, gold:9}, 'exit', 10)[0].text, 'zero tens');
assert.deepEqual(planMove({blue:9, gold:10}, 'top', 1).map(p=>p.text), ['nine ones', 'zero ones']);
assert.equal(planMove({blue:100, gold:0}, 'entry', 10)[0].text, 'ten tens');
assert.equal(planMove({blue:100, gold:0}, 'entry', 1)[0].text, 'zero ones');
assert.deepEqual(planMove({blue:10, gold:0}, 'entry', 5), []);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
  const starts=[], events=[], timers=new Map(), utterances=[];let timerId=0;
  class Context{
    constructor(){this.state='running';this.destination={};}
    resume(){this.state='running';return Promise.resolve();}
    decodeAudioData(bytes){return Promise.resolve({file:bytes.file});}
    createBufferSource(){return {buffer:null, connect(){}, disconnect(){}, stop(){this.stopped=true;}, start(){starts.push(this);}};}
  }
  const root={AudioContext:Context, document:{hidden:false}, localStorage:{getItem(){return null;}, setItem(){}}, fetch:async file=>({ok:true, arrayBuffer:async ()=>({file})}), setTimeout(fn){timers.set(++timerId, fn);return timerId;}, clearTimeout(id){timers.delete(id);}, SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}, speechSynthesis:{getVoices:()=>[{name:'David', lang:'en-US'}, {name:'Samantha', lang:'en-US'}], speak:u=>utterances.push(u), cancel(){}}};
  const narrator=createNarrator({root, highlight:p=>events.push({type:'start', ...p}), clear:()=>events.push({type:'clear'}), onSoundChange:(on, retry)=>events.push({type:'sound', on, retry})});
  return {root, narrator, starts, events, timers, utterances};
}
(async()=>{
  // Each side waits for the previous source's actual end event.
  const h=harness();const pending=h.narrator.speakMove({blue:0, gold:10}, 'top', 10);await flush();
  assert.equal(h.starts.length, 1);assert.equal(h.starts[0].buffer.file, 'audio/boy/tens-0.mp3');
  assert.equal(h.events.filter(e=>e.type==='start').at(-1).side, 'blue');
  h.starts[0].onended();await flush();
  assert.equal(h.starts.length, 2);assert.equal(h.starts[1].buffer.file, 'audio/girl/tens-1.mp3');
  assert.equal(h.events.filter(e=>e.type==='start').at(-1).side, 'gold');
  h.starts[1].onended();await pending;assert.equal(h.events.at(-1).type, 'clear');
  // Mute interrupts a clip, clears the highlight, and prevents the second voice.
  const m=harness();const muted=m.narrator.speakMove({blue:9, gold:1}, 'top', 1);await flush();
  m.narrator.setSound(false);await muted;await flush();
  assert.equal(m.starts.length, 1);assert.equal(m.starts[0].stopped, true);assert.equal(m.narrator.isOn(), false);assert.equal(m.events.at(-1).type, 'clear');
  // An explicit stop, including visibility changes, releases playback without muting the preference.
  const s=harness();const stopped=s.narrator.speakMove({blue:19, gold:1}, 'bottom', 1);await flush();s.root.document.hidden=true;s.narrator.stop();await stopped;
  assert.equal(s.starts.length, 1);assert.equal(s.narrator.isOn(), true);assert.equal(s.starts[0].stopped, true);
  // Speech fallback highlights only on real speech events, including the 100-unit edge.
  const f=harness();const fallback=f.narrator.speakMove({blue:100, gold:0}, 'entry', 10);await flush();
  assert.equal(f.utterances.length, 1);assert.equal(f.utterances[0].text, 'ten tens');assert.equal(f.utterances[0].voice.name, 'David');
  assert.equal(f.events.some(e=>e.type==='start'), false);f.utterances[0].onstart();
  assert.equal(f.events.at(-1).count, 10);f.utterances[0].onend();await fallback;assert.equal(f.events.at(-1).type, 'clear');
  // A stuck source is stopped before the interaction lock can be released.
  const w=harness();const recovery=w.narrator.speakMove({blue:20, gold:0}, 'entry', 10);await flush();
  [...w.timers.values()][0]();await recovery;
  assert.equal(w.starts[0].stopped, true);assert.equal(w.narrator.isOn(), false);assert(w.events.some(e=>e.type==='sound'&&e.retry));
  console.log(`[${plans}] narration plans passed; source end events, separate voice assets, mute, visibility, speech fallback, and failure recovery passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
