// Round 6 Task 3: address framing per club and camera preset at 390x844 and 430x932, from the game's own camera.
// Per club and preset: the ball's screen position (% of width / height), drawn diameter (CSS px) and size factor, the horizon
// (% down), the club's height on screen at address (grip end to head, % of the height), whether any HUD box covers the ball, the
// aim line's drift (x of points 10, 30, 100 m down the line minus the ball's x, px), and the share of downswing frames (the
// club's 'down' and 'commit' phases through the contact frame) with the whole club on screen, over swing4's finger paths at
// 60 Hz (T 120/200/300 ms, a 500 ms hold, drift +20/-50 px; start phases 0..16 ms; env PHASES=0 for phase 0 only).
// Club points checked: the grip end and the 8 corners of the head's bounding box, plus 6 points along the shaft.
// Screenshots (SHOTS dir): Standard DR / 7I / SW at address, top, transition (+50 ms after the reversal) and impact; every preset
// at address for DR and 7I (390x844).
// usage: node test/frame6.js <page.html> <out.json> [shots-dir]   (env CLUBS=DR,7I PRESETS=std SIZES=390x844)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/frame6.json', SHOTS = process.argv[4];
const SIZES = (process.env.SIZES || '390x844,430x932').split(',').map(s => s.split('x').map(Number));
const PRESETS = (process.env.PRESETS || 'close,std,high').split(',');
const ONLY = process.env.CLUBS ? process.env.CLUBS.split(',') : null;
const PHASES = process.env.PHASES ? process.env.PHASES.split(',').map(Number) : [0, 2, 4, 6, 8, 10, 12, 14, 16];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const all = [];
  for (const [W, H] of SIZES) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await require('./fontroute')(page);
    const f = path.join(path.dirname(OUTF), 'fr6_' + W + '_' + path.basename(path.dirname(SRC)) + '.html');
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
    await page.goto('file://' + f);
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    await page.evaluate((k) => { window.__ADDRK = k; }, +(process.env.ADDRK || 1));
    await page.evaluate(() => {
      const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
      T.save().seenHow = true; T.save().shots = 99; T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true;
      // ADDRK=<k> (exploration only): every club's Standard camera k x as far, the ball kept at ADDR.ballY
      if (window.__ADDRK && window.__ADDRK !== 1) { const A = T.ADDR; for (const id in A.club) { const c = A.club[id]; c.back *= window.__ADDRK; c.up *= window.__ADDRK; const ab = Math.atan((2 * A.ballY - 1) * Math.tan(c.fov * Math.PI / 360)); c.down = (c.back + A.ahead) * Math.tan(Math.atan2(c.up, c.back) - ab) - c.up; } }
      sim.base = performance.now(); sim.on = true;
      const S = window.__S = { k: 0 };
      const frame = (draw) => { S.k++; sim.t = sim.base + S.k * 1000 / 60; T.tick(1 / 60, !!draw); };
      const ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
      const v = new THREE.Vector3();
      const px = (x, y, z) => { v.set(x, y, z).project(T.camera); return [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight, v.z]; };
      // the club's check points in world space: grip end, head box corners, shaft points
      const clubPts = (ci) => {
        const m = T.clubModels[ci], grp = m.grp; let o = grp; while (o.parent) o = o.parent; o.updateMatrixWorld(true);
        const head = m.flex.tip.children[0]; head.geometry.computeBoundingBox(); const bb = head.geometry.boundingBox, pts = [];
        const g0 = new THREE.Vector3(0, 0.05, 0).applyMatrix4(grp.matrixWorld); pts.push(g0);
        for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z).applyMatrix4(head.matrixWorld));
        const hc = new THREE.Vector3(); bb.getCenter(hc); head.localToWorld(hc);
        for (let i = 1; i <= 6; i++) pts.push(g0.clone().lerp(hc, i / 7));
        return pts;
      };
      const onScreen = (pts) => { T.camera.updateMatrixWorld(); for (const p of pts) { const q = px(p.x, p.y, p.z); if (q[2] >= 1 || q[0] < 0 || q[0] > innerWidth || q[1] < 0 || q[1] > innerHeight) return false; } return true; };
      window.__place = (ci, preset) => {
        const h = G.hole; let bx = 0, bz = 0.6; if (ci > 0) { const p = h.pointAtS(Math.min(h.len - 60, 230)); bx = p.x; bz = p.z; }
        T.save().settings.cam = preset;
        G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = ci; G.mode = 'aim'; G.map = false; G.look = null; G.swing = null; G.press = null; G.shot = null; G.pendingShot = null; G.dip = null; G.timeScale = 1;
        G.aim = Math.atan2(h.pin.x - bx, h.pin.z - bz); G.camOrbit = null; G.camYaw = null; G.camLock = false; G.strokes = 0;
        Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
        for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
        T.setupClub(ci); frame(); T.snap(); for (let i = 0; i < 40; i++) frame(); T.updateHUD && T.updateHUD(true);
        return { bx, bz };
      };
      window.__addr = (ci, preset) => {
        const { bx, bz } = window.__place(ci, preset); frame(true);
        const h = G.hole, cam = T.camera; cam.updateMatrixWorld();
        const bm = T.ballMesh, bc = px(bm.position.x, bm.position.y, bm.position.z), right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const be = px(bm.position.x + right.x * bm.scale.x, bm.position.y + right.y * bm.scale.x, bm.position.z + right.z * bm.scale.x), rpx = Math.hypot(be[0] - bc[0], be[1] - bc[1]);
        // club height on screen: every vertex of the club model
        const grp = T.clubModels[ci].grp; let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
        grp.traverse(o => { if (!o.isMesh) return; const pa = o.geometry.attributes.position, a = new THREE.Vector3(); for (let k = 0; k < pa.count; k++) { a.fromBufferAttribute(pa, k).applyMatrix4(o.matrixWorld); const q = px(a.x, a.y, a.z); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); } });
        const dx = Math.sin(G.aim), dz = Math.cos(G.aim);
        const aim = [10, 30, 100].map(d => { const x = bx + dx * d, z = bz + dz * d; return +(px(x, h.height(x, z), z)[0] - bc[0]).toFixed(2); });
        const hz = px(bx + dx * 1e5, G.ball.y, bz + dz * 1e5)[1];
        const rects = [...document.querySelectorAll('#hudTop .card, #btnPause, #clubPrev, #hudBot .clubball, #clubNext, #btnMap, #btnCam, #btnLook')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map(e => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom, e.id || e.className]; }).filter(r => r[2] > r[0]);
        const under = rects.filter(r => bc[0] + rpx > r[0] && bc[0] - rpx < r[2] && bc[1] + rpx > r[1] && bc[1] - rpx < r[3]).map(r => r[4]);
        return { club: E.CLUBS[ci].id, preset, ballXPct: +(100 * bc[0] / innerWidth).toFixed(2), ballYPct: +(100 * bc[1] / innerHeight).toFixed(2), ballPx: +(2 * rpx).toFixed(2), factor: +T.state().ballScale.toFixed(3), realPx: +(2 * rpx / T.state().ballScale).toFixed(2),
          horizonPct: +(100 * hz / innerHeight).toFixed(2), clubPct: +(100 * (y1 - y0) / innerHeight).toFixed(2), clubBox: [x0, y0, x1, y1].map(q => Math.round(q)), underHud: under, aimDx: aim, fov: +cam.fov.toFixed(2),
          cam: { back: +Math.hypot(cam.position.x - bx, cam.position.z - bz).toFixed(3), up: +(cam.position.y - G.ball.y).toFixed(3) }, lookTop: (document.getElementById('btnLook').style.top || '') };
      };
      // swing4's finger paths at 60 Hz from the chevron's start line; per frame from the start of the downswing through contact,
      // whether the whole club is on screen
      window.__swing = (ci, preset, Tup, hold, drift, phaseMs, kBase, stopAt) => {
        window.__place(ci, preset); S.k = Math.max(S.k, kBase); const k0 = S.k;
        const L = T.swingLen(), D = Math.round(L * 0.99), Y0 = Math.round(T.chevronAt ? T.chevronAt()[1] : 600), X = Math.round(innerWidth / 2);
        const t0 = (S.k + 1) / 60 - phaseMs / 1000, tP = t0 + 0.45, tH = tP + hold / 1000, tU = Tup / 1000, tCross = tH + tU;
        const yAt = (t) => t <= t0 ? Y0 : t <= tP ? Y0 + D * (1 - Math.pow(1 - (t - t0) / 0.45, 2)) : t <= tH ? Y0 + D : Y0 + D - D * Math.pow((t - tH) / tU, 2);
        const xAt = (t) => X + (t <= tH ? 0 : drift * Math.min(1.3, (t - tH) / tU));
        let down = false, n = 0, inDown = 0, ok = 0, contactK = null, revK = null, topK = null, aTop = -1e9, mx = 0, stopped = null;
        const log = [];
        for (let i = 0; i < 400; i++) {
          const ts = (S.k + 1) / 60;
          if (!down && ts >= t0) { sim.t = sim.base + ts * 1000; ev('pointerdown', X, Y0); down = true; }
          else if (down && (G.swing || G.press) && ts > t0) {
            const y = Math.round(yAt(ts)), x = Math.round(xAt(ts)); sim.t = sim.base + ts * 1000; ev('pointermove', x, y);
            if (y - Y0 > mx) mx = y - Y0; if (revK == null && mx > 10 && mx - (y - Y0) >= 3) revK = S.k + 1;
            if (G.swing && ts > tCross + 0.1) ev('pointerup', x, y);
          }
          const hitBefore = CV.hit; frame(false);
          const ph = CV.phase, hitNow = !hitBefore && CV.hit;
          if ((ph === 'back' || ph === 'down' || ph === 'commit') && contactK == null && CV.a > aTop) { aTop = CV.a; topK = S.k; }
          if (contactK == null && (ph === 'down' || ph === 'commit' || hitNow)) { inDown++; if (onScreen(clubPts(ci))) ok++; }
          if (hitNow) contactK = S.k;
          if (stopAt && stopAt(S.k - k0)) { stopped = S.k - k0; break; }
          if (contactK != null && S.k > contactK + 10) break;
        }
        const rel = (q) => (q == null ? null : q - k0);
        return { club: E.CLUBS[ci].id, preset, T: Tup, hold, drift, phase: phaseMs, Y0, downFrames: inDown, onScreen: ok, contactK: rel(contactK), revK: rel(revK), topK: rel(topK), stopped };
      };
    });
    const nClubs = await page.evaluate(() => window.__tempo.E.CLUBS.length - 1);
    const clubs = await page.evaluate((only) => window.__tempo.E.CLUBS.map((c, i) => [c.id, i]).filter(([id, i]) => !window.__tempo.E.CLUBS[i].putter && (!only || only.includes(id))), ONLY);
    let kBase = 1000;
    for (const preset of PRESETS) for (const [id, ci] of clubs) {
      const a = await page.evaluate(([ci, p]) => window.__addr(ci, p), [ci, preset]);
      a.viewport = W + 'x' + H;
      if (SHOTS && W === 390 && ['DR', '7I'].includes(id)) { fs.mkdirSync(SHOTS, { recursive: true }); await page.waitForTimeout(100); await page.screenshot({ path: path.join(SHOTS, `preset_${preset}_${id}_address.png`), timeout: 180000 }); }
      // downswing share over swing4's paths
      let tot = 0, ok = 0; const runs = [];
      for (const [Tup, hold, drift] of [[120, 0, 0], [200, 0, 0], [300, 0, 0], [200, 500, 0], [200, 0, 20], [200, 0, -50]]) for (const ph of PHASES) {
        kBase += 3000;
        const r = await page.evaluate(([ci, p, Tup, hold, drift, ph, kb]) => window.__swing(ci, p, Tup, hold, drift, ph, kb), [ci, preset, Tup, hold, drift, ph, kBase]);
        tot += r.downFrames; ok += r.onScreen; runs.push([Tup, hold, drift, ph, r.downFrames, r.onScreen]);
      }
      a.downFrames = tot; a.downOnScreen = ok; a.downShare = tot ? +(ok / tot).toFixed(3) : null; a.runs = runs.length;
      all.push(a);
      console.log(a.viewport, preset.padEnd(5), id.padEnd(3), `ball ${a.ballXPct}%,${a.ballYPct}% ${a.ballPx}px (x${a.factor}, real ${a.realPx}) | horizon ${a.horizonPct}% | club ${a.clubPct}% | under HUD ${a.underHud.length ? a.underHud.join('+') : 'none'} | aim dx ${a.aimDx.join(',')} | downswing on screen ${ok}/${tot} = ${a.downShare}`);
    }
    // putts in each preset (round 4/5 putting camera as Standard): a 6 m putt on this hole's green, the ball's screen position
    if (SHOTS && W === 390) for (const preset of PRESETS) {
      const r = await page.evaluate((p) => {
        const T = window.__tempo, G = T.G, E = T.E, h = G.hole, CV = T.CV; let x = h.pin.x, z = h.pin.z;
        for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * 6, pz = h.pin.z + Math.cos(t) * 6; if (h.surface(px, pz) === E.S.GREEN) { x = px; z = pz; break; } }
        T.save().settings.cam = p; const PT = E.CLUBS.length - 1;
        G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = PT; G.mode = 'aim'; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.camYaw = null; G.camLock = false; G.shot = null; G.swing = null;
        Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
        for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
        T.setupClub(PT); T.tick(1 / 60, false); T.snap(); for (let i = 0; i < 60; i++) T.tick(1 / 60, false); T.updateHUD && T.updateHUD(true); T.tick(0, true);
        const bs = T.ballScreen(); return { preset: p, ballXPct: +(100 * bs[0] / innerWidth).toFixed(1), ballYPct: +(100 * bs[1] / innerHeight).toFixed(1), horizonPct: +(100 * T.addrHorizonY()).toFixed(1) };
      }, preset);
      console.log('putt', JSON.stringify(r)); all.push(Object.assign({ club: 'PT', viewport: '390x844' }, r));
      await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, `preset_${preset}_PT_address.png`), timeout: 180000 });
    }
    // Standard poses for the screenshots (390 only): address, top, transition (+50 ms after the reversal), impact
    if (SHOTS && W === 390) for (const id of ['DR', '7I', 'SW']) {
      const ci = clubs.find(c => c[0] === id); if (!ci) continue;
      kBase += 3000;
      const m = await page.evaluate(([ci, kb]) => window.__swing(ci, 'std', 200, 0, 0, 0, kb), [ci[1], kBase]);
      for (const [name, k] of [['address', null], ['top', m.topK], ['transition', m.revK + 3], ['impact', m.contactK]]) {
        kBase += 3000;
        await page.evaluate(([ci, kb, k]) => { if (k == null) { window.__place(ci, 'std'); window.__tempo.tick(0, true); return; } window.__swing(ci, 'std', 200, 0, 0, 0, kb, (kk) => kk >= k); window.__tempo.tick(0, true); }, [ci[1], kBase, k]);
        await page.waitForTimeout(120);
        await page.screenshot({ path: path.join(SHOTS, `std_${id}_${name}.png`), timeout: 180000 });
      }
    }
    if (errs.length) console.log('errors', errs);
  }
  fs.writeFileSync(OUTF, JSON.stringify(all, null, 1));
  await browser.close();
})();
