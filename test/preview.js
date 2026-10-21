// The cached landing preview must land where a full step-by-step preview flight lands (the pre-round method).
// usage: OUT=<dir> node test/preview.js [page.html]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp', SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const f = OUT + '/pv.html'; fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, E = T.E, S = E.S;
    T.save().seenHow = true;
    const out = { n: 0, maxErr: 0, worst: null, frames: [] };
    for (const seed of ['pv-a', 'pv-b', 'pv-c']) {
      T.startRound({ kind: 'quick', seed, tier: 6, course: ['pv-a', 'pv-b', 'pv-c'].indexOf(seed) });
      G.manual = true; G.timer = 9; for (let i = 0; i < 3; i++) T.tick(1 / 60, false);
      const h = G.hole;
      const spots = [[0, 0.6]]; for (const p of h.pts) if (spots.length < 6 && Math.hypot(p.x - h.pin.x, p.z - h.pin.z) > 60 && p.s > 120) spots.push([p.x + 7, p.z]);
      for (const [x, z] of spots) for (const club of [0, 1, 3, 5, 8, 11]) for (const lie of [S.TEE, S.FAIRWAY, S.ROUGH, S.SAND]) {
        if (club === 0 && lie !== S.TEE) continue;
        G.ball.place(h, x, z); G.ball.state = 'rest'; G.club = club; G.lie = lie; G.mode = 'aim';
        for (const da of [-0.5, -0.17, 0, 0.21, 0.6]) {
          G.aim = Math.atan2(h.pin.x - x, h.pin.z - z) + da; G.previewDirty = true;
          let k = 0; do { T.tick(1 / 60, false); k++; } while ((!T.PV.done || G.previewDirty) && k < 20);
          out.frames.push(k);
          const P = G.preview; if (!P) { out.missing = (out.missing || 0) + 1; continue; }
          // reference: the pre-round method, one full flight with the same preview hole (mesh heights, no wind, no trees)
          const pb = new E.Ball(), ev = [], ph = T.PV.ph;
          pb.place(h, x, z);
          const sp = E.shotParams(E.CLUBS[club], 1, 0, lie, T.save().upg);
          pb.launch(sp.speed, sp.launch, G.aim, sp.spin, 0);
          let n = 0; while (pb.state === 'air' && !pb.landed && n < 4000) { ev.length = 0; pb.step(ph, E.DT * 2, ev); n++; }
          const err = Math.hypot(pb.x - P.x, pb.z - P.z);
          out.n++; if (err > out.maxErr) { out.maxErr = err; out.worst = { seed, x, z, club, lie, da, err, ref: [pb.x, pb.z, pb.state], got: [P.x, P.z] }; }
        }
      }
    }
    out.framesToReady = { max: Math.max(...out.frames), mean: out.frames.reduce((a, b) => a + b, 0) / out.frames.length };
    delete out.frames;
    return out;
  });
  r.errors = errs;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
