// Round 6 Task 2: gestures at 390x844 on the real game loop (simulated clock, synthetic touch dispatched to whatever element is
// under the finger, so the HUD's own hit-testing decides).
// 1. Gesture table: 14 press spots x 8 directions (60 px in 10 px steps): S = swing started, A = aim drag, - = nothing (a
//    button took the press). Plus the boundary (straight down +-30 deg / +-40 deg) and a tap with no movement.
// 2. Button taps still work: club arrows, map, pause, camera pill, look.
// 3. Power: 50% and 100% pulls started at 20%, 50%, 70% (and 85%: too low for a full pull) of the height, then flicked through.
// 4. Aim drag: 100 px over 300 ms (driver and putter), and one that stops before release: the aim at release and after the
//    coast, the ball's screen x over the drag and 1 s after, and when the coast stops.
// usage: node test/gest6.js <page.html> <out.json> [sections: table,buttons,power,aim]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/gest6.json';
const SECT = (process.argv[4] || 'table,buttons,power,aim').split(',');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(path.dirname(OUTF), 'g6_' + path.basename(path.dirname(SRC)) + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const res = await page.evaluate((SECT) => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim, out = { r6: !!T.gesture };
    T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'sim-b', tier: 4, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true; let k = 0;
    const tick = (n) => { for (let i = 0; i < n; i++) { k++; sim.t = sim.base + k * 1000 / 60; T.tick(1 / 60, false); } };
    // dispatch to the element under the point (pointerdown) or to the window (move / up), as a finger would
    const ev = (type, x, y, id) => { const tgt = type === 'pointerdown' ? (document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), Math.max(0, Math.min(innerHeight - 1, y))) || document.body) : window; tgt.dispatchEvent(new PointerEvent(type, { pointerId: id || 5, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' })); return tgt; };
    const tgtName = (el) => el.id || (el.className && el.className.baseVal == null ? el.className : el.tagName) || el.tagName;
    const ci7 = E.CLUBS.findIndex(c => c.id === '7I'), PT = E.CLUBS.length - 1;
    const putAt = (x, z, club, n) => {
      const h = G.hole; G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = club; G.strokes = 0;
      G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.swing = null; G.press = null; G.aimDrag = null; G.aimCoast = null; G.pendingShot = null; G.dip = null; G.shot = null; G.map = false; G.look = null; G.camYaw = null;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false }); if ('alphaT' in CV) CV.alphaT = 0;
      T.setupClub(club); tick(n || 90);
    };
    putAt(0, 0.6, 0, 240);
    const bs = T.ballScreen(); out.ball = bs.map(v => +v.toFixed(1)); out.swingLen = T.swingLen();
    const rect = (id) => { const r = (typeof id === 'string' ? document.getElementById(id) : id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2 }; };
    if (SECT.includes('table') && out.r6) {
      T.updateHUD && T.updateHUD(true); tick(2);
      const cards = [...document.querySelectorAll('#hudTop .card')].map(rect);
      const P = rect('btnPause'), CP = rect('clubPrev'), MP = rect('btnMap'), LK = rect('btnLook');
      const spots = [
        ['above ball', bs[0], bs[1] - 60], ['on ball', bs[0], bs[1]], ['below ball', bs[0], bs[1] + 60],
        ['lie card', cards[0].cx, cards[0].cy], ['pin card', cards[1].cx, cards[1].cy], ['wind card', cards[2].cx, cards[2].cy], ['hole card', cards[3].cx, cards[3].cy],
        ['left edge', 3, bs[1]], ['right edge', innerWidth - 3, bs[1] + 60], ['sky', innerWidth / 2, Math.round(innerHeight * 0.36)],
        ['near pause', P.cx, P.t - 14], ['near club arrow', (P.r + CP.l) / 2, CP.cy], ['near map', MP.cx, MP.t - 14], ['near look', LK.l - 16, LK.cy],
      ];
      const dirs = [['N', 0, -1], ['NE', 1, -1], ['E', 1, 0], ['SE', 1, 1], ['S', 0, 1], ['SW', -1, 1], ['W', -1, 0], ['NW', -1, -1]];
      const one = (x, y, ux, uy) => {
        const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
        const a0 = G.aim, tgt = ev('pointerdown', x, y); G.gesture = null;
        let swing = false;
        for (let i = 1; i <= 6; i++) { ev('pointermove', x + ux * 10 * i, y + uy * 10 * i); tick(1); if (G.swing || G.mode === 'swing') swing = true; }
        const g = G.gesture, aimed = Math.abs(G.aim - a0) > 1e-9;
        ev('pointerup', x + ux * 60, y + uy * 60); tick(1);
        const code = swing ? 'S' : g && g.kind === 'aim' ? 'A' : aimed ? 'A?' : '-';
        // restore
        G.aimCoast = null; G.aim = a0; G.swing = null; G.mode = 'aim'; G.camYaw = null; tick(30);
        return { code, target: tgtName(tgt), g: g && g.kind };
      };
      out.table = spots.map(([name, x, y]) => ({ name, x: Math.round(x), y: Math.round(y), cells: dirs.map(([d, ux, uy]) => Object.assign({ d }, one(x, y, ux, uy))) }));
      out.boundary = [];
      for (const deg of [-40, -35, -34, -30, 0, 30, 34, 35, 40]) { const r = deg * Math.PI / 180, c = one(bs[0], bs[1] + 40, Math.sin(r), Math.cos(r)); out.boundary.push({ deg, code: c.code }); }
      // a tap: press and release, no movement
      { const a0 = G.aim, c0 = G.club; ev('pointerdown', bs[0], bs[1] + 40); tick(3); ev('pointerup', bs[0], bs[1] + 40); tick(3); out.tap = { gesture: T.gesture(), aimChanged: G.aim !== a0, clubChanged: G.club !== c0, mode: G.mode }; }
    }
    if (SECT.includes('buttons') && out.r6) {
      const click = (id) => { const r = rect(id), el = document.elementFromPoint(r.cx, r.cy); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); tick(2); const b = el.closest ? el.closest('button') || el : el; return tgtName(b); };
      const b = {};
      let c0 = G.club; b.clubPrevHit = click('clubPrev'); b.clubPrev = G.club !== c0; G.club = c0; T.updateHUD && T.updateHUD(true);
      c0 = G.club; b.clubNextHit = click('clubNext'); b.clubNext = G.club !== c0; G.club = c0;
      b.mapHit = click('btnMap'); b.mapOn = G.map; click('btnMap'); b.mapOff = !G.map;
      const p0 = T.camPreset(); b.camHit = click('btnCam'); b.camCycled = [p0, T.camPreset()]; click('btnCam'); click('btnCam'); b.camBack = T.camPreset() === p0;
      b.lookHit = click('btnLook'); b.lookOn = !!T.look(); tick(70); click('btnLook'); tick(40); b.lookOff = !T.look();
      b.pauseHit = click('btnPause'); b.paused = G.paused; document.getElementById('pResume').click(); tick(2); b.resumed = !G.paused;
      out.buttons = b;
      tick(30);
    }
    if (SECT.includes('power')) {
      // pull p x swingLen straight down from y0, hold 100 ms, flick up through the start line; read the shot that fires
      const L = T.swingLen(), H = innerHeight;
      const pull = (y0, p) => {
        putAt(0, 0.6, ci7, 60);
        const D = L * p; let yBot = y0;
        ev('pointerdown', 195, y0);
        for (let i = 1; i <= 24; i++) { yBot = Math.min(H - 1, y0 + D * i / 24); ev('pointermove', 195, yBot); tick(1); }
        tick(6);
        const pw = G.swing ? G.swing.power : null;
        let shot = null;
        for (let i = 1; i <= 8; i++) { const y = yBot - (yBot - y0 + 30) * i / 8; ev('pointermove', 195, y); if (!shot && G.pendingShot) shot = { power: G.pendingShot.power, f: G.pendingShot.f }; tick(1); }
        ev('pointerup', 195, y0 - 30); tick(2);
        return { y0, want: p, pullPx: +(yBot - y0).toFixed(1), fits: y0 + D <= H - 1, powerAtBottom: pw, fired: shot };
      };
      out.power = [];
      for (const fr of [0.2, 0.5, 0.7, 0.85]) for (const p of [0.5, 1]) out.power.push(Object.assign({ startPct: fr * 100 }, pull(Math.round(H * fr), p)));
      putAt(0, 0.6, 0, 60);
    }
    if (SECT.includes('aim')) {
      // a drag of dx px over n frames, pressed at (x, y); optional still frames before release
      const drag = (club, dx, n, still) => {
        putAt(0, 0.6, club, 120);
        const a0 = G.aim, x0 = 120, y0 = Math.round(innerHeight * 0.36); let bx0 = T.ballScreen()[0], dev = 0;
        ev('pointerdown', x0, y0);
        for (let i = 1; i <= n; i++) { ev('pointermove', x0 + dx * i / n, y0); tick(1); dev = Math.max(dev, Math.abs(T.ballScreen()[0] - bx0)); }
        tick(still || 0);
        const atUp = G.aim - a0; ev('pointerup', x0 + dx, y0);
        const tUp = k; let last = G.aim, tStop = null;
        for (let i = 0; i < 60; i++) { tick(1); dev = Math.max(dev, Math.abs(T.ballScreen()[0] - bx0)); if (tStop == null && Math.abs(G.aim - last) < 1e-7) tStop = (k - 1 - tUp) / 60; last = G.aim; }
        return { club: E.CLUBS[club].id, dx, ms: Math.round(n * 1000 / 60), stillMs: Math.round((still || 0) * 1000 / 60), aimAtReleaseDeg: +(atUp * 180 / Math.PI).toFixed(3), aimFinalDeg: +((G.aim - a0) * 180 / Math.PI).toFixed(3), coastDeg: +((G.aim - a0 - atUp) * 180 / Math.PI).toFixed(3), coastStopS: tStop, ballXMaxDevPx: +dev.toFixed(3) };
      };
      out.aim = [drag(0, 100, 18), drag(0, -100, 18), drag(0, 100, 6), drag(0, 100, 18, 12), drag(ci7, 100, 18), drag(PT, 100, 18)];
    }
    return out;
  }, SECT);
  res.errors = errs;
  fs.writeFileSync(OUTF, JSON.stringify(res, null, 1));
  if (res.table) { console.log('spot'.padEnd(17) + ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map(d => d.padStart(4)).join('') + '   target'); for (const r of res.table) console.log(r.name.padEnd(17) + r.cells.map(c => c.code.padStart(4)).join('') + '   ' + r.cells[0].target); console.log('boundary', JSON.stringify(res.boundary)); console.log('tap', JSON.stringify(res.tap)); }
  if (res.buttons) console.log('buttons', JSON.stringify(res.buttons));
  if (res.power) for (const p of res.power) console.log('power', JSON.stringify(p));
  if (res.aim) for (const a of res.aim) console.log('aim', JSON.stringify(a));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
