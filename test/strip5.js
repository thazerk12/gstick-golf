// Round 5 Task 4: a frame strip of the shaft through a full swing (driver and 7-iron, 390x844), from the player's camera and
// from a face-on camera (in front of the golfer, looking at the swing plane) so the in-plane bend shows too. Same thumb as
// swing2.js (99% pull over 450 ms, upstroke T = 200 ms). Frames: address, top, transition (+50 ms after the reversal),
// 33 and 17 ms before contact, the contact frame, then +17, +33, +83, +250 and +500 ms.
// usage: node test/strip5.js <page.html> <outdir> [tag]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/strip5', TAG = process.argv[4] || 'r5';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'st5_' + TAG + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'sim-b', tier: 4, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true;
    const S = window.__S = { k: 0 };
    const ev = (type, x, y, tSec) => { sim.t = sim.base + tSec * 1000; (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' })); };
    const frame = (draw) => { S.k++; sim.t = sim.base + S.k * 1000 / 60; T.tick(1 / 60, draw); };
    // set up a swing: ball, club, camera settled; the thumb's path as a function of time
    window.__setup = (ci, kBase) => {
      S.k = kBase; const h = G.hole; G.ball.place(h, 0, 0.6); G.ball.state = 'rest'; G.lie = h.surface(0, 0.6); G.club = ci; G.strokes = 0;
      G.aim = Math.atan2(h.pin.x, h.pin.z - 0.6); G.mode = 'aim'; G.swing = null; G.pendingShot = null; G.dip = null; G.shot = null; G.timeScale = 1;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false }); if ('alphaT' in CV) CV.alphaT = 0;
      T.setupClub(ci); T.snap(); for (let i = 0; i < 60; i++) frame(false);
      S.anchor = { x: G.ball.x, y: G.ball.y, z: G.ball.z };
      const L = T.swingLen ? T.swingLen() : Math.min(300, Math.max(140, innerHeight * 0.3)), Y0 = T.swingZone ? Math.max(560, Math.ceil(T.swingZone().top) + 8) : 560;
      const D = L * 0.99, Tup = 0.2, t0 = (S.k + 1) / 60, tP = t0 + 0.45, tH = tP;
      S.sw = { X: innerWidth / 2, Y0, D, Tup, t0, tP, tH, tCross: tH + Tup, down: false, mx: 0, rev: null, contactK: null, revK: null, up: false };
    };
    const yAt = (s, t) => t <= s.t0 ? s.Y0 : t <= s.tP ? s.Y0 + s.D * (1 - Math.pow(1 - (t - s.t0) / 0.45, 2)) : s.Y0 + s.D - s.D * Math.pow((t - s.tH) / s.Tup, 2);
    // advance n frames along the script (render on the last one); returns the state of the last frame
    window.__adv = (n, draw) => {
      const s = S.sw; let st = null;
      for (let i = 0; i < n; i++) {
        const ts = (S.k + 1) / 60;
        if (!s.down && ts >= s.t0) { ev('pointerdown', s.X, s.Y0, ts); s.down = true; }
        else if (s.down && G.swing && ts > s.t0) {
          const y = yAt(s, ts); ev('pointermove', s.X, y, ts);
          if (y - s.Y0 > s.mx) s.mx = y - s.Y0;
          if (s.rev == null && s.mx > 10 && s.mx - (y - s.Y0) >= 3) { s.rev = ts; s.revK = S.k + 1; }
          if (ts > s.tCross + 0.1 && !s.up) { ev('pointerup', s.X, y, ts); s.up = true; }
        }
        const hitBefore = CV.hit; frame(draw && i === n - 1);
        if (!hitBefore && CV.hit && s.contactK == null) s.contactK = S.k;
        st = { k: S.k, phase: CV.phase, mode: G.mode, a: +CV.a.toFixed(1), b: +CV.b.toFixed(1), bendMm: +(CV.bend * 1000).toFixed(1) };
      }
      return st;
    };
    // the face-on camera: in front of the golfer (the golfer stands on the far side of the ball from this camera's view
    // direction), 6 m out, 1.2 m up, looking at a point 1 m above the ball
    window.__faceOn = (on) => {
      const cam = T.camera;
      for (const id of ['fx', 'hudTop', 'hudBot', 'toast', 'banner']) { const e = document.getElementById(id); if (e) e.style.visibility = on ? 'hidden' : ''; }
      if (on) {
        window.__keep = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov };
        const b = window.__S.anchor, dx = Math.sin(G.aim), dz = Math.cos(G.aim), nx = dz, nz = -dx;   // perpendicular to the line, fixed at the tee
        cam.fov = 50; cam.updateProjectionMatrix();
        cam.position.set(b.x + nx * 6.5 - dx * 0.3, b.y + 1.3, b.z + nz * 6.5 - dz * 0.3); cam.lookAt(b.x - nx * 0.6 - dx * 0.3, b.y + 1.0, b.z - nz * 0.6 - dz * 0.3);
      } else { const K = window.__keep; cam.position.copy(K.p); cam.quaternion.copy(K.q); cam.fov = K.fov; cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld(); let sc = T.world.group; while (sc.parent) sc = sc.parent; T.renderer.render(sc, cam);
    };
  });
  const out = [];
  for (const [id, base] of [['DR', 60000], ['7I', 90000]]) {
    // pass 1: find the reversal and contact frames
    const ci = await page.evaluate((id) => window.__tempo.E.CLUBS.findIndex(c => c.id === id), id);
    const marks = await page.evaluate(([ci, base]) => { window.__setup(ci, base); const k0 = window.__S.k; const log = []; for (let i = 0; i < 200; i++) { log.push(window.__adv(1, false)); if (window.__S.sw.contactK && window.__S.k > window.__S.sw.contactK + 40) break; } return { k0, revK: window.__S.sw.revK, contactK: window.__S.sw.contactK, log }; }, [ci, base]);
    // frames to show (k after setup); the top = the arm's highest angle before contact
    let top = marks.log[0]; for (const r of marks.log) if (r.k <= marks.contactK && r.a > top.a) top = r;
    const C = marks.contactK, want = [['address', marks.k0 + 1], ['top', top.k], ['transition', marks.revK + 3], ['-33ms', C - 2], ['-17ms', C - 1], ['contact', C], ['+17ms', C + 1], ['+33ms', C + 2], ['+83ms', C + 5], ['+250ms', C + 15], ['+500ms', C + 30]];
    // pass 2: replay and stop at each frame
    await page.evaluate(([ci, base]) => window.__setup(ci, base), [ci, base]);
    let at = marks.k0;
    for (const [name, k] of want) {
      const st = await page.evaluate((n) => window.__adv(n, true), k - at); at = k;
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT, `${TAG}_${id}_${name}_player.png`), timeout: 180000 });
      await page.evaluate(() => window.__faceOn(true)); await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT, `${TAG}_${id}_${name}_face.png`), timeout: 180000 });
      await page.evaluate(() => window.__faceOn(false));
      out.push(Object.assign({ club: id, name }, st));
    }
  }
  fs.writeFileSync(path.join(OUT, 'strip5_' + TAG + '.json'), JSON.stringify(out, null, 1));
  for (const r of out) console.log(JSON.stringify(r));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
