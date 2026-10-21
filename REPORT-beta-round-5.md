# G$tick Golf: beta round 5 report

**Build:** `tempo-golf.html` (295,069 bytes); site build `b6fe72c69e` (the hash in `sw.js`). Save key still `tempo-golf-v1`.
**Sources changed:** `game.js` and `game.src.html`, then `build.py`. `engine.js` is byte-identical to round 4.
**Live:** https://thazerk12.github.io/gstick-golf/ (see "Publishing" at the end for what I could and couldn't confirm).
**Files:** `gstick-golf-round5-screens.zip` (every screenshot named below, as JPEG, by task) and `gstick-golf-round5-results.zip` (the raw JSON). The tests are in `test/` in the repo.

**How it was tested:** headless Chromium with a software GPU (SwiftShader), 390×844 at DPR 2 unless noted. Frames are stepped by hand on a simulated clock and touches are synthetic pointer events. Physics tables run in Node on `engine.js`. "R4" is the round 4 build (main at `40fbc4f`), "R5" is this build. The test sizes have no notch: the iPhone's top and bottom insets are not in any measurement.

Nothing here was measured on a phone. These numbers say nothing about how it feels or looks on the iPhone 17 Pro.

## Read this first: where the brief's targets conflict, and what I chose

**1. The whole club at the top and finish vs. an 8 px ball (Task 1).** With the ball centred on the target line, the club at the top of the backswing and at the finish reaches 1.5–2 m sideways from the ball (the club swings in one tilted plane). An 8 px ball at 390 px wide means the screen is only about 2.1 m wide at the ball, so ±1 m from the centre.
- Measured: showing the whole club at address, top and finish with the ball centred needs the camera 13–22 m back, and the ball drops to **3.5 px (driver) to 5.5 px (LW)**.
- With the ball at ≥ 8 px, no camera I searched (back up to 9 m, up to 8 m, FOV 30–80°) shows even 30% of the shaft at the top or the finish.
- Round 4's "back ≈ 5.35 m → 9.2 px" was for address only. That's where the brief's expectation came from.
- **I kept the 8 px floor and the whole club at address.** At the top and the finish the club is off screen (0% of the shaft visible) on every club. Table below.

**2. "Higher and steeper" vs. the card band under the HUD (Task 1 vs. Task 2e).** The popups move into the band between the HUD cards and the horizon. That band only exists if the horizon sits below the cards. With the ball at 62% down, a steeper look puts the horizon higher on screen.
- Round 4's camera angle (31° above the ball) with the ball at 62% puts the horizon about 17% down at this round's FOV (behind the HUD cards), and above the top of the screen at round 4's FOV of 43°. No band either way.
- I set the horizon at **37.4%** so the band holds even with the iPhone's 62 px top inset (the cards and the popup move down by the inset; the horizon doesn't).
- At FOV 64° that allows a camera **17.5° above the ball**. The camera ends up 0.7–1.1 m up and 2.1–3.5 m back: **lower and closer than round 4** (2.0 m up), not higher.
- The alternative (higher, steeper, horizon behind the HUD) puts the far fairway, the pin and the landing ring for long clubs under the cards and popups. That breaks the "nothing covers the aim line or the landing ring" rule, one of this round's main problems, so I gave the band priority.

**3. Popups in flight (Task 2e).** In flight the ball climbs straight through the band, so a toast there covers the ball.
- The contact toast (PURE, DRAW · OVERSWING…) now sits above the bottom buttons while the ball is in the air. Every other toast and popup uses the band.
- In flight the follow camera also lagged far enough that the ball climbed behind the HUD cards, and on wedges off the top of the screen (round 4 did the same). The camera now tilts up just enough to keep the ball 14 px below the cards, and eases back after (up to 22° on a full SW, 2–4° on a drive).
- The last shot's toast is cleared when the next address starts. It used to linger while the camera moved and crossed the aim line for about 8 frames.

**4. The transition bend can't be seen from the player's camera (Task 4).** At the top and the start of the downswing the clubhead is off screen (see 1), in round 4 as well as round 5. I report the on-screen numbers and the projected ones. Impact is on screen and passes.

**5. The green relief makes a bank at the fringe (Task 5).** With w = 1 on the green and 0 at the fringe's outer edge, the green's edge moves by 1.5 × its height difference from the cup. Across tiers that's 0.37–0.84 m on average (up to 1.2 m), and the fringe carries all of that back to zero in 1–2 m: a drawn ramp of 50–100% at its steepest. A chip landing on the low side's fringe drops visibly faster for its last ~0.1 s as it meets the lowered drawn surface. Details in Task 5. `FEEL.green.relief` lowers it.

## Summary against "done when"

