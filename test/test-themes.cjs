const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync(__dirname+'/game.js','utf8');
let cases=0;
for(const theme of ['cars','mermaids']) for(let limit=10;limit<=100;limit++) {
 const context={URLSearchParams,location:{search:`?theme=${theme}&max=${limit}`},module:{exports:{}}};
 vm.runInNewContext(source,context);
 const {LIMIT,move,canMove}=context.module.exports; assert.equal(LIMIT,limit);
 for(let blue=0;blue<=limit;blue++) for(let gold=0;gold<=limit-blue;gold++) for(const kind of ['entry','exit','top','bottom']) for(const n of [1,5,10]){
  const state={blue,gold}, allowed=kind==='entry'?blue+gold+n<=limit:kind==='top'?blue>=n:gold>=n;
  assert.equal(canMove(state,kind,n),allowed);
  const next=move(state,kind,n);
  assert.equal(next.blue,blue+(allowed?(kind==='entry'||kind==='bottom'?n:kind==='top'?-n:0):0));
  assert.equal(next.gold,gold+(allowed?(kind==='top'?n:kind==='bottom'||kind==='exit'?-n:0):0));
  assert(next.blue>=0&&next.gold>=0&&next.blue+next.gold<=limit); cases++;
 }
}
for(const query of ['','?max=','?max=no','?max=9','?max=101','?max=20.5','?max=-20','?max=Infinity']){
 const c={URLSearchParams,location:{search:query},module:{exports:{}}};vm.runInNewContext(source,c);assert.equal(c.module.exports.LIMIT,20);
}
console.log(`${cases} movement cases passed across both themes and every supported maximum (10–100); invalid defaults passed.`);
