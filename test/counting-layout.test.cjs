const assert=require('node:assert/strict');
const {layout,unitPosition}=require('./game.js');
let states=0,units=0;
for(let blue=0;blue<=100;blue++)for(let gold=0;gold<=100-blue;gold++){
  const state={blue,gold},g=layout(state);
  let baseline;
  for(const side of ['blue','gold']){
    const seen=new Set(),x=side==='blue'?66:218;
    for(let i=0;i<state[side];i++){
      const p=unitPosition(side,i,state[side],g);
      assert(p.x>x&&p.x<x+136&&p.y>284&&p.y<g.bottom);
      const key=p.x+','+p.y;assert(!seen.has(key));seen.add(key);
      if(i>=Math.floor(state[side]/10)*10){
        if(baseline===undefined)baseline=p.y;else assert.equal(p.y,baseline,'ones must share the same baseline across garages');
      }
      units++;
    }
    assert.equal(seen.size,state[side]);
  }
  states++;
}
const g=layout({blue:100,gold:0});
assert.equal(new Set(Array.from({length:100},(_,i)=>unitPosition('blue',i,100,g).y)).size,10);
console.log(`${states} aligned layouts and ${units} individual unit positions passed, including 100 visible units.`);
