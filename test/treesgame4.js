// Round 4 Task 3b in the game: full shots aimed into tree lines on the forest course; every tree event and every tree sound
// is logged with its time, so the sound spacing (at most one per 0.25 s) and the hits are checked through the game's own loop.
// usage: node test/treesgame4.js <page.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html'), OUTF = process.argv[3] || '/tmp/treesgame4.json';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(path.dirname(OUTF), 'tg_' + path.basename(SRC)); fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const res = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.startRound({ kind: 'quick', seed: 'trees-4', tier: 5, course: 3 });
    G.manual = true; sim.base = performance.now(); sim.on = true;
    let k = 0; const tick = () => { k++; sim.t = sim.base + k * 1000 / 60; T.tick(1 / 60, false); };
    for (let i = 0; i < 300; i++) tick();
    const snd = [], evs = []; const play0 = T.Snd.play;
    T.Snd.play = function (name, amt) { if (name === 'canopy' || name === 'trunk') snd.push([G.time, name]); return play0.call(this, name, amt); };
    const step0 = E.Ball.prototype.step;
    E.Ball.prototype.step = function (h, dt, ev) { const n = ev.length; step0.call(this, h, dt, ev); if (this === G.ball) for (let i = n; i < ev.length; i++) if (ev[i].type === 'tree') evs.push([G.time, this.t, ev[i].hard]); };
    const h = G.hole, out = [];
    const trees = h.trees.filter(t => t.cr > 0 && Math.hypot(t.x, t.z) > 40 && Math.hypot(t.x, t.z) < 150);
    for (let i = 0; i < 30 && i < trees.length; i++) {
      const t = trees[(i * 7) % trees.length];
      G.ball.place(h, 0, 0.6); G.ball.state = 'rest'; G.lie = h.surface(0, 0.6); G.mode = 'aim'; G.shot = null; G.dip = null; G.timeScale = 1; G.sinkS = null;
      // a club and power that bring the ball down through the canopy just past the trunk
      const d = Math.hypot(t.x, t.z - 0.6); let ci = 0; for (let c = 0; c < E.CLUBS.length - 1; c++) if (E.CLUBS[c].fullCarry >= d * 1.08) ci = c;
      G.club = ci; G.aim = Math.atan2(t.x, t.z - 0.6) + (((i * 37) % 11) - 5) * 0.003;
      const pw = Math.min(1, E.powerFor(E.CLUBS[ci], d * (1.02 + 0.02 * (i % 4))));
      const s0 = snd.length, e0 = evs.length;
      T.takeShot(pw, 0, 1);
      for (let j = 0; j < 60 * 12 && G.mode === 'flight'; j++) tick();
      for (let j = 0; j < 30; j++) tick();
      out.push({ i, club: E.CLUBS[G.club].id, treeDist: +d.toFixed(0), events: evs.length - e0, sounds: snd.length - s0 });
    }
    let minGap = Infinity; for (let i = 1; i < snd.length; i++) minGap = Math.min(minGap, snd[i][0] - snd[i - 1][0]);
    let minEvGap = Infinity; for (let i = 1; i < evs.length; i++) if (evs[i][1] > evs[i - 1][1]) minEvGap = Math.min(minEvGap, evs[i][1] - evs[i - 1][1]);
    return { shots: out, totalEvents: evs.length, totalSounds: snd.length, minSoundGapS: minGap, minEventGapBallS: minEvGap, shotsWithHits: out.filter(o => o.events).length };
  });
  fs.writeFileSync(OUTF, JSON.stringify({ errors: errs, res }));
  console.log('shots ' + res.shots.length + ', shots that hit a tree ' + res.shotsWithHits + ', tree events ' + res.totalEvents + ', tree sounds ' + res.totalSounds + ', min gap between tree sounds ' + res.minSoundGapS.toFixed(3) + ' s, min gap between tree events (ball time) ' + res.minEventGapBallS.toFixed(3) + ' s' + (errs.length ? ' errors: ' + errs.join(' | ') : ''));
  await browser.close();
})();
