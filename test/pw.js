const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT;
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const vw = process.env.MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  const ctx = await browser.newContext({ viewport: vw, deviceScaleFactor: 1, hasTouch: !!process.env.MOBILE });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.route('**/fonts.gstatic.com/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(__dirname, '../tempo-golf.html'), 'utf8') + '</body></html>';
  fs.writeFileSync('/tmp/claude-0/-home-claude/f525806a-13a6-5a39-90e9-a7df13d9e40e/scratchpad/page.html', html);
  await page.goto('file:///tmp/claude-0/-home-claude/f525806a-13a6-5a39-90e9-a7df13d9e40e/scratchpad/page.html');
  await page.waitForTimeout(2500);
  const tag = process.env.MOBILE ? 'm_' : 'd_';
  await page.screenshot({ path: OUT + '/' + tag + '1menu.png' });
  await page.click('#mQuick');
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/' + tag + '2how.png' });
  await page.click('#howGo');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: OUT + '/' + tag + '3intro.png' });
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/' + tag + '4aim.png' });
  const st = await page.evaluate(() => { const G = window.__tempo.G; return { mode: G.mode, club: G.club, lie: G.lie, par: G.hole.par, len: G.hole.len, aim: G.aim }; });
  console.log('state', JSON.stringify(st));
  // swing: down then flick up
  const X = vw.width / 2, Y0 = vw.height * 0.62;
  await page.mouse.move(X, Y0); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(X, Y0 + i * (vw.height * 0.3 * 0.92) / 12); await page.waitForTimeout(16); }
  await page.waitForTimeout(150);
  await page.screenshot({ path: OUT + '/' + tag + '5swing.png' });
  for (let i = 1; i <= 6; i++) { await page.mouse.move(X + i * 1, Y0 + vw.height * 0.3 * 0.92 - i * (vw.height * 0.3) / 5); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: OUT + '/' + tag + '6flight.png' });
  const st2 = await page.evaluate(() => { const G = window.__tempo.G; return { mode: G.mode, strokes: G.strokes, ball: [G.ball.x, G.ball.y, G.ball.z, G.ball.state], shot: G.shot }; });
  console.log('flight', JSON.stringify(st2));
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + '/' + tag + '7landed.png' });
  const st3 = await page.evaluate(() => { const G = window.__tempo.G; return { mode: G.mode, strokes: G.strokes, lie: G.lie, ball: [G.ball.x.toFixed(1), G.ball.z.toFixed(1)], dist: Math.hypot(G.hole.pin.x - G.ball.x, G.hole.pin.z - G.ball.z).toFixed(1) }; });
  console.log('after', JSON.stringify(st3));
  // map view
  await page.click('#btnMap'); await page.waitForTimeout(5000);
  await page.screenshot({ path: OUT + '/' + tag + '8map.png' });
  await page.click('#btnMap'); await page.waitForTimeout(300);
  // teleport ball to green for putting view
  await page.evaluate(() => { const T = window.__tempo, G = T.G; const h = G.hole; G.ball.place(h, h.pin.x + 4, h.pin.z - 5); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: OUT + '/' + tag + '9putt.png' });
  const fps = await page.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); } requestAnimationFrame(f); }));
  console.log('fps(swiftshader)', fps);
  console.log('LOGS', logs.slice(0, 20).join('\n'));
  await browser.close();
})();
