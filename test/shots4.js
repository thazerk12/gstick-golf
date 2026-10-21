// Round 4 screenshots and the numbers that go with them. Sections: putt, driver, popups, card, tracer, rough, flag.
// usage: node test/shots4.js <page.html> <outdir> [sections,comma,separated]   (W x H from the section)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/shots4';
const WANT = (process.argv[4] || 'putt,driver,popups,card,tracer,rough,flag').split(',');
fs.mkdirSync(OUT, { recursive: true });
const tag = path.basename(path.dirname(SRC)) === 'baseline_r3' ? 'r3' : 'r4';
async function open(browser, W, H) {
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'pg_' + tag + '_' + W + '.html'); fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => { window.__k = 0; window.__tick = (n, draw) => { const T = window.__tempo; for (let i = 0; i < n; i++) { window.__k++; window.__sim.t = window.__sim.base + window.__k * 1000 / 60; T.tick(1 / 60, draw && i === n - 1); } }; });
  return page;
}
async function startRound(page, o) {
  await page.evaluate((o) => { const T = window.__tempo; T.save().seenHow = true; T.startRound(Object.assign({ kind: 'quick' }, o)); T.G.manual = true; window.__sim.base = performance.now(); window.__sim.on = true; window.__tick(240, false); }, o);
}
const shot = (page, name, clip) => page.screenshot(clip ? { path: path.join(OUT, name + '.png'), clip } : { path: path.join(OUT, name + '.png') });
const log = {};
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (WANT.includes('putt')) {
    // a 15 m putt mid-roll and a 2 m putt finishing next to the cup, both from the game's putting camera; ball and cup sizes
    // are measured from the projection (cup rim and the drawn ball)
    const page = await open(browser, 390, 844); await startRound(page, { seed: 'putt-4', tier: 3, course: 0 });
    const out = [];
    for (const [d, stopPast, name, at] of [[15, 0.6, 'putt15_midroll', 7], [15, 0.6, 'putt15_near_cup', 1.0], [2, -0.12, 'putt2_by_cup', null]]) {
      const r = await page.evaluate(([d, stopPast, at]) => {
        const T = window.__tempo, G = T.G, E = T.E, h = G.hole, pin = h.pin;
        let dx = h.green.x - pin.x, dz = h.green.z - pin.z, l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        // start on the green d m from the pin (rotate round the pin until the start is on the green)
        let sx, sz; for (let a = 0; a < 6.3; a += 0.1) { const c = Math.cos(a), s = Math.sin(a), ux = dx * c - dz * s, uz = dx * s + dz * c; sx = pin.x + ux * d; sz = pin.z + uz * d; if (h.greenQ(sx, sz) < 0.95) break; }
        G.ball.place(h, sx, sz); G.ball.state = 'rest'; G.lie = h.surface(sx, sz); G.club = E.CLUBS.length - 1; G.aim = Math.atan2(pin.x - sx, pin.z - sz); G.mode = 'aim'; G.shot = null; G.sinkS = null;
        T.snap(); window.__tick(30, false);
        // aim a touch right so it never drops, and roll it to stop stopPast m past (or short of) the cup
        G.shot = { club: 'PT', putt: true, sx, sz, lie: G.lie, power: 0.5, dev: 0, landed: false, carry: 0 }; G.strokes = 1;
        G.ball.putt(h, E.puttSpeed(h, d + stopPast), G.aim + 0.09 / d); G.mode = 'flight'; G.acc = 0; G.ip.x = G.ball.x; G.ip.y = G.ball.y; G.ip.z = G.ball.z;
        let n = 0, sc = [];
        while (n++ < 900) { window.__tick(1, false); sc.push(T.state().ballScale); const r = Math.hypot(G.ball.x - pin.x, G.ball.z - pin.z); if (at != null ? r <= at : (G.mode !== 'flight' || G.ball.state === 'rest')) break; }
        window.__tick(1, true);
        const cam = T.camera, VW = innerWidth, VH = innerHeight, v = new THREE.Vector3();
        const px = (x, y, z) => { v.set(x, y, z).project(cam); return [(v.x * 0.5 + 0.5) * VW, (0.5 - v.y * 0.5) * VH]; };
        const c = px(pin.x, pin.y, pin.z); let cw = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, p = px(pin.x + Math.cos(a) * E.CUP_R, pin.y, pin.z + Math.sin(a) * E.CUP_R); cw = Math.max(cw, Math.abs(p[0] - c[0]) * 2); }
        const bp = T.ballMesh ? T.ballMesh.position : new THREE.Vector3(G.bd.x, G.bd.y, G.bd.z), bs = T.state().ballScale;
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), b0 = px(bp.x, bp.y, bp.z), b1 = px(bp.x + right.x * E.BALL_R * bs, bp.y + right.y * E.BALL_R * bs, bp.z + right.z * E.BALL_R * bs);
        const bw = 2 * Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
        // the ball and cup at the ball's own distance: how big the cup would be if it were where the ball is
        const cupAtBall = (() => { const q = px(bp.x + right.x * E.CUP_R, bp.y + right.y * E.CUP_R, bp.z + right.z * E.CUP_R); return 2 * Math.hypot(q[0] - b0[0], q[1] - b0[1]); })();
        return { distLeft: +Math.hypot(G.ball.x - pin.x, G.ball.z - pin.z).toFixed(2), ballScale: bs, ballScaleMax: Math.max(...sc), ballPx: +bw.toFixed(1), cupPx: +cw.toFixed(1), ballOverCupAtBall: +(bw / cupAtBall).toFixed(3), ball: b0, cup: c, frames: sc.length };
      }, [d, stopPast, at]);
      const cx = (r.ball[0] + r.cup[0]) / 2, cy = (r.ball[1] + r.cup[1]) / 2, half = Math.max(70, Math.abs(r.ball[0] - r.cup[0]) / 2 + 40, Math.abs(r.ball[1] - r.cup[1]) / 2 + 40);
      await shot(page, tag + '_' + name, null);
      await shot(page, tag + '_' + name + '_crop', { x: Math.max(0, cx - half), y: Math.max(0, cy - half), width: Math.min(390, 2 * half), height: Math.min(844, 2 * half) });
      r.name = name; out.push(r);
    }
    log.putt = out; log.puttErrors = page.errs;
    await page.close();
  }
  if (WANT.includes('driver') && tag === 'r4') {
    const page = await open(browser, 390, 844); await startRound(page, { seed: 'drv-4', tier: 2, course: 0 });
    for (const [name, a, b] of [['driver_address', 0, 0], ['driver_top', 'top', 0], ['driver_finish', 'fin', 0]]) {
      await page.evaluate(([a]) => {
        const T = window.__tempo, G = T.G, CV = T.CV, sp = T.clubModels[0].sp;
        G.club = 0; G.mode = 'aim'; T.setupClub(0);
        Object.assign(CV, { phase: 'pose', v: 0, bend: 0, bendV: 0, alpha: 0, alphaT: 0 });
        CV.a = a === 'top' ? sp.aTop : a === 'fin' ? -sp.aFin : 0; CV.b = a === 'top' ? sp.bTop : a === 'fin' ? -sp.bFin : 0;
        T.snap(); window.__tick(2, true);
      }, [a]);
      await shot(page, name, null);
      // face-on: from the far side of the target line, looking at the golfer's swing
      await page.evaluate(() => {
        const T = window.__tempo, G = T.G, b = G.ball, a = G.aim, lx = Math.cos(a), lz = -Math.sin(a);
        G.freeCam = { pos: new THREE.Vector3(b.x - lx * 4.2, b.y + 1.05, b.z - lz * 4.2), look: new THREE.Vector3(b.x + lx * 0.7, b.y + 0.95, b.z + lz * 0.7) };
        T.camera.clearViewOffset(); T.camera.fov = 52; T.camera.updateProjectionMatrix(); window.__tick(1, true);
      });
      await shot(page, name + '_faceon', null);
      await page.evaluate(() => { window.__tempo.G.freeCam = null; });
    }
    // the driver head from above (a free camera straight over it) and three-quarter
    await page.evaluate(() => { window.__tempo.save().shots = 99; });   // no first-shots hint over the close-ups
    for (const [name, off, look] of [['driver_head_top', [0.01, 1.2, -0.004], [0, 0, 0]], ['driver_head_34', [-0.5, 0.55, -0.66], [0, 0.01, 0]]]) {
      await page.evaluate(([off, look]) => {
        const T = window.__tempo, G = T.G, CV = T.CV; Object.assign(CV, { phase: 'pose', a: 0, b: 0 });
        window.__tick(1, true);
        const tip = T.clubModels[0].flex.tip, p = new THREE.Vector3(); tip.children[0].geometry.computeBoundingBox(); tip.children[0].geometry.boundingBox.getCenter(p); tip.children[0].localToWorld(p);
        window.__headP = [p.x - G.ball.x, p.y - G.ball.y, p.z - G.ball.z];
        G.freeCam = { pos: new THREE.Vector3(p.x + off[0], p.y + off[1], p.z + off[2]), look: new THREE.Vector3(p.x + look[0], p.y + look[1], p.z + look[2]) };
        T.camera.clearViewOffset(); T.camera.fov = 20; T.camera.updateProjectionMatrix(); window.__tick(1, true);
      }, [off, look]);
      await shot(page, name, { x: 15, y: 242, width: 360, height: 360 });
      console.log(name, await page.evaluate(() => JSON.stringify(window.__headP)));
    }
    await page.evaluate(() => { const T = window.__tempo; T.G.freeCam = null; T.camera.fov = 52; T.camera.updateProjectionMatrix(); });
    log.driverErrors = page.errs; await page.close();
  }
  if (WANT.includes('popups') && tag === 'r4') {
    const page = await open(browser, 390, 844); await startRound(page, { seed: 'pop-4', tier: 2, course: 0 });
    for (const [w, s, k] of [['BIRDIE', '+40 COINS', 'under'], ['PAR', '+15 COINS', ''], ['BOGEY', '+5 COINS', 'over'], ['EAGLE', '+100 COINS', 'under'], ['DOUBLE BOGEY', '', 'over']]) {
      await page.evaluate(([w, s, k]) => { const T = window.__tempo; T.showToast('', '', 1); T.showBanner(w, s, k, 60000); window.__tick(2, true); }, [w, s, k]);
      await page.waitForTimeout(400);
      await shot(page, 'popup_' + w.replace(' ', '_').toLowerCase(), null);
    }
    log.popupErrors = page.errs; await page.close();
  }
  if (WANT.includes('card')) {
    for (const [W, H] of [[390, 844], [360, 780]]) {
      const page = await open(browser, W, H); await startRound(page, { seed: 'card-4', tier: 2, course: 0 });
      const r = await page.evaluate(() => {
        const T = window.__tempo, G = T.G, pars = G.round.holes.map(h => h.par);
        G.scores = [pars[0] - 1, pars[1], pars[2] + 1, pars[3] + 2, pars[4] - 2];
        T.showCard(); window.__tick(1, true);
        const sc = document.getElementById('scrCard'), cw = sc.querySelector('.cardwrap');
        return { cardScreenScroll: [sc.scrollWidth, sc.clientWidth], cardTableScroll: [cw.scrollWidth, cw.clientWidth] };
      });
      await page.waitForTimeout(300); await shot(page, tag + '_card_' + W + 'x' + H, null);
      const r2 = await page.evaluate(() => {
        const T = window.__tempo, G = T.G, pars = G.round.holes.map(h => h.par);
        G.scores = [pars[0] - 1, pars[1], pars[2] + 1, pars[3] + 2, pars[4] - 2, pars[5]];
        G.def = { kind: 'tour', idx: 0, seed: 'tour-0', tier: 1, course: 0 };
        T.finishRound(); window.__tick(1, true);
        const sc = document.getElementById('scrResults'), cw = sc.querySelector('.cardwrap');
        return { resScreenScroll: [sc.scrollWidth, sc.clientWidth], resTableScroll: [cw.scrollWidth, cw.clientWidth] };
      });
      await page.waitForTimeout(300); await shot(page, tag + '_results_' + W + 'x' + H, null);
      await page.evaluate(() => { document.getElementById('scrResults').scrollTop = 9999; }); await shot(page, tag + '_results_' + W + 'x' + H + '_bottom', null);
      log['card_' + W] = Object.assign(r, r2, { errors: page.errs });
      await page.close();
    }
  }
  if (WANT.includes('tracer')) {
    // a par 5 opening hole so the drive lands on grass; a straight shot (PURE in both rounds: yellow core)
    const page = await open(browser, 390, 844); await startRound(page, { seed: 'pop-4', tier: 2, course: 0 });
    const r = await page.evaluate(() => {
      const T = window.__tempo, G = T.G; G.club = 0; G.mode = 'aim';
      T.takeShot(1, 0, 1, 0); let sky = null;
      for (let i = 0; i < 900; i++) { window.__tick(1, false); if (G.ball.t > 2.2 && sky == null) { window.__tick(1, true); sky = G.ball.t; break; } }
      return { t: sky };
    });
    const noBanner = async () => { await page.evaluate(() => document.getElementById('banner').classList.remove('show')); await page.waitForTimeout(450); };
    await noBanner(); await shot(page, tag + '_tracer_sky', null);
    r.grass = await page.evaluate(() => { const T = window.__tempo, G = T.G; for (let i = 0; i < 900 && G.mode === 'flight'; i++) window.__tick(1, false); window.__tick(10, true); return { mode: G.mode, lie: G.ball.state, x: +G.ball.x.toFixed(1), z: +G.ball.z.toFixed(1) }; });
    await noBanner(); await shot(page, tag + '_tracer_grass', null);
    log.tracer = Object.assign(r, { coreVertsAcross: await page.evaluate(() => 0) });
    await page.close();
  }
  if (WANT.includes('rough')) {
    const page = await open(browser, 390, 844); await startRound(page, { seed: 'rgh-4', tier: 2, course: 0 });
    const r = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, E = T.E, h = G.hole, ren = T.renderer;
      // a rough spot a little off the fairway at 200 m, and a fairway spot beside it
      const p = h.pointAtS(200); let rx = null, rz = null;
      for (let o = h.fwHalf(200) + 4; o < h.fwHalf(200) + 20; o += 0.5) { const x = p.x + p.nx * o, z = p.z + p.nz * o; if (h.surface(x, z) === E.S.ROUGH) { rx = x; rz = z; break; } }
      const calls = (x, z) => {
        G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = 5; G.mode = 'settle'; G.timer = 1e9;
        G.shot = { club: '7I', putt: false, sx: x - 30, sz: z - 30, lie: 1, power: 1, dev: 0, landed: true, carry: 0, label: '' };
        if (T.lieDecal) T.lieDecal(x, z); else T.buildTufts(x, z);
        window.__tick(30, false); window.__tick(1, true);
        ren.info.autoReset = false; ren.info.reset(); ren.render(T.G && window.__tempo.camera.parent ? window.__tempo.camera.parent : window.__tempo.camera, window.__tempo.camera);
        return ren.info.render.calls;
      };
      return { rough: [rx, rz] };
    });
    // settle camera, then address camera, in the rough; draw calls counted by the renderer over one frame
    const res = await page.evaluate(([rx, rz]) => {
      const T = window.__tempo, G = T.G, ren = T.renderer, h = G.hole;
      const frameCalls = () => { ren.info.autoReset = false; ren.info.reset(); window.__tick(1, true); const c = ren.info.render.calls; ren.info.autoReset = true; return c; };
      const setup = (x, z, mode) => {
        G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = 5; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.swing = null;
        if (T.lieDecal) T.lieDecal(x, z); else T.buildTufts(x, z);
        if (mode === 'settle') { G.mode = 'settle'; G.timer = 1e9; G.shot = { club: '7I', putt: false, sx: x - Math.sin(G.aim) * 120, sz: z - Math.cos(G.aim) * 120, lie: 1, power: 1, dev: 0, landed: true, carry: 120, label: '' }; }
        else { G.mode = 'aim'; T.setupClub(5); }
        T.snap(); window.__tick(40, false); T.snap(); window.__tick(2, false);
        return frameCalls();
      };
      const out = {};
      out.roughSettle = setup(rx, rz, 'settle');
      return out;
    }, r.rough);
    await shot(page, tag + '_rough_settle', null);
    const res2 = await page.evaluate(([rx, rz]) => {
      const T = window.__tempo, G = T.G, ren = T.renderer, h = G.hole;
      const frameCalls = () => { ren.info.autoReset = false; ren.info.reset(); window.__tick(1, true); const c = ren.info.render.calls; ren.info.autoReset = true; return c; };
      G.ball.place(h, rx, rz); G.ball.state = 'rest'; G.lie = h.surface(rx, rz); G.club = 5; G.mode = 'aim'; G.aim = Math.atan2(h.pin.x - rx, h.pin.z - rz); G.shot = null;
      if (T.lieDecal) T.lieDecal(rx, rz); else T.buildTufts(rx, rz);
      T.setupClub(5); T.snap(); window.__tick(40, false); T.snap(); window.__tick(2, false);
      const roughAddr = frameCalls();
      return { roughAddress: roughAddr, ballY: T.ballMesh ? T.ballMesh.position.y - (h.height(rx, rz) + T.E.BALL_R) : null };
    }, r.rough);
    await shot(page, tag + '_rough_address', null);
    await shot(page, tag + '_rough_address_crop', { x: 0, y: 500, width: 390, height: 260 });
    log.rough = Object.assign(r, res, res2, { errors: page.errs });
    await page.close();
  }
  if (WANT.includes('flag') && tag === 'r4') {
    const page = await open(browser, 390, 844); await startRound(page, { seed: 'flg-4', tier: 3, course: 0 });
    await page.evaluate(() => { window.__tempo.save().shots = 99; });   // no first-shots hint over the close-ups
    log.flag = [];
    for (const [name, d, side, up] of [['flag_front_4m', 4, 1, 1.4], ['flag_back_4m', 4, -1, 1.4], ['flag_front_60m', 60, 1, 6], ['flag_back_60m', 60, -1, 6]]) {
      log.flag.push(await page.evaluate(([d, side, up]) => {
        const T = window.__tempo, G = T.G, h = G.hole, pin = h.pin, f = T.world.flag; G.mode = 'aim';
        window.__tick(20, false);
        const ry = f.rotation.y, tx = Math.cos(ry) * 0.31, tz = -Math.sin(ry) * 0.31, ly = pin.y + 2.0;
        // the flag's own normal (front or back), turned up to 60 deg either way until no tree stands between camera and flag
        const blocked = (cx, cy, cz) => { for (const t of h.trees || []) { const ty = t.y != null ? t.y : h.height(t.x, t.z);
          for (let k = 1; k < 40; k++) { const q = k / 40, x = cx + (pin.x + tx - cx) * q, y = cy + (ly - cy) * q, z = cz + (pin.z + tz - cz) * q, hd = Math.hypot(x - t.x, z - t.z);
            if (t.kind === 'pine') { const top = ty + t.trunkH + t.ch; if (y < top && hd < t.cr * Math.min(1.1, (top - y) / t.ch) + 0.5) return true; }
            else if (Math.hypot(x - t.x, y - (ty + t.cy), z - t.z) < t.cr + 0.5 || (hd < t.trunkR + 0.3 && y < ty + t.trunkH)) return true; } } return false; };
        let pos = null, turn = 0;
        for (const dy of [0, 15, -15, 30, -30, 45, -45, 60, -60]) { const a = ry + dy * Math.PI / 180, nx = Math.sin(a) * side, nz = Math.cos(a) * side;
          const cx = pin.x + tx + nx * d, cz = pin.z + tz + nz * d, cy = Math.max(pin.y + 2.08 + up * (d > 10 ? 0.5 : 0.1), h.height(cx, cz) + 1.6);
          if (!blocked(cx, cy, cz)) { pos = [cx, cy, cz]; turn = dy; break; } }
        if (!pos) { const nx = Math.sin(ry) * side, nz = Math.cos(ry) * side; pos = [pin.x + tx + nx * d, pin.y + 2.08 + up * (d > 10 ? 0.5 : 0.1), pin.z + tz + nz * d]; turn = null; }
        G.freeCam = { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(pin.x + tx, ly, pin.z + tz) };
        T.camera.clearViewOffset(); T.camera.fov = d > 10 ? 6 : 30; T.camera.updateProjectionMatrix(); window.__tick(1, true);
        return { d, side, turnDeg: turn };
      }, [d, side, up]));
      await shot(page, name, { x: 45, y: 272, width: 300, height: 300 });
    }
    // what the player sees: the normal aiming camera from 60 m and 15 m out (ball on the line from the green centre), cropped round the flag
    for (const [name, d] of [['flag_game_60m', 60], ['flag_game_15m', 15]]) {
      const fp = await page.evaluate((d) => {
        const T = window.__tempo, G = T.G, E = T.E, h = G.hole, pin = h.pin; G.freeCam = null;
        let dx = pin.x - h.green.x, dz = pin.z - h.green.z; const l = Math.hypot(dx, dz); if (l < 1) { const p = h.pointAtS(h.len - 40); dx = pin.x - p.x; dz = pin.z - p.z; }
        const k = Math.hypot(dx, dz); dx /= k; dz /= k; const bx = pin.x - dx * d, bz = pin.z - dz * d;
        G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = d > 30 ? E.CLUBS.findIndex(c => c.id === 'SW') : E.CLUBS.length - 1; G.mode = 'aim'; G.shot = null; G.swing = null;
        G.aim = Math.atan2(pin.x - bx, pin.z - bz); T.setupClub(G.club); T.snap(); window.__tick(60, false); T.snap(); window.__tick(2, true);
        const f = T.world.flag, v = new THREE.Vector3(); f.updateMatrixWorld(true); f.getWorldPosition(v); const top = v.clone(); v.project(T.camera);
        const pole = new THREE.Vector3(pin.x, pin.y, pin.z).project(T.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (0.5 - v.y * 0.5) * innerHeight, baseY: (0.5 - pole.y * 0.5) * innerHeight, lie: G.lie };
      }, d);
      const half = 60, cx = Math.max(half, Math.min(390 - half, fp.x)), cy = Math.max(half, Math.min(844 - half, fp.y));
      await shot(page, name, { x: cx - half, y: cy - half, width: 2 * half, height: 2 * half });
      await shot(page, name + '_full', null);
      log.flag.push(Object.assign({ name }, fp));
    }
    log.flagErrors = page.errs; await page.close();
  }
  fs.writeFileSync(path.join(OUT, tag + '_log.json'), JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log, null, 1));
  await browser.close();
})();
