# Beta Round 1 report (Oct 16, 2026)

The build is `tempo-golf.html`, built by build.py, and the game title is now **G$tick Golf**. It's republished to the same public link. The save key is still `tempo-golf-v1`.

Every number here is headless: Playwright, Chromium 1194, swiftshader WebGL, 390×844 at DPR 2 with `isMobile`/`hasTouch`. Nothing was measured on a phone.

## Status by task

| Task | Done-when | Result |
|---|---|---|
| T1 perf | programs.length unchanged across first contact | **Met.** 22 → 22 → 22 (it was 16 → 20 → 22). |
| T1 perf | no tracked section over 4 ms in any frame at 6× | **Not met as literally measured.** The 6× throttler pushes even a fixed ~0.1–0.2 ms control section over 4 ms in 1.7% of frames, so no section can pass. Frames over 4 ms dropped from 180 to 38. The deterministic costs are fixed. What's left is the throttler's own pauses, V8 garbage collection, and one-time first-use costs (see section 2). |
| T2 contact | ball moving ≤40 ms after the finger crosses | **Met: 17–33 ms**, but only with one constant changed from the brief (commit cap 0.032 instead of 0.05). With 0.05, 80 ms flicks take 35–48 ms. |
| T2 | last-30% speed ≥3× first-30% | **Met: 10–28×.** |
| T2 | time scale bottoms ≈0.5, back to 1.0 by 0.3 s, never 0 | **Met:** 0.509 → 1.000 at 300 ms, never 0. |
| T3 | backswing ≥90% on a 350 ms pull | **Met for an ease-out pull: 90.8%.** A constant-speed pull reaches 74.2%. |
| T3 | flex peaks in range, sign flips, <2 mm at finish + 0.6 s | **Peaks in range; settles to 0.02 mm.** The sign flips at the transition. The second flip comes **139 ms after contact**, not at contact: the head still lags by 55 mm at impact. |
| T3 | 0.6 s hold + 150 ms flick → tempoMul 1.0, no SLOW TEMPO | **Met**, both with and without touch events during the hold. |
| T4 | no grain or speckle; capture.js and bot.js unchanged | **Met.** Both outputs are byte-identical. |
| T4 | high and low sides visibly lighter and darker from the putting camera | **Not met.** The method is built and tuned as specified, but greens are nearly flat planes where you putt, so lighting has no high or low side to show. See T4 below. |
| T5 | ball ≤1.5× on the ground; flag constant from swing to next aim | **Met.** Screenshot provided. |

## Deviations from the brief (your call whether to keep)

1. **`FEEL.commit.max` is 0.032, not 0.05.** A fast finger outruns the ω 40 downswing spring. When it crosses the line, the club is still about 100° up, so commit runs 37–46 ms under the 0.05 cap and contact lands two frames later. The 0.032 cap keeps contact in the next frame. Swingsim can run either value: `FEEL='{"commit":{"max":0.05}}'`.
2. **`GREEN_SLOPE_K` is 5.** The brief's starting value of 6 goes over 15% under a low sun.
3. **The ball shrinks before touchdown.** The cap starts easing to 1.5× when the predicted time to the ground drops under 0.34 s, and stays at 1.5× after the first landing (including bounces). Without this, a 0.3 s ease would leave the ball above 1.5× on the ground for the first few frames.
4. **Tempo clock.** A still finger often sends no move events. Under the literal rule, the "last sample within 6 px of the bottom" is then the start of the pause, which gives SLOW TEMPO. So the first sample that has risen is credited at most 17 ms of travel.
5. **Performance changes beyond the listed suspects** (behavior unchanged):
   - The landing preview is cached; it lands within 1.3e-12 m of the old full flight across 1,890 cases.
   - The HUD writes only values that changed.
   - All club models are built at boot and included in the shader compile.
   - Visuals and the preview use bilinear lookups on the mesh grids (`hFast`).
