# Holiday effects — how to turn them on, off, and add a new holiday

Test only. Nothing in this system touches production, game logic, art,
buttons or icons, and it never replaces an existing effect — it adds
its own sparkle alongside. Two files do all the work:

- `holiday-effects.js` — the switch, the holiday packs, and the hooks.
- `holiday-effects.css` — all visuals, scoped under `body[data-holiday]`.

Every game page (home + Addition Play in `index.html`, both Quests,
Subtraction Play in `cancellation-garage.html`) loads both files.
The test suite is `holiday-effects.test.cjs` (8 cases, same jsdom
pattern as the other suites).

## Turn Christmas off / on

One line, in `holiday-effects.js` at the top:

```js
var ACTIVE_HOLIDAY = 'christmas';  // on
var ACTIVE_HOLIDAY = null;         // off — the script does nothing
```

That is the whole toggle. With `null` the script installs no snow, no
observers, no sound, and the stylesheet is inert because every rule
needs `body[data-holiday]`, which is never set. Push that one-line
change and the effects are gone everywhere. (You can also test it live
from the browser console: `HolidayFX.init(null)` turns it off for that
page load; `HolidayFX.init('christmas')` turns it back on.)

## What Christmas does, and where the eye goes

- **Everywhere (ambient):** slow snowfall (14 flakes, fewer on narrow
  screens) + a twinkle-light garland along the top edge. Both are
  `pointer-events: none`, so they can never block a tap.
- **Your turn (Quests):** at `data-phase="ready"` the landmark strip
  gets a soft gold/green halo and the "?" gets a dashed gold outline —
  the next tap, and the goal.
- **Every move (Quests):** two extra ❄️/✨ flakes ride the game's own
  arrival burst, flying the same direction.
- **A new ten regroups (Quests):** a 12-flake snowfall (the page
  already shakes + booms; this rides on top).
- **Solved (Quests):** a 36-flake snowfall of ❄️🎄⭐✨🎁, a festive
  glow on the answer bar and celebration banner, and a short
  synthesized Jingle Bells chime — only when the page says sound is
  on. No audio files were added.
- **Play games:** no solve moment exists, so landing on a multiple of
  10 (a real ±1/±10 move) gets a 16-flake snowfall + chime if sound
  is on. In the Subtraction garage, reaching exactly 0 (both sides
  equal) celebrates too. Subtraction Play is deliberately silent, so
  it gets visuals only, never a jingle.
- **Reduced motion:** no snow, no lights, no bursts, no glow
  animation — checked in JS and in CSS.

## Add a holiday (e.g. Valentine's Day)

1. In `holiday-effects.js`, add one pack to `PACKS`:
   ```js
   valentines: {
     snowChar: '\u2764',                 // ambient falling character
     moveChars: ['\u2764\uFE0F', '\u2728'],
     solveChars: ['\u2764\uFE0F', '\uD83C\uDF39', '\u2B50', '\u2728'],
     jingle: [ /* notes in Hz, 0 = rest */ ],
     jingleStep: 0.16
   }
   ```
2. In `holiday-effects.css`, copy the `body[data-holiday="christmas"]`
   block, change the name to `valentines`, and pick its colours
   (garland dots, ready glow, solved glow).
3. Change the switch: `var ACTIVE_HOLIDAY = 'valentines';`
4. Add cases to `holiday-effects.test.cjs` (switch-on for the new
   pack is the important one) and run the suites.

## How it hooks in (for the next person debugging this)

The script only observes DOM signals the games already produce —
no game file was edited:

- `body[data-phase]` → `celebrating` means solved (the only place
  the Quests set that phase).
- A `.burst` / `.arrival-burst` span appearing means a move landed;
  the holiday sparkle copies its position and `--dx`/`--dy`.
- `.page` gaining `.shake` means a ten regrouped.
- `#total` changing means a Play move happened; only ±1/±10 deltas
  count, so capacity changes and resets never celebrate.

## Deploy note

New files start at `?v=1` in the four HTML pages. The repo's rule
still applies: bump `?v=` on all local assets together on a deploy
so a phone never mixes cached old files with new ones.
