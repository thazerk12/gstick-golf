// Round 4 Task 3f: three hole-outs on a real green (dead centre slow, firm, lip-in), found by searching putts with the
// engine on the game's own hole, then replayed through the game loop at 60 Hz with the drawn ball logged every frame.
// usage: node test/holeout4.js <page.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html'), OUTF = process.argv[3] || '/tmp/holeout4.json';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(path.dirname(OUTF), 'ho_' + path.basename(SRC)); fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const res = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'holeout-4', tier: 3, course: 0 });
    G.manual = true; sim.base = performance.now(); sim.on = true;
    let k = 0; const tick = () => { k++; sim.t = sim.base + k * 1000 / 60; T.tick(1 / 60, false); };
    for (let i = 0; i < 300; i++) tick();   // intro done
    const h = G.hole, pin = h.pin, R = E.BALL_R, rw = E.CUP_R - R;
    // start 2 m from the pin, on the green, on the side of the green's centre
    let dx = h.green.x - pin.x, dz = h.green.z - pin.z, dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    let sx = pin.x + dx * 2, sz = pin.z + dz * 2; if (h.surface(sx, sz) !== E.S.GREEN) { sx = pin.x - dz * 2; sz = pin.z + dx * 2; }
    const aim0 = Math.atan2(pin.x - sx, pin.z - sz);
    const sim1 = (v, off) => { const b = new E.Ball(); b.place(h, sx, sz); b.putt(h, v, aim0 + off); const ev = []; let n = 0, lips = 0; while ((b.state === 'roll' || b.state === 'air') && n < 20000) { ev.length = 0; b.step(h, E.DT, ev); for (const e of ev) if (e.type === 'lip') lips++; n++; } return { holed: b.state === 'holed', sink: b.sink, lips }; };
    const pick = [];
    // dead centre, slow: would stop about 0.2 m past; firm: about 2 m past
    const vFor = (past) => E.puttSpeed(h, 2 + past);
    // aim correction for the slope: search the offset that holes most centrally (sink closest to the pin line)
    const centreOff = (v) => { let best = null; for (let o = -0.05; o <= 0.05; o += 0.0005) { const r = sim1(v, o); if (r.holed) { const sr = Math.hypot(r.sink.x - pin.x, r.sink.z - pin.z); const lat = Math.abs((r.sink.x - pin.x) * Math.cos(aim0) - (r.sink.z - pin.z) * Math.sin(aim0)); if (!best || lat < best.lat) best = { o, lat }; } } return best ? best.o : 0; };
    for (const [name, past] of [['dead centre, slow', 0.2], ['firm', 2.0]]) { const v = vFor(past), o = centreOff(v); pick.push({ name, v, off: o }); }
    // lip-in: caught by the far wall after riding the edge (the engine's back-wall capture: sink outside the cup radius)
    let lip = null;
    for (const past of [0.3, 0.5, 0.8, 1.1, 1.4]) { const v = vFor(past); for (let o = -0.06; o <= 0.06 && !lip; o += 0.0004) { const r = sim1(v, o); if (r.holed && Math.hypot(r.sink.x - pin.x, r.sink.z - pin.z) >= E.CUP_R - 1e-4) lip = { name: 'lip-in', v, off: o }; } if (lip) break; }
    if (lip) pick.push(lip);
    const out = [];
    for (const P of pick) {
      G.ball.place(h, sx, sz); G.ball.state = 'rest'; G.lie = h.surface(sx, sz); G.club = E.CLUBS.length - 1; G.aim = aim0 + P.off; G.mode = 'aim'; G.sinkS = null;
      for (let i = 0; i < 10; i++) tick();
      // a putt struck at exactly this speed and line (what takeShot does for a putt, minus the power mapping)
      G.shot = { club: 'PT', putt: true, sx, sz, lie: G.lie, power: 0.5, dev: 0, landed: false, carry: 0 }; G.strokes = 1; G.sinkLog = true;
      G.ball.putt(h, P.v, aim0 + P.off); G.mode = 'flight'; G.acc = 0; G.ip.x = G.ball.x; G.ip.y = G.ball.y; G.ip.z = G.ball.z;
      const fr = []; let tHoled = null;
      for (let i = 0; i < 400; i++) {
        tick();
        const p = T.ballMesh.position, st = T.state().holeOut;
        fr.push([+(k / 60).toFixed(4), G.mode, G.ball.state, p.x - pin.x, p.y - pin.y, p.z - pin.z, st ? st.t : null, st ? st.still : null]);
        if (G.ball.state === 'holed' && tHoled == null) tHoled = k / 60;
        if (st && st.still && fr.length > 5) { for (let j = 0; j < 3; j++) { tick(); const q = T.ballMesh.position; fr.push([+(k / 60).toFixed(4), G.mode, G.ball.state, q.x - pin.x, q.y - pin.y, q.z - pin.z, T.state().holeOut.t, true]); } break; }
      }
      const so = G.sinkS;
      out.push({ name: P.name, v: P.v, off: P.off, sink: G.ball.sink && { r: Math.hypot(G.ball.sink.x - pin.x, G.ball.sink.z - pin.z), y: G.ball.sink.y - pin.y, vx: G.ball.sink.vx, vz: G.ball.sink.vz }, frames: fr, hits: so ? so.hits : null, settleT: so ? so.t : null, log: so ? so.log : null, rw, CUP_R: E.CUP_R, R });
      G.sinkLog = false;
      // back to a playable state for the next one
      G.mode = 'aim'; G.ball.state = 'rest'; G.sinkS = null;
    }
    return { pin: [pin.x, pin.y, pin.z], start: [sx, sz], out };
  });
  fs.writeFileSync(OUTF, JSON.stringify({ errors: errs, res }));
  // summary
  for (const o of res.out) {
    const F = o.frames, iH = F.findIndex(r => r[2] === 'holed');
    let maxJump = 0, maxPen = 0, penMs = 0; const sp = [];
    for (let i = Math.max(1, iH - 6); i < F.length; i++) { const d = Math.hypot(F[i][3] - F[i - 1][3], F[i][4] - F[i - 1][4], F[i][5] - F[i - 1][5]); sp.push(+(d * 1000).toFixed(1)); maxJump = Math.max(maxJump, d); }
    // wall penetration in the 1 ms log (below the rim)
    for (const L of o.log || []) if (L[2] < 0) { const pen = Math.hypot(L[1], L[3]) - o.rw; if (pen > 1e-4) { maxPen = Math.max(maxPen, pen); penMs = L[0] * 1000; } }
    console.log(o.name.padEnd(18) + ' v ' + o.v.toFixed(2) + ' m/s, capture r ' + (o.sink.r * 100).toFixed(1) + ' cm (wall ' + (o.rw * 100).toFixed(1) + ', rim ' + (o.CUP_R * 100).toFixed(2) + '), settled ' + (o.settleT * 1000).toFixed(0) + ' ms, hits ' + JSON.stringify(o.hits) + '\n   per-frame travel (mm) from 6 frames before capture: ' + sp.join(' ') + '\n   max frame travel ' + (maxJump * 1000).toFixed(1) + ' mm; outside the wall below the rim: max ' + (maxPen * 1000).toFixed(1) + ' mm, last at ' + penMs.toFixed(0) + ' ms');
  }
  console.log(errs.length ? 'errors: ' + errs.join(' | ') : 'no page errors');
  await browser.close();
})();
