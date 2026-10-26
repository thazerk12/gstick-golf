// Round 6 Task 1: the page fills the window. Loads the game at 390x844 (DPR 3, like the iPhone), reads the size readout,
// then makes the window 62 px taller after load (the iPhone's status-bar height) and checks that #app, both canvases, the
// renderer and the game's own size follow with no gap. Then emulates display-mode: standalone and checks the round 6 CSS
// rule doesn't make the page scroll.
// usage: node test/screen6.js <page.html> <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/screen6';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'sc6.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const read = () => page.evaluate(() => {
    const T = window.__tempo, s = T.sizeInfo(), r = (id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom].map(Math.round); };
    const bottom = document.elementFromPoint(innerWidth / 2, innerHeight - 1);
    return Object.assign(s, { game: T.size(), glRect: r('gl'), fxRect: r('fx'), appRect: r('app'), fxCanvas: [document.getElementById('fx').width, document.getElementById('fx').height], bottomEl: bottom && (bottom.id || bottom.tagName), scrollH: document.documentElement.scrollHeight, scrollY: window.scrollY });
  });
  // the menu flyover renders every frame and headless SwiftShader is slow at DPR 3, which starves the resize steps; stop it
  await page.evaluate(() => { window.__tempo.G.manual = true; });
  const out = { load: await read() };
  const t0 = Date.now();
  await page.setViewportSize({ width: 390, height: 906 });
  await page.waitForFunction(() => window.__tempo.size().VH === 906, null, { timeout: 15000 }).catch(() => {});
  out.resizeMs = Date.now() - t0;
  await page.evaluate(() => window.__tempo.tick(0, true));
  out.taller = await read();
  await page.screenshot({ path: path.join(OUT, 'taller_390x906.png') });
  // display-mode: standalone (Chromium's media emulation)
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] }).catch(e => { out.emuError = e.message; });
  await page.waitForTimeout(300);
  out.standalone = await read();
  out.standaloneMatches = await page.evaluate(() => matchMedia('(display-mode: standalone)').matches);
  out.htmlMinHeight = await page.evaluate(() => getComputedStyle(document.documentElement).minHeight);
  await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
  out.scrollAfterWheel = await page.evaluate(() => [window.scrollY, document.documentElement.scrollTop]);
  // Chromium can't emulate display-mode: standalone or a status-bar inset, so apply the rule's body by hand with a 62 px top inset
  // and check the 100lvh cap: the document reaches the window's height and no more (no scrolling)
  await page.addStyleTag({ content: 'html { min-height: min(100lvh, calc(100% + 62px)) !important; }' });
  await page.waitForTimeout(200);
  out.ruleWith62 = await page.evaluate(() => { scrollTo(0, 500); return { minHeight: getComputedStyle(document.documentElement).minHeight, htmlH: document.documentElement.getBoundingClientRect().height, scrollH: document.documentElement.scrollHeight, inner: innerHeight, scrollY: window.scrollY }; });
  // the Perf readout: a round, Pause, Perf on (back at 390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => window.__tempo.size().VH === 844, null, { timeout: 15000 }).catch(() => {});
  out.readout = await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'perf-6', tier: 2, course: 0 }); T.G.manual = true; for (let i = 0; i < 30; i++) T.tick(1 / 60, false);
    document.getElementById('btnPause').click(); if (!T.save().settings.perf) document.getElementById('pPerf').click(); T.tick(0, true); const el = document.getElementById('sizeInfo'); return { shown: !el.hidden, text: el.textContent }; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'perf_readout_390x844.png'), timeout: 180000 });
  out.errors = errs;
  fs.writeFileSync(path.join(OUT, 'screen6.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
