# Counting Worlds reliability handoff — 2026-11-08

## Objective and engineering rules
Reliable, mathematically correct, intuitive, consistent games; functionality before polish. Select one highest-value issue, establish its cause and consumers, minimally fix it in `test/`, verify, record and commit, then reassess. Promote only coherent verified sets, atomically.

Shared business behavior/configuration and authoritative documentation have one source. Keep unrelated concepts separate; make shared consumers explicit. Preserve arithmetic invariants and educational behavior. Verify boundaries, invalid actions, async races, interruption and recovery with targeted tests and actual browser interactions. Passing tests alone is insufficient. Avoid speculative refactoring and cosmetic churn.

## Current repository and release
Repository: `mattferrin/car-counting-roads`, branch `main`.
- Inspected base: `e88e01a00d550c880b56539b172ae2f2d174cd64`.
- Latest published staging increment: `d8f9c15494668f1ad593330baf431618b6f67a2d` (audio-wait layout); preceding reliability batch: `a0bf41d64586144eba073139a057b18b89bd73b1`.
- Latest published production code: `a6b6a5ca7392434a3fd5ec51884b2e9ed194389a` (audio-wait layout); preceding reliability batch: `943fb2dbb5a8e8859e77a78e6fef054f6a65c342`.
- This documentation checkpoint is identified by `git log -1 -- test/HANDOFF.md`; it changes no runtime files.

Both Pages deployments succeeded. All 23 changed staging files and all 21 promoted production files were fetched from the live site and matched the respective committed bytes exactly. Production was promoted in one commit, with every new dependency. Root HTML keeps its existing non-Test titles; the corresponding title assertion is normalized for production. Staging documentation remains under `test/`; root README points here for release status.

Browser publication is authorized by the user and works through GitHub's normal Upload files interface in the authenticated session. The connector's write API returned 403 and ordinary Git push lacked credentials; these were access-method limitations, not missing user permission. Public Git fetch works. Prefer supported tools where sufficient; use the explicitly authorized browser fallback for writes when needed.

## Verified completions and affected consumers
1. **Invalid Play controls.** Both engines already rejected invalid moves, but the views exposed disabled plates and transparent hit areas. Shared `play-controls.js` now owns settled visibility, pointer availability, focus and ARIA state. Consumers: `game.js`/`index.html` (Addition Play) and `cancellation-garage.js`/`.html` (Subtraction Play). Each engine remains the mathematical authority. Impossible plates and transparent targets disappear; decorative roads remain and cannot intercept taps. Busy moves retain settled visibility through animation/narration, then update once. Handler guards remain.
2. **Addition Play audio recovery.** A failed recording request was cached permanently until refresh; late asynchronous completion could start a timed-out fragment after sound was re-enabled. `counting-voice.js` now shares in-flight loads, caches successful decodes only, guards terminal completion, and exposes synchronous gesture unlock called from a valid move tap before animation. Voices, words, highlighting and preferences are preserved. Quests do not consume this narrator and were not changed.
3. **Quest completion.** One rule in shared `storybook.css` hides landmark strips only at settled `body[data-phase="complete"]`. Final flights/narration retain destinations; final equation, objects, answer and New Mystery remain. Restart restores landmarks automatically. CSS consumers: both Quests and both Play pages; all their HTML references were versioned together.
4. **Restored UI coverage.** Five suites stopped at superseded navigation, removed test/level controls or replaced selector art. They now verify current behavior, preserving later arithmetic, identity, timing, interruption and recovery assertions. `ui-contracts.cjs` owns the footer navigation contract; consumers: addition-ui, addition-rendered, cancellation-map. Both root and staging copies pass.

