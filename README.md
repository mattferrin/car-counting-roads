# Car Counting Roads

A small, touch-friendly math playground for kids. Drive cars (Ayan) or mermaids (Aliya) between two sides, add and take away, and solve addition and subtraction quests.

Live: https://mattferrin.github.io/car-counting-roads/

## Games

- **Addition Play** (`index.html`): the home chooser and the free-play map. Drive cars/mermaids between the Blue and Gold sides over connected roads and tunnels, up to 20 by default (`?max=50` or `?max=100`).
- **Addition Quest** (`addition-quest.html`): move the smaller pile into the bigger one, tens first then ones, until one side is empty. The total never changes.
- **Subtraction Quest** (`cancellation-quest.html`): cancel the same amount from both sides until one side is empty. What is left is the answer.

Switch between cars and mermaids with the theme toggle in the equation bar; sound has its own separate toggle. Every object is one real car/mermaid in rows of ten; counts are spoken in tens and ones.

Moves are made by tapping a landmark — eight per theme in two strips hugging the panels (Castle, Magic Tree, Sunny Hill, Race Track above; Volcano, Car Wash, Gas Station, Bridge below; mermaids: Palace, Whirlpool, Turtle Rock, Dolphin Cove above; Coral Reef, Giant Shell, Shipwreck, Treasure Chest below).

Static HTML, SVG, CSS, and JavaScript. No dependencies, external images, analytics, or build step. Voices are local MP3 clips in `audio/boy/` and `audio/girl/`; the 100 edge ("ten tens") falls back to device speech.

## Run and check

From the repository root:

- `node test.cjs` and `node test-themes.cjs` — Addition Play engine and themes
- `node counting-layout.test.cjs` and `node counting-voice.test.cjs`
- `node addition-quest.test.cjs` and `node addition-layout.test.cjs`
- `node cancellation-quest.test.cjs` and `node cancellation-layout.test.cjs`
- `NODE_PATH=<jsdom install>/node_modules node addition-ui.test.cjs addition-rendered.test.cjs cancellation-ui.test.cjs cancellation-highlight.test.cjs cancellation-map.test.cjs cancellation-flight.test.cjs`

## Subtraction Play and live limits

The home page now offers Addition Quest, Addition Play, Subtraction Quest and
Subtraction Play. Quests follow steps; Play lets children explore.

Subtraction Play (`cancellation-garage.html?theme=cars|mermaids&max=20|50|100`)
uses stacked garages and mirrored matching pairs to show positive, zero and
negative differences. Eight roads let children add, remove and transfer ones
or tens. It is intentionally silent. Garages grow with their contents, with
a minimum height that keeps roads clear of neighboring buttons.

Both Play games share a sliding 20/50/100 capacity selector. Lowering the limit
dissolves excess objects into embers and smoke, then updates the equation.
Addition limits the total; subtraction limits each garage independently.
Reduced motion skips the effect. Addition retains narration for normal moves.

Current release status, verification, shared consumers and remaining work:
[test/HANDOFF.md](test/HANDOFF.md). The test environment remains under `test/`.

Additional checks: `node cancellation-garage.test.cjs`,
`NODE_PATH=<jsdom install>/node_modules node cancellation-garage-ui.test.cjs`,
and `NODE_PATH=<jsdom install>/node_modules node play-capacity.test.cjs`.
