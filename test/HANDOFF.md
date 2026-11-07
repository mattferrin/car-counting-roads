# Counting Worlds — continuation checkpoint (2026-11-07, final)

## State and authority
Base: mattferrin/car-counting-roads main, e92af18107417157ae84c48222726d02466ff07b.
All changes are LOCAL, UNCOMMITTED, UNPUBLISHED. Matt approves exact changes before publication. Work only in test/. Root production must remain byte-identical. Do not infer deployment from this bundle. Check current remote before applying; another agent may have advanced it.

## Actual implementation in this bundle
- 16 generated storybook landmark illustrations in test/art/landmarks/ (256px PNGs, one per landmark, warm cream rounded-square medallions, consistent style). They replaced the hand-drawn SVG first pass, which read as childish. Both Quest JS files render these through decorative img elements inside the existing landmark buttons (28×28 medallion, 8px corner radius). Accessible names, landmark IDs, click handlers and flight targets remain unchanged.
- test/storybook.css is loaded after both game stylesheets: shared cream landmark treatment, quieter backgrounds, equation-bar skin, proper teal identity colour for mermaid left side. Digit place colours remain blue/orange/purple.
- The theme toggle is one segmented control bar (cream track, both children keep their own colour in both states: soft blue tint for Ayan when selected, soft teal tint for Aliya, quiet grey when not — no solid fill, icons never inverted to white silhouettes). The old solid-fill selected pill clashed with its pale neighbour; that rule is gone from both game stylesheets.
- Image display footprint is 28 × 28 CSS px in a rounded medallion. SVG viewBox is 96 × 88. Responsive image fitting intentionally keeps the silhouette within the available box.
- Quest HTML CSS/JS query versions bumped together to v=5 (was v=4; bumped again because this round changed the CSS, JS and art). Audio never versioned.
- test/visual-review.html embeds actual Quest pages in four 390 × 844 CSS-pixel frames. It is a manual QA aid, not a screenshot or Safari emulator.
- Original games/homepage have NOT been reskinned. Counting characters, arithmetic engines, layout engines, audio and mechanics untouched.

## This round's changes on top of the recovered bundle (2026-11-07)
- **Layout round (CSS only, both Quest stylesheets):** Defect 1 — the sticky equation bar used to cover the above-strip landmarks at max scroll; the bar is now static and slimmed, so the strip is never covered (measured 0px overlap at max scroll). Defect 2 — the post-move caption sat below the fold; eqbar, panels, caption bar and celebration banner all slimmed, progress line reserves no height at load/solved, so the caption now fits at load, after move 1, AND at solved with the moved tally kept. Defect 6 — at solved every landmark sat at .55 opacity permanently; now full opacity with muted saturation when the banner shows.
- **Art refine (4 SVGs only):** wreck (tilted hull, stern under a wave, snapped mast, floating plank), turtle (separated head with eye, flippers, enlarged scutes), wash (real car shape with windows/wheels/roof foam inside the arch), track (bigger checkered flag + tiny red car). The other 12 icons are untouched. The wreck's mast-break is sub-pixel at 1× — it reads as "boat falling over" rather than "boat".
- **Verification done this round (real browser, not just JSDOM):** all 14 suites pass on the final tree (counts match VALIDATION.txt). 390×844 renders + numeric measurements in `~/workspace/counting-worlds/shots/after/layout/` (load / after-move1 / solved / 99+99, both games × both themes, plus max-scroll) and `shots/closeout/` (independent re-measurement, numbers agree). Caption bottoms at 47+26: load 681/697, after move 1 702/718, solved 826/842 (mermaids/cars) — all inside the 844 fold. No horizontal overflow anywhere. 73 SVG objects at 47+26, 0 emoji objects.
- **Button round (2026-11-07, ?v=5):** landmark art replaced with 16 generated storybook PNG icons (256px, cream medallions); theme pills rebuilt as one segmented bar (soft tints, no solid fill, no icon inversion); banner button padding trimmed 10→8px and toggle track padding 3→2px to buy back the 6px the new track cost. Verified: all 14 suites pass; 390×844 renders + measurements in `~/workspace/counting-worlds/shots/buttons/` — caption bottoms at 47+26: load 689/697, after move 1 710/726, solved 822/838 (mermaids/cars) — all inside the 844 fold; all 8 PNGs load per game (256px); no horizontal overflow. Headless-Chromium note: real WAAPI moves stall intermittently in headless (the compositor sometimes never advances a flight, so `flight.finished` never resolves — also seen pre-existing, not caused by this work); the solved renders were made with `Element.prototype.animate` stubbed to instant-resolve, which changes only animation timing, not final layout. On a real phone the flights run normally. A favicon 404 appears in console on every load (no favicon file) — harmless.
- **Known limits:** 99+99 load still has the caption below the fold (916/956) — inherent to 9-row panels, not a regression. Headless-Chromium move playback is flaky around voice counting (synthetic clicks leave the AudioContext suspended; real mouse clicks work; muted play works) — a harness artifact, not a product defect; the game's own 27-case UI suite passes and real taps are unaffected.

## Honest quality assessment
The painted concept is an art target, NOT an implemented background. Current SVG landmarks replace platform emoji with consistent, deterministic artwork, but remain a relatively simple first pass. Do not call them equivalent to the rich concept. Real-browser visual QA at 390×844 is now done (renders + measurements above); iPhone Safari QA is still outstanding. Do not confuse the JSDOM rendered-count suite with screenshot tests: it does not measure actual CSS layout.

## Run and review
Serve repository root with `python3 -m http.server 8000` and visit `/test/visual-review.html`.
On an actual iPhone open the individual Quest pages, not the iframe review sheet. Check both themes at 47/26, 26/47, 99/99, zero, equal values, after first move and at completion. Confirm caption visibility, no clipped art, no sticky-header overlap, and that tapping the art still sends units to the correct landmark.

Tests need Node and jsdom. Install jsdom OUTSIDE the repo and set NODE_PATH to that node_modules directory. Run test.cjs and test-themes.cjs in root AND test/, plus all test/*.test.cjs with cwd=test/. See VALIDATION.txt for the last full run. Do not upload QA dependencies.

## Next consequential work, in order
1. Visually inspect real pages on an iPhone. Matt reported Safari mermaid vertical alignment; screenshot has not yet been supplied. Do not diagnose from assumption.
2. After Quest approval, extend shared visual identity to original games/homepage in test/. Preserve all routes, rows of five, individual-unit visibility, max parameter and themes. Avoid refactoring legacy mechanics just for cosmetic changes.
3. Package exact changes for Matt/Muse, obtain approval, then let them upload. Verify deployed test separately. Production stays untouched.
4. Aliya must judge mermaid art before permanent shipment.

## Invariants
Addition transfers smaller to bigger, tens then ones. Cancellation removes equal units from both; both fly together to chosen landmark and burst there. Landmark-only moves. Continuous spline. Preserve problem order, badges, New Mystery gating and answer resting state. Never transform-animate positioned counting objects. Existing boy/girl recordings; no pre-move count announcement. Aliya must judge mermaid art before permanent shipment.

## User priorities
Highest practical artistic quality, working website progress over repeated concept generation, efficient use of remaining usage, portable handoff. Ask one question at a time. End with a concise keep-going/stop judgment. No publishing without approval.