| Task | Check | Result |
|---|---|---|
| 1 | Ball x / y, every full club, 390×844 and 430×932 | **50.0% / 62.0%** on all 24 |
| 1 | Ball diameter at address | **8.0 px (DR) to 13.0 px (LW)** at 390×844; 8.8–14.3 at 430×932. Real size (scale 1.000) |
| 1 | Smallest club margin at address | **5.1%** (430×932 DR, 5I, SW, LW); 5.2% at 390×844 |
| 1 | Club at the top / finish | **Off screen on every club** (margins −48% to −92%). Not met; see "Read this first" 1 |
| 1 | Club points under a HUD card or bottom button | 0 at address on all 24. At the top and finish 0 too, but only because the club is off screen |
| 1 | Aim line: 0, 10, 30, 100 m along the line vs the ball's x | **0.00 px** on all 24 (limit ±2) |
| 1 | Club change | Camera eases (first frame 0.4–2.2 mm, peak 2.3–13.4 mm per frame); no snap |
| 2 | Swing zone, swingLen | 390×844: zone 557–748 px, swingLen 211; 430×932: 615–836, 233; 360×780: 515–684, 195 |
| 2 | Play column vs any UI, aim / swing / flight, 3 sizes | **0 px** in every measured state (drive with a real swing, 7I, SW, 25 m chip, 8 m putt, map), except the first 2 frames of one new address at 390×844: 4.4 px |
| 2 | Transient cards up at once | At most **1** in every frame measured |
| 2 | swing2 power, same pull as a fraction of swingLen | **Identical in 40/40** (largest difference 3e-16) |
| 3 | Angle table | Below |
| 3 | 40 px sideways drift in the pull, straight flick | **PURE** both ways (R4: DRAW / FADE) |
| 3 | Fan screenshots | DR and 7I at the top |
| 4 | Flip within ±20 ms of contact | swing2 **40/40** (−9.4 to +8.8 ms; R4 30/40). swing4 **108/108** at 60 Hz, **60/60** at 120 Hz (R4 44/108) |
| 4 | On-screen bend at impact vs R4 | Driver **2.65×**, 7I **2.37×** |
| 4 | On-screen bend at the transition vs R4 | Head on screen only on the fastest swings, in both builds. Where it is: driver 4.2×, 7I 2.1×. Projected (on or off screen): driver 1.28×, 7I 2.87× |
| 4 | Peak tip deflection (bend and droop together) | Driver **176 mm** (cap 200), 7I **86 mm** (cap 100) |
| 4 | Settles | 0.5 s after contact: ≤ 4.2 mm left on the driver, ≤ 2.1 mm on the 7I |
| 5 | capture.js, bounce4.js, bot.js | **Identical** to R4 (bot.js differs only in its wall-clock "avg gen ms" line) |
| 5 | Grid height difference through the cup, 8 m up vs 8 m down | **2.50×** R4 on tiers 1, 5 and 9 |
| 5 | Green edge | w = 0 on every boundary vertex of the green mesh (324 holes) |
| 5 | Pop logs | Putt that drops: the relief offset changes ≤ 0.1 mm per frame. Chip: no jump, but see Task 5 |
| 5 | k in FEEL | `FEEL.green.relief` = 2.5 |

## 1. What changed, with line ranges (game.js unless noted)

### Task 1: centred shot
- **2507–2527, `ADDR` and `addrFor`:** a per-club table (back, up, down, fov) for all 12 full clubs. `ADDR.shift` is gone.
- **2530–2569, `addressCam`:** full clubs use `addrFor(G.club)`; the FOV target comes from the table. A club change only moves the spring targets.
- **2601–2603, 2638–2641:** `camHardSet` and `applyLens` no longer have a lens shift; `setViewOffset` is gone. `cam` lost `shift / tShift / shiftV` (~1900).
- **2700–2703, intro:** the flyover ends on the per-club address camera and eases the FOV from 52° to the club's.
- **2384–2387, `updateBallVisual`:** the ball is real size (cap 1.0) in aim, swing and impact.

### Task 2: clear play area
- **3002–3045, `drawFX`:** removed the side meter, its labels, the guide track, the finger trail and the finger dot. Kept the start line, the flash ring and the pin marker. The first-shots hint is a cream chevron plus "PULL DOWN · FLICK UP" (Archivo 11 px), centred in the swing zone.
- **2773–2785, `swingLen` and `swingZone`:** swingLen = 25% of the height, clamped 140–260 px. The zone runs from the ball's screen y + 4% of the height to the top of the bottom buttons (at least 12% of the height).
- **2786–2800, `onDown`:** a press inside the zone starts a swing; anywhere else aims, as before.
- **3071–3082, `updatePowerCard`:** while pulling, the lie card shows the power in Fraunces and the carry in Archivo; past 100% the number turns warn. It goes back to the lie at contact.
- **3125–3160:** bottom buttons at 40% while swinging (`FEEL.hudSwingDim`). `hideTransients` keeps one card at a time; the map hint clears the others.
- **2051, `takeShot`:** the contact toast uses the low slot.
- **2125, `nextShot`:** clears any toast as the next address starts.
- **2605–2622, `hudTopBottom` and `flightTilt`; 2636:** the flight tilt (above).
- **game.src.html 72–78:** the power layout inside the lie card. **117–143:** `#toast` and `#banner` at the top inset + 166 px, `#toast.low` 110 px above the bottom inset. **149:** `#maphint` at the top inset + 172 px. **342:** the power markup in `#lieChip`.

