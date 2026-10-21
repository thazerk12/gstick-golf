# G$tick Golf: beta round 4 report

**Build:** `tempo-golf.html` (284,589 bytes), published as Version 7 of the same artifact. The save key is still `tempo-golf-v1`.
**Sources changed:** `engine.js` (only the tree response, the green row of `SP` and `CUP_R`), `game.js` and `game.src.html`. Then `build.py`.

**Files:** `gstick-golf-round4-source.zip` holds the source, the tests (`test/`) and the raw results (`results/`). `gstick-golf-round4-screens.zip` holds the screenshots.

**How it was tested:** headless Chromium with SwiftShader (a software GPU), at 390×844 and DPR 2 unless noted. Wherever timing matters, frames are stepped by hand on a simulated clock and touches are synthetic pointer events. Physics tables run in Node on `engine.js` directly. "R3" is the round 3 build (the published Version 6, rebuilt byte-for-byte). "R4" is this build.

Nothing here was measured on a phone. These numbers say nothing about how the game feels, sounds or looks on the iPhone 17 Pro.

## Summary against "done when"

| Task | Check | Result |
|---|---|---|
| 1 | Club angular speed, RMS off a smooth (cubic) fit, % of peak, 60 Hz touch | **0.5–2.3%** (R3 9–17%) |
| 1 | Same at 120 Hz touch | **0.7–1.9%** (R3 13–18%) |
| 1 | Largest time-scale change in one frame around contact | **0.150** at 60 Hz (the cap), 0.103 at 120 Hz (R3 0.492) |
| 1 | Finger crosses the start line → ball moving | **17–33 ms** at 60 Hz, 21–30 ms at 120 Hz (limit 40) |
| 1 | power and tempoMul vs R3, same input | Identical in 108/108 (60 Hz) and 60/60 (120 Hz) swings |
| 1 | dev vs R3 | Equals the T2 mapping of the R3 drift in 108/108 (worst difference 6e-17) |
| 2 | Drift table, 5–120 px | Below. PURE now up to 12.7 px of drift (R3 7.4 px) |
| 3 | 50 canopy shots | 50/50 out of the canopy within 2 physics steps; exit speed 30–53% of entry; all within 8° of the reflection; 10/10 straight-on hits come back toward the player; glancing hits turn 25–35° |
| 3 | Tree sounds | Never two within 0.25 s (in-game minimum gap 0.53 s). 0 oscillators |
| 3 | Green bounce, 7-iron | apex **0.67 m**, travel **4.92 m** (target 0.6–1.0 / 3–6) |
| 3 | Green bounce, wedges | PW 0.66 m / 2.37 m, GW 0.66 / 1.83, SW 0.65 / 1.18 (target 0.4–0.7 / 1–3). GW and SW check and spin back |
| 3 | Putts holed on the capture grid | **51/72** (R3 32/72) |
| 3 | Ball size on the green and during every putt | 1.000 on every frame (R3 up to 1.5× mid-roll) |
| 3 | Hole-out | Still by 0.600 s in all three cases; 0 mm through the wall; the drop never moves faster per frame than the ball was rolling |
| 4 | Club in frame, every club, 390×844 and 430×932 | Smallest margin **7.3%** (driver). R3: driver −20.2%, 3W −14.1%, 4H −7.5%, 5I −2.8%, 6I −1.4%, 7I −0.1% (off screen) |
| 4 | Ball visible at address | **61.7–92.4%** for every club (R3: putter 44%) |
| 4 | Ball size at address, 390×844 | **12.2 px** full clubs, 13.1–13.8 px putter at 3–18 m (R3 putter 9.1 px at 10 m, 7.4 px at 15 m) |
| 4 | Aim line | Vertical: points 0, 10, 30 and 100 m down the line project to the same screen x (304.2 px = 78%) for DR, 7I and LW |
| 5 | Card and results, 390 and 360 wide | No sideways scroll (scrollWidth = clientWidth) |
| 5 | Draw calls, ball at rest in the rough | **−2** at address (31 → 29), **−1** at the settle camera (26 → 25) |
| Rules | Saves | Round 1, 2 and 3 saves load with every field unchanged and resume at the right hole |
| Rules | Regressions | `swing2`, `round4` (tour round through the real screens), `perf` below |

---

## 1. What changed, with line ranges

Line numbers are in the round 4 files.

### engine.js (only the three parts the brief allows)

- **5:** `CUP_R = 0.0675` (was 0.054). This is the only change to the cup or putt code. Capture, lip-out and putt speed use it as before.
- **21:** the green row of `SP`: `e 0.38, mu 0.90, grip 1.45` (was e 0.18, mu 1.2, grip 1.6). `turf`, `roll` and the lie columns are unchanged.
- **657–661:** `TREE`, the tree response constants. They're exported (852) and appear in game.js as `FEEL.tree`.
- **662–729:** `treeCollide` rewritten:
  - **Trunk:** a hard bounce. The normal speed reverses at `trunkE`, then the whole velocity is scaled by `trunkKeep`. The ball is pushed clear.
  - **Canopy:** the normal is the sphere's for round trees. For pines it's the cone's (the cylinder below the cone has a flat normal).
  - The velocity reflects about that normal: the normal part ×−0.3, the tangential part ×0.55.
  - Then it is turned by up to 8°, seeded from the tree and the time, never back into the canopy.
  - Spin ×0.5, and the ball is pushed out to the surface.
  - The same tree is ignored for 0.25 s afterwards.
  - Each hit sends one `tree` event with the entry and exit speeds.

### game.js

