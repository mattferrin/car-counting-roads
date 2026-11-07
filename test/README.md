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