### Task 3: flick angle and fan
- **1226–1232, `FEEL.path`:** fan values and `minRise` added; the mapping values are unchanged.
- **1530, `flickTan`:** tan φ from the lowest point to the given point.
- **2800, 2829, 2836:** the swing records the lowest point (`xLow`, `yLow`).
- **2874–2889, `fire`:** f = tan φ to where the finger crosses the start line; dev = −pathMap(f); `G.phi` and `G.beta` (press → lowest point) are recorded. `pendingShot.f` is tan φ, so PURE uses it (`takeShot` unchanged).
- **1701:** the club's sideways tilt uses the same mapping once the finger has risen 12 px from its lowest point.
- **2985–3001, `ballScreen` and `drawFan`:** the fan, drawn on the FX canvas above the ball.

### Task 4: shaft
- **1240–1241, `FEEL.flex`:** `releaseHold`, `releaseBack`, `droop`; `c` raised.
- **1465–1490, `stepFlex`:** the release is gated on the downswing clock's own time to contact (T_est on the τ curve, then the commit's remaining time). After contact the load stays off for 80 ms, then comes back over 120 ms. This also stops the shaft re-loading backwards just after contact.
- **1491–1508, `applyFlex`:** a toe-down droop out of the swing plane, 0.5 × the in-plane bend, on the shaft and the head.

### Task 5: greens
- **719–735, `greenW`, `hVis`, `visOff`:** the drawn relief, and the fade between 0.3 and 1.0 m above the surface.
- **770–806, `buildGreen`:** the green mesh at hVis (so the bilinear lookups used by the aim line and the rings follow it).
- **267–284, `greenTint`:** divides the height by the relief, so the tint keeps its round 2 strength.
- **319–330, `matGrid`:** screen-space ribbons: cream, 1.5 CSS px, 35% opacity.
- **976–1016, `buildDots`:** dots on hVis, falling at the drawn slope; the grid every 0.9 m on hVis + 12 mm.
- **1705, `updateClub`; 2366, 2402–2405, `updateBallVisual`; 2533–2550, `addressCam`; 2571–2580, `flightCam`:** the ball, its shadow, the club root, the hole-out and the cameras use the drawn position.

### Version label and test hook
- **game.src.html 163–164, 402:** "Round 5", bottom right of the main menu, Archivo 11 px in cream2.
- **3404–3432, `window.__tempo`:** `state()` adds `phi`, `beta`, `ballVis`, `fanA`, `flexG`, `flexTau`, `addr`. New functions: `addrFor`, `swingZone`, `swingLen`, `hVis`, `visOff`, `flickTan`, `ballScreen`.

## 2. Tests and numbers

### Task 1: framing (`test/frame5.js`)

The game's own camera, after it settles. Margin = the club's smallest distance to a screen edge as % of the width or height. "Shaft on screen" = share of the grip-to-head line inside the frame.

| Club | Size | Ball x / y (%) | Ball (px) | Margin: address / top / finish (%) | Shaft on screen (addr / top / fin) | Camera back / up (m), FOV |
|---|---|---|---|---|---|---|
| DR | 390×844 | 50.0 / 62.0 | 8.0 | 5.2 / -48 / -84 | 100% / 0% / 0% | 3.47 / 1.09, 64 |
| DR | 430×932 | 50.0 / 62.0 | 8.8 | 5.1 / -48 / -84 | 100% / 0% / 0% | 3.47 / 1.09, 64 |
| 3W | 390×844 | 50.0 / 62.0 | 8.7 | 5.3 / -52 / -86 | 100% / 0% / 0% | 3.19 / 1.01, 64 |
| 3W | 430×932 | 50.0 / 62.0 | 9.6 | 5.3 / -52 / -86 | 100% / 0% / 0% | 3.19 / 1.01, 64 |
| 4H | 390×844 | 50.0 / 62.0 | 9.7 | 5.3 / -57 / -90 | 100% / 0% / 0% | 2.88 / 0.91, 64 |
| 4H | 430×932 | 50.0 / 62.0 | 10.7 | 5.2 / -57 / -90 | 100% / 0% / 0% | 2.88 / 0.91, 64 |
| 5I | 390×844 | 50.0 / 62.0 | 10.6 | 5.2 / -59 / -92 | 100% / 0% / 0% | 2.61 / 0.82, 64 |
| 5I | 430×932 | 50.0 / 62.0 | 11.8 | 5.1 / -59 / -92 | 100% / 0% / 0% | 2.61 / 0.82, 64 |
| 6I | 390×844 | 50.0 / 62.0 | 10.9 | 5.3 / -59 / -90 | 100% / 0% / 0% | 2.56 / 0.81, 64 |
| 6I | 430×932 | 50.0 / 62.0 | 12.0 | 5.2 / -59 / -91 | 100% / 0% / 0% | 2.56 / 0.81, 64 |
| 7I | 390×844 | 50.0 / 62.0 | 11.1 | 5.4 / -59 / -89 | 100% / 0% / 0% | 2.50 / 0.79, 64 |
| 7I | 430×932 | 50.0 / 62.0 | 12.3 | 5.3 / -59 / -89 | 100% / 0% / 0% | 2.50 / 0.79, 64 |
| 8I | 390×844 | 50.0 / 62.0 | 11.4 | 5.3 / -60 / -88 | 100% / 0% / 0% | 2.43 / 0.77, 64 |
| 8I | 430×932 | 50.0 / 62.0 | 12.6 | 5.2 / -61 / -88 | 100% / 0% / 0% | 2.43 / 0.77, 64 |
| 9I | 390×844 | 50.0 / 62.0 | 11.7 | 5.3 / -63 / -86 | 100% / 0% / 0% | 2.37 / 0.75, 64 |
| 9I | 430×932 | 50.0 / 62.0 | 12.9 | 5.3 / -64 / -87 | 100% / 0% / 0% | 2.37 / 0.75, 64 |
| PW | 390×844 | 50.0 / 62.0 | 12.0 | 5.4 / -67 / -85 | 100% / 0% / 0% | 2.32 / 0.73, 64 |
| PW | 430×932 | 50.0 / 62.0 | 13.3 | 5.3 / -67 / -85 | 100% / 0% / 0% | 2.32 / 0.73, 64 |
| GW | 390×844 | 50.0 / 62.0 | 12.3 | 5.4 / -70 / -83 | 100% / 0% / 0% | 2.27 / 0.72, 64 |
| GW | 430×932 | 50.0 / 62.0 | 13.5 | 5.3 / -70 / -83 | 100% / 0% / 0% | 2.27 / 0.72, 64 |
| SW | 390×844 | 50.0 / 62.0 | 12.6 | 5.2 / -75 / -82 | 100% / 0% / 0% | 2.20 / 0.69, 64 |
| SW | 430×932 | 50.0 / 62.0 | 13.9 | 5.1 / -75 / -82 | 100% / 0% / 0% | 2.20 / 0.69, 64 |
| LW | 390×844 | 50.0 / 62.0 | 13.0 | 5.2 / -80 / -80 | 100% / 0% / 0% | 2.15 / 0.68, 64 |
| LW | 430×932 | 50.0 / 62.0 | 14.3 | 5.1 / -80 / -81 | 100% / 0% / 0% | 2.15 / 0.68, 64 |

