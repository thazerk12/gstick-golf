// Round 2 rough check, all four themes at 390x844 (DPR 2): address on the fairway, address in the rough, a landing area from
// the flight camera, and the map view. Measures: rough vs fairway luma at a distance (3D canvas, by surface under each pixel),
// the clump around a ball in the rough (share of the ball hidden, from the address camera), instance counts in every view,
// the painted band contrasts (from the course texture), and that the clump goes when the ball moves.
// usage: OUT=<dir> node test/rough2.js <page.html> <out.json> [tag]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp', SRC = process.argv[2], OUTF = process.argv[3], TAG = process.argv[4] || 'r2';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const f = OUT + '/' + TAG + '.html';
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f, { timeout: 240000 });
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 240000 });
  await page.evaluate(() => {
    const T = window.__tempo; T.G.manual = true; T.save().seenHow = true;
    const R = T.renderer, r0 = R.render; window.__scene = null; R.render = function (s, c) { window.__scene = s; return r0.call(this, s, c); };
    window.__tuftMesh = () => { let m = null; window.__scene.traverse(o => { if (o.isInstancedMesh && o.geometry.attributes.position.count === 21) m = o; }); return m; };
    window.__lumAt = (buf, W, H, u, v, r) => { let s = 0, n = 0; for (let y = v - r; y <= v + r; y++) for (let x = u - r; x <= u + r; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = ((H - 1 - y) * W + x) * 4; s += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; n++; } return n ? s / n : null; };
    window.__grab = () => { const gl = R.getContext(), W = R.domElement.width, H = R.domElement.height, b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return { b, W, H }; };
    // rough vs fairway luma over the current view: world points on a grid, kept when dMin-dMax m from the camera, at least 3 m
    // inside their surface, and with nothing nearer than the ground in front of them (depth check against the terrain ray)
    window.__surfLuma = (dMin, dMax) => {
      const G = T.G, h = G.hole, S = T.E.S, cam = T.camera, V = cam.position.constructor, g = window.__grab(), out = { fairway: [], rough: [] };
      const near = (x, z, sf) => { for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2.1, 2.1], [-2.1, 2.1], [2.1, -2.1], [-2.1, -2.1]]) if (h.surface(x + dx, z + dz) !== sf) return false; return true; };
      const b = h.bounds;
      for (let x = b.minX; x < b.maxX; x += 2.5) for (let z = b.minZ; z < b.maxZ; z += 2.5) {
        const sf = h.surface(x, z); if (sf !== S.FAIRWAY && sf !== S.ROUGH) continue;
        const y = h.height(x, z), d = Math.hypot(x - cam.position.x, y - cam.position.y, z - cam.position.z); if (d < dMin || d > dMax) continue;
        if (h.treesNear && h.treesNear(x, z, 6).length) continue;
        const p = new V(x, y, z).project(cam); if (Math.abs(p.x) > 0.97 || Math.abs(p.y) > 0.97 || p.z > 1) continue;
        if (!near(x, z, sf)) continue;
        const u = Math.round((p.x * 0.5 + 0.5) * g.W), v = Math.round((0.5 - p.y * 0.5) * g.H);
        out[sf === S.FAIRWAY ? 'fairway' : 'rough'].push(window.__lumAt(g.b, g.W, g.H, u, v, 1));
      }
      const tm = (a) => { if (a.length < 20) return null; a = a.slice().sort((p, q) => p - q); const lo = Math.floor(a.length * 0.1), hi = Math.ceil(a.length * 0.9); let s = 0; for (let i = lo; i < hi; i++) s += a[i]; return s / (hi - lo); };
      const F = tm(out.fairway), Rr = tm(out.rough);
      return { nFairway: out.fairway.length, nRough: out.rough.length, fairway: F && +F.toFixed(1), rough: Rr && +Rr.toFixed(1), roughVsFairwayPct: F && Rr ? +(100 * (Rr - F) / F).toFixed(1) : null };
    };
    window.__counts = () => { const m = window.__tuftMesh(), G = T.G; let maxD = 0; const M = new (window.THREE.Matrix4)(), P = new (window.THREE.Vector3)();
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); P.setFromMatrixPosition(M); maxD = Math.max(maxD, Math.hypot(P.x - G.ball.x, P.z - G.ball.z)); }
      return { tufts: m.count, maxFromBall: +maxD.toFixed(3) }; };
    window.__settle = (n, draw) => { for (let i = 0; i < n; i++) T.tick(1 / 60, false); T.snap(); T.tick(1 / 60, false); T.tick(1 / 60, true); };
  });
  const shot = async (name) => { await page.screenshot({ path: OUT + '/' + name + '.png' }); return name + '.png'; };
  const res = { themes: [], errs };
  for (const course of [0, 1, 2, 3]) {
    const r = await page.evaluate((course) => {
      const T = window.__tempo, G = T.G, E = T.E, S = E.S;
      T.startRound({ kind: 'quick', seed: 'rough2-' + course, tier: 4, course });
      G.manual = true; G.timer = 9; for (let i = 0; i < 4; i++) T.tick(1 / 60, false);
      const h = G.hole; return { theme: h.courseKey, len: h.len, par: h.par };
    }, course);
    const th = r.theme, o = { theme: th, par: r.par, views: {} };
    // painted bands, read from the course texture: rough bands (alternate 6 m bands) and the darker band outside the first cut
    o.paint = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, h = G.hole, E = T.E; T.tick(0, true);
      let img = null; window.__scene.traverse(o => { const m = o.material; if (m && m.map && m.map.image && m.map.image.width >= 1024 && m.map.image.getContext) img = m.map.image; });
      const b = h.bounds, W = b.maxX - b.minX, D = b.maxZ - b.minZ, g = img.getContext('2d'), kx = img.width / W, kz = img.height / D;
      const lumW = (x, z) => { const d = g.getImageData(Math.round((x - b.minX) * kx), Math.round((z - b.minZ) * kz), 1, 1).data; return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]; };
      const F = T.FEEL.roughPaint, med = (a) => { a = a.slice().sort((p, q) => p - q); return a[a.length >> 1]; };
      const col = { band0: [], band1: [], shade: [], first: [], ob: [] };
      for (let s = h.fwStart + 15; s < h.len - 40; s += 4) for (const sd of [1, -1]) {
        const p = h.pointAtS(s), fc = h.fwHalf(s) + 3.2, at = (o) => lumW(p.x + p.nx * sd * o, p.z + p.nz * sd * o);
        col.band0.push(at(fc + F.shadeW + F.bandW * 0.5)); col.band1.push(at(fc + F.shadeW + F.bandW * 1.5)); col.shade.push(at(fc + F.shadeW * 0.5)); col.first.push(at(fc - 1.6)); col.ob.push(at(h.obDist + 8));
      }
      const m = {}; for (const k in col) m[k] = med(col[k]);
      return { samples: col.band0.length, roughBand: +m.band0.toFixed(1), roughBandAlt: +m.band1.toFixed(1), bandContrastPct: +(100 * (m.band1 - m.band0) / m.band0).toFixed(2),
        shadeVsRoughPct: +(100 * (m.shade - m.band0) / m.band0).toFixed(2), firstCut: +m.first.toFixed(1), outOfBounds: +m.ob.toFixed(1), obVsRoughPct: +(100 * (m.ob - m.band0) / m.band0).toFixed(1) };
    });
    // 1. address on the fairway
    o.views.fairway = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, h = G.hole, E = T.E, S = E.S, s = Math.min(h.len * 0.55, 220), p = h.pointAtS(s);
      G.ball.place(h, p.x, p.z); G.ball.state = 'rest'; G.lie = h.surface(p.x, p.z); G.club = 5; T.CV.ci = -1; T.CV.phase = 'address';
      G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); G.mode = 'aim'; G.map = false; G.previewDirty = true;
      T.buildTufts(G.ball.x, G.ball.z); window.__settle(90);
      return { lie: E.SURF_NAMES[G.lie], counts: window.__counts() };
    });
    o.views.fairway.png = await shot(TAG + '_' + th + '_fairway');
    // 2. address in the rough, with and without the clump drawn: share of ball pixels the grass hides
    o.views.rough = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, h = G.hole, E = T.E, S = E.S, s = Math.min(h.len * 0.55, 220), p = h.pointAtS(s), off = h.fwHalf(s) + 3.2 + 4.5;
      G.ball.place(h, p.x + p.nx * off, p.z + p.nz * off); G.ball.state = 'rest'; G.lie = h.surface(G.ball.x, G.ball.z); G.club = 5; T.CV.ci = -1; T.CV.phase = 'address';
      G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); G.mode = 'aim'; G.previewDirty = true;
      const t0 = performance.now(); T.buildTufts(G.ball.x, G.ball.z); const ms = performance.now() - t0;
      window.__settle(90);
      const hideMeasure = () => {
      const m = window.__tuftMesh(), cam = T.camera, V = cam.position.constructor, R = T.renderer, gl = R.getContext(), W = R.domElement.width, H = R.domElement.height;
      let ball = null; window.__scene.traverse(o => { if (o.isMesh && o.geometry && /Sphere/.test(o.geometry.type) && Math.abs(o.position.x - G.ball.x) < 1e-6 && Math.abs(o.position.z - G.ball.z) < 1e-6) ball = o; });
      const grab = () => { R.render(window.__scene, cam); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
      const withC = grab(); ball.visible = false; const withCnb = grab(); m.visible = false; const noCnb = grab(); ball.visible = true; const noC = grab(); m.visible = true; T.tick(0, true);
      const bp = new V(G.ball.x, G.ball.y, G.ball.z).project(cam), cu = (bp.x * 0.5 + 0.5) * W, cv = (0.5 - bp.y * 0.5) * H;
      const tp = new V(G.ball.x, G.ball.y + E.BALL_R * G.ballScale, G.ball.z).project(cam), rPx = Math.abs((0.5 - tp.y * 0.5) * H - cv) * 1.3 + 2;
      const diff = (A, B, i) => Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 6;
      const rows = {}; let nBall = 0, nVis = 0;
      for (let y = Math.floor(cv - rPx); y <= Math.ceil(cv + rPx); y++) for (let x = Math.floor(cu - rPx); x <= Math.ceil(cu + rPx); x++) {
        const i = ((H - 1 - y) * W + x) * 4; if (!diff(noC, noCnb, i)) continue; nBall++; const v = diff(withC, withCnb, i); if (v) nVis++;
        rows[y] = rows[y] || [0, 0]; rows[y][0]++; if (v) rows[y][1]++;
      }
      const ys = Object.keys(rows).map(Number).sort((a, b) => a - b); let hidRowsFromBottom = 0;
      for (let j = ys.length - 1; j >= 0; j--) { const [n, k] = rows[ys[j]]; if (k / n < 0.5) hidRowsFromBottom++; else break; }
      return { ballPx: nBall, hiddenShare: +((nBall - nVis) / Math.max(1, nBall)).toFixed(3), hiddenFromBottom: +(hidRowsFromBottom / Math.max(1, ys.length)).toFixed(3), rows: ys.length, cu, cv, rPx };
      };
      const atAddress = hideMeasure();
      T.CV.phase = 'pose'; T.CV.a = 150; T.CV.b = 95; for (let i = 0; i < 3; i++) T.tick(1 / 60, false); T.tick(0, true);
      const clubAway = hideMeasure();
      T.CV.phase = 'address'; for (let i = 0; i < 30; i++) T.tick(1 / 60, false); T.tick(1 / 60, true);
      const cu = atAddress.cu, cv = atAddress.cv, rPx = atAddress.rPx;
      return { lie: E.SURF_NAMES[G.lie], counts: window.__counts(), placeMs: +ms.toFixed(3), ballScale: +G.ballScale.toFixed(2), grassAlone: { ballPx: clubAway.ballPx, hiddenShare: clubAway.hiddenShare, hiddenFromBottom: clubAway.hiddenFromBottom }, atAddress: { ballPxVisibleNoGrass: atAddress.ballPx, ballPxClubAway: clubAway.ballPx, hiddenByGrassShare: atAddress.hiddenShare }, ballCenterPx: [Math.round(cu), Math.round(cv)], ballRpx: +rPx.toFixed(1) };
    });
    o.views.rough.png = await shot(TAG + '_' + th + '_rough');
    // crop around the ball for a close look
    {
      const [u, v] = o.views.rough.ballCenterPx; const cs = 120;
      await page.screenshot({ path: OUT + '/' + TAG + '_' + th + '_roughball.png', clip: { x: Math.max(0, u / 2 - cs / 2), y: Math.max(0, v / 2 - cs / 2), width: cs, height: cs } });
    }
    // 3. map view from the rough lie
    o.views.map = await page.evaluate(() => { const T = window.__tempo, G = T.G; G.map = true; window.__settle(120); const lum = window.__surfLuma(0, 1e9); const c = window.__counts(); G.map = false; return { counts: c, luma: lum }; });
    await page.evaluate(() => { const T = window.__tempo, G = T.G; G.map = true; window.__settle(1); });
    o.views.map.png = await shot(TAG + '_' + th + '_map');
    await page.evaluate(() => { const T = window.__tempo, G = T.G; G.map = false; window.__settle(60); });
    // 4. hit from the rough: the clump goes when the ball moves; follow the flight to the landing area
    o.views.landing = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, h = G.hole, E = T.E, b = G.ball;
      const before = window.__tuftMesh().count;
      T.takeShot(0.85, 0, 1); const after = window.__tuftMesh().count;
      let n = 0, best = null;
      while (n++ < 900) { T.tick(1 / 60, false); if (b.state === 'air' && b.vy < 0 && b.y - h.height(b.x, b.z) < 6) break; if (b.state !== 'air' && n > 30) break; }
      T.tick(1 / 60, true);
      return { clumpBeforeShot: before, clumpAfterShot: after, framesToLanding: n, ballHeight: +(b.y - h.height(b.x, b.z)).toFixed(1), counts: window.__counts(), luma: window.__surfLuma(40, 160), mode: G.mode };
    });
    o.views.landing.png = await shot(TAG + '_' + th + '_landing');
    // clump only in the rough: ask for it on fairway, fringe and green
    o.noClumpElsewhere = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, h = G.hole, E = T.E, S = E.S, out = {};
      const tryAt = (nm, x, z) => { G.ball.place(h, x, z); G.ball.state = 'rest'; T.buildTufts(G.ball.x, G.ball.z); out[nm] = { surface: E.SURF_NAMES[h.surface(x, z)], tufts: window.__tuftMesh().count }; };
      const p = h.pointAtS(Math.min(h.len * 0.55, 220)); tryAt('fairway', p.x, p.z);
      tryAt('green', h.pin.x + 1, h.pin.z + 1);
      const fr = 1 + h.fringeW * 0.5 / Math.min(h.grx, h.grz); let ang = 0, x, z; for (; ang < 6.3; ang += 0.1) { x = h.green.x; z = h.green.z; let r = 0; while (h.greenQ(x + Math.sin(ang) * r, z + Math.cos(ang) * r) < fr && r < 80) r += 0.05; x += Math.sin(ang) * r; z += Math.cos(ang) * r; if (h.surface(x, z) === S.FRINGE) break; }
      tryAt('fringe', x, z);
      return out;
    });
    res.themes.push(o);
    console.log(JSON.stringify({ theme: th, paint: o.paint, rough: o.views.rough, mapLuma: o.views.map.luma, landing: o.views.landing, noClumpElsewhere: o.noClumpElsewhere }));
  }
  fs.writeFileSync(OUTF, JSON.stringify(res, null, 1));
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
