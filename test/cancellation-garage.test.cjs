'use strict';
const assert=require('node:assert/strict'),E=require('./cancellation-garage-engine.js');
let moves=0,layouts=0;
for(const max of [20,50,100])for(let blue=0;blue<=max;blue++)for(let gold=0;gold<=max;gold++){
  const s={blue,gold,max},original=JSON.stringify(s),g=E.geometry(max),matched=Math.min(blue,gold);
  for(const kind of ['entry','exit','up','down'])for(const n of [1,10]){
    const next=E.move(s,kind,n),legal=kind==='entry'?blue+n<=max:kind==='exit'?gold>=n:kind==='up'?gold>=n&&blue+n<=max:blue>=n&&gold+n<=max;
    assert.equal(E.canMove(s,kind,n),legal);assert.ok(E.valid(next));
    if(!legal)assert.equal(next,s);
    else{
      const d=next.blue-next.gold-(blue-gold);
      assert.equal(d,kind==='entry'||kind==='exit'?n:kind==='up'?2*n:-2*n);
      if(['up','down'].includes(kind))assert.equal(next.blue+next.gold,blue+gold);
    }
    assert.equal(JSON.stringify(s),original);moves++;
  }
  for(const side of ['blue','gold']){
    const positions=[];
    for(let i=0;i<s[side];i++){
      const p=E.position(s,side,i);assert.equal(p.paired,i<matched);assert.ok(p.x>=116&&p.x<=364);
      assert.ok(side==='blue'?p.y>g.top+45&&p.y<g.center-8:p.y>g.center+8&&p.y<g.bottom-43);
      for(const q of positions)assert.ok(Math.abs(p.x-q.x)>=20||Math.abs(p.y-q.y)>=18,`${JSON.stringify(s)} ${side}: overlapping objects`);
      positions.push(p);
      if(i<matched){const mirror=E.position(s,side==='blue'?'gold':'blue',i);assert.equal(p.x,mirror.x);assert.equal(p.y+mirror.y,2*g.center);}
      layouts++;
    }
  }
}
for(const bad of [null,'',0,-1,21,999,'20.5','20x','Infinity'])assert.equal(E.capacity(bad),20);
for(const bad of [0,5,NaN,-1,Infinity,1.5])assert.equal(E.canMove({blue:10,gold:10,max:20},'entry',bad),false);
// Every subtraction example must be reachable through the actual one-unit roads.
for(const max of [20,50,100])for(let a=0;a<=max;a++)for(let b=0;b<=max;b++){
 let s={blue:0,gold:0,max};
 for(let i=0;i<b;i++){s=E.move(s,'entry',1);s=E.move(s,'down',1);}
 for(let i=0;i<a;i++)s=E.move(s,'entry',1);
 assert.deepEqual(s,{blue:a,gold:b,max});
}
console.log(`${moves} movement cases and ${layouts} individual positions passed; all subtraction examples reachable; mirror alignment, no overlap, signed transitions, bounds, conservation, and immutability passed.`);
