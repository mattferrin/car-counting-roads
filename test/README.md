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
in rows of ten; a ten-move inserts a whole new row just above the
destination's ones, and a one-move that fills the ones row regroups it
into a new ten. The tap target is the central Move button (its arrow
flips with the direction) or the glowing group in the smaller pool.
No new voice clips: it reuses the Cancellation Quest recordings in
`audio/`, with the same changed-place-only counting, per-fragment glow,
and no pre-move amount announcement. The answer flies from the larger
panel into the "?" and New Mystery appears only after completion.

- Play: `addition-quest.html` (cars) or `addition-quest.html?theme=mermaids`
- Try one: `addition-quest.html?a=47&b=26` (and `?a=26&b=47` for the mirror)
- Run `node test/addition-quest.test.cjs` from the repository root.

Checks:
- `node test/addition-quest.test.cjs` (576,631 checks, exhaustive 0..100)
- `node test/addition-layout.test.cjs` (83,861 states)
- `NODE_PATH=/tmp/cq-test-deps/node_modules node test/addition-ui.test.cjs` (26 cases)

Only Addition Quest files, `test/index.html` (one home-page card), and
this README are changed. Production files are untouched.
