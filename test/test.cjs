const assert = require('node:assert/strict');
const { LIMIT, initial, canMove, move } = require('./game.js');
let checked = 0;
for (let blue = 0; blue <= LIMIT; blue++) for (let gold = 0; gold <= LIMIT - blue; gold++) {
  const state = { blue, gold };
  for (const kind of ['entry','exit','top','bottom']) for (const n of [1,5,10]) {
    const expected = kind === 'entry' ? blue + gold + n <= LIMIT : kind === 'top' ? blue >= n : gold >= n;
    assert.equal(canMove(state, kind, n), expected);
    const after = move(state, kind, n);
    assert(after.blue >= 0 && after.gold >= 0 && after.blue + after.gold <= LIMIT);
    const delta = !expected ? 0 : kind === 'entry' ? n : kind === 'exit' ? -n : 0;
    assert.equal(after.blue + after.gold, blue + gold + delta);
    if (expected) {
      assert.equal(after.blue, blue + (kind === 'entry' || kind === 'bottom' ? n : kind === 'top' ? -n : 0));
      assert.equal(after.gold, gold + (kind === 'top' ? n : kind === 'bottom' || kind === 'exit' ? -n : 0));
    } else assert.equal(after, state);
    assert.deepEqual(state, { blue, gold });
    checked++;
  }
}
assert.deepEqual(initial(), { blue:5, gold:5 });
assert.equal(canMove(initial(), 'unknown', 1), false);
assert.equal(canMove(initial(), 'entry', -1), false);
console.log(`${checked} movement cases passed: all states, all twelve roads, bounds, conservation, immutability.`);