6. **Test hooks on `__tempo`:**
   - New fields: `tick(dt, draw)`, `PERF`, `setPerf`, `FEEL`, `PV`, `renderer`.
   - `state()` returns time scale, shaft bend, flag scale, ball scale, mode and club phase.
   - `G.manual` stops the requestAnimationFrame loop.
7. **The flag retargets during aim** if the ball-to-pin distance changes. In real play only nextShot and startHole move the ball, and both already set it, so this only matters when a test moves the ball directly.

## 1. What changed, with line ranges (game.js, now 2,797 lines)

**T1 Perf**
- 15: `settings.perf: false`.
- 685–697: `hFast`/`gridH` bilinear lookups. 712 and 745 cache the terrain and green grids. 1088: particles use them.
- 1007–1056: the tuft job. `buildTufts` starts it; `stepTufts` runs at most 1.5 ms a frame (2241), checks the clock every 4 attempts, and swaps the finished set in at once. It starts at settle (1779, 1793), and nextShot (1805) starts one only if settle didn't.
- 1101: `divotProbe`. 1150–1155: `renderer.compile` at the end of buildWorld, with every club model temporarily hung under the hidden club root.
- 1376–1391: setupClub is timed. 2784: all club models are prebuilt in `start()`.
- 1570–1593: PERF block (section timers, 720-frame ring, readout, `setPerf`). 2748 and 2755: pause-menu toggle. game.src.html: CSS at 127–131, `#perf` at 297, button at 417.
- 1690–1741: takeShot sections.
- 1841–1885: cached landing preview (`PVN`, `pvBuild`, `pvSet`, `computePreview`). 1911–1939: the aim line waits a few frames while a new flight is cached after a club or lie change.
- 1889–1910: drapeLine and drapeRing use scalar previous-point variables.
- 1962+: updateBallVisual reuses `G.bprev`.
- 2133–2147: `frame`, `runFrame` and `testTick`.
- 2250–2251: `TRAIL` ring buffer, used by drawFX (2394+).
- 2479–2532: `hudSet`; updateHUD writes only values that changed.
- 2795–2796: new fields on `__tempo`.

**T2 Contact and downswing**
- 1161–1174: `FEEL`.
- 1394: `springTo` takes a damping ratio.
- 1396–1442: `stepClub`. The downswing is `aS·(1−(1−frac)²)` at ω 40; the putter keeps `frac^1.35` at ω 19.
- 1443–1451: `clubCommit`, `Tc = clamp(0.015 + aS/4000, 0.02, 0.032)`.
- 1563: `G.dip` and `G.timeScale`. hitStop is gone (0 occurrences).
- 1723–1724: dip and shake set at contact. 1737: `G.acc = E.DT`, so the ball steps on the contact frame.
- 2158–2163: in `update()`, the time scale is applied to sdt and the club steps before the mode logic. Shake still uses real dt.

**T3 Backswing and shaft**
- 1396–1442: backswing at ω 16, ζ 0.8.
- 1245–1339: buildClubModel. The shaft is an open 12-segment cylinder; a tip group carries the ferrule and head; the contact point includes the tip offset.
- 1346–1375: `CV` flex state, `flexClass`, `stepFlex`, `applyFlex` (CPU deformation of base positions; shared materials untouched).
- 1376–1393: setupClub sets `c`; resetClub zeroes the bend.
- 1468–1488: updateClub steps the flex in the 240 Hz loop.
- 2254–2300: tempo clock (`tLift`, `lifted`, `FEEL.tempoLift`) in onDown and onMove.

**T4 Greens and grass**
- 243–258: addDetail, with gC/gD amplitudes halved (255). 281–282: detail term 0.3 on terrain, 0 on green.
- 671–677: grain pass removed; mottle alpha 0.45 → 0.08.
- 733–766: `GREEN_SLOPE_K = 5` and the normal exaggeration in buildGreen.

**T5 Ball and flag**
- 1962–2020: updateBallVisual size caps.
- 1792: `flagAim`, called from startHole (1674) and nextShot (1803).
- 2022–2047: updateFlag.

