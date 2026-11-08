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
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-ui.test.cjs` (41 cases: duplicate taps, identity, speech highlights, locks, completion, banner placement, failures)
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-flight.test.cjs`
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-highlight.test.cjs`
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/cancellation-map.test.cjs` (3 cases: map spread, nav, mechanics)

Map layout (2026-11-06, round 4): eight landmarks in two compact
strips hugging the panels — four above, four below — as tight as
possible, not scattered around the page. The original four (Castle /
Palace, Magic Tree / Whirlpool, Volcano / Coral Reef, Car Wash / Giant
Shell) are joined by four new ones per theme — cars: Sunny Hill,
Race Track, Gas Station, Bridge; mermaids: Turtle Rock, Dolphin Cove,
Shipwreck, Treasure Chest — each with its own art, name, hint and fx.
Each strip is a flex row, so the four cards share the width; the sky
strip above the equation bar is gone, and so is the scenery that used
to sit in the strips' open gaps. Only the positions changed (CSS + which
strip each landmark is built into); the mechanics are untouched — the
flight code reads each landmark's rect at tap time, so it is
position-agnostic, and the map test proves a tap still cancels there.
Cancellation Quest's celebration is the same big banner Addition Quest
has: directly under the sticky equation bar, the only New Mystery
button on the page. The top back-home nav row is gone too (round 4) —
the back link lives in the footer now, so nothing crowds the equation
and the top strip.

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
or fading. The tap target is a place on the map — eight of them, in
two compact strips hugging the panels: Castle, Magic Tree, Sunny Hill,
Race Track above, Volcano, Car Wash, Gas Station, Bridge below
(mermaids: Palace, Whirlpool, Turtle Rock, Dolphin Cove above, Coral
Reef, Giant Shell, Shipwreck, Treasure Chest below). There is no Move
button and no source tap — landmarks are the only move trigger. Whichever place is
tapped, the moving group flies there in one smooth continuous swoop — a
single spline that loops once around the place as part of the same curve
and flows on into the bigger side, bursting with that place's fx as it
reaches the loop. No new voice clips: it reuses the Cancellation Quest recordings in
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
The movable invite is gone entirely in round 3 — the landmarks carry
the only tap invite now, with their nudge — so no transform-animating
keyframes may ever apply to a positioned `.obj` again, and no
`.movable` selector may reappear.

- Play: `addition-quest.html` (cars) or `addition-quest.html?theme=mermaids`
- Try one: `addition-quest.html?a=47&b=26` (and `?a=26&b=47` for the mirror)
- Run `node test/addition-quest.test.cjs` from the repository root.

Checks:
- `node test/addition-quest.test.cjs` (576,631 checks, exhaustive 0..100)
- `node test/addition-layout.test.cjs` (83,861 states)
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/addition-ui.test.cjs` (27 cases)
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/addition-rendered.test.cjs` (59 cases: rendered counts == labelled counts at every state, ones bottom-anchored in both pools, no transform animation on `.obj` and no `.movable` left, one continuous spline flight per move with a genuine loop and an fx burst at the loop, eight landmarks in two compact strips hugging the panels, banner placement, badge sizes)

Only Addition Quest files, `test/index.html` (one home-page card and the
game-nav wording), and this README are changed. Production files are
untouched.

## Navigation & themes

Every entry point in test/ carries the same controls in the same spots,
so a child or parent moving between pages finds them without thinking:

- **Test banner** (top of every page, same inline markup): "🧪 Test
  version · Daddy's workshop" + "Play the stable games →" (links to
  `../`). The banner is the stable-games escape everywhere.
- **Back home** (footer): "← Back to test games" → `index.html`. The
  top `nav.game-nav` row is gone (round 4) — the back link lives in
  the footer on both Quest pages, alongside Stable games, so nothing
  crowds the equation and the top strip. The original game's game-view
  link still says the same thing in its own top nav.
- **Footer** (Quest pages): "← Back to test games · Stable games" +
  the test note. The original game has no footer; its banner and
  game-nav carry both escapes.
