// Aim line on screen at address: project points on the target line (ball, +10, +30, +100 m along the aim) for every club
// and report their screen x; a vertical line has the same x for all of them.
// usage: node test/aimline4.js [page.html ...]   (default: the repo's tempo-golf.html)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs'), G0 = path.join(__dirname, '..'), os = require('os');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const src of (process.argv.length > 2 ? process.argv.slice(2).map(p => path.resolve(p)) : [G0 + '/tempo-golf.html'])) {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
    await page.route('**/three.min.js', r => r.fulfill({ path: G0 + '/three.min.js', contentType: 'application/javascript' }));
    await require(G0 + '/test/fontroute')(page);
    const f = path.join(os.tmpdir(), 'aim_' + Date.now() + '_') + path.basename(path.dirname(src)) + '.html';
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(src, 'utf8') + '</body></html>');
    await page.goto('file://' + f); await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    const r = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, E = T.E; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true;
      const h = G.hole, out = [];
      for (const ci of [0, 5, 11]) {
        let bx = 0, bz = 0.6; if (ci > 0) { const p = h.pointAtS(Math.min(h.len - 60, 230)); bx = p.x; bz = p.z; }
        G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = h.surface(bx, bz); G.club = ci; G.mode = 'aim'; G.map = false; G.swing = null; G.shot = null;
        G.aim = Math.atan2(h.pin.x - bx, h.pin.z - bz); G.camOrbit = null; T.setupClub(ci);
        for (let i = 0; i < 3; i++) { T.tick(1 / 60, false); T.snap(); } T.tick(1 / 60, true);
        const cam = T.camera, v = new THREE.Vector3(), dx = Math.sin(G.aim), dz = Math.cos(G.aim);
        const xs = [0, 10, 30, 100].map(d => { const x = bx + dx * d, z = bz + dz * d; v.set(x, h.height(x, z), z).project(cam); return [+((v.x * 0.5 + 0.5) * innerWidth).toFixed(1), +((0.5 - v.y * 0.5) * innerHeight).toFixed(1)]; });
        out.push({ club: E.CLUBS[ci].id, pts: xs });
      }
      return out;
    });
    console.log(path.basename(path.dirname(src)), JSON.stringify(r));
  }
  await browser.close();
})();
