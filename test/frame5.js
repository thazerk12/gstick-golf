// Round 5 Task 1: address framing from the game's own camera (ADDR per club), for every full club at 390x844 and 430x932.
// Per club: the ball's screen position (% of width / height) and drawn diameter (CSS px); the club's smallest margin to the
// frame (% of width or height) at address, at the top of a 100% backswing and at the finish; how many sampled club points
// fall inside a HUD card or bottom button box; the share of the shaft (grip end -> head) on screen; the aim-line check
// (points 0, 10, 30, 100 m down the line projected, x relative to the ball's x); and the horizon's screen y.
// usage: node test/frame5.js <page.html> <out.json> [shots-dir]   (env CLUBS=0,3 to limit; SHOTCLUBS=DR,5I,9I,SW for images)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/frame5.json', SHOTS = process.argv[4];
const SHOTCLUBS = (process.env.SHOTCLUBS || 'DR,5I,9I,SW').split(',');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const all = [];
  for (const [W, H] of [[390, 844], [430, 932]]) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await require('./fontroute')(page);
    const f = path.join(path.dirname(OUTF), 'fr5_' + W + '_' + path.basename(path.dirname(SRC)) + '.html');
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
    await page.goto('file://' + f);
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.save().shots = 99; T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); T.G.manual = true; for (let i = 0; i < 240; i++) T.tick(1 / 60, false); });
    const n = 12, only = process.env.CLUBS ? process.env.CLUBS.split(',').map(Number) : null;
    for (let ci = 0; ci < n; ci++) {
      if (only && !only.includes(ci)) continue;
      for (const pose of ['address', 'top', 'finish']) {
        const r = await page.evaluate(([ci, pose]) => {
          const T = window.__tempo, G = T.G, E = T.E, h = G.hole, cam = T.camera;
          let bx = 0, bz = 0.6; if (ci > 0) { const p = h.pointAtS(Math.min(h.len - 60, 230)); bx = p.x; bz = p.z; }
          G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = ci; G.mode = 'aim'; G.map = false; G.swing = null; G.shot = null;
          G.aim = Math.atan2(h.pin.x - bx, h.pin.z - bz); G.camOrbit = null; T.setupClub(ci);
          const sp = T.clubModels[ci].sp, P = { address: [0, 0], top: [sp.aTop, sp.bTop], finish: [-sp.aFin, -sp.bFin] }[pose];
          Object.assign(T.CV, { phase: 'pose', a: P[0], b: P[1], v: 0, bend: 0, bendV: 0, alpha: 0, alphaT: 0, flexAl: 0, shot: null });
          for (let i = 0; i < 3; i++) { T.tick(1 / 60, false); T.snap(); } T.CV.bend = 0; T.CV.bendV = 0; T.tick(1 / 60, true);
          const VW = innerWidth, VH = innerHeight, v = new THREE.Vector3(); cam.updateMatrixWorld();
          const px = (x, y, z) => { v.set(x, y, z).project(cam); return [(v.x * 0.5 + 0.5) * VW, (0.5 - v.y * 0.5) * VH, v.z]; };
          const rects = [...document.querySelectorAll('#hudTop .card, #btnPause, #clubPrev, #hudBot .clubball, #clubNext, #btnMap')].map(e => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; });
          const grp = T.clubModels[ci].grp; { let o = grp; while (o.parent) o = o.parent; o.updateMatrixWorld(true); }
          let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, hud = 0, total = 0;
          grp.traverse(o => { if (!o.isMesh) return; const pa = o.geometry.attributes.position, a = new THREE.Vector3();
            for (let k = 0; k < pa.count; k++) { a.fromBufferAttribute(pa, k).applyMatrix4(o.matrixWorld); const q = px(a.x, a.y, a.z); total++;
              x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
              for (const r of rects) if (q[0] >= r[0] && q[0] <= r[2] && q[1] >= r[1] && q[1] <= r[3]) { hud++; break; } } });
          // the shaft line, grip end to the head's centre: share on screen
          const tip = T.clubModels[ci].flex.tip, hc = new THREE.Vector3(); tip.children[0].geometry.computeBoundingBox(); tip.children[0].geometry.boundingBox.getCenter(hc); tip.children[0].localToWorld(hc);
          const g0 = new THREE.Vector3(0, 0.05, 0).applyMatrix4(grp.matrixWorld); let vis = 0; for (let i = 0; i <= 40; i++) { const q = g0.clone().lerp(hc, i / 40), s = px(q.x, q.y, q.z); if (s[0] >= 0 && s[0] <= VW && s[1] >= 0 && s[1] <= VH && s[2] < 1) vis++; }
          const bm = T.ballMesh, bc = px(bm.position.x, bm.position.y, bm.position.z), right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
          const be = px(bm.position.x + right.x * bm.scale.x, bm.position.y + right.y * bm.scale.x, bm.position.z + right.z * bm.scale.x);
          const dx = Math.sin(G.aim), dz = Math.cos(G.aim);
          const aim = [0, 10, 30, 100].map(d => { const x = bx + dx * d, z = bz + dz * d; return +(px(x, h.height(x, z), z)[0] - bc[0]).toFixed(2); });
          const hz = px(bx + dx * 1e5, G.ball.y, bz + dz * 1e5)[1];
          const A = T.addrFor ? T.addrFor(ci) : null;
          return { club: E.CLUBS[ci].id, pose, ballXPct: +(100 * bc[0] / VW).toFixed(2), ballYPct: +(100 * bc[1] / VH).toFixed(2), ballPx: +(2 * Math.hypot(be[0] - bc[0], be[1] - bc[1])).toFixed(2), ballScale: T.state().ballScale,
            marginPct: +Math.min(100 * x0 / VW, 100 * (VW - x1) / VW, 100 * y0 / VH, 100 * (VH - y1) / VH).toFixed(2), box: [x0, y0, x1, y1].map(q => +q.toFixed(1)), hudPts: hud, pts: total, shaftOnScreen: +(vis / 41).toFixed(3),
            aimDx: aim, horizonPct: +(100 * hz / VH).toFixed(1), addr: A, fov: cam.fov, camBack: +Math.hypot(cam.position.x - bx, cam.position.z - bz).toFixed(2), camUp: +(cam.position.y - G.ball.y).toFixed(2) };
        }, [ci, pose]);
        r.viewport = W + 'x' + H; all.push(r);
        if (SHOTS && W === 390 && SHOTCLUBS.includes(r.club)) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `frame_${r.club}_${pose}.png`), timeout: 180000 }); }
      }
    }
    if (errs.length) console.log('errors', errs);
  }
  fs.writeFileSync(OUTF, JSON.stringify(all, null, 1));
  for (const r of all.filter(r => r.pose === 'address')) {
    const t = all.find(q => q.viewport === r.viewport && q.club === r.club && q.pose === 'top'), f = all.find(q => q.viewport === r.viewport && q.club === r.club && q.pose === 'finish');
    console.log(r.viewport, r.club.padEnd(3), `ball ${r.ballXPct}%,${r.ballYPct}% ${r.ballPx}px | margin addr ${r.marginPct} top ${t.marginPct} fin ${f.marginPct} | HUD pts ${r.hudPts}/${t.hudPts}/${f.hudPts} | shaft on screen ${r.shaftOnScreen}/${t.shaftOnScreen}/${f.shaftOnScreen} | aim dx ${r.aimDx.join(',')} | horizon ${r.horizonPct}% | cam ${r.camBack}/${r.camUp} fov ${r.fov.toFixed(1)}`);
  }
  await browser.close();
})();
