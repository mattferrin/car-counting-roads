# Incremental reliability checkpoint — 2026-11-08

## Objective and working rules
Reliable, mathematically correct, intuitive, consistent games; functionality before polish. One issue per increment: rank, investigate, minimally fix in `test/`, validate all affected consumers, record and commit, then reassess. Promote only verified coherent increments, atomically; the current user authorizes promotion after verification.

Single source of truth for shared behavior, constants and authoritative documentation; keep unrelated concepts separate. Make dependencies/consumers discoverable. Preserve mathematical invariants and educational behavior. Verify boundaries, invalid actions, races, interruption and recovery with targeted tests and real browsers. Passing tests alone is insufficient. Avoid speculative refactors and cosmetic churn.

## Repository and state
`mattferrin/car-counting-roads`, branch `main`. Inspected base: `e88e01a00d550c880b56539b172ae2f2d174cd64`.
Current local state is the commit containing this checkpoint (`git log -1 -- test/HANDOFF.md` identifies it without a self-referential SHA). Production still matches the inspected base; all four increments change `test/` only. Earlier uncommitted/local-only and approval instructions were stale and are superseded here. Binary assets already exist remotely and are untouched.

## Verified increment 1 — invalid Play controls
Evidence: both engines reject invalid moves, but both views left plates/hit areas exposed; Addition used only faded aria-disabled routes, Subtraction retained transparent road hits.

Fix: shared `play-controls.js` owns settled visibility, pointer availability, focus and ARIA state. Consumers: Addition Play (`game.js`, `index.html`) and Subtraction Play (`cancellation-garage.js`, `.html`). Each engine remains the authority for mathematical validity. Impossible plates and transparent targets disappear; decorative roads/edges remain and cannot intercept taps. Busy moves retain their previous visibility through animation/narration, then update once settled. Existing handler guards remain. Script versions updated together with the new dependency.

Validation on this increment:
- Both folders: `node test.cjs`, `node test-themes.cjs` PASS (all supported mathematical states/themes/limits).
- `NODE_PATH=<external jsdom>/node_modules node test/play-controls.test.cjs` PASS: 216 Subtraction boundary states across both themes and 20/50/100; Addition fills/empties/transfers at each capacity; source/destination limits; busy animation and narration visibility; focus/hit removal; roads retained.
- Existing `play-capacity.test.cjs`, `cancellation-garage-ui.test.cjs`, all engines/layouts, flight and Counting Voice suites PASS in both folders.
- Initial full sweep found five failures in each folder: addition-ui:72 and addition-rendered:466 required removed navigation; cancellation-ui:40 required removed `.test-problem` controls; cancellation-map:109 required the removed banner; cancellation-highlight:131 expected replaced selector art. Increment 4 repairs these in `test/`; production copies retain the original failures.
- Real Chromium at a 390×844 iframe: plates hide, roads remain; Addition ten-plate moves 10+0 to 0+10; Subtraction ten-transfer moves 10−0 to 0−10; controls reappear for the newly valid directions; theme changes retain counts. CSS display/pointer/focus states inspected in actual browser. No actual iPhone Safari available.
- Root files unchanged, including all production assets.

## Verified increment 2 — Counting Voice recovery
Reproduced before fix: a failed recording request was cached permanently; the next move could not retry it. Inspection also found a timeout/load race: re-enabling sound before a late load completes could start an already-finished fragment.

Fix limited to Addition Play's existing narrator: share in-flight loads, cache only successful decodes, guard asynchronous completion with its terminal finished flag, expose gesture unlock and call it synchronously from a valid move tap before animation. No narration words, voices, highlighting or preferences changed. Quests do not consume this module and are unchanged.

`node test/counting-voice-recovery.test.cjs` PASS (transient retry, 40 unique preload requests shared with playback, late timeout/retry, stop during fetch, synchronous resume). Existing 41,208 narration plans/playback checks PASS. Both Play UI/capacity regression suites PASS. Real Chromium: mermaid +10 with sound enabled reaches 20+0 and releases the interaction lock with Sound on retained. Actual Safari restrictions and audible output are not proven by this check. Root files unchanged.

