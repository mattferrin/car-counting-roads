/* Cancellation Quest — engine tests.
 * Run:  node cancellation-quest.test.cjs
 * Checks every a in 0..100 and every b in 0..a (5,151 problems) plus the
 * named test problems, the spoken place-value forms, and the invariants
 * the game promises children:
 *   - original equation never changes; answer hidden until the end
 *     (the engine simply never exposes the answer before the last state)
 *   - every move removes EQUAL amounts from both sides
 *   - left - right is invariant at every step
 *   - right eventually reaches 0, left then equals a - b
 *   - no negative quantities, no incorrect intermediate states
 *   - moves are place-value deterministic: hundreds, then tens, then ones,
 *     one unit at a time (no shortcuts, no x10 badges in the math)
 */
'use strict';
const E = require('./cancellation-engine.js');

let checks = 0, failures = [];
function check(cond, label) {
  checks++;
  if (!cond) failures.push(label);
}
function eq(actual, expected, label) {
  check(JSON.stringify(actual) === JSON.stringify(expected),
    label + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

// --- Named problems from the spec (exact traces) ---------------------------
eq(E.solve(84, 27).moves, [10, 10, 1, 1, 1, 1, 1, 1, 1], '84-27 moves');
eq(E.solve(84, 27).states.map(s => [s.left, s.right]),
  [[84, 27], [74, 17], [64, 7], [63, 6], [62, 5], [61, 4], [60, 3], [59, 2], [58, 1], [57, 0]],
  '84-27 states (matches the spec table)');
eq(E.solve(84, 27).answer, 57, '84-27 answer');
eq(E.solve(9, 5).moves, [1, 1, 1, 1, 1], '9-5 moves');
eq(E.solve(9, 5).answer, 4, '9-5 answer');
eq(E.solve(25, 15).moves, [10, 1, 1, 1, 1, 1], '25-15 moves');
eq(E.solve(25, 15).answer, 10, '25-15 answer');
eq(E.solve(42, 18).moves, [10, 1, 1, 1, 1, 1, 1, 1, 1], '42-18 moves');
eq(E.solve(42, 18).answer, 24, '42-18 answer');
eq(E.solve(100, 47).moves, [10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1], '100-47 moves');
eq(E.solve(100, 47).answer, 53, '100-47 answer');
eq(E.solve(100, 47).states[0], { left: 100, right: 47, removed: 0 }, '100-47 start state');
eq(E.solve(100, 47).states[4], { left: 60, right: 7, removed: 10 }, '100-47 after the tens');

// --- Edge cases -------------------------------------------------------------
eq(E.solve(10, 10).states, [{ left: 10, right: 10, removed: 0 }, { left: 0, right: 0, removed: 10 }], 'equal operands 10-10');
eq(E.solve(10, 10).answer, 0, 'equal operands answer is 0');
eq(E.solve(7, 0).moves, [], 'zero subtrahend needs no moves');
eq(E.solve(7, 0).answer, 7, '7-0 answer is 7');
eq(E.solve(0, 0).answer, 0, '0-0 answer is 0');
eq(E.solve(5, 5).answer, 0, '5-5 answer is 0');
eq(E.solve(20, 19).answer, 1, '20-19 borrowing-style case');
eq(E.solve(100, 100).answer, 0, '100-100 answer is 0');
eq(E.solve(100, 99).moves, [10, 10, 10, 10, 10, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1, 1, 1], '100-99 moves');
let threw = false;
try { E.solve(5, 9); } catch (e) { threw = true; }
check(threw, 'b > a is rejected');
threw = false;
try { E.solve(-1, 0); } catch (e) { threw = true; }
check(threw, 'negative a is rejected');
threw = false;
try { E.solve(84.5, 2); } catch (e) { threw = true; }
check(threw, 'non-whole numbers are rejected');

// --- Place-value speech: tens and ones, never fused number names -----------
eq(E.describeCount(84), 'eight tens, four ones', 'speak 84');
eq(E.describeCount(27), 'two tens, seven ones', 'speak 27');
eq(E.describeCount(17), 'one ten, seven ones', 'speak 17 (singular ten)');
eq(E.describeCount(7), 'seven ones', 'speak 7');
eq(E.describeCount(60), 'six tens', 'speak 60 (no ones part)');
eq(E.describeCount(10), 'one ten', 'speak 10');
eq(E.describeCount(11), 'one ten, one one', 'speak 11');
eq(E.describeCount(100), 'one hundred', 'speak 100');
eq(E.describeCount(90), 'nine tens', 'speak 90');
eq(E.describeCount(0), 'zero', 'speak 0');
eq(E.describeCount(4, true), 'zero tens, four ones', 'transition phrase: zero tens, four ones');
eq(E.describeCount(4, false), 'four ones', 'after transition: four ones alone');
eq(E.describeCount(1), 'one one', 'speak 1 as one one');
eq(E.describeCount(53), 'five tens, three ones', 'speak answer 53');
eq(E.describeMove(10), 'one ten', 'move of 10 is spoken as one ten');
eq(E.describeMove(1), 'one one', 'move of 1 is spoken as one one');
eq(E.describeMove(100), 'one hundred', 'move of 100 is spoken as one hundred');
eq(E.captionCount(84), '8 tens · 4 ones', 'caption 84');
eq(E.captionCount(7), '7 ones', 'caption 7');
eq(E.captionCount(0), '0 ones', 'caption 0');

// --- Exhaustive invariants: every a 0..100, every b 0..a --------------------
let problems = 0, maxMoves = 0;
for (let a = 0; a <= 100; a++) {
  for (let b = 0; b <= a; b++) {
    problems++;
    const s = E.solve(a, b);
    check(s.a === a && s.b === b, `original equation preserved for ${a}-${b}`);
    check(s.answer === a - b, `answer is a-b for ${a}-${b}`);
    check(s.moves.length === s.states.length - 1, `one state per move for ${a}-${b}`);
    check(s.states[s.states.length - 1].right === 0, `right reaches 0 for ${a}-${b}`);
    check(s.states[s.states.length - 1].left === a - b, `left equals answer at end for ${a}-${b}`);
    check(E.isSolved(s.states[s.states.length - 1]), `final state is solved for ${a}-${b}`);
    // Moves are non-increasing place values (100s, then 10s, then 1s) and
    // each move is a single unit at its place value: no shortcuts.
    for (let i = 1; i < s.moves.length; i++) {
      check(s.moves[i] <= s.moves[i - 1], `moves descend by place for ${a}-${b}`);
    }
    check(s.moves.every(m => m === 100 || m === 10 || m === 1), `every move is one unit at a place for ${a}-${b}`);
    // Per-state invariants.
    for (let i = 0; i < s.states.length; i++) {
      const st = s.states[i];
      check(st.left >= 0 && st.right >= 0, `no negatives at step ${i} of ${a}-${b}`);
      check(st.left - st.right === a - b, `difference invariant at step ${i} of ${a}-${b}`);
      if (i > 0) {
        const prev = s.states[i - 1];
        check(prev.left - st.left === s.moves[i - 1], `left loses exactly the move at step ${i} of ${a}-${b}`);
        check(prev.right - st.right === s.moves[i - 1], `right loses exactly the move at step ${i} of ${a}-${b}`);
        check(prev.left - st.left === prev.right - st.right, `equal removal both sides at step ${i} of ${a}-${b}`);
        check(st.removed === s.moves[i - 1], `removed field matches move at step ${i} of ${a}-${b}`);
      }
    }
    if (s.moves.length > maxMoves) maxMoves = s.moves.length;
  }
}
check(problems === 5151, 'exhaustive sweep covered 5,151 problems, got ' + problems);
check(maxMoves === 18, 'longest solution is 18 moves (100-99), got ' + maxMoves);

// --- Random generation stays in bounds --------------------------------------
for (const level of ['easy', 'medium', 'big']) {
  for (let i = 0; i < 200; i++) {
    const p = E.randomProblem(level, Math.random);
    const cfg = E.LEVELS[level];
    check(p.a >= cfg.minA && p.a <= cfg.maxA, `${level}: a in range (got ${p.a})`);
    check(p.b >= 1 && p.b <= p.a, `${level}: 1 <= b <= a (got ${p.a}-${p.b})`);
  }
}

console.log(`Cancellation engine: ${checks} checks, ${failures.length} failures, ${problems} problems swept.`);
if (failures.length) {
  console.log('FAILURES:');
  failures.slice(0, 30).forEach(f => console.log(' - ' + f));
  process.exit(1);
}
console.log('All engine checks passed.');
