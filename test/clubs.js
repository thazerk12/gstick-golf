const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 560 } })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(path.join(__dirname, '../tempo-golf.html'), 'utf8') + '</body></html>';
  const f = OUT + '/c.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'clubs', tier: 3, course: 0 }); T.G.timer = 9; });
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
  for (const [ci, nm] of [[0, 'driver'], [5, 'iron'], [10, 'wedge'], [12, 'putter']]) {
    await page.evaluate((ci) => {
      const T = window.__tempo, G = T.G, b = G.ball;
      G.freeCam = null; G.club = ci; T.CV.phase = 'address'; T.CV.ci = -1; T.CV.shot = null;
    }, ci);
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const T = window.__tempo, G = T.G, b = G.ball, a = G.aim;
      const fx = Math.sin(a), fz = Math.cos(a), gx = Math.cos(a), gz = -Math.sin(a); // forward, golfer side
      // camera in front of the ball, slightly toward the golfer, looking back at the face
      const V = T.cam.pos.constructor;
      G.freeCam = { pos: new V(b.x + fx * 0.5 - gx * 0.32, b.y + 0.16, b.z + fz * 0.5 - gz * 0.32), look: new V(b.x + gx * 0.03 - fx * 0.05, b.y + 0.01, b.z + gz * 0.03 - fz * 0.05) };
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + '/club_' + nm + '.png' });
    await page.evaluate(() => {
      const T = window.__tempo, G = T.G, b = G.ball, a = G.aim;
      const fx = Math.sin(a), fz = Math.cos(a), gx = Math.cos(a), gz = -Math.sin(a);
      // down-the-line, close
      G.freeCam.pos.set(b.x - fx * 1.0 - gx * 0.15, b.y + 0.42, b.z - fz * 1.0 - gz * 0.15); G.freeCam.look.set(b.x + gx * 0.22, b.y + 0.12, b.z + gz * 0.22);
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + '/club_' + nm + '_dtl.png' });
  }
  await browser.close();
})();
