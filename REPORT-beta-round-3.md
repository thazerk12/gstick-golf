# G$tick Golf: beta round 3 report

**Build:** `tempo-golf.html` (255,218 bytes). Published as Version 6 of the same artifact.
**Sources changed:** only `game.js` and `game.src.html`, then `build.py`. `engine.js` is byte-identical to round 2.

**Screenshots and plots:** `test/shots3/` in the source zip.

**How it was tested:** headless Chromium with SwiftShader (software GPU). Unless noted, at 390×844 and DPR 2. Frames are stepped by hand on a simulated clock wherever timing matters.

Nothing here is a phone measurement. No claim is made about smoothness, frame rate or looks on the iPhone 17 Pro.

## Summary against "done when"

| Task | Check | Result |
|---|---|---|
| 1a | Drawn-ball speed CV, putt roll | **0.02%** (R2 20.9%) |
| 1a | Drawn-ball speed CV, contact dip | **0.41%** (R2 30.2%) |
| 1b/d | Largest per-frame camera speed change | **17.9%** of that transition's peak (R2 77–100%) |
| 1b/d | Transitions start and end near zero | Yes: each rises from under 1.0 m/s. Its first frame is ≤12.5% and its last ≤9.3% of its own peak. |
| 1d | Camera to ball during transitions | Never under 3.20 m. The address view is 3.14 m. |
| 1c | Shake code | None left (`grep -i shake` finds nothing) |
| 1e | 120 Hz touch | 0 backward frames. Prediction error: 0° (t² thumb); max 2.79°, mean ≤0.87° (rounded t^1.6 thumb) |
| 1e | 60 Hz touch | 0 backward frames. Prediction error: 0° (t² thumb); max 4.33°, mean ≤1.35° (rounded t^1.6 thumb) |
| 1 | R2 regression: power, dev, tempoMul | Identical in 40/40 `swing2` runs |
| 1 | R2 regression: cross-to-ball | Max 16.7 ms (limit 40) |
| 2 | Flag scale | 1.000 on all 2,249 frames of a full scripted hole |
| 2 | Pin marker | Shown from the tee and in the map view; hidden on the approach and putt |
| 2 | Marker fade | 0 at ≤40 m, 1 at ≥60 m, smooth between |
| 3 | Materials | Every club mesh is flat Lambert with vertex colours, palette colours only |
| 3 | Meshes per club | **3** (R2 8–10) |
| 3 | Ball visible at address, driver | **63.9%** (R2 2.7%) |
| 3 | Ball visible at address, 7-iron | **63.7%** (R2 37%) |
| 3 | Peak shaft deflection within ±10% of R2 | **Not met in 11 of 40 runs:** max +15.1%, mean +5.4%. See Task 3. |
| 4 | Core width at the ball | ≤0.800× drawn ball diameter |
| 4 | Cream core vs background luma (driver) | 16.4–32.9% |
| 4 | Yellow pure core vs background luma | **Not met** against pale sky and bright fairway: 1.0–6.6% |
| 4 | Tracer cost, 1,500 points at 1× | Median 0.1 ms, p95 0.2 ms. **12 of 600 frames over 0.5 ms** (max 2.6 ms). No heap growth. |
| 4 | Fade | Full until 1.2 s after rest, gone at 1.8 s. The next address starts at 1.3 s here. See Task 4. |
| 5 | HUD values | Same as R2 in every logged state |
| 5 | Taps | All ≥44 px |
| 5 | Swing zone | No card below the top 36% at any size |
| 5 | Text contrast | Every text ≥4.5:1 **except warn text**, which is 3.34:1 (large-text 3:1 passes) |
| 5 | Brand face | `document.fonts.check('italic 900 24px Fraunces')` true; canvas meter measured in Fraunces |
| 5 | Logo at 360 px | Fits within the 16 px gutters: 259.6 px wide, 68 px to spare |
| Rules | Saves | Round 1 and round 2 saves load unchanged |
| Rules | Round | 6-hole tour round plays through to the card |

---

## 1. What changed, with line ranges

Line numbers are in the round 3 files.

### Shared

- **game.js 82:** `PALETTE`.
- **game.js 1161–1205:** FEEL. Changed entries are on 1168, 1173–1175, 1196–1201 (see section 5).
- **game.src.html 5:** Fraunces added to the Google Fonts link.
- **game.src.html 23–26:** palette CSS variables, `--f-brand`, `--menu-bg`.

### Task 1: smooth motion