**Shared**
- **82:** `PALETTE.warn = 0xB94529`.
- **1176–1250:** FEEL (all new numbers; section 5 lists them).
- **3337–3341:** `window.__tempo`:
  - `state()` adds `tau`, `Test`, `Traw`, `alpha`, `alphaT`, `holeOut` and `timeScale`.
  - New exports: `pathMap`, `ballMesh`, `lieDecal`, `lieMesh`, `showBanner`, `showCard`, `finishRound`, `world`.
  - `buildTufts` is gone.

**Task 1: swing and contact**
- **1481–1505:** `pathMap`, plus two helpers:
  - `fingerCross`: a least-squares quadratic through every finger sample since the lowest point. It uses running sums, so there's no per-sample allocation.
  - `fingerRem`: the fallback when there are fewer than 3 samples.
- **1518–1527:** entering the downswing sets up the club's clock. τ starts at 0. `T_est` is the predicted time for the finger to reach the start line, plus `arrive`.
- **1537–1562:** the downswing:
  - A new finger sample re-estimates `T_raw`.
  - `T_est` low-passes toward it (30 ms).
  - τ advances at (1−τ)/(T_est − t).
  - The angle is a0·(1−τ²), plus the backswing's last motion carried over the top and decaying over 40 ms.
  - The club never steps back up once it's on the way down.
- **1563–1576:** the commit. At contact, the time already past contact inside that 240 Hz substep (`hitSince`) carries into the follow-through instead of being dropped.
- **1586–1615:** `followPose` and `clubCommit`. From the downswing, the commit always matches the club's speed.
- **1632–1661:** `updateClub`. The substep loop no longer stops at contact. The club's sideways tilt low-passes (60 ms) toward `pathMap(drift)`, using the same mapping as the shot.
- **1959, 1998:** `takeShot`. PURE comes from |f|. `G.acc` starts the ball at the exact time since contact, so the contact frame draws the ball where it really is.
- **2583–2590:** the contact dip:
  - It eases in over 60 ms (smoothstep, 1 → minimum).
  - It recovers over the same 0.3 s as before.
  - No frame changes the scale by more than 0.15.
  - `G.sdt` is kept for the contact frame.
- **2777–2795:** `fire()`. f = drift at the start line / swingLen, and `swipe = pathMap(f)`.

**Task 2: path**
- **1197:** `FEEL.path`.
- **1481:** `pathMap(f)` = 0 inside ±0.04. Outside it, sign(f)·(|f| − 0.04)/0.84, clamped to ±1.6.
- **1959:** PURE needs |f| ≤ 0.05, plus the round 3 power, tempo and lie rules.
- The same `dev` drives full shots and putts, since both go through `fire` → `takeShot`. The club's tilt uses it too (1652–1654).

**Task 3: trees, green, cup, hole-out**
- **1221–1226:** the canopy, leaf, trunk, cup and rattle voices, plus `treeGap` and `treeVRef`.
- **1769–1778:** `fxVoice` and `renderInto`. Every voice is a struck noise burst through resonant bandpass modes. The canopy adds a quiet leaf swish.
- The old `rustle` (five noise bursts) and `knock` (a square-wave tone) are deleted.
- **2007–2022:** `handleEvents`:
  - One tree sound per hit, and none within `treeGap` (0.25 s) of the last.
  - Trunk hits play `trunk`; canopy hits play `canopy`. The level comes from the hit speed.
  - A `holed` from the air starts the drop.
- **2283–2356:** `updateBallVisual`:
  - The ball is drawn at exactly 1.0× on the green and during every putt (`G.ballScale = 1`).
  - Elsewhere the round 3 ground cap still blends 1 → 1.5 across the fringe.
  - The drop animation draws from `G.sinkS` on the interpolation clock.
- **2363–2418:** the physical hole-out (`sinkLookahead`, `startSink`, `startSinkAt`, `sinkHit`, `stepSink`):
  - When a rolling ball enters the cup's rim, a deterministic copy of the ball is stepped ahead. If the engine will hole it, the drop starts from the rim with the ball's own speed.
  - Then 1 ms steps under gravity:
    - a wall at CUP_R − R;
    - the flagstick (radius 0.0125 + R);
    - a bottom at 0.102 m with restitution 0.3 and friction.
  - The first contact plays `cup`. Later contacts over 0.1 m/s, at least 40 ms apart, play `rattle`.
  - Horizontal motion stops at 0.6 s; vertical motion continues to rest.
- **2637–2641:** the flight loop keeps the pre-step vertical speed and runs the lookahead once at rim entry.

**Task 4: framing and the driver head**
- **2455–2463:** `ADDR`:
  - back 3.3, up 2.0, down 8.5, fov 43 (round 3: 2.7, 1.6, 7, 52);
  - a new lens shift of 0.28;
  - putter `up0` 0.85 (0.62) and `dMax` 4 (18).
  - `puttCam(d)` is shared by the address and putt-roll cameras.
- **2464–2502:** `addressCam` sets the FOV and lens shift for full clubs.
- **2503–2520:** `flightCam`. The putt-roll camera now uses `puttCam`, so the stroke doesn't move it (see deviations).
- **2532–2552:** `camHardSet`, `applyLens`, `updateCamera`:
  - FOV and lens shift spring with the camera.
  - The shift is an off-axis frustum (`setViewOffset`).
- **2596, 2615:** the default lens outside address. The intro eases the lens in.
- **2888–2895:** the first-shots swing hint is centred at 50% width and 44% height, so it clears the shifted club.
- **1238–1244:** `FEEL.club`:
  - `headWood` 1.35;
  - `headH.putter` 0.6 (was 1), which lowers the putter head so ≥60% of the ball shows;
  - the `wood` outline and ring table.