- Every row: 0 club points inside a HUD card or bottom button at address.
- Aim line: points 0, 10, 30 and 100 m along the line project to the ball's x **±0.00 px** on all 24 rows (R4: x = 304.2 px, 78% across).
- Horizon at **37.4%** of the height on every club (R4: about 10%).
- R4 for comparison: ball 12.2 px at 76–78% across, driver margin 7.3%, club visible at address only.
- Screenshots: `task1/frame_{DR,5I,9I,SW}_{address,top,finish}.jpg` (390×844). The top and finish shots show the club off screen.

**Club change (`test/clubspring5.js`):** after a tap on the next/previous club, the camera's move per frame ramps up and back down. DR→3W: 0.29 m in total, first frame 2.2 mm, peak 13.4 mm. 7I→8I: 0.07 m, 0.5 / 3.2 mm. GW→PW: 0.05 m, 0.4 / 2.3 mm. The only hard camera set in the game is the first intro frame.

### Task 2: play area (`test/ui5.js`)

**Swing zone (full club, driver at the tee):**

| Size | Ball y | Zone (px) | swingLen | Full pull from the zone top ends at | 112% ends at |
|---|---|---|---|---|---|
| 390×844 | 523 | 557–748 | 211 | 768 | 793 |
| 430×932 | 578 | 615–836 | 233 | 848 | 876 |
| 360×780 | 484 | 515–684 | 195 | 710 | 733 |

On the iPhone 17 Pro (874 tall, 34 px bottom inset) the same rules put the end of a 112% pull started at the top of the zone about 18 px above the inset. Worked out, not measured.

**Play column:** every frame of aim, swing and flight, the column is a capsule from the ball (its drawn radius, at least 6 px) to the landing ring (its drawn radius, up to 24 px). In flight it runs from the ball to the shot's real first touchdown (the ball stepped ahead by the engine), and after the touchdown it is the ball alone. UI boxes: the four HUD cards, the toast, the popup, the map hint and the five bottom buttons. The toast and popup count from the moment they're shown, on the simulated clock.

| Case | 390×844 | 430×932 | 360×780 |
|---|---|---|---|
| Drive, real swing: aim, pull, overswing, flight | 0 px | 0 px | 0 px |
| Moving to the next address after the drive | 4.4 px, 2 frames | 0 | 0 |
| 7I PURE, SW full, PW 25 m chip: aim and flight | 0 | 0 | 0 |
| 8 m putt: aim and roll | 0 | 0 | 0 |
| Map view (aim) | 0 | 0 | 0 |
| Highest the ball gets in flight (px from the top) | 168 | 167 | 168 |
| Flight tilt, largest (drive / 7I / SW / chip) | 2.7° / 9.4° / 22.5° / 9.7° | 1.8 / 8.4 / 21.5 / 8.7 | 3.6 / 10.3 / 23.4 / 10.6 |

Flight tilt, side by side: `task2/flight_tilt_SW_r4_top_r5_bottom.jpg` (a full SW from 80 m, 0.75 to 2.3 s into the flight). In R4 the ball is off the top of the screen at 0.75 s; in R5 it stays in view under the cards.

The 4.4 px: on the first 2 frames of the next address the camera is still at the last shot's view, and the new landing ring's far end touches the bottom of the wind card until the camera starts to move. It depends on where the drive lands (an earlier run of the same test measured 0 there).