**Rename:** ball logo (155); game.src.html `<title>` (1) and menu wordmark (317).

## 2. What was tested, with numbers

### T1: `test/perf.js`
The script scripts one hole: 60 frames of aim dragging (preview recomputed every frame), a driver shot through contact, flight, settle and the next shot, then an iron shot, then a 6 m putt. That's 1,951 frames. Frames are stepped by hand at 60 Hz so every frame's JS is timed; the scene renders every 4th frame, and every frame around contact. The run includes a fixed-cost **control** section timed each frame.

| Section | 6× worst, before | 6× worst, after | 6× frames >4 ms, before → after | 1× median / p95 / max, before | 1× median / p95 / max, after |
|---|---|---|---|---|---|
| computePreview | 34.7 | 32.4 | 72 → 5 | 1.2 / 2.5 / 4.9 | 0.1 / 0.6 / 3.0 |
| buildTufts | 82.7 | 10.3 | 2 → 6 | 25.6 / 25.6 / 25.6 | 1.6 / 1.6 / 1.7 |
| setupClub | 34.5 | 1.2 | 2 → 0 | 4.1 / 6.6 / 6.6 | 0.1 / 0.1 / 0.1 |
| takeShot (total) | 46.4 | 20.5 | 2 → 2 | 2.3 / 2.5 / 2.5 | 1.0 / 3.1 / 3.1 |
| · spawnDebris | 5.7 | 1.1 | 1 → 0 | 0.1 / 0.1 / 0.1 | 0.4 / 0.4 / 0.4 |
| · addDivot | 1.9 | 1.7 | 0 → 0 | 0.3 / 0.3 / 0.3 | 0.1 / 0.1 / 0.1 |
| · Snd.play | 34.7 | 16.4 | 1 → 1 | 0.4 / 1.8 / 1.8 | 0.3 / 2.5 / 2.5 |
| · toast/HUD | 3.2 | 1.5 | 0 → 0 | 0.3 / 1.4 / 1.4 | 0.2 / 0.2 / 0.2 |
| updateAimVisuals | 35.9 | 33.1 | 78 → 8 | 0.2 / 2.0 / 4.9 | 0.1 / 0.4 / 3.5 |
| updateTracer | 18.3 | 8.5 | 7 → 7 | 0.1 / 0.3 / 4.5 | 0.1 / 0.3 / 4.3 |
| updateParticles | 5.2 | 7.6 | 3 → 2 | 0.1 / 0.2 / 0.5 | 0.1 / 0.3 / 11.7 |
| updateHUD | 9.5 | 8.9 | 3 → 1 | 0.2 / 0.6 / 0.6 | 0.1 / 9.3 / 9.3 |
| drawFX | 37.8 | 32.1 | 9 → 6 | 0.1 / 0.3 / 8.4 | 0.1 / 0.2 / 4.9 |
| **all sections** | | | **180 → 38** | | |
| control (fixed ~0.1–0.2 ms) | | max 10.2 | — → 34 (1.7%) | | max 3.7, 0 frames >4 ms |

All times are ms. "Before" is the pre-round build with the same timers added. Notes:

