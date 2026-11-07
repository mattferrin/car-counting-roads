/* Pure coordinates and identities derived exclusively from the solution state.
 * Coordinates are shared pool-local grid slots, not independent counters.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CancellationLayout = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function plan(solution, step, beforeAlignment) {
    var st = solution.states[step];
    var bigRemoved = solution.moves.slice(0, step).filter(function (m) { return m > 1; }).reduce(function (a, b) { return a + b; }, 0);
    var onesRemoved = solution.moves.slice(0, step).filter(function (m) { return m === 1; }).length;
    var onesStart = solution.states.findIndex(function (s) { return s.right < 10; });
    var base = onesStart < 0 ? st : solution.states[onesStart];
    var inOnes = st.right < 10;
    var baseTail = base.left % 10;
    // Open exactly one ten when needed; all ten original objects remain.
    if (baseTail < base.right) baseTail += 10;
    var fixedRows = Math.floor((base.left - baseTail) / 10);
    var unmatched = baseTail - base.right;
    var result = {left: [], right: [], rows: 1};
    ['left', 'right'].forEach(function (side) {
      var count = st[side], original = side === 'left' ? solution.a : solution.b;
      var tenCount = inOnes ? (side === 'left' ? fixedRows * 10 : 0) : Math.floor(count / 10) * 10;
      for (var i = 0; i < count; i++) {
        var x, y;
        if (i < tenCount) { x = i % 10; y = Math.floor(i / 10); }
        else if (inOnes) {
          var tailIndex = side === 'left' ? i - tenCount : i + unmatched;
          // Unmatched units never move horizontally. Survivors of the
          // matching run close toward its fixed right edge after each pair.
          if (tailIndex >= unmatched) tailIndex += onesRemoved;
          x = tailIndex % 10;
          y = (beforeAlignment && side === 'right' ? 0 : fixedRows) + Math.floor(tailIndex / 10);
        } else {
          var tail = count % 10;
          var leftTail = st.left % 10;
          x = i - tenCount + Math.max(0, leftTail - tail);
          y = tenCount / 10;
        }
        var id = bigRemoved + i;
        if (id >= original - onesRemoved) throw new Error('Invalid surviving identity');
        result[side].push({id: id, x: x, y: y});
        result.rows = Math.max(result.rows, y + 1);
      }
    });
    return result;
  }
  return {plan: plan};
});
