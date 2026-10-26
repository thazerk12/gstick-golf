// Round 6 save compatibility: saves from rounds 1-5 load in the build under test with the camera preset Standard.
// r1 and r2 are hand-shaped like those rounds' saves (as savecompat4.js); r3, r4 and r5 are written by those rounds' own builds
// (a quick round started there, then coins, upgrades and scores set). Every stored field must come back unchanged, the only
// new setting is cam = 'std', Continue must resume the round at the right hole with the same scores, the address camera must
// be Standard's, and nothing may throw. Fonts are blocked, as on a phone with no network.
// usage: node test/savecompat6.js <page.html> <out.json> r3=<round3 page> r4=<round4 page> r5=<round5 page>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/savecompat6.json', DIR = path.dirname(OUTF);
const OLD = Object.fromEntries(process.argv.slice(4).map(a => a.split('=')).map(([k, v]) => [k, path.resolve(v)]));
async function open(browser, src, save, tag) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  if (save) await page.addInitScript((s) => { localStorage.setItem('tempo-golf-v1', s); }, save);
  const f = path.join(DIR, 'sc6_' + tag + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(src, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  return page;
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const saves = {
    r1: { coins: 420, upg: { power: 1, control: 0, spin: 0 }, events: { 't1-e1': { best: 1, stars: 1 } }, daily: {}, stats: { rounds: 2, hio: 0, eagles: 0, birdies: 3, longest: 231 },
      settings: { sound: true, units: 'yd' }, round: { def: { kind: 'quick', seed: 'r1-save', tier: 1, course: 0 }, scores: [5] }, seenHow: true },
    r2: { coins: 1234, upg: { power: 2, control: 1, spin: 3 }, events: { 't1-e1': { best: -2, stars: 3 } }, daily: {}, stats: { rounds: 7, hio: 0, eagles: 1, birdies: 12, longest: 251 },
      settings: { sound: false, units: 'm', guide: false }, round: { def: { kind: 'quick', seed: 'old-save', tier: 3, course: 1 }, scores: [4, 5] }, seenHow: true, shots: 210 },
  };
  const written = {};
  for (const [k, src] of Object.entries(OLD)) {
    const page = await open(browser, src, null, 'w_' + k);
    const raw = await page.evaluate((k) => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: k + '-save', tier: 2, course: 2 }); return localStorage.getItem('tempo-golf-v1'); }, k);
    const s = JSON.parse(raw); s.coins = 2468 + k.length; s.upg = { power: 3, control: 2, spin: 1 }; s.settings.units = 'yd'; s.shots = 57;
    s.events = { 't1-e1': { best: -1, stars: 2 }, 't1-e2': { best: 0, stars: 1 } }; s.stats = Object.assign(s.stats, { rounds: 4, birdies: 6, longest: 244 });
    if (s.round) s.round.scores = [3, 4, 6];
    saves[k] = s; written[k] = { build: path.basename(src), settingsKeys: Object.keys(s.settings) };
    await page.close();
  }
  const out = { written };
  for (const k of Object.keys(saves)) {
    const str = JSON.stringify(saves[k]);
    const page = await open(browser, SRC, str, 'l_' + k);
    const r = await page.evaluate((orig) => {
      const T = window.__tempo, s = T.save(), diff = [];
      const walk = (a, b, p) => { if (a && typeof a === 'object') { for (const key in a) walk(a[key], b ? b[key] : undefined, p + '.' + key); } else if (JSON.stringify(a) !== JSON.stringify(b)) diff.push(p + ': ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b)); };
      walk(orig, s, 'save');
      return { changedFields: diff, settingsAdded: Object.keys(s.settings).filter(x => !(x in (orig.settings || {}))), cam: s.settings.cam, preset: T.camPreset ? T.camPreset() : null, continueShown: !document.getElementById('mContinue').hidden };
    }, saves[k]);
    await page.click('#mContinue');
    await page.waitForFunction(() => ['intro', 'aim'].includes(window.__tempo.G.mode), null, { timeout: 120000 });
    r.afterContinue = await page.evaluate(() => { const T = window.__tempo, G = T.G; G.manual = true; for (let i = 0; i < 400 && G.mode !== 'aim'; i++) { G.timer = 9; T.tick(1 / 60, false); } for (let i = 0; i < 90; i++) T.tick(1 / 60, false); const A = T.addrFor(G.club); return { mode: G.mode, holeIdx: G.holeIdx, scores: G.scores, def: G.def, preset: T.camPreset(), addrBack: +A.back.toFixed(3), camName: document.getElementById('camName').textContent }; });
    r.storedAfter = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('tempo-golf-v1')); return { coins: s.coins, upg: s.upg, settings: s.settings, scores: s.round && s.round.scores }; });
    r.errors = page.errs;
    out[k] = r; await page.close();
    console.log(k, 'changed fields', r.changedFields.length, 'settings added', JSON.stringify(r.settingsAdded), 'preset', r.preset, '| continue', r.afterContinue.mode, 'hole', r.afterContinue.holeIdx, 'scores', JSON.stringify(r.afterContinue.scores), 'camera', r.afterContinue.camName, r.afterContinue.addrBack, '| errors', r.errors.length);
  }
  out.saves = saves;
  fs.writeFileSync(OUTF, JSON.stringify(out, null, 1));
  await browser.close();
})();