- **a) Render interpolation:**
  - G state, game.js 1706–1707: `ip`, `bd`, `ipAlpha`, `camOrbit`.
  - Start from rest in takeShot, 1879–1880.
  - `ballInterp`, 2152–2158.
  - `updateBallVisual` draws from `bd` (roll spin, position, shadow, ball-size distance), 2160–2218.
  - `flightCam` targets `bd`, 2294–2311.
  - Flight loop, 2407–2416: saves the pre-step ball and calls `ballInterp` before `flightCam`.
  - 2443–2445: `ballInterp` outside flight; `updateBallVisual(sdt)`.
  - Holed, sink and placement snap: `bd = ip = ball` whenever the ball is not flying or rolling.
- **b) Camera spring:**
  - `cam.vel`, `cam.lvel`, 1737.
  - `springAxis`, `springV3`, `camHardSet`, `updateCamera`: 2314–2334 (exact critically damped solution, ω = `cam.k × FEEL.cam.kToOmega`, ground clamp).
  - Intro hard set, 2390.
  - Velocities reset at hole start, 1822.
  - freeCam untouched.
- **c) Shake removed:**
  - takeShot, 1864–1865.
  - Loop comment, 2362.
  - `FEEL.shake` and `G.shake` deleted.
  - The contact dip is untouched.
- **d) Swing-around:**
  - nextShot, 1946–1950: starts `G.camOrbit` when the new aim is more than 60° off the camera heading.
  - addressCam orbit block, 2283–2292: an arc around the ball at constant (eased) radius over `FEEL.cam.orbitT`.
- **e) Touch prediction:**
  - onMove, 2495–2528:
    - Sample time from `e.timeStamp` when it is on the `performance.now` clock.
    - `touchDt` is the mean of the last 4 intervals, clamped to `predictMin..predictMax`.
    - A quadratic through the last 3 samples since the bottom.
  - stepClub `down`, 1428–1472:
    - Prediction from the true sample time plus `lead × touchDt`, capped at `touchDt`.
    - Error easing.
    - Monotone guard once the blend ends.
  - updateClub per-substep time, 1540–1541.
- **f) Measurement only:** no code; see the tests.

### Task 2: flag and pin marker

- **Flag scale removed:**
  - `flagAim` and its calls deleted (old 1807, 1936).
  - `G.flagScale/From/To/T` deleted.
  - `FEEL.flagEase` deleted.
  - `updateFlag` scale is 1 outside the menu, 2220–2235. The menu flyover keeps its rule.
- **Pin marker:**
  - `drawPinMarker`, 2626–2641, called first in `drawFX`.
  - Pole at pin + 2.3 m projected.
  - Alpha = smoothstep(near, far, camera-to-pin distance).
  - Drawn only when the pin is on screen, at a constant 18 px.

### Task 3: clubs

- **Matcaps removed:** all six matcap materials, the groove texture and `matTracer` (old 161, 1201–1222).
- **New club code, game.js 1206–1343:**
  - `matClub`, 1209: Lambert, vertex colours, `flatShading` set as a property (r128's Lambert ignores it as an option, so the facets come from non-indexed geometry).
  - `clubPart` and `mergeParts`, 1212–1231: merge parts into one non-indexed geometry with per-face colours.
  - `buildClubModel`, 1253–1343: three meshes per club.
    - Shaft: the bendable part.
    - Grip with end cap.
    - Head + ferrule band, in the tip group.
  - Head colours by facet normal: face, crown and sole.
  - Contact point recomputed for the scaled heads.
  - Lengths, lies, lofts, plane and `clubSpec` are unchanged.
- **Address camera:** `ADDR`, 2254.
- **Flex:**
  - `stepFlex` is byte-identical to round 2.
  - `FEEL.flex` is unchanged.
  - The bow is applied to the new shaft mesh. The head rides the tip group as before.

### Task 4: tracer

- **Material and geometry, game.js 192–214:**
  - `TR_MAX` 1500.
  - `matTrace`: ShaderMaterial with a `uFade` uniform.
  - `traceRibbon`: preallocated glow ribbon (3 across) and core ribbon (6 across: green edge | core | green edge, with hard colour edges).
  - The `tracer` object is kept for compatibility.
- **Per frame, game.js 2088–2148:**
  - `updateTracer`:
    - Hold and fade.
    - Thinning to 1,500 points.
    - Head point at the drawn ball's back.
    - Taper from 30% at the start to 100% at the ball.
    - Ball-size cap on the core.
    - Brighter head in the air.
  - `setTraceColours`: writes colours only when the shot or point count changes.
- **Hold and fade timing:** shotEnded sets `G.trEnd` (1903); nextShot sets `G.trAim` (1954).

### Task 5: HUD, meter, logo

- **game.src.html:**
  - HUD CSS, 48–107 and 114–120.
  - Perf and maphint offsets, 129 and 134.
  - Landscape rules and logo CSS, 253–265.
  - HUD markup, 276–317.
  - Logo markup, 323.
- **game.js:**
  - `LIE_GLYPH`, `CLUB_SHORT`, `updateHUD`, `showToast`: 2753–2830.
  - Swing meter, hint and flash colours in `drawFX`: 2642–2732.
  - Trail colours, 2733–2735.
  - Brand-face loading before `start`: 3068–3075.
  - `window.__tempo` additions: 3089–3093.

---

## 2. Tests and numbers

The test scripts are in `test/`:
- `motion3.js`: Task 1, parts A–D.
- `flag3.js` and `map3.js`: Task 2.
- `clubs3.js`: Task 3.
- `tracer3.js`: Task 4.
- `hud3.js`: Task 5.
- `fontroute.js`: the local font stand-in.

Regressions: `swing2.js`, `savecompat.js`, `round.js`, `perf.js`.

### Task 1

**Frames.** Every frame time is jittered at random between 6 and 12 ms. The seed is the same for both builds.

**a) Ball speed.** Measured as the drawn ball's speed per frame ÷ the true ball speed at that frame's time.