- **Theme pills + sound toggle**: in the sticky equation bar on both
  Quest pages, same order, same behaviour (🚗 Ayan / 🧜‍♀️ Aliya pills,
  🔊 Sound on toggle). Counting Play carries the same toggle in the
  same spot (see "Counting Play voices and matching highlights" below), so the controls match
  everywhere.

Palettes are defined once per theme and shared by both Quest games —
the two stylesheets' `:root` tokens are identical:

- **Cars** (blue/gold, light sky): page `#bfe3ff`; left `--left #1668d6`,
  right `--right #c98a04`; tens `#1668d6`, ones `#e8710a`, hundreds
  `#7c4dff`; ink `#22303c`, card white.
- **Mermaids** (teal/pink, sea): page `#2e8fb5` (mid-tone sea blue —
  the old dark `#0e4d6e` was a dark slab next to the light sky, so it
  was lightened to match the cars page in visual weight while staying
  clearly sea); left `--left #1668d6`, right `--right #d63384`; same
  tens/ones/hundreds, ink and card as cars. The mermaid strips keep
  their deeper sea gradient for depth.

The two themes are distinctive (sky vs sea, gold vs pink) but balanced:
same white cards, same digit colours, same button and banner styles, no
theme drastically darker or louder than the other. One-off colours that
only existed on one page were removed; the remaining page-specific
colours are the landmark-strip gradients and the page backgrounds above.

Left open for a follow-up (deliberately not done here): the original
counting game's palette (`#1264a0` blue / `#885500` gold, light grass
and aqua) predates the Quest tokens and differs from them where the
same roles appear. Recolouring it would visibly change the game the
kids already play, so it stays as-is until Matt says otherwise.


## Unified Counting Play: roads and tunnels (test only)

The original car and mermaid games keep their connected roads/tunnels, entry from the left, exit on the right, and transfers between the garages/pools. They share the Quest equation bar, place-value colors, approved Candidate M asset, and fixed All games dock.

Eight independent SVG lanes carry one ten or one one: two entry lanes, two exit lanes, two upper left-to-right lanes, and two lower right-to-left lanes. Each lane displays exactly ten or one individual characters. Five-unit actions are rejected. Ten-unit movement is disabled unless at least ten units are available; additions also respect the total capacity. A fresh game starts at 10 on the left and 0 on the right. The third header control is Sound on / Muted, matching the Quests.

Characters follow their selected lane's actual SVG path. Complete tens fill ten-column rows; remaining ones share a baseline across both garages. Garages grow vertically through 100 individual units, and lower lanes move with their bottoms. Survivors slide into alignment after a move. Reduced motion skips travel. Changing themes preserves the quantities.

The chooser uses three roomy game cards, with Ayan/Aliya theme choices for each. Capacity buttons (20/50/100) update the Counting Play links. Existing `index.html?theme=cars|mermaids&max=20|50|100` links continue to work. No theme/max query opens the chooser. Malformed or out-of-range capacities fall back to 20. All navigation and assets remain under test/. Production and the Quest implementations are unchanged.

Validation: `node test/test.cjs`, `node test/test-themes.cjs`, and `node test/counting-layout.test.cjs`. Engine suites cover all valid states across both themes and every capacity from 10–100. Layout checks enforce unique individual unit positions, garage bounds, shared ones alignment, and all 100 units. Browser checks cover 320/390 pixel layouts, actual lane travel, entry/exit, both transfer directions, capacity limits, theme changes, and muting during speech.

## Counting Play voices and matching highlights

Entry announces only the left side (the existing boy recordings); exit announces only the right (the existing girl recordings). A transfer announces left, then right. A ten-unit action says the resulting number of tens; a one-unit action says the resulting number of ones, including zero. Only that place is counted. The 100-unit edge says "ten tens" using device speech because the shared clip set contains tens 0–9. Other counts reuse the existing audio/boy/ and audio/girl/ files unchanged.

The corresponding digit, place-value caption, rows, and individual characters glow for each spoken fragment. Recorded fragments use source start/end; device speech uses start/boundary/end. No timers estimate word timing. The interaction lock includes narration, so counts and highlights cannot overlap another move. Muting or hiding the page stops active speech, clears emphasis, and releases the narration lock; an eight-second failure watchdog offers a sound retry if playback stalls. Sound preference uses the same on/off behavior as the Quests and is saved for Counting Play.

