// Round 2 swing checks on the real game loop (frames stepped by hand at 60 Hz, simulated clock, synthetic touch).
// Thumb: ease-out pull to 99% power over 450 ms, optional hold, then an upstroke accelerating from rest with
// finger y ∝ t² that reaches the start line after T ms (and keeps going). Finger samples land on frame times;
// the start of the upstroke is swept across the 60 Hz grid. The club's 240 Hz substeps are logged through CV.bend.
// usage: OUT=<dir> node test/swing2.js <page.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp';
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html');
const OUTF = process.argv[3] || OUT + '/swing2.json';
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
  await page.route('**/fonts.*/**', r => r.abort());
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>';
  const f = OUT + '/s2_' + path.basename(SRC); fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  if (process.env.FEEL) await page.evaluate((j) => { const F = window.__tempo.FEEL, o = JSON.parse(j); for (const k in o) { if (typeof o[k] === 'object' && !Array.isArray(o[k])) { for (const q in o[k]) { if (typeof o[k][q] === 'object') Object.assign(F[k][q], o[k][q]); else F[k][q] = o[k][q]; } } else F[k] = o[k]; } }, process.env.FEEL);

  if (process.env.TRACE) await page.evaluate((t) => { const p = t.split(','); window.__TR = [p[0], +p[1], +p[2], +p[3]]; }, process.env.TRACE);
  const res = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true;
    T.startRound({ kind: 'quick', seed: 'sim-b', tier: 4, course: 0 });
    G.manual = true;
    sim.base = performance.now(); sim.on = true; sim.t = sim.base;
    const X = 195, L = T.swingLen ? T.swingLen() : Math.min(300, Math.max(140, innerHeight * 0.3));   // round 5: the game's own swingLen
    let Y0 = 560;   // round 5: the press must land in the swing zone below the ball (set per run once the ball is placed)
    let bendV = CV.bend, hitV = CV.hit;
    const R = { k: 0, frame0: 0, inLoop: false, j: 0, ts: 1, sub: null, hitT: null };
    Object.defineProperty(CV, 'hit', { configurable: true, get: () => hitV, set: (v) => {
      hitV = v;
      if (v === false) { R.inLoop = true; R.j = 0; R.ts = G.timeScale; }
      else if (R.inLoop && R.hitT == null) R.hitT = R.frame0 + Math.min((R.j + 1) / 240, (1 / 60) * R.ts) / R.ts;
    } });
    Object.defineProperty(CV, 'bend', { configurable: true, get: () => bendV, set: (v) => {
      bendV = v;
      if (R.inLoop && R.sub) { R.j++; const t = R.frame0 + Math.min(R.j / 240, (1 / 60) * R.ts) / R.ts; R.sub.push([t, CV.phase, CV.a, CV.b, v]); }
    } });
    const ev = (type, x, y, tSec) => {
      sim.t = sim.base + tSec * 1000;
      (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    };
    const frames = [];
    const frame = () => {
      R.k++; const Tk = R.k / 60;
      sim.t = sim.base + Tk * 1000; R.frame0 = Tk - 1 / 60; R.inLoop = false;
      const b = G.ball, bx = b.x, bz = b.z;
      T.tick(1 / 60, false); R.inLoop = false;
      const row = { t: Tk, mode: G.mode, phase: CV.phase, a: CV.a, b: CV.b, moved: bx !== b.x || bz !== b.z };
      frames.push(row); return row;
    };
    const now = () => R.k / 60;
    const putAt = (x, z, club) => {
      const h = G.hole; G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = club; G.strokes = 0;
      G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.swing = null; G.pendingShot = null; G.dip = null; G.shot = null;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
      for (let i = 0; i < 40; i++) frame();
    };
    const run = (o) => {
      const D = L * 0.99, Tup = o.T / 1000;
      const t0 = now() + 1 / 60 - (o.phase || 0) / 1000, tP = t0 + 0.45, tH = tP + (o.hold || 0) / 1000;
      const yAt = (t) => t <= t0 ? Y0 : t <= tP ? Y0 + D * (1 - Math.pow(1 - (t - t0) / 0.45, 2)) : t <= tH ? Y0 + D : Y0 + D - D * Math.pow((t - tH) / Tup, 2);
      const tCross = tH + Tup;
      R.sub = []; R.hitT = null; frames.length = 0;
      const out = { tCross, tRev: null, tFire: null, shot: null, gap: null, tBall: null };
      let down = false, k = 0, mx = 0;
      while (k < 600) {
        const ts = now() + 1 / 60;
        if (!down && ts >= t0) { ev('pointerdown', X, Y0, t0); down = true; }
        else if (down && G.swing && ts > t0) {
          const before = G.mode, y = yAt(ts);
          ev('pointermove', X, y, ts);
          // the 3 px reversal sample, found from the finger path itself so it is the same for every build
          if (y - Y0 > mx) mx = y - Y0;
          if (out.tRev == null && mx > 10 && mx - (y - Y0) >= 3) out.tRev = ts;
          if (before === 'swing' && G.mode === 'impact') { out.tFire = ts; out.shot = Object.assign({}, G.pendingShot); out.gap = CV.aS; }
          if (G.swing && ts > tCross + 0.1) ev('pointerup', X, yAt(ts), ts);
        }
        const r = frame(); k++;
        if (r.moved && out.tBall == null) out.tBall = r.t;
        if (out.tBall != null && r.t > out.tBall + 1.8) break;
      }
      out.tContact = R.hitT;
      out.sub = R.sub; R.sub = null;
      out.frames = frames.slice();
      return out;
    };
    const i7 = E.CLUBS.findIndex(c => c.id === '7I');
    const results = [];
    let runIdx = 0;
    for (const [name, ci] of [['driver', 0], ['7-iron', i7]]) for (const [T, hold] of [[120, 0], [200, 0], [300, 0], [200, 500]]) for (const phase of [0, 4, 8, 12, 16]) {
      R.k = 3000 * (++runIdx);   // every run starts at the same clock time in every build, so finger samples are bit-identical
      putAt(0, 0.6, ci);
      { const TT = window.__tempo; if (TT.swingZone) Y0 = Math.max(560, Math.ceil(TT.swingZone().top) + 8); }   // (T is the upstroke time inside this loop)
      const o = run({ T, hold, phase });
      const sub = o.sub, tc = o.tContact;
      if (tc == null || o.tRev == null) { results.push({ club: name, T, hold, phase, error: 'no contact or no reversal', tRev: o.tRev, tFire: o.tFire, tCross: o.tCross, tBall: o.tBall, nsub: sub.length, lastFrames: o.frames.slice(-3), mode: G.mode }); for (let i = 0; i < 20; i++) frame(); continue; }
      // top: highest arm angle from the reversal sample to contact
      let iTop = -1, aTop = -1e9;
      for (let i = 0; i < sub.length; i++) if (sub[i][0] >= (o.tRev || 0) - 0.05 && sub[i][0] <= tc && sub[i][2] > aTop) { aTop = sub[i][2]; iTop = i; }
      const tTop = sub[iTop][0];
      // starts down: first substep after the 3 px sample where the arm angle is 0.5 deg below its highest value since that sample
      let hi = -1e9, tDown = null; for (const q of sub) { if (q[0] < o.tRev) continue; hi = Math.max(hi, q[2]); if (q[2] < hi - 0.5) { tDown = q[0]; break; } }
      // per-substep velocity of a and of a+b from the reversal sample to contact
      const vel = [];
      for (let i = 1; i < sub.length; i++) if (sub[i][0] >= o.tRev && sub[i][0] <= tc) vel.push([sub[i][0], (sub[i][2] - sub[i - 1][2]) / (sub[i][0] - sub[i - 1][0]), (sub[i][2] + sub[i][3] - sub[i - 1][2] - sub[i - 1][3]) / (sub[i][0] - sub[i - 1][0])]);
      const flipsAt = []; const signs = (j) => { let n = 0, prev = 0; for (const v of vel) { const sg = Math.abs(v[j]) < 1e-6 ? 0 : Math.sign(v[j]); if (sg && prev && sg !== prev) { n++; if (j === 1) flipsAt.push(+((v[0] - tc) * 1000).toFixed(1)); } if (sg) prev = sg; } return n; };
      // per-frame club speed (a+b) between the top and contact; longest run of frames under 20 deg/s
      const fr = o.frames.filter(r => r.t >= tTop && r.t <= tc + 1e-9);
      let slow = 0, worst = 0;
      for (let i = 1; i < fr.length; i++) { const sp = Math.abs((fr[i].a + fr[i].b - fr[i - 1].a - fr[i - 1].b) / (fr[i].t - fr[i - 1].t)); if (sp < 20) { slow++; worst = Math.max(worst, slow); } else slow = 0; }
      // shaft: the + to - crossing nearest contact
      let flip = null;
      for (let i = 1; i < sub.length; i++) if (sub[i - 1][4] > 0 && sub[i][4] <= 0) { const tz = sub[i - 1][0] + (sub[i][0] - sub[i - 1][0]) * sub[i - 1][4] / (sub[i - 1][4] - sub[i][4]); const dtc = tz - tc; if (flip == null || Math.abs(dtc) < Math.abs(flip)) flip = dtc; }
      // dwell: how long the club sits within 2% of the top angle of the ball before contact (a fast, continuous swing passes it in a few ms)
      let tNear = null; for (const s of sub) if (s[0] > tTop && s[0] <= tc && s[2] < 0.02 * aTop) { tNear = s[0]; break; }
      const dwellMs = tNear == null ? 0 : (tc - tNear) * 1000;
      let pk = 0; for (const s of sub) if (Math.abs(s[4]) > Math.abs(pk)) pk = s[4];
      const iFin = sub.findIndex(s => s[1] === 'finish'), tFin = iFin >= 0 ? sub[iFin][0] : null;
      let settle = 0; if (tFin != null) for (const s of sub) if (s[0] >= tFin + 0.6) settle = Math.max(settle, Math.abs(s[4]));
      results.push({ club: name, T, hold, phase,
        leaveTopMs: (tTop - o.tRev) * 1000, startsDownMs: tDown == null ? null : (tDown - o.tRev) * 1000, revAfterUpstrokeMs: (o.tRev - (o.tCross - T / 1000)) * 1000,
        aTop, gapDeg: o.gap, leftPct: 100 * o.gap / aTop,
        signChangesA: signs(1), signChangesAB: signs(2), flipsAt, longestSlowFrames: worst,
        flipMs: flip == null ? null : flip * 1000, dwellMs, peakBendMm: pk * 1000, settleMm: settle * 1000,
        crossToBallMs: (o.tBall - o.tCross) * 1000, shot: o.shot,
        trace: (window.__TR ? (name === window.__TR[0] && T === window.__TR[1] && hold === window.__TR[2] && phase === window.__TR[3]) : (phase === 0 && hold === 0 && T === 200)) ? sub.filter((s, i) => i % 2 === 0 && s[0] >= o.tRev - 0.1 && s[0] <= tc + 0.25).map(s => [+((s[0] - tc) * 1000).toFixed(1), s[1].slice(0, 3), +s[2].toFixed(1), +s[3].toFixed(1), +(s[4] * 1000).toFixed(1)]) : undefined });
      for (let i = 0; i < 20; i++) frame();
    }
    return results;
  });
  fs.writeFileSync(OUTF, JSON.stringify({ errors: errs, results: res }, null, 1));
  console.log('wrote ' + OUTF + (errs.length ? ' errors: ' + errs.join(' | ') : ''));
  await browser.close();
})();