| | Frames | R3 CV | R3 range | R2 CV | R2 range |
|---|---|---|---|---|---|
| Steady putt roll | 373 | **0.02%** | 1.000–1.000 | 20.9% | 0.52–1.43 |
| Contact slow-mo dip | 32 | **0.41%** | 1.000–1.024 | 30.2% | 0.00–1.58 |

The raw drawn speed varies more than the ratio (R3 17.3% putt, 20.8% dip) because the ball really slows down. The ratio removes that.

**b, d) Camera.** Camera speed per frame through two shots (plot `camera_speed.png`): a full drive, and a shot whose next aim is 109° off.

A "transition" here is a run of frames with speed above 2% of the shot's peak.

| Transition | Peak | Largest per-frame change | Start | End |
|---|---|---|---|---|
| Drive: flight | 50.5 m/s | 6.4% | 4.2% | 2.0% |
| Drive: settle | 11.0 m/s | 11.3% | 10.1% | 9.3% |
| Drive: to next address | 18.8 m/s | **17.9%** | 12.5% | 5.4% |
| Swing-around: flight + settle | 19.0 m/s | 8.7% | 3.9% | 2.1% |
| Swing-around: around the ball | 17.4 m/s | 2.7% | 2.6% | 2.2% |

Change, start and end are shares of that transition's own peak.

- R2, same runs: largest step 77–100% of peak. Every R2 transition starts at its peak (a lerp jumps to full speed on a target change).
- Every transition rises from under 1.0 m/s (2% of the drive's 50.5 m/s peak). The highest first frame is 2.35 m/s, on the move to the next address.
- **Camera to ball:**
  - Minimum 3.20 m in flight and settle.
  - 3.14 m in aim, which is the address distance itself: √(2.7² + 1.6²).
  - R2: 2.47 m.
- **Swing-around:** triggers for every club when the angle is over 60°. The camera circles at the eased radius and does not cut through the ball.

**c)** No shake code remains. `G.shake` and `FEEL.shake` are gone. The dip is unchanged (the dip CV above is with the dip running).

**e) Touch prediction.** Real-loop pointer events with the sample time in `timeStamp`, handled at frame time.

- Sweep:
  - 2 thumb shapes: y ∝ t² from rest; y ∝ t^1.6 rounded to whole px, which is not the estimator's model.
  - 2 clubs: driver and 7-iron.
  - 3 upstroke times: 120, 200 and 300 ms.
- Error = the predicted angle for a sample's time minus the angle at that sample once it arrives.

| Rate | Interval estimate | Backward frames | Error, t² thumb | Error, rounded t^1.6 thumb: max | mean |
|---|---|---|---|---|---|
| 120 Hz | 8.33 ms | 0 in 12 runs | 0° | 1.25–2.79° | 0.62–0.87° |
| 60 Hz | 16.67 ms | 0 in 12 runs | 0° | 0.97–4.33° | 0.20–1.35° |

