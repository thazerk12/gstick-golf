const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT;
const W = +(process.env.W || 1280), H = +(process.env.H || 800);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(path.join(__dirname, '../tempo-golf.html'), 'utf8') + '</body></html>';
  const f = OUT + '/v.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 120000 });
  const shots = (process.env.SHOTS || 'address').split(',');
  const course = +(process.env.COURSE || 0), tier = +(process.env.TIER || 3);
  const tag = process.env.TAG || 'v';
  const settle = async (ms) => { await page.waitForTimeout(400); await page.evaluate(() => window.__tempo.snap()); await page.waitForTimeout(ms || 900); await page.evaluate(() => window.__tempo.snap()); await page.waitForTimeout(500); };
  if (shots.includes('menu')) { await page.evaluate(() => window.__tempo.snap()); await page.waitForTimeout(1500); await page.screenshot({ path: OUT + '/' + tag + '_menu.png' }); }
  await page.evaluate(([c, t]) => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'views' + c, tier: t, course: c }); }, [course, tier]);
  await page.evaluate(() => { window.__tempo.G.timer = 9; });
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
  await settle();
  if (shots.includes('address')) await page.screenshot({ path: OUT + '/' + tag + '_address.png' });
  if (shots.includes('iron')) {
    await page.evaluate(() => { const G = window.__tempo.G; G.club = 6; });
    await settle(); await page.screenshot({ path: OUT + '/' + tag + '_iron.png' });
  }
  if (shots.includes('poses')) {
    // freeze the club at a few swing poses
    for (const [nm, a, b] of [['p_back', 80, 55], ['p_top', 150, 95], ['p_down', 60, 80], ['p_impact', 0, 0], ['p_fin', -150, -92]]) {
      await page.evaluate(([a, b]) => { const T = window.__tempo; T.G.club = 0; T.CV.phase = 'pose'; T.CV.a = a; T.CV.b = b; }, [a, b]);
      await page.waitForTimeout(700);
      await page.screenshot({ path: OUT + '/' + tag + '_' + nm + '.png' });
    }
    await page.evaluate(() => { window.__tempo.CV.phase = 'address'; });
  }
  if (shots.includes('rough')) {
    await page.evaluate(() => {
      const T = window.__tempo, G = T.G, h = G.hole;
      const p = h.pointAtS(Math.min(200, h.len * 0.6)), off = h.fwHalf(Math.min(200, h.len * 0.6)) + 7;
      G.ball.place(h, p.x + p.nx * off, p.z + p.nz * off); G.lie = h.surface(G.ball.x, G.ball.z); G.club = 6;
      G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); T.CV.ci = -1; T.buildTufts(G.ball.x, G.ball.z, Math.sin(G.aim), Math.cos(G.aim));
    });
    await settle(1200); await page.screenshot({ path: OUT + '/' + tag + '_rough.png' });
  }
  if (shots.includes('green')) {
    await page.evaluate(() => { const T = window.__tempo, G = T.G, h = G.hole; G.ball.place(h, h.pin.x + 1.5, h.pin.z - 3.5); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); T.CV.phase = 'address'; });
    await settle(1200); await page.screenshot({ path: OUT + '/' + tag + '_green.png' });
  }
  if (shots.includes('cup')) {
    await page.evaluate(() => { const T = window.__tempo, G = T.G, h = G.hole; G.ball.place(h, h.pin.x + 0.04, h.pin.z - 0.25); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); });
    await settle(1200); await page.screenshot({ path: OUT + '/' + tag + '_cup.png' });
  }
  if (shots.includes('fly')) {
    await page.evaluate(() => { const T = window.__tempo, G = T.G, h = G.hole; T.cam.tPos.set(h.green.x * 0.3 - 30, h.pin.y + 45, h.len * 0.25); T.cam.tLook.set(h.green.x * 0.7, h.pin.y, h.len * 0.75); G.paused = true; });
    await page.evaluate(() => { const T = window.__tempo; T.cam.k = 0; T.cam.pos.copy(T.cam.tPos); T.cam.look.copy(T.cam.tLook); });
    await page.waitForTimeout(1200); await page.screenshot({ path: OUT + '/' + tag + '_fly.png' });
  }
  console.log('LOGS\n' + logs.slice(0, 30).join('\n'));
  await browser.close();
})();
