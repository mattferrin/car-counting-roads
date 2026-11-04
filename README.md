# Car Counting Roads

A small, touch-friendly math playground. Drive cars between a Blue garage and a Gold garage, add cars from the left, and let cars leave on the right.

- Twelve connected SVG roads: 1, 5, or 10 cars in each direction.
- Road symbols and parked cars are grouped in fives.
- Upper roads go Blue → Gold; lower roads go Gold → Blue.
- Transfers preserve the total. Entry and exit change it.
- The equation stays visible while scrolling.
- Up to 20 cars by default. Append `?max=50` or `?max=100` to the game URL to change the limit. Whole numbers from 10 through 100 are supported; other values fall back to 20. Every parked car has its own symbol. Garages grow taller in rows of five. In every mode, impossible roads are faded and inactive.
- Reset returns to 5 Blue + 5 Gold, including during an animation.
- Keyboard support: Tab to a road and press Enter or Space. Reduced-motion settings are respected.

Static HTML, SVG, CSS, and JavaScript. No dependencies, external images, analytics, or build step. The map is present in HTML even if JavaScript is unavailable; driving requires JavaScript.

## Run and check

Serve this directory with a static web server. Run `node test.cjs` for exhaustive movement-rule checks across every valid state and all twelve roads.

## Publish

GitHub Pages serves `main` / `(root)`. Changes to the root files deploy automatically. The implementation refines the supplied connected-road starter, keeping its two-garage layout and twelve road actions.

## Two counting worlds

The repository homepage is a game chooser with large links for 20, 50, and 100.

- `?theme=cars&max=20`: Ayan’s Car Game.
- `?theme=mermaids&max=100`: Aliya’s Mermaid Game.
- Existing `?max=50` links still open the car game.
- Missing/unknown themes on game links use cars; missing/invalid maximums use 20.
- Home links and assets are relative, including under `/car-counting-roads/`.

Both themes use the same SVG map and `game.js` movement/rendering logic. Theme-specific copy and symbols are selected once; `themes.css` supplies the underwater scenery and homepage presentation. Individual characters remain in rows of five, and both destinations grow vertically as needed. The unchanged base URL now opens the chooser.

Run `node test-themes.cjs` to check both themes across every supported maximum from 10–100, every valid state, all twelve actions, and invalid/default parameter handling (over four million cases).
