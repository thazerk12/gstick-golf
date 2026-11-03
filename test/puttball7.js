// Round 7 Task 2: the ball at address on putts of 1.5, 4 and 10 m, from the putting camera in each preset (close, std, high),
// at 402x874: the ball's drawn diameter (CSS px), its drawn scale (x real), the cup's drawn diameter, and the share of the
// ball's disc not hidden by the putter (rays through a 41x41 grid over the disc: hits the ball before any club mesh), and which
// club mesh hides the rest (shaft; head = the head with its neck, insert and ferrule; grip).
// usage: node test/puttball7.js <page.html> <out.json> [shots-dir]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/puttball7.json', SHOTS = process.argv[4];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(path.dirname(OUTF), 'pb7_' + path.basename(path.dirname(SRC)) + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => { const T = window.__tempo, G = T.G; T.save().seenHow = true; T.save().shots = 99; T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true; for (let i = 0; i < 900 && G.mode !== 'aim'; i++) T.tick(1 / 60, false); });
  const out = [];
  for (const preset of ['close', 'std', 'high']) for (const d of [1.5, 4, 10]) {
    const r = await page.evaluate(([preset, d]) => {
      const T = window.__tempo, G = T.G, E = T.E, h = G.hole, cam = T.camera;
      T.save().settings.cam = preset;
      let x = h.pin.x, z = h.pin.z - d;
      for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * d, pz = h.pin.z + Math.cos(t) * d; if (h.surface(px, pz) === E.S.GREEN && h.greenQ(px, pz) < 0.9) { x = px; z = pz; break; } }
      for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.camYaw = null; G.camLock = false; G.shot = null; G.swing = null;
      T.setupClub(G.club); T.tick(1 / 60, false); T.snap(); for (let i = 0; i < 90; i++) T.tick(1 / 60, false); T.tick(1 / 60, true);
      const VW = innerWidth, VH = innerHeight, v = new THREE.Vector3(); cam.updateMatrixWorld();
      const meshes = []; { let o = T.clubModels[G.club].grp; while (o.parent) o = o.parent; o.updateMatrixWorld(true); } T.clubModels[G.club].grp.traverse(o => { if (o.isMesh) meshes.push(o); });
      const bm = T.ballMesh, c = bm.position.clone(), rad = bm.scale.x, cs = c.clone().project(cam), ccx = (cs.x * 0.5 + 0.5) * VW, ccy = (0.5 - cs.y * 0.5) * VH;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      let rpx = 0; for (const dv of [right, up]) { const e = c.clone().addScaledVector(dv, rad).project(cam); rpx = Math.max(rpx, Math.hypot((e.x * 0.5 + 0.5) * VW - ccx, (0.5 - e.y * 0.5) * VH - ccy)); }
      const rc = new THREE.Raycaster(); let tot = 0, vis = 0; const by = {};
      for (let i = -20; i <= 20; i++) for (let j = -20; j <= 20; j++) {
        const px = ccx + i / 20 * rpx, py = ccy + j / 20 * rpx; if (Math.hypot(px - ccx, py - ccy) > rpx * 0.98) continue;
        rc.setFromCamera({ x: px / VW * 2 - 1, y: -(py / VH) * 2 + 1 }, cam);
        const hb = rc.intersectObject(bm, false)[0]; if (!hb) continue; tot++;
        const hc = rc.intersectObjects(meshes, false)[0]; if (!hc || hc.distance > hb.distance) vis++;
        else { const k = meshes.indexOf(hc.object); by[k] = (by[k] || 0) + 1; }
      }
      const pc = new THREE.Vector3(h.pin.x, h.pin.y, h.pin.z), pq = pc.clone().project(cam), pe = pc.clone().addScaledVector(right, E.CUP_R).project(cam);
      const cupPx = 2 * Math.hypot((pe.x - pq.x) * 0.5 * VW, (pe.y - pq.y) * 0.5 * VH);
      return { preset, d, ballPx: +(2 * rpx).toFixed(2), scale: +(rad / E.BALL_R).toFixed(3), visiblePct: tot ? +(100 * vis / tot).toFixed(1) : null, cupPx: +cupPx.toFixed(1), ballY: +(100 * ccy / VH).toFixed(1), hiddenBy: Object.fromEntries(Object.entries(by).map(([k, n]) => [['shaft', 'head', 'grip'][k] || k, +(100 * n / tot).toFixed(1)])), clubBackMm: T.clubBack ? +(T.clubBack() * 1000).toFixed(2) : 0 };
    }, [preset, d]);
    out.push(r); console.log(JSON.stringify(r));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.waitForTimeout(200); await page.screenshot({ path: path.join(SHOTS, `puttball_${preset}_${d}m.png`), timeout: 180000 }); }
  }
  fs.writeFileSync(OUTF, JSON.stringify({ rows: out, errors: errs }, null, 1));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
