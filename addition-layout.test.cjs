/* Addition Quest — layout tests.
 * Run:  node addition-layout.test.cjs
 * Exhaustive over every a, b in 0..100 and every state: counts, unique
 * slots, identity continuity (survivors keep ids, moved ids change
 * sides, nothing is duplicated or lost), plus the named behaviours:
 *  - the grid has a fixed R = floor(total/10)+1 rows, and the ones row
 *    is bottom-anchored at y = R-1 in BOTH pools at every state, so a
 *    one-move starts and ends on the same bottom row;
 *  - a ten-move inserts the moved row at the START of the destination's
 *    list, so it lands at y = 0 (the top) and the rows below slide down
 *    one row to make room, while the destination's ones stay put;
 *  - one-move regrouping 69 -> 70 completes a new ten row just above
 *    the ones row, and the source's top row is what leaves on a
 *    ten-move.
 */
'use strict';
const assert = require('node:assert/strict');
const E = require('./addition-engine');
const L = require('./addition-layout');

let states = 0;
for (let a = 0; a <= 100; a++) for (let b = 0; b <= 100; b++) {
  const solution = E.solve(a, b);
  const R = Math.floor(solution.total / 10) + 1;
  let previous = null;
  solution.states.forEach((state, i) => {
    const p = L.plan(solution, i);
    assert.equal(p.rows, R, `fixed rows ${R} at step ${i} of ${a}+${b}`);
    const allIds = p.left.map(o => o.id).concat(p.right.map(o => o.id));
    for (const side of ['left', 'right']) {
      assert.equal(p[side].length, state[side], `count ${side} at step ${i} of ${a}+${b}`);
      assert.equal(new Set(p[side].map(o => `${o.x},${o.y}`)).size, state[side], `unique slots ${side} at step ${i} of ${a}+${b}`);
      assert(p[side].every(o => o.x >= 0 && o.x < 10 && o.y >= 0 && o.y < R), `slots in grid ${side} at step ${i} of ${a}+${b}`);
      // Canonical grid: complete tens rows stack from the top (y = 0),
      // the ones row is anchored to the bottom (y = R-1) in both pools.
      const tenCount = Math.floor(state[side] / 10) * 10;
      p[side].forEach((o, j) => {
        if (j < tenCount) assert.deepEqual([o.x, o.y], [j % 10, Math.floor(j / 10)], `tens slot ${side} at step ${i} of ${a}+${b}`);
        else assert.deepEqual([o.x, o.y], [j - tenCount, R - 1], `ones slot ${side} at step ${i} of ${a}+${b}`);
      });
      // The ones row is the bottom row whenever ones exist.
      if (state[side] % 10 > 0) {
        assert(p[side].slice(tenCount).every(o => o.y === R - 1),
          `ones on bottom row ${side} at step ${i} of ${a}+${b}`);
      }
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
        // The moved row lands on top of the destination (index 0), and
        // the destination's existing rows shift down one row in list
        // order; its ones stay on the bottom row.
        assert.deepEqual(nextDstIds.slice(0, 10), moved, `ten inserts at the top of dest at step ${i} of ${a}+${b}`);
        assert.deepEqual(nextDstIds.slice(10), prevDstIds, `dest existing ids shift down at step ${i} of ${a}+${b}`);
        assert.deepEqual(p[dst].filter(o => o.y === R - 1).map(o => o.id),
          previous[dst].filter(o => o.y === R - 1).map(o => o.id),
          `dest ones stay put on a ten-move at step ${i} of ${a}+${b}`);
      } else {
        assert.deepEqual(moved, prevSrcIds.slice(-1), `one-move takes the source last object at step ${i} of ${a}+${b}`);
        assert.equal(nextDstIds[nextDstIds.length - 1], moved[0], `one-move appends to dest ones at step ${i} of ${a}+${b}`);
        // A one-move starts and ends on the same bottom row — except
        // when it regroups: completing a ten lifts the moved one (with
        // the other nine) into the new ten row just above the ones row.
        const from = previous[src].find(o => o.id === moved[0]);
        const to = p[dst].find(o => o.id === moved[0]);
        assert.equal(from.y, R - 1, `one-move starts on the bottom row at step ${i} of ${a}+${b}`);
        if (previous[dst].length % 10 === 9) {
          assert.equal(to.y, R - 2, `regrouping one-move ends in the new ten row at step ${i} of ${a}+${b}`);
          assert.equal(to.x, 9, `regrouping one-move completes the ten row at step ${i} of ${a}+${b}`);
        } else {
          assert.equal(to.y, R - 1, `one-move ends on the bottom row at step ${i} of ${a}+${b}`);
          assert.equal(to.x, previous[dst].length % 10, `one-move lands in the next free ones square at step ${i} of ${a}+${b}`);
        }
      }
    }
    previous = p; states++;
  });
}

// --- Named behaviours -------------------------------------------------------
// 47+26 (R = 8): the first ten-move lands on top of the large side at
// y = 0, the large side's rows slide down one row, and its ones stay
// on the bottom row (y = 7). The source's ones stay on the bottom row
// once its tens are gone.
{
  const s = E.solve(47, 26);
  const before = L.plan(s, 0), after = L.plan(s, 1);
  assert.deepEqual(before.left.slice(40).map(o => [o.x, o.y]),
    [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]]);
  assert.deepEqual(after.left.slice(0, 10).map(o => [o.x, o.y]),
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0]]);
  assert.deepEqual(after.left.slice(10, 20).map(o => [o.x, o.y]),
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1]]);
  assert.deepEqual(after.left.slice(50).map(o => [o.x, o.y]),
    [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]]);
  assert.deepEqual(L.movingIds(s, 0), [47, 48, 49, 50, 51, 52, 53, 54, 55, 56]);
  assert.deepEqual(L.movingIds(s, 2), [72]);
  assert(L.plan(s, 2).right.every(o => o.y === 7), 'source ones sit on the bottom row once its tens are gone');
  assert.deepEqual(L.plan(s, 8).right, []);
  assert.equal(L.plan(s, 8).left.length, 73);
}
// 69+4 regroup (R = 8): the fourth one-move completes a new ten row just
// above the ones row (y = 6); the tens above it shift up one row.
{
  const s = E.solve(69, 4);
  const at69 = L.plan(s, 0);
  assert.equal(at69.left.filter(o => o.y === 7).length, 9);
  const at70 = L.plan(s, 1);
  assert.equal(at70.left.length, 70);
  assert.equal(at70.left.filter(o => o.y === 6).length, 10);
  assert.equal(at70.left.filter(o => o.y === 7).length, 0);
  assert.equal(at70.left.filter(o => o.y === 0).length, 10, 'top tens row unchanged by the regroup');
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
  assert.deepEqual(after.right.slice(0, 10).map(o => [o.x, o.y]),
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [8, 0], [9, 0]]);
  assert.deepEqual(after.right.slice(50).map(o => [o.x, o.y]),
    [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]]);
  assert(L.plan(s, 2).left.every(o => o.y === 7), 'source ones sit on the bottom row once its tens are gone');
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

console.log(`Layout: ${states} states verified; counts, identity, bottom-anchored ones, ten-on-top insertion, regrouping and both directions passed.`);
