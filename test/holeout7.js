// Round 7 Task 2: the ball's drawn size, frame by frame, at 402x874 (60 Hz, simulated clock):
//  1. putts that drop (dead centre 3 m, firm 2 m, and a lip-in found with the engine): ball scale every frame from the stroke
//     to rest in the cup, and through the drop the drawn ball against the cup: its edge past the wall (CUP_R - horizontal
//     distance - drawn radius < 0 below the rim = through the wall), against the rim's edge (above the rim, inside the hole)
//     and against the flagstick; screenshots of the drop;
//  2. a chip that lands short of the green and rolls on: ball scale every frame (largest step), and on the green;
//  3. a lip-out roll across the hole's edge: the drawn ball never below the rim's edge.
// usage: node test/holeout7.js <page.html> <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/holeout7';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'ho7_' + path.basename(path.dirname(SRC)) + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true; sim.base = performance.now(); sim.on = true; window.__k = 0;
    window.__tick = (n, d) => { for (let i = 0; i < n; i++) { window.__k++; sim.t = sim.base + window.__k * 1000 / 60; T.tick(1 / 60, !!d && i === n - 1); } };
    for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1);
    const h = G.hole, pin = h.pin;
    const rec = () => {
      const m = T.ballMesh.position, rd = T.ballMesh.scale.x, b = G.ball, st = T.state(), q = G.sinkS;
      const r = Math.hypot(m.x - pin.x, m.z - pin.z), hy = m.y - (pin.y + 0.001);   // against the drawn cup wall's top edge
      // the drawn ball vs the cup: below the rim the wall (CUP_R - r - rd >= 0 is clear); above it, over the hole, the rim edge
      let wallMm = null, rimMm = null, poleMm = null;
      if (r < E.CUP_R + rd) {
        if (hy < 0) wallMm = (E.CUP_R - r - rd) * 1000;
        if (r < E.CUP_R && hy >= 0) { const e = E.CUP_R - r; rimMm = (Math.hypot(e, hy) - rd) * 1000; }
        if (hy < 0) poleMm = (r - T.FEEL.holeOut.poleR - rd) * 1000;
      }
      return { k: window.__k, mode: G.mode, st: b.state, scale: +(rd / E.BALL_R).toFixed(4), y: +(m.y - pin.y).toFixed(4), r: +r.toFixed(4), wallMm: wallMm == null ? null : +wallMm.toFixed(2), rimMm: rimMm == null ? null : +rimMm.toFixed(2), poleMm: poleMm == null ? null : +poleMm.toFixed(2), sink: !!q, q: +h.greenQ(G.bd.x, G.bd.z).toFixed(3) };
    };
    const sum = (L) => { let mx = 0, at = null; for (let i = 1; i < L.length; i++) { const d = Math.abs(L[i].scale - L[i - 1].scale); if (d > mx) { mx = d; at = L[i]; } }
      const w = L.filter(x => x.wallMm != null).map(x => x.wallMm), ri = L.filter(x => x.rimMm != null).map(x => x.rimMm), po = L.filter(x => x.poleMm != null).map(x => x.poleMm);
      return { frames: L.length, scales: [...new Set(L.map(x => x.scale))].slice(0, 12), maxScaleStep: +mx.toFixed(4), at, minWallMm: w.length ? Math.min(...w) : null, minRimMm: ri.length ? Math.min(...ri) : null, minPoleMm: po.length ? Math.min(...po) : null }; };
    const sim1 = (sx, sz, v, aim) => { const b = new E.Ball(); b.place(h, sx, sz); b.putt(h, v, aim); const ev = []; let n = 0, lip = false; while ((b.state === 'roll' || b.state === 'air') && n < 20000) { ev.length = 0; b.step(h, E.DT, ev); n++; for (const e of ev) if (e.type === 'lip') lip = true; } return { holed: b.state === 'holed', lip }; };
    window.__findPutt = (dist, extra, want) => {
      for (let a = 0; a < 6.28; a += 0.2) {
        const sx = pin.x + Math.cos(a) * dist, sz = pin.z + Math.sin(a) * dist; if (h.greenQ(sx, sz) > 0.95) continue;
        const aim0 = Math.atan2(pin.x - sx, pin.z - sz), v = E.puttSpeed(h, dist + extra);
        for (let o = 0; o <= 0.12; o += 0.0005) for (const sg of [1, -1]) { const r = sim1(sx, sz, v, aim0 + sg * o); if (want === 'centre' && r.holed && !r.lip) return { sx, sz, v, aim: aim0 + sg * o }; if (want === 'lipin' && r.holed && r.lip) return { sx, sz, v, aim: aim0 + sg * o }; if (want === 'lipout' && !r.holed && r.lip) return { sx, sz, v, aim: aim0 + sg * o }; }
      }
      return null;
    };
    window.__putt = (P, shots) => {
      for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
      G.ball.place(h, P.sx, P.sz); G.ball.state = 'rest'; G.lie = h.surface(P.sx, P.sz); G.club = E.CLUBS.length - 1; G.aim = P.aim; G.mode = 'aim'; G.sinkS = null; G.shot = null; G.camYaw = null; G.strokes = 1;
      T.setupClub(G.club); window.__tick(1); T.snap(); window.__tick(40);
      const L = [rec()];
      G.shot = { club: 'PT', putt: true, sx: P.sx, sz: P.sz, lie: G.lie, power: 0.5, dev: 0, landed: false, carry: 0 };
      G.ball.putt(h, P.v, P.aim); G.mode = 'flight'; G.acc = 0; G.ip.x = G.ball.x; G.ip.y = G.ball.y; G.ip.z = G.ball.z;
      for (let i = 0; i < 600; i++) { window.__tick(1); L.push(rec()); const ho = T.state().holeOut; if ((ho && ho.still) || (G.ball.state === 'rest' && i > 30) || (G.mode !== 'flight' && !G.sinkS)) break; }
      return L;
    };
  });
  const res = { putts: {}, errors: errs };
  for (const [name, dist, extra, want] of [['centre3m', 3, 0.35, 'centre'], ['firm2m', 2, 1.6, 'centre'], ['lipin', 3, 0.3, 'lipin'], ['lipout', 3, 0.2, 'lipout']]) {
    const P = await page.evaluate(([d, e, w]) => window.__findPutt(d, e, w), [dist, extra, want]);
    if (!P) { res.putts[name] = { error: 'none found' }; console.log(name, 'none found'); continue; }
    // replay: the log, then screenshots of the drop at chosen frames (the same putt again, stopping at each)
    const L = await page.evaluate((P) => window.__putt(P), P);
    const sm = summarize(L);
    res.putts[name] = Object.assign(sm, { log: L });
    console.log(name, JSON.stringify(Object.assign({}, sm, { log: undefined })));
    if (name === 'centre3m' || name === 'lipin') {
      const sinkK = L.findIndex(x => x.sink); if (sinkK > 0) for (const off of [-4, 0, 4, 10, 24]) {
        const k = Math.max(1, sinkK + off);
        await page.evaluate(([P, k]) => { const T = window.__tempo, G = T.G, E = T.E, h = G.hole; for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
          G.ball.place(h, P.sx, P.sz); G.ball.state = 'rest'; G.lie = h.surface(P.sx, P.sz); G.club = E.CLUBS.length - 1; G.aim = P.aim; G.mode = 'aim'; G.sinkS = null; G.shot = null; G.camYaw = null;
          T.setupClub(G.club); window.__tick(1); T.snap(); window.__tick(40);
          G.shot = { club: 'PT', putt: true, sx: P.sx, sz: P.sz, lie: G.lie, power: 0.5, dev: 0, landed: false, carry: 0 };
          G.ball.putt(h, P.v, P.aim); G.mode = 'flight'; G.acc = 0; G.ip.x = G.ball.x; G.ip.y = G.ball.y; G.ip.z = G.ball.z;
          window.__tick(k - 1); window.__tick(1, true); }, [P, k]);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(OUT, `holeout_${name}_${off >= 0 ? '+' : ''}${off}f.png`), timeout: 180000 });
      }
    }
  }
  // a chip that lands short and rolls onto the green
  res.chip = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, E = T.E, h = G.hole, pin = h.pin;
    const pw = E.CLUBS.findIndex(c => c.id === 'PW'), club = E.CLUBS[pw], up = T.save().upg;
    const simChip = (sx, sz, aim, power, lie) => { const sp = E.shotParams(club, power, 0, lie, up); const b = new E.Ball(); b.place(h, sx, sz); b.launch(sp.speed, sp.launch, aim + sp.aimOff, sp.spin, sp.side); const ev = []; let n = 0, land = null; while ((b.state === 'air' || b.state === 'roll') && n < 40000) { ev.length = 0; b.step(h, E.DT, ev); n++; if (!land && b.landed) land = { x: b.x, z: b.z }; } return { land, rest: { x: b.x, z: b.z }, state: b.state }; };
    let pick = null;
    for (let s = h.len - 4; s > h.len - 70 && !pick; s -= 1) {
      const p = h.pointAtS(s), lie = h.surface(p.x, p.z); if (!(lie === E.S.FAIRWAY || lie === E.S.ROUGH || lie === E.S.FRINGE)) continue;
      const aim = Math.atan2(pin.x - p.x, pin.z - p.z), dist = Math.hypot(pin.x - p.x, pin.z - p.z); if (dist < 12) continue;
      for (let power = 0.1; power <= 0.9 && !pick; power += 0.01) { const r = simChip(p.x, p.z, aim, power, lie); if (!r.land) continue; const lq = h.greenQ(r.land.x, r.land.z), rq = h.greenQ(r.rest.x, r.rest.z); if (lq > 1.02 && rq < 0.9 && r.state === 'rest') pick = { sx: p.x, sz: p.z, aim, power, lie, landQ: lq, restQ: rq }; }
    }
    if (!pick) return { error: 'no chip found' };
    for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
    G.ball.place(h, pick.sx, pick.sz); G.ball.state = 'rest'; G.lie = pick.lie; G.club = pw; G.aim = pick.aim; G.mode = 'aim'; G.shot = null; G.camYaw = null; T.setupClub(pw); window.__tick(1); T.snap(); window.__tick(40);
    T.takeShot(pick.power, 0, 1, 0);
    const L = []; for (let i = 0; i < 900 && G.mode === 'flight'; i++) { window.__tick(1); const m = T.ballMesh; L.push({ k: window.__k, st: G.ball.state, scale: +(m.scale.x / E.BALL_R).toFixed(4), q: +h.greenQ(G.bd.x, G.bd.z).toFixed(3) }); }
    let mx = 0, at = null, mxG = 0; for (let i = 1; i < L.length; i++) { const d = Math.abs(L[i].scale - L[i - 1].scale); if (d > mx) { mx = d; at = L[i]; } if (L[i].q <= 1 && L[i - 1].q <= 1 && L[i].st !== 'air') mxG = Math.max(mxG, d); }
    const onG = L.filter(x => x.q <= 1 && x.st !== 'air');
    return { power: +pick.power.toFixed(2), landQ: +pick.landQ.toFixed(3), frames: L.length, maxScaleStep: +mx.toFixed(4), at, maxStepOnGreen: +mxG.toFixed(4), onGreenScales: [...new Set(onG.map(x => x.scale))], firstOnGreen: onG[0] || null, log: L };
  });
  console.log('chip', JSON.stringify(Object.assign({}, res.chip, { log: undefined })));
  fs.writeFileSync(path.join(OUT, 'holeout7.json'), JSON.stringify(res, null, 1));
  if (errs.length) console.log('errors', errs);
  await browser.close();
  function summarize(L) {
    let mx = 0, at = null; for (let i = 1; i < L.length; i++) { const d = Math.abs(L[i].scale - L[i - 1].scale); if (d > mx) { mx = d; at = L[i]; } }
    const w = L.filter(x => x.wallMm != null).map(x => x.wallMm), ri = L.filter(x => x.rimMm != null).map(x => x.rimMm), po = L.filter(x => x.poleMm != null).map(x => x.poleMm);
    return { frames: L.length, holed: L[L.length - 1].st === 'holed', scales: [...new Set(L.map(x => x.scale))].slice(0, 12), maxScaleStep: +mx.toFixed(4), at, minWallMm: w.length ? Math.min(...w) : null, minRimMm: ri.length ? Math.min(...ri) : null, minPoleMm: po.length ? Math.min(...po) : null };
  }
})();