## Verified increment 3 — completed Quest landmarks
Both Quest controllers already expose the same settled `body[data-phase="complete"]` state. One rule in their shared `storybook.css` now hides only landmark strips at that state; it leaves moving/celebrating destinations in place and restores them automatically on restart. Every HTML consumer's shared CSS version was updated (both Quests and both Play pages).

`NODE_PATH=<external jsdom>/node_modules node test/quest-completion.test.cjs` PASS: 24 valid game/theme/problem combinations, Addition both directions, Subtraction valid ordering, equal/zero/99 cases, final-flight visibility, final equation/answer and every surviving unit, theme changes at completion, and restart. Both Quest engine suites and cancellation flight regression PASS. Real Chromium 390×844: actual one-unit flights completed for cars Addition 1+1=2 and mermaids Subtraction 1−1=0; landmark strips disappeared, answer/objects remained, New Mystery was visible and restarted with landmarks restored. No animation stubs in browser QA. Root unchanged.

## Verified increment 4 — restore Quest UI coverage
The five failing suites referenced navigation, removed test/level controls and superseded mermaid selector markup. They now verify the actual local All games footer link through one shared `ui-contracts.cjs` helper (consumers: addition-ui, addition-rendered, cancellation-map), current selector artwork, and the existing theme/New Mystery locks instead of nonexistent controls. Arithmetic, identity, timing, highlights, interruption and recovery assertions remain intact.

All five formerly failing `test/` suites now PASS: Addition UI 27 cases, rendered behavior 59 cases, Subtraction UI 41 cases, highlights 2 fragment cases plus assets, map 3 cases. Production tests remain untouched and still have the five historical failures; promotion should include repaired tests and their helper. No product code changed in this increment.

## Final verification and release status
All 20 staging suites PASS on the final tree, plus both required root engine/theme suites (22 successful processes total). Run each `test/*.test.cjs`, `test/test.cjs`, `test/test-themes.cjs`, plus root `test.cjs` and `test-themes.cjs`; NODE_PATH pointed to external jsdom 31.0.0. Full outputs accompany the recovery package. `git diff --check` passes. Every changed path is under `test/`, so production is byte-identical to the inspected base. At preparation of this staging commit, production is still unchanged; the browser publication path is now available (see next action).

## Prioritized unresolved issues
1. Audio reliability (high impact, reported intermittent, larger regression surface). Inspect the three narrators before changing them. Counting Voice retry/late-completion defects are fixed in increment 2; Quests still duplicate playback and preferences, cache failures and only resume suspended contexts. Broader shared-audio refactoring is deferred without Safari evidence. Reproduce with deferred fetch/resume, mute, tab interruption and retry. Evaluate every consumer of shared playback. Subtraction Play is currently deliberately silent in code/README/tests; adding narration needs an explicit behavioral contract within this user's consistency goal.
2. Addition route group bounding boxes overlap: clicking the center of the accessible ten-route group hit the one-route plate in Chromium. Actual ten-plate clicks and keyboard handler are correct. Investigate accessible control bounds before any geometry change.
3. Actual iPhone Safari audio initialization/recovery and mermaid alignment remain unverified. Large 99+99 Quest caption may require scrolling; no evidence yet that this needs a layout change.

## Exact next action
The authenticated GitHub browser is available (user explicitly authorized it on 2026-11-08). API writes still lack integration access and Git push lacks credentials; use GitHub's normal Upload files interface. The staging upload is the commit containing this checkpoint; it contains the four verified local increments through 7d7e860. Verify deployed `/test/` behavior and byte content, then atomically upload the corresponding production file set, including new shared dependencies and repaired tests. Strip the existing `(Test)` title suffix for production and adjust the matching title assertion. Keep staging documentation under test/. After promotion, record the remote staging/production commits and verification here.

## Reproduction and dependency notes
No build step or runtime packages. For local tests install jsdom outside the repo, set NODE_PATH and run each `*.test.cjs` separately from its containing folder. Apply a per-process timeout when sweeping older failing UI tests, which can leave asynchronous work alive after an assertion. Run both basic suites in both folders as AGENTS.md requires. Browser QA must use actual interactions in addition to DOM tests; a mobile-sized Chromium iframe is not Safari.
