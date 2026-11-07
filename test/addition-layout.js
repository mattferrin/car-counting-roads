/* Addition Quest — pure coordinates and identities.
 *
 * Coordinates are shared pool-local grid slots, derived ONLY from the
 * solution state + move history. Object identities are global unique
 * ids: the left pool owns 0..a-1, the right pool owns a..a+b-1.
 * Survivors keep their identity; no object is ever duplicated or lost.
 *
 * Grid shape (fixed for the whole problem): R = floor(total/10) + 1
 * rows. The ones row is BOTTOM-ANCHORED at y = R-1 in BOTH pools, at
 * the same height, throughout — tens stack above it from y = 0 down,
 * so the two pools share one positional grid and a one-move is a slide
 * across the bottom row into the next free square. A ten-move takes the
 * FIRST whole row (top row) off the source pool and inserts it at the
 * START of the destination pool's list, so it lands at y = 0 — the top
 * of the destination — and the rows below slide down one row to make
 * room. A one-move takes the LAST object off the source pool and
 * appends it to the destination pool's ones row; when that row reaches
 * ten it becomes a new complete ten row just above the ones row (the
 * tens above it shift up one row), which is the regrouping.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AdditionLayout = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Ordered id lists after `step` moves have been played. */
  function orderedLists(solution, step) {
    var left = [], right = [], i;
    for (i = 0; i < solution.a; i++) left.push(i);
    for (i = 0; i < solution.b; i++) right.push(solution.a + i);
    var lists = { left: left, right: right };
    for (var k = 0; k < step; k++) {
      var amount = solution.moves[k];
      var src = lists[solution.sourceSide];
      var dst = lists[solution.destSide];
      if (amount === 10) {
        if (src.length < 10) throw new Error('Invalid surviving identity');
        var row = src.splice(0, 10);
        // Insert at the START of the destination's list: the new ten
        // lands on top of the destination (y = 0) and the rows below
        // slide down one row to make room.
        for (var j = 0; j < row.length; j++) dst.splice(j, 0, row[j]);
      } else if (amount === 1) {
        if (src.length < 1) throw new Error('Invalid surviving identity');
        dst.push(src.pop());
      } else {
        throw new Error('Invalid surviving identity');
      }
    }
    return lists;
  }

  /* Ids that move on move index `step` (the next move to play). */
  function movingIds(solution, step) {
    if (step >= solution.moves.length) return [];
    var lists = orderedLists(solution, step);
    var src = lists[solution.sourceSide];
    var amount = solution.moves[step];
    if (amount === 10) return src.slice(0, 10);
    return src.slice(-1);
  }

  function plan(solution, step) {
    if (!solution || !solution.states || step < 0 || step >= solution.states.length) {
      throw new Error('Invalid surviving identity');
    }
    var st = solution.states[step];
    var lists = orderedLists(solution, step);
    // Fixed rows for the whole problem: the ones row sits at y = R-1
    // in both pools, at the same height, from the first state to the last.
    var R = Math.floor(solution.total / 10) + 1;
    var result = { left: [], right: [], rows: R };
    var seen = {};
    ['left', 'right'].forEach(function (side) {
      var list = lists[side];
      var count = st[side];
      if (list.length !== count) throw new Error('Invalid surviving identity');
      var tenCount = Math.floor(count / 10) * 10;
      for (var i = 0; i < list.length; i++) {
        var id = list[i];
        // Ids are global: any original object may now live in either pool.
        if (id < 0 || id >= solution.a + solution.b) throw new Error('Invalid surviving identity');
        if (seen[id]) throw new Error('Invalid surviving identity');
        seen[id] = true;
        var x, y;
        // Tens stack from the top (y = 0); the ones row is anchored to
        // the bottom (y = R-1) in both pools.
        if (i < tenCount) { x = i % 10; y = Math.floor(i / 10); }
        else { x = i - tenCount; y = R - 1; }
        result[side].push({ id: id, x: x, y: y });
      }
    });
    return result;
  }

  return { plan: plan, movingIds: movingIds, orderedLists: orderedLists };
});
