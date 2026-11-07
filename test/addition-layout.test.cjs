/* Addition Quest — layout tests.
 * Run:  node addition-layout.test.cjs
 * Exhaustive over every a, b in 0..100 and every state: counts, unique
 * slots, identity continuity (survivors keep ids, moved ids change
 * sides, nothing is duplicated or lost), plus the named behaviours:
 * ten-insertion shifts the destination's ones down a row, one-move
 * regrouping 69 -> 70 forms a new ten row, and the source's top row is
 * what leaves on a ten-move.
 */
'use strict';
const assert = require('node:assert/strict');
const E = require('./addition-engine');
const L = require('./addition-layout');

let states = 0;
for (let a = 0; a <= 100; a++) for (let b = 0; b <= 100; b++) {
  const solution = E.solve(a, b);
  let previous = null;
  solution.states.forEach((state, i) => {
    const p = L.plan(solution, i);
    const allIds = p.left.map(o => o.id).concat(p.right.map(o => o.id));
    for (const side of ['left', 'right']) {
      assert.equal(p[side].length, state[side], `count ${side} at step ${i} of ${a}+${b}`);
      assert.equal(new Set(p[side].map(o => `${o.x},${o.y}`)).size, state[side], `unique slots ${side} at step ${i} of ${a}+${b}`);
      assert(p[side].every(o => o.x >= 0 && o.x < 10 && o.y >= 0), `slots in grid ${side} at step ${i} of ${a}+${b}`);
      // Canonical grid: complete tens rows on top, ones row at the bottom.
      const tenCount = Math.floor(state[side] / 10) * 10;
      p[side].forEach((o, j) => {
        if (j < tenCount) assert.deepEqual([o.x, o.y], [j % 10, Math.floor(j / 10)], `tens slot ${side} at step ${i} of ${a}+${b}`);
        else assert.deepEqual([o.x, o.y], [j - tenCount, tenCount / 10], `ones slot ${side} at step ${i} of ${a}+${b}`);
      });
    }
    // Conservation of identity: every original id appears exactly once.
    assert.equal(new Set(allIds).size, a + b, `no duplicated ids at step ${i} of ${a}+${b}`);
    assert.equal(Math.min(...allIds, 0), 0, `ids start at 0 at step ${i} of ${a}+${b}`);
    assert.equal(Math.max(...allIds, -1), a + b - 1, `ids end at ${a + b - 1} at step ${i} of ${a}+${b}`);
    assert.equal(p.left.length + p.right.length, a + b, `total objects conserved at step ${i} of ${a}+${b}`);
    if (previous) {
      const amount = solution.moves[i - 1];
      const moved = L.movingIds(solution, i - 1);
      assert.equal(moved.length, amount, `moving count at step ${i} of ${a}+${b}`);
      const src = solution.sourceSide, dst = solution.destSide;
      const prevSrcIds = previous[src].map(o => o.id);
      const prevDstIds = previous[dst].map(o => o.id);
      const nextSrcIds = p[src].map(o => o.id);
      const nextDstIds = p[dst].map(o => o.id);
      assert.deepEqual(nextSrcIds, prevSrcIds.filter(id => !moved.includes(id)), `source loses exactly the moved ids at step ${i} of ${a}+${b}`);
      assert(nextDstIds.length === prevDstIds.length + moved.length, `dest gains the moved ids at step ${i} of ${a}+${b}`);
      moved.forEach(id => assert(nextDstIds.includes(id), `moved id ${id} is in dest at step ${i} of ${a}+${b}`));
      if (amount === 10) {
        assert.deepEqual(moved, prevSrcIds.slice(0, 10), `ten-move takes the source top row at step ${i} of ${a}+${b}`);
        // The moved row lands just before the dest ones row.
        const dstOnesBefore = prevDstIds.length % 10;
        const at = prevDstIds.length - dstOnesBefore;
        assert.deepEqual(nextDstIds.slice(at, at + 10), moved, `ten inserts before dest ones at step ${i} of ${a}+${b}`);
      } else {
        assert.deepEqual(moved, prevSrcIds.slice(-1), `one-move takes the source last object at step ${i} of ${a}+${b}`);
        assert.equal(nextDstIds[nextDstIds.length - 1], moved[0], `one-move appends to dest ones at step ${i} of ${a}+${b}`);
      }
    }
    previous = p; states++;
  });
}

// --- Named behaviours -------------------------------------------------------
// 47+26: the first ten-move shifts the large side's ones down a row.
{
  const s = E.solve(47, 26);
  const before = L.plan(s, 0), after = L.plan(s, 1);
  assert.deepEqual(before.left.slice(40).map(o => [o.x, o.y]),
    [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4]]);
  assert.deepEqual(after.left.slice(50).map(o => [o.x, o.y]),
    [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]]);
  assert.deepEqual(L.movingIds(s, 0), [47, 48, 49, 50, 51, 52, 53, 54, 55, 56]);
  assert.deepEqual(L.movingIds(s, 2), [72]);
  assert.deepEqual(L.plan(s, 8).right, []);
  assert.equal(L.plan(s, 8).left.length, 73);
}
// 69+4 regroup: the fourth one-move completes a new ten row (69 -> 70).
{
  const s = E.solve(69, 4);
  const at69 = L.plan(s, 0);
  assert.equal(at69.left.filter(o => o.y === 6).length, 9);
  const at70 = L.plan(s, 1);
  assert.equal(at70.left.length, 70);
  assert.equal(at70.left.filter(o => o.y === 6).length, 10);
  assert.equal(at70.left.filter(o => o.y === 7).length, 0);
  assert.equal(L.plan(s, 4).left.length, 73);
}
// 4+69 regroup in the other direction: the destination is the right pool.
{
  const s = E.solve(4, 69);
  assert.equal(s.destSide, 'right');
  const at70 = L.plan(s, 1);
  assert.equal(at70.right.length, 70);
  assert.equal(at70.right.filter(o => o.y === 6).length, 10);
  assert.deepEqual(L.movingIds(s, 0), [3]);
}
// 26+47: source is the left pool; its top row leaves, right pool grows.
{
  const s = E.solve(26, 47);
  assert.deepEqual(L.movingIds(s, 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const after = L.plan(s, 1);
  assert.equal(after.left.length, 16);
  assert.equal(after.right.length, 57);
  assert.deepEqual(after.right.slice(50).map(o => [o.x, o.y]),
    [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]]);
}
// Equal case: 30+30, source is the right pool.
{
  const s = E.solve(30, 30);
  assert.deepEqual(L.movingIds(s, 0), [30, 31, 32, 33, 34, 35, 36, 37, 38, 39]);
  assert.equal(L.plan(s, 3).left.length, 60);
  assert.equal(L.plan(s, 3).right.length, 0);
}
// Invalid identities throw.
{
  const bad = E.solve(5, 5);
  bad.states[1] = { left: 99, right: -89, moved: 10 };
  assert.throws(() => L.plan(bad, 1), /Invalid surviving identity/);
  assert.throws(() => L.plan(bad, 99), /Invalid surviving identity/);
  assert.equal(L.movingIds(bad, 99).length, 0);
}

console.log(`Layout: ${states} states verified; counts, identity, alignment, ten-insertion, regrouping and both directions passed.`);