- **Throttling artifact (measured).** CDP throttling suspends the main thread in chunks of up to about 6 ms. In a standalone check, a ~0.03 ms workload measured up to 6.2 ms at 6×. Any section that runs at all can therefore land over 4 ms. Sections at or near the control's rate (updateTracer 1.8%, drawFX 1.4%, updateHUD 2.2%, updateParticles 2.6%) are explained by that alone.
- **GC (measured in Chromium; Safari not measured).** In a 1× run that watched the heap every frame, the 3–12 ms spikes in computePreview (3.0), updateAimVisuals (3.5), updateTracer (4.3) and updateParticles (11.7) all fell in frames where the heap shrank. A sampling profile puts most of the garbage in math functions that create no objects: hFast, drapeLine, Ball.stepAir and three.js matrix code. That pattern means V8 is boxing floating-point return values. *Inference:* JavaScriptCore stores doubles inline (NaN-boxing), so this GC load is likely much smaller on iPhone Safari.
- **First-use costs (measured, once per session).** At 1×: the first audio playback took 2.5–4.9 ms (Snd.play inside the first takeShot; it's 0.2–0.3 ms after that), the first swing-meter draw took 2.8 ms, and the first aim-hint text draw took 4.9 ms. Warming these at hole load would mean touching audio and swing-meter code, which are on the don't-touch list, so they're held.
- **Unexplained.** One updateHUD frame took 9.3 ms at 1× with no heap drop in that frame.
- **Tuft slices** are capped at 1.5 ms of wall time, so they stay under about 2 ms at any CPU speed.
- **Programs.** In a hand-stepped probe, the pre-round build compiled 16 programs at address, 17 mid-swing (a club matcap part) and 19 after contact (the tracer plus a basic and a phong textured material). The new build holds 22 → 22 → 22.

### T2: `test/swingsim.js` (the real game loop at 60 Hz, synthetic touch, simulated clock)
Each test pulls 99% over 450 ms (ease-out), then flicks in a straight line to 40 px past the start line. Finger samples land on frame times, and the crossing point is swept through the 60 Hz grid in 4 ms steps (5 runs per cell). **Measured:** time from the exact moment the finger crosses to the first frame that draws the ball moved.

| Finger-cross → ball moving (ms) | 80 ms flick | 150 ms flick | 250 ms flick |
|---|---|---|---|
| Driver, before | 110–122 | 87–99 | 67–80 |
| Driver, commit cap 0.05 (brief) | 35–48 | 29–41 | 17–30 |
| **Driver, shipped (0.032)** | **18–31** | **20–33** | **17–30** |
| 7-iron, before | 102–114 | 87–99 | 67–80 |
| 7-iron, cap 0.05 | 35–48 | 25–37 | 17–30 |
| **7-iron, shipped** | **18–31** | **20–33** | **17–30** |

- In the shipped build each case breaks down as: 0–16 ms of sampling delay (cross → the sample that detects it), plus a 29–33 ms commit, which lands contact in the next frame. I couldn't reproduce the brief's 13–29 ms.
- Downswing speed for a+b, last 30% of the time from transition to contact against the first 30%: **10–28×**. For the arm angle alone it's 7–20×.
- Time scale per frame from contact (driver, 150 ms flick): 0 ms **1.000** (the contact frame, where the ball moves), 17 **0.509**, 33 0.521, 50 0.541, 67 0.567, 83 0.598, 100 0.633, 117 0.671, 133 0.711, 150 0.752, 167 0.793, 183 0.833, 200 0.871, 217 0.907, 233 0.937, 250 0.963, 267 0.983, 283 0.996, **300 1.000**. It never hits 0. The 7-iron is identical. The dip starts the frame after contact because the scale is set before the club steps.

### T3
- **Backswing reach** (club angle against target when the finger reaches the bottom of a 350 ms pull): ease-out pull **90.8%**, constant-speed pull 74.2%. *Model only, not the game:* the old ω 11 spring gives 70% and 54% on the same pulls.
- **Peak tip deflection** at 99% power, 150 ms flick:

| Club | Peak deflection |
|---|---|
| Driver (80 / 150 / 250 ms flicks) | 117 / 106 / 100 mm |
| 3-wood | 85 mm |
| 4-hybrid | 85 mm |
| 7-iron | 52 mm |
| PW | 39 mm |
| SW | 39 mm |
| Putter | 0 |

- **Driver trace (150 ms flick).** Times are relative to contact; minus is lag (head behind), plus is lead (head ahead).
  - Takeaway: the head trails by up to 26 mm.
  - Top of the backswing: one wobble as the backswing spring stops.
  - Transition: the sign flips as the downswing starts, and the shaft bows back to +57 mm.
  - At contact: still +55 mm.
  - **Flips forward at +139 ms** and peaks at −106 mm at +205 ms.
  - Then wobbles +44, −23 and +11 mm.
  - The finish starts at +871 ms. From finish + 0.6 s on, the largest deflection is **0.024 mm**.
- **Tempo** (driver, 90% power):

| Hold at bottom | 150 ms flick, before | 150 ms flick, after | 400 ms flick, after |
|---|---|---|---|
| 0 s | 1.000 | 1.000 | 0.993 |
| 0.3 s, no events | 0.930 SLOW TEMPO | 1.000 | 0.992 |
| 0.6 s, no events | 0.705 SLOW TEMPO | **1.000** | 0.992 |
| 0.6 s, finger jitter | 0.705 SLOW TEMPO | **1.000** | 0.992 |
| 1.0 s, finger jitter | 0.600 SLOW TEMPO | 1.000 | 0.993 |

- **Screenshots:** `driver_swing_faceon.png` shows a face-on camera at the top, mid-downswing (shaft lagging 57 mm), impact (lagging 54 mm), +0.2 s (forward 76 mm) and the finish. The HUD is hidden and the images are cropped. The player's down-the-line camera only shows the club near impact.

### T4
- **Texture.** `greens_before_after.png` shows the putting camera at tiers 1, 5 and 9. The blotchy near-camera pattern is gone. Pixel-level speckle on the tier 9 green dropped from 0.63 to 0.53 (mean neighbour luma difference).
- **Slope shading (`test/slopeK.js`).** With K = 5, a 2% slope tilted toward the sun versus away differs by **9.3–15.3%**, depending on sun height (27–45°) and course. Stripe contrast is 4.4–5.0%.
- **Why the Done-when isn't met (measured).** Same build and same view, K = 5 against K = 1: the green gets uniformly brighter (median +3.0 / +4.4 / +2.8% at tiers 1 / 5 / 9), but the light/dark spread across the visible green is only **0.7 / 1.1 / 0.7%** (5th–95th percentile). The engine's geometry explains it. In the 12 × 16 m around the pin, the mean slope is 1.8–2.3%, and it varies by only 0.2–0.5% (median) around that, because pins sit on low-slope spots. Lighting gives a tilted plane one brightness, so there is no high or low side to show. The stripes (4–5%) are stronger than the slope variation you can actually see (about 1%).
- **Seam.** None visible at the green edge in the six shots. That was checked by eye, not numerically.
- **capture.js and bot.js:** output is byte-identical to the pre-round engine. engine.js is unchanged (verified with `diff`).

### T5 (swingsim logs)
- **Approach** (9-iron from 122 m): in the air the ball holds at 4.0×. It starts shrinking 5.9 m above the ground and reaches 1.5× at 0.8 m, before landing. On the ground it maxes at **1.50×** over 223 frames, bounces included. The flag stays at **2.701** from swing start to the next aim, then eases to 1.0 within 0.5 s.
- **15 m putt:** the ball maxes at **1.50×** over 585 frames. The flag holds at 1.0 (15/45 floors at 1).
- **3 m putt:** within 1 m of the cup the ball is 1.00× in every frame.
- **Screenshot:** `putt15_before_after.png` shows the same frame of the same 15 m putt, ball 2.6 m from the cup, at 4× zoom. Before, the ball is wider than the cup opening; after, it's smaller.

### Regression
- The full scripted 6-hole round (`round.js`) completes and saves.
- A pre-round save with no perf setting and a round in progress loads unchanged. Perf comes up off, and Continue resumes at hole 3.
- No page errors in any run.

## 3. What I couldn't verify
- **Everything on a device:** feel, frame rate, iOS touch sampling (60 or 120 Hz), Safari's GC, and WebAudio cost on iOS.
- **Whether 6× CPU throttling resembles an iPhone at all.**
- **GPU and render time** (swiftshader).
- **The T4 slope-reading Done-when.** Not met; see T4.
- **Seam**, beyond checking by eye.
- **The brief's "13–29 ms" figure.** I couldn't reproduce it; my numbers use the first frame that shows the ball moving.

## 4. What to try on the iPhone
1. Pause → **Perf: On** for the whole session.
2. **Five full drivers:**
   - Two as fast a flick as you can.
   - Two slow (about a quarter second).
   - One with a full one-second pause at the bottom, then a normal flick. This one should *not* say SLOW TEMPO.

   Does contact feel immediate, and is the slowdown felt as weight rather than a freeze?
3. **Three or four full 7-irons, watching the shaft:** lag on the way down, the forward kick just after impact, and a wobble that settles. Is it too floppy, too stiff, or too late? The kick lands about 0.14 s after contact.
4. **Putts of 3, 8 and 15 m on a sloped green.** Does the ball always look smaller than the cup? Can you read any slope from the shading? I expect very little.
5. **A full round with Perf on.** Note any "worst" over 25 ms with its mode and section, and what was happening: the first shot of the session, a club change, the ball landing, a hole loading.

## 5. FEEL constants (game.js 1161–1174)

| Constant | Value | What it does |
|---|---|---|
| `addressOmega` | 10 | club easing back to address |
| `back.omega` / `back.zeta` | 16 / 0.8 | backswing spring and its settle at the top |
| `back.putterOmega` | 13 | putter backswing (critically damped) |
| `back.hingeFrom` / `hingeTo` | 0.1 / 0.72 | where the wrists set during the backswing |
| `down.omega` | 40 | downswing spring |
| `down.putterOmega` / `putterExp` | 19 / 1.35 | putter stroke (unchanged) |
| `down.lagExp` | 0.5 | wrist release lag, `b ∝ (a/aS)^lagExp` |
| `commit.base` / `perDeg` / `min` / **`max`** | 0.015 / 1/4000 / 0.02 / **0.032** | time from finger-cross to contact (brief said max 0.05) |
| `commit.v1Gain` / `v1Add` | 2.3 / 200 | club speed at impact (visual) |
| `putterCommit` | base 0.07, perDeg 1/120, min 0.09, max 0.3, v1Gain 1.7 | putter commit (unchanged) |
| `follow.Tf` / `nMin` / `nMax` | 0.8 / 2.5 / 8 | follow-through length and ease shape |
| `follow.putterTf` / `putterN` / `putterOver` | 0.55 / 2.2 / 1.15 | putter follow-through |
| `follow.settleDeg` / `settleRate` | 5 / 2.5 | drift after the finish |
| `dip.at100` / `at30` / `dur` | 0.5 / 0.8 / 0.3 | contact slow-motion |
| `shake.driver` / `other` / `base` / `dur` | 0.03 / 0.02 / 0.004 / 0.24 | camera kick at contact |
| `flex.omega` / `zeta` | 30 / 0.2 | shaft spring |
| `flex.alphaTau` / `alphaMax` | 0.01 s / 900 rad/s² | low-pass and clip on the angular acceleration driving the bend |
| `flex.c` | driver 1.2e-4, wood 0.96e-4, iron 0.6e-4, wedge 0.46e-4, putter 0 | bend per unit angular acceleration |
| `tempoLift` | 6 px | how close to the bottom counts as "still at the bottom" |
| `ballCapEase` / `flagEase` | 0.3 / 0.5 s | size transitions |

Outside FEEL:
- `GREEN_SLOPE_K` = 5 (line 733).
- Tuft budget: 1.5 ms per frame (line 2241).
- Preview cache build: 150 steps per frame (in `computePreview`).

## Suggestions for the next round (not done)
- **Readable slopes.** If the goal is to *see* the high and low sides, normal-based lighting can't do it on these greens. A height-based tint would: lighter above the cup's height, darker below, a few percent per 10 cm.
- **First-use hitches.** Warm up the audio graph and the swing-meter text at hole load. Both touch don't-touch areas.
- **Shaft kick timing.** To land the forward kick closer to impact, raise `flex.omega` (try 40–45) and retune `c`.
