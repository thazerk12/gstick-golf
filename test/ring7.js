// Round 7 Task 1: the live power ring, with the real gesture (press at the chevron, pull straight down), simulated clock.
// For DR (tee), 7I and PW (fairway) and putts of 3 and 8 m, at pulls of 25, 50, 75, 100 and 110% of swingLen (held):
//  - the power, the power card (big number and the line under it) and the distance behind it (pullCarry / puttRoll);
//  - the ring as drawn: its world centre vs the ball + that distance along the aim (error, m; along and across the aim), its
//    radius, its size on screen (px across and tall, from the points drawn) and where its centre lands on screen vs where the
//    expected point projects (px), its colour (cream / warn);
//  - whether it covers the ball: the overlay drawn with and without the ring, pixels changed inside the ball's disc (0 = never);
//  - while pulling smoothly 0 -> 112% over 40 frames: the ring's distance every frame (it moves with the finger) and the most
//    it moved in one frame.
// Also: the Landing guide off (no ring) and contact (the ring goes). Screenshots mid-pull (75%, and 110% in warn).
// usage: node test/ring7.js <page.html> <outdir> [WxH]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/ring7';
const [W, H] = (process.argv[4] || '390x844').split('x').map(Number);
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'ring7_' + W + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.save().shots = 99; T.save().settings.guide = true;
    T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true; window.__k = 0;
    window.__tick = (n, draw) => { for (let i = 0; i < n; i++) { window.__k++; sim.t = sim.base + window.__k * 1000 / 60; T.tick(1 / 60, !!draw && i === n - 1); } };
    window.__ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 3, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1);
    const h = G.hole, ci = (id) => E.CLUBS.findIndex(c => c.id === id);
    let sc = T.world.group; while (sc.parent) sc = sc.parent; window.__scene = sc;
    window.__place = (club, back) => {
      let x = 0, z = 0.6;
      if (club === 'PT') { for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * back, pz = h.pin.z + Math.cos(t) * back; if (h.surface(px, pz) === E.S.GREEN && h.greenQ(px, pz) < 0.9) { x = px; z = pz; break; } } }
      else if (club !== 'DR') { const q = h.pointAtS(Math.max(30, h.len - back)); x = q.x; z = q.z; }
      for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = ci(club); G.strokes = 0; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z);
      G.mode = 'aim'; G.swing = null; G.press = null; G.shot = null; G.pendingShot = null; G.camYaw = null; G.camLock = false; G.look = null; G.map = false;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
      T.setupClub(G.club); window.__tick(1); T.snap(); window.__tick(90);
      return { lie: E.SURF_NAMES ? E.SURF_NAMES[G.lie] : G.lie, d: +Math.hypot(h.pin.x - x, h.pin.z - z).toFixed(2) };
    };
    // overlay pixels inside the drawn ball's disc that change when the ring is drawn
    window.__covers = () => {
      const fxc = document.getElementById('fx'), g = fxc.getContext('2d'), sc = fxc.width / innerWidth, bm = T.ballMesh, cam = T.camera; cam.updateMatrixWorld();
      const c = bm.position.clone().project(cam), cx = (c.x * 0.5 + 0.5) * innerWidth, cy = (0.5 - c.y * 0.5) * innerHeight;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), e = bm.position.clone().addScaledVector(right, bm.scale.x).project(cam);
      const rpx = Math.hypot((e.x * 0.5 + 0.5) * innerWidth - cx, (0.5 - e.y * 0.5) * innerHeight - cy);
      const X0 = Math.floor((cx - rpx - 1) * sc), Y0 = Math.floor((cy - rpx - 1) * sc), S2 = Math.ceil((2 * rpx + 2) * sc);
      const read = (off) => { G.noPowerRing = off; T.tick(0, true); G.noPowerRing = false; return g.getImageData(X0, Y0, S2, S2).data; };
      const a = read(true), b = read(false);
      let n = 0, tot = 0;
      for (let j = 0; j < S2; j++) for (let i = 0; i < S2; i++) { const dx = (X0 + i + 0.5) / sc - cx, dy = (Y0 + j + 0.5) / sc - cy; if (dx * dx + dy * dy > rpx * rpx) continue; tot++; const o = (j * S2 + i) * 4; if (Math.abs(a[o + 3] - b[o + 3]) + Math.abs(a[o] - b[o]) > 2) n++; }
      return { changed: n, of: tot, ballPx: +(2 * rpx).toFixed(1) };
    };
    window.__pullTo = (frac, steps) => {
      const L = T.swingLen(), c = T.chevronAt(), x0 = Math.round(c[0]), y0 = Math.round(c[1]);
      window.__ev('pointerdown', x0, y0);
      for (let i = 1; i <= steps; i++) { window.__ev('pointermove', x0, y0 + frac * L * i / steps); window.__tick(1); }
      window.__tick(4);
      return { x0, y0, L };
    };
    window.__measure = (frac) => {
      T.tick(0, true);   // draw the overlay (the ring is drawn with it)
      const s = G.swing, R = T.powerRing(), b = G.ball, putt = E.CLUBS[G.club].putter;
      const pw = s ? s.power : null, d = pw == null ? null : (putt ? T.puttRoll(pw) : T.pullCarry(pw));
      const ex = d == null ? null : b.x + Math.sin(G.aim) * d, ez = d == null ? null : b.z + Math.cos(G.aim) * d;
      const card = document.getElementById('pwPct').textContent + ' / ' + document.getElementById('pwCarry').textContent;
      const out = { frac, pull: s && +s.pull.toFixed(4), power: pw == null ? null : +pw.toFixed(4), card, dist: d == null ? null : +d.toFixed(3), ring: !!R };
      if (R && R.drawn && d != null) {
        const along = (R.x - b.x) * Math.sin(G.aim) + (R.z - b.z) * Math.cos(G.aim), lat = (R.x - b.x) * Math.cos(G.aim) - (R.z - b.z) * Math.sin(G.aim);
        const v = new THREE.Vector3(ex, T.hFast(ex, ez) + (putt ? T.FEEL.ring.puttLift : T.FEEL.ring.lift), ez).project(T.camera), epx = [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight];
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < R.pts.length; i += 2) { x0 = Math.min(x0, R.pts[i]); x1 = Math.max(x1, R.pts[i]); y0 = Math.min(y0, R.pts[i + 1]); y1 = Math.max(y1, R.pts[i + 1]); }
        Object.assign(out, { errM: +Math.hypot(R.x - ex, R.z - ez).toFixed(4), alongM: +along.toFixed(3), latM: +lat.toFixed(4), r: +R.r.toFixed(3),
          acrossPx: +(x1 - x0).toFixed(1), tallPx: +(y1 - y0).toFixed(1), widenedK: +R.k.toFixed(2), centrePxErr: +Math.hypot(R.cx - epx[0], R.cy - epx[1]).toFixed(2), colour: R.over ? 'warn' : 'cream', box: [x0, y0, x1, y1].map(q => +q.toFixed(1)), cover: window.__covers() });
      }
      return out;
    };
    window.__release = () => { window.__ev('pointerup', 0, 0); window.__tick(10); };
  });
  const shot = async (name) => { await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => { window.__tempo.tick(0, true); requestAnimationFrame(() => res()); }))); await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 180000 }); };
  const res = { size: W + 'x' + H, rows: [], smooth: [], extra: {} };
  for (const [club, back] of [['DR', 0], ['7I', 150], ['PW', 100], ['PT', 3], ['PT', 8]]) {
    const place = await page.evaluate(([c, b]) => window.__place(c, b), [club, back]);
    for (const frac of [0.25, 0.5, 0.75, 1.0, 1.1]) {
      const st = await page.evaluate((fr) => window.__pullTo(fr, 20), frac);
      const m = await page.evaluate((fr) => window.__measure(fr), frac);
      m.club = club + (club === 'PT' ? ' ' + back + ' m' : ''); m.lie = place.lie; m.start = [st.x0, st.y0]; m.L = +st.L.toFixed(1);
      res.rows.push(m); console.log(JSON.stringify(m));
      if ((frac === 0.75 || frac === 1.1) && (club === 'DR' || club === '7I' || (club === 'PT' && back === 8))) await shot(`ring_${W}x${H}_${club}${club === 'PT' ? back + 'm' : ''}_${Math.round(frac * 100)}`);
      await page.evaluate(() => window.__release());
    }
    // a smooth pull 0 -> 112% over 40 frames: the ring's distance each frame
    const sm = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, L = T.swingLen(), c = T.chevronAt(), x0 = Math.round(c[0]), y0 = Math.round(c[1]), out = [];
      window.__ev('pointerdown', x0, y0);
      for (let i = 1; i <= 40; i++) { window.__ev('pointermove', x0, y0 + 1.12 * L * i / 40); window.__tick(1); const R = T.powerRing(); out.push([i, G.swing ? +G.swing.power.toFixed(4) : null, R ? +R.d.toFixed(3) : null]); }
      window.__release();
      let mx = 0; for (let i = 1; i < out.length; i++) if (out[i][2] != null && out[i - 1][2] != null) mx = Math.max(mx, out[i][2] - out[i - 1][2]);
      const mono = out.every((r, i) => i === 0 || r[2] == null || out[i - 1][2] == null || r[2] >= out[i - 1][2]);
      return { frames: out, maxStepM: +mx.toFixed(3), monotone: mono, firstShown: (out.find(r => r[2] != null) || [null])[0] };
    });
    sm.club = club + (club === 'PT' ? ' ' + back + ' m' : ''); res.smooth.push(sm);
    console.log(sm.club, 'smooth pull: max step', sm.maxStepM, 'm per frame, monotone', sm.monotone, 'first shown at frame', sm.firstShown);
  }
  // guide off: no ring; contact: the ring goes
  res.extra = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, out = {};
    window.__place('7I', 150);
    T.save().settings.guide = false; window.__pullTo(0.75, 20); T.tick(0, true); out.guideOff = { ring: !!T.powerRing() }; window.__release(); T.save().settings.guide = true;
    // a full swing: pull, then flick up; the ring each frame until the ball flies
    const L = T.swingLen(), c = T.chevronAt(), x0 = Math.round(c[0]), y0 = Math.round(c[1]), log = [];
    window.__ev('pointerdown', x0, y0);
    for (let i = 1; i <= 20; i++) { window.__ev('pointermove', x0, y0 + 0.8 * L * i / 20); window.__tick(1); }
    for (let i = 1; i <= 16; i++) { window.__ev('pointermove', x0, y0 + 0.8 * L - (0.8 * L + 30) * Math.min(1, Math.pow(i / 12, 2))); window.__tick(1); log.push([G.mode, !!T.powerRing()]); if (G.mode === 'flight') { window.__tick(1); log.push([G.mode, !!T.powerRing()]); break; } }
    window.__ev('pointerup', x0, y0 - 30);
    out.contact = log;
    return out;
  });
  console.log('guide off', JSON.stringify(res.extra.guideOff), 'contact', JSON.stringify(res.extra.contact));
  res.errors = errs;
  fs.writeFileSync(path.join(OUT, 'ring7_' + W + 'x' + H + '.json'), JSON.stringify(res, null, 1));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
