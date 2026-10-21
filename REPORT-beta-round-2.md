# Beta Round 2 report (Oct 16, 2026)

The build is `tempo-golf.html`, built by build.py, republished to the same public link (Version 5). engine.js is byte-identical to round 1. Save key `tempo-golf-v1` is unchanged.

Every number here is headless: Playwright, Chromium 1194, swiftshader WebGL, 390×844 at DPR 2 with `isMobile`/`hasTouch`, hand-stepped 60 Hz frames, and a simulated clock where noted. Nothing was measured on a phone. "Measured" means read from rendered pixels or rendered audio. "Inferred" is labelled.

## Status by task

| Task | Done-when | Result |
|---|---|---|
| T1 | club leaves the top within 1 frame of the 3 px rise | **Met.** It is at its highest 0–4 ms after the 3 px sample and 0.5° down 8–17 ms after it (round 1: 12–71 ms). |
| T1 | ≤10% of the downswing left when the finger crosses | **Met.** 0–10% (round 1: 37–80%). |
| T1 | velocity changes sign at most once; never <20°/s for >2 frames | **Met.** One sign change (the reversal) in every run; 0 in the hold runs, where the club is already still at the top. Longest run under 20°/s: 0 frames (round 1 hold runs: 3–5). |
| T1 | shaft flips within ±20 ms of contact, peaks in range, settles <2 mm | **Flip and settle met; peaks mostly met.** Flip −19 to +13 ms (round 1: +129 to +141). Settles to 0.01–0.02 mm. Peaks match round 1 within 2–12 mm for every club at 150 ms, but the driver at 80 ms is 92 mm (round 1: 117) and a linear 250 ms flick is 61 mm (round 1: 100). |
| T1 | finger-cross → ball moving ≤40 ms | **Met.** 0.7–16.7 ms (round 1: 17–33). |
| T1 | logged power, dev, tempoMul identical to round 1 | **Met.** 40 of 40 runs identical. |
| T2 | OfflineAudioContext table, no oscillator ramps, WAVs, whoosh log, first takeShot Snd.play <1 ms | **Met**, with two notes: the driver's absolute peak is at 1.5 ms (within 1 dB by 0.3 ms), and sand's attack is set by its soft thump (see table). First Snd.play 0.2–0.4 ms (round 1: 1.6–2.7). |
| T3 | 8 m along the fall line differs by ≥8% in luma from beside the cup | **Met on 3 of 6 greens with A 0.14 / H 0.2.** The other three fall short (5.4%, 6.7%, 7.0%) because the green only drops 13–16 cm over 8 m. H 0.15 passes 5 of 6; H 0.1 passes 6 of 6 (measured). |
| T3 | darker always means downhill (5 points per green) | **The tint itself: 30 of 30.** On screen: 25 of 30 (round 1: 15 of 30, i.e. chance). The 5 misses are the green's own existing shading variation (stripes and the large-scale detail noise, up to ±4%), which beats the tint's 1.3–3.8% change over 3 m. |
| T3 | stripes ≤2%; no seam; capture.js and bot.js unchanged | **Met.** Stripes 1.7–1.9% by theme. Tint weight is exactly 0 on every boundary vertex of the green mesh (40 holes). capture.js byte-identical; bot.js identical except its own timing line. |
| T4 | no loose blades | **Met.** The only blades are the lie clump: 0 instances on the fairway, in flight and on the green, 100 around a ball in the rough. |
| T4 | rough vs fairway luma ≥10% at a distance | **Met for meadow and autumn (−21 to −24%). Not met for links (−7 to −8%) or desert (+8 to +9%)**: with THEMES colors kept, their rough and fairway are close in brightness and differ in hue (khaki or sand against green). |
| T4 | ball sits in its clump | **Met.** With the club out of the way, the clump hides the bottom 26–33% of the ball's height (27–38% of its area). See deviation 1. |
| T4 | buildTufts not running during play | **Met in the sense the brief allows ("or only places the lie clump").** Perf at 6×: round 1 timed 67 buildTufts slices up to 13.6 ms; round 2 timed 1 call, 0.8 ms, when the drive came to rest in the rough. No per-frame job. |

## Deviations from the brief (your call)

