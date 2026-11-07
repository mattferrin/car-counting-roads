# Car Counting Roads

A small, touch-friendly math playground for kids. Drive cars (Ayan) or mermaids (Aliya) between two sides, add and take away, and solve addition and subtraction quests.

Live: https://mattferrin.github.io/car-counting-roads/

## Games

- **Counting Play** (`index.html`): the home chooser and the free-play map. Drive cars/mermaids between the Blue and Gold sides over connected roads and tunnels, up to 20 by default (`?max=50` or `?max=100`).
- **Addition Quest** (`addition-quest.html`): move the smaller pile into the bigger one, tens first then ones, until one side is empty. The total never changes.
- **Cancellation Quest** (`cancellation-quest.html`): cancel the same amount from both sides until one side is empty. What is left is the answer.

Switch between cars and mermaids with the theme toggle in the equation bar; sound has its own separate toggle. Every object is one real car/mermaid in rows of ten; counts are spoken in tens and ones.

Moves are made by tapping a landmark — eight per theme in two strips hugging the panels (Castle, Magic Tree, Sunny Hill, Race Track above; Volcano, Car Wash, Gas Station, Bridge below; mermaids: Palace, Whirlpool, Turtle Rock, Dolphin Cove above; Coral Reef, Giant Shell, Shipwreck, Treasure Chest below).

Static HTML, SVG, CSS, and JavaScript. No dependencies, external images, analytics, or build step. Voices are local MP3 clips in `audio/boy/` and `audio/girl/`; the 100 edge ("ten tens") falls back to device speech.

## Run and check

From the repository root:

- `node test.cjs` and `node test-themes.cjs` — Counting Play engine and themes
- `node counting-layout.test.cjs` and `node counting-voice.test.cjs`
- `node addition-quest.test.cjs` and `node addition-layout.test.cjs`
- `node cancellation-quest.test.cjs` and `node cancellation-layout.test.cjs`
- `NODE_PATH=<jsdom install>/node_modules node addition-ui.test.cjs addition-rendered.test.cjs cancellation-ui.test.cjs cancellation-highlight.test.cjs cancellation-map.test.cjs cancellation-flight.test.cjs`
