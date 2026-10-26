# G$tick Golf: beta round 6 report

**Build:** `tempo-golf.html` (333,645 bytes); site build `df56fc3623` (the hash in `sw.js`). Save key still `tempo-golf-v1`.
**Sources changed:** `game.js` and `game.src.html`, then `build.py`. `engine.js` is byte-identical to round 5.
**Live:** https://thazerk12.github.io/gstick-golf/ (see "Publishing" at the end).
**Files:** `gstick-golf-round6-screens.zip` (the screenshots named below, by task) and `gstick-golf-round6-results.zip` (the raw JSON). The tests are in `test/` in the repo.

**How it was tested:** headless Chromium with a software GPU (SwiftShader), 390×844 at DPR 2 unless noted. Frames are stepped by hand on a simulated clock and touches are synthetic pointer events sent to whatever element is under the finger. "R5" is the round 5 build (main at `42c3752`), "R6" is this build. The test sizes have no notch: the iPhone's insets are not in any measurement.

Nothing here was measured on a phone. These numbers say nothing about how it feels or looks on the iPhone.

## Read this first: what I chose where the brief couldn't all be met

**1. The long clubs leave the screen early in the downswing (Task 3c).** At the reference scale the screen is about ±1.6 m wide at the ball (Standard, 390 wide). In our swing the club reaches farthest to the left *after* the top, when the arms are about level and the wrists are still hinged, so the shaft points up the swing plane. For the driver that point is about 2.8 m from the ball, 90 px past the left edge.
- I set the 7-iron at **13.2%** of the height, the bottom of the 13–16% range (14.2% was my first try). That keeps the whole club on screen through **98–100% of downswing frames for 7I to LW**, at both sizes.
- The longer clubs don't make it: **DR 26%, 3W 28%, 4H 35%, 5I 59%, 6I 75%** of downswing frames have the whole club on screen. The whole club is on screen at address and in the last frames before impact (for the driver, about the last 3 frames, 50 ms).
- Keeping the driver's whole downswing on screen needs the camera about 1.5× further back. Then the driver spans about 9% of the height and the real ball is ~3.7 px; 7 px would need 1.9×, over the 1.5× cap. A per-club camera for the woods would also break "other clubs by their real length".
- Ways to fix it in a later round: a tighter or steeper drawn swing plane for the woods and long irons, or accept a farther camera (smaller club and ball) for them. Both change earlier rounds' work, so I didn't.

**2. Close is 1.4× bigger, so less of the downswing fits (Task 3d).** Close keeps the whole club on screen through 18–39% of downswing frames (every club). That follows from the 1.4× scale.

**3. The aim coasts on top of the round 5 turn (Task 2c).** A 100 px drag turns the aim **14.90° at release, the same as round 5** (0.0026 rad/px). The coast then adds up to **3.0°** for a 300 ms drag and at most **4.8°** for a fast flick (capped at 1.4 rad/s), and nothing if the finger stops before lifting. It stops 0.30 s after release.

**4. The look button hides while the view moves (my choice, Task 2e / 3e).** It sits on the right edge at the horizon. The far end of a leaning beam and the landing spot during the camera's arrival after a shot both pass there: in the first audit the landing ring went under it for 7 frames (23 px). So it shows once the address camera has settled and the beam has faded, and always in look mode.