- **1308–1408:** `buildClubModel`:
  - **New pear head for the driver and woods:** a 15-point outline with 6 face segments.
  - Rings: sole (cream2), skirt, edge, cream top-line, two crown rings, and a crown cap (green2).
  - A flat dark face (`PALETTE.green`) with a slight bulge, a yellow alignment mark on the crown, and a hosel.
  - **Contact point (1355):** same rule as round 3 (on the face at ball-centre height, 2% of the length toward the toe). The new face's forward bulge is added, so the point sits on the face surface.
  - Flex and launch code are untouched.

**Task 5: popups, screens, tracer, lie, flag**
- **2083–2104, 3077–3085:** `finishHole` passes a kind: `under` for hole-in-one, eagle and birdie; `''` for par; `over` for bogey, double bogey and picked up. `showBanner(w, s, kind, ms)` builds the card.
- **192–213, 2210–2271:** the tracer:
  - The edge ribbon is deleted; there's a glow ribbon and a core ribbon.
  - It holds 0.7 s after rest, then fades over 0.6 s.
- **316, 440–445:** the tuft material and template are removed, so the rough clump is gone. At 1164 the decal is hidden at hole load.
- **1062–1071, 1251–1262:** `lieDecal`:
  - one soft ellipse mesh, 0.36 × 0.28 m along the line, 12% darker;
  - hidden as soon as the ball moves (1932, 1967, 2032, 2040);
  - placed at settle (2046).
- **2287:** while the ball rests in the rough, the decal stands in for its contact shadow.
- **2350:** the ball is drawn 25% of its diameter lower, eased over 0.15 s.
- **166, 878–943:** the flag:
  - `flagGeometry` is two-sided cloth: the front and back faces each get their own UVs, so the mark reads correctly from both sides.
  - `flagTexture` draws per hole, after the brand font loads: a "G" in Fraunces, then a "$" built from the club paths (an S with the shaft through it).
  - The mark is green on the flag colour, 60% of the flag's height.

### game.src.html

- **24–25:** `--warn: #B94529`; new `--dimgreen: rgba(31,58,42,0.88)`.
- **69, 119:** the warn contrast comments (4.5:1 on cream).
- **122–133:** `#banner` is restyled as the PURE toast card (`.card.tcard`). Under par gets a yellow 4 px underline, over par a warn one.
- **260–302:** `#scrCard` and `#scrResults`:
  - cream panel on the dim green backdrop;
  - Fraunces for the title, total and score cells, Archivo for labels;
  - fixed table layout (first column 50 px, last 40 px);
  - chip score cells: birdie or better yellow, bogey or worse cream2 with warn text, a ring for double;
  - green CTA and cream ghost buttons at 48 px;
  - the big score at 88 px.
- **368:** banner markup: `<div class="card tcard"><div class="q brandtxt" id="bW"></div><div class="d" id="bS"></div></div>`.

---

## 2. Tests and numbers

### Task 1: swing smoothness, time scale, contact timing

`test/swing4.js` runs the real game loop. The touch is synthetic:
- an ease-out pull to full power;
- an optional hold;
- an upstroke accelerating from rest (y ∝ t²) that reaches the start line in T ms.

Samples land on whole pixels at 60 Hz or 120 Hz, and the start is swept across the frame grid. Runs cover the driver and 7-iron, T = 120/200/300 ms, a 500 ms hold, and drifts of +20 and −50 px. That's 108 swings at 60 Hz and 60 at 120 Hz. `test/s4sum.js` summarises.

**Club angular speed per frame, from the top through contact.** The RMS deviation from a cubic fit, as % of the peak, worst run per row (60 Hz):

| Swing | R3 | R4 | R4, arm + wrist (a+b) |
|---|---|---|---|
| T 120 ms | 11.9% | **0.68%** | 2.8% |
| T 200 ms | 16.7% | **1.72%** | 5.0% |
| T 300 ms | 16.7% | **2.32%** | 6.3% |
| T 200 ms + 0.5 s hold | 16.0% | **1.82%** | 4.9% |

- The driver and 7-iron rows are the same to the digits shown. Drift doesn't change them.
- At 120 Hz the arm RMS is 0.7–1.9% (R3 13–18%).
- The a+b figure is higher because the wrists release in the last part of the downswing (`lagExp` 0.5, unchanged).
- Other thumb shapes, offline in the model only: 1.3–4.6%. A thumb that slows down near the line is the worst case.

**Time scale per frame around contact.** Driver, T 200 ms, 60 Hz; 0 = the frame the ball first moves:

| ms | 0 | 17 | 33 | 50 | 67 | 83 | 100 | 133 | 167 | 200 | 233 | 267 | 300 | 333 | 367 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R3 | 1.000 | **0.508** | 0.521 | 0.540 | 0.566 | 0.597 | 0.632 | 0.711 | 0.793 | 0.871 | 0.937 | 0.983 | 1.000 | 1.000 | 1.000 |
| R4 | 1.000 | 0.906 | 0.756 | 0.606 | **0.504** | 0.512 | 0.528 | 0.578 | 0.647 | 0.727 | 0.809 | 0.886 | 0.948 | 0.989 | 1.000 |

- The 0.15-per-frame cap binds on the 33 and 50 ms frames at 60 Hz. At 120 Hz the largest step is 0.103.
- The bottom (0.504) and the 0.3 s recovery are unchanged. The ease-in adds 60 ms, so the dip now ends at 360 ms instead of 300 ms.

**Finger crosses the start line → ball moving:**
- 60 Hz: 17–33 ms (R3 0–16 ms).
- 120 Hz: 21–30 ms (R3 0–8 ms).

All within the 40 ms limit. The club now times its own arrival: τ reaches 1 at the predicted crossing + 25 ms, instead of being dragged to the ball at the crossing.

