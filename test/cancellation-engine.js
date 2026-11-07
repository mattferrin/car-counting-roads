/* Cancellation Quest — pure math engine.
 *
 * No DOM, no audio, no rendering here. The engine turns a subtraction
 * problem (a - b) into a reproducible, ordered list of states and moves.
 * The UI may only play the moves the engine produces, in order.
 *
 * The method (deterministic, place value, largest to smallest):
 *   decompose b into hundreds / tens / ones, then remove one unit at the
 *   current place value at a time, the SAME amount from BOTH sides.
 *   Example: 84 - 27 -> remove 10, 10, then 1 seven times.
 *   The difference (left - right) never changes, so when the right side
 *   reaches zero the left side IS the answer.
 *
 * Works in browsers and in Node (for tests):
 *   <script src="cancellation-engine.js">  -> window.CancellationEngine
 *   (note: the closing tag is deliberately not written here — that literal
 *   text inside a comment would end an inlined script block early in HTML)
 *   const E = require('./cancellation-engine.js');
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CancellationEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PLACES = [100, 10, 1];
  var ONES_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

  function isWhole(n) { return typeof n === 'number' && Number.isFinite(n) && Math.floor(n) === n; }

  function validate(a, b) {
    if (!isWhole(a) || !isWhole(b)) throw new Error('Both numbers must be whole numbers.');
    if (a < 0 || b < 0) throw new Error('Numbers must not be negative.');
    if (b > a) throw new Error('The second number must not be bigger than the first.');
    if (a > 999) throw new Error('Numbers above 999 are not supported.');
  }

  /* Ordered list of amounts to cancel, e.g. 27 -> [10, 10, 1, 1, 1, 1, 1, 1, 1].
   * Hundreds first, then tens, then ones; one move per unit at each place. */
  function decomposeMoves(b) {
    var moves = [];
    for (var i = 0; i < PLACES.length; i++) {
      var place = PLACES[i];
      var digit = Math.floor(b / place) % 10;
      for (var k = 0; k < digit; k++) moves.push(place);
    }
    return moves;
  }

  /* Full solution: states[0] is the starting problem; each later state is
   * the result of one move. Every state keeps { left, right, removed }
   * where `removed` is the amount just cancelled from EACH side. */
  function solve(a, b) {
    validate(a, b);
    var moves = decomposeMoves(b);
    var states = [{ left: a, right: b, removed: 0 }];
    var left = a, right = b;
    for (var i = 0; i < moves.length; i++) {
      left -= moves[i];
      right -= moves[i];
      states.push({ left: left, right: right, removed: moves[i] });
    }
    return { a: a, b: b, answer: a - b, moves: moves, states: states };
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

  /* How a move is described to a child: "one ten" / "one one" / "one hundred".
   * Never "ten" as a bare number name for the count itself. */
  function describeMove(amount) {
    return 'one ' + unitWord(amount);
  }

  /* Place-value spoken form of a count. This is the heart of the narration:
   * children hear TENS and ONES, not the fused number names ("thirty-two",
   * "twenty-two"...) they have not learned yet.
   *   84 -> "eight tens, four ones"     17 -> "one ten, seven ones"
   *   60 -> "six tens"                  7  -> "seven ones"
   *   100 -> "one hundred"              0  -> "zero"
   * When tens have just run out, sayZeroTens=true gives the one-time
   * transition phrase "zero tens, four ones" — after that, ones count
   * alone ("three ones", "two ones", "one one", "zero ones" is just "zero"
   * at the very end). Pass sayZeroTens=false for the ordinary form. */
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

  /* Difficulty bands for random problems. b is always >= 1 and <= a, so
   * every random problem needs at least one cancel move. */
  var LEVELS = {
    easy: { label: 'Easy', minA: 2, maxA: 20 },
    medium: { label: 'Medium', minA: 10, maxA: 50 },
    big: { label: 'Big', minA: 20, maxA: 100 }
  };

  function randomProblem(level, rand) {
    var cfg = LEVELS[level] || LEVELS.easy;
    var r = rand || Math.random;
    var a = cfg.minA + Math.floor(r() * (cfg.maxA - cfg.minA + 1));
    var b = 1 + Math.floor(r() * a); // 1..a
    return { a: a, b: b };
  }

  function isSolved(state) { return state.right === 0; }

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
