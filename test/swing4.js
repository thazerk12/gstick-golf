// Round 4 swing checks on the real game loop: frames stepped by hand at the touch rate (60 or 120 Hz), simulated clock,
// synthetic touch with whole-pixel finger steps. Thumb: ease-out pull to 99% over 450 ms, optional hold, then an upstroke
// accelerating from rest (finger y ∝ t²) that reaches the start line after T ms and keeps going; optional sideways drift.
// The upstroke's start is swept across the frame grid. Logs per frame: club angles, time scale, ball (drawn and physics).
// usage: node test/swing4.js <page.html> <out.json> [hz]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html');
const OUTF = process.argv[3] || '/tmp/swing4.json';
const HZ = +(process.argv[4] || 60);
const OUT = path.dirname(OUTF);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const real = performance.now.bind(performance);
    window.__sim = { on: false, t: 0 };
    performance.now = () => (window.__sim.on ? window.__sim.t : real());
  });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>';
  const f = OUT + '/s4_' + HZ + '_' + path.basename(path.dirname(path.resolve(SRC))) + '.html'; fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  if (process.env.Y0) await page.evaluate((y) => { window.__Y0 = y; }, +process.env.Y0);
  // Y0FROM=<an earlier result file>: the same start line per run as that build used (round 5's zone moved it per run)
  if (process.env.Y0FROM) await page.evaluate((l) => { window.__Y0L = l; }, JSON.parse(fs.readFileSync(process.env.Y0FROM, 'utf8')).results.map(r => r.y0));
  const res = await page.evaluate((HZ) => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true;
    T.startRound({ kind: 'quick', seed: 'sim-b', tier: 4, course: 0 });
    G.manual = true;
    sim.base = performance.now(); sim.on = true; sim.t = sim.base;
    const FD = 1 / HZ;
    const X = 195, L = T.swingLen ? T.swingLen() : Math.min(300, Math.max(140, innerHeight * 0.3));   // round 5: the game's own swingLen
    let Y0 = 560;   // round 5: the press must land in the swing zone below the ball (set per run once the ball is placed)
    const R = { k: 0, frame0: 0, inLoop: false, j: 0, ts: 1, sub: null, hitT: null };
    // round 5: the shaft's 240 Hz substeps (as swing2.js) for the flip timing: CV.bend per substep and the contact time
    let bendV = CV.bend, hitV = CV.hit;
    Object.defineProperty(CV, 'hit', { configurable: true, get: () => hitV, set: (v) => {
      hitV = v;
      if (v === false) { R.inLoop = true; R.j = 0; R.ts = G.timeScale; }
      else if (R.inLoop && R.hitT == null) R.hitT = R.frame0 + Math.min((R.j + 1) / 240, FD * R.ts) / R.ts;
    } });
    Object.defineProperty(CV, 'bend', { configurable: true, get: () => bendV, set: (v) => {
      bendV = v;
      if (R.inLoop && R.sub) { R.j++; const t = R.frame0 + Math.min(R.j / 240, FD * R.ts) / R.ts; R.sub.push([t, v]); }
    } });
    const ev = (type, x, y, tSec) => {
      sim.t = sim.base + tSec * 1000;
      (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    };
    const frames = [];
    const frame = () => {
      R.k++; const Tk = R.k * FD;
      sim.t = sim.base + Tk * 1000; R.frame0 = Tk - FD; R.inLoop = false;
      const b = G.ball, bx = b.x, bz = b.z;
      T.tick(FD, false); R.inLoop = false;
      const st = T.state();
      const row = { t: Tk, mode: G.mode, phase: CV.phase, a: CV.a, b: CV.b, ts: G.timeScale, moved: bx !== b.x || bz !== b.z, bd: [G.bd.x, G.bd.y, G.bd.z], bp: [b.x, b.y, b.z], tau: st.tau, Test: st.Test, alpha: CV.alpha };
      frames.push(row); return row;
    };
    const now = () => R.k * FD;
    const putAt = (x, z, club) => {
      const h = G.hole; G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = club; G.strokes = 0;
      G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.swing = null; G.pendingShot = null; G.dip = null; G.shot = null; G.timeScale = 1;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
      if ('alphaT' in CV) CV.alphaT = 0;
      for (let i = 0; i < 40; i++) frame();
    };
    const run = (o) => {
      const D = Math.round(L * 0.99), Tup = o.T / 1000;
      const t0 = now() + FD - (o.phase || 0) / 1000, tP = t0 + 0.45, tH = tP + (o.hold || 0) / 1000;
      const yAt = (t) => t <= t0 ? Y0 : t <= tP ? Y0 + D * (1 - Math.pow(1 - (t - t0) / 0.45, 2)) : t <= tH ? Y0 + D : Y0 + D - D * Math.pow((t - tH) / Tup, 2);
      const xAt = (t) => X + (t <= tH ? 0 : (o.drift || 0) * Math.min(1.3, (t - tH) / Tup));
      const tCross = tH + Tup;
      frames.length = 0; R.sub = []; R.hitT = null;
      const out = { tCross, tRev: null, tFire: null, shot: null, tBall: null, fBall: null };
      let down = false, k = 0, mx = 0;
      while (k < 900) {
        const ts = now() + FD;
        if (!down && ts >= t0) { ev('pointerdown', X, Y0, ts); down = true; }
        else if (down && (G.swing || G.press) && ts > t0) {   // round 6: a press is decided after 10 px of movement
          const before = G.mode, y = Math.round(yAt(ts)), x = Math.round(xAt(ts));
          ev('pointermove', x, y, ts);
          if (y - Y0 > mx) mx = y - Y0;
          if (out.tRev == null && mx > 10 && mx - (y - Y0) >= 3) out.tRev = ts;
          if (before === 'swing' && G.mode === 'impact') { out.tFire = ts; out.shot = Object.assign({}, G.pendingShot); }
          if (G.swing && ts > tCross + 0.1) ev('pointerup', x, y, ts);
        }
        const r = frame(); k++;
        if (r.moved && out.tBall == null) { out.tBall = r.t; out.fBall = frames.length - 1; }
        if (out.tBall != null && r.t > out.tBall + 0.8) break;
      }
      out.frames = frames.slice();
      // the shaft's + to - crossing nearest contact (ms from contact), and the largest bend
      const sub = R.sub, tc = R.hitT; R.sub = null; out.flipMs = null; out.peakBendMm = 0;
      for (let i = 1; i < sub.length; i++) { if (Math.abs(sub[i][1]) > Math.abs(out.peakBendMm) / 1000) out.peakBendMm = sub[i][1] * 1000;
        if (tc != null && sub[i - 1][1] > 0 && sub[i][1] <= 0) { const tz = sub[i - 1][0] + (sub[i][0] - sub[i - 1][0]) * sub[i - 1][1] / (sub[i - 1][1] - sub[i][1]); const d = (tz - tc) * 1000; if (out.flipMs == null || Math.abs(d) < Math.abs(out.flipMs)) out.flipMs = d; } }
      return out;
    };
    const i7 = E.CLUBS.findIndex(c => c.id === '7I');
    const results = [];
    let runIdx = 0;
    const cases = [];
    for (const [name, ci] of [['driver', 0], ['7-iron', i7]]) for (const [T, hold, drift] of [[120, 0, 0], [200, 0, 0], [300, 0, 0], [200, 500, 0], [200, 0, 20], [200, 0, -50]]) for (let ph = 0; ph < 1000 / HZ - 1e-6; ph += 2) cases.push([name, ci, T, hold, drift, ph]);
    for (const [name, ci, Tup, hold, drift, phase] of cases) {
      R.k = Math.round(3000 * HZ / 60) * (++runIdx);   // the same clock times in every build, so the finger samples are bit-identical
      putAt(0, 0.6, ci);
      { const TT = window.__tempo; if (window.__Y0L) Y0 = window.__Y0L[runIdx - 1]; else if (window.__Y0) Y0 = window.__Y0; else if (TT.swingZone) Y0 = Math.max(560, Math.ceil(TT.swingZone().top) + 8); }   // round 6: Y0=<px> forces the start line (the same finger path in every build)
      const o = run({ T: Tup, hold, phase, drift });
      const fr = o.frames;
      results.push({ club: name, T: Tup, hold, drift, phase, y0: Y0, flipMs: o.flipMs, peakBendMm: o.peakBendMm, tRev: o.tRev, tFire: o.tFire, tCross: o.tCross, tBall: o.tBall, fBall: o.fBall, shot: o.shot, aTop: Math.max(...fr.map(r => r.a)),
        frames: fr.map(r => [+r.t.toFixed(6), r.mode, r.phase, +r.a.toFixed(4), +r.b.toFixed(4), +r.ts.toFixed(5), r.moved ? 1 : 0, r.bd.map(v => +v.toFixed(5)), r.tau == null ? null : +r.tau.toFixed(5), r.Test == null ? null : +r.Test.toFixed(5), +r.alpha.toFixed(5)]) });
      for (let i = 0; i < 20; i++) frame();
    }
    return results;
  }, HZ);
  fs.writeFileSync(OUTF, JSON.stringify({ hz: HZ, errors: errs, results: res }));
  console.log('wrote ' + OUTF + ' runs ' + res.length + (errs.length ? ' errors: ' + errs.join(' | ') : ''));
  const fl = res.map(r => r.flipMs).filter(x => x != null);
  console.log('flip within 20 ms of contact: ' + fl.filter(x => Math.abs(x) <= 20).length + '/' + res.length + (fl.length ? ', range ' + Math.min(...fl).toFixed(1) + '..' + Math.max(...fl).toFixed(1) + ' ms' : '') + '; peak bend driver ' + Math.max(0, ...res.filter(r => r.club === 'driver').map(r => Math.abs(r.peakBendMm))).toFixed(1) + ' mm, 7-iron ' + Math.max(0, ...res.filter(r => r.club === '7-iron').map(r => Math.abs(r.peakBendMm))).toFixed(1) + ' mm (in plane)');
  await browser.close();
})();
