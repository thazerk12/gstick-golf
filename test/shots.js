// Screenshots for this round at 390x844 (DPR 2).
// usage: OUT=<dir> PART=swing|putt|greens|perfui node test/shots.js <page.html> <tag>
//  swing:  driver at top, mid-downswing, impact, finish (game camera and a face-on camera), manual 60 Hz frames
//  putt:   a 15 m putt mid-roll, manual frames
//  greens: putting camera on a green at tiers 1, 5 and 9 (runs on old builds too: real-time loop, no test hooks)
//  perfui: the Perf toggle in the pause menu and the readout during play
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp';
const SRC = process.argv[2], TAG = process.argv[3] || 'x';
const PART = process.env.PART || 'swing';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  if (PART === 'swing' || PART === 'putt') await page.addInitScript(() => {
    const real = performance.now.bind(performance);
    window.__sim = { on: false, t: 0 };
    performance.now = () => (window.__sim.on ? window.__sim.t : real());
  });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>';
  const f = OUT + '/shots_' + TAG + '.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const shot = async (name) => { await page.screenshot({ path: OUT + '/' + TAG + '_' + name + '.png' }); };
  const info = {};

  if (PART === 'swing' || PART === 'putt') {
    await page.evaluate((part) => {
      const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
      T.save().seenHow = true;
      T.startRound({ kind: 'quick', seed: part === 'putt' ? 'sim-b' : 'shots-a', tier: 4, course: 0 });
      G.manual = true; sim.base = performance.now(); sim.on = true; sim.t = sim.base;
      let k = 0;
      const ev = (type, x, y) => { const e = new PointerEvent(type, { pointerId: 9, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }); (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(e); };
      const frame = (draw) => { k++; sim.t = sim.base + k * 1000 / 60; T.tick(1 / 60, !!draw); };
      const putAt = (x, z, club) => {
        const h = G.hole; G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = club; G.strokes = 0;
        G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.swing = null; G.shot = null; G.dip = null; if (G.bprev) G.bprev.ok = false;
        Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
        G.flagScale = G.flagFrom = G.flagTo = Math.max(1, Math.hypot(h.pin.x - x, h.pin.z - z) / 45); G.flagT = 1;
        G.previewDirty = true; for (let i = 0; i < 90; i++) frame(i > 80); T.snap(); frame(true);
      };
      window.__X = { T, G, CV, E, ev, frame, putAt };
    }, PART);
  }

  if (PART === 'swing') {
    // a full driver with a 250 ms flick; frames are stepped in the page, and each pose is rendered from the game camera and face-on
    await page.evaluate(() => { const { G, putAt } = window.__X; G.timer = 9; putAt(0, 0.6, 0); });
    // face-on frames hide the HUD and the swing overlay so the club reads clearly
    const hud = async (on) => page.evaluate((on) => { for (const id of ['hudTop', 'hudBot', 'fx', 'toast']) { const e = document.getElementById(id); if (e) e.style.visibility = on ? '' : 'hidden'; } }, on);
    const faceOn = async () => { await hud(false); await page.evaluate(() => {
      const { T, G, CV, frame } = window.__X, V = CV.shot || G.ball, yaw = CV.shot ? CV.shot.yaw : G.aim;
      const gx = Math.cos(yaw), gz = -Math.sin(yaw), tx = Math.sin(yaw), tz = Math.cos(yaw);   // toward the golfer, down the target line
      // anchored on the club's address spot (the ball has already left on the contact frame), far enough back for the whole arc
      G.freeCam = { pos: { x: V.x - gx * 7 - tx * 0.3, y: V.y + 1.0, z: V.z - gz * 7 - tz * 0.3 }, look: { x: V.x + gx * 0.45 - tx * 0.3, y: V.y + 0.85, z: V.z + gz * 0.45 - tz * 0.3 } };
      G.freeCam.pos = new (T.cam.pos.constructor)(G.freeCam.pos.x, G.freeCam.pos.y, G.freeCam.pos.z);
      G.freeCam.look = new (T.cam.pos.constructor)(G.freeCam.look.x, G.freeCam.look.y, G.freeCam.look.z);
      T.tick(0, true);
    }); };
    const gameCam = async () => { await hud(true); await page.evaluate(() => { const { T, G } = window.__X; G.freeCam = null; T.tick(0, true); }); };
    const X = 195, Y0 = 560, L = Math.min(300, Math.max(140, 844 * 0.3)), D = L * 0.99;
    // pull 450 ms (ease-out), flick 150 ms (linear) to 40 px past the line
    const poses = await page.evaluate(([X, Y0, D]) => {
      const { CV, G, ev, frame } = window.__X;
      const st = () => ({ phase: CV.phase, a: +CV.a.toFixed(1), b: +CV.b.toFixed(1), bend: +CV.bend.toFixed(4), mode: G.mode, ts: +G.timeScale.toFixed(3) });
      ev('pointerdown', X, Y0);
      const pull = 27, flick = 9; let top = null;
      for (let i = 1; i <= pull; i++) { const k = i / pull; ev('pointermove', X, Y0 + D * (1 - (1 - k) * (1 - k))); frame(false); }
      window.__X.flick = { i: 0, pull, flick, X, Y0, D };
      return st();
    }, [X, Y0, D]);
    info.poses = {};
    // step one frame at a time through the flick, capturing the top (max a), mid-downswing (a about half of the top) and impact
    let topDone = false, midDone = false, impDone = false, aTop = poses.a;
    for (let n = 0; n < 40; n++) {
      const s = await page.evaluate(() => {
        const X_ = window.__X, F = X_.flick, { CV, G } = X_;
        if (F.i <= F.flick) { const y = F.Y0 + F.D - (F.D + 40) * Math.min(1, (F.i + 1) / F.flick); if (G.swing) X_.ev('pointermove', F.X, y); F.i++; }
        const prevA = CV.a, prevPh = CV.phase;
        X_.frame(true);
        return { phase: CV.phase, prevPh, a: CV.a, prevA, b: CV.b, bend: CV.bend, mode: G.mode, ts: G.timeScale, hit: CV.phase === 'follow' && (prevPh === 'commit' || prevPh === 'down') };
      });
      if (!topDone && (s.phase === 'down' || s.phase === 'commit')) { topDone = true; }
      if (!topDone) { aTop = Math.max(aTop, s.a); }
      if (topDone && !midDone && s.a < aTop * 0.62 && s.a > 0) { midDone = true; info.poses.mid = s; await shot('drv_2_mid'); await faceOn(); await shot('drv_2_mid_face'); await gameCam(); }
      if (!impDone && s.hit) { impDone = true; info.poses.impact = s; await shot('drv_3_impact'); await faceOn(); await shot('drv_3_impact_face'); await gameCam(); break; }
    }
    // follow-through: the frame where the shaft kicks forward the most (about 0.2 s after contact)
    info.poses.kick = await page.evaluate(() => { const { CV, G, frame } = window.__X; let best = 0, n = 0; for (; n < 30; n++) { frame(false); if (CV.bend < best) best = CV.bend; else if (best < -0.02 && CV.bend > best * 0.9) break; } return { phase: CV.phase, a: CV.a, b: CV.b, bend: CV.bend, frames: n }; });
    await faceOn(); await shot('drv_3b_kick_face');
    // finish: run until the follow-through completes
    info.poses.finish = await page.evaluate(() => { const { CV, G, frame } = window.__X; let n = 0; while (CV.phase !== 'finish' && n < 200) { frame(false); n++; } for (let i = 0; i < 12; i++) frame(i === 11); return { phase: CV.phase, a: CV.a, b: CV.b, bend: CV.bend, mode: G.mode }; });
    // the game camera has followed the ball by now; the finish is shown face-on and from the address spot
    await faceOn(); await shot('drv_4_finish_face');
    await gameCam();
    // top: a second swing, stopped at the top of the backswing (held there by the finger)
    info.poses.top = await page.evaluate(([X, Y0, D]) => {
      const { CV, G, ev, frame, putAt } = window.__X;
      putAt(0, 0.6, 0);
      ev('pointerdown', X, Y0);
      for (let i = 1; i <= 27; i++) { const k = i / 27; ev('pointermove', X, Y0 + D * (1 - (1 - k) * (1 - k))); frame(i === 27); }
      for (let i = 0; i < 18; i++) frame(i === 17);
      return { phase: CV.phase, a: CV.a, b: CV.b, bend: CV.bend, aTop: CV.spec.aTop };
    }, [X, Y0, D]);
    await shot('drv_1_top'); await faceOn(); await shot('drv_1_top_face'); await gameCam();
    info.aTopSeen = aTop;
  }

  if (PART === 'putt') {
    info.putt = await page.evaluate(() => {
      const { T, G, E, ev, frame, putAt } = window.__X, h = G.hole;
      let pp = null;
      for (let k = 0; k < 72 && !pp; k++) { const a = k * Math.PI / 36, x = h.pin.x + Math.sin(a) * 15, z = h.pin.z + Math.cos(a) * 15; if (h.surface(x, z) === E.S.GREEN) pp = { x, z }; }
      if (!pp) return { error: 'no spot' };
      putAt(pp.x, pp.z, E.CLUBS.length - 1);
      const L = Math.min(300, Math.max(140, innerHeight * 0.3)), D = L * (15 / E.puttMax(15)) * 1.08, X = 195, Y0 = 560;
      ev('pointerdown', X, Y0);
      for (let i = 1; i <= 24; i++) { ev('pointermove', X, Y0 + D * (1 - (1 - i / 24) ** 2)); frame(false); }
      for (let i = 1; i <= 26; i++) { if (G.swing) ev('pointermove', X, Y0 + D - (D + 4) * Math.min(1, i / 24)); frame(false); }
      window.__X.marks = [];
      return { from: pp, D };
    });
    // roll until the ball is ~8 m and then ~2.5 m from the cup
    for (const [nm, d] of [['putt15_mid', 8], ['putt15_near', 2.6]]) {
      const s = await page.evaluate((d) => {
        const { G, frame } = window.__X, h = G.hole; let n = 0;
        while (n < 900 && (G.mode === 'flight' || G.mode === 'impact') && Math.hypot(G.ball.x - h.pin.x, G.ball.z - h.pin.z) > d) { frame(false); n++; }
        frame(true);
        return { mode: G.mode, st: G.ball.state, dPin: Math.hypot(G.ball.x - h.pin.x, G.ball.z - h.pin.z), ballScale: G.ballScale, flag: G.flagScale };
      }, d);
      info[nm] = s; await shot(nm);
    }
  }

  if (PART === 'greens') {
    // real-time loop on purpose so the same script runs on the pre-round build
    for (const tier of [1, 5, 9]) {
      const r = await page.evaluate((tier) => {
        const T = window.__tempo, G = T.G, E = T.E;
        T.save().seenHow = true;
        T.startRound({ kind: 'quick', seed: 'greens-' + tier, tier, course: 0 });
        G.timer = 9;
        return true;
      }, tier);
      await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
      const tStart = await page.evaluate(() => window.__tempo.G.time);
      info['tier' + tier] = await page.evaluate(() => {
        const T = window.__tempo, G = T.G, E = T.E, h = G.hole;
        const back = Math.atan2(h.tee.x - h.pin.x, h.tee.z - h.pin.z);
        let pp = null;
        for (let k = 0; k < 36 && !pp; k++) for (const sgn of [1, -1]) { const a = back + sgn * k * Math.PI / 36, x = h.pin.x + Math.sin(a) * 6, z = h.pin.z + Math.cos(a) * 6; if (!pp && h.surface(x, z) === E.S.GREEN) pp = { x, z }; }
        G.ball.place(h, pp.x, pp.z); G.ball.state = 'rest'; G.lie = E.S.GREEN; G.club = E.CLUBS.length - 1;
        G.aim = Math.atan2(h.pin.x - pp.x, h.pin.z - pp.z); G.previewDirty = true;
        return { stimp: h.stimp, pin: { x: h.pin.x, z: h.pin.z }, ball: pp };
      });
      // wait on game time, not wall time: the headless renderer manages only a few frames a second
      const gt = async (d) => { const t0 = await page.evaluate(() => window.__tempo.G.time); await page.waitForFunction(([t0, d]) => window.__tempo.G.time > t0 + d, [t0, d], { timeout: 120000 }); };
      await gt(0.3); await page.evaluate(() => window.__tempo.snap()); await gt(1.2); await page.evaluate(() => window.__tempo.snap()); await gt(0.3);
      info['tier' + tier].state = await page.evaluate(() => { const T = window.__tempo, G = T.G; return { mode: G.mode, gameTime: G.time, flag: G.flagScale, club: G.club, cam: [T.cam.pos.x, T.cam.pos.y, T.cam.pos.z].map(v => +v.toFixed(1)), ball: [G.ball.x, G.ball.z].map(v => +v.toFixed(1)) }; });
      await shot('green_t' + tier);
    }
  }

  if (PART === 'perfui') {
    await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'perfui', tier: 3, course: 0 }); T.G.timer = 9; });
    await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
    await page.waitForTimeout(800);
    await page.click('#btnPause'); await page.waitForTimeout(400);
    await page.click('#pPerf'); await page.waitForTimeout(300);
    await shot('perf_menu');
    info.saved = await page.evaluate(() => window.__tempo.save().settings.perf);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /resume/i.test(x.textContent) && x.offsetParent); if (b) b.click(); });
    await page.waitForTimeout(6000);
    await shot('perf_readout');
    info.readout = await page.evaluate(() => document.getElementById('perf').textContent);
  }

  info.errors = errs;
  fs.writeFileSync(OUT + '/' + TAG + '_info.json', JSON.stringify(info, null, 1));
  console.log(JSON.stringify(info).slice(0, 1500));
  await browser.close();
})();