1. **Clump height is 4.5–5 cm, not 3–4 cm.** At 3.5–4 cm the template's leaning blades hid only the bottom 15–26% of the ball. 4.5–5 cm hides 26–33%, which is the "roughly the lower third" you asked for. `FEEL.clump.hMin/hMax` = 0.03/0.04 restores your numbers.
2. **Two additions to the club model that the brief didn't name**, both needed for the T1 criteria:
   - **Speed-matched commit.** With FEEL.commit's 20 ms minimum and a tiny gap left at high speed, the club braked before the ball (extra sign changes). Now, for non-putters, if the remaining gap at the approach speed (×`down.impactGain` 1.15 at impact) takes less than `Tc`, that shorter time is used. FEEL.commit values are untouched.
   - **Shaft release window.** Raising ω to 42 and retuning `c` alone left the flip 96–141 ms late. The lag drive now switches off over 6 ms once the club is 46 ms from the ball (`flex.releaseLead`, `releaseWidth`), so the loaded shaft swings through at impact.
3. **Backswing reach dropped** as a side effect of back ζ 1.0 (you asked for it): a 350 ms ease-out pull now reaches 83.8% of the backswing when the finger hits the bottom (round 1: 90.8%); a constant-speed pull 67.8% (74.2%). If the finger holds, the club still gets to the top.
4. **Rough paint keeps the random sequence.** Dropping the patches removed 1,240 random draws, which would have shifted the course-wide mottle overlay painted later. The draws are still consumed, so fairway, tee, bunker and green paint are unchanged.
5. **Rough band contrast target is 2.2%**, not 3%: at 2.5% the desert theme measured 3.05% in the texture.

## 1. What changed, by task (line numbers in the new game.js)

**T1: one fluid swing**
- 1140–1144: FEEL `back` (ζ 1.0) and the new `down` block; the old ω 40 downswing spring is gone.
- 1150–1153: FEEL `flex` (ω 42, release window, retuned `c`).
- 1347–1348: CV state for the driven downswing and flex.
- 1356–1357, 1359–1372: stepFlex tracks arm acceleration and applies the release window.
- 1422–1426, 1429–1432: stepClub 'back' enters 'down' on the reversal (putter unchanged), starts the whoosh, and eases the hinge back after an aborted downswing.
- 1437–1465: stepClub 'down' for non-putters: back to 'back' if the finger goes down; otherwise `aS·(1−u^1.3)` from predicted finger progress, blended out of the back spring over 60 ms, with error easing. Putter branch unchanged.
- 1490, 1495–1501: clubCommit's speed-matched branch.
- 2430–2439: onMove reversal tracking (`rev`, `u`, `tRev`); shot logic above it unchanged.
- 2937–2938: `__tempo.state()` adds `v`, `rev`, `u`, `tRev`, `whoosh`; exports `Snd`, `greenTint`, `camera`.

**T2: golf sounds**
- 1155–1169: FEEL `sound`.
- 1532–1536: updateClub drives the whoosh from club speed every frame.
- 1555, 1560: deterministic noise buffer; `warm()` at audio init.
- 1583–1584: the old 'hit', 'turf', 'sand', 'putt' and 'whoosh' cases are removed.
- 1600–1687: impact synthesis (burst through modes, turf, rough, sand, putt), whoosh voice, warm-up, offline render hook.
- 1815: `Snd.warm()` at each hole start.
- 1848, 1854: takeShot calls `Snd.impact` (putt loudness follows ball speed).
- The whoosh at finger-cross (old line 2320) is removed.

**T3: green slopes you can see**
- 243–245, 248–250, 259–260, 263: `greenTint` uniforms and the tint in addDetail (tanh written out; GLSL ES 1.0 has none).
- 287: `addDetail(matGreen, 0, true)`.
- 660: stripe alpha from FEEL (0.35, was 0.9).
- 765–769: buildGreen's tint weight attribute and per-hole uniforms. The normal-exaggeration loop and `GREEN_SLOPE_K` are removed.
- 1171: FEEL `green`.

**T4: a simple rough**
- 592–593, 597–604, 606: rough paint (both blob loops dropped; mowing bands; first-cut shade band; random sequence kept).
- 1012–1031: the tuft job is replaced by the lie clump (`buildTufts(x, z)`; `stepTufts` removed). Old call sites are unchanged.
- 1172–1173: FEEL `roughPaint`, `clump`.
- 1841: takeShot clears the clump.
- The per-frame `stepTufts(1.5)` call (old line 2241) is removed.