`node test/counting-voice.test.cjs` covers changed-place plans, exact per-side recording paths, voice order, source-end sequencing, mute cancellation, visibility interruption, the 100-unit fallback, and watchdog recovery.

## Addition and subtraction: Quest and Play

The chooser names the four games **Addition Quest**, **Addition Play**,
**Subtraction Quest**, and **Subtraction Play**. Quests follow steps; Play lets
children explore freely. Existing URLs and internal engine names remain stable.

### Subtraction Play (formerly Cancellation Garage)

`cancellation-garage.html?theme=cars&max=20` (or `theme=mermaids`). Blue minus
gold, including negative differences. Stacked garages keep matched objects
mirrored at the zero boundary. Pairs stay visible. Blue excess rises; gold
excess falls. Every object is individually countable, five separated from five
in each row of ten. Each garage has its own 20/50/100 capacity, selected from
this game's chooser card or the shared sliding control below the game.

Eight roads: +10/+1 enter blue; ↑10/↑1 transfer gold to blue; ↓10/↓1 transfer
blue to gold; −10/−1 leave gold. Buttons show the actual one or ten characters,
without landmark pictures. Entry roads descend and turn into blue through
rounded right angles; two nested sideways U roads sit at each side of the
central boundary, with ten outside and one inside. +10/−10 share the left
column at the top/bottom, and +1/−1 share the right column. Exit roads turn
out of gold and descend to the bottom buttons. Road hit areas
sit behind button plates so another road cannot intercept a button tap.

This game is intentionally silent: no sound control, voice module, speech
synthesis, audio initialization, or spoken-count highlighting. There is no
replacement reset control. The workshop banner, help panel, intro and pair-summary text are removed.
The theme switch, equation, objects/roads, shared capacity slider and All games
navigation remain.
Theme changes retain counts and DOM identities. `a` and `b` still set examples.

Checks:
- `node test/cancellation-garage.test.cjs`: 105,944 moves, 1,158,970 individual
  positions, all subtraction examples reachable, bounds, no parked-object
  overlap, mirrored pairs, signed transitions, conservation and immutability.
- `NODE_PATH=/tmp/garage-test-deps/node_modules node test/cancellation-garage-ui.test.cjs`:
  eight buttons with exactly one/ten characters, no audio dependency, duplicate
  taps, 200 objects, signed transitions, themes, identities, consistent chooser
  labels and independent 20/50/100 selections for both free-play games.
- Root and test Counting Play engine/theme suites remain required.

Only test/ changes. Root production games and assets remain unchanged.

### Live capacity and compact Play layouts

Both Play games and their chooser cards share a touch, drag and keyboard
accessible 20/50/100 segmented slider. Increasing the limit preserves objects
and does not reserve unused rows. Garages size to their contents; subtraction
keeps a clear gap between paired and unmatched groups.

Lowering the limit quietly dissolves excess objects into amber embers and
pale smoke, then updates the equation and compacts the layout. Subtraction
clamps each operand independently (100−70 becomes 20−20 at limit 20); addition
clamps the total, removing the newest objects first. Retained objects keep
their identities. Controls lock during removal. Reduced motion skips the
effect. Addition's normal moves retain narration; limit changes are silent.

`NODE_PATH=/tmp/garage-test-deps/node_modules node test/play-capacity.test.cjs`
verifies 100→20 removal, surviving identities, concurrent tap rejection,
compact layout, updated math/URL, keyboard and drag selection, and retained
normal-move narration. The subtraction UI suite also verifies 160 excess
objects dissolve from two full garages at 100→20.

Minimum subtraction garage height is 230 SVG units per side, independent of
the capacity selector. Outer transfer loops sit 82 units from the boundary;
inner loops stay close to it. Entry/exit bends sit farther out, leaving
visible road between buttons and turns. Rendered-path tests require every
road to clear unrelated button plates by at least 9 SVG units (including
room for the road stroke), in addition to rejecting road crossings.
