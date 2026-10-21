// Round 4 Task 4a: address framing. For every club at 390x844 and 430x932: the club's screen box (grip end to head, from
// every vertex), its margin to the frame edges (% of width / height), the ball's on-screen diameter (CSS px) and the visible
// share of the ball (rays through a grid over its disc; the club hides a ray if it is hit before the ball).
// usage: node test/frame4.js <page.html> <out.json> [shots-dir]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html'), OUTF = process.argv[3] || '/tmp/frame4.json', SHOTS = process.argv[4];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const all = [];
  for (const [W, H] of [[390, 844], [430, 932]]) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await require('./fontroute')(page);
    const f = path.join(path.dirname(OUTF), 'fr_' + W + '_' + path.basename(SRC)); fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
    await page.goto('file://' + f);
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    const n = await page.evaluate((J) => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); T.G.manual = true;
      if (J) { const o = JSON.parse(J); for (const k in o) { if (k === 'putt') Object.assign(T.ADDR.putt, o.putt); else T.ADDR[k] = o[k]; } }
      return T.E.CLUBS.length; }, process.env.ADDRJ || null);
    const only = process.env.CLUBS ? process.env.CLUBS.split(',').map(Number) : null;
    for (let ci = 0; ci < n; ci++) for (const putD of (ci === n - 1 ? [3, 10, 15, 18] : [null])) {
      if (only && !only.includes(ci)) continue;
      const r = await page.evaluate(([ci, putD]) => {
        const T = window.__tempo, G = T.G, E = T.E, h = G.hole, cam = T.camera;
        // the ball on the tee (driver) or fairway; the putter on the green putD from the pin
        let bx = 0, bz = 0.6;
        if (putD != null) { const dx = h.green.x - h.pin.x, dz = h.green.z - h.pin.z, l = Math.hypot(dx, dz) || 1; bx = h.pin.x + dx / l * putD; bz = h.pin.z + dz / l * putD; }
        else if (ci > 0) { const p = h.pointAtS(Math.min(h.len - 60, 230)); bx = p.x; bz = p.z; }
        G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = ci; G.mode = 'aim'; G.map = false; G.swing = null; G.shot = null;
        G.aim = Math.atan2(h.pin.x - bx, h.pin.z - bz); G.camOrbit = null;
        T.setupClub(ci); Object.assign(T.CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, shot: null, bend: 0, bendV: 0 });
        for (let i = 0; i < 3; i++) { T.tick(1 / 60, false); T.snap(); }
        T.tick(1 / 60, true);
        const VW = innerWidth, VH = innerHeight, v = new THREE.Vector3();
        // club box from every vertex
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        const meshes = []; T.clubModels[ci].grp.updateMatrixWorld(true);
        T.clubModels[ci].grp.traverse(o => { if (o.isMesh) { meshes.push(o); const p = o.geometry.attributes.position; for (let k = 0; k < p.count; k++) { v.fromBufferAttribute(p, k).applyMatrix4(o.matrixWorld).project(cam); const sx = (v.x * 0.5 + 0.5) * VW, sy = (0.5 - v.y * 0.5) * VH; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); } } });
        // ball: screen diameter and visible share
        // the drawn ball (round 3 does not export its mesh: rebuilt from the drawn position and scale)
        let bm = T.ballMesh;
        if (!bm) { const sc = T.state().ballScale, R = E.BALL_R; bm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18)); bm.position.set(G.bd.x, G.bd.y + R * (sc - 1), G.bd.z); bm.scale.setScalar(R * sc); bm.updateMatrixWorld(true); }
        const c = bm.position.clone(), rad = bm.scale.x;
        const cs = c.clone().project(cam), ccx = (cs.x * 0.5 + 0.5) * VW, ccy = (0.5 - cs.y * 0.5) * VH;
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        let rpx = 0; for (const d of [right, up]) { const e = c.clone().addScaledVector(d, rad).project(cam); rpx = Math.max(rpx, Math.hypot((e.x * 0.5 + 0.5) * VW - ccx, (0.5 - e.y * 0.5) * VH - ccy)); }
        const rc = new THREE.Raycaster(); let tot = 0, vis = 0;
        for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
          const px = ccx + i / 20 * rpx, py = ccy + j / 20 * rpx; if (Math.hypot(px - ccx, py - ccy) > rpx * 0.98) continue;
          rc.setFromCamera({ x: px / VW * 2 - 1, y: -(py / VH) * 2 + 1 }, cam);
          const hb = rc.intersectObject(bm, false)[0]; if (!hb) continue; tot++;
          const hc = rc.intersectObjects(meshes, false)[0]; if (!hc || hc.distance > hb.distance) vis++;
        }
        return { club: E.CLUBS[ci].id, putD, box: [x0, y0, x1, y1].map(q => +q.toFixed(1)), marginPct: { left: +(100 * x0 / VW).toFixed(1), right: +(100 * (VW - x1) / VW).toFixed(1), top: +(100 * y0 / VH).toFixed(1), bottom: +(100 * (VH - y1) / VH).toFixed(1) },
          cupPx: putD != null ? (() => { const q = new THREE.Vector3(h.pin.x, h.pin.y, h.pin.z).project(cam); return [+((q.x * 0.5 + 0.5) * VW).toFixed(1), +((0.5 - q.y * 0.5) * VH).toFixed(1)]; })() : undefined, ballPx: +(2 * rpx).toFixed(1), ballVisiblePct: tot ? +(100 * vis / tot).toFixed(1) : null, ballCentrePx: [+ccx.toFixed(1), +ccy.toFixed(1)], fov: cam.fov, view: cam.view && cam.view.enabled ? { offsetX: cam.view.offsetX, fullW: cam.view.fullWidth } : null };
      }, [ci, putD]);
      r.viewport = W + 'x' + H; all.push(r);
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, 'address_' + W + 'x' + H + '_' + r.club + (putD ? putD + 'm' : '') + '.png') }); }
    }
    if (errs.length) console.log('errors', errs);
  }
  fs.writeFileSync(OUTF, JSON.stringify(all, null, 1));
  for (const r of all) { const m = r.marginPct; console.log(r.viewport, (r.club + (r.putD ? ' ' + r.putD + 'm' : '')).padEnd(7), 'margins L' + m.left + ' R' + m.right + ' T' + m.top + ' B' + m.bottom + '  min ' + Math.min(m.left, m.right, m.top, m.bottom).toFixed(1) + '%  ball ' + r.ballPx + ' px, visible ' + r.ballVisiblePct + '%' + (r.cupPx ? '  cup at ' + (100 * r.cupPx[1] / +r.viewport.split("x")[1]).toFixed(1) + '% down, fov ' + r.fov.toFixed(1) : '')); }
  await browser.close();
})();