**5. With the Landing guide off the beam runs 40 m** (round 5's guide-off line length), so it doesn't give the carry away. With it on, the beam runs to the full-power landing spot and ends in the yellow ring.

**6. The camera button is a pill above the pause button.** At 360 px wide the bottom bar has no room for a fourth round button. The pill shows the preset's name and only shows at address (it would sit next to the contact toast in flight otherwise).

**7. The slope grid needs a depth bias in look mode.** From 25–40 m up, the grid (12 mm above the drawn green) lost the depth test to the green itself and didn't show. In look mode only, it's drawn with a polygon offset; at address it's drawn exactly as in round 5.

## Summary against "done when"

| Task | Check | Result |
|---|---|---|
| 1 | Readout matches the window in Chromium | **Yes**: window, `#app`, screen and visual viewport all 390×844, renderer 390×844 at pixel ratio 2 (canvas 780×1688) |
| 1 | Window 62 px taller after load | **No gap**: window, `#app`, screen, visual viewport and the game all 390×906, both canvases fill it (780×1812), page height 906, no scroll |
| 1 | iPhone cause | WebKit bug 301108 (iOS 26 home-screen apps with a translucent status bar). Not verified on a phone. See Task 1 |
| 2 | Gesture table, 14 spots × 8 directions | **112/112 as specified**: straight down swings, every other direction aims, from every spot including over each top card. ±35° swings, ±40° aims. A tap does nothing |
| 2 | Button taps | Club ‹ ›, map, camera, look, pause: **all work** |
| 2 | Power at 20%, 50%, 70% of the height | 50% → **0.500**, 100% → **1.000** from all three. From 85% a full pull doesn't fit: power stops at **0.597** |
| 2 | swing2 / swing4, same finger path, R5 vs R6 | **40/40 and 108/108 identical** (power, path, tempo); same fire frame and first ball frame in all 108 |
| 2 | 100 px aim drag | **14.90°** at release (R5 14.90°); ball's screen x moves **0.00 px**; coast stops at **0.30 s** |
| 2 | Look mode (DR tee, 7I fairway, putt) | Fly in **0.90 s**, back **0.52 s**; aim and club unchanged; ball back within 0.06 px |
| 2 | Map taps | **0 of 4** changed aim or club; drag pans, pinch zooms |
| 2 | Presets, round 1–5 saves | Screenshots below; all five saves load with **Standard** and 0 changed fields |
| 3 | Framing, Standard | Ball **50.0% / 66.4%**, **7.05 px** (factor 1.37 at 390, 1.24 at 430), horizon **50.5%**, 7I **13.2%** |
| 3 | Whole club in the downswing (swing4 paths, 60 Hz) | 7I–LW **98–100%**; DR–6I 26–75% (see "Read this first" 1) |
| 3 | Close / High | Close: club 1.4× (7I 18.5%), ball in place. High: horizon **37.5%**, ball in place. Aim runs straight up in all; nothing covers the ball |
| 4 | Pull % → flat roll at stimp 8.5 / 10.5 / 12.2 | **Identical** to within 1 mm (e.g. 50% → 5.99 m at all three) |
| 4 | 2.0 m vs 2.1 m | **Same** speed and roll (R5: 1.20 m vs 2.40 m flat roll for the same pull) |
| 4 | Strokes of 0.2, 0.5, 0.8 s | **Same** ball speed (R5: 2.99, 2.66, 1.76 m flat roll) |
| 4 | Capture grid | **51/72** (engine unchanged) |
| 5 | Strip vs shot data, 10 shots | **10/10 match** (speed, power, back, through, tempo; putts power in ft and through) |
| 5 | Label at rest | **Within 0.5 yd** of the real total on all 8 full shots (rounding); putts within 0.4 ft |
| 5 | Play column vs strip and label | **0 px** at 390×844, 430×932 and 360×780; the label stays ≥ 5.7 px clear of the ball |

## 1. What changed, with line ranges (game.js unless noted)

### Task 1: fill the screen
- `game.src.html` 31–38: in standalone display mode only, `html { min-height: min(100lvh, calc(100% + env(safe-area-inset-top))) }`; a hidden `#safeProbe` reads the four insets.
- 126–145 `resize()`: one measured size (`#app`'s client size) for the renderer, the FX canvas and the game (swingLen, gestures and HUD read the same `VW` / `VH`); it reruns on window resize, orientation change, visual-viewport resize and a ResizeObserver on `#app`.
- 1947–1961 `sizeInfo()` / `sizeInfoDirty()`, `game.src.html` 184 and 542: Pause → Perf shows the readout (display mode, window, `#app`, screen, visual viewport, the four insets, device pixel ratio, renderer pixel ratio, canvas size).

### Task 2: gestures, beam, look, map, camera button, chevron
- 3018–3236 input: `pressDecide` (10 px, 35°), `onDown` / `onMove` / `onUp`, `startSwing` (replays the press's samples into the unchanged swing code, now `swingMove`), the aim drag and coast (`startAimDrag`, `aimDragTo`, `endAimDrag`, `stepAimCoast`), map and look pan / pinch (`viewDown`, `viewMove`, `viewUp`, `viewPan`), wheel. The swing zone, `mapAim` and the map hint are gone.
- 2686–2691 `stepCamYaw` / `addrYaw`: the address camera's yaw springs to the aim. 2724–2747 `addressCam` holds the camera on its target once it has arrived. 1749: the club turns with the camera's yaw.
- 223–229 the beam material; 2316–2366 `updateAimVisuals` / `drawBeam`: the beam replaces the always-on aim line and the live landing ring.
- 2755–2805 look mode (`lookSpot`, `lookTarget`, `lookCam`, `toggleLook`); 3337–3348 the marker; 2598–2614 the grid and dots when the green is on screen (with the look-mode depth bias).
- 2712–2723 `mapTarget` (pan and zoom); 3260–3280 `toggleMap`, `cycleCam` and the button wiring.
- 3319–3323 `chevronAt`, and the chevron in `drawFX` (3374–).
- 2189–2192 `addrReset` (called from `startHole` and `nextShot`).
- `game.src.html`: the top cards and the strip pass touches through (73); look, fast-forward and camera buttons (407–427, CSS 145–155); map hint removed.

### Task 3: camera
- 2636–2685 `ADDR` (one Standard camera for every club), `CAM_PRESETS`, `camPreset`, `solveDown`, `addrFor(ci, preset)`, `puttCam` with presets (the putt ball stays where Standard puts it); 2694–2711 `addrTarget`; 2748–2754 `addrHorizonY`.
- 2440–2441 `addrBallK`, used in `updateBallVisual`: the address ball is drawn at least 7 px, up to 1.5×.

### Task 4: putting
- 1973–1978 `puttRoll`, `puttPull`, `fmtFt`, `smashFor`; `takeShot` (2067–2149: one curve, no tempo on putts, the strip's values); `shotEnded` (2151–2188: the long / short toast); `fire` (3183–: tempo 1 on putts); 3483–3498 `updatePowerCard` (flat roll and last putt); `updateHUD` (3499–: the club button shows the full-pull roll).

### Task 5: flight
- 3349–3373 `drawDistLabel`; 3432–3482 `hudVis`, `fillStats`; 2840–2860 `hudTopBottom` and `flightTilt` count the strip and the label.
- `game.src.html` 128–144 and 399–405: the strip (`#hudStats`, tighter under 380 px wide); 410: the fast-forward button.

### Version label and test hook
- `game.src.html` 456: "Round 6". `window.__tempo` (3848–) adds `gesture`, `pressDecide`, `look`, `lookLast`, `lookMarker`, `toggleLook`, `toggleMap`, `cycleCam`, `camPreset`, `addrHorizonY`, `addrBallK`, `chevronAt`, `puttRoll`, `puttPull`, `fmtFt`, `updateHUD`, `stats`, `distLabel`, `beamOn`, `beamT`, `aimCoast`, `camYaw`, `smashFor`, `sizeInfo`, `size`. `swingZone` is gone.

## 2. Tests and numbers

### Task 1: the screen (`test/screen6.js`)
At 390×844, DPR 3 (like the iPhone), on load the readout says: display browser; window, `#app`, screen and visual viewport **390 × 844**; insets 0 (no notch in Chromium); device 3, renderer 2 (capped at 2, as before), canvas **780 × 1688**. The GL and FX canvases and `#app` all measure 0, 0, 390, 844 and the game's own size is 390 × 844.

Then the window was made **62 px taller** after load (390 × 906). Everything followed: window, `#app`, screen, visual viewport and the game's size 390 × 906, canvas 780 × 1812, both canvases 0, 0, 390, 906, the page's scroll height 906, scrollY 0. (In headless SwiftShader the resize event waits for the menu's render loop; it arrived 13.9 s later. That's the test machine, not the game.)

Chromium can't emulate `display-mode: standalone` (the media query stays false) or an inset, so I applied the rule's body by hand with a 62 px inset: `min-height: min(906px, 100% + 62px)` → the document is exactly 906 tall, scroll height 906, and it doesn't scroll (scrollY stays 0 after `scrollTo(0, 500)`). Screenshot of the readout: `perf_readout_390x844.png`.

**What I think the iPhone cause is (inference, from two independent sources, not tested on a phone).** WebKit bug 301108: on iOS 26, a home-screen web app with `apple-mobile-web-app-status-bar-style: black-translucent` and `viewport-fit=cover` gets a layout viewport one status bar shorter than the screen (62 pt on this phone), and the strip under it isn't painted. The page fills that short viewport (so `#app`, which is `position: fixed; inset: 0`, is 62 pt short) and the strip shows black. Two open-source projects fixed it with the same rule I used (frappe-ui PR #1289, Safe-Sips PR #17); the `100lvh` cap keeps the page from scrolling (WebKit 316008). The rule only applies in standalone mode, so Safari and the claude.ai artifact are unaffected. "Looks scaled up" I can't pin down from here: it may be round 5's close, wide camera (replaced this round), or the canvas stretched to a size its buffer wasn't drawn at. The Perf readout will show which: the window, `#app` and screen heights should all match the phone (874 on a 402×874 screen), and the canvas should be 2× the window (the renderer is capped at 2×). A mismatch in either is the cause.

### Task 2: gestures (`test/gest6.js`, `test/look6.js`, `swing2.js`, `swing4.js`)
**Gesture table** (60 px moves in 10 px steps; S = swing started, A = aim drag):

| Press at | N | NE | E | SE | S | SW | W | NW |
|---|---|---|---|---|---|---|---|---|
| above ball (195, 500) | A | A | A | A | S | A | A | A |
| on ball (195, 560) | A | A | A | A | S | A | A | A |
| below ball (195, 620) | A | A | A | A | S | A | A | A |
| lie card (101, 32) | A | A | A | A | S | A | A | A |
| pin card (101, 84) | A | A | A | A | S | A | A | A |
| wind card (101, 136) | A | A | A | A | S | A | A | A |
| hole card (285, 42) | A | A | A | A | S | A | A | A |
| left edge (3, 560) | A | A | A | A | S | A | A | A |
| right edge (387, 620) | A | A | A | A | S | A | A | A |
| sky (195, 304) | A | A | A | A | S | A | A | A |
| near pause (42, 750) | A | A | A | A | S | A | A | A |
| near club arrow (86, 790) | A | A | A | A | S | A | A | A |
| near map (346, 748) | A | A | A | A | S | A | A | A |
| near look (306, 426) | A | A | A | A | S | A | A | A |

Every press went to the game's touch layer (the top cards pass it through). Boundary from 40 px under the ball: −40° A, −35° S, −30° S, 0° S, +30° S, +35° S, +40° A. A press with no movement: no aim change, no club change, still at address.

**Power from different heights** (7-iron, pull then a flick through the start line; swingLen 211 px at 844):

| Start | 50% pull | 100% pull |
|---|---|---|
| 20% (y 169) | 0.500 | 1.000 |
| 50% (y 422) | 0.500 | 1.000 |
| 70% (y 591) | 0.500 | 1.000 |
| 85% (y 717) | 0.500 | 0.597 (the pull stops at the bottom edge after 126 px) |

R5 couldn't start a swing at 20% or 50% (those were aim presses).

**Same finger path, R5 vs R6** (`Y0FROM`: each run starts on the line R5's zone gave it, 560 px driver, 655 px 7-iron): swing2 40/40 and swing4 (60 Hz) 108/108 shots identical in power, path, tempo and flick angle; all 108 fire on the same frame and the ball first moves on the same frame. Peak shaft bend 155.6 mm vs 155.7 mm on the driver (the club's backswing starts 10 px later; the shot doesn't use it).

**Aim drag** (pressed in the sky):

| Drag | At release | After the coast | Coast | Stops after | Ball x moves |
|---|---|---|---|---|---|
| DR, 100 px right in 300 ms | −14.897° | −17.856° | −2.96° | 0.30 s | 0.00 px |
| DR, 100 px left in 300 ms | +14.897° | +17.856° | +2.96° | 0.30 s | 0.00 px |
| DR, 100 px in 100 ms | −14.897° | −19.677° | −4.78° | 0.30 s | 0.00 px |
| DR, 100 px, held 200 ms, then up | −14.897° | −14.897° | 0 | — | 0.00 px |
| 7I, 100 px in 300 ms | −14.897° | −17.856° | −2.96° | 0.30 s | 0.00 px |
| Putter, 100 px in 300 ms | −6.303° | −7.555° | −1.25° | 0.30 s | 0.00 px |

R5, same drags: −14.897° (putter −6.303°), no coast, ball x 0.00 px.

**Look mode** (`look6.js`):

| | Fly in | Fly back | Marker | Grid / dots | HUD | Pan / pinch | Pull down in look | Aim, club after |
|---|---|---|---|---|---|---|---|---|
| DR, tee | 54 frames (0.90 s) | 31 frames (0.52 s) | "D · 108 yd to pin" | on / on | hidden except look | moved / zoom 1 → 0.5 | no swing | unchanged; ball within 0.06 px |
| 7I, fairway | 0.90 s | 0.52 s | "7I · 7 yd to pin" | on / on | same | same | no swing | unchanged |
| Putt | 0.90 s | 0.52 s | — (whole green) | on / on | same | same | no swing | unchanged |

**Map** (7-iron, fairway): 4 taps at different spots changed neither aim nor club; a one-finger drag moved the view 32 m; a pinch zoomed to the clamp; no hint. **Beam:** none at rest; on while dragging; still on 0.3 s after release; gone 1.05 s after; on for putts.

**Buttons** (tapped at their centres through hit-testing): club ‹ and › change the club, map on and off, camera Standard → High → Close → Standard, look on and off, pause and resume.

**Presets and saves** (`savecompat6.js`): round 1 and 2 shaped saves, and saves written by the round 3, 4 and 5 builds with a round in progress, load with 0 changed fields; the only setting added is `cam: 'std'` (plus `guide` / `perf` on the round 1–2 shapes, as before). Continue resumes at the right hole with the same scores, the camera button says Standard and the camera is Standard's (9.61 m back). No errors.

### Task 3: framing (`test/frame6.js`)
Ball x / y, drawn size (factor over real), horizon, the club's height on screen at address (grip end to head), and the share of downswing frames (the club's down and commit phases through the contact frame) with the whole club on screen. Downswing runs: swing4's finger paths (T 120 / 200 / 300 ms, a 500 ms hold, drift +20 / −50 px) at start phases 0 and 8 ms, from the chevron's start line, 60 Hz: 12 runs and 153 downswing frames per row. First value 390×844, second 430×932.

**Standard**

| Club | Ball x / y | Ball px (factor) | Horizon | Club height | Whole club on screen, downswing frames |
|---|---|---|---|---|---|
| DR | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.4% · 13.4% | 40/153 (26%) · 39/153 (26%) |
| 3W | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.1% · 13.1% | 43/153 (28%) · 43/153 (28%) |
| 4H | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.0% · 13.0% | 54/153 (35%) · 53/153 (35%) |
| 5I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.2% · 13.2% | 90/153 (59%) · 90/153 (59%) |
| 6I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.2% · 13.2% | 114/153 (74%) · 113/153 (74%) |
| 7I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.2% · 13.2% | 150/153 (98%) · 150/153 (98%) |
| 8I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.2% · 13.2% | 153/153 (100%) · 153/153 (100%) |
| 9I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.1% · 13.1% | 153/153 (100%) · 153/153 (100%) |
| PW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.1% · 13.1% | 153/153 (100%) · 153/153 (100%) |
| GW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.1% · 13.1% | 153/153 (100%) · 153/153 (100%) |
| SW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.1% · 13.1% | 153/153 (100%) · 153/153 (100%) |
| LW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 50.5% · 50.5% | 13.0% · 13.0% | 153/153 (100%) · 153/153 (100%) |

**Close**

| Club | Ball x / y | Ball px (factor) | Horizon | Club height | Whole club on screen, downswing frames |
|---|---|---|---|---|---|
| DR | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.8% · 18.8% | 28/153 (18%) · 28/153 (18%) |
| 3W | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.4% · 18.4% | 30/153 (20%) · 30/153 (20%) |
| 4H | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.2% · 18.2% | 31/153 (20%) · 31/153 (20%) |
| 5I | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.5% · 18.5% | 42/153 (28%) · 42/153 (28%) |
| 6I | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.5% · 18.5% | 42/153 (28%) · 42/153 (28%) |
| 7I | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.4% · 18.4% | 43/153 (28%) · 43/153 (28%) |
| 8I | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.4% · 18.4% | 43/153 (28%) · 43/153 (28%) |
| 9I | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.4% · 18.4% | 49/153 (32%) · 46/153 (30%) |
| PW | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.4% · 18.4% | 51/153 (33%) · 51/153 (33%) |
| GW | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.4% · 18.4% | 54/153 (35%) · 54/153 (35%) |
| SW | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.3% · 18.3% | 55/153 (36%) · 55/153 (36%) |
| LW | 50.0 / 66.5% · 50.0 / 66.5% | 7.22 (1.00) · 7.97 (1.00) | 50.5% · 50.5% | 18.3% · 18.3% | 60/153 (39%) · 60/153 (39%) |

**High**

| Club | Ball x / y | Ball px (factor) | Horizon | Club height | Whole club on screen, downswing frames |
|---|---|---|---|---|---|
| DR | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.5% · 13.5% | 40/153 (26%) · 39/153 (26%) |
| 3W | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.1% · 13.1% | 42/153 (28%) · 43/153 (28%) |
| 4H | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.0% · 13.0% | 50/153 (33%) · 50/153 (33%) |
| 5I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.1% · 13.1% | 70/153 (46%) · 68/153 (44%) |
| 6I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.1% · 13.1% | 89/153 (58%) · 92/153 (60%) |
| 7I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.1% · 13.1% | 114/153 (74%) · 115/153 (75%) |
| 8I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.1% · 13.1% | 153/153 (100%) · 151/153 (99%) |
| 9I | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.0% · 13.0% | 153/153 (100%) · 153/153 (100%) |
| PW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.0% · 13.0% | 153/153 (100%) · 153/153 (100%) |
| GW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.0% · 13.0% | 153/153 (100%) · 153/153 (100%) |
| SW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 13.0% · 13.0% | 153/153 (100%) · 153/153 (100%) |
| LW | 50.0 / 66.4% · 50.0 / 66.4% | 7.05 (1.37) · 7.05 (1.24) | 37.5% · 37.5% | 12.9% · 12.9% | 153/153 (100%) · 153/153 (100%) |

In every row the ball is under no HUD box and points 10, 30 and 100 m down the aim line sit at the ball's x (0.0 px): the aim runs straight up.

**Putts in each preset** (6 m putt): close: ball 50% / 75.4%, horizon 33.5%; std: ball 50% / 75.4%, horizon 33.5%; high: ball 50% / 75.4%, horizon 8.6%.

**Screenshots:** `std_{DR,7I,SW}_{address,top,transition,impact}.png`, `preset_{close,std,high}_{DR,7I,PT}_address.png`. **Rounds 4, 5 and 6 at address** (`grass6.js`): `grass_DR_side_by_side.png`, `grass_7I_side_by_side.png`, each with a 2× crop of the grass just in front of the ball. Cameras: R4 3.3 m back, 2.0 m up, FOV 43 (ball 78% across); R5 2.5–3.5 m back, 0.8–1.1 m up, FOV 64; R6 9.6 m back, 1.1 m up, FOV 40.

**Popups and the band:** toasts and popups still sit at top inset + 166 px. The band runs from the cards' bottom (158 px at 844) to the horizon (426 px at 844; 316 px in High). The contact toast is in the low slot in flight, as round 5.

### Task 4: putting (`test/putt6.js`, `test/capture4.js`)
**Pull → flat roll** (the game's curve through `E.puttSpeed`, rolled by the engine on a flat green to a stop):

| Pull | Target | Stimp 8.5 | Stimp 10.5 | Stimp 12.2 |
|---|---|---|---|---|
| 10% | 0.24 m | 0.237 | 0.237 | 0.237 |
| 25% | 1.50 m | 1.495 | 1.495 | 1.495 |
| 50% | 6.00 m | 5.992 | 5.993 | 5.993 |
| 75% | 13.50 m | 13.490 | 13.490 | 13.490 |
| 100% | 24.00 m | 23.987 | 23.987 | 23.988 |
| 112% | 30.11 m | 30.091 | 30.092 | 30.092 |

**Same 40% pull from different distances** (real green, stimp 10.1): R6 2.043 m/s from 2.0, 2.1, 3 and 6 m (3.83 m flat roll each). R5: 1.142 m/s from 2.0 m (1.20 m), 1.615 m/s from 2.1 and 3 m (2.40 m), 2.085 m/s from 6 m (3.99 m).

**Stroke time** (50% pull, then an upstroke of 0.2 / 0.5 / 0.8 s, real gesture): R6 tempo 1, 1, 1; struck at 2.554 m/s each (5.99 m flat roll). R5: tempo 1, 0.94, 0.77; 2.99, 2.66, 1.76 m.

**HUD:** the club button shows **79 ft** (the full-pull roll). While pulling 45%: the card shows **16 ft** and, smaller, **last 9 ft**. A putt 30% short of 5 m: toast "**6 ft short**"; 30% long: "**2 ft long**" (measured along the start-to-cup line: −1.90 m and +0.73 m on that slope).

**Capture grid:** 51/72 (R5 51/72; the engine is unchanged). `round4.js`, `round.js`, `cup.js`, `shots.js` and `swingsim.js` now putt with the game's curve (`puttPull`).

### Task 5: flight (`test/strip6.js`, `test/ui6.js`)
**Strip vs shot data** (real gesture, 10 shots):

| Club | Strip | From the shot | Label at rest | Real total |
|---|---|---|---|---|
| DR | Speed 99mph · Power 100% · Back 0° · Through 0° · Tempo OK | 65.61 m/s ÷ 1.48 = 99 mph; 100%; β 0°; φ 0°; tempo × 1 | 265 yd | 264.58 yd |
| DR | Speed 88mph · Power 85% · Back 8°R · Through 4°L · Tempo OK | 58.45 m/s ÷ 1.48 = 88 mph; 85%; β 7.9°; φ -4.3°; tempo × 1 | 235 yd | 234.86 yd |
| 3W | Speed 86mph · Power 90% · Back 6°L · Through 3°R · Tempo OK | 55.98 m/s ÷ 1.45 = 86 mph; 90%; β -6°; φ 2.7°; tempo × 1 | 217 yd | 216.88 yd |
| 5I | Speed 81mph · Power 100% · Back 0° · Through 0° · Tempo SLOW | 49.13 m/s ÷ 1.35 = 81 mph; 100%; β 0°; φ 0°; tempo × 0.9175 | 179 yd | 179.49 yd |
| 7I | Speed 65mph · Power 75% · Back 4°R · Through 8°R · Tempo OK | 39.04 m/s ÷ 1.35 = 65 mph; 75%; β 3.6°; φ 8°; tempo × 1 | 133 yd | 133.24 yd |
| 9I | Speed 74mph · Power 105% · Back 3°L · Through 5°L · Tempo OK | 44.64 m/s ÷ 1.35 = 74 mph; 105%; β -2.6°; φ -4.7°; tempo × 1 | 145 yd | 144.99 yd |
| PW | Speed 51mph · Power 60% · Back 0° · Through 2°R · Tempo OK | 28.3 m/s ÷ 1.25 = 51 mph; 60%; β 0°; φ 2°; tempo × 1 | 78 yd | 77.7 yd |
| SW | Speed 37mph · Power 50% · Back 8°R · Through 0° · Tempo OK | 20.82 m/s ÷ 1.25 = 37 mph; 50%; β 8.1°; φ 0°; tempo × 1 | 45 yd | 45.25 yd |
| PT | Power 10ft · Through 2°R | pull 35% → 10 ft flat roll; φ 2.4° | 13 ft | 12.61 ft |
| PT | Power 24ft · Through 3°L | pull 55% → 24 ft flat roll; φ -2.5° | 32 ft | 31.98 ft |

Speed = launch ball speed ÷ smash (driver 1.48, woods 1.45, hybrids 1.40, irons 1.35, wedges 1.25). (My first strip log classed PW–LW as woods because their names end in W; fixed and re-run.) Back = the finger's angle from the press to the lowest point; Through = the flick's angle (right +).

**Play column** (`ui6.js`, every frame from address through flight, against every visible HUD box, the strip, the toast, the popup, the camera pill, the look and fast-forward buttons): **0 px** overlap in every state at all three sizes: aim (92 frames, including the camera arriving after the hole intro and after a shot), swing, impact and flight for a drive, a PURE 7-iron, a full SW, a 25 m PW chip and an 8 m putt. In flight the ball's highest point on screen was 186 / 205 / 173 px (drive, 390 / 430 / 360 wide) with the strip's bottom at 56 px, so the flight tilt never had to act. The distance label was never closer than **5.7 px** to the drawn ball, and never overlapped the strip or a button. One transient card at a time, as in round 5. (The audit ran before a last CSS change that makes the strip's values 18 px instead of 20 so "109 mph" fits; the strip's height, 46 px, didn't change.)

The first audit found one overlap: the landing ring passed under the look button for 7 frames (23 px) while the camera arrived after the hole intro. That's why the look button now waits for the view to settle (see "Read this first" 4); after that change: 0 px.

**Flight screenshots** (`flight6.js`, 390×844, real gesture): `flight_{DR,7I,chip25m,putt8m}_{mid,rest}.png`.

| Shot | Strip in flight | Label in flight | Label at rest | Real total |
|---|---|---|---|---|
| Drive | Speed 99 mph · Power 100% · Back 3°R · Through 2°L · Tempo OK | 68 yd | 265 yd | 241.93 m = 264.6 yd |
| 7-iron | 76 mph · 95% · 3°L · 3°R · OK | 43 yd | 158 yd | 144.32 m = 157.8 yd |
| 25 m chip (PW, 20%) | 29 mph · 20% · 0° · 0° · OK | 9 yd | 25 yd | 23.28 m = 25.5 yd |
| 8 m putt | Power 28 ft · Through 1°R | 11 ft | 36 ft | 10.91 m = 35.8 ft |

The fast-forward button shows in flight and is gone at rest in all four. The audit (`ui6.js`) also has every round 5 state at three sizes: intro, aim, pull, overswing, flight, rest toast, PURE, wedge / chip / putt in flight and at rest, penalty, BIRDIE / PAR / BOGEY, the map (no hint), pause, card, results.

### Regressions
- **Performance (`perf.js`, 6× CPU throttle, 390×844 DPR 2):** no errors. One more shader program (22 vs 21: the beam's), compiled before the first swing; none are added during play.

| | R5 | R6 |
|---|---|---|
| Section entries over 4 ms (render excluded) | 60 | 39 |
| Worst single section | 28.5 ms (`drawFX`, settle) | 14.5 ms (`drawFX`, flight) |
| `drawFX` p95 / max | 2.7 / 28.5 ms | 1.7 / 14.5 ms |
| `updateTracer` p95 / max | 2.9 / 13.6 ms | 2.1 / 10.3 ms |
| `updateAimVisuals` p95 / max | 3.6 / 12.1 ms | 1.9 / 8.3 ms |
| `updateHUD` p95 / max | 2.0 / 2.9 ms | 5.9 / 6.3 ms (2 calls over 4 ms, at the two address transitions) |
| `takeShot` max | 11.0 ms | 10.9 ms |
| Control (a fixed block of JS every frame): frames over 4 ms | 53 of 1,892 | 31 of 1,924 |

  The control dropped from 53 to 31 with the same work, so the machine was quieter for the R6 run and I don't read the lower R6 numbers as a speedup. What I can say: nothing new stands out. My first R6 run (before two fixes) had 88 entries over 4 ms against a control of 50; `drawFX` was the main one (the distance label drew its text twice with a blur), and `updateHUD` once took 32 ms (it read the HUD cards' layout to place the look button). The label now draws once and the look button's position comes from `FEEL.look.btnY`, with no layout read.
- **Saves (`savecompat6.js`):** see Task 2: round 1–5 saves load unchanged with the Standard camera; Continue resumes.
- **Tour event through the real screens (`round4.js`, putting with the new curve):** six holes, card after each, results, save written. No page errors.
- **Site (`app4.js`):** service worker active and in control, manifest and all icons and launch screens load, three.js r128 from the site. With the network off the game loads and plays a drive (244.7 m). A newer build replaces the cache on the next online launch. No errors.
- **Shots:** swing2 / swing4 identical to R5 for the same finger paths (Task 2). The capture grid is unchanged (51/72).
- **Every page in every test:** no page errors.

## 3. Not verified
- Anything on a phone: how the gestures, the coast, the beam, look mode, the presets, the putt curve and the strip feel or read.
- The iPhone fix. Chromium can't emulate iOS standalone mode or its inset bug; I tested the rule's effect by hand (a 62 px taller document with no scrolling) and that the game follows the window.
- The insets: no test renders with a notch or a home bar.
- Whether the beam reads as "soft" and leans enough. It leans by however far the camera's yaw lags the aim (camOmega 9: about 0.16 rad behind during a 200 ms, 100 px drag).
- Two-finger pinch on a real screen: tested with synthetic pointers only.
- The live site: this sandbox can't load github.io (see Publishing).

## 4. iPhone try-list
1. **Fill the screen:** open the home-screen app, Pause → Perf on, screenshot the readout. Is the black strip gone? The window, `#app` and screen heights should all be 874 (402×874), safe top 62.
2. **Ten aims and swings from different places,** including over the top cards, the sky, near the buttons and low on the screen: does a sideways drag ever start a swing, or a pull down ever aim? Does the coast feel like a little settle or like drift?
3. **Look and map on three holes:** fly in and out, pan, pinch. Does the marker read? Is the grid visible from above? Does anything you do there change your aim or club?
4. **Each preset with DR and 7I:** Close, Standard, High. Which do you keep? Does the driver leaving the screen early in the downswing bother you (see "Read this first" 1)?
5. **Twenty putts from 1–15 m:** after a few, can you predict the roll from the card's ft number? Do "3 ft long" / "1 ft short" help?
6. **The strip, the label and fast-forward on five full shots:** readable at a glance? Does the label ever cover the ball? Does holding fast-forward work?

## 5. New or changed values

### ADDR
| Value | Round 6 | Round 5 |
|---|---|---|
| `club` (every club) | back 9.61, up 1.119, down −1.263, FOV 40 | per club: back 2.15–3.47, up 0.68–1.10, down 4.19–4.40, FOV 64 |
| `ballY` | 0.665 (ball 66.5% down, used to solve `down`) | — |
| `ballMinPx`, `ballMaxK` | 7 px, 1.5 | — (real size at address) |
| `preset.close.k` | 1/1.4 (camera distance) | — |
| `preset.high.horizonY` | 0.375 | — |
| `puttHighK` | 1.7 (putting camera height in High) | — |
| `ahead`, `fov0`, `putt` | unchanged (30, 52, round 4 putting camera) | same |

### FEEL
| Value | Round 6 | Round 5 |
|---|---|---|
| `swingZone` | len 0.25, lenMin 140, lenMax 260 (swingLen only) | + below 0.04, minH 0.12 (the zone) |
| `gesture` | decidePx 10, swingDeg 35 | — |
| `aim` | sens 0.0026, puttSens 0.0011, velWin 0.08 s, coastMax 1.4 rad/s, coastTau 0.06 s, coastT 0.3 s, camOmega 9 | 0.0026 / 0.0011 in code |
| `beam` | holdT 0.6 s, fadeT 0.3 s, alpha 0.4, fadeTo 0.25, w0 0.25 m, wK 0.03, wMax 6 m, step 1.2 m, lift 0.08 m, start 0.35 m, inMax 4 m, lenNoGuide 40 m, puttPast 0.5 m, puttMax 30 m, puttW 0.09 m, puttStep 0.15 m, puttLift 0.012 m | aim line in code |
| `look` | inT 0.9 s, outT 0.5 s, back 30 m, up 24 m, ahead 8 m, FOV 52, panK 1, panMax 160 m, zoomMin 0.5, zoomMax 2.2, puttBack 1.4, puttUp 2.0 (× green radius), gridBias [−4, −40], btnY [0.3, 0.62] (the look button's centre, as a share of the height) | — |
| `hint` | chev 9, bob 3, below 0.05, fitPad 8 px, textShots 3 | chev 9, bob 3 (words for 12 shots, in code) |
| `putt` | dMax 24 m | — (puttMax steps 3–44 m by distance) |
| `stats.smash` | driver 1.48, wood 1.45, hybrid 1.40, iron 1.35, wedge 1.25 | — |
| `label` | gap 6 px, h 16 px, font 14 px, restT 1 s, fadeT 0.4 s | — |

### PALETTE and CSS
- PALETTE unchanged. The beam is `PALETTE.cream`; the always-on aim line (white) and the live landing ring (white) are gone. The look marker and label use cream, green and green2.
- CSS: `#hudTop` and `#hudStats` pass touches through; `.hud-stats` / `.scard` (9 px labels, 18 px values; 16 px and tighter spacing under 380 px wide); `.rbtn.look` (52 px, green when on); `.rbtn.ff` (44 px, top inset + 64 px); `.campill` (34 px tall, 92 px above the bar's bottom); `.sizeinfo`; `#maphint` removed. All colours from the existing variables.
- Save: `settings.cam` ('close' | 'std' | 'high'), default 'std'.

## Deviations from the brief
1. **The driver to 6-iron leave the screen in part of the downswing** (Task 3c). See "Read this first" 1.
2. **The 7-iron spans 13.2%**, the low end of 13–16%, for the irons' downswing.
3. **The aim coasts after release,** so a fast 100 px drag ends up to 4.8° past round 5's turn (same at release).
4. **The look button hides** until the address view has settled and the beam has faded.
5. **With the Landing guide off, the beam runs 40 m** rather than to the landing spot.
6. **The camera button is a pill above pause,** not a fourth round button in the bar, and shows only at address.
7. **The grid has a depth bias in look mode** so it can be seen from above.

## Publishing
- Menu label "Round 6". Pushed to `claude/round-6` and merged into `main` as one "Round 6" commit (a squash-merged pull request, because this sandbox can only push `claude/*` branches). The branch is left in place: the sandbox can't delete branches. No tag.
- The Pages deploy and the live build hash (`df56fc3623` in `sw.js`) are confirmed through GitHub's records, not by loading the site: this sandbox can't reach github.io. The confirmed outcome is in the project copy of this report (`claude/beta-round-6-report.md`).
- The claude.ai artifact is updated as the fallback.