The ≤2° target holds at 120 Hz for the t² thumb (0°) and on average for the rounded thumb. The rounded thumb peaks above it: 2.79° at 120 Hz, 4.33° at 60 Hz. Those peaks are at the first samples of the upstroke, where a 3-point fit of rounded pixels is weakest.

**f) Load timing.** Measurement only. Four courses, each built fresh.

| Course | buildHole | startRound (≈ buildWorld) | Shader warm-up | First 10 frames (ms) |
|---|---|---|---|---|
| 0 park | 6.7 ms | 268 ms | 1.3 ms | 21.1, 1.9, 1.4, 2.3, 0.8, 0.6, 0.6, 0.7, 8.1, 1.4 |
| 1 links | 2.9 ms | 35,877 ms | 35,624 ms | 15.5, 0.7, 0.3, 4.3, 0.8, 0.3, 0.3, 3.7, 0.5, 2.2 |
| 2 desert | 0.6 ms | 160 ms | 0.9 ms | 14.5, 0.3, 0.2, 5.3, 0.4, 0.2, 0.3, 0.3, 0.2, 0.2 |
| 3 forest | 1.2 ms | 269 ms | 1.5 ms | 18.1, 0.5, 0.1, 0.2, 0.2, 0.2, 0.2, 4.5, 0.3, 9.3 |

- The links figure is SwiftShader compiling the two extra shader programs that course needs (22 against 20), at `renderer.compile`. It was measured while another test shared the CPU.
- The round 2 build in the same test: 22.0 s alone. Round 3 alone, earlier: 21.4 s.
- This says nothing about a phone GPU.

**Round 2 numbers unchanged.** `swing2.js`, 40 runs:
- Power, dev and tempoMul identical in all 40 runs.
- Cross-to-ball max 16.7 ms (R2 16.7 ms).

### Task 2

**Flag scale.** A full scripted hole (415 yd par 4, seed `flag-0`): 2,249 frames, scale 1.000 on every one (min = max = 1).

**Marker visibility:** shown on 1,295 frames: intro 23, aim 187, flight 1,007, settle 78.

**Screenshots** (`flag_*.png`):

| Shot | Camera to pin | Marker | Flag scale |
|---|---|---|---|
| Tee | 372 m | 1 | 1 |
| Approach landing 10 m from the pin | 35.5 m | 0 | 1 |
| Putt at 4.8 m | — | 0 | 1 |

**Map view** (`map3.js`, `pin_map.png`): marker 1, map button in its green "on" state.

**Fade against distance** (free camera looking at the pin):

| Distance | 40.1 m | 42.6 m | 45.1 m | 50.1 m | 55.1 m | 57.6 m | 60.1 m and over |
|---|---|---|---|---|---|---|---|
| Alpha | 0 | 0.045 | 0.161 | 0.506 | 0.849 | 0.960 | 1 |

### Task 3

**Screenshots:** `clubs_sheet.png`. Five classes (driver, 3-wood, 7-iron, wedge, putter) at address, top and finish, each down-the-line and face-on, plus head close-ups.

**Materials:** every club mesh is `MeshLambertMaterial`, `flatShading` true, vertex colours. The only colours in the vertex data are `#e4dac0`, `#1f3a2a`, `#2f5641`, `#e3b93f` and `#f3ecd8`: cream2, green, green2, yellow and cream.

**Meshes and triangles per club:**

| Club | R3 meshes | R3 triangles | R2 meshes | R2 triangles |
|---|---|---|---|---|
| Driver, 3-wood | 3 | 452 | 10 | 647 |
| 7-iron, wedge | 3 | 464 | 8 | 907 |
| Putter | 3 | 388 | 10 | 802 |

Draw calls: the club drops by 5–7. The tracer adds 1 (glow + core in place of one strip). Net fewer.

**Ball visibility at address** (pixels of the ball not covered by the club, from the address camera; `address_ball.png`):

| | ADDR.up | ADDR.back | ADDR.down | Driver | 7-iron |
|---|---|---|---|---|---|
| R2 | 1.28 | 2.7 | 4.5 | 2.7% | 37% |
| R3 | 1.60 | 2.7 | 7 | **63.9%** | **63.7%** |

How it got there, and the two deviations:
- **ADDR.up** +25% (1.28 → 1.6), inside the allowance. **ADDR.down** 4.5 → 7 is outside what the brief allowed (only up and back). With up raised, the ball dropped to the bottom of the screen; aiming the address view lower brings it back to about where it sat.
- **Head height is not a uniform 1.25.** At a uniform 1.25× the heads hid the ball even at ADDR.up +25% (driver 0%, 7-iron 18%). So the heads are 1.25× in length and depth, and their height is scaled by class: wood 0.5, iron 0.65, putter 1 (`FEEL.club.headH`). Lofts are unchanged because the face is built from the loft angle.