## 2. What I tested and how

### T1 (`test/swing2.js`)
The real game loop at 60 Hz with a simulated clock and synthetic touch. The thumb pulls to 99% power over 450 ms, then an upstroke accelerating from rest (y ∝ t²) reaches the start line at 120, 200 or 300 ms; plus a 200 ms upstroke after a 500 ms hold at the bottom. The upstroke start is swept across 5 phases of the 60 Hz grid. Club substeps (240 Hz) are logged. Driver and 7-iron, 40 runs.

| Case | Top after 3 px sample | 0.5° down after | Left at line | Sign changes | Frames <20°/s | Shaft flip vs contact | Peak bend | Settle | Cross → ball moving |
|---|---|---|---|---|---|---|---|---|---|
| Driver 120 ms | 0–4 ms | 8 ms | 1–10% | 1 | 0 | −7 to +11 ms | 85–93 mm | 0.02 mm | 0.7–13.3 ms |
| Driver 200 ms | 0–4 ms | 13 ms | 0–1% | 1 | 0 | −15 to −9 ms | 99–113 mm | 0.02 mm | 4.0–16.7 ms |
| Driver 300 ms | 4 ms | 13–17 ms | 0–1% | 1 | 0 | −19 to −7 ms | 81–94 mm | 0.02 mm | 4.0–16.7 ms |
| Driver hold 0.5 s | still at top | 8 ms | 0–6% | 0 | 0 | −16 to −5 ms | 96–109 mm | 0.02 mm | 0.0–16.0 ms |
| 7-iron 120 ms | 0–4 ms | 8 ms | 1–10% | 1 | 0 | −6 to +13 ms | 39–43 mm | 0.01 mm | 0.7–13.3 ms |
| 7-iron 200 ms | 0–4 ms | 13 ms | 0–1% | 1 | 0 | −15 to −9 ms | 46–53 mm | 0.01 mm | 4.0–16.7 ms |
| 7-iron 300 ms | 4 ms | 13–17 ms | 0–1% | 1 | 0 | −19 to −7 ms | 36–42 mm | 0.01 mm | 4.0–16.7 ms |
| 7-iron hold 0.5 s | still at top | 8–13 ms | 0–1% | 0 | 0 | −17 to −9 ms | 45–52 mm | 0.01 mm | 4.0–16.7 ms |
| Round 1, same inputs | 12–71 ms | — | 37–80% | 1–2 | 0 (hold 3–5) | +129 to +141 ms | driver 97–128, 7-iron 48–62 | 0.01–0.03 | 17–33 ms |

- Outcomes: power, dev and tempoMul are identical to round 1 in 40 of 40 runs.
- Peak deflection on round 1's own harness (`swingsim.js`, linear flicks, 99% power), round 2 vs round 1: driver 80 / 150 / 250 ms 92 / 118 / 61 mm (117 / 106 / 100); 3-wood and hybrid 87 (85); 7-iron 54 (52); PW and SW 41 (39).
- The club sits within 2% of the ball for 4–17 ms before contact. That is the gap until the finger sample that crosses the line arrives; at 60 Hz sampling it can't be shorter.

### T2 (`test/sounds.js`, `test/firstshot.js`)
Each impact is rendered through the game's own synthesis into an OfflineAudioContext at 48 kHz and analysed. Oscillators are counted by wrapping `createOscillator`: **0 in every impact**. The whoosh is a looping noise source through a band-pass and a gain; its band-pass centre follows club speed (a filter moving, not an oscillator), and it creates no oscillator either. The only oscillator sweeps left in game.js are in sounds outside this task, all unchanged: cup, rattle, lip, knock, bird. Turf, sand spray and rough swish start at a random slice of the noise buffer, so their rows are ranges over 5 renders; the clicks use a fixed slice and are identical every time.

