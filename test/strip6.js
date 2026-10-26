// Round 6 Task 5: the flight strip and the distance label against the shot data, for 10 shots made with the real gesture at
// 390x844 (simulated clock, synthetic touch). Per shot: the strip's text right after contact against the shot (launch ball
// speed / smash -> mph, pull power, back angle beta, through angle phi, tempo), and at rest the label's distance against the
// ball's real distance from the start (yd). Shots vary club, power, the finger's sideways drift on the way down (back) and on
// the flick (through), and the upstroke time (a slow one for SLOW tempo); the last two are putts.
// usage: node test/strip6.js <page.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/strip6.json';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => { const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real()); });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(path.dirname(OUTF), 'st6.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const res = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'frame-4', tier: 2, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true; let k = 0;
    const tick = (n) => { for (let i = 0; i < n; i++) { k++; sim.t = sim.base + k * 1000 / 60; T.tick(1 / 60, false); } };
    const ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 5, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    const h = G.hole, ci = (id) => E.CLUBS.findIndex(c => c.id === id);
    const place = (club, s) => {
      let x = 0, z = 0.6;
      if (club === 'PT') { for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * s, pz = h.pin.z + Math.cos(t) * s; if (h.surface(px, pz) === E.S.GREEN) { x = px; z = pz; break; } } }
      else if (club !== 'DR') { const p = h.pointAtS(Math.max(30, h.len - s)); x = p.x; z = p.z; }
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = ci(club); G.strokes = 0; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.swing = null; G.press = null; G.shot = null; G.pendingShot = null; G.map = false; G.look = null; G.camYaw = null; G.camLock = false;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false }); T.setupClub(G.club); tick(1); T.snap(); tick(40);
    };
    // pull p of swingLen in 450 ms drifting bx px sideways, then flick up over up s drifting fx px
    const swing = (p, bx, up, fx) => {
      const L = T.swingLen(), x0 = 195, y0 = Math.round(T.chevronAt()[1]), D = L * p, n1 = 27, n2 = Math.max(2, Math.round(up * 60));
      ev('pointerdown', x0, y0);
      for (let i = 1; i <= n1; i++) { const q = 1 - Math.pow(1 - i / n1, 2); ev('pointermove', x0 + bx * q, y0 + D * q); tick(1); }
      let ps = null;
      for (let i = 1; i <= n2 + 4; i++) { const q = Math.min(1.2, Math.pow(i / n2, 2)); ev('pointermove', x0 + bx + fx * q, y0 + D - (D + 20) * q); if (!ps && G.pendingShot) ps = Object.assign({}, G.pendingShot, { phi: G.phi, beta: G.beta }); tick(1); if (G.mode === 'flight') break; }
      ev('pointerup', x0 + bx + fx, y0 - 20);
      for (let i = 0; i < 30 && G.mode !== 'flight'; i++) tick(1);
      return ps;
    };
    const strip = () => [...document.querySelectorAll('#hudStats .card')].filter(e => !e.hidden).map(e => [e.querySelector('.sl').textContent, e.querySelector('b').textContent]);
    const cases = [['DR', 0, 1.0, 0, 0.2, 0], ['DR', 0, 0.85, 25, 0.2, -15], ['3W', 230, 0.9, -20, 0.2, 10], ['5I', 170, 1.0, 0, 0.55, 0], ['7I', 150, 0.75, 10, 0.2, 25], ['9I', 120, 1.05, -10, 0.2, -20], ['PW', 90, 0.6, 0, 0.3, 5], ['SW', 60, 0.5, 15, 0.2, 0], ['PT', 6, 0.35, 0, 0.3, 4], ['PT', 12, 0.55, 0, 0.6, -6]];
    const out = [];
    for (const [club, s, p, bx, up, fx] of cases) {
      place(club, s);
      const ps = swing(p, bx, up, fx);
      tick(2);
      const st = T.stats(), sh = G.shot, txt = strip(), isP = club === 'PT';
      const c = E.CLUBS[G.club], smash = isP ? null : T.smashFor(c);
      const want = isP ? { power: T.fmtFt(T.puttRoll(ps.power)), through: ps.phi } : { speed: Math.round(st.ball * 2.23694 / smash), power: Math.round(ps.power * 100), back: ps.beta, through: ps.phi, tempo: ps.tempoMul < 0.96 ? 'SLOW' : 'OK' };
      for (let i = 0; i < 1500 && G.mode === 'flight'; i++) tick(1);
      tick(10);
      const b = G.ball, total = Math.hypot(b.x - sh.sx, b.z - sh.sz), L = T.distLabel();
      out.push({ club, pull: p, upS: up, driftBack: bx, driftThrough: fx, strip: txt, shot: { ballMs: st.ball && +st.ball.toFixed(2), smash, tempoMul: ps.tempoMul, power: +ps.power.toFixed(3), beta: ps.beta == null ? null : +ps.beta.toFixed(1), phi: ps.phi == null ? null : +ps.phi.toFixed(1) }, want,
        rest: { mode: G.mode, pending: !!G.pending, state: b.state, toast: document.getElementById('tQ').textContent, label: L && L.text, totalM: +total.toFixed(2), totalYd: +(total * E.M2YD).toFixed(2), totalFt: +(total * 3.2808).toFixed(2), labelA: L && +L.a.toFixed(2) } });
      tick(120);
    }
    return out;
  });
  fs.writeFileSync(OUTF, JSON.stringify({ shots: res, errors: errs }, null, 1));
  for (const r of res) console.log(JSON.stringify([r.club, r.strip.map(s => s.join(' ')).join(' | '), r.want, r.shot.tempoMul, 'rest:', r.rest.label, r.club === 'PT' ? r.rest.totalFt + ' ft' : r.rest.totalYd + ' yd']));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