Before the fixes in this round's audit, the same test found: the rest toast over the next aim line (35 px, 8 frames), the contact toast over the climbing ball (up to 56 px), the hole card's edge over the ball on short-iron climbs (11–18 px at 390 and 360 wide), and the wind card over a drive's apex at 360 wide (22 px).

**Audit (every transient state, three sizes, screenshots `task2/{size}_{state}.jpg`, and one contact sheet per size):**

| State | Found | Done |
|---|---|---|
| Hole intro | Was at 34% (over the fairway at address) | Band under the cards |
| Shot toast at rest, penalty toast | Was at 24%; lingered into the next address while the camera moved | Band; cleared when the next address starts |
| Contact toast (PURE and shapes) | In the band it covers the ball as it climbs | Low slot, above the bottom buttons |
| BIRDIE / PAR / BOGEY | Was at 34% | Band. In the hole-out view it sits over the top of the flagstick and the flag (the hole is over; no play column) |
| Map hint | Was at 168 px | 172 px, under the cards; hides any toast or popup |
| First-shots hint | Was at 44% height, over the fairway | Centred in the swing zone, under the ball |
| Two cards at once | R4 showed the toast and the popup independently | One at a time (`hideTransients`) |
| HUD cards over the ball in flight | Ball climbed behind them; off the top on wedges (R4 too) | Flight tilt |
| Pause, hole card, results | No overlap, no horizontal scroll at 360, 390 or 430 wide | No change |

**Power card:** at 60% of swingLen the card reads "60%" and "147 yd"; at 110% "110%" in warn (rgb 185, 69, 41) and "274 yd". After contact it shows the lie again.

**swing2:** the test now presses inside the zone and pulls 99% of the game's own swingLen. Power matches R4 (which pulled 99% of its own 253 px) in **40/40** runs, largest difference 3e-16. swing4 rounds each finger step to a whole pixel, so a 99% pull is 209/211 px in R5 and 251/253 px in R4; its power differs by up to 0.0008 for that reason only.

### Task 3: flick angle (`test/path5.js`, `test/drift5.js`, `test/fan5.js`)

φ from straight up, right positive. Flat ground, no wind, no upgrades. Offline distances are in metres and mirror each side: a right flick (+φ) draws or hooks, a left flick fades or slices. "R4 drift" is the round 4 sideways drift at 390×844 that gives the same dev on a full pull with no backswing drift.

| φ | tan φ | R4 drift (px) | dev | Label | DR off at carry / rest | 7I off at carry / rest | Putt aim error at 3 m / 10 m | R4, same flick on a half pull |
|---|---|---|---|---|---|---|---|---|
| 0° | 0.000 | 0.0 | 0.000 | PURE | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 cm | PURE (0) |
| +2° | 0.035 | 8.8 | 0.000 | PURE | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 cm | PURE (0) |
| -2° | -0.035 | -8.8 | 0.000 | PURE | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 cm | PURE (0) |
| +3° | 0.052 | 13.3 | -0.015 | STRAIGHT | 1.6 / 1.8 | 0.3 / 0.3 | 0.1 / 0.4 cm | PURE (0) |
| -3° | -0.052 | -13.3 | 0.015 | STRAIGHT | 1.6 / 1.8 | 0.3 / 0.3 | 0.1 / 0.4 cm | PURE (0) |
| +5° | 0.087 | 22.2 | -0.057 | STRAIGHT | 5.9 / 6.9 | 1.1 / 1.2 | 0.5 / 1.7 cm | PURE (-0.001) |
| -5° | -0.087 | -22.2 | 0.057 | STRAIGHT | 5.9 / 6.9 | 1.1 / 1.2 | 0.5 / 1.7 cm | PURE (0.001) |
| +8° | 0.141 | 35.6 | -0.120 | STRAIGHT | 12.5 / 14.6 | 2.3 / 2.5 | 1.1 / 3.6 cm | STRAIGHT (-0.036) |
| -8° | -0.141 | -35.6 | 0.120 | STRAIGHT | 12.5 / 14.6 | 2.3 / 2.5 | 1.1 / 3.6 cm | STRAIGHT (0.036) |
| +12° | 0.213 | 53.8 | -0.205 | DRAW | 21.0 / 24.7 | 3.9 / 4.3 | 1.8 / 6.1 cm | STRAIGHT (-0.079) |
| -12° | -0.213 | -53.8 | 0.205 | FADE | 21.0 / 24.7 | 3.9 / 4.3 | 1.8 / 6.1 cm | STRAIGHT (0.079) |
| +20° | 0.364 | 92.2 | -0.386 | DRAW | 36.9 / 43.7 | 7.3 / 8.0 | 3.4 / 11.4 cm (PUSHED) | DRAW (-0.169) |
| -20° | -0.364 | -92.2 | 0.386 | FADE | 36.9 / 43.7 | 7.3 / 8.0 | 3.4 / 11.4 cm (PULLED) | FADE (0.169) |
| +30° | 0.577 | 146.2 | -0.640 | HOOK | 52.5 / 63.7 | 11.9 / 13.1 | 5.7 / 19.0 cm (PUSHED) | DRAW (-0.296) |
| -30° | -0.577 | -146.2 | 0.640 | SLICE | 52.5 / 63.7 | 11.9 / 13.1 | 5.7 / 19.0 cm (PULLED) | FADE (0.296) |

