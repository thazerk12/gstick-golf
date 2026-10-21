// Section timings under 6x CPU throttle at 390x844, DPR 2.
// usage: node test/perf.js <page.html> <out.json>
// Frames are driven by hand at a fixed 60 Hz (window.__tempo.tick) so every frame's JS work is captured;
// rendering is done every 4th frame (every frame around contact). Render time under swiftshader is not meaningful.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = process.argv[2], OUTF = process.argv[3];
const SCR = process.env.OUT || '/tmp';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'].concat(process.env.HEAP ? ['--enable-precise-memory-info'] : []) });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>';
  const f = SCR + '/perf_' + path.basename(SRC); fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  // hole load happens unthrottled-or-not, it is exempt; start the round, then throttle
  await page.evaluate(() => { const T = window.__tempo; T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'perf-a', tier: 4, course: 0 }); });
  const cdp = await ctx.newCDPSession(page);
  const RATE = +(process.env.RATE || 6);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await page.evaluate(() => {
    const T = window.__tempo; T.G.manual = true; T.PERF.on = true; T.PERF.log = [];
    window.__P = { ptr: 41 };
    window.__ev = (type, x, y) => {
      const e = new PointerEvent(type, { pointerId: window.__P.ptr, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' });
      (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(e);
    };
    // control: a fixed ~0.1 ms (unthrottled) workload timed every frame, to show what throttling alone does to a tiny section
    const work = (n) => { let x = 0; for (let i = 0; i < n; i++) x += Math.sin(i * 0.001) * Math.cos(i * 0.002); return x; };
    window.__ctl = []; window.__gc = []; window.__sink = 0;
    window.__run = (n, drawEvery, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); const t0 = performance.now(); window.__sink += work(6000); window.__ctl.push(performance.now() - t0); const m0 = performance.memory ? performance.memory.usedJSHeapSize : 0; T.tick(1 / 60, drawEvery > 0 && i % drawEvery === 0); window.__gc.push(performance.memory && performance.memory.usedJSHeapSize < m0 ? 1 : 0); } };
  });
  const phase = async (name, body) => { await page.evaluate((nm) => window.__tempo.PERF.log.push({ marker: nm }), name); await page.evaluate(body); };
  // skip the intro, settle at address
  await phase('intro', () => { const T = window.__tempo; T.G.timer = 9; window.__run(30, 4); });
  const progs0 = await page.evaluate(() => window.__tempo.renderer.info.programs.length);
  // aim: drag the aim every frame so the landing preview recomputes every frame
  await phase('aim', () => { const T = window.__tempo; window.__run(60, 4, () => { T.G.aim += 0.002; T.G.previewDirty = true; }); });
  const swing = (pullFrames, flickFrames) => {
    const T = window.__tempo, x = 195, y0 = 560, L = 250;
    window.__ev('pointerdown', x, y0);
    window.__run(pullFrames, 4, (i) => window.__ev('pointermove', x, y0 + L * (1 - Math.pow(1 - (i + 1) / pullFrames, 2))));
    window.__run(flickFrames + 4, 1, (i) => { if (i <= flickFrames) window.__ev('pointermove', x + i, y0 + L - (L + 40) * (i + 1) / flickFrames); if (i === flickFrames) window.__ev('pointerup', x + i, y0 - 40); });
  };
  await phase('swing1', `(${swing.toString()})(21, 9)`);
  await phase('contact1', () => window.__run(30, 1));
  const progs1 = await page.evaluate(() => window.__tempo.renderer.info.programs.length);
  await phase('flight1', () => { const T = window.__tempo; let n = 0; while (T.G.mode === 'flight' && n < 1500) { window.__run(1, n % 4 === 0 ? 1 : 0); n++; } });
  await phase('settle1', () => { const T = window.__tempo; let n = 0; while (T.G.mode !== 'aim' && n < 400) { window.__run(1, n % 4 === 0 ? 1 : 0); n++; } });
  await phase('nextshot1', () => window.__run(60, 4));
  await phase('aim2', () => { const T = window.__tempo; window.__run(30, 4, () => { T.G.aim += 0.002; T.G.previewDirty = true; }); });
  await phase('swing2', `(${swing.toString()})(18, 6)`);
  await phase('contact2', () => window.__run(30, 1));
  await phase('flight2', () => { const T = window.__tempo; let n = 0; while (T.G.mode === 'flight' && n < 1500) { window.__run(1, n % 4 === 0 ? 1 : 0); n++; } });
  await phase('settle2', () => { const T = window.__tempo; let n = 0; while (T.G.mode !== 'aim' && T.G.mode !== 'card' && n < 400) { window.__run(1, n % 4 === 0 ? 1 : 0); n++; } });
  await phase('nextshot2', () => window.__run(60, 4));
  // a putt from the green
  await phase('putt-setup', () => {
    const T = window.__tempo, G = T.G, h = G.hole;
    if (G.mode !== 'aim') return;
    G.ball.place(h, h.pin.x + 2.5, h.pin.z - 6); G.lie = 4; G.club = T.E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - G.ball.x, h.pin.z - G.ball.z); T.CV.phase = 'address';
    window.__run(40, 4);
  });
  await phase('putt', `(${swing.toString()})(15, 12)`);
  await phase('putt-roll', () => { const T = window.__tempo; let n = 0; while ((T.G.mode === 'flight' || T.G.mode === 'impact') && n < 900) { window.__run(1, n % 4 === 0 ? 1 : 0); n++; } });
  const progs2 = await page.evaluate(() => window.__tempo.renderer.info.programs.length);
  const log = await page.evaluate(() => window.__tempo.PERF.log);
  const ctl = await page.evaluate(() => window.__ctl);
  const gcs = await page.evaluate(() => window.__gc);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await browser.close();
  // summarise: worst per section per phase (render excluded from the 4 ms rule)
  const res = { rate: RATE, programs: { beforeFirstSwing: progs0, afterFirstContact: progs1, afterPutt: progs2 }, phases: {}, over4: [], dist: {}, errors: errs };
  const D = {};
  let ph = 'start', fi = -1;
  const TH = +(process.env.TH || 4);
  for (const r of log) {
    if (r.marker) { ph = r.marker; continue; }
    fi++;
    const P = res.phases[ph] = res.phases[ph] || { frames: 0, worst: {} };
    P.frames++;
    for (const k in r) {
      if (k === 'mode' || k === 'ms' || k === 'ts' || typeof r[k] !== 'number') continue;
      if (!(k in P.worst) || r[k] > P.worst[k]) P.worst[k] = r[k];
      if (r[k] > 0) (D[k] = D[k] || []).push(r[k]);
      if (k !== 'render' && r[k] > TH) res.over4.push({ phase: ph, mode: r.mode, section: k, ms: +r[k].toFixed(2), heapDropped: !!gcs[fi] });
    }
  }
  for (const p in res.phases) for (const k in res.phases[p].worst) res.phases[p].worst[k] = +res.phases[p].worst[k].toFixed(2);
  // per-section distribution over the frames where the section ran
  for (const k in D) { const v = D[k].sort((x, y) => x - y), q = (f) => +v[Math.min(v.length - 1, Math.floor(f * v.length))].toFixed(2); res.dist[k] = { n: v.length, med: q(0.5), p95: q(0.95), max: q(1), over4: v.filter(x => x > 4).length }; }
  { const v = ctl.slice().sort((x, y) => x - y), q = (f) => +v[Math.min(v.length - 1, Math.floor(f * v.length))].toFixed(2); res.control = { n: v.length, med: q(0.5), p95: q(0.95), max: q(1), over4: v.filter(x => x > 4).length }; }
  fs.writeFileSync(OUTF, JSON.stringify(res, null, 1));
  console.log(JSON.stringify({ programs: res.programs, over4count: res.over4.length, errors: errs }));
})();