| Sound | Attack: peak / within 1 dB | Time to −40 dB | Centroid (first 20 ms) | Energy <150 Hz | Peak |
|---|---|---|---|---|---|
| Driver | 1.5 / 0.3 ms | 79 ms | 3,760 Hz (3,754) | 0 | −6.1 dBFS |
| 3-wood (fairway) | 1.0 / 0.3 ms | 70–74 ms | 2,323–2,513 (3,090–3,244) | 0.002–0.004 | −7.1 |
| 7-iron fairway (click + turf) | 1.0 / 0.3 ms | 88–96 ms | 743–817 (1,819–2,102) | 0.06–0.15 | −9.0 |
| 7-iron click only | 1.0 / 0.3 ms | 33 ms | 2,634 | 0 | −9.0 |
| Turf only (7-iron) | starts 5–12 ms | 88–100 ms | 468–494 | 0.05–0.10 | −17 to −20 |
| Wedge (click + turf) | 0.3 / 0.3 ms | 96–108 ms | 655–701 (1,588–1,866) | 0.03–0.07 | −11.0 |
| Wedge click only | 0.3 / 0.3 ms | 28 ms | 3,117 | 0 | −11.0 |
| Rough (7-iron) | 1.3–12.5 / 0.3 ms | 96–112 ms | 2,426–2,809 | 0.03–0.15 | −13.4 |
| Rough click only | 1.3 / 0.3 ms | 37 ms | 2,159 | 0 | −13.4 |
| Sand (wedge) | 4.5–16.5 / 2.8–15 ms | 301–336 ms | 7,164–7,217 (4,497–4,863) | 0.03–0.07 | −15 to −18 |
| Sand thump only | 0.8–7.5 ms | 136–159 ms | 707–786 | 0.15–0.34 | −15 to −20 |
| Putt 3 / 10 / 15 m | 0.5 / 0.5 ms | 24.5 ms | 1,346 | 0 | −21.5 / −17.5 / −16.1 |

- Driver and woods have no turf; irons and wedges have it, louder on fuller swings and softer on wedges. Wedge click is higher (3.1 kHz) and quieter than the 7-iron's (2.6 kHz). Rough click is duller (2.2 kHz) plus a swish. Sand's click is at 0.12 gain, so the thump sets its attack.
- The driver's peak lands at 1.5 ms because its modes beat; it is within 1 dB of that peak at 0.3 ms.
- Whoosh, full driver (gain against club speed, frame samples relative to contact): 80°/s → 0.0002 at −167 ms; 1,103°/s → 0.029 at −83 ms; 2,192°/s → 0.116 at −33 ms; **peak 3,053°/s → 0.218 at −16.7 ms**; 0.091 on the contact frame; 0.04 at +67 ms; 0.001 at +200 ms. The full log is in `sounds.json`. None on putts.
- First takeShot in a fresh page (6 runs each, 1×): Snd.play 0.2–0.4 ms (round 1: 1.6–2.7); takeShot 0.7–1.1 ms (2.2–3.9). Warm page, 12 shots each: putt takeShot median 0.4 ms (round 1: 0.3), full shot 0.6 ms (0.4).
- WAVs in `test/sounds/`: driver, 7-iron fairway, wedge, rough, sand, putt 3 / 10 / 15 m, and driver whoosh + impact.

### T3 (`test/greens2.js`)
Putting camera at 390×844 (DPR 2), tiers 1, 5 and 9, each under a low (27–29°) and a high (43–44°) sun. The ball sits 9.5 m down the fall line from the cup. Luma is read from the 3D canvas (no HUD), as 9×9 px means. "Beside the cup" = 0.7 m either side, across the fall line. The 8 m points sit 0.8 m either side of the fall line, so the window misses the flagstick (uphill) and aim line (downhill). The first version of this test put the uphill point on the flagstick; that is why it read darker. The comparison build is round 1 at the same pixels. "Tint off" is the new build with A = 0.