5. **Stable Quest audio waits.** User observed children tapping disabled landmarks and required no screen jolt when hiding them. A shared `storybook.css` rule now uses `visibility:hidden; pointer-events:none` during `narrating` and `celebrating`, reserving the full strip geometry. Landmarks remain visible during flights, return at ready, and retain the existing completion behavior. All four HTML consumers reference CSS v26. The Quest completion regression checks hidden-but-space-preserving audio waits and visible ready/moving states. Real Chromium at 390×844 with held speech completion and real animations: both games × both themes measured **0px change** in header, both strips, both panels, captions and footer when toggling only visibility at the same arithmetic state; strips retain 105px height. Normal narration completion and mute interruption both restore landmarks. The deployed production narration state was also observed with both strips hidden, pointer events disabled and 105px height retained; normal ready state restores them. All six changed runtime/test files matched live deployed bytes; both Pages deployments succeeded. Physical Safari remains unverified.

## Validation commands and results
No build step or runtime package installation. Test dependency: jsdom 31.0.0 installed outside the repository; set `NODE_PATH` to that external node_modules directory.

From EACH of root and `test/`, run:

```sh
node test.cjs
node test-themes.cjs
for file in *.test.cjs; do node "$file" || exit; done
```

**20 suites PASS in each folder (40 total).** `git diff --check` passes. New targeted coverage:
- `play-controls.test.cjs`: 216 Subtraction boundary states, both themes/all capacities; Addition fills/empties/transfers at 20/50/100; source/destination limits; stable visibility through animation and narration; synchronous tap unlock; focus/hit removal; roads retained.
- `counting-voice-recovery.test.cjs`: transient failure retry, 40 deduplicated preload requests shared with playback, terminal watchdog/load race, stop during fetch, synchronous context resume. Existing 41,208 narration-plan/playback checks also pass.
- `quest-completion.test.cjs`: 24 valid game/theme/problem cases; Addition both directions; Subtraction valid ordering; equal/zero/99 boundaries; final-flight visibility; every surviving object/equation/answer; completed theme changes and restart.
- Restored suites: Addition UI 27 cases; rendered behavior 59; Subtraction UI 41; highlights 2 fragment cases plus assets; map 3 cases. Exhaustive engine/layout, capacity and flight checks also pass.

Actual Chromium checks ran locally at 390×844 and on BOTH deployed environments: valid ten-unit Play transfers and signed differences; hidden invalid controls/hit styles with roads retained; theme changes; Addition Play +10 with sound enabled completes and releases its lock; Addition 1+1=2 and Subtraction 1−1=0 complete real flights, hide landmarks, preserve answers, and restart. Browser animations were not stubbed. Actual iPhone Safari and audible output are not proven by these checks.

## Prioritized unresolved work
1. **Quest audio recovery and shared audio behavior:** both Quests still duplicate playback/context handling, use one-shot preloading, cache failures, and resume suspended contexts only. Reproduce closed/interrupted context and transient-load retry failures before changing them. Compare all three narrators' lifecycle and stored preferences. Broader consolidation has a larger Safari regression surface than the bounded fixes shipped here.
2. **Accessible Addition route bounds:** in Chromium, clicking the center of the accessible ten-route GROUP hit the one-route plate because the groups' geometry bounds overlap. Actual ten-plate taps and keyboard handler work. Investigate focus/activation bounds before changing road geometry.
3. **Actual iPhone Safari:** verify initialization after a fresh load, background/foreground recovery, mute/retry, slow/failed loading and mermaid alignment. Large 99+99 Quest captions may need scrolling; there is no evidence yet that this warrants a layout change.

Subtraction Play is deliberately silent in current code/README/tests. Its silence is an existing design choice, not an unimplemented dependency. Investigate consistency within the user's goal before introducing a new narration contract.

## Exact next recommended action
The layout-stable audio-wait fix is released in both environments. Resume the prioritized audio-lifecycle investigation above: create a failing controlled regression for closed/interrupted Quest contexts and failed preload followed by retry, then select the smallest coherent shared fix across affected consumers. Preserve spoken plans, highlighting and the reserved-space audio-wait visibility rule. Keep new work in `test/`; verify, record and commit before promotion. Actual Safari remains a stated verification limit.