**swing2 outcomes.** Identical power, dev and tempoMul in 40/40 runs.

**Peak shaft deflection, |R3| ÷ |R2| per run:**
- Range 0.956–1.151, mean 1.054.
- **11 of 40 runs are over +10%.**
- The largest are at the 4 ms phase (+14–15%).

Supported:
- The club redesign doesn't enter the bend. `stepFlex` and `FEEL.flex` are byte-identical to R2, and the bend is driven only by the club's angular motion.
- The ratio depends on where the upstroke starts against the 60 Hz frame grid. The mean is 1.02 at the 0 ms and 12 ms phases and 1.11 at 4 ms. A geometry change would scale every run the same way.

Inferred: the change comes from Task 1e's predictor, which shapes the angular motion.

The predictor's `lead` was swept. No value meets both peaks within ±10% and flips within ±20 ms:

| lead | Peak ratio range | Runs over +10% | Flip range |
|---|---|---|---|
| 0.7 | 0.75–1.08 | 0 | −39 to +3 ms |
| 0.8 | 0.96–1.19 | 13 | −22 to +34 ms |
| **0.85 (used)** | 0.96–1.15 | 11 | **−23 to +14 ms** |
| 0.9 | 0.95–1.11 | 4 | −25 to +10 ms |
| 1.0 | 0.94–1.20 | 9 | −29 to +1 ms |

R2's own flip range is −18.8 to +13.2 ms, with 0 runs outside ±20 ms. With lead 0.85, **9 of 40 runs flip 1.5–3.0 ms outside the ±20 ms window** (−21.5 to −23.0 ms). `releaseLead` and the other flex values are untouched (DON'T TOUCH).

### Task 4

**Screenshots** (`tracer_*.png`): driver against the sky (flight camera) and onto grass (settle camera), then the same for a pure strike.

**Contrast.** Luma at points along the core centre line, with the tracer drawn vs hidden: |ΔL| ÷ L(background).

| Shot | Against sky: min | median | Against grass: min | median |
|---|---|---|---|---|
| Driver, flight cam (cream core) | 18.8% | 22.2% | 16.4% | 32.9% |
| Driver, settle cam (cream core) | — | — | 20.6% | 23.3% |
| Pure, flight cam (yellow core) | **1.3%** | **2.9%** | **1.0%** | **6.6%** |
| Pure, settle cam (yellow core) | — | — | 21.0% | 23.0% |

The yellow pure core fails ≥15% against the pale sky and the sunlit fairway, because `#E3B93F` is close in luma to both. The glow and green edge still outline it (see `tracer_pure_sky.png`), but the core itself doesn't stand out by luma.

**Core at the ball:** ≤0.800× the drawn ball diameter on every air frame (max 0.80008, float rounding).

**Fade, after the ball comes to rest:**

| Time | Tracer |
|---|---|
| Until 1.2 s | Full |
| 1.28 s | 0.95 |
| **1.30 s (next address starts)** | 0.93 |
| 1.48 s | 0.54 |
| 1.68 s | 0.10 |
| 1.8 s | Gone |

The brief asks for three things that can't all hold here:
- Hold 1.2 s.
- Fade 0.6 s.
- Gone by the next address.

Settle hands over to aim 1.3 s after rest. So the tracer is still at 93% when aim starts. It is gone 0.5 s later, about when the address camera arrives (that camera move takes about 0.75 s). There is also a 0.6 s fade-out from the start of aim, so it can never outstay the address by more than that. To have it gone exactly at aim, `FEEL.tracer.hold` would need to be about 0.7.

**Cost.** 1,500-point path, 600 frames at 1×, run alone:
- Median 0.1 ms, p95 0.2 ms.
- **12 of 600 frames (2%) over 0.5 ms**, max 2.6 ms.
- An earlier run gave p95 0.3 ms and max 4.2 ms.
- JS heap did not grow: it ended lower than it started.

So the 0.5 ms budget holds at p95 but not on every frame. `updateTracer` makes no allocations that I could find (the per-frame arrays, `for…of` iterators and Colors were removed). Inferred: the spikes are engine or OS pauses landing inside the section, not tracer work. Not proven.

### Task 5