| Green | Slope at cup | Height 8 m up / down | 8 m up: R2 / tint off / R1 | 8 m down: R2 / tint off / R1 | H 0.15 (up / down) | H 0.1 (up / down) |
|---|---|---|---|---|---|---|
| Tier 1, low sun | 1.63% | +8.9 / −14.6 cm | +6.9 / +1.0 / −1.4% | **−9.4** / −0.8 / −5.8% | +8.5 / −11.2 | +11.1 / −13.2 |
| Tier 1, high sun | 0.69% | +10.3 / −3.5 cm | **+8.6** / +2.1 / +4.7% | −0.6 / +1.9 / +3.7% | +9.6 / −1.4 | +10.2 / −2.9 |
| Tier 5, low sun | 1.10% | +7.8 / −13.0 cm | +5.2 / +0.1 / −2.0% | −5.4 / +2.8 / +2.1% | +6.8 / −7.2 | +9.2 / −9.5 |
| Tier 5, high sun | 1.81% | (off green) / −14.1 cm | — | −6.7 / +1.9 / +5.6% | — / −8.5 | — / −10.6 |
| Tier 9, low sun | 1.49% | (off green) / −18.6 cm | — | **−8.0** / +2.4 / −0.3% | — / −9.6 | — / −11.1 |
| Tier 9, high sun | 1.13% | (off green) / −15.6 cm | — | −7.0 / +2.4 / +4.3% | — / −8.7 | — / −10.7 |

- Darker means downhill. At 5 points per green, luma 1.5 m down each point's own fall line (the way the dots flow) is compared with 1.5 m up it.
  - On screen: 25 of 30 darker (round 1: 15 of 30).
  - Tint alone (on vs off at the same pixels): 30 of 30 darker, by 1.3–3.8%.
  - Tint off, the green itself varies −3.5 to +4.1% over those 3 m. That variation is the stripes (≤1.9%) plus the existing large-scale detail noise in addDetail (`gC`/`gD`, roughly ±3.5% and ±2%), which this round didn't touch. In a separate decomposition run (earlier sample points), taking out the painted map and the detail noise left under 1.1% variation at 57 of 58 points.
- Seam: on 40 holes (5 tiers × 8 seeds), the tint weight on every boundary vertex of the green mesh is 0. The fringe's outer edge sits at greenQ ≤ 1.17, inside the mesh edge (≥1.47). The weight changes by at most 0.82 per metre, so there is no step. The "tint alone" panel in the screenshots shows it fading out across the fringe.
- Stripes: alpha 0.35 → 1.73–1.93% luma contrast by theme.
- capture.js: byte-identical output. bot.js: all 24 event lines identical; only the "avg gen ms" timing line differs (0.8 vs 0.9).
- Screenshots: `test/shots2/greens_low_sun.png` and `greens_high_sun.png`. Each has round 2 (with the sample points drawn), round 1, and the tint alone ×8.
- What I saw in the screenshots (an impression, not measured): from the putting camera, the green between ball and cup is foreshortened into a short band, so most of the visible change sits near the cup, and the foreground below it reads as one darker shade.

### T4 (`test/rough2.js`)
All four themes. Address on the fairway, address in the rough (ball 4.5 m outside the first cut), a hit from the rough followed to the landing area on the flight camera, and the map view.

| Theme | Rough vs fairway, map | Rough vs fairway, landing view | Band contrast (texture) | Shade band | OB vs rough | Clump hides (club raised): height / area | At address: club covers / grass adds |
|---|---|---|---|---|---|---|---|
| Meadow | −23.4% | −22.6% | 2.3% | −8.7% | −36% | 33% / 37% | 63% / 6% |
| Links | −7.0% | −8.1% | 2.3% | −7.9% | −20% | 30% / 38% | 63% / 6% |
| Desert | +7.6% | +9.3% | 2.6% | −8.0% | −13% | 26% / 27% | 63% / 9% |
| Autumn | −23.6% | −21.5% | 2.1% | −8.0% | −36% | 30% / 34% | 63% / 7% |

- Rough vs fairway: luma of the 3D canvas at grid points 3 m or more inside each surface and away from trees (40–160 m from the camera on the landing view, the whole view on the map), trimmed mean. 63–2,912 points per surface.
- Links and desert miss 10% because of their THEMES colors (texture luma, before lighting): links rough 168 vs fairway 182 (−7.7%); desert rough 183 vs fairway 171 (+6.9%). Reaching 10% would need links rough at luma ≤163 or desert rough at ≥188 (a THEMES change, which is yours to make).
- Bands, shade band and OB are medians along each hole from the course texture (100–158 samples per side pair). OB also includes painted tree shadows.
- Clump: 100 instances, all within 0.235–0.249 m of the ball. Placing it took 0.4–3.7 ms (1×, includes first-call cost). On the fairway, fringe and green, `buildTufts` places 0. A shot from the rough takes the count from 100 to 0. Blade counts in the other views: fairway 0, landing 0, map 100 (the clump at the ball).
- Address camera: the 7-iron head already covers about 63% of the ball's area at address (ball pixels visible with the club in place: 207–209 of 561). So in the address view the clump adds only 6–9%. The clump reads more from the sides and in the close crop. Club shapes and the camera are on your don't-touch list.
- Screenshots: `test/shots2/rough_meadow.png`, `rough_links.png`, `rough_desert.png`, `rough_autumn.png` (fairway address, rough address, landing, map, and a close crop of the ball).

