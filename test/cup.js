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
  const f = OUT + '/cup.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 120000 });
  await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'cup', tier: 2, course: 0 }); T.G.timer = 9; });
  await page.waitForFunction(() => window.__tempo.G.mode === 'aim', null, { timeout: 60000 });
  // empty cup, close look
  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, h = G.hole, V = T.cam.pos.constructor;
    G.ball.place(h, h.pin.x + 0.6, h.pin.z - 0.9); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z);
    G.freeCam = { pos: new V(h.pin.x - 0.35, h.pin.y + 0.32, h.pin.z - 0.45), look: new V(h.pin.x, h.pin.y - 0.03, h.pin.z) };
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/cup_empty.png' });
  // a short putt: hit it, then watch it drop with the free camera on the cup
  const r = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, h = G.hole, E = T.E;
    const d = Math.hypot(h.pin.x - G.ball.x, h.pin.z - G.ball.z);
    // flat-ground distance about 40 cm past the hole
    T.takeShot(T.puttPull ? T.puttPull(d + 0.4) : (d + 0.4) / E.puttMax(d), 0, 1);   // round 6: the game's putt curve
    return { d, mode: G.mode };
  });
  console.log('putt', JSON.stringify(r));
  const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < 60000) {
    const st = await page.evaluate(() => ({ s: window.__tempo.G.ball.state, m: window.__tempo.G.mode, x: window.__tempo.G.ball.x, z: window.__tempo.G.ball.z }));
    if (st.s === 'holed' || st.m !== 'flight') { console.log('state', JSON.stringify(st)); break; }
    if (k < 3) { await page.screenshot({ path: OUT + '/cup_roll' + k + '.png' }); k++; }
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(150); await page.screenshot({ path: OUT + '/cup_drop.png' });
  await page.waitForTimeout(1200); await page.screenshot({ path: OUT + '/cup_in.png' });
  await browser.close();
})();