**Screenshots:**
- `hud_390x844.png`, `hud_430x932.png`, `hud_844x390.png`.
- `hud_360x780_menu.png`.
- Each sheet: aim on the tee, aim from the rough with the penalty, mid-pull (62%), overswing (107–108%), flight with the PURE toast, putt, a WATER penalty toast, and the menu.
- The flight toast is re-shown for the screenshot because its 1.4 s real-time timer runs out while SwiftShader renders.

**HUD values, R3 next to R2.** Same build states: tee, flight, after the drive, rough, putt.
- Every value matches: hole, par, length, shot number, pin distance (yd; ft on the green), lie, penalty, Stimp, score, wind speed, unit, arrow rotation (identical transform strings), description, carry and toast text.
- Wording that changed by design:

| R2 | R3 |
|---|---|
| "Driver" / "8 Iron" / "Putter" | D / 8I / P |
| "245 yd carry" | 245 yd |
| "Full pull 33 ft" | 33 ft |
| "Rough · −16% distance" | Rough / distance / −16% in warn |
| MAP/DONE label | Map button filled green when on |

- The bottom HUD dims to 0.45 in flight, as before.

**Taps** (all sizes):

| Target | Size |
|---|---|
| Pause | 52×52 |
| Map | 56×56 |
| ‹ | 44×44 |
| › | 44×44 |

**Swing zone.** Every card's bottom edge vs the top 36% line:

| Size | Line | Stack | Hole card | Toast |
|---|---|---|---|---|
| 390×844 | 304 px | ≤158 | 74 | 251 |
| 430×932 | 336 px | ≤158 | 74 | 272 |
| 844×390 | 140 px | 54 (stack is a row) | 74 | 121 |

**Contrast** (WCAG, computed colours):
- All text is green on cream (10.5:1), cream on green (10.5:1) or yellow on green (6.6:1).
- **Exception: warn text.**
  - The lie penalty (19 px, 800 weight) and the WATER / OUT OF BOUNDS toast labels (30 px) are 3.34:1 on cream.
  - They pass only the large-text 3:1 rule.
  - No palette surface gives warn 4.5:1: cream 3.34, green 3.14.
  - `#B94529` would reach 4.51:1 on cream if you want to change it.

**Fonts:**
- `document.fonts.check('italic 900 24px Fraunces')` is true at all three sizes, with one Fraunces face (italic 900) in `loaded` state.
- Canvas: `'italic 900 30px Fraunces, Georgia, serif'` measures 129.0 px for "87% 245" against 107.5 px for Georgia, so the meter text is in Fraunces.
- With the font requests blocked:
  - The game starts at once with Georgia (`G.brandFont` false).
  - `fonts.check` still returns true, because with no Fraunces face declared it has nothing to wait for. So `G.brandFont` records whether a face actually loaded.
- Google Fonts is blocked from this sandbox. The test answers the css2 request with a local Fraunces instanced at exactly ital 1, opsz 9, wght 900, SOFT 50, WONK 1 (from npm `@fontsource-variable/fraunces` 5.3.0, cut with fontTools), plus local Archivo and Big Shoulders.

**Logo.** One line at every size. Width is the text plus the club SVG.

| Viewport | Font size | Width | Left edge | Right edge | Spare inside the 16 px gutters |
|---|---|---|---|---|---|
| **360** | 45 px | **259.6 px** | 16 | 275.6 | **68.4 px** |
| 390 | 48.75 px | 281.3 px | 16 | 297.3 | 76.7 px |
| 430 | 53.75 px | 310.1 px | 16 | 326.1 | 87.9 px |
| 844 landscape | 96 px | 553.9 px | 66.6 | 620.5 | on screen |

In landscape the menu column is 540 px wide, so at the 96 px cap the wordmark runs 13.9 px past the column's right edge. It is still well inside the screen. I kept the brief's exact font-size rule.

**Swing still starts anywhere in the zone:** `swing2.js` unchanged (40/40 identical outcomes). `hud3.js` starts swings by pressing at mid-screen at all three sizes.

### Regressions

- **Saves:** both load and keep their values, with no errors:
  - A round 1 save (no `settings.perf`, round in progress).
  - A round 2 save (`settings.perf: true`).
- **`round.js`:** a 6-hole tour event plays to the card and saves stars and coins. It timed out once while another test shared the CPU, and passed alone.
- **`perf.js`** (6× CPU throttle, JS section times over a scripted hole). Both builds were run fresh this session, one after the other, nothing else running.