### Regression checks
- Perf at 6× (`perf.js`), round 1 → round 2:
  - programs 22 → 22 → 22 in both;
  - frames with any section over 4 ms: 52 → 34;
  - buildTufts: 67 timed slices, max 13.6 ms → 1 call, 0.8 ms.
  - Render times under swiftshader during flight are not meaningful (tens of seconds in both builds).
- Save compatibility (`savecompat.js`):
  - a pre-round-1 save (no `settings.perf`) loads, Continue resumes on hole 3 with scores [4, 5], and no errors;
  - a round-1 save (`perf: true`) does the same and keeps Perf on.
- `round.js`: a full 6-hole round plays to the results with no page errors.
- Shader programs at first contact: unchanged (22).

## 3. What I couldn't verify
- Anything on a phone: feel, frame rate, touch sampling rate, and how the reversal reads at 120 Hz touch.
- Sound on an iPhone: speaker response, loudness against the wind bed, and the hardware mute switch (WebAudio in Safari obeys it).
- Whether the sounds actually sound like golf. The table shows they meet your spectral and timing specs, nothing more.
- Whether the tint reads to a player. Pixels are measured; perception isn't. Only six greens and one camera position (9.5 m below the cup) were measured.
- Desert and links rough contrast. It is measured to fall short of 10%, and whether hue is enough there is a judgement call.
- The whoosh's level relative to impacts in a real room.

## 4. What to try on your iPhone
1. **Full drivers and irons at slow, medium and fast rhythm.** Watch the top: the club should turn over the moment your thumb starts up, with no stop-and-go. Listen at contact: crack for the driver, click then a turf thud for irons.
2. **One swing with a pause at the bottom.** The club should hold still at the top, then go when your thumb moves. No SLOW TEMPO.
3. **One swing where you start up and then pull back down.** The club should ease back to the top, not snap.
4. **Putts of 3, 8 and 15 m on sloped greens.** Before each stroke, read the tint (lighter = above the cup, darker = below it) and check it against the slope dots. Listen for a soft tock that gets louder with longer putts.
5. **A hole played from the rough.** Check that the ball sits in its clump, that the clump vanishes at contact, that the rough looks like one deliberate surface (bands, a darker edge along the first cut), and that there are no loose blades anywhere. On links and desert, judge whether the rough reads as rough without the brightness gap.
6. **A wedge from a bunker.** Listen for a thump and spray with almost no click.

## 5. New or changed FEEL values

