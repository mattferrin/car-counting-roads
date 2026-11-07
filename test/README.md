# Test games

This folder is the independent test version of the car and mermaid games. Make experimental game changes here. Keep all game assets local to this folder.

Stable: https://mattferrin.github.io/car-counting-roads/

Test: https://mattferrin.github.io/car-counting-roads/test/

Do not change the root production game files unless explicitly asked to promote a tested release. Preserve the static test banner and stable-game escape link.

Run node test/test.cjs and node test/test-themes.cjs from the repository root.
## Cancellation Quest

A subtraction game for Ayan and Aliya: cancel the same amount from both sides until the second side reaches zero, and what is left is the answer. Every car/mermaid is one real object in rows of ten; counts are spoken in tens and ones, never fused number names.

- Play: `cancellation-quest.html` (cars) or `cancellation-quest.html?theme=mermaids`
- Try one: `cancellation-quest.html?a=84&b=27`
- Run `node test/cancellation-quest.test.cjs` from the repository root.

## Alignment and narration

Cancellation Quest now uses `cancellation-layout.js`, a pure coordinate/identity
projection of the engine solution. Survivors keep their DOM nodes. Tens leave
from the top; pools compact, then gold ones descend to the blue tail. Matching
ones shift right while unmatched blue ones stay in place. The empty slots that
open between these runs show the removed pairs; there are no separate boxes.

The cancellation first shows in place: the matching objects light up in
their aligned positions for a beat — the amount is not announced — then the
real objects lift off together — one whole group per side, never a partial
row — and fly down to the landmark the kid just tapped, arriving together
to collide and explode there (burst, shockwave, boom, whoosh, sparkle trails
on big moves, vibrate). Only then do the survivors slide up together to
take their place. The counting afterwards still names the new totals, tens
then ones.

When the blue ones are insufficient, one ten remains open in the shared tail;
up to 18 individual ones wrap across two ten-column rows. Counts retain their
canonical numeral/place-value caption. This keeps borrowing cases exact without
hiding or duplicating units. The 999 URL limit is retained; large values scroll.

Progression phases are ready → narrating → moving → narrating/celebrating →
ready/complete. All progression controls share this lock. Recorded fragments
advance on AudioBufferSourceNode `ended`; fallback utterances highlight on
`start`/`boundary` and advance on `end`/`error`. Each spoken fragment
highlights the objects it names — "two tens" glows the two tens themselves,
"seven ones" glows the seven ones — and the answer is highlighted whole
first, then its tens, then its ones. Mermaid objects are the 🧜‍♀️ emoji from
the theme picker. An eight-second failure watchdog
stops failed playback and switches to silent play, with a retry-sound button.
Muting and hiding the tab release pending audio. No timer estimates word timing.

Checks:
- `node test/cancellation-layout.test.cjs`
- `node test/cancellation-quest.test.cjs`
- `npm install --prefix /tmp/cq-test-deps jsdom`
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-ui.test.cjs`
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-flight.test.cjs`
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-highlight.test.cjs`
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-map.test.cjs` (3 cases: map spread, nav, mechanics)

Map layout (2026-11-06): the four landmarks are pins on a map now, not
a staggered row — Volcano low on the left, Castle up top, Magic Tree low
in the middle, Car Wash up on the right, on a taller 300px map with
dashed paths winding between them. Only the positions changed (CSS) and
the scenery moved into the open gaps; the mechanics are untouched — the
flight code reads each landmark's rect at tap time, so it is
position-agnostic, and the map test proves a tap still cancels there.

The UI suite simulates completion/error events; actual iOS voice/output latency
still needs a device check. Both original game suites must also pass in root and
`test/`. Only Cancellation Quest files and this README are changed.

## Addition Quest

An addition game for Ayan and Aliya, the sibling of Cancellation Quest:
move the smaller side over to the bigger side — tens first, then ones —
until the smaller side reaches zero, and what is left is the answer.
The total never changes. Panels keep the problem's own order (left =
first addend, right = second), so the move goes right-to-left for
47+26 and left-to-right for 26+47. Every object is one real car/mermaid
in rows of ten. The grid has a fixed R = floor(total/10)+1 rows: tens
stack from the top and the ones row is bottom-anchored at the same
height in both pools, so a one-move slides across the bottom row into
the next free square. A ten-move inserts a whole new row at the top of
the destination (y = 0) and the rows below slide down to make room; a
one-move that fills the ones row regroups it into a new ten just above
the ones row. Flights stay full-size into their slots — no shrinking
or fading. The tap target is a place on the map — Volcano, Castle,
Magic Tree, Car Wash (mermaids: Coral Reef, Palace, Whirlpool, Giant
Shell), staggered in the open space of a taller 300px map with dashed
paths between them — or the central Move button (its arrow flips with
the direction) or the glowing group in the smaller pool. Whichever is
tapped, the moving group flies there, loops once all the way around it
(~400ms), bursts with that place's fx, then carries on to the bigger
side. No new voice clips: it reuses the Cancellation Quest recordings in
`audio/`, with the same changed-place-only counting, per-fragment glow,
and no pre-move amount announcement. The answer flies from the larger
panel into the "?" and a big celebration banner — large cheer plus a
large pulsing New Mystery button — appears directly under the sticky
equation bar; it is the only New Mystery button on the page. The
bigger/smaller panel badges are sized to match their words: "bigger"
renders at 18px, "smaller" at 12px, "same size" at 14px, following the
badges as they swap sides between problems.