**The contact frame.** On the frame the ball first moves, it is drawn at the exact time since contact. Example: the R4 ball's drawn speeds over the first frames are 5.4, then 65.0, 64.7 … m/s, because contact fell late in that frame. R3 drew 65.1 on the contact frame, then 64.7.

**Shot values.** Same synthetic input, R3 vs R4:
- power identical in 108/108 at 60 Hz and 60/60 at 120 Hz;
- tempoMul identical in 108/108 and 60/60;
- dev equals `pathMap` of the round 3 drift in all of them (worst difference 6e-17 at 60 Hz, 0 at 120 Hz).

**Tilt.** The club's sideways tilt now ramps over 60 ms. In R3 it jumped to −0.169 on the first downswing frame of a −50 px drift.

### Task 2: drift table

Drift is the finger's sideways distance at the start line, at 390×844 (swingLen 253 px), so f = px/253. The other columns are:
- the driver's and 7-iron's offline distance at carry and at rest (no wind, fairway lie, full power);
- the putt's aim error at 3 m and 10 m.

Negative dev is a draw or hook for a right-hander (drift right).

| Drift | f | R3 dev | R3 label | R4 dev | R4 label | Driver offline, carry / rest (R3 → R4) | 7-iron offline, carry / rest (R3 → R4) | Putt aim error 3 m / 10 m (R3 → R4) |
|---|---|---|---|---|---|---|---|---|
| 5 px | 0.020 | −0.014 | PURE | 0 | PURE | 1.5 / 1.7 m → 0 / 0 | 0.3 / 0.3 m → 0 / 0 | 0.4 / 1.4 cm → 0 / 0 |
| 10 px | 0.040 | −0.094 | STRAIGHT | 0 | PURE | 9.9 / 11.5 → 0 / 0 | 1.8 / 2.0 → 0 / 0 | 0.8 / 2.8 → 0 / 0 |
| 20 px | 0.079 | −0.188 | DRAW | −0.046 | STRAIGHT | 19.4 / 22.7 → 4.9 / 5.7 | 3.6 / 3.9 → 0.9 / 1.0 | 1.7 / 5.6 → 0.4 / 1.4 |
| 35 px | 0.138 | −0.329 | DRAW | −0.117 | STRAIGHT | 32.3 / 38.1 → 12.2 / 14.3 | 6.2 / 6.8 → 2.2 / 2.4 | 2.9 / 9.8 → 1.0 / 3.5 |
| 50 px | 0.198 | −0.470 | HOOK | −0.187 | DRAW | 43.0 / 51.3 → 19.3 / 22.6 | 8.8 / 9.7 → 3.6 / 3.9 | 4.2 / 13.9 → 1.7 / 5.6 |
| 80 px | 0.316 | −0.752 | HOOK | −0.329 | DRAW | 56.9 / 70.5 → 32.2 / 38.0 | 13.8 / 15.2 → 6.2 / 6.8 | 6.7 / 22.3 → 2.9 / 9.7 |
| 120 px | 0.474 | −1.128 | HOOK | −0.517 | HOOK | 63.4 / 83.9 → 46.0 / 55.1 | 19.8 / 22.0 → 9.7 / 10.6 | 10.0 / 33.5 → 4.6 / 15.3 |

- Putt labels: R3 shows PUSHED from 35 px. R4 shows it from 80 px.
- The label bands in px at 390×844:
  - R4: PURE ≤ 12.7, STRAIGHT < 35.7, SLICE/HOOK > 99.5.
  - R3: PURE < 7.4, STRAIGHT < 12.8, SLICE/HOOK > 44.7.
- Each R4 row from 20 px on equals the R3 row of a smaller drift. The mapping is a shift and a scale, so the shot shapes are the same, only harder to reach.

### Task 3: trees

**Scripted canopy shots** (`test/trees4.js`): 50 shots on flat ground, one tree in the ball's path.
- Clubs: DR, 5I, 7I, 9I and PW.
- Per club: 5 round trees and 5 pines, at 18–75% of the carry, from dead-on to glancing (offsets 0–0.92 of the canopy radius, up and down).

| Check | Result |
|---|---|
| Ball out of the canopy within 2 physics steps | 50/50 (all in 1) |
| Exit speed 25–55% of entry | 50/50 (0.300–0.531) |
| Exit direction within 10° of the reflection | 50/50 (max 8.0°) |
| Straight-on (incidence ≤25°) comes back toward the player | 10/10 (horizontal turn 120–177°) |
| Glancing (incidence ≥60°) goes sideways, not back | 10/10, turned 25–35° |
| Tree events closer than 0.25 s on one shot | 0 |

In R3, a canopy kept 6.6–36.2% of the speed in a random direction.

**In a real hole** (`test/treesgame4.js`): 30 approach shots aimed into tree lines, with the game's own event handling.
- 16 shots hit trees: 21 tree events, 20 sounds.
- The smallest gap between sounds was 0.533 s.
- One shot had two events 12.5 ms apart, from two neighbouring trees. It made one sound because of the 0.25 s gate.

**Sounds** (`test/sounds4.js`): rendered offline at 48 kHz, 0 oscillators created. WAVs are in `test/sounds/`.

| Voice | Attack | To −40 dB | Centroid | Peak |
|---|---|---|---|---|
| Canopy, full | 1.25 ms | 49.5 ms | 4,337 Hz | −21.4 dBFS |
| Canopy, soft hit | 1.25 ms | 55.8 ms | 4,667 Hz | −25.2 dBFS |
| Trunk | 0.25 ms | 38.5 ms | 895 Hz | −21.2 dBFS |
| Cup | 1.25 ms | 29.5 ms | 1,329 Hz | −23.5 dBFS |
| Rattle | 0.25 ms | 14.5 ms | 2,102 Hz | −41.7 dBFS |

