# G$tick Golf: beta round 7 report

**Build:** `tempo-golf.html` (343,827 bytes); site build `6d194445e7` (the hash in `sw.js`). Save key still `tempo-golf-v1`.
**Sources changed:** `game.js` and `game.src.html` (the version label only), then `build.py`. `engine.js` is byte-identical to round 6.
**Live:** https://thazerk12.github.io/gstick-golf/ (see "Publishing" at the end).
**Files:** `gstick-golf-round7-screens.zip` (the screenshots named below, by task) and `gstick-golf-round7-results.zip` (the raw JSON and logs). The tests are in `test/` in the repo.

**How it was tested:** headless Chromium with a software GPU (SwiftShader). Frames are stepped by hand on a simulated clock, and touches are synthetic pointer events. "R6" is the round 6 build (main at `e331c15`); "R7" is this build. The test sizes have no notch unless noted, so the iPhone's insets are not in the measurements.

Nothing here was measured on a phone. These numbers say nothing about how it feels or looks on the iPhone.

## Read this first: where I went past or around the brief

**1. Green tint: tintH is 0.10, not 0.15 (Task 3).** With the brief's start values (tintA 0.30, tintH 0.15) the brightness spread on the visible green was **1.92×, 2.24× and 2.24×** round 6 (tiers 1, 5, 9), short of 2.5×. Raising tintA instead clips the bright greens (0.40 / 0.15 clips a colour channel on 37% of the tier 5 green). With **tintA 0.30 and tintH 0.10** the spread is **2.84×, 2.71× and 2.65×**; 1.1% of the tier 5 green pixels clip a channel (0% in R6), and the hue and saturation percentiles don't move. A side effect you will see: small dips away from the pin now show as darker patches (the PURE 7-iron flight frame in Task 5 shows it). Both numbers are in `FEEL.green`; 0.15 gives broader, softer shading.

**2. Putter: I lowered the head and moved the parts that were in the way (Task 2b).** Lowering the head alone got the ball to only 77% visible; raising the putting camera got it to 83% and pushed the ball to 90% down the screen. What actually covered the ball was the neck (it rose from the middle of the head, right behind the ball) and the face insert (taller than the lowered body). So the head is 0.5 high, the neck rises from the heel (`FEEL.club.putterNeckX` 0.03 m) and the insert is no taller than the body. The putting camera is unchanged. The ball is now **94.5–100% visible** in every preset.

**3. The live ring is drawn on the overlay canvas, not as a ribbon on the course (Task 1a).** A ring draped on the ground is about 2 px tall at 200 m from the address camera (1.1 m up), so it can't meet 14 px or read at 250 yd. The ring's points are still draped on the course (or the drawn green on putts) and projected, then drawn on the 2D overlay as a 2.5 px cream line with a soft dark edge, at least 14 px across and never flatter than 0.3 (height / width) about its true centre. It's clipped out of the ball's disc. Being on the overlay, it draws over the club if the club passes over it.

**4. The chevron now sits above the ball (Task 1b).** A 112% pull at 32% of the height doesn't fit from under the ball. The chevron sits where a 112% pull ends 8 px above the bottom edge (and above the bottom safe-area inset): 25–29 px above the ball for full swings and 95–112 px above it on putts at 360×780 to 430×932, and 62 px (putts 139 px) above it at 402×874 with a 34 px bottom inset. Any press still starts a swing, as in round 6.

**5. Tempo: I also scaled the lift threshold, and 60 Hz sampling still shows (Task 1b).** The brief named the tempo threshold; I scaled `tempoLift` (where the downswing clock starts, 6 → 7.68 px) by 1.28 too, because without it the slow-tempo results moved by up to 0.015. With both scaled, swing4's tempo is identical in all 108 runs. In swing2's slow case (a 450 ms upstroke) 10 of 50 runs differ by up to 0.0072, and 5 runs that R6 scored 0.955 (SLOW, under 0.96) score 0.962 in R7 (not SLOW). A finger path scaled 1.28× in time doesn't land on the same 60 Hz samples, so the measured time moves by up to one frame; it can't be bit-identical.

**6. The club follows the pull, not the curved power.** The club's backswing angle and the 3% "too short, cancel" check use the pull fraction. With the curve, a 50% pull is 42% power; the club still goes halfway back.

**7. Long clubs: steeper only, and a little more than the minimum (Task 4).** I steepened the drawn plane and left its radius alone: DR, 3W, 4H, 5I and 6I are drawn on a plane 17°, 14°, 10°, 6° and 4° steeper than their lie. It eases in over the first 35% of the backswing angle and back out over the last 35% of the downswing (the last 2–3 frames before contact), so address, contact and the follow-through are drawn as before. At 390×844 these leave 16–22 px between the club and the left edge at its farthest point for all five clubs (the 7-iron has about 1 px). I chose that margin; at the minimum the clubs would graze the edge. Standard is 100% for DR–6I.