Rendering rule (live defect, 2026-11-06): never animate `transform`
on a positioned `.obj`. The first deployed version gave the movable
group a `nudge` animation whose keyframes set `transform: scale(...)`;
a running CSS animation overrides the inline `translate()` that
positions each object, so every movable object collapsed to the grid
origin and a whole ten rendered as one car (26 showed as 17, 6 as 5).
The movable pulse now animates `filter` (brightness + glow) only.

- Play: `addition-quest.html` (cars) or `addition-quest.html?theme=mermaids`
- Try one: `addition-quest.html?a=47&b=26` (and `?a=26&b=47` for the mirror)
- Run `node test/addition-quest.test.cjs` from the repository root.

Checks:
- `node test/addition-quest.test.cjs` (576,631 checks, exhaustive 0..100)
- `node test/addition-layout.test.cjs` (83,861 states)
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/addition-ui.test.cjs` (27 cases)
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/addition-rendered.test.cjs` (59 cases: rendered counts == labelled counts at every state, ones bottom-anchored in both pools, no transform animation on `.obj`, full-size three-phase flights with waypoint orbits and fx bursts, map spread, banner placement, badge sizes)

Only Addition Quest files, `test/index.html` (one home-page card and the
game-nav wording), and this README are changed. Production files are
untouched.

## Navigation & themes

Every entry point in test/ carries the same controls in the same spots,
so a child or parent moving between pages finds them without thinking:

- **Test banner** (top of every page, same inline markup): "🧪 Test
  version · Daddy's workshop" + "Play the stable games →" (links to
  `../`). The banner is the stable-games escape everywhere.
- **Back home** (top of the content, `nav.game-nav`): "← Back to test
  games" → `index.html`. The original game's game-view link says the
  same thing now ("⌂ Home" renamed). The two Quest pages also repeat
  the back link in the footer.
- **Footer** (Quest pages): "← Back to test games · Stable games" +
  the test note. The original game has no footer; its banner and
  game-nav carry both escapes.
- **Theme pills + sound toggle**: in the sticky equation bar on both
  Quest pages, same order, same behaviour (🚗 Ayan / 🧜‍♀️ Aliya pills,
  🔊 Sound on toggle). The original counting game has no spoken
  narration, so it has no sound toggle; its theme is chosen from the
  home cards (and by `?theme=`), which is a property of that game, not
  an inconsistency to fix.

Palettes are defined once per theme and shared by both Quest games —
the two stylesheets' `:root` tokens are identical:

- **Cars** (blue/gold, light sky): page `#bfe3ff`; left `--left #1668d6`,
  right `--right #c98a04`; tens `#1668d6`, ones `#e8710a`, hundreds
  `#7c4dff`; ink `#22303c`, card white.
- **Mermaids** (teal/pink, sea): page `#2e8fb5` (mid-tone sea blue —
  the old dark `#0e4d6e` was a dark slab next to the light sky, so it
  was lightened to match the cars page in visual weight while staying
  clearly sea); left `--left #1668d6`, right `--right #d63384`; same
  tens/ones/hundreds, ink and card as cars. The mermaid landscape keeps
  its deeper sea gradient for depth.

The two themes are distinctive (sky vs sea, gold vs pink) but balanced:
same white cards, same digit colours, same button and banner styles, no
theme drastically darker or louder than the other. One-off colours that
only existed on one page were removed; the remaining page-specific
colours are the landscape gradients and the page backgrounds above.

Left open for a follow-up (deliberately not done here): the original
counting game's palette (`#1264a0` blue / `#885500` gold, light grass
and aqua) predates the Quest tokens and differs from them where the
same roles appear. Recolouring it would visibly change the game the
kids already play, so it stays as-is until Matt says otherwise.