The canopy centroid is high because of the leaf swish. The bonk on its own takes 41 ms to −40 dB, with a 613 Hz centroid and 95% of its energy at 300–1,000 Hz.

### Task 3: green bounce

`test/bounce4.js`: full shots onto a flat stimp 10 green, no wind.
- Apex is the first bounce's height above the green.
- Travel is the distance from the first touchdown to rest along the line. Negative means it spun back past the touchdown.

The tuning started from the brief's e 0.30, mu 0.9, grip 1.25. It ended at **e 0.38, mu 0.90, grip 1.45**:
- At e 0.30 the 7-iron apex stayed under 0.6 m.
- At grip 1.25 the wedges couldn't check.

| Shot | Land angle / speed | R3 apex | R3 travel | **R4 apex** | **R4 travel** | Spun back (R4) |
|---|---|---|---|---|---|---|
| 7-iron | 44.5° / 25.4 m/s | 0.15 m | 4.51 m | **0.67 m** | **4.92 m** | no |
| 9-iron | 46.0° / 24.8 | 0.15 | 1.78 | 0.66 | 3.04 | no |
| 5-iron | 41.2° / 26.0 | 0.15 | 10.21 | 0.66 | 8.02 | no |
| PW | 47.0° / 24.4 | 0.15 | 1.01 | **0.66** | **2.37** | no |
| GW | 48.0° / 23.7 | 0.15 | 0.66 | **0.66** | **1.83** | checks |
| SW | 49.9° / 22.6 | 0.15 | 0.44 | **0.65** | **1.18** | checks |
| PW, spin upgrade 5 | | 0.15 | 0.13 | 0.66 | 0.65 | checks |
| SW, spin upgrade 5 | | 0.15 | −1.82 | 0.65 | −0.88 | spins back |
| PW at 60% | 38.7° / 20.6 | 0.12 | 1.69 | 0.54 | 2.60 | no |

Carry, launch and landing are unchanged, because only the green row moved.

### Task 3: cup

**Capture grid** (`test/capture4.js` on each engine). Straight putts are rolled at speeds that would stop a set distance past the cup, at lateral offsets.

The capture width is the widest lateral offset that still drops:

| Would stop past the cup | R3 | R4 |
|---|---|---|
| 0 m | 10.6 cm | 13.2 cm |
| 0.2 m | 10.4 | 13.2 |
| 0.45 m | 9.8 | 12.8 |
| 0.9 m | 8.8 | 11.8 |
| 1.5 m | 7.6 | 11.2 |
| 2.5 m | 4.2 | 9.0 |

Holed: 32/72 grid cells in R3, 51/72 in R4.

