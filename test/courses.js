const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(path.join(__dirname, '../tempo-golf.html'), 'utf8') + '</body></html>';
  const f = OUT + '/c.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__tempo.save().seenHow = true; });
  for (let c = 1; c < 4; c++) {
    await page.evaluate((c) => window.__tempo.startRound({ kind: 'quick', seed: 'sky' + c, tier: 4, course: c }), c);
    await page.waitForFunction(() => window.__tempo.G.mode === 'intro');
    await page.evaluate(() => { window.__tempo.G.timer = 9; });
    await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
    if (c === 2) await page.evaluate(() => { window.__tempo.G.club = 5; });
    if (c === 3) await page.evaluate(() => { const T = window.__tempo, G = T.G, h = G.hole; G.ball.place(h, h.pin.x + 2.5, h.pin.z - 4); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: OUT + '/c' + c + '.png' });
  }
  console.log('ERRORS', logs.join('\n') || 'none');
  await browser.close();
})();