- Thresholds: PURE |φ| ≤ 2.86°, STRAIGHT up to 8.0°, FADE/DRAW up to 21.4°, dev reaches its cap (1.6) at 54°.
- Round 4's drift table (its rows for 5–120 px) is the same mapping: the R4 row for d px equals the R5 row for φ = atan(d / 253.2). For example R4 35 px → dev −0.117, STRAIGHT; R5 8° → −0.120, STRAIGHT.
- What changed is what counts: in R5 the pull's sideways drift and the pull's length don't affect the shot. In R4 the same flick angle gave half the dev on a half pull (last column).

**Live swings (`drift5.js`, driver, 99% pull, T = 200 ms):**

| Pull drift | Flick | R5 φ / β | R5 label | R4 label (same finger path) |
|---|---|---|---|---|
| 0 | straight | 0° / 0° | PURE | PURE |
| +40 px | straight | 0° / 10.8° | **PURE** | DRAW |
| −40 px | straight | 0° / −10.8° | **PURE** | FADE |
| +40 px | 2° right | 2° / 10.8° | PURE | DRAW |
| +40 px | 5° right | 5° / 10.8° | STRAIGHT | DRAW |
| 0 | 8° right | 8° / 0° | STRAIGHT | STRAIGHT |
| +80 px | straight | 0° / 21.0° | PURE | DRAW |

**Fan:** inner radius 63 px, outer 116 px at 390×844 (0.30 and 0.55 × 211), half-angle 8.0°, PURE band ±2.9°. Full strength at the top of the backswing on DR and 7I (`task3/fan_DR_top.jpg`, `task3/fan_7I_top.jpg`). Full swings only.

### Task 4: shaft (`test/bend5.js`, `swing2.js`, `swing4.js`, `test/strip5.js`)

**Flip timing:** the shaft's + to − crossing nearest contact, from its 240 Hz substeps.

| Test | R4 | R5 |
|---|---|---|
| swing2, 40 runs | 30/40 within ±20 ms (late ones +109 to +148 ms) | **40/40**, −9.4 to +8.8 ms |
| swing4, 60 Hz, 108 runs | 44/108 | **108/108**, −9.4 to +13.9 ms |
| swing4, 120 Hz, 60 runs | — | **60/60**, −6.8 to +7.3 ms |

**On-screen bend:** per frame, the clubhead's screen point with the bend as drawn vs. with the tip put back on a straight shaft, from each build's own player camera, 390×844. Twelve swings per club (T = 120, 200 and 300 ms, four start phases). Transition = the 150 ms after the finger reverses; impact = contact ± 30 ms. Mean of the per-swing peaks.

| | R4 | R5 | R5 / R4 |
|---|---|---|---|
| Driver, impact | 3.14 px | 8.31 px | **2.65×** |
| 7I, impact | 2.73 | 6.46 | **2.37×** |
| Driver, transition (head on screen only) | 1.03 | 4.28 | 4.2× |
| 7I, transition (head on screen only) | 1.66 | 3.51 | 2.1× |
| Driver, transition, projected whether on screen or not | 18.48 | 23.64 | 1.28× |
| 7I, transition, projected | 7.77 | 22.28 | 2.87× |

- The head is on screen in only 3–4 of the 10 transition frames on the T = 120 ms swings, and in none on the slower ones, in both builds. So the "transition" rows rest on few frames.
- The driver's projected transition stays under 2× because its camera is smaller-scale than round 4's (8 px ball vs 12.2) and the 0.20 m cap stops the bend from going further.
- Peak tip deflection (in-plane bend and droop together), over swing2 and swing4: driver **176 mm**, 7I **86 mm**.
- Left 0.5 s after contact: ≤ 4.2 mm (driver), ≤ 2.1 mm (7I). swing2's figure 0.6 s into the finish: ≤ 0.03 mm.
- Frame strips `task4/strip_DR.jpg` and `task4/strip_7I.jpg`: address, top, transition, −33, −17 ms, contact, +17, +33, +83, +250 and +500 ms, from the player's camera (top row) and a face-on camera (bottom row) that shows the in-plane bend.

### Task 5: greens (`test/green5.js`, `test/seam5.js`)

**Physics unchanged:** `capture.js` and `bounce4.js` output is byte-identical between the R4 and R5 engines (the engine file is identical). `bot.js` matches on all 24 lines except "avg gen ms" (1.4 vs 1.6), which is wall-clock time.

**Height of the grid through the cup:** points on the fall line through the cup, 8 m uphill and 8 m downhill (shortened equally when the green ends sooner). Each is projected on the drawn grid and at the cup's height; the gap in px is its on-screen height. Putting camera, ball 10 m from the cup across the slope.