**Bot** (`test/bot.js`, 24 tour events, its own fixed aim and path noise; the T2 mapping doesn't apply). Per-event lines are in `results/bot_r3.txt` and `results/bot_r4.txt` in the source zip.

| | R3 | R4 |
|---|---|---|
| Total over par, 24 events | +69 | +51 |
| First 12 / last 12 | +0 / +69 | +1 / +50 |
| Putts per hole | 2.20 | 2.12 |
| Penalties | 6 | 4 |

The difference comes from the bigger cup, the green bounce and the trees together. The bot doesn't separate them.

**Putt camera and ball size** (`test/shots4.js putt`), ball/cup ratio measured at the ball's own distance:
- R4: the ratio is constant at 0.316 and ballScale is 1.000 on every frame of a 15 m putt and a 2 m putt.
- R3: the ball grew to 1.5× mid-roll on the green (0.593 vs 0.395).

**Hole-out** (`test/holeout4.js`): three putts that drop.

| Case | Putt start speed | Contacts (ms after the drop starts: kind, m/s) | Still at |
|---|---|---|---|
| Dead centre, slow | 1.59 m/s | 65 pole 0.46 · 140 bottom 1.41 · 146 wall 0.10 · 226 bottom 0.42 · 251 bottom 0.12 | 600 ms |
| Firm | 2.15 m/s | 22 pole 1.52 · 52 wall 0.46 · 140 bottom 1.41 · 154 pole 0.08 · 226 bottom 0.42 · 251 bottom 0.12 | 600 ms |
| Lip-in | 1.80 m/s | 140 bottom 1.41 · 226 bottom 0.42 · 251 bottom 0.12 | 600 ms |

- The ball never goes through the wall (0 mm).
- The largest per-frame drawn move during the drop equals the rolling speed before it: 21, 26 and 26 mm per frame. Nothing jumps.
- Sounds: the first contact plays `cup`; later contacts over 0.1 m/s, at least 40 ms apart, play `rattle`. Rendered whole hole-outs are `test/sounds/holeout-*.wav`.

### Task 4: framing and the driver head

`test/frame4.js` checks, for every club at address:
- the club's screen box from every vertex, as margins to each edge (% of width or height);
- the ball's drawn diameter in CSS px;
- the share of the ball not hidden by the club (rays through a grid over the ball's disc).

| Club, 390×844 | Smallest margin | Ball | Visible | R3 smallest margin | R3 visible |
|---|---|---|---|---|---|
| DR | 7.4% (left) | 12.2 px | 76.1% | −20.2% | |
| 3W | 13.6% | 12.2 | 92.4% | −14.1% | |
| 4H | 16.7% | 12.2 | 92.4% | −7.5% | |
| 5I | 17.6% | 12.2 | 61.7% | −2.8% | |
| 6I | 17.6% | 12.2 | 62.9% | −1.4% | |
| 7I | 17.6% | 12.2 | 64.1% | −0.1% | |
| 8I–LW | 17.7–18.1% | 12.2 | 65.9–85.2% | | |
| Putter, 3 m | 21.8% | 13.8 | 64.8% | 21.4% | 44% |
| Putter, 10 m | 17.4% | 13.1 | 64.4% | 26.2% | 44%, 9.1 px |
| Putter, 15 m | 17.4% | 13.1 | 64.4% | 28.0% | 46.5%, 7.4 px |
| Putter, 18 m | 17.4% | 13.1 | 64.4% | 28.9% | 50.8%, 7.4 px |

- At 430×932 every margin is within 0.1% of these. The ball is 13.5 px (putter 14.5–15.3 px).
- The cup stays at 45–49% of the screen height at every putt length.

**Aim line and lens shift.** The brief's knobs alone conflict.
- Without a shift, getting the driver in frame needs ADDR back ≈ 5.35 m. That leaves the ball at 9.2 px, under the 12 px floor.
- The fix: the camera stays on the target line, and the image is shifted (an off-axis frustum, `setViewOffset`) so the ball sits at about 78% of the width with the club to its left.
- A shift doesn't tilt the view, so the target line stays vertical on screen. Measured (`test/aimline4.js`): points 0, 10, 30 and 100 m along the line all project to x = 304.2 px for the driver, 7-iron and LW (R3: 195.0 px, centred).
- This is a change beyond the knobs listed (see deviations).

**Driver head.** Screenshots:
- `driver_address`, `driver_top`, `driver_finish`, each from the player's camera and face-on;
- `driver_head_top` (straight down from 1.2 m) and `driver_head_34`.

**swing2 (the round 2 harness), R3 vs R4**, driver and 7-iron, 40 runs each. Contact, flex and launch code are unchanged. The τ downswing changes some timings.

| Metric | R3 (min / median / max) | R4 |
|---|---|---|
| power, dev, tempoMul | | identical in 40/40 |
| Club leaves the top after the 3 px rise | −12.5 / 0 / 4.2 ms | −12.5 / −4.2 / 4.2 ms |
| Angular-velocity sign changes, top → contact | 0 / 1 / 1 | 0 / 0 / 1 |
| Frames under 20°/s | 0 | 0 |
| Peak shaft deflection, driver | −114 to −86 mm | −123 to −54 mm |
| Peak shaft deflection, 7-iron | −53 to −40 mm | −52 to −24 mm |
| Settles under 2 mm by 0.6 s after the finish | yes (max 0.02 mm) | yes (max 0.02 mm) |
| Shaft flips forward within ±20 ms of contact | 31/40 | 30/40 |
| Downswing left when the finger crosses | 0.3–3.9% | **13–51%** |
| Finger-cross to ball moving | 0–16.7 ms | 16.7–33.3 ms |

Three of these need a note:
- **Downswing left when the finger crosses:** round 2's "≤10% left" no longer holds. That's the τ design: the club runs on its own clock and arrives about 25 ms after the crossing, which T1 asked for (≤40 ms).
- **Peak deflection:** the slow (300 ms) swings bend less. My reading, not measured: the τ curve accelerates more evenly.
- **Shaft flip:** in R3 the 9 misses kicked forward 21–23 ms *before* contact. In R4 the 10 misses (all of them T 200–300 ms runs at phase 0 or 4) unload to about 5 mm of lag at contact and don't cross until about 100–150 ms later. In the other 30 the flip is −12 to +5 ms. The flex code is byte-identical to R3. Its release timer extrapolates the arm's acceleration, which runs late on the τ curve.

### Task 5: screens, tracer, lie, flag

Screenshots are in `gstick-golf-round4-screens.zip`:
- `address/`: every club at 390×844 and 430×932, plus contact sheets;
- `driver_*`: the driver at address, top and finish, plus head close-ups;
- `popup_*`: BIRDIE, PAR, BOGEY, EAGLE, DOUBLE BOGEY;
- `r4_card_*`, `r4_results_*`: at 390×844 and 360×780;
- `r3_/r4_tracer_*`, `r3_/r4_rough_*`, `r3_/r4_putt*`: before and after;
- `flag_*`;
- `sheets/`: side-by-side comparisons.

**Popups.** BIRDIE and EAGLE have a yellow underline, BOGEY and DOUBLE BOGEY a warn underline, PAR none. Same card, font and size as the PURE toast.

**Card and results** at 390×844 and 360×780:
- no sideways scroll (`scrollWidth == clientWidth` on the screen and the table wrap);
- at 360 the table is 296 px wide;
- the results screen fits without scrolling at both sizes.

**Tracer.** R3 has a dark edge against both sky and grass; R4 has none. Hold 0.7 s, fade 0.6 s.

**Rough lie:**
- At address the R3 clump of blades is replaced by a soft darker ellipse.
- No blades anywhere (the tuft code is deleted).
- The ball is drawn 1.07 cm lower (25% of its 4.27 cm diameter).

**Draw calls** (`test/calls4.js`: renderer.info over one frame, ball at rest, same spot and hole in both builds):

| View | R3 | R4 |
|---|---|---|
| Rough, address camera | 31 | **29** |
| Rough, settle camera | 26 | **25** |
| Fairway, address | 29 | 29 |
| Fairway, settle | 24 | 24 |

How it got there:
- With the decal alone, R4 measured 30 at address and 26 at settle. At settle the decal had just replaced the clump one for one. At address R3 drew one more object; I didn't trace which.
- Hiding the ball's contact shadow while it rests in the rough (the decal already darkens that spot) takes one more off both views.

**Flag:**
- Front and back at 4 m and at 60 m (through a 6° lens). G$ reads correctly from both sides. The back is darker, because it faces away from the sun.
- In-game views at 60 m and 15 m from the player's own camera are included. At 15 m with a helping wind the flag is edge-on.
- The texture is redrawn per hole once Fraunces has loaded (or after the 1.5 s font wait).

### Regressions

- **Saves** (`test/savecompat4.js`, fonts blocked):
  - Three saves: a round 1 shape (no guide, perf or shots), a round 2 shape, and a round 3 save written by the round 3 build itself.
  - All load with every stored field unchanged and show Continue. They resume at holes 2, 3 and 4 with their scores, with no errors.
  - Results are identical to the round 3 build loading the same saves. The save code is byte-identical to R3.
- **Tour round through the real screens** (`test/round4.js`, new). It's `round.js` with frames stepped by hand, because the real-time version only managed a few frames a second headless.
  - The Tour list, 6 holes, the hole card and the results all work.
  - Scores [3, 4, 5, 4, 3, 5], 235 coins, 2 stars, no errors.
  - Identical on R3.
- **perf.js** (6× CPU throttle, per-section JS timings, 390×844): no errors, and no new shader programs (21 before the first swing, after the first contact and after the putt, in both builds).

| | R3 | R4 |
|---|---|---|
| Section entries over 4 ms (render excluded) | 70 | 83 |
| Worst single section | 31.4 ms (`updateAimVisuals`, intro) | 22.7 ms (`drawFX`, first swing) |
| `updateTracer` p95 / max | 2.9 / 30.7 ms | 5.2 / 16.3 ms |
| `takeShot` max | 19.7 ms | 7.1 ms |
| Control (a fixed block of JS run every frame): frames over 4 ms | 90 of 1,947 | 74 of 1,891 |

The control shows this sandbox's noise. A fixed amount of work goes over 4 ms on about 4% of frames, so single-run differences like 70 vs 83 don't mean anything. Neither build meets round 1's "no section over 4 ms" here.

---

## 3. Not verified

- **Anything on a phone:** frame rate, touch latency, how the swing or the contact dip feel, how the sounds sound through the iPhone speaker, how the screens and flag look, and safe areas.
- **Real thumbs:** T1 was tested with synthetic t² upstrokes on a whole-pixel grid at 60 and 120 Hz, plus a few other thumb shapes offline in the model only. A real thumb that slows near the line is the case most likely to show a wobble (4.6% offline).
- **Sounds:** checked as spectra, decay times and levels only. No one has listened to them.
- **The flag with no font:** with Google Fonts blocked the game runs and the flag draws without errors. The fallback face for the "G" was not looked at.
- **The hole-out in real time:** checked frame by frame at a simulated 60 Hz only.
- **swing2's shaft flip:** see Task 4. Not changed, because the flex code isn't in this round's list.
- **Perf on a GPU:** SwiftShader render times mean nothing for a phone.

## 4. iPhone 17 Pro try-list

1. **Ten full swings at different rhythms** (slow, normal, a snap, one with a pause at the bottom). Watch the club from the top through the ball. Does it ever hitch, jump or slow before the ball? Does the ball leave the instant the club gets there? Does the slow-mo now slide in rather than drop?
2. **Five drives aiming straight.** Count STRAIGHT and PURE. PURE now allows about 12 px of sideways drift (it was 7). If PURE comes up on almost every drive, it's too easy. If you never see it, tell me.
3. **Shots into trees:**
   - A full drive straight into a canopy: it should come back toward you, slower.
   - A clip off the side of a tree: it should glance off sideways.
   - A trunk hit.
   - Listen for one bonk with a leaf swish, a firmer knock on the trunk, and never a double sound.
4. **Approaches onto a green:** a 7-iron (one clear hop, then rolls a few metres), a PW and a SW (a smaller hop, then checks; the SW can spin back with the spin upgrade).
5. **Putts of 2, 8 and 15 m, including one that drops.**
   - The ball should stay the same size relative to the cup the whole way.
   - On the drop: does it fall in and rattle, with a plastic "tok"? Is it still within about half a second?
   - Is the bigger cup noticeable?
6. **The driver at address.** Is the whole club on screen, with the ball sitting right of centre and the aim line running straight up from it? Look at the new pear head: dark face, green crown, cream top-line, yellow mark. Then look at the head at the top of the swing and at the finish.
7. **A birdie and a bogey popup, the scorecard and the results.**
   - Underlines: yellow for the birdie, red-brown for the bogey.
   - The chip score cells.
   - Does anything feel cramped?
8. **A ball in the rough:** a soft darker patch under a slightly sunk ball, and no grass blades. Does the lie still read as rough?
9. **The flag up close** (putt from about 2 m behind it, and from the other side of the hole). Does G$ read correctly from both sides while it waves?

## 5. FEEL, PALETTE and engine values (new or changed)

### PALETTE and CSS
| Name | Value | Was |
|---|---|---|
| `PALETTE.warn` / `--warn` | `0xB94529` / `#B94529` | `0xD45A3C` |
| `--dimgreen` (new) | `rgba(31,58,42,0.88)` | |

### engine.js
| Name | Value | Was |
|---|---|---|
| `CUP_R` | 0.0675 m | 0.054 |
| `SP` green row | e 0.38, mu 0.90, grip 1.45 (turf 0.45, roll 0.050 unchanged) | e 0.18, mu 1.2, grip 1.6 |
| `TREE` (new; = `FEEL.tree`) | e 0.3, keepT 0.55, scatterDeg 8, spin 0.5, ignore 0.25 s, trunkE 0.5, trunkKeep 0.7 | |

### FEEL
| Name | Value | Was |
|---|---|---|
| `down` | revPx 3, **tauLP 0.03, arrive 0.025, Tmin 0.04, Tmax 1, Tmax0 0.4, remMin 0.012, topDecay 0.04**, predictMin 1/120, predictMax 1/60, bEase 0.04, impactGain 1.15, putterOmega 19, putterExp 1.35, lagExp 0.5 | removed: exp 1.3, blend 0.06, lead 0.85, predictAcc 1, errTau 0.012 |
| `follow.nMax` | 14 | 8 |
| `dip` | at100 0.5, at30 0.8, dur 0.3, **easeIn 0.06, maxStep 0.15** | |
| `path` (new) | dead 0.04, span 0.84, max 1.6, pure 0.05, tiltTau 0.06 | |
| `tracer` | hold 0.7, fade 0.6; `edge` removed | hold 1.2, edge 0.22 |
| `sound.canopy` (new) | modes [440,18,1] [640,20,0.8] [890,18,0.45]; burst 0.002, decay 0.14, crack 0, gain 0.2, min 0.4 | |
| `sound.leaf` (new) | freq 3200, q 1.1, delay 0.004, attack 0.012, decay 0.12, gain 0.008 | |
| `sound.trunk` (new) | modes [500,22,1] [760,26,0.7] [1120,20,0.35]; burst 0.0008, decay 0.14, crack 0.015, gain 0.26, min 0.45 | |
| `sound.cup` (new) | modes [920,30,1] [1780,34,0.55] [2750,26,0.25]; burst 0.0012, decay 0.09, crack 0, gain 0.2, min 0.35 | |
| `sound.rattle` (new) | modes [1320,22,1] [2520,26,0.45]; burst 0.0008, decay 0.04, crack 0, gain 0.12, min 0.3 | |
| `sound.treeGap`, `treeVRef` (new) | 0.25 s, 45 m/s | |
| `holeOut` (new) | depth 0.102, wallE 0.3, poleE 0.3, poleR 0.0125, bottomE 0.3, bottomFric 0.4, rollTau 0.07, settle 0.6, push 0.6, hitMin 0.02, rattleMin 0.1, rattleGap 0.04, step 0.001 | |
| `club.headWood` (new) | 1.35 | woods used `head` 1.25 |
| `club.headH.putter` | 0.6 | 1 |
| `club.wood` (new) | 15-point outline (in the code), faceN 6, crown [0.01, −0.45], sole 0.9, skirt 0.32, edge [0.985, 0.62], line [0.955, 0.7], c1 [0.78, 0.88], c2 [0.45, 0.97], bulgeZ 0.016, mark [−0.1, −0.3, 0.905, 0.985, 0.006], hosel [0.44, 0.62, −0.1] | |
| `lie` (new) | len 0.36, wid 0.28, dark 0.12, soft 0.45, sink 0.25, sinkT 0.15 | replaces `clump` |
| `flagMark` (new) | h 0.6, dx 0 | |

The `sound` entries also carry `off` (their noise-buffer offset): canopy 0.11, trunk 0.4, cup 0.63, rattle 0.92.

### ADDR (address camera, game.js 2455–2463)
| Name | Value | Was |
|---|---|---|
| back / up / down / ahead | 3.3 / 2.0 / 8.5 / 30 | 2.7 / 1.6 / 7 / 30 |
| fov (full clubs) | 43° | 52° |
| shift (new) | 0.28 of the view width | none |
| fov0 (new; every other camera) | 52° | |
| putt.up0 | 0.85 | 0.62 |
| putt.dMax | 4 m | 18 |

## Deviations from the brief

1. **Canopy `keepT` is 0.55, not 0.75.** With 0.75, a glancing hit keeps up to 75% of its speed, which breaks the brief's own 25–55% exit-speed check. At 0.55 all 50 shots land at 30–53%.
2. **Green row e 0.38 and grip 1.45** (the brief's start was 0.30 and 1.25). These are the tuned values that hit both bounce targets. mu is 0.90 as given.
3. **Lens shift on the address camera.** This is outside the listed knobs (ADDR back/up/down, vertical FOV), and here's why. Without it, the driver needs back 5.35 m, and the ball drops to 9.2 px against the 12 px floor. With it, every club fits with ≥7.3% margin at 12.2 px, and the aim line still runs straight up. The cost: at address the ball sits right of centre (about 78% across).
4. **Putter framing:**
   - `headH.putter` 1 → 0.6 (a lower putter head, so ≥60% of the ball shows).
   - The putting camera stops backing off at 4 m (`dMax` 18 → 4), so the ball is ≥12 px at every length. The trade-off: long putts are seen from lower and closer (1.15 m up, 2.7 m back) than before (up to 2.2 m and 5.5 m), so the far green is more foreshortened.
   - The putt-roll camera shares those numbers. In R3 its height was a separate hard-coded value that only matched the address camera by coincidence. Without this, the camera would drop 21 cm at the stroke.
5. **The ball's contact shadow is hidden while it rests in the rough.** The decal takes its place. This is what makes "one fewer draw call" hold at the settle camera as well as at address.
6. **`follow.nMax` 8 → 14, plus the contact substep carried into the follow-through.** The follow-through starts at the club's real impact speed. Without it, the RMS through contact stays at 4–6% even with the τ downswing.
7. **The hole-number intro banner shares `#banner`,** so it now shows as the same cream card (no underline) instead of round 3's big white text.
8. **The swing hint moved** to 50% width and 44% height, so it clears the shifted club. It's the first-shots hint, not a HUD card.
9. **The contact dip ends 60 ms later** (360 ms), because the ease-in comes before the unchanged 0.3 s recovery.