| Section | R3 median | R3 p95 | R3 frames over 4 ms | R2 median | R2 p95 | R2 frames over 4 ms |
|---|---|---|---|---|---|---|
| updateTracer | 0.1 | 3.1 | 28 of 682 | 0.1 | 2.3 | 14 of 390 |
| drawFX | 0.1 | 1.8 | 11 of 697 | 0.1 | 1.8 | 10 of 438 |
| updateHUD | 0.3 | 1.6 | 1 of 42 | 0.2 | 1.6 | 0 of 53 |
| takeShot | 2.7 | 11.4 | 1 of 3 | 5.7 | 9.8 | 2 of 3 |
| toast/HUD (at contact) | 6.7 | 6.7 | 1 of 2 | 1.0 | 1.4 | 0 of 3 |
| control (fixed work) | 0.1 | 1.9 | 53 of 1,959 | 0.2 | 2.0 | 42 of 1,931 |

All times in ms.
- The control row shows the throttler's own pauses: about 2–3% of frames go over 4 ms with no extra work.
- R3 updates the tracer for more frames, because it now holds and fades through settle.
- Shader programs: 21 (R2 22).
- The one 6.7 ms toast/HUD sample was checked at 1× over 30 contacts in three runs:
  - Median 0.1 ms; max 0.8, 1.8 and 4.1 ms.
  - R2: max 0.2 ms.
  - The 4.1 ms case was inside `updateHUD`. It has no code that forces layout, so I can't pin it; GC is the likely cause, but that is inferred.
  - Moving the contact-frame HUD and toast write to the next frame is a cheap option if the phone shows a hitch at contact.

---

## 3. Not verified

- Anything on a phone: frame rate, stutter, touch latency, how the spring camera or the tracer look, legibility, safe areas on a real notch.
- The live Google Fonts response in a browser. A fetch of the Fraunces part of the URL returns an `@font-face` for Fraunces italic 900. The fetch tool keeps only the first `family=` parameter, so the combined URL couldn't be fetched whole, and the sandbox shell is blocked.
- The pinned axes (opsz 9, SOFT 50, WONK 1) as Google serves them. Locally they come from my own instance.
- Real touch timestamps. The predictor uses `e.timeStamp` only when it is within 100 ms of `performance.now()` (true on current iOS and Chrome). Otherwise it falls back to the handling time.
- Shader compile time on a phone GPU (the SwiftShader links figure means nothing there).
- The 120 Hz touch path with real coalesced events.

## 4. iPhone 17 Pro checklist

1. **Full hole with Perf on** (pause → Perf). Note the fps and worst frame while:
   - the ball rolls on a long putt
   - during the backswing and downswing
   - at contact (the slow-mo dip)
   - during each camera move: contact → flight, landing → settle, settle → next address
   - in a swing-around (hit one well offline so the next aim is more than 60° off)
2. **Long drive on a 400+ yd hole.** Is the flag a normal size from the tee? Is the 18 px marker readable above it? Does it fade out cleanly between 60 and 40 m as you approach?
3. **Approach.** Watch the flag next to the ball as it lands. It should be its real size now.
4. **Every club at address.** Can you see the ball over the head? Then a full swing with each. Does the shaft bow and kick look right? Is the club readable at the top and finish?
5. **A pure drive and a mishit.** Is the tracer readable against the sky? The yellow pure core is the weak case. Does the tracer fade while the next address arrives?
6. **Every HUD state** in portrait and landscape:
   - tee
   - rough with the penalty
   - bunker with and without a wedge
   - green (ft and Stimp)
   - mid-pull and overswing meter
   - PURE and penalty toasts
   - map on and off
   - pause
   - the menu logo

   Check the warn text (penalty, WATER) for legibility in sun.

## 5. FEEL, PALETTE and fonts

### PALETTE (JS `PALETTE` and CSS variables)

| Name | Value | Used for |
|---|---|---|
| cream | `#F3ECD8` | Cards, club grip cap and sight lines, tracer core, meter track, logo |
| cream2 | `#E4DAC0` | Shaft, wood sole, iron blade, pressed buttons |
| green | `#1F3A2A` | Text, card strip, hole block, club button, grip, crown, meter fill and outline, tracer edge |
| green2 | `#2F5641` | Club faces |
| yellow | `#E3B93F` | Accent: ferrule band, wood stripe, meter last 10% and notch, carry text, pure core, glow, PURE underline |
| warn | `#D45A3C` | Overswing zone and fill, penalties |

Also new in CSS: `--f-brand: 'Fraunces', Georgia, serif`, and `--menu-bg: #0c1510`.
- `--menu-bg` is the colour behind the wordmark. It exists only because the brief asks the club's stroke to match the background; it is not a palette colour.
- Card shadows use green at 28% alpha.

