// A whole tour event through the real screens (Tour list, hole intro, hole card, results), with frames stepped by hand
// at 60 Hz so it doesn't depend on how fast headless Chromium renders (test/round.js runs on the real frame loop).
// Each hole: the ball is placed near the pin and putted (in, or one more short putt). Fonts blocked.
// usage: OUT=<dir> node test/round4.js <page.html>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp', SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html'));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const logs = []; page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) logs.push(m.text()); });
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const f = path.join(OUT, 'round4_' + path.basename(path.dirname(SRC)) + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.G.manual = true; window.__sim.base = performance.now(); window.__sim.on = true; window.__k = 0;
    window.__until = (cond, max, draw) => { const T = window.__tempo; for (let i = 0; i < max; i++) { if (cond()) return i; window.__k++; window.__sim.t = window.__sim.base + window.__k * 1000 / 60; T.tick(1 / 60, !!draw && i % 30 === 0); } return cond() ? max : -1; }; });
  const until = (src, max) => page.evaluate(([src, max]) => window.__until(new Function('return (' + src + ')'), max), [src, max]);
  await page.click('#mTour'); await page.waitForTimeout(200);
  await page.click('#tourList .ev');
  const holes = [];
  for (let h = 0; h < 6; h++) {
    let n = await until("['intro','aim'].includes(window.__tempo.G.mode)", 1200);
    await page.evaluate(() => { window.__tempo.G.timer = 9; });
    n = await until("window.__tempo.G.mode === 'aim'", 1200);
    await page.evaluate((h) => {
      const T = window.__tempo, G = T.G, hole = G.hole, d = h === 2 ? 3.0 : 0.6;
      G.ball.place(hole, hole.pin.x, hole.pin.z - d); G.lie = 4; G.club = T.E.CLUBS.length - 1;
      G.aim = Math.atan2(hole.pin.x - G.ball.x, hole.pin.z - G.ball.z);
      G.strokes = hole.par - 2 + (h % 3);
      T.takeShot(T.puttPull ? T.puttPull(d + 0.25) : (d + 0.25) / T.E.puttMax(d), 0, 1);   // round 6: the game's putt curve
    }, h);
    const tIn = await until("['card','aim','settle'].includes(window.__tempo.G.mode) && window.__tempo.G.ball.state !== 'roll'", 3600);
    const st = await page.evaluate(() => ({ mode: window.__tempo.G.mode, scores: window.__tempo.G.scores.slice(), state: window.__tempo.G.ball.state }));
    let extra = false;
    if (st.mode !== 'card') {
      extra = true;
      await until("window.__tempo.G.mode === 'aim'", 1200);
      await page.evaluate(() => { const T = window.__tempo, G = T.G, hole = G.hole; G.ball.place(hole, hole.pin.x, hole.pin.z - 0.4); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(hole.pin.x - G.ball.x, hole.pin.z - G.ball.z); T.takeShot(T.puttPull ? T.puttPull(0.65) : 0.65 / T.E.puttMax(0.4), 0, 1); });
      await until("window.__tempo.G.mode === 'card'", 3600);
    }
    const fin = await page.evaluate(() => ({ mode: window.__tempo.G.mode, scores: window.__tempo.G.scores.slice(), cardShown: !document.getElementById('scrCard').hidden }));
    holes.push({ hole: h + 1, firstPutt: st, extraPutt: extra, framesToRest: tIn, after: fin });
    console.log('hole', h + 1, JSON.stringify(st), extra ? 'second putt' : '', '->', JSON.stringify(fin));
    if (h === 2) { await page.evaluate(() => window.__tempo.tick(1 / 60, true)); await page.screenshot({ path: OUT + '/round4_card.png' }); }
    await page.click('#cardNext');
  }
  await page.evaluate(() => window.__tempo.tick(1 / 60, true)); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/round4_results.png' });
  const sv = await page.evaluate(() => ({ resultsShown: !document.getElementById('scrResults').hidden, coins: window.__tempo.save().coins, events: window.__tempo.save().events, stats: window.__tempo.save().stats, round: window.__tempo.save().round }));
  console.log('save', JSON.stringify(sv));
  console.log('ERRORS', JSON.stringify(logs));
  fs.writeFileSync(path.join(OUT, 'round4_' + path.basename(path.dirname(SRC)) + '.json'), JSON.stringify({ holes, save: sv, errors: logs }, null, 1));
  await browser.close();
})();
