// Cost of the first takeShot's sound in a fresh session (Perf section 'Snd.play'), real clock, no throttling.
// Each run is a new page: the first touch is the swing itself (so audio starts and warms on that touch).
// usage: OUT=<dir> node test/firstshot.js <page.html> [runs]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp', SRC = process.argv[2], RUNS = +(process.argv[3] || 5);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const f = OUT + '/fs_' + path.basename(SRC);
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  const out = [];
  for (let run = 0; run < RUNS; run++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await page.route('**/fonts.*/**', r => r.abort());
    await page.goto('file://' + f);
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    const r = await page.evaluate((club) => {
      const T = window.__tempo, G = T.G;
      T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'fs', tier: 3, course: 0 });
      G.manual = true; G.timer = 9; for (let i = 0; i < 30; i++) T.tick(1 / 60, false);
      G.club = club; T.PERF.on = true; T.PERF.log = [];
      const ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 3, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
      const L = Math.min(300, Math.max(140, innerHeight * 0.3)), D = L * 0.9;
      ev('pointerdown', 195, 560);
      for (let i = 1; i <= 27; i++) { ev('pointermove', 195, 560 + D * (1 - Math.pow(1 - i / 27, 2))); T.tick(1 / 60, false); }
      for (let i = 1; i <= 30; i++) { if (G.swing) ev('pointermove', 195, 560 + D - D * Math.pow(i / 10, 2)); T.tick(1 / 60, false); }
      const rows = T.PERF.log.filter(x => x.takeShot > 0);
      return rows.length ? { takeShot: rows[0].takeShot, snd: rows[0]['Snd.play'] } : { error: 'no shot', mode: G.mode };
    }, run % 2 ? 5 : 0);
    out.push(r);
    await ctx.close();
  }
  console.log(JSON.stringify(out));
  await browser.close();
})();
