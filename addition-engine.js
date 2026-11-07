/* Addition Quest — pure math engine.
 *
 * No DOM, no audio, no rendering here. The engine turns an addition
 * problem (a + b) into a reproducible, ordered list of states and moves.
 * The UI may only play the moves the engine produces, in order.
 *
 * The method (deterministic, place value, tens first, then ones):
 *   the SMALLER addend is decomposed into tens, then ones, and each unit
 *   is TRANSFERRED from the smaller side to the larger side, one unit at
 *   a time. Example: 47 + 26 -> move 10, 10, then 1 six times.
 *   The sum (left + right) never changes, so when the smaller side
 *   reaches zero the larger side IS the answer.
 *
 * Panels keep the original order of the problem: left is always the
 * first addend (a), right is always the second (b). The transfer
 * direction varies: objects always move from the SMALLER side to the
 * BIGGER side, whichever side that is. If a == b the right side is the
 * source and the left side is the destination. If the smaller side is
 * 0 there are no moves; the answer is already there.
 *
 * Works in browsers and in Node (for tests):
 *   <script src="addition-engine.js">  -> window.AdditionEngine
 *   const E = require('./addition-engine.js');
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AdditionEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLACES = [10, 1];
  var ONES_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

  function isWhole(n) { return typeof n === 'number' && Number.isFinite(n) && Math.floor(n) === n; }

  function validate(a, b) {
    if (!isWhole(a) || !isWhole(b)) throw new Error('Both numbers must be whole numbers.');
    if (a < 0 || b < 0) throw new Error('Numbers must not be negative.');
    if (a > 100 || b > 100) throw new Error('Numbers above 100 are not supported.');
  }

  /* Ordered list of amounts to move, decomposing the SMALLER number:
   * tens first, then ones, one unit at a time.
   * e.g. 26 -> [10, 10, 1, 1, 1, 1, 1, 1]. */
  function decomposeMoves(small) {
    var moves = [];
    var tens = Math.floor(small / 10);
    for (var k = 0; k < tens; k++) moves.push(10);
    for (var j = 0; j < small % 10; j++) moves.push(1);
    return moves;
  }

  /* Full solution: states[0] is the starting problem; each later state is
   * the result of one transfer. Every state keeps { left, right, moved }
   * where `moved` is the amount just transferred from the smaller side
   * to the larger side. left + right is the total at every state. */
  function solve(a, b) {
    validate(a, b);
    var large = Math.max(a, b);
    var small = Math.min(a, b);
    var total = a + b;
    // Source is the smaller side; ties go right -> left.
    var sourceSide = a < b ? 'left' : 'right';
    var destSide = sourceSide === 'left' ? 'right' : 'left';
    var moves = decomposeMoves(small);
    var states = [{ left: a, right: b, moved: 0 }];
    var left = a, right = b;
    for (var i = 0; i < moves.length; i++) {
      if (sourceSide === 'left') { left -= moves[i]; right += moves[i]; }
      else { right -= moves[i]; left += moves[i]; }
      states.push({ left: left, right: right, moved: moves[i] });
    }
    return {
      a: a, b: b, large: large, small: small, total: total, answer: total,
      sourceSide: sourceSide, destSide: destSide, sourceIsLeft: sourceSide === 'left',
      moves: moves, states: states
    };
  }

  function placeValue(n) {
    return {
      hundreds: Math.floor(n / 100),
      tens: Math.floor(n / 10) % 10,
      ones: n % 10
    };
  }

  function unitWord(place) {
    if (place === 100) return 'hundred';
    if (place === 10) return 'ten';
    return 'one';
  }

  /* How a move is described to a child: "one ten" / "one one".
   * Never "ten" as a bare number name for the count itself. */
  function describeMove(amount) {
    return 'one ' + unitWord(amount);
  }

  /* Place-value spoken form of a count — identical semantics to
   * Cancellation Quest, so the same recorded clips are reused:
   *   84 -> "eight tens, four ones"     17 -> "one ten, seven ones"
   *   60 -> "six tens"                  7  -> "seven ones"
   *   100 -> "one hundred"              0  -> "zero"
   * When tens have just run out, sayZeroTens=true gives the one-time
   * transition phrase "zero tens, four ones". */
  function describeCount(n, sayZeroTens) {
    if (!isWhole(n) || n < 0) throw new Error('describeCount needs a whole number >= 0.');
    var pv = placeValue(n);
    var parts = [];
    if (pv.hundreds > 0) {
      parts.push(ONES_WORDS[pv.hundreds] + ' hundred' + (pv.hundreds > 1 ? 's' : ''));
    }
    if (pv.tens > 0) {
      parts.push(ONES_WORDS[pv.tens] + ' ten' + (pv.tens > 1 ? 's' : ''));
      if (pv.ones > 0) parts.push(ONES_WORDS[pv.ones] + ' one' + (pv.ones > 1 ? 's' : ''));
    } else if (pv.ones > 0) {
      if (sayZeroTens && pv.hundreds === 0) parts.push('zero tens');
      parts.push(ONES_WORDS[pv.ones] + ' one' + (pv.ones > 1 ? 's' : ''));
    }
    if (parts.length === 0) return 'zero';
    return parts.join(', ');
  }

  /* Short caption form shown next to each numeral, e.g. "8 tens · 4 ones". */
  function captionCount(n) {
    var pv = placeValue(n);
    var parts = [];
    if (pv.hundreds > 0) parts.push(pv.hundreds + ' hundred' + (pv.hundreds > 1 ? 's' : ''));
    if (pv.tens > 0) parts.push(pv.tens + ' ten' + (pv.tens > 1 ? 's' : ''));
    if (pv.ones > 0 || parts.length === 0) parts.push(pv.ones + ' one' + (pv.ones === 1 ? '' : 's'));
    return parts.join(' · ');
  }

  /* Difficulty bands for random problems — same bands as Cancellation
   * Quest. a and b are INDEPENDENT draws in the band (b is not capped
   * by a); the smaller of the two is always >= 1, so every random
   * problem needs at least one move. */
  var LEVELS = {
    easy: { label: 'Easy', minA: 2, maxA: 20 },
    medium: { label: 'Medium', minA: 10, maxA: 50 },
    big: { label: 'Big', minA: 20, maxA: 100 }
  };

  function randomProblem(level, rand) {
    var cfg = LEVELS[level] || LEVELS.easy;
    var r = rand || Math.random;
    function draw() { return cfg.minA + Math.floor(r() * (cfg.maxA - cfg.minA + 1)); }
    return { a: draw(), b: draw() };
  }

  /* A state is solved when the source (smaller) side has reached zero.
   * With no solution given, fall back to "the smaller side is zero". */
  function isSolved(state, solution) {
    if (!state) return false;
    if (solution) return state[solution.sourceSide] === 0;
    return Math.min(state.left, state.right) === 0;
  }

  return {
    PLACES: PLACES,
    LEVELS: LEVELS,
    validate: validate,
    decomposeMoves: decomposeMoves,
    solve: solve,
    placeValue: placeValue,
    describeMove: describeMove,
    describeCount: describeCount,
    captionCount: captionCount,
    randomProblem: randomProblem,
    isSolved: isSolved
  };
});