| Green | Slope at the cup | Length used | Real drop | R4 height difference | R5 | R5 / R4 |
|---|---|---|---|---|---|---|
| Tier 1 | 0.78% | 8 m each way | 0.137 m | 9.25 px | 23.11 px | **2.50×** |
| Tier 5 | 1.00% | 7.75 m | 0.252 m | 17.01 | 42.44 | **2.50×** |
| Tier 9 | 2.03% | 6.5 m | 0.265 m | 17.89 | 44.73 | **2.50×** |

Screenshots: `task5/r4_tier{1,5,9}.jpg`, `task5/r5_tier{1,5,9}.jpg` and the grid alone `task5/r5_tier{1,5,9}_grid.jpg`. The R5 tier shots also show the hole intro card in the band (headless timing left it up).

**Green edge (`seam5.js`, 324 holes, tiers 1–9):** w = 0 on every boundary vertex of the green mesh. The terrain mesh (drawn at the real height, cut out where a cell's centre is inside 1.25 × the green) overlaps the outer fringe a little: there w ≤ 0.014, so the two surfaces differ by at most 7 mm, with the same texture on both.

**Pop logs (tier 9 green, per frame, drawn y vs physical y):**
- **Putt that drops (3 m, holed):** the relief offset changes by at most **0.1 mm per frame** and holds at −1.7 mm through the drop. The drawn ball moves at most 29 mm per frame (its rolling speed).
- **Chip that lands short and rolls on (PW from 36 m, lands on the fringe, stops on the green):** no single-frame jump. In the last 7 frames before it lands, the ball descends over the fringe on the low side, where the drawn surface sits up to ~0.65 m below the real one. The offset grows from −0.07 to −0.66 m over those 7 frames (largest change 101 mm in one frame), so the drawn ball falls about twice as fast as the real one (187 vs 87 mm per frame) for about 0.1 s. Below 0.3 m it is exactly as high above the drawn ground as the real ball is above the real ground. Full log in `green5_r5.json` (results zip).
- **Why:** the green's edge on its low side is drawn up to 1.2 m lower than the real ground (see "Read this first" 5), and the fringe ramps that back to zero.

### Regressions
- **Saves:** round 1, 2 and 3 saves, plus saves written by the round 3 and round 4 builds with a round in progress, load unchanged in R5 (0 changed fields). Continue resumes at the right hole with the same scores. No errors.
- **Tour event through the real screens (`round4.js`):** six holes, card after each, results, save written. No page errors.
- **Every page in every test:** no page errors.
- **Performance (`perf.js`, 6× CPU throttle, 390×844 DPR 2):** no errors, and no new shader programs (21 before the first swing, after the first contact and after the putt, in both builds). `perf.js` now presses inside the swing zone and pulls 99% of the game's swingLen, as swing2 does.

| | R4 | R5 |
|---|---|---|
| Section entries over 4 ms (render excluded) | 83 | 96 |
| Worst single section | 20.3 ms (`updateAimVisuals`, intro) | 21.2 ms (`updateTracer`, after the second shot) |
| `updateTracer` p95 / max | 3.6 / 16.5 ms | 4.9 / 21.2 ms |
| `takeShot` max | 12.4 ms | 13.9 ms |
| Control (a fixed block of JS run every frame): frames over 4 ms | 104 of 1,891 | 124 of 1,891 |

  The control moved by about as much as the sections did (104 → 124 with the same work), so I read this as noise, not a slowdown. The one new per-frame cost is the flight tilt's single projection while the ball is in the air.
- **Site (`app4.js`):** service worker active and in control, manifest and all icons and launch screens load, three.js r128 from the site, cache `gstick-core-b6fe72c69e`. With the network off the game loads and plays a drive (244.7 m). A newer build replaces the cache on the next online launch. No errors.

## 3. Not verified
- Anything on a phone: how the swing zone, the power card, the fan, the bend and the greens feel or read.
- The iPhone's insets. The horizon was set for a 62 px top inset, but no test renders with a notch.
- How the lower camera reads compared with Golf Dreams. I couldn't view the reference.
- The transition bend from the player's camera: the head is off screen there.
- Whether the fringe bank on tiered greens looks wrong. Approach screenshots from 25 and 60 m show a smooth green, not an obvious step, but that's not proof.
- The live site itself: this sandbox can't load github.io, so the live check is through GitHub's Pages deploy record (see Publishing).

## 4. iPhone 17 Pro try-list
1. **Every club at address:** is the ball centred with the whole club in view? Is the lower, closer camera OK? Is 8 px (driver) to 13 px (LW) big enough?
2. **A full swing with each club:** the club leaves the screen at the top and comes back in for impact. Does that bother you?
3. **Ten swings started below the ball:** can you see the ball and the aim line the whole time? Does "87% · 154 yd" read clearly in the top-left card? Does the 112% pull fit above the home bar?
4. **Five drives aiming straight, with the fan.** Then five with your thumb drifting sideways on the way down but flicking straight up: they should come out PURE or STRAIGHT.
5. **The shaft through the ball:** visible toe-down kick at impact? Not rubbery?
6. **A wedge and a drive in flight:** does the camera's small tilt-up to keep the ball under the cards feel natural?
7. **The PURE toast above the bottom buttons in flight,** and the carry toast in the sky band at rest. Can you read the carry toast before the next address clears it (about 1.3 s)?
8. **Putts of 3, 8 and 15 m across slopes:** does the green now look like it breaks the way the ball does? Is the cream grid too strong?
9. **Chip onto a green from its low side:** does the green's edge look like a bank, or does the ball dip oddly as it lands?
10. **Every popup and screen from the audit:** hole intro, PURE, a penalty, BIRDIE / PAR / BOGEY, the map hint, pause, hole card, results.

## 5. New or changed values

### ADDR (game.js 2507–2527)
| Club | back (m) | up (m) | down (m) | FOV (°) |
|---|---|---|---|---|
| DR | 3.472 | 1.095 | 4.189 | 64 |
| 3W | 3.195 | 1.007 | 4.233 | 64 |
| 4H | 2.880 | 0.908 | 4.283 | 64 |
| 5I | 2.613 | 0.824 | 4.325 | 64 |
| 6I | 2.556 | 0.806 | 4.334 | 64 |
| 7I | 2.499 | 0.788 | 4.343 | 64 |
| 8I | 2.432 | 0.767 | 4.353 | 64 |
| 9I | 2.375 | 0.749 | 4.362 | 64 |
| PW | 2.318 | 0.731 | 4.371 | 64 |
| GW | 2.270 | 0.716 | 4.379 | 64 |
| SW | 2.203 | 0.695 | 4.389 | 64 |
| LW | 2.146 | 0.677 | 4.398 | 64 |

`ahead` 30 and `fov0` 52 are unchanged. Removed: the single `back 3.3, up 2.0, down 8.5, fov 43, shift 0.28`. `ADDR.putt` is unchanged.

### FEEL
| Value | Round 5 | Round 4 |
|---|---|---|
| `path.minRise` | 12 px (finger rise before the tilt follows the flick) | — |
| `path.fanR0`, `fanR1` | 0.30, 0.55 × swingLen | — |
| `path.fanA`, `fanPureA`, `fanLineA`, `fanLineW` | 0.30, 0.45, 0.55, 1.5 px | — |
| `path.fanIn`, `fanOut` | 0.25 s, 0.15 s | — |
| `path.dead, span, max, pure, tiltTau` | 0.04, 0.84, 1.6, 0.05, 0.06 | same |
| `swingZone` | below 0.04, minH 0.12, len 0.25, lenMin 140, lenMax 260 | swingLen 0.30 × height (140–300), zone from 36% down (in code) |
| `hint` | chev 9 px, bob 3 px | — |
| `hudSwingDim` | 0.4 | — |
| `meter` | removed | w 22, gap 40, yellowFrom 0.9, pctPx 30 |
| `flex.c` | driver 2.3e-4, wood 1.7e-4, iron 1.21e-4, wedge 0.924e-4 | 1.15e-4, 0.85e-4, 0.55e-4, 0.42e-4 |
| `flex.releaseHold`, `releaseBack` | 0.08 s, 0.12 s | — |
| `flex.droop` | 0.5 | — |
| `flex.releaseLead`, `releaseWidth` | 0.046, 0.006 (now on the downswing clock) | same values |
| `green.relief` | 2.5 | — |
| `green.reliefFade` | [0.3, 1.0] m | — |
| `green.gridGap`, `gridW`, `gridA` | 0.9 m, 1.5 px, 0.35 (cream) | R4 grid: 1 px white lines at 0.2 opacity |
| `cam.flightTopPad`, `tiltEase` | 14 px, 6 /s | — |

### PALETTE and CSS
- PALETTE unchanged. The fan and the grid use `PALETTE.cream`; the power number over 100% uses `--warn`.
- CSS: `#toast` and `#banner` top = top inset + 166 px (R4: 24% and 34%); `#toast.low` bottom = bottom inset + 110 px; `#maphint` top inset + 172 px (R4 168); `.card.info .pw` (power 26 px, carry 13 px); `#verLabel` (11 px, cream2).

## Deviations from the brief
1. **The whole club at the top and finish is not in frame** (Task 1b). Ball ≥ 8 px and the whole club at address won.
2. **The camera is lower than round 4, not higher** (Task 1b), so the card band exists under the HUD. Its angle above the ball is 17.5° on every club.
3. **The contact toast sits above the bottom buttons in flight** (Task 2e says the band). Every other card is in the band.
4. **The flight camera tilts up** when the ball would climb behind the HUD cards. This isn't in the task list. Without it the play column wasn't clear in flight (R4 had the same problem).
5. **Toasts clear when the next address starts**, so the rest toast shows for about 1.3 s instead of 2.2 s.
6. **The transition bend can't be seen from the player's camera**, so the "2× at the transition" check rests on the few fast-swing frames where the head is on screen, plus the projected numbers.
7. **flex.c** is 2× on woods and 2.2× on irons and wedges (the driver's cap limits it).

## Publishing
- Pushed to `claude/round-5`, merged into `main` as one "Round 5" commit (a squash-merged pull request, because this sandbox can only push `claude/*` branches), and the branch deleted. No tag.
- The Pages deploy and the live build hash (`b6fe72c69e` in `sw.js`) are confirmed through GitHub's records, not by loading the site: this sandbox can't reach github.io. The outcome is in the project copy of this report (`claude/beta-round-5-report.md`).
- The claude.ai artifact is updated as the fallback.