**8. The putter set-back is for putts only.** On putts the putter sits `clubBack()` (4.8 mm) further back, so the face meets the 1.25× ball rather than going through it. Full swings are untouched.

## Summary against "done when"

| Task | Done when | Result (headless) |
|---|---|---|
| 1 | Ring within 0.3 m (full) / 5 cm (putts) at 25/50/75/100/110% | **0 m** at every pull for DR, 7I, PW, 3 m and 8 m putts (the ring is placed at start + the card's distance along the aim). |
| 1 | Mid-pull screenshots DR, 7I, 8 m putt at 390×844; 0 px over the ball | Done (75% and 110%). **0 px** changed inside the ball's disc in all 25 cases. |
| 1 | yd/px at 25/50/100% for DR/7I/PW, ft/px for putts, R6 vs R7 | Table in 2.1. E.g. DR at 25%: 1.16 → 0.86 yd/px; a 30 yd PW chip is a 51 → 87 px pull. |
| 1 | swing2 / swing4 identical for the scaled finger path | swing2: path identical in 50/50, power within 0.0007, tempo within 0.0072 (the slow case; see 5 above). swing4: tempo identical in 108/108, path within 0.0039 and power within 0.0019 (whole-pixel finger positions). |
| 1 | Full and 112% pulls fit from the chevron at 390×844, 430×932, 360×780 | Yes: the 112% pull ends 8 px above the bottom at all three (and above a 34 px inset at 402×874). |
| 2 | Ball px and visible share at 402×874, 1.5/4/10 m, each preset, R6 vs R7 | Ball 1.25× (e.g. Standard 4 m: 13.3 → 16.7 px); visible **64–81% → 94.5–100%**. |
| 2 | Per-frame scale log, holed putt and chip onto the green; hole-out screenshots | Scale 1.25 in every frame of two holed putts and a lip-out; the chip glides 1.26 → 1.25 as it lands in the fringe and stays 1.25 on the green. The drawn ball never goes through the rim or the wall (R6: up to 3.9 mm through the rim). |
| 3 | P5–P95 spread ≥ 2.5× R6, tiers 1/5/9 | **2.84×, 2.71×, 2.65×** (with tintH 0.10; see 1 above). |
| 3 | R6 vs R7 screenshots; capture.js, bounce4.js, bot.js identical | Done; capture and bounce4 identical, bot identical except its wall-clock timing line. |
| 4 | ≥ 90% of downswing frames at Standard, every club | **100%** for DR–6I at both sizes (R6: 26–75%); 7I–LW 98–100%. |
| 4 | swing2 / swing4 identical shots and fire frames; flip within ±20 ms | Shots, fire, crossing and ball times identical with the steeper plane on and off; flip within 20 ms in 50/50 and 108/108 runs. |
| 4 | DR and 5I frame strips | Done, R6 vs R7. |
| 5 | R6 vs R7 screenshots, drive / PURE 7I / wedge, mid-flight and at rest, peak brightness vs sky and fairway | Done. The cream tracer's 95th-percentile brightening over the fairway falls from 58–65 to 31–35 (0–255 luma), and its peak from 233–236 to 208–218; over the sky the brightening falls from 115–164 to 56–83. |

## 1. What changed, with line ranges (game.js unless noted)

### Task 1: power you can see and control
- `FEEL` 1255 (`tempoLift` 7.68), 1286–1302 (`swingZone` 0.32 / 179.2 / 332.8, `power.exp` 1.25, `tempo` 0.4352 / 0.5859 / 0.6, `ring`), 1325 (`hint.fitK`).
- Swing input: `startSwing` 3160 (`pull`), `swingMove` 3181–3183 (`s.pull`, `s.power = pullPower(s.pull)`), fire 3280 (cancel on the pull), 3290 (tempo from `FEEL.tempo`).
- `pullPower`, `pullCarry` 3105–3108. Power card 3592 (`pullCarry`).
- Club backswing on the pull: 1643–1645.
- Ring: `drapeRing` gains a lift (2338–2343); `PR`, `updatePowerRing`, `drawPowerRing` 2352–2399; called from `updateAimVisuals` 2401 and `drawFX` 3475.
- Chevron: `safeBottom` 1984–1986, `chevronAt` 3413–3417.

### Task 2: bigger, unhidden putting ball
- `FEEL.ballGreenK` 1.25 (1284); putter `headH` 0.5 and `putterNeckX` 0.03 (1337); insert and neck 1495–1498.
- `updateBallVisual` 2561–2599: the green ball at 1.25×, the fringe blend, the rim clamp.
- Hole-out: `startSinkAt` 2621–2627, `stepSink` 2638–2645, the sink branch of `updateBallVisual` 2552–2556 (drawn radius, relief offset faded below the rim).
- `clubBack` 2516 (putts only), used at 1771–1774 and 2115.

### Task 3: green shading
- `FEEL.green` tintA 0.30, tintH 0.10 (1344). No shader change.

### Task 4: long clubs through the downswing
- `FEEL.swingSteep` (1343). `setupClub` stores the plane centre and calls `setPlane` (1579–1590). `updateClub` sets the steeper plane each frame (1776–1779).

### Task 5: tracer
- `FEEL.tracer` (1285): no `glow` / `glowA`; `coreA` 0.5, `headBoost` 0.25.
- The glow ribbon is gone (198–220); `updateTracer` 2449–2495 writes the core only, alpha `coreA × (1 + headBoost × head)`; `setTraceColours` 2497–2503.

### Version label and test hook
- `game.src.html`: `#verLabel` "Round 7".
- `window.__tempo` (3954–3958): `hFast`, `pullPower`, `pullCarry`, `powerRing()`, `clubBack`, `sinkRd()`, `puttBall()` (the green ball scale, in FEEL and now), `tint()` (tintA, tintH in use), `swingSteep()` (the drawn plane steepening now, degrees).

## 2. Tests and numbers

### 2.1 Task 1: power

**Ring accuracy (`test/ring7.js`, 390×844, real gesture: press at the chevron, pull straight down and hold).**

| Club (lie) | Pull | Power | Card | Ring distance | Error | Across × tall (px) | Colour |
|---|---|---|---|---|---|---|---|
| DR (Tee) | 25% | 0.177 | 18% · 43 yd | 39.6 m (43 yd) | 0 m | 70.7 × 21.2 | cream |
| DR (Tee) | 50% | 0.420 | 42% · 103 yd | 94.2 m (103 yd) | 0 m | 58.9 × 17.7 | cream |
| DR (Tee) | 75% | 0.698 | 70% · 171 yd | 156.4 m (171 yd) | 0 m | 61.1 × 18.3 | cream |
| DR (Tee) | 100% | 1.000 | 100% · 245 yd | 224.0 m (245 yd) | 0 m | 62.2 × 18.7 | cream |
| DR (Tee) | 110% | 1.100 | 110% · 274 yd | 250.4 m (274 yd) | 0 m | 62.4 × 18.7 | warn |
| 7I (Fairway) | 25% | 0.177 | 18% · 29 yd | 26.7 m (29 yd) | 0 m | 95.9 × 28.8 | cream |
| 7I (Fairway) | 50% | 0.420 | 42% · 69 yd | 63.4 m (69 yd) | 0 m | 56.4 × 16.9 | cream |
| 7I (Fairway) | 75% | 0.698 | 70% · 115 yd | 105.3 m (115 yd) | 0 m | 59.5 × 17.8 | cream |
| 7I (Fairway) | 100% | 1.000 | 100% · 165 yd | 150.9 m (165 yd) | 0 m | 61.0 × 18.3 | cream |
| 7I (Fairway) | 110% | 1.100 | 110% · 185 yd | 168.8 m (185 yd) | 0 m | 61.4 × 18.4 | warn |
| PW (Fairway) | 25% | 0.177 | 18% · 22 yd | 20.0 m (22 yd) | 0 m | 117.3 × 35.2 | cream |
| PW (Fairway) | 50% | 0.420 | 42% · 52 yd | 47.7 m (52 yd) | 0 m | 60.7 × 18.2 | cream |
| PW (Fairway) | 75% | 0.698 | 70% · 87 yd | 79.1 m (87 yd) | 0 m | 57.9 × 17.4 | cream |
| PW (Fairway) | 100% | 1.000 | 100% · 124 yd | 113.4 m (124 yd) | 0 m | 59.8 × 18.0 | cream |
| PW (Fairway) | 110% | 1.100 | 110% · 139 yd | 127.1 m (139 yd) | 0 m | 60.4 × 18.1 | warn |
| PT 3 m (Green) | 25% | 0.250 | 5 ft | 1.50 m (4.9 ft) | 0 m | 83.3 × 25.0 | cream |
| PT 3 m (Green) | 50% | 0.500 | 20 ft | 6.00 m (19.7 ft) | 0 m | 40.3 × 12.1 | cream |
| PT 3 m (Green) | 75% | 0.750 | 44 ft | 13.50 m (44.3 ft) | 0 m | 21.7 × 6.5 | cream |
| PT 3 m (Green) | 100% | 1.000 | 79 ft | 24.00 m (78.7 ft) | 0 m | 14.1 × 4.2 | cream |
| PT 3 m (Green) | 110% | 1.100 | 95 ft | 29.04 m (95.3 ft) | 0 m | 14.1 × 4.2 | warn |
| PT 8 m (Green) | 25% | 0.250 | 5 ft | 1.50 m (4.9 ft) | 0 m | 79.9 × 24.0 | cream |
| PT 8 m (Green) | 50% | 0.500 | 20 ft | 6.00 m (19.7 ft) | 0 m | 39.2 × 11.8 | cream |
| PT 8 m (Green) | 75% | 0.750 | 44 ft | 13.50 m (44.3 ft) | 0 m | 21.3 × 6.4 | cream |
| PT 8 m (Green) | 100% | 1.000 | 79 ft | 24.00 m (78.7 ft) | 0 m | 14.0 × 4.2 | cream |
| PT 8 m (Green) | 110% | 1.100 | 95 ft | 29.04 m (95.3 ft) | 0 m | 14.0 × 4.2 | warn |

- The ring is drawn at the ball + the card's distance along the aim, so the world error is 0 at every pull. On screen there is a limit you should know about: at 224 m from a camera 1.1 m up, one pixel of screen height is about 40 m along the ground, so the drawn ring can't place the carry finer than that at driver distances.
- **It never covers the ball:** the overlay drawn with and without the ring differs in **0** of the ball disc's pixels in all 25 cases.
- **Smooth pull (0 → 112% over 40 frames):** the ring's distance rises every frame (monotone in all five cases) and moves at most 7.8 m (DR), 5.2 m (7I), 4.0 m (PW), 1.5 m (putts) per frame. It first shows once the distance passes 1.5 m (putts 0.3 m).
- **Landing guide off:** no ring. **Contact:** the ring is drawn up to the contact frame and gone from the first flight frame.
- Other sizes: at 430×932 and 360×780 the same 25 cases give 0 m error, at least 14 px across, and 0 px over the ball; the smooth pull, guide-off and contact checks give the same results.
- Screenshots: `ring/ring_390x844_{DR,7I,PT8m}_{75,110}.png`, sheet `ring/ring_sheet_390.jpg`.

**Yards per pixel (`test/perpx7.js`, 390×844: swingLen 211 → 270.08 px).**

| Club | Power | Carry (yd) | Pull R6 → R7 (px) | yd per px R6 → R7 |
|---|---|---|---|---|
| DR | 25% | 61.3 | 52.8 → 89.1 | 1.161 → 0.859 |
| DR | 50% | 122.5 | 105.5 → 155.1 | 1.161 → 0.987 |
| DR | 100% | 245 | 211 → 270.1 | 1.161 → 1.134 |
| 7I | 25% | 41.3 | 52.8 → 89.1 | 0.782 → 0.579 |
| 7I | 50% | 82.5 | 105.5 → 155.1 | 0.782 → 0.665 |
| 7I | 100% | 165 | 211 → 270.1 | 0.782 → 0.763 |
| PW | 25% | 31 | 52.8 → 89.1 | 0.588 → 0.435 |
| PW | 50% | 62 | 105.5 → 155.1 | 0.588 → 0.500 |
| PW | 100% | 124 | 211 → 270.1 | 0.588 → 0.574 |

- A 30 yd PW chip (24.2% power) was a 51 px pull and is now 87 px.
- **Putts** (roll 24 m × f² in both rounds): at 25% pull, 4.9 ft roll, 0.187 → 0.146 ft per px; at 50%, 19.7 ft, 0.373 → 0.292; at 100%, 78.7 ft, 0.746 → 0.583.
- Power at a given carry is unchanged: `E.carryFor` is untouched, and the test computes the carry from the engine.

**swing2 and swing4 with the finger path scaled to the new swingLen** (both scaled 1.28× in distance and time, so the thumb moves at the same speed; R7 run with `power.exp` 1 so the powers are comparable):
- swing2 (50 runs: DR and 7I, upstroke 120 / 200 / 300 / 450 ms, a hold, 5 start phases): path `f` and `dev` identical in 50/50; power within 0.0007; tempo identical in 40/50, the other 10 (all the 450 ms case) within 0.0072 (see "Read this first" 5).
- swing4 (108 runs at 60 Hz, drift +20 / −50 px): tempo identical in 108/108; power within 0.0019, and path (`f`, `dev`) within 0.0039 (identical in the 72 runs without drift). Finger positions are whole pixels: the 99% pull (209 px in R6, 267 px in R7) and the scaled drifts round differently, which accounts for these.
- With the curve on (exp 1.25), every power equals the R6 power raised to 1.25 within 0.0024.

**Pull fit (`test/fit7.js`).**

| Size | swingLen | Chevron vs ball (full / putt) | 100% pull ends | 112% ends | Room under 112% |
|---|---|---|---|---|---|
| 390×844 | 270.1 | 26.8 / 101.7 px above | 803.6 | 836 | 8 px |
| 430×932 | 298.2 | 29.2 / 111.5 px above | 888.2 | 924 | 8 px |
| 360×780 | 249.6 | 25.1 / 94.6 px above | 742 | 772 | 8 px |
| 402×874, 34 px inset | 279.7 | 61.6 / 139.1 px above | 798.4 | 832 | 8 px above the inset |

### 2.2 Task 2: the putting ball

**Size and visible share at address (`test/puttball7.js`, 402×874; visible = rays through a 41×41 grid over the ball's disc that hit the ball before any club mesh).**

| Preset | Putt | Ball px R6 → R7 | Visible R6 → R7 | Hidden by (R7) | Cup px |
|---|---|---|---|---|---|
| Close | 1.5 m | 22.6 → 28.3 | 64.8% → **94.5%** | head 5.5% | 38.2 |
| Close | 4 m | 18.7 → 23.3 | 64.8% → **94.5%** | head 5.5% | 20.1 |
| Close | 10 m | 19.0 → 23.8 | 64.8% → **96.4%** | head 3.6% | 10.1 |
| Standard | 1.5 m | 16.1 → 20.2 | 64.8% → **94.5%** | head 5.5% | 31.5 |
| Standard | 4 m | 13.3 → 16.7 | 64.5% → **94.5%** | head 5.5% | 17.7 |
| Standard | 10 m | 13.6 → 17.0 | 64.4% → **96.4%** | head 3.6% | 9.4 |
| High | 1.5 m | 14.1 → 17.7 | 81.4% → **99.3%** | head 0.7% | 29.7 |
| High | 4 m | 11.7 → 14.7 | 78.6% → **99.3%** | head 0.7% | 17.3 |
| High | 10 m | 12.0 → 15.0 | 81.3% → **100.0%** | nothing | 9.5 |

- The cup is drawn the same size; the ball is 1.25× in every frame (`scale` 1.25), so the ball-to-cup ratio is real golf's with our 1.25× cup.

**Scale logs and hole-out (`test/holeout7.js`, 402×874, 60 Hz, R6 → R7).** Putts found with the engine on hole 1 of `frame-4`, played with the game's own putt path; every frame logs the drawn scale and, near the cup, the drawn ball's clearance from the cup wall (below the rim), the rim's edge (above the rim, over the hole) and the flagstick (negative = through it).

| Case | Frames | Scale (every frame) | Largest step | Wall | Rim edge | Flagstick |
|---|---|---|---|---|---|---|
| Dead-centre 3 m, holed | 171 | 1 → **1.25** | 0 → 0 | 0 → 0 mm | **−2.97** → 0 mm | 12.3 → 1.62 mm |
| Firm 2 m, holed | 106 | 1 → **1.25** | 0 → 0 | −0.05 → 0 mm | **−1.26** → 0 mm | 12.3 → 1.62 mm |
| Lip-out, 3 m | 200 | 1 → **1.25** | 0 → 0 | none | **−3.86** → 0 mm | none |

- The drop uses the drawn radius (1.25 R) for the wall, the flagstick and the bottom, and fades the green's relief offset out as the ball goes below the rim; that's what fixes R6's dip through the rim, which the relief offset caused.
- No lip-in turned up on this green in the engine search, so there's no lip-in log.
- **Chip onto the green** (PW, 10% power, lands in the fringe and rolls onto the green): the scale rises to 3.4× in the air and comes back down as the ball nears the ground (the flight visibility rule, unchanged: largest step 0.23 per frame in R6, 0.22 in R7, both in the air). It touches down at 1.256× in the fringe, reaches 1.25× 2 frames later (steps of 0.004) and is 1.25× in every one of its 379 frames on the green. R6: 1.0× on the green.
- Screenshots: `putt/holeout_centre3m_{-4f,+0f,+4f,+10f,+24f}.png` (frames around the drop) and `putt/puttball_{preset}_{d}m.png`.

### 2.3 Task 3: green shading (`test/green7.js`)

From the putting camera (Standard, 402×874, DPR 2), a 7 m putt on hole 1 of seed `green-7` at tiers 1, 5 and 9. The visible green is the pixels where the green mesh (tint weight 1, so not the fringe) is what you see: not the ball, club, flag, dots or grid. Luma is Rec. 709 on the sRGB bytes (0–255).

| Tier | Height range within 8 m | Spread P5–P95 R6 → R7 | Ratio | 8×8 blocks ratio | Tint factor P5–P95 R6 → R7 | Clipped px R6 → R7 | Hue P5–P95 R6 → R7 |
|---|---|---|---|---|---|---|---|
| 1 | 0.20 m | 8.5 → 24.1 | **2.84×** | 2.18× | 0.985–1.021 → 0.938–1.089 | 0 → 0% | 101.1–102.5° → same |
| 5 | 0.34 m | 24.3 → 65.9 | **2.71×** | 2.58× | 0.984–1.092 → 0.928–1.275 | 0 → 1.08% | 100.7–101.7° → same |
| 9 | 0.42 m | 29.9 → 79.3 | **2.65×** | 2.68× | 0.896–1.035 → 0.712–1.142 | 0 → 0.5% | 100.6–101.8° → 100.7–101.9° |

- The 8×8 block column averages out the grass grain; on the flattest green (tier 1) the large-scale spread is 2.18×.
- Saturation's median is unchanged (0.533 → 0.532, 0.523 → 0.522, 0.531 → 0.529): darker ground is a darker green, not gray.
- With the brief's start values (0.30 / 0.15) the spread ratios were 1.92×, 2.24×, 2.24×. Other values tried: 0.30 / 0.12 → 2.33 / 2.51 / 2.48×; 0.34 / 0.12 → 2.67 / 2.79 / 2.77× but 15.9% clipped at tier 5; 0.40 / 0.15 → 2.52 / 2.77 / 2.90× with 36.7% clipped.
- **Engine identity:** `capture.js` and `bounce4.js` output byte-identical on both engines; `bot.js` identical except its "avg gen ms" timing line (2.4 vs 2.1 ms). `engine.js` itself is byte-identical.
- Screenshots: `green/green_r6_vs_r7.jpg` and `green/{r6,r7}_green_tier{1,5,9}.png`.

### 2.4 Task 4: long clubs through the downswing (`test/frame6.js`, `test/strip7.js`)

Share of downswing frames (the club's down and commit phases through contact) with the whole club on screen (grip end, the head's 8 box corners and 6 shaft points), over swing4's finger paths at 60 Hz with 9 start phases each (54 swings per club and preset). R6 → R7:

| Preset, size | DR | 3W | 4H | 5I | 6I | 7I | 8I | 9I | PW | GW | SW | LW |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Standard 390×844 | 26 → **100** | 29 → **100** | 35 → **100** | 61 → **100** | 75 → **100** | 98 → 99 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 |
| Standard 430×932 | 26 → **100** | 29 → **100** | 36 → **100** | 60 → **100** | 75 → **100** | 98 → 98 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 |
| Close 390×844 | 19 → 26 | 21 → 28 | 22 → 28 | 27 → 30 | 28 → 30 | 29 → 29 | 29 → 30 | 32 → 31 | 34 → 34 | 35 → 36 | 37 → 37 | 39 → 40 |
| Close 430×932 | 19 → 26 | 21 → 28 | 22 → 29 | 27 → 30 | 28 → 30 | 29 → 30 | 30 → 30 | 31 → 31 | 34 → 34 | 35 → 36 | 36 → 37 | 39 → 39 |
| High 390×844 | 26 → 100 | 28 → 100 | 33 → 100 | 45 → 100 | 61 → 100 | 76 → 76 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 |
| High 430×932 | 26 → 100 | 28 → 100 | 33 → 100 | 45 → 100 | 59 → 100 | 75 → 75 | 99 → 99 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 |

- 7I–LW change by at most 1 point because the longer pull moves the 60 Hz samples slightly (50,004 → 50,652 downswing frames in all).
- **Address unchanged:** for every club and preset at both sizes the ball's position and size, the club's height on screen and the horizon are identical to R6 (the test compares them).
- **Shots unchanged:** swing2 and swing4 run with the steeper plane on and with it set to 0 give identical shots (power, path, tempo), fire, crossing and ball times in all 50 and 108 runs; the club angle and shaft bend agree to within 3×10⁻⁹ (the tests' clock base differs between runs).
- **Shaft flip:** within 20 ms of contact in 50/50 (swing2, −9.9 to +10.8 ms) and 108/108 (swing4, −10.4 to +12.9 ms) runs; R6 −9.4 to +11.0 and −9.4 to +13.9 ms.
- **Frame strips (Standard, 390×844, a 99% pull, 200 ms upstroke):** `strips/strip_DR_r6_vs_r7.jpg`, `strips/strip_5I_r6_vs_r7.jpg`: address, the backswing, the top, every downswing frame, contact and +17 to +500 ms. In R6 part or all of the driver is off the left edge from 14 frames into the backswing through 3 frames before contact (at the top all of it); in R7 the whole driver is on screen in every frame from address to +83 ms. The 5-iron crosses the left edge 20 frames into the backswing and for 5 downswing frames in R6, and never in R7. In both rounds the driver's follow-through leaves the left edge from about +250 ms (the follow-through is unchanged).

### 2.5 Task 5: tracer (`test/tracer7.js`)

390×844, DPR 2, seed `pop-4`. Each shot is made with `takeShot` with the same numbers in both rounds: a full drive just outside the PURE window (cream core), a PURE 7-iron from 150 m (yellow core) and an 80% PW from 110 m (cream). "Mid-flight" is the apex; "at rest" is 10 frames after the ball stops. The scene is drawn twice at the same frame, with and without the tracer, and read back. Tracer pixels are those whose luma changes by more than 2 (every second device pixel each way is sampled, so the pixel counts are a quarter of the true ones); each is classed by a ray from the camera (no terrain within 4 km = sky).

| Shot | When | Against | Pixels R6 → R7 | Peak luma R6 → R7 | Brightening, 95th pct R6 → R7 | Mean R6 → R7 |
|---|---|---|---|---|---|---|
| Drive | mid-flight | fairway | 3,856 → 3,349 | 236 → 218 | 63.7 → 34.5 | 44.5 → 27.4 |
| Drive | at rest | fairway | 2,414 → 2,361 | 233 → 208 | 57.9 → 30.5 | 49.7 → 26.9 |
| PURE 7I | mid-flight | fairway | 1,174 → 842 | 191 → 190 | 15.6 → 8.9 | 4.1 → 3.0 |
| PURE 7I | at rest | sky | 2,070 → 1,010 | 208 → 206 | 115.3 → 56.2 | 33.1 → 28.1 |
| Wedge | mid-flight | fairway | 2,141 → 1,814 | 234 → 214 | 65.2 → 35.0 | 45.0 → 28.0 |
| Wedge | at rest | sky | 1,884 → 1,291 | 235 → 225 | 163.8 → 83.2 | 47.7 → 34.3 |

- The drive's tracer never crosses the sky from the flight camera (it runs down the fairway below the horizon), so it has no sky row.
- The PURE core is yellow (luma about 185), close to the brightness of the lit fairway, so its brightening is small in both rounds; the colour is what shows it.
- Screenshots: `tracer/tracer_flight_r6_vs_r7.jpg`, `tracer/tracer_rest_r6_vs_r7.jpg` and the single frames.

### Regressions
- **Saves** (`savecompat6.js`, fonts blocked): hand-shaped round 1 and 2 saves, and saves written by the round 4, 5 and 6 builds (each with a quick round in progress) load with **0 changed fields**. The only setting added is round 6's `cam` (to the older saves; plus `guide` / `perf` on the round 1–2 shapes, as before); the round 6 save gets nothing new. Continue resumes at the right hole with the same scores; the camera is Standard's (9.61 m back); no errors. `loadSave` is byte-identical to round 6. (Round 3: see "Not verified".)
- **Tour event** (`round4.js`, through the real screens): six holes, hole cards and results, scores [3, 4, 5, 4, 3, 5], the save updated, no errors.
- **Site** (`app4.js`, served over http under /gstick-golf/): the service worker takes control, cache `gstick-core-6d194445e7`, the manifest and all icons and launch screens load (200), three.js r128 comes from the site, offline play works (a 244.7 m drive with the network off), and a newer build replaces the old one on the next online launch. No errors.
- **UI audit** (`ui6.js`, 390×844, 430×932, 360×780, every frame from address through flight for a drive, a PURE 7-iron, a full SW, a 25 m PW chip and an 8 m putt): **0 px** overlap between the play column and any HUD box everywhere except one case: at 390×844, in the first 2 frames of the second shot's address (while the camera is still turning onto the new aim) the far end of the aim beam passes 4.1 px under the wind card. R6 had 0 px there. The beam and the camera are unchanged; the drive before it lands in a slightly different spot because of the power curve, which moves where the beam's end passes. All of round 6's other checks hold: one transient card at a time, the distance label never on the ball (closest 6 px on the putt) or the strip, the flight tilt never needed. The 112% pull from the chevron ends 8 px above the bottom at all three sizes.
- **First-shot words:** for the first three shots, "PULL DOWN · FLICK UP" still sits under the chevron, which is now just above the ball, so the words sit 2–6 px above the ball, over the club head (`ui6` screenshot `390x844_aim.png`). They never cover the ball.
- **Performance** (`perf.js`, 6× CPU throttle, SwiftShader, the same scripted hole in both builds; ms per section per frame): medians unchanged (render 3.7, drawFX 0.2, updateTracer 0.1, updateAimVisuals 0.1 → 0.2). 95th percentiles: drawFX 3.2 → 3.0, updateTracer 4.2 → 3.1, updateAimVisuals 5.1 → 2.1, render 14.0 → 15.1. Frames over 4 ms in updateTracer 26 → 15. Single-frame maxima move both ways between runs (e.g. drawFX's worst frame, 24.3 ms, is in a flight phase where the ring isn't drawn), so they aren't comparable. In the two pulls, where the ring is drawn, drawFX's worst frame went 4.7 → 8.1 and 4.6 → 6.0 ms. The calibration workload measured 1.5 ms median in both runs. 22 shader programs in both.
- **Engine:** see 2.3 (capture, bounce4 and bot identical).

## 3. Not verified

- Anything on a phone: feel, legibility of the ring at 250 yd, the putting ball's size, the shading, the tracer.
- The ring's screen placement is exact only in the sense above: it's placed at the right spot on the course; from the low address camera, far rings can't show their distance finer than tens of metres per pixel.
- iPhone safe-area insets other than the 34 px bottom inset simulated in the fit test.
- The ring over the club: on the overlay it's drawn over the club if the shaft crosses it; I didn't measure how often.
- Close preset framing: below 90% for every club (no target).
- Lip-ins: I didn't find one on the test green; the lip-out and centre drops were checked.
- Real-device frame rate. `perf.js` timings are SwiftShader with a 6× CPU throttle.
- Round 3 saves: round 3's build isn't in the repository's history, and the round 3 files attached to this project don't make a working page together, so no round 3 writer was available. The save code is unchanged from round 6, which loaded round 3 saves with no changed fields.

## 4. iPhone try-list

1. **Putts with the ring:** twenty putts from 1 to 15 m. Pull until the ring sits on the cup (or past it on uphill putts, short of it downhill), then flick. Can you start to judge distance? Does it help you adjust for slope?
2. **Chips and full shots:** ten chips from 20 to 60 yards, and five full shots per club. Is the longer pull more controllable? Is full power still easy to reach from the chevron (it's now above the ball)?
3. **The putting ball:** big enough? Fully visible above the putter?
4. **Three greens:** can you see the high and low ground? Are the darker patches away from the pin too much? (`FEEL.green.tintH` 0.10 → 0.15 softens them.)
5. **Driver and 5-iron:** do you see the club through the downswing? Does the steeper drawn plane look odd at the top?
6. **The tracer:** subtle enough?
7. **Pause → Perf:** is the black strip gone? Please screenshot the readout.

## 5. New or changed values

### FEEL
| Value | Round 6 | Round 7 |
|---|---|---|
| `swingZone.len` / `lenMin` / `lenMax` | 0.25 / 140 / 260 | **0.32 / 179.2 / 332.8** |
| `power.exp` | (linear) | **1.25** (new) |
| `tempo.slow` / `perS` / `min` | 0.34 / 0.75 / 0.6 (written in the code) | **0.4352 / 0.5859375 / 0.6** (now in FEEL) |
| `tempoLift` | 6 | **7.68** |
| `ring` | (new) | **k 0.028, rMin 1.5, rMax 7, lift 0.05, minD 1.5, puttR 0.2, puttLift 0.005, puttMinD 0.3, minPx 14, minAspect 0.3, linePx 2.5, edgeA 0.75, edgeBlur 3, ballPad 2, clear 0.45, alpha 0.95** |
| `hint.fitK` | (new) | **1.12** (the chevron leaves room for a fitK × swingLen pull; `fitPad` stays 8) |
| `ballGreenK` | (1) | **1.25** (new) |
| `club.headH.putter` | 0.6 | **0.5** |
| `club.putterNeckX` | 0.014 (written in the code) | **0.03** (now in FEEL) |
| `swingSteep.deg` / `from` / `to` | (new) | **[17, 14, 10, 6, 4] (DR, 3W, 4H, 5I, 6I) / 0 / 0.35** |
| `green.tintA` / `tintH` | 0.14 / 0.2 | **0.30 / 0.10** |
| `tracer.glow` / `glowA` | 2.2 / 0.45 | **removed** |
| `tracer.coreA` / `headBoost` | 0.94 / 1.0 | **0.5 / 0.25** (head boost now on the core) |

### ADDR
No changes.

### PALETTE and CSS
No new colours. The ring uses cream (warn past 100%) with a green edge; the tracer keeps cream and yellow.

## Deviations from the brief
- tintH 0.10 instead of the start value 0.15 (see "Read this first" 1).
- The putter's neck and insert changed as well as its height; no camera change (2).
- The ring is drawn on the overlay from draped points (3).
- The chevron sits above the ball (4).
- `tempoLift` scaled with the pull (5).
- The club and the cancel check follow the pull, not the curved power (6).

## Publishing
- Menu label "Round 7". Pushed to `claude/round-7` and merged into `main` as one "Round 7" commit (a squash-merged pull request, because this sandbox can only push `claude/*` branches). The branch is left in place: the sandbox can't delete branches. No tag.
- The Pages deploy and the live build hash (`6d194445e7` in `sw.js`) are confirmed through GitHub's records, not by loading the site: this sandbox can't reach github.io. The confirmed outcome is in the project copy of this report (`claude/beta-round-7-report.md`).
- The claude.ai artifact is updated as the fallback.