### FEEL: new or changed

| Key | Value | Was |
|---|---|---|
| `down.predict` | removed | 1/60 |
| `down.predictMin` | 1/120 s | — |
| `down.predictMax` | 1/60 s | — |
| `down.lead` | 0.85 (× touch interval) | — |
| `shake` | removed | `{ driver 0.03, other 0.02, base 0.004, dur 0.24 }` |
| `cam.kToOmega` | 1.5 | — |
| `cam.orbitDeg` | 60° | — |
| `cam.orbitT` | 1.1 s | — |
| `flagEase` | removed | 0.5 s |
| `tracer.wPerM` | 0.004 (core half-width per m from the camera) | — |
| `tracer.wMin` / `wMax` | 0.025 / 1.6 m | — |
| `tracer.start` | 0.3 (taper at the start) | — |
| `tracer.glow` | 2.2 (× core width) | — |
| `tracer.edge` | 0.22 (green edge share of core width) | — |
| `tracer.glowA` / `coreA` | 0.45 / 0.94 | — |
| `tracer.headBoost` | 1.0 | — |
| `tracer.ballMax` | 0.8 (× drawn ball diameter) | — |
| `tracer.hold` / `fade` | 1.2 / 0.6 s | — |
| `meter.w` | 22 px | (14) |
| `meter.gap` | 40 px from the swing line | (44) |
| `meter.yellowFrom` | 0.9 | — |
| `meter.pctPx` | 30 px | (22) |
| `fontWait` | 1.5 s | — |
| `pinMarker.far` / `near` / `h` | 60 m / 40 m / 18 px | — |
| `club.shaftR` | [0.0126, 0.0075] m (top, tip) | [0.0074, 0.0044] in code (×1.70) |
| `club.gripR` | [0.019, 0.0146] m | [0.0126, 0.0097] (×1.51) |
| `club.putterGripR` | [0.022, 0.0177] m | [0.0148, 0.0118] (×1.49) |
| `club.head` | 1.25 (length and depth) | 1 |
| `club.headH` | wood 0.5, iron 0.65, putter 1 | — |
| `club.seg` | 8 radial segments | 12 shaft, 18 grip |

`ADDR` is not in FEEL; it was already its own constant. It is now `{ back: 2.7, up: 1.6, ahead: 30, down: 7 }` (was up 1.28, down 4.5).

### Google Fonts URL

```
https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Big+Shoulders+Display:wght@700;800;900&family=Fraunces:ital,opsz,wght,SOFT,WONK@1,9,900,50,1&display=swap
```

### window.__tempo additions

- `state().camSpring`: `{ omega, vel, lookVel, orbit }`.
- `state().ipAlpha`.
- `state().touchDt`: during a swing.
- `state().ballDrawn`.
- `state().pinMarker`.
- `state().flagScale`: now read from the flag mesh.
- `brandFont()`.
- `ADDR`, `PALETTE`, `clubModels`, `showToast`, `nextShot`.

## Deviations from the brief

1. **`ADDR.down` 4.5 → 7.** Outside the allowance, which covered only up and back. It keeps the ball on screen after `up` +25%.
2. **Head height by class** (wood 0.5, iron 0.65, putter 1) instead of a uniform 1.25. Needed for ≥60% ball visibility.
3. **Peak shaft deflection** up to +15.1% (11/40 runs over +10%). Flip −23.0 to +14.1 ms, with 9/40 runs just outside ±20 ms. Cause inferred: the Task 1e predictor (lead table above). Flex values untouched.
4. **Warn text** is 3.34:1 on cream. It passes the large-text rule only.
5. **Pure yellow core** contrast 1–6.6% against pale sky and fairway.
6. **Tracer** is still at 93% when the next address starts. Gone 0.5 s later.
   - Its cost exceeds 0.5 ms on 2% of frames (p95 0.2 ms).
7. **Touch prediction** peaks 2.8° (120 Hz) and 4.3° (60 Hz) on a rounded-pixel thumb. Uses `e.timeStamp` when it is on the same clock.
8. **Club labels** use a smaller suffix letter (8**I**, 3**W**), so "8I" doesn't read as "81" in Fraunces italic.
9. **Overswing zone** on the meter track is warn at 30%. The fill past 100% is solid warn, so the two stay distinguishable.
10. **"PULL DOWN · FLICK UP" hint** is now kept fully on screen (it was clipped at 390 px with Archivo loaded), and recoloured to cream.
