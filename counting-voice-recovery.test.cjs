'use strict';
const assert=require('node:assert/strict');
const {createNarrator}=require('./counting-voice');
const tick=()=>new Promise(setImmediate);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(){
 const starts=[],requests=[],timers=new Map();let id=0,contexts=0,resumes=0;
 class Context{
  constructor(){contexts++;this.state='suspended';this.destination={};}
  resume(){resumes++;this.state='running';return Promise.resolve();}
  decodeAudioData(bytes){return Promise.resolve(bytes);}
  createBufferSource(){return {connect(){},disconnect(){},start(){starts.push(this);},stop(){this.stopped=true;}};}
 }
 const root={AudioContext:Context,fetch:path=>{requests.push(path);return Promise.resolve({ok:true,arrayBuffer:async()=>({path})});},setTimeout:f=>{timers.set(++id,f);return id;},clearTimeout:i=>timers.delete(i)};
 const narrator=createNarrator({root});
 return {root,narrator,starts,requests,timers,counts:()=>({contexts,resumes})};
}
const item={kind:'boy',place:'tens',count:2,text:'two tens',side:'blue'};
(async()=>{
 // A transient offline/decode failure must not poison a clip until refresh.
 const retry=harness();retry.root.fetch=async()=>{throw Error('offline');};await retry.narrator.speakMove({blue:20},'entry',10);
 retry.root.fetch=async path=>({ok:true,arrayBuffer:async()=>({path})});const recovered=retry.narrator.speakMove({blue:20},'entry',10);await tick();
 assert.equal(retry.starts.length,1,'next gesture retries failed recording');retry.starts[0].onended();await recovered;
 // Preload and live playback share a single in-flight request per asset.
 const loading=harness(),fetch=deferred();loading.root.fetch=path=>{loading.requests.push(path);return fetch.promise;};
 loading.narrator.preload();loading.narrator.preload();const moving=loading.narrator.speakMove({blue:20},'entry',10);await tick();
 assert.equal(loading.requests.length,40,'preload/playback deduplicated');fetch.resolve({ok:true,arrayBuffer:async()=>({})});await tick();loading.starts[0].onended();await moving;
 // A timed-out operation cannot begin late after the user retries sound.
 const late=harness(),pending=deferred();late.root.fetch=()=>pending.promise;
 const abandoned=late.narrator.speakMove({blue:20},'entry',10);await tick();[...late.timers.values()][0]();await abandoned;late.narrator.setSound(true);
 pending.resolve({ok:true,arrayBuffer:async()=>({})});await tick();assert.equal(late.starts.length,0,'watchdog completion is terminal');
 // A stop while loading invalidates its token even if sound remains enabled.
 const stop=harness(),held=deferred();stop.root.fetch=()=>held.promise;const stopped=stop.narrator.speakMove({blue:20},'entry',10);await tick();stop.narrator.stop();await stopped;held.resolve({ok:true,arrayBuffer:async()=>({})});await tick();assert.equal(stop.starts.length,0);assert.equal(stop.narrator.isOn(),true);
 // Unlock synchronously in the tap before any animation or Promise boundary.
 const unlock=harness();unlock.narrator.unlock();assert.deepEqual(unlock.counts(),{contexts:1,resumes:1});
 console.log('Counting Voice recovery passed: transient failure retries, in-flight deduplication, terminal watchdog, stop during fetch, synchronous gesture unlock.');
})().catch(e=>{console.error(e);process.exitCode=1;});
