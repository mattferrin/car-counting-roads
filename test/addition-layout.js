/* Addition Quest — pure coordinates and identities.
 *
 * Coordinates are shared pool-local grid slots, derived ONLY from the
 * solution state + move history. Object identities are global unique
 * ids: the left pool owns 0..a-1, the right pool owns a..a+b-1.
 * Survivors keep their identity; no object is ever duplicated or lost.
 *
 * Canonical grid per pool: complete tens rows on top, the ones row at
 * the bottom. A ten-move takes the FIRST whole row (top row) off the
 * source pool and inserts it into the destination pool just BEFORE its
 * ones row, so the destination's existing ones shift down a row. A
 * one-move takes the LAST object off the source pool and appends it to
 * the destination pool's ones row; when that row reaches ten it becomes
 * a new complete ten row (regrouping).
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
        var ones = dst.length % 10;
        var at = dst.length - ones; // just before the ones row
        for (var j = 0; j < row.length; j++) dst.splice(at + j, 0, row[j]);
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
    var result = { left: [], right: [], rows: 1 };
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
        if (i < tenCount) { x = i % 10; y = Math.floor(i / 10); }
        else { x = i - tenCount; y = tenCount / 10; }
        result[side].push({ id: id, x: x, y: y });
        result.rows = Math.max(result.rows, y + 1);
      }
    });
    return result;
  }

  return { plan: plan, movingIds: movingIds, orderedLists: orderedLists };
});
