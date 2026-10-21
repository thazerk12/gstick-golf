// Round 5 Task 1c: a club change moves the address camera on its spring (no snap). Per frame after the change: camera
// position (m from where it was), the step this frame (mm), FOV, and the ball's screen point. 390x844.
// usage: node test/clubspring5.js <page.html>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html'));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const f = '/tmp/cs5_' + process.pid + '.html';
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, E = T.E; T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'cs-5', tier: 2, course: 0 }); G.manual = true;
    for (let i = 0; i < 900 && G.mode !== 'aim'; i++) T.tick(1 / 60, false);
    const h = G.hole, p = h.pointAtS(Math.min(h.len - 60, 200)); G.ball.place(h, p.x, p.z); G.ball.state = 'rest'; G.lie = h.surface(p.x, p.z); G.aim = Math.atan2(h.pin.x - p.x, h.pin.z - p.z);
    const out = [];
    for (const [from, d] of [[0, 1], [5, 1], [9, -1]]) {
      G.club = from; T.setupClub(from); for (let i = 0; i < 120; i++) T.tick(1 / 60, false);
      const cam = T.camera, p0 = cam.position.clone(), rows = []; let prev = p0.clone(), maxStep = 0, firstStep = null, steps = [];
      document.getElementById(d > 0 ? 'clubNext' : 'clubPrev').click();
      for (let i = 0; i < 60; i++) { T.tick(1 / 60, false); const q = cam.position, st = q.distanceTo(prev); steps.push(+(st * 1000).toFixed(1)); maxStep = Math.max(maxStep, st); if (firstStep == null) firstStep = st; prev = q.clone(); }
      const b = T.ballScreen();
      out.push({ from: E.CLUBS[from].id, to: E.CLUBS[G.club].id, moveM: +cam.position.distanceTo(p0).toFixed(3), firstStepMm: +(firstStep * 1000).toFixed(1), maxStepMm: +(maxStep * 1000).toFixed(1), stepsMm: steps.slice(0, 20), fovEnd: +cam.fov.toFixed(2), ballEnd: b.map(v => +v.toFixed(1)) });
    }
    return out;
  });
  for (const o of r) console.log(JSON.stringify(o));
  await browser.close();
})();
