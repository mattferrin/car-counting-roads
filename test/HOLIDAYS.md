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

- **Everywhere (ambient):** slow snowfall + a twinkle-light garland
  along the top edge. Both are `pointer-events: none`, so they can
  never block a tap. During play the snow falls *behind* the panels
  and the equation bar — visible around the edges and between the
  landmarks, never over the maths. On the chooser page it still falls
  over the top, since there is no maths to cover there. The brief
  solve/regroup snowfalls stay above: they are rewards, not weather.
- **Your turn (Quests):** each landmark button gets one tiny
  twinkling Christmas light at its top edge, in the garland's
  colours, lit only while it is the kids' turn. The button they tap
  flashes its light. The "?" keeps a dashed gold outline — the goal.
- **Every move (Quests):** two extra flakes (❄️/🎄) ride the game's
  own arrival burst, flying the same direction.
- **A row collides or a ten regroups (Quests):** the game's double
  burst becomes a Christmas explosion — extra 🎄🎅⛄🦌🎁🛷🧝🔔🍬🍪
  flakes at the burst point, a snowfall, and a two-note bell chime
  (sound-on only). Single moves stay small; only the big maths
  moments explode.
- **Solved (Quests):** a 36-flake snowfall from the Christmas list,
  a little Christmas tree pops up beside the answer while the banner
  shows, a festive glow on the answer bar and celebration banner, and
  a short synthesized Jingle Bells chime — only when the page says
  sound is on. No audio files were added.
- **Play games:** no solve moment exists, so landing on a multiple of
  10 (a real ±1/±10 move) gets a 16-flake snowfall + chime if sound
  is on. In the Subtraction garage, reaching exactly 0 (both sides
  equal) celebrates too. Subtraction Play is deliberately silent, so
  it gets visuals only, never a jingle.
- **Reduced motion:** no snow, no lights, no bursts, no topper, no
  glow animation — checked in JS and in CSS.

## The Christmas vocabulary (the no-star rule)

Every particle this layer adds comes from one list: snowflake ❄️,
Christmas tree 🎄, Santa 🎅, snowman ⛄, reindeer 🦌, present 🎁,
sleigh 🛷, elf 🧝, bell 🔔, candy 🍬, cookie 🍪. No generic stars
(⭐) or sparkles (✨) anywhere — a five-pointed yellow star could
just be a star to a kid. The test suite enforces this list
(`holiday-effects.test.cjs`, case 9).

Two honest stand-ins: there is no candy-cane emoji in Unicode, so
wrapped candy 🍬 stands in for candy canes; no gingerbread emoji
either, so a cookie 🍪 stands in for gingerbread. Christmas lights
are CSS dots (the garland, the landmark lights), not emoji — no
Christmas-lights emoji exists. The games' own bursts keep their own
characters (💥⭐✨); this layer only ever adds Christmas ones.

Icicle / snow borders were considered and skipped for now: on a
390px-wide phone a border risks eating play space and covering
tappable areas. If one is ever wanted, the safe version is a thin
snow strip on the chooser page only.

## Promotion (2026-11-12)

Promoted to production 2026-11-12, same rule as every promotion:
everything except the mermaid. Root `holiday-effects.js` and
`holiday-effects.css` are byte-identical to test; the four root HTML
files carry the same two holiday lines (`holiday-effects.css?v=1`,
`holiday-effects.js?v=1`); root keeps Classic E
(`art/classic-e-mermaid.png`) and production titles — no Berry Star
anywhere in root. `holiday-effects.test.cjs` stays in test/ only;
the root suites (test.cjs, test-themes.cjs, all *.test.cjs) run with
the holiday layer wired in and pass.

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
  the Quests set that phase). The tree topper appears then and leaves
  when the phase returns to `ready` for the next problem.
- A `.burst` / `.arrival-burst` span appearing means a move landed;
  the holiday sparkle copies its position and `--dx`/`--dy`. A
  second batch at the same host within 300ms means a whole row
  collided or a ten regrouped: the Christmas explosion.
- `#total` changing means a Play move happened; only ±1/±10 deltas
  count, so capacity changes and resets never celebrate.

## Deploy note

New files start at `?v=1` in the four HTML pages. The repo's rule
still applies: bump `?v=` on all local assets together on a deploy
so a phone never mixes cached old files with new ones.
