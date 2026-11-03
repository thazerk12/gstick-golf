// Round 7 Task 4: frame strips of the driver and the 5-iron from address to the finish, from the player's camera (Standard
// preset, 390x844, DPR 2). Same thumb as swing2.js / strip5.js: a 99% pull from the chevron over 450 ms, upstroke T = 200 ms.
// Frames: address, the backswing at 7, 14 and 20 frames in, the top (the club's highest angle), every frame from the finger's
// reversal to contact, then +17, +83, +250, +500 and +1000 ms after contact. Per frame: club angle a, hinge b, phase, and the
// club's screen box (grip end, head box corners and 6 shaft points; px) and whether all of it is on screen.
// usage: node test/strip7.js <page.html> <outdir> [tag]   (then montage the PNGs: see the report)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/strip7', TAG = process.argv[4] || 'r7';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'st7_' + TAG + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.save().shots = 99; T.save().settings.cam = 'std';
    T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true;
    const S = window.__S = { k: 0 };
    const ev = (type, x, y, tSec) => { sim.t = sim.base + tSec * 1000; (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' })); };
    const frame = (draw) => { S.k++; sim.t = sim.base + S.k * 1000 / 60; T.tick(1 / 60, draw); };
    const v = new THREE.Vector3();
    const box = (ci) => {
      const m = T.clubModels[ci], grp = m.grp; let o = grp; while (o.parent) o = o.parent; o.updateMatrixWorld(true); T.camera.updateMatrixWorld();
      const head = m.flex.tip.children[0]; head.geometry.computeBoundingBox(); const bb = head.geometry.boundingBox, pts = [];
      const g0 = new THREE.Vector3(0, 0.05, 0).applyMatrix4(grp.matrixWorld); pts.push(g0);
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z).applyMatrix4(head.matrixWorld));
      const hc = new THREE.Vector3(); bb.getCenter(hc); head.localToWorld(hc); for (let i = 1; i <= 6; i++) pts.push(g0.clone().lerp(hc, i / 7));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
      for (const p of pts) { v.copy(p).project(T.camera); if (v.z >= 1) behind = true; const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (0.5 - v.y * 0.5) * innerHeight; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      return { box: [x0, y0, x1, y1].map(Math.round), on: !behind && x0 >= 0 && y0 >= 0 && x1 <= innerWidth && y1 <= innerHeight };
    };
    window.__setup = (ci, kBase) => {
      S.k = kBase; const h = G.hole; let bx = 0, bz = 0.6; if (ci > 0) { const p = h.pointAtS(Math.min(h.len - 60, 230)); bx = p.x; bz = p.z; }
      G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = ci; G.strokes = 0;
      G.aim = Math.atan2(h.pin.x - bx, h.pin.z - bz); G.mode = 'aim'; G.swing = null; G.press = null; G.pendingShot = null; G.dip = null; G.shot = null; G.timeScale = 1; G.camYaw = null; G.camLock = false;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
      for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
      T.setupClub(ci); frame(false); T.snap(); for (let i = 0; i < 60; i++) frame(false);
      const L = T.swingLen(), Y0 = Math.round(T.chevronAt()[1]), D = L * 0.99, Tup = 0.2, t0 = (S.k + 1) / 60, tP = t0 + 0.45, tH = tP;
      S.sw = { X: Math.round(innerWidth / 2), Y0, D, Tup, t0, tP, tH, tCross: tH + Tup, down: false, mx: 0, rev: null, contactK: null, revK: null, up: false };
      return S.k;
    };
    const yAt = (s, t) => t <= s.t0 ? s.Y0 : t <= s.tP ? s.Y0 + s.D * (1 - Math.pow(1 - (t - s.t0) / 0.45, 2)) : s.Y0 + s.D - s.D * Math.pow((t - s.tH) / s.Tup, 2);
    window.__adv = (n, draw, ci) => {
      const s = S.sw; let st = null;
      for (let i = 0; i < n; i++) {
        const ts = (S.k + 1) / 60;
        if (!s.down && ts >= s.t0) { ev('pointerdown', s.X, s.Y0, ts); s.down = true; }
        else if (s.down && (G.swing || G.press) && ts > s.t0) {
          const y = Math.round(yAt(s, ts)); ev('pointermove', s.X, y, ts);
          if (y - s.Y0 > s.mx) s.mx = y - s.Y0;
          if (s.rev == null && s.mx > 10 && s.mx - (y - s.Y0) >= 3) { s.rev = ts; s.revK = S.k + 1; }
          if (ts > s.tCross + 0.1 && !s.up) { ev('pointerup', s.X, y, ts); s.up = true; }
        }
        const hitBefore = CV.hit; frame(draw && i === n - 1);
        if (!hitBefore && CV.hit && s.contactK == null) s.contactK = S.k;
        st = Object.assign({ k: S.k, phase: CV.phase, mode: G.mode, a: +CV.a.toFixed(1), b: +CV.b.toFixed(1) }, ci == null ? {} : box(ci));
      }
      return st;
    };
  });
  const out = [];
  for (const [id, base] of [['DR', 60000], ['5I', 90000]]) {
    const ci = await page.evaluate((id) => window.__tempo.E.CLUBS.findIndex(c => c.id === id), id);
    const marks = await page.evaluate(([ci, base]) => { const k0 = window.__setup(ci, base); const log = []; for (let i = 0; i < 260; i++) { log.push(window.__adv(1, false)); if (window.__S.sw.contactK && window.__S.k > window.__S.sw.contactK + 62) break; } return { k0, revK: window.__S.sw.revK, contactK: window.__S.sw.contactK, log }; }, [ci, base]);
    let top = marks.log[0]; for (const r of marks.log) if (r.k <= marks.contactK && r.a > top.a) top = r;
    const C = marks.contactK, want = [['address', marks.k0 + 1], ['back+7f', marks.k0 + 8], ['back+14f', marks.k0 + 15], ['back+20f', marks.k0 + 21], ['top', top.k]];
    for (let k = marks.revK; k < C; k++) if (k > top.k) want.push(['down' + (k - C) + 'f', k]);
    want.push(['contact', C], ['+17ms', C + 1], ['+83ms', C + 5], ['+250ms', C + 15], ['+500ms', C + 30], ['+1000ms', C + 60]);
    await page.evaluate(([ci, base]) => window.__setup(ci, base), [ci, base]);
    let at = marks.k0, i = 0;
    for (const [name, k] of want) {
      if (k <= at) continue;
      const st = await page.evaluate(([n, ci]) => window.__adv(n, true, ci), [k - at, ci]); at = k;
      await page.waitForTimeout(120);
      const file = `${TAG}_${id}_${String(i++).padStart(2, '0')}_${name}.png`;
      await page.screenshot({ path: path.join(OUT, file), timeout: 180000 });
      out.push(Object.assign({ club: id, name, file }, st));
    }
  }
  fs.writeFileSync(path.join(OUT, 'strip7_' + TAG + '.json'), JSON.stringify({ frames: out, errors: errs }, null, 1));
  for (const r of out) console.log(r.club, r.name.padEnd(10), r.phase.padEnd(7), 'a', r.a, 'b', r.b, 'box', r.box.join(','), r.on ? 'on' : 'OFF');
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