| Value | Now | Was | What it does |
|---|---|---|---|
| `back.zeta` | 1.0 | 0.8 | backswing spring damping (critically damped: no overshoot, holds at the top) |
| `down.omega` | removed | 40 | old downswing spring |
| `down.revPx` | 3 px | — | finger rise from the lowest point that starts the club down |
| `down.exp` | 1.3 | — | club angle = aS·(1 − u^exp) |
| `down.blend` | 0.06 s | — | blend out of the backswing spring |
| `down.predict` | 1/60 s | — | how far past the last finger sample progress is predicted |
| `down.predictAcc` | 1 | — | weight of finger acceleration in the prediction |
| `down.errTau` | 0.012 s | — | prediction corrections ease out over this |
| `down.bEase` | 0.04 s | — | hinge easing after an aborted downswing |
| `down.impactGain` | 1.15 | — | speed-matched commit: impact speed = approach speed × this |
| `down.putterOmega`, `putterExp`, `lagExp` | 19, 1.35, 0.5 | same | unchanged, moved into the new `down` block |
| `flex.omega` | 42 | 30 | shaft spring |
| `flex.c` | driver 1.15e-4, wood 0.85e-4, iron 0.55e-4, wedge 0.42e-4, putter 0 | 1.2e-4, 0.96e-4, 0.6e-4, 0.46e-4, 0 | bend per unit angular acceleration |
| `flex.releaseLead` | 0.046 s | — | lag drive switches off this long before the ball |
| `flex.releaseWidth` | 0.006 s | — | over this long |
| `green.tintA` | 0.14 | — | tint strength |
| `green.tintH` | 0.2 m | — | height scale of the tint |
| `green.stripeAlpha` | 0.35 | 0.9 (hard-coded) | green stripe alpha |
| `GREEN_SLOPE_K` | removed | 5 | old normal exaggeration |
| `roughPaint.bandW` | 6 m | — | rough mowing band width |
| `roughPaint.bandContrast` | 0.022 | — | band luma contrast target |
| `roughPaint.shadeW` | 0.6 m | — | darker band outside the first cut |
| `roughPaint.shadeDark` | 0.08 | — | how much darker it is |
| `clump.n` | 100 | — | tufts in the lie clump |
| `clump.r` | 0.25 m | — | clump radius |
| `clump.bias` | 2.5 | — | distance from ball = r·u^bias (0.5 = even spread) |
| `clump.hMin`, `hMax` | 0.045, 0.05 m | — | tuft height (see deviation 1) |
| `clump.wMin`, `wMax` | 0.4, 0.6 | — | width scale of the tuft template |
| `sound` | new block | — | all impact, turf, rough, sand, putt and whoosh numbers, below |

```
sound: {
  modeNorm: 780,
  driver: { modes: [[1250,10,0.3],[2350,40,1],[3650,380,6],[5100,160,1.2]], burst: 0.0005, decay: 0.16, crack: 0.08, gain: 0.168, off: 0.31 },
  wood:   { modes: [[1150,10,0.3],[2200,36,1],[3400,320,5],[4800,130,1]],   burst: 0.0005, decay: 0.14, crack: 0.08, gain: 0.19,  off: 0.31 },
  iron:   { modes: [[1900,78,4],[2900,110,3],[3900,120,1.5]],                burst: 0.0005, decay: 0.07, crack: 0.03, gain: 0.177, off: 0.52 },
  wedge:  { modes: [[2150,80,4],[3250,115,2.8],[4400,130,1.3]],              burst: 0.0005, decay: 0.06, crack: 5,    gain: 0.098, off: 0.52 },
  putt:   { modes: [[1150,39,4],[1480,50,2],[2300,8,0.05]],                  burst: 0.0015, decay: 0.05, crack: 0,    gain: 0.18, min: 0.15, off: 0.77, vFull: 4.5 },
  turf:   { freq: 230, q: 0.8, lp: 500, delay: 0.008, attack: 0.004, decay: 0.1, gain: 0.6, woods: 0.4, wedge: 0.85, wedgeUp: 1.25 },
  rough:  { fScale: 0.8, crack: 0.5, click: 0.75, swish: { freq: 2500, q: 1.2, attack: 0.008, decay: 0.12, gain: 0.04 } },
  sand:   { click: 0.12, thump: { lp: 350, attack: 0.0008, decay: 0.15, gain: 1.2 }, spray: { freq: 3500, q: 0.5, hp: 2500, attack: 0.012, decay: 0.38, gain: 0.12 } },
  whoosh: { gain: 0.22, vRef: 3000, f0: 250, f1: 1600, q: 1.1, tau: 0.008, fall: 0.12 }
}
```
modes are [Hz, Q, gain]; decay is the time to −40 dB; crack is a direct high-passed click; off is a fixed noise-slice offset (s); turf `woods` 0.4 is the turf level for woods hit off the ground (none off a tee); whoosh gain = gain · power · min(1, speed / vRef)², with the band sliding from f0 to f1 as speed rises.

## Files
- `tempo-golf.html` (published), `game.js`, `engine.js` (unchanged), `game.src.html`, `build.py`, `HANDOFF.md` (updated for this round).
- Tests added: `test/swing2.js`, `test/sounds.js`, `test/firstshot.js`, `test/greens2.js`, `test/rough2.js`.
- `test/sounds/*.wav`, `test/shots2/*.png`.
