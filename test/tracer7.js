// Round 7 Task 5: the tracer, round 6 vs round 7, at 390x844 (DPR 2). Three shots on seed pop-4 (tier 2, course 0): a full
// drive (straight, just outside the PURE window: cream core), a PURE 7-iron from 150 m (yellow core) and an 80% PW from 110 m
// (cream core). Each is shot with takeShot (same power, path and tempo in both rounds) and caught at the apex (mid-flight) and
// 10 frames after the ball stops (before the tracer's hold ends).
// Brightness: the scene is drawn twice at the same frame, with and without the tracer meshes, and read back (WebGL, sRGB
// bytes). Tracer pixels: luma (Rec. 709, 0-255) changed by more than 2. Each is classed by a ray from the camera through it:
// no terrain hit within 4 km = sky, else the surface it hits (fairway, rough, green, ...; trees are not traced, so a tree behind
// the tracer counts as sky or the ground behind it). Per class: pixel count, peak luma with the tracer, the background luma
// at that pixel, the largest and the 95th-percentile luma rise, and the mean rise.
// usage: node test/tracer7.js <page.html> <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/tracer7';
fs.mkdirSync(OUT, { recursive: true });
const tag = path.basename(path.dirname(SRC)) === 'baseline_r6' ? 'r6' : 'r7';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'tr7_' + tag + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, E = T.E;
    window.__k = 0;
    window.__tick = (n, draw) => { for (let i = 0; i < n; i++) { window.__k++; window.__sim.t = window.__sim.base + window.__k * 1000 / 60; T.tick(1 / 60, draw && i === n - 1); } };
    window.__start = () => { T.save().seenHow = true; T.save().shots = 99; T.startRound({ kind: 'quick', seed: 'pop-4', tier: 2, course: 0 }); G.manual = true; window.__sim.base = performance.now(); window.__sim.on = true; window.__tick(240, false); };
    // the scene drawn with and without the tracer, read back; tracer pixels classed by a ray against the terrain
    window.__measure = () => {
      const r = T.renderer, gl = r.getContext(), cam = T.camera; let scene = T.ballMesh; while (scene.parent) scene = scene.parent;
      const tr = []; scene.traverse(o => { if (o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uFade && (o.renderOrder === 6 || o.renderOrder === 6.5)) tr.push(o); });
      const vis = tr.map(o => o.visible), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const read = () => { r.render(scene, cam); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
      const A = read(); tr.forEach(o => { o.visible = false; }); const B = read(); tr.forEach((o, i) => { o.visible = vis[i]; });
      const L = (a, i) => 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
      const h = G.hole, names = {}; for (const k in E.S) names[E.S[k]] = k.toLowerCase();
      const ray = new THREE.Raycaster(), cls = {};
      cam.updateMatrixWorld();
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4, la = L(A, i), lb = L(B, i), d = la - lb; if (Math.abs(d) <= 2) continue;
        ray.setFromCamera({ x: (x + 0.5) / W * 2 - 1, y: (y + 0.5) / H * 2 - 1 }, cam);   // readPixels rows run bottom-up
        const o = ray.ray.origin, v = ray.ray.direction; let t = 0.5, hit = null;
        while (t < 4000) { const px = o.x + v.x * t, py = o.y + v.y * t, pz = o.z + v.z * t; if (py < h.height(px, pz)) { hit = names[h.surface(px, pz)] || 'ground'; break; } t += Math.max(0.25, t * 0.01); }
        const c = hit || 'sky'; const q = cls[c] || (cls[c] = { n: 0, peak: -1, bgAtPeak: 0, rises: [] });
        q.n++; q.rises.push(d); if (la > q.peak) { q.peak = la; q.bgAtPeak = lb; }
      }
      const out = {};
      for (const c in cls) { const q = cls[c], s = q.rises.sort((a, b) => a - b); out[c] = { px: q.n, peakLuma: +q.peak.toFixed(1), bgAtPeak: +q.bgAtPeak.toFixed(1), maxRise: +s[s.length - 1].toFixed(1), p95Rise: +s[Math.floor(0.95 * (s.length - 1))].toFixed(1), meanRise: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) }; }
      return { meshes: tr.length, classes: out, label: G.shot ? G.shot.label : null, mode: G.mode, ballT: +G.ball.t.toFixed(2) };
    };
  });
  const shots = [
    { name: 'drive', club: 'DR', power: 1, pathF: 0.06, at: null },
    { name: 'pure7i', club: '7I', power: 1, pathF: 0, at: 150 },
    { name: 'wedge', club: 'PW', power: 0.8, pathF: 0.06, at: 110 },
  ];
  const log = { tag, rows: [] };
  for (const s of shots) {
    await page.evaluate(() => window.__start());
    await page.evaluate((s) => {
      const T = window.__tempo, G = T.G, E = T.E, h = G.hole;
      if (s.at) { const q = h.pointAtS(h.len - s.at); G.ball.place(h, q.x, q.z); G.ball.state = 'rest'; G.lie = h.surface(q.x, q.z); G.aim = Math.atan2(h.pin.x - q.x, h.pin.z - q.z); G.camYaw = null; }
      G.club = E.CLUBS.findIndex(c => c.id === s.club); T.setupClub(G.club); G.mode = 'aim'; window.__tick(30, false); T.snap(); window.__tick(30, false);
      T.takeShot(s.power, 0, 1, s.pathF);
      let py = -1e9;
      for (let i = 0; i < 1200; i++) { window.__tick(1, false); const b = G.ball; if (b.state === 'air' && b.t > 0.2 && b.y < py) break; py = b.y; }
      window.__tick(1, true);
    }, s);
    for (const phase of ['flight', 'rest']) {
      if (phase === 'rest') await page.evaluate(() => { const G = window.__tempo.G; for (let i = 0; i < 2400 && G.mode === 'flight'; i++) window.__tick(1, false); window.__tick(10, false); window.__tick(1, true); });
      const m = await page.evaluate(() => window.__measure());
      await page.evaluate(() => { for (const id of ['banner', 'toast']) document.getElementById(id).classList.remove('show'); window.__tempo.tick(0, true); });
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(OUT, `${tag}_tracer_${s.name}_${phase}.png`), timeout: 180000 });
      const row = Object.assign({ shot: s.name, phase }, m); log.rows.push(row);
      console.log(tag, s.name, phase, row.label, 'mode', row.mode, 't', row.ballT, 'meshes', row.meshes);
      for (const c in m.classes) console.log('   ', c.padEnd(8), JSON.stringify(m.classes[c]));
    }
  }
  log.errors = errs;
  fs.writeFileSync(path.join(OUT, 'tracer7_' + tag + '.json'), JSON.stringify(log, null, 1));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
