const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(path.join(__dirname, '../tempo-golf.html'), 'utf8') + '</body></html>';
  const f = OUT + '/page2.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; });
  await page.click('#mTour'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/r_tour.png' });
  await page.click('#tourList .ev');
  for (let h = 0; h < 6; h++) {
    await page.waitForFunction(() => ['intro', 'aim'].includes(window.__tempo.G.mode), null, { timeout: 60000 });
    await page.evaluate(() => { window.__tempo.G.timer = 9; });
    await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
    // place ball near pin and putt it in
    await page.evaluate((h) => {
      const T = window.__tempo, G = T.G, hole = G.hole;
      const d = h === 2 ? 3.0 : 0.6;
      G.ball.place(hole, hole.pin.x, hole.pin.z - d); G.lie = 4; G.club = T.E.CLUBS.length - 1;
      G.aim = Math.atan2(hole.pin.x - G.ball.x, hole.pin.z - G.ball.z);
      G.strokes = hole.par - 2 + (h % 3);
      const target = d + 0.25; const pw = T.puttPull ? T.puttPull(target) : target / T.E.puttMax(d);   // round 6: the game's putt curve
      T.takeShot(pw, 0, 1);
    }, h);
    await page.waitForFunction(() => ['card', 'aim', 'settle'].includes(window.__tempo.G.mode) && window.__tempo.G.ball.state !== 'roll', null, { timeout: 90000 });
    const st = await page.evaluate(() => ({ mode: window.__tempo.G.mode, scores: window.__tempo.G.scores, state: window.__tempo.G.ball.state }));
    console.log('hole', h + 1, JSON.stringify(st));
    if (st.mode !== 'card') {
      await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
      await page.evaluate(() => { const T = window.__tempo, G = T.G, hole = G.hole; G.ball.place(hole, hole.pin.x, hole.pin.z - 0.4); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(hole.pin.x - G.ball.x, hole.pin.z - G.ball.z); T.takeShot(T.puttPull ? T.puttPull(0.65) : 0.65 / T.E.puttMax(0.4), 0, 1); });
      await page.waitForFunction(() => window.__tempo.G.mode === 'card', null, { timeout: 90000 });
    }
    if (h === 2) await page.screenshot({ path: OUT + '/r_card.png' });
    await page.click('#cardNext');
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/r_results.png' });
  const sv = await page.evaluate(() => JSON.stringify({ coins: window.__tempo.save().coins, events: window.__tempo.save().events }));
  console.log('save', sv);
  console.log('ERRORS', logs.join('\n'));
  await browser.close();
})();
