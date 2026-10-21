// A save written by the previous build (no settings.perf, a round in progress) must load as it is.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp', SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const old = { coins: 1234, upg: { power: 2, control: 1, spin: 3 }, events: { 't1-e1': { best: -2, stars: 3 } }, daily: {}, stats: { rounds: 7, hio: 0, eagles: 1, birdies: 12, longest: 251 },
    settings: { sound: false, units: 'm', guide: false }, round: { def: { kind: 'quick', seed: 'old-save', tier: 3, course: 1 }, scores: [4, 5] }, seenHow: true, shots: 210 };
  await page.addInitScript((s) => { localStorage.setItem('tempo-golf-v1', JSON.stringify(s)); }, old);
  const f = OUT + '/sc.html'; fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const r = await page.evaluate(() => { const s = window.__tempo.save(); return { coins: s.coins, upg: s.upg, events: s.events, stats: s.stats, settings: s.settings, round: s.round, perfOn: window.__tempo.PERF.on, perfHidden: document.getElementById('perf').hidden, continueShown: !document.getElementById('mContinue').hidden }; });
  await page.click('#mContinue');
  await page.waitForFunction(() => ['intro', 'aim'].includes(window.__tempo.G.mode), null, { timeout: 120000 });
  r.afterContinue = await page.evaluate(() => ({ mode: window.__tempo.G.mode, holeIdx: window.__tempo.G.holeIdx, scores: window.__tempo.G.scores }));
  r.stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tempo-golf-v1')).settings);
  r.errors = errs;
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
