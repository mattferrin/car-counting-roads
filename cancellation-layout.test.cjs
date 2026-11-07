const assert = require('node:assert/strict');
const E = require('./cancellation-engine');
const L = require('./cancellation-layout');
let states = 0;
for (let a = 0; a <= 100; a++) for (let b = 0; b <= a; b++) {
  const solution = E.solve(a,b);
  let previous;
  solution.states.forEach((state, i) => {
    const p = L.plan(solution,i);
    for (const side of ['left','right']) {
      assert.equal(p[side].length,state[side]);
      assert.equal(new Set(p[side].map(o=>`${o.x},${o.y}`)).size,state[side]);
      assert(p[side].every(o=>o.x>=0 && o.x<10 && o.y>=0));
      if(previous) {
        const amount=solution.moves[i-1];
        const survivors=amount===1?previous[side].slice(0,-1):previous[side].slice(amount);
        assert.deepEqual(p[side].map(o=>o.id),survivors.map(o=>o.id));
      }
    }
    assert.equal(p.left.length-p.right.length,a-b);
    if(state.right<10) {
      const matches=p.left.slice(-state.right || p.left.length);
      assert.deepEqual(p.right.map(o=>[o.x,o.y]),matches.map(o=>[o.x,o.y]));
    }
    previous=p; states++;
  });
}
for(const [a,b] of [[78,35],[59,25],[42,17],[999,998],[999,999],[999,0]]) {
 const s=E.solve(a,b);
 s.states.forEach((st,i)=>{const p=L.plan(s,i);assert.equal(p.left.length,st.left);assert.equal(p.right.length,st.right)});
}
const s=E.solve(78,35), before=L.plan(s,3,true), after=L.plan(s,3);
assert(before.right.every(o=>o.y===0)); assert(after.right.every(o=>o.y===4));
assert.deepEqual(after.left.slice(-8).map(o=>o.x),[0,1,2,3,4,5,6,7]);
for(let i=4;i<=8;i++)assert.deepEqual(L.plan(s,i).left.slice(40,43).map(o=>[o.x,o.y]),[[0,4],[1,4],[2,4]]);
console.log(`Layout: ${states} states verified; counts, identity, alignment, regrouping and 999 edge cases passed.`);
