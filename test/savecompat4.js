// Round 4 save compatibility: saves shaped like rounds 1, 2 and 3 (the round 3 one written by the round 3 build itself, with a
// round in progress) are loaded by the build under test. Every stored field must come back unchanged, Continue must resume
// the round at the right hole with the same scores, and nothing may throw. Fonts are blocked, as on a phone with no network.
// usage: node test/savecompat4.js <page.html> <round3-page.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), R3 = path.resolve(process.argv[3] || path.join(__dirname, '../baseline_r3/tempo-golf.html'));
const OUTF = process.argv[4] || '/tmp/savecompat4.json', DIR = path.dirname(OUTF);
async function open(browser, src, save) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  if (save) await page.addInitScript((s) => { localStorage.setItem('tempo-golf-v1', s); }, save);
  const f = path.join(DIR, 'sc4_' + path.basename(path.dirname(src)) + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(src, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  return page;
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const saves = {
    // round 1 shape: no guide, perf or shots fields
    r1: { coins: 420, upg: { power: 1, control: 0, spin: 0 }, events: { 't1-e1': { best: 1, stars: 1 } }, daily: {}, stats: { rounds: 2, hio: 0, eagles: 0, birdies: 3, longest: 231 },
      settings: { sound: true, units: 'yd' }, round: { def: { kind: 'quick', seed: 'r1-save', tier: 1, course: 0 }, scores: [5] }, seenHow: true },
    // round 2 shape: guide and shots, no perf
    r2: { coins: 1234, upg: { power: 2, control: 1, spin: 3 }, events: { 't1-e1': { best: -2, stars: 3 } }, daily: {}, stats: { rounds: 7, hio: 0, eagles: 1, birdies: 12, longest: 251 },
      settings: { sound: false, units: 'm', guide: false }, round: { def: { kind: 'quick', seed: 'old-save', tier: 3, course: 1 }, scores: [4, 5] }, seenHow: true, shots: 210 },
  };
  // round 3: written by the round 3 build (a quick round started there, then coins, upgrades and three holes of scores)
  {
    const page = await open(browser, R3, null);
    const raw = await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'r3-save', tier: 2, course: 2 }); return localStorage.getItem('tempo-golf-v1'); });
    const s = JSON.parse(raw); s.coins = 2468; s.upg = { power: 3, control: 2, spin: 1 }; s.settings.perf = true; s.settings.units = 'yd'; s.shots = 57;
    s.events = { 't1-e1': { best: -1, stars: 2 }, 't1-e2': { best: 0, stars: 1 } }; s.stats = Object.assign(s.stats, { rounds: 4, birdies: 6, longest: 244 });
    if (s.round) s.round.scores = [3, 4, 6];
    saves.r3 = s; saves.r3_written_by = 'round 3 build';
    await page.close();
  }
  const out = {};
  for (const k of ['r1', 'r2', 'r3']) {
    const str = JSON.stringify(saves[k]);
    for (const [tag, src] of [['under_test', SRC], ['round3_build', R3]]) {
      const page = await open(browser, src, str);
      const r = await page.evaluate((orig) => {
        const s = window.__tempo.save(), diff = [];
        const walk = (a, b, p) => { if (a && typeof a === 'object') { for (const key in a) walk(a[key], b ? b[key] : undefined, p + '.' + key); } else if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(p + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b)); };
        walk(orig, s, 'save');
        return { changedFields: diff, defaultsAdded: Object.keys(s.settings).filter(x => !(x in (orig.settings || {}))), continueShown: !document.getElementById('mContinue').hidden };
      }, saves[k]);
      await page.click('#mContinue');
      await page.waitForFunction(() => ['intro', 'aim'].includes(window.__tempo.G.mode), null, { timeout: 120000 });
      r.afterContinue = await page.evaluate(() => ({ mode: window.__tempo.G.mode, holeIdx: window.__tempo.G.holeIdx, scores: window.__tempo.G.scores, def: window.__tempo.G.def }));
      r.storedAfter = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tempo-golf-v1')); return { coins: s.coins, upg: s.upg, settings: s.settings, scores: s.round && s.round.scores }; });
      r.errors = page.errs;
      out[k + '_' + tag] = r; await page.close();
    }
    const a = out[k + '_under_test'], b = out[k + '_round3_build'];
    out[k + '_same_as_round3'] = JSON.stringify(a) === JSON.stringify(b);
    console.log(k, 'changed fields', a.changedFields.length, 'continue', a.afterContinue.mode, 'hole', a.afterContinue.holeIdx, 'scores', JSON.stringify(a.afterContinue.scores), 'errors', a.errors.length, 'identical to round 3 build:', out[k + '_same_as_round3']);
  }
  out.saves = saves;
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
  await browser.close();
})();
