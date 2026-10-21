// Round 5 Task 5: greens that look as sloped as they putt. Run on a build (round 4 or round 5), 390x844, putting camera.
// Tiers 1, 5 and 9 (hole 1 of seed 'g5-<tier>'): the ball 10 m from the cup across the fall line (a side-hill putt), so the
// slope runs across the view. Screenshot with the slope dots and grid as the game shows them, and (round 5) the grid alone.
// Height read: points on the fall line through the cup out to 8 m uphill and 8 m downhill (shortened equally if the green
// ends sooner). For each, the drawn surface (the grid's height: round 5 hVis + 0.012, round 4 the physical height + the
// grid's own lift) and the same x, z at the cup's height are projected; the on-screen height is the px between them. The
// height difference = |uphill - downhill|.
// With POP=1 it also logs the drawn ball per frame for a chip that lands short and rolls onto the green, and for a putt that
// drops: drawn y - physical y (the relief offset) and its change per frame.
// usage: node test/green5.js <page.html> <outdir> <tag>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2]), OUT = process.argv[3] || '/tmp/green5', TAG = process.argv[4] || 'r5';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'g5_' + TAG + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, sim = window.__sim; window.__k = 0;
    window.__tick = (n, d) => { for (let i = 0; i < n; i++) { window.__k++; sim.t = sim.base + window.__k * 1000 / 60; T.tick(1 / 60, d && i === n - 1); } };
  });
  const out = { tag: TAG, greens: [] };
  for (const tier of [1, 5, 9]) {
    const r = await page.evaluate((tier) => {
      const T = window.__tempo, G = T.G, E = T.E; T.save().seenHow = true; T.save().shots = 99; T.save().settings.guide = true;
      T.startRound({ kind: 'quick', seed: 'g5-' + tier, tier, course: 0 }); G.manual = true; window.__sim.base = performance.now(); window.__sim.on = true;
      for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1, false);
      const h = G.hole, pin = h.pin, n = { x: 0, y: 0, z: 0 }; h.normal(pin.x, pin.z, n);
      let dx = n.x, dz = n.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;   // downhill at the cup
      const slopePct = 100 * Math.hypot(n.x, n.z) / n.y;
      let L = 8; while (L > 2 && (h.greenQ(pin.x + dx * L, pin.z + dz * L) > 1 || h.greenQ(pin.x - dx * L, pin.z - dz * L) > 1)) L -= 0.25;
      // the ball 10 m across the slope (or as far as the green allows, 6 m at least), on either side
      let bx = null, bz = null;
      for (const d of [10, 9, 8, 7, 6]) { for (const s of [1, -1]) { const x = pin.x - dz * d * s, z = pin.z + dx * d * s; if (h.greenQ(x, z) < 0.95) { bx = x; bz = z; break; } } if (bx != null) break; }
      if (bx == null) { bx = pin.x - dx * 5; bz = pin.z - dz * 5; }
      G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = E.CLUBS.length - 1; G.aim = Math.atan2(pin.x - bx, pin.z - bz); G.mode = 'aim'; G.shot = null; G.map = false; G.swing = null;
      T.setupClub(G.club); T.snap(); window.__tick(5, false); T.snap(); window.__tick(60, true);
      const cam = T.camera, v = new THREE.Vector3(); cam.updateMatrixWorld();
      const P = (x, y, z) => { v.set(x, y, z).project(cam); return [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight]; };
      const drawnY = (x, z) => (T.hVis ? T.hVis(x, z) : h.height(x, z)) + 0.012;   // the grid's height in each build (both drape it 0.012 m up)
      const ht = (x, z) => { const a = P(x, drawnY(x, z), z), b = P(x, pin.y, z); return b[1] - a[1]; };
      const line = []; for (let s = -L; s <= L + 1e-6; s += 0.5) { const x = pin.x + dx * s, z = pin.z + dz * s; line.push([+s.toFixed(2), +ht(x, z).toFixed(2), +(h.height(x, z) - pin.y).toFixed(4), +P(x, drawnY(x, z), z)[0].toFixed(1), +P(x, drawnY(x, z), z)[1].toFixed(1)]); }
      const up = ht(pin.x - dx * L, pin.z - dz * L), dn = ht(pin.x + dx * L, pin.z + dz * L);
      return { tier, seed: 'g5-' + tier, slopePct: +slopePct.toFixed(2), L, ball: [+(bx - pin.x).toFixed(2), +(bz - pin.z).toFixed(2)], realDrop: +(h.height(pin.x - dx * L, pin.z - dz * L) - h.height(pin.x + dx * L, pin.z + dz * L)).toFixed(4),
        upPx: +up.toFixed(2), downPx: +dn.toFixed(2), diffPx: +Math.abs(up - dn).toFixed(2), dots: !!(T.world && T.world.dots && T.world.dots.visible), grid: !!(T.world && T.world.grid && T.world.grid.visible), line };
    }, tier);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, TAG + '_tier' + tier + '.png'), timeout: 180000 });
    if (TAG !== 'r4') {
      await page.evaluate(() => { const T = window.__tempo; T.world.dots.visible = false; T.renderer.render(T.world.scene || T.camera.parent || window.__scene || T.camera, T.camera); });
      await page.evaluate(() => { const T = window.__tempo; const keep = T.world.dots.material.opacity; T.world.dots.material.opacity = 0; window.__tick(1, true); T.world.dots.material.opacity = keep; });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, TAG + '_tier' + tier + '_grid.png'), timeout: 180000 });
    }
    out.greens.push(r);
    console.log(TAG, 'tier', tier, 'slope at cup', r.slopePct + '%', 'L', r.L, 'm, real drop', r.realDrop, 'm, uphill', r.upPx, 'px, downhill', r.downPx, 'px, difference', r.diffPx, 'px; dots', r.dots, 'grid', r.grid);
  }
  if (process.env.POP) {
    out.pop = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, E = T.E, h = G.hole, pin = h.pin, res = {};
      const rec = () => { const m = T.ballMesh.position, b = G.ball; return { t: window.__k, mode: G.mode, st: b.state, x: +m.x.toFixed(4), y: +m.y.toFixed(4), z: +m.z.toFixed(4), phy: +(G.bd.y).toFixed(4), off: +(m.y - G.bd.y).toFixed(4), vis: +(T.state().ballVis || 0).toFixed(4), above: +(G.bd.y - E.BALL_R - h.height(G.bd.x, G.bd.z)).toFixed(3), q: +h.greenQ(G.bd.x, G.bd.z).toFixed(3) }; };
      const summarize = (fr) => { let mx = 0, at = null; for (let i = 1; i < fr.length; i++) { const d = Math.abs(fr[i].vis - fr[i - 1].vis); if (d > mx) { mx = d; at = fr[i]; } } return { frames: fr.length, maxVisStepMm: +(mx * 1000).toFixed(2), at }; };
      // a chip that lands short of the green and rolls on: a fairway / rough spot back down the hole, and the PW power (from
      // the engine, same lie, no wind) whose first touchdown is off the green and whose rest is on it
      const pw = E.CLUBS.findIndex(c => c.id === 'PW'), club = E.CLUBS[pw], up = T.save().upg;
      const simChip = (sx, sz, aim, power, lie) => { const sp = E.shotParams(club, power, 0, lie, up); const b = new E.Ball(); b.place(h, sx, sz); b.launch(sp.speed, sp.launch, aim + sp.aimOff, sp.spin, sp.side); const ev = []; let n = 0, land = null; while ((b.state === 'air' || b.state === 'roll') && n < 40000) { ev.length = 0; b.step(h, E.DT, ev); n++; if (!land && b.landed) land = { x: b.x, z: b.z }; } return { land, rest: { x: b.x, z: b.z }, state: b.state }; };
      let pick = null;
      for (let s = h.len - 4; s > h.len - 70 && !pick; s -= 1) {
        const p = h.pointAtS(s), lie = h.surface(p.x, p.z); if (!(lie === E.S.FAIRWAY || lie === E.S.ROUGH)) continue;
        const aim = Math.atan2(pin.x - p.x, pin.z - p.z), dist = Math.hypot(pin.x - p.x, pin.z - p.z); if (dist < 12) continue;
        for (let power = 0.1; power <= 0.9 && !pick; power += 0.01) { const r = simChip(p.x, p.z, aim, power, lie); if (!r.land) continue; const lq = h.greenQ(r.land.x, r.land.z), rq = h.greenQ(r.rest.x, r.rest.z); if (lq > 1.02 && rq < 0.9 && r.state === 'rest') pick = { sx: p.x, sz: p.z, aim, power, lie, landQ: lq, restQ: rq }; }
      }
      const chip = [];
      if (pick) {
        G.ball.place(h, pick.sx, pick.sz); G.ball.state = 'rest'; G.lie = pick.lie; G.club = pw; G.aim = pick.aim; G.mode = 'aim'; G.shot = null; T.setupClub(pw); T.snap(); window.__tick(30, false);
        T.takeShot(pick.power, 0, 1, 0);
        for (let i = 0; i < 900 && G.mode === 'flight'; i++) { window.__tick(1, false); chip.push(rec()); }
        let maxDrawnStep = 0, maxPhysStep = 0; for (let i = 1; i < chip.length; i++) { maxDrawnStep = Math.max(maxDrawnStep, Math.abs(chip[i].y - chip[i - 1].y)); maxPhysStep = Math.max(maxPhysStep, Math.abs(chip[i].phy - chip[i - 1].phy)); }
        res.chip = Object.assign(summarize(chip), { start: [+(pick.sx - pin.x).toFixed(1), +(pick.sz - pin.z).toFixed(1)], power: +pick.power.toFixed(2), landQ: +pick.landQ.toFixed(3), restQ: chip.length ? chip[chip.length - 1].q : null, onGreenFrames: chip.filter(r => r.q <= 1).length,
          maxDrawnDyMm: +(maxDrawnStep * 1000).toFixed(1), maxPhysDyMm: +(maxPhysStep * 1000).toFixed(1), log: chip });
      } else res.chip = { error: 'no chip found' };
      // a putt that drops: 3 m (or 2 m), from the side where the engine finds a line that holes
      let px, pz, aim0, v, off = null;
      const sim1 = (o) => { const b = new E.Ball(); b.place(h, px, pz); b.putt(h, v, aim0 + o); const ev = []; let n = 0; while ((b.state === 'roll' || b.state === 'air') && n < 20000) { ev.length = 0; b.step(h, E.DT, ev); n++; } return b.state === 'holed'; };
      for (const dist of [3, 2.5, 2]) { for (let a = 0; a < 6.28 && off == null; a += 0.4) { px = pin.x + Math.cos(a) * dist; pz = pin.z + Math.sin(a) * dist; if (h.greenQ(px, pz) > 0.95) continue;
        aim0 = Math.atan2(pin.x - px, pin.z - pz); v = E.puttSpeed(h, dist + 0.4); for (let o = 0; o <= 0.1; o += 0.0005) { if (sim1(o)) { off = o; break; } if (sim1(-o)) { off = -o; break; } } } if (off != null) break; }
      if (off == null) off = 0;
      G.ball.place(h, px, pz); G.ball.state = 'rest'; G.lie = h.surface(px, pz); G.club = E.CLUBS.length - 1; G.aim = aim0 + off; G.mode = 'aim'; G.sinkS = null; G.shot = null; T.setupClub(G.club); T.snap(); window.__tick(30, false);
      G.shot = { club: 'PT', putt: true, sx: px, sz: pz, lie: G.lie, power: 0.5, dev: 0, landed: false, carry: 0 }; G.strokes = 1;
      G.ball.putt(h, v, aim0 + off); G.mode = 'flight'; G.acc = 0; G.ip.x = G.ball.x; G.ip.y = G.ball.y; G.ip.z = G.ball.z;
      const putt = []; for (let i = 0; i < 400; i++) { window.__tick(1, false); putt.push(rec()); const st = T.state().holeOut; if (st && st.still && i > 5) break; }
      // drawn ball height minus the cup's floor path: the drawn y per frame through the drop, as the round 4 hole-out test logs it
      let maxDrawnStep = 0; for (let i = 1; i < putt.length; i++) maxDrawnStep = Math.max(maxDrawnStep, Math.hypot(putt[i].x - putt[i - 1].x, putt[i].y - putt[i - 1].y, putt[i].z - putt[i - 1].z));
      res.putt = Object.assign(summarize(putt), { holed: G.ball.state === 'holed', maxDrawnStepMm: +(maxDrawnStep * 1000).toFixed(1), log: putt });
      return res;
    });
    for (const k of ['chip', 'putt']) if (out.pop[k]) console.log(TAG, 'pop', k, JSON.stringify(Object.assign({}, out.pop[k], { log: undefined })));
  }
  out.errors = errs;
  fs.writeFileSync(path.join(OUT, 'green5_' + TAG + '.json'), JSON.stringify(out, null, 1));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
