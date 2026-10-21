// Draw calls over one frame with the ball at rest in the rough and on the fairway, at the address and settle cameras.
// usage: node test/calls4.js [page.html ...]   (default: the repo's tempo-golf.html)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs'), G0 = path.join(__dirname, '..'), os = require('os');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const src of (process.argv.length > 2 ? process.argv.slice(2).map(p => path.resolve(p)) : [G0 + '/tempo-golf.html'])) {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
    await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
    await page.route('**/three.min.js', r => r.fulfill({ path: G0 + '/three.min.js', contentType: 'application/javascript' }));
    await require(G0 + '/test/fontroute')(page);
    const f = path.join(os.tmpdir(), 'calls_' + Date.now() + '_') + path.basename(path.dirname(src)) + '.html';
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(src, 'utf8') + '</body></html>');
    await page.goto('file://' + f); await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    const r = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, E = T.E; T.save().seenHow = true; T.save().shots = 99; T.startRound({ kind: 'quick', seed: 'rgh-4', tier: 2, course: 0 }); G.manual = true; window.__sim.base = performance.now(); window.__sim.on = true;
      let k = 0; const tick = (n, d) => { for (let i = 0; i < n; i++) { k++; window.__sim.t = window.__sim.base + k * 1000 / 60; T.tick(1 / 60, d && i === n - 1); } };
      tick(240, false); const h = G.hole, ren = T.renderer;
      const p = h.pointAtS(200); let rx, rz; for (let o = h.fwHalf(200) + 4; o < h.fwHalf(200) + 20; o += 0.5) { const x = p.x + p.nx * o, z = p.z + p.nz * o; if (h.surface(x, z) === E.S.ROUGH) { rx = x; rz = z; break; } }
      const out = {};
      for (const [name, x, z] of [['rough', rx, rz], ['fairway', p.x, p.z]]) for (const mode of ['aim', 'settle']) {
        G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = 5; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.swing = null; G.shot = null;
        if (T.lieDecal) T.lieDecal(x, z); else T.buildTufts(x, z);
        if (mode === 'settle') { G.mode = 'settle'; G.timer = 1e9; G.shot = { club: '7I', putt: false, sx: x - Math.sin(G.aim) * 120, sz: z - Math.cos(G.aim) * 120, lie: 1, power: 1, dev: 0, landed: true, carry: 120, label: '' }; } else { G.mode = 'aim'; T.setupClub(5); }
        T.snap(); tick(40, false); T.snap(); tick(2, false);
        ren.info.autoReset = false; ren.info.reset(); tick(1, true); out[name + '_' + mode] = ren.info.render.calls; ren.info.autoReset = true;
      }
      return out;
    });
    console.log(path.basename(path.dirname(src)), JSON.stringify(r));
  }
  await browser.close();
})();
