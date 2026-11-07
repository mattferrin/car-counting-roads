/* Addition Quest — engine tests.
 * Run:  node addition-quest.test.cjs
 * Exhaustive over every a, b in 0..100 (10,201 problems) plus named
 * problems in both directions, and the spoken place-value forms.
 * Invariants the game promises children:
 *   - original equation never changes; left is always a, right always b
 *   - left + right (the total) is invariant at every step
 *   - moves transfer the SMALLER number, tens first then ones, one unit
 *     at a time; the source side shrinks, the dest side grows by the move
 *   - the source side eventually reaches 0 and the dest side then equals
 *     a + b, the answer
 */
'use strict';
const E = require('./addition-engine.js');

let checks = 0, failures = [];
function check(cond, label) {
  checks++;
  if (!cond) failures.push(label);
}
function eq(actual, expected, label) {
  check(JSON.stringify(actual) === JSON.stringify(expected),
    label + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
}

// --- Named problems from the spec (exact traces, both directions) --------
eq(E.solve(47, 26).moves, [10, 10, 1, 1, 1, 1, 1, 1], '47+26 moves');
eq(E.solve(47, 26).states.map(s => [s.left, s.right]),
  [[47, 26], [57, 16], [67, 6], [68, 5], [69, 4], [70, 3], [71, 2], [72, 1], [73, 0]],
  '47+26 states (matches the spec table)');
eq(E.solve(47, 26).answer, 73, '47+26 answer');
eq(E.solve(47, 26).sourceSide, 'right', '47+26 source is right');
eq(E.solve(47, 26).destSide, 'left', '47+26 dest is left');
eq(E.solve(26, 47).moves, [10, 10, 1, 1, 1, 1, 1, 1], '26+47 moves');
eq(E.solve(26, 47).states.map(s => [s.left, s.right]),
  [[26, 47], [16, 57], [6, 67], [5, 68], [4, 69], [3, 70], [2, 71], [1, 72], [0, 73]],
  '26+47 states (mirror of 47+26)');
eq(E.solve(26, 47).sourceSide, 'left', '26+47 source is left');
eq(E.solve(26, 47).destSide, 'right', '26+47 dest is right');
eq(E.solve(26, 47).answer, 73, '26+47 answer');
eq(E.solve(69, 4).moves, [1, 1, 1, 1], '69+4 moves (regroup, ones only)');
eq(E.solve(69, 4).states.map(s => [s.left, s.right]),
  [[69, 4], [70, 3], [71, 2], [72, 1], [73, 0]], '69+4 states (69 -> 70 regroup)');
eq(E.solve(4, 69).states.map(s => [s.left, s.right]),
  [[4, 69], [3, 70], [2, 71], [1, 72], [0, 73]], '4+69 states (regroup, other direction)');
eq(E.solve(30, 30).sourceSide, 'right', '30+30 tie: source is right');
eq(E.solve(30, 30).destSide, 'left', '30+30 tie: dest is left');
eq(E.solve(30, 30).moves, [10, 10, 10], '30+30 moves');
eq(E.solve(30, 30).answer, 60, '30+30 answer');
eq(E.solve(9, 5).moves, [1, 1, 1, 1, 1], '9+5 moves');
eq(E.solve(9, 5).answer, 14, '9+5 answer');
eq(E.solve(100, 47).moves, [10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1], '100+47 moves');
eq(E.solve(100, 47).answer, 147, '100+47 answer');
eq(E.solve(100, 47).states[0], { left: 100, right: 47, moved: 0 }, '100+47 start state');
eq(E.solve(100, 47).states[4], { left: 140, right: 7, moved: 10 }, '100+47 after the tens');
eq(E.solve(47, 0).moves, [], 'zero smaller side needs no moves');
eq(E.solve(47, 0).answer, 47, '47+0 answer is 47');
eq(E.solve(0, 47).answer, 47, '0+47 answer is 47');
eq(E.solve(0, 47).sourceSide, 'left', '0+47 source is the zero left side');
eq(E.solve(0, 0).answer, 0, '0+0 answer is 0');
eq(E.solve(100, 100).answer, 200, '100+100 answer is 200');
eq(E.solve(100, 99).moves.length, 18, '100+99 has 18 moves');
let threw = false;
try { E.solve(101, 0); } catch (e) { threw = true; }
check(threw, 'a above 100 is rejected');
threw = false;
try { E.solve(0, 101); } catch (e) { threw = true; }
check(threw, 'b above 100 is rejected');
threw = false;
try { E.solve(-1, 0); } catch (e) { threw = true; }
check(threw, 'negative a is rejected');
threw = false;
try { E.solve(47.5, 2); } catch (e) { threw = true; }
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
eq(E.describeCount(147), 'one hundred, four tens, seven ones', 'speak 147');
eq(E.describeCount(90), 'nine tens', 'speak 90');
eq(E.describeCount(0), 'zero', 'speak 0');
eq(E.describeCount(4, true), 'zero tens, four ones', 'transition phrase: zero tens, four ones');
eq(E.describeCount(4, false), 'four ones', 'after transition: four ones alone');
eq(E.describeCount(1), 'one one', 'speak 1 as one one');
eq(E.describeCount(73), 'seven tens, three ones', 'speak answer 73');
eq(E.describeMove(10), 'one ten', 'move of 10 is spoken as one ten');
eq(E.describeMove(1), 'one one', 'move of 1 is spoken as one one');
eq(E.captionCount(84), '8 tens · 4 ones', 'caption 84');
eq(E.captionCount(7), '7 ones', 'caption 7');
eq(E.captionCount(0), '0 ones', 'caption 0');
eq(E.captionCount(147), '1 hundred · 4 tens · 7 ones', 'caption 147');

// --- Exhaustive invariants: every a 0..100, every b 0..100 ------------------
let problems = 0, maxMoves = 0;
for (let a = 0; a <= 100; a++) {
  for (let b = 0; b <= 100; b++) {
    problems++;
    const s = E.solve(a, b);
    const small = Math.min(a, b), large = Math.max(a, b);
    check(s.a === a && s.b === b, `original equation preserved for ${a}+${b}`);
    check(s.answer === a + b, `answer is a+b for ${a}+${b}`);
    check(s.total === a + b, `total is a+b for ${a}+${b}`);
    check(s.large === large && s.small === small, `large/small for ${a}+${b}`);
    check(s.sourceSide === (a < b ? 'left' : 'right'), `source side for ${a}+${b}`);
    check(s.destSide === (a < b ? 'right' : 'left'), `dest side for ${a}+${b}`);
    check(s.moves.length === s.states.length - 1, `one state per move for ${a}+${b}`);
    check(s.states[s.states.length - 1][s.sourceSide] === 0, `source reaches 0 for ${a}+${b}`);
    check(s.states[s.states.length - 1][s.destSide] === a + b, `dest equals answer at end for ${a}+${b}`);
    check(E.isSolved(s.states[s.states.length - 1], s), `final state is solved for ${a}+${b}`);
    check(E.decomposeMoves(small).length === s.moves.length, `moves decompose the smaller number for ${a}+${b}`);
    for (let i = 1; i < s.moves.length; i++) {
      check(s.moves[i] <= s.moves[i - 1], `moves descend by place for ${a}+${b}`);
    }
    check(s.moves.every(m => m === 10 || m === 1), `every move is one ten or one one for ${a}+${b}`);
    for (let i = 0; i < s.states.length; i++) {
      const st = s.states[i];
      check(st.left >= 0 && st.right >= 0, `no negatives at step ${i} of ${a}+${b}`);
      check(st.left + st.right === a + b, `total invariant at step ${i} of ${a}+${b}`);
      if (i > 0) {
        const prev = s.states[i - 1];
        const mv = s.moves[i - 1];
        check(prev[s.sourceSide] - st[s.sourceSide] === mv, `source loses exactly the move at step ${i} of ${a}+${b}`);
        check(st[s.destSide] - prev[s.destSide] === mv, `dest gains exactly the move at step ${i} of ${a}+${b}`);
        check(st.moved === mv, `moved field matches move at step ${i} of ${a}+${b}`);
      }
    }
    if (s.moves.length > maxMoves) maxMoves = s.moves.length;
  }
}
check(problems === 10201, 'exhaustive sweep covered 10,201 problems, got ' + problems);
check(maxMoves === 18, 'longest solution is 18 moves (100+99 / 99+100), got ' + maxMoves);

// --- Random generation stays in bounds, both draws independent --------------
for (const level of ['easy', 'medium', 'big']) {
  for (let i = 0; i < 200; i++) {
    const p = E.randomProblem(level, Math.random);
    const cfg = E.LEVELS[level];
    check(p.a >= cfg.minA && p.a <= cfg.maxA, `${level}: a in range (got ${p.a})`);
    check(p.b >= cfg.minA && p.b <= cfg.maxA, `${level}: b in range (got ${p.b})`);
    check(Math.min(p.a, p.b) >= 1, `${level}: smaller >= 1 (got ${p.a}+${p.b})`);
  }
}

console.log(`Addition engine: ${checks} checks, ${failures.length} failures, ${problems} problems swept.`);
if (failures.length) {
  console.log('FAILURES:');
  failures.slice(0, 30).forEach(f => console.log(' - ' + f));
  process.exit(1);
}
console.log('All engine checks passed.');
