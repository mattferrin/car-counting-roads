# Car Counting Roads

A small, touch-friendly math playground. Drive cars between a Blue garage and a Gold garage, add cars from the left, and let cars leave on the right.

- Twelve connected SVG roads: 1, 5, or 10 cars in each direction.
- Road symbols and parked cars are grouped in fives.
- Upper roads go Blue → Gold; lower roads go Gold → Blue.
- Transfers preserve the total. Entry and exit change it.
- The equation stays visible while scrolling.
- Up to 20 cars in the whole map; impossible roads are faded and inactive.
- Reset returns to 5 Blue + 5 Gold, including during an animation.
- Keyboard support: Tab to a road and press Enter or Space. Reduced-motion settings are respected.

Static HTML, SVG, CSS, and JavaScript. No dependencies, external images, analytics, or build step. The map is present in HTML even if JavaScript is unavailable; driving requires JavaScript.

## Run and check

Serve this directory with a static web server. Run `node test.cjs` for exhaustive movement-rule checks across every valid state and all twelve roads.

## Publish

GitHub Pages serves `main` / `(root)`. Changes to the root files deploy automatically. The implementation refines the supplied connected-road starter, keeping its two-garage layout and twelve road actions.
