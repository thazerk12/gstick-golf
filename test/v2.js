const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const vw = { width: 1280, height: 800 };
  const page = await (await browser.newContext({ viewport: vw })).newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(path.join(__dirname, '../tempo-golf.html'), 'utf8') + '</body></html>';
  const f = OUT + '/v2.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => { window.__tempo.save().seenHow = true; });
  const course = +(process.env.COURSE || 0);
  await page.evaluate((c) => { const T = window.__tempo; T.startRound({ kind: 'quick', seed: 'v2test' + c, tier: 3, course: c }); }, course);
  await page.waitForFunction(() => window.__tempo.G.mode === 'intro');
  await page.evaluate(() => { window.__tempo.G.timer = 9; });
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
  await page.waitForTimeout(400); await page.evaluate(() => window.__tempo.snap()); await page.waitForTimeout(1500); await page.evaluate(() => window.__tempo.snap()); await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/v2_address.png' });
  const X = 640, Y0 = 520, L = Math.max(140, Math.min(300, 800 * 0.3));
  await page.mouse.move(X, Y0); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(X, Y0 + i * L * 0.5 / 10); await page.waitForTimeout(30); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v2_back50.png' });
  for (let i = 1; i <= 10; i++) { await page.mouse.move(X, Y0 + L * 0.5 + i * L * 0.45 / 10); await page.waitForTimeout(30); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v2_top.png' });
  const drift = +(process.env.DRIFT || 50);
  // downswing in two halves
  for (let i = 1; i <= 3; i++) { await page.mouse.move(X + drift * i / 6, Y0 + L * 0.95 - i * L * 0.95 / 6); await page.waitForTimeout(16); }
  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/v2_down.png' });
  for (let i = 4; i <= 7; i++) { await page.mouse.move(X + drift * i / 6, Y0 + L * 0.95 - i * L * 0.95 / 6); await page.waitForTimeout(16); }
  await page.mouse.up();
  const m1 = await page.evaluate(() => window.__tempo.G.mode + ' ' + window.__tempo.CV.phase);
  console.log('right after release:', m1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/v2_follow.png' });
  const a = await page.evaluate(() => { const G = window.__tempo.G; return { mode: G.mode, label: G.shot && G.shot.label, dev: G.shot && G.shot.dev, aim: G.aim }; });
  console.log('after impact', JSON.stringify(a));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT + '/v2_flight.png' });
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim' || window.__tempo.G.mode === 'settle', null, { timeout: 120000 });
  const r = await page.evaluate(() => { const G = window.__tempo.G, s = G.shot, b = G.ball; const a = Math.atan2(G.hole.pin.x - s.sx, G.hole.pin.z - s.sz);
    const lx = (b.x - s.sx) * Math.cos(s.aim0 || 0) - (b.z - s.sz) * Math.sin(s.aim0 || 0);
    return { label: s.label, dev: s.dev, bx: b.x, bz: b.z, sx: s.sx, sz: s.sz }; });
  const aim = a.aim;
  const lat = (r.bx - r.sx) * Math.cos(aim) - (r.bz - r.sz) * Math.sin(aim);
  console.log('result', r.label, 'dev', r.dev.toFixed(2), 'lateral (+ = left of aim line):', lat.toFixed(1), 'm');
  // look up at the sky
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/v2_second.png' });
  console.log('ERRORS', logs.join('\n'));
  await browser.close();
})();
