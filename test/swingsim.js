// Swing feel checks on the real game loop.
// Frames are driven by hand (window.__tempo.tick) at 60 Hz with a simulated clock (performance.now is patched),
// and the finger is synthetic PointerEvents sampled once per frame. The club's 240 Hz substeps are logged by
// watching CV.bend (written once per substep) and CV.hit (reset at the start of each frame's substep loop).
// usage: OUT=<dir> node test/swingsim.js [page.html] [out.json]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp';
const SRC = process.argv[2] || path.join(__dirname, '../tempo-golf.html');
const OUTF = process.argv[3] || OUT + '/swingsim.json';

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
  const f = OUT + '/sim_' + path.basename(SRC); fs.writeFileSync(f, html);
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });

  await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim;
    T.save().seenHow = true;
    T.startRound({ kind: 'quick', seed: 'sim-b', tier: 4, course: 0 });
    G.manual = true;
    sim.base = performance.now(); sim.on = true; sim.t = sim.base;
    const X = 195, Y0 = 560;
    const L = Math.min(300, Math.max(140, innerHeight * 0.3));
    // substep probe
    let bendV = CV.bend, hitV = CV.hit;
    const R = { k: 0, frame0: 0, inLoop: false, j: 0, ts: 1, sub: null, frames: null, hitT: null, onFrame: null };
    Object.defineProperty(CV, 'hit', { configurable: true, get: () => hitV, set: (v) => {
      hitV = v;
      if (v === false) { R.inLoop = true; R.j = 0; R.ts = G.timeScale; }
      else if (R.inLoop && R.hitT == null) R.hitT = R.frame0 + Math.min((R.j + 1) / 240, (1 / 60) * R.ts) / R.ts;
    } });
    Object.defineProperty(CV, 'bend', { configurable: true, get: () => bendV, set: (v) => {
      bendV = v;
      if (R.inLoop && R.sub) { R.j++; const t = R.frame0 + Math.min(R.j / 240, (1 / 60) * R.ts) / R.ts; R.sub.push([t, CV.phase, CV.a, CV.b, v, R.ts]); }
    } });
    const ev = (type, x, y, tSec) => {
      sim.t = sim.base + tSec * 1000;
      const e = new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' });
      (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(e);
    };
    // one frame at rAF time T_k; its update covers (T_k - 1/60, T_k]
    const frame = () => {
      R.k++; const Tk = R.k / 60;
      sim.t = sim.base + Tk * 1000;
      R.frame0 = Tk - 1 / 60; R.inLoop = false;
      const b = G.ball, bx = b.x, by = b.y, bz = b.z;
      T.tick(1 / 60, false);
      R.inLoop = false;
      const moved = bx !== b.x || by !== b.y || bz !== b.z;
      const h = G.hole;
      const row = { t: Tk, mode: G.mode, phase: CV.phase, ts: G.timeScale, a: CV.a, b: CV.b, bend: CV.bend, moved, st: b.state,
        landed: !!(G.shot && G.shot.landed), hag: b.y - E.BALL_R - h.height(b.x, b.z), dPin: Math.hypot(b.x - h.pin.x, b.z - h.pin.z),
        ballScale: G.ballScale, cap: G.ballCap, flag: G.flagScale };
      if (R.frames) R.frames.push(row);
      return row;
    };
    const now = () => R.k / 60;
    const putAt = (x, z, club) => {
      const h = G.hole;
      G.ball.place(h, x, z); G.ball.state = 'rest';
      G.lie = h.surface(x, z); G.club = club;
      G.aim = Math.atan2(h.pin.x - x, h.pin.z - z);
      G.strokes = 0; G.mode = 'aim'; G.swing = null; G.pendingShot = null; G.dip = null; G.shot = null; if (G.bprev) G.bprev.ok = false;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false });
      G.previewDirty = true;
      for (let i = 0; i < 40; i++) frame();
    };
    const ease = { easeOut: k => 1 - (1 - k) * (1 - k), linear: k => k };
    // o: { power, pullMs, holdMs, hold: 'none'|'jitter', flickMs, phase (ms the samples lead the frame), over (px past the line), prof }
    const swing = (o) => {
      const D = L * o.power, over = o.over == null ? 40 : o.over, prof = ease[o.prof || 'easeOut'];
      const t0 = now() + 1 / 60 - (o.phase || 0) / 1000;      // finger lands o.phase ms before the next frame's sample
      const tP = t0 + o.pullMs / 1000, tH = tP + (o.holdMs || 0) / 1000, tF = tH + o.flickMs / 1000;
      const yAt = (t) => t <= t0 ? Y0 : t <= tP ? Y0 + D * prof((t - t0) / (tP - t0)) : t <= tH ? Y0 + D : Y0 + D - (D + over) * Math.min(1, (t - tH) / (tF - tH));
      const tCross = tH + (tF - tH) * D / (D + over);
      const out = { tCross, tFire: null, tempoMul: null, label: null, aTop: CV.spec ? CV.spec.aTop : null };
      let down = false, k = 0, aAtBottom = null, aAtSwitch = null, targ = null;
      R.hitT = null;
      while (k < 400) {
        const Tk = now() + 1 / 60, ts = Tk;   // finger samples land on frame times (60 Hz)
        if (!down && ts >= t0) { ev('pointerdown', X, Y0, t0); down = true; }
        else if (down && G.swing && ts > t0) {
          const hold = ts > tP && ts <= tH;
          if (!(hold && o.hold === 'none')) {
            const y = yAt(ts) - (hold && o.hold === 'jitter' ? (k & 1) : 0);
            const before = G.mode;
            ev('pointermove', X, y, ts);
            if (before === 'swing' && G.mode === 'impact') { out.tFire = ts; out.tempoMul = G.pendingShot ? G.pendingShot.tempoMul : null; }
          }
          if (ts > tF + 0.05 && G.swing) ev('pointerup', X, yAt(ts), ts);
        }
        const r = frame(); k++;
        if (targ == null && CV.spec) targ = Math.min(G.swing ? G.swing.power : o.power, 1.12) * CV.spec.aTop;
        if (aAtBottom == null && r.t >= tP) aAtBottom = CV.a;
        if (aAtSwitch == null && (CV.phase === 'down' || CV.phase === 'commit')) aAtSwitch = CV.aS;
        if (r.moved && out.tBall == null) { out.tBall = r.t; break; }
      }
      out.tContact = R.hitT;
      out.label = G.shot ? G.shot.label : null;
      out.targetDeg = o.power * (CV.spec ? CV.spec.aTop : 0);
      out.aAtBottom = aAtBottom; out.aAtSwitch = aAtSwitch;
      return out;
    };
    const runOn = (n, stop) => { for (let i = 0; i < n; i++) { const r = frame(); if (stop && stop(r)) return r; } return null; };
    window.__S = { T, G, CV, E, R, frame, putAt, swing, runOn, now, L };
  });

  const res = { L: await page.evaluate(() => window.__S.L), errors: errs };
  const PARTS = (process.env.PARTS || 'latency,timeScale,backswing,flex,tempo,scale').split(',');
  const want = (k) => PARTS.includes(k);
  // FEEL='{"commit":{"max":0.032}}' overrides tuning values for a run
  if (process.env.FEEL) await page.evaluate((j) => { const F = window.__tempo.FEEL, o = JSON.parse(j); for (const k in o) { if (typeof o[k] === 'object') Object.assign(F[k], o[k]); else F[k] = o[k]; } }, process.env.FEEL);

  // ---------- T2: finger-cross to ball-moving, downswing speed profile, time-scale log ----------
  if (want('latency')) res.latency = await page.evaluate(() => {
    const { G, E, R, putAt, swing, runOn } = window.__S;
    const h = G.hole, rows = [];
    const spot7 = (() => { let best = null; for (const p of h.pts) { const d = Math.hypot(p.x - h.pin.x, p.z - h.pin.z); if (!best || Math.abs(d - 140) < Math.abs(best.d - 140)) best = { x: p.x, z: p.z, d }; } return best; })();
    const clubs = [['driver', 0, 0, 0.6], ['7-iron', E.CLUBS.findIndex(c => c.id === '7I'), spot7.x, spot7.z]];
    for (const [name, ci, x, z] of clubs) for (const flick of [80, 150, 250]) for (const phase of [0, 4, 8, 12, 16]) {
      putAt(x, z, ci);
      R.sub = [];
      const o = swing({ power: 0.99, pullMs: 450, holdMs: 0, flickMs: flick, phase });
      // downswing speed: first vs last 30% of the time from the club's transition to contact (a+b, deg/s)
      const sub = R.sub, i0 = sub.findIndex(s => s[1] === 'down' || s[1] === 'commit');
      let ratio = null, ratioA = null, dsMs = null;
      if (i0 >= 0 && o.tContact) {
        const t0 = sub[i0][0], tc = o.tContact, D = tc - t0;
        const at = (t, f) => { for (let i = 1; i < sub.length; i++) if (sub[i][0] >= t) { const p = sub[i - 1], q = sub[i], u = (t - p[0]) / (q[0] - p[0] || 1); return f(p) + (f(q) - f(p)) * u; } return f(sub[sub.length - 1]); };
        const th = s => s[2] + s[3], aa = s => s[2];
        const first = (th(sub[i0]) - at(t0 + 0.3 * D, th)) / (0.3 * D), last = (at(tc - 0.3 * D, th) - at(tc, th)) / (0.3 * D);
        const firstA = (aa(sub[i0]) - at(t0 + 0.3 * D, aa)) / (0.3 * D), lastA = (at(tc - 0.3 * D, aa) - at(tc, aa)) / (0.3 * D);
        ratio = last / first; ratioA = lastA / firstA; dsMs = D * 1000;
        rows.push({ club: name, flickMs: flick, phaseMs: phase, crossToSampleMs: (o.tFire - o.tCross) * 1000, commitMs: (sub.filter(s => s[1] === 'commit').length + 1) / 240 * 1000,
          crossToBallFrameMs: (o.tBall - o.tCross) * 1000, downswingMs: dsMs, speedFirst30: first, speedLast30: last, ratio, ratioArmOnly: ratioA,
          tempoMul: o.tempoMul, label: o.label, backswingAtSwitchPct: 100 * o.aAtSwitch / o.targetDeg });
      } else rows.push({ club: name, flickMs: flick, phaseMs: phase, error: 'no contact', o });
      R.sub = null;
      runOn(30);
    }
    return rows;
  });

  // time-scale log through a full driver and a full 7-iron (150 ms flick)
  if (want('timeScale')) res.timeScale = await page.evaluate(() => {
    const { G, E, R, putAt, swing, runOn } = window.__S;
    const out = {};
    for (const [name, ci] of [['driver', 0], ['7-iron', E.CLUBS.findIndex(c => c.id === '7I')]]) {
      putAt(0, 0.6, ci);
      R.frames = [];
      const o = swing({ power: 0.99, pullMs: 450, flickMs: 150 });
      runOn(30);
      const fr = R.frames; R.frames = null;
      const ic = fr.findIndex(r => r.t >= o.tBall);
      out[name] = { contactFrameT: o.tBall, log: fr.slice(Math.max(0, ic - 2), ic + 24).map(r => [+((r.t - o.tBall) * 1000).toFixed(1), +r.ts.toFixed(3), r.mode]) };
      runOn(20);
    }
    return out;
  });

  // ---------- T3a: backswing reach on a 350 ms full pull ----------
  if (want('backswing')) res.backswing = await page.evaluate(() => {
    const { G, E, R, putAt, swing, runOn } = window.__S;
    const rows = [];
    for (const [name, ci] of [['driver', 0], ['7-iron', E.CLUBS.findIndex(c => c.id === '7I')]]) for (const prof of ['easeOut', 'linear']) {
      putAt(0, 0.6, ci);
      const o = swing({ power: 0.99, pullMs: 350, flickMs: 150, prof });
      rows.push({ club: name, pull: prof + ' 350 ms', atFingerBottomPct: +(100 * o.aAtBottom / o.targetDeg).toFixed(1), atTransitionPct: +(100 * o.aAtSwitch / o.targetDeg).toFixed(1) });
      runOn(40);
    }
    return rows;
  });

  // ---------- T3b: shaft flex over full swings ----------
  if (want('flex')) res.flex = await page.evaluate(() => {
    const { G, E, R, CV, putAt, swing, runOn } = window.__S;
    const out = {};
    const set = [['driver', 0], ['3-wood', 1], ['hybrid', 2], ['7-iron', E.CLUBS.findIndex(c => c.id === '7I')], ['PW', E.CLUBS.findIndex(c => c.id === 'PW')], ['SW', E.CLUBS.findIndex(c => c.id === 'SW')], ['putter', E.CLUBS.length - 1]];
    for (const [name, ci] of set) for (const flick of [80, 150, 250]) {
      if (name !== 'driver' && flick !== 150) continue;
      putAt(0, 0.6, ci);
      R.sub = [];
      const o = swing({ power: name === 'putter' ? 0.5 : 0.99, pullMs: 450, flickMs: name === 'putter' ? 400 : flick });
      runOn(160);
      const sub = R.sub; R.sub = null;
      let pk = 0, pkT = 0, pkPh = '';
      for (const s of sub) if (Math.abs(s[4]) > Math.abs(pk)) { pk = s[4]; pkT = s[0]; pkPh = s[1]; }
      const iFin = sub.findIndex(s => s[1] === 'finish');
      const tFin = iFin >= 0 ? sub[iFin][0] : null;
      let after06 = null, maxAfter06 = 0;
      if (tFin != null) for (const s of sub) if (s[0] >= tFin + 0.6) { if (after06 == null) after06 = s[4]; maxAfter06 = Math.max(maxAfter06, Math.abs(s[4])); }
      const iDown = sub.findIndex(s => s[1] === 'down' || s[1] === 'commit');
      const tc = o.tContact;
      // sign checks: takeaway (first 0.2 s), around the transition (switch -> +60 ms), through impact (contact -> +60 ms)
      const win = (t0, t1) => { let lo = 0, hi = 0; for (const s of sub) if (s[0] >= t0 && s[0] <= t1) { lo = Math.min(lo, s[4]); hi = Math.max(hi, s[4]); } return [lo, hi]; };
      const tTake = sub.length ? sub[0][0] : 0;
      const r = { flickMs: flick, peakM: pk, peakAbsM: Math.abs(pk), peakAtMsFromContact: (pkT - tc) * 1000, peakPhase: pkPh,
        takeaway: win(tTake, tTake + 0.2), transition: iDown >= 0 ? win(sub[iDown][0] - 0.03, sub[iDown][0] + 0.06) : null, impact: win(tc, tc + 0.06),
        finishAtMsFromContact: tFin != null ? (tFin - tc) * 1000 : null, bendAtFinishPlus06: after06, maxAbsAfterFinishPlus06: maxAfter06 };
      if (name === 'driver' && flick === 150) r.trace = sub.filter((s, i) => i % 4 === 0).map(s => [+((s[0] - tc) * 1000).toFixed(0), s[1], +s[4].toFixed(4)]);
      out[name + (name === 'driver' ? '_' + flick : '')] = r;
      runOn(20);
    }
    return out;
  });

  // ---------- T3c: tempo clock with a pause at the bottom ----------
  if (want('tempo')) res.tempo = await page.evaluate(() => {
    const { G, R, putAt, swing, runOn } = window.__S;
    const rows = [];
    for (const [hold, mode] of [[0, 'none'], [300, 'none'], [600, 'none'], [600, 'jitter'], [1000, 'jitter']]) for (const flick of [150, 400]) {
      putAt(0, 0.6, 0);
      const o = swing({ power: 0.9, pullMs: 450, holdMs: hold, hold: mode, flickMs: flick });
      rows.push({ holdMs: hold, holdEvents: mode, flickMs: flick, tempoMul: o.tempoMul, label: o.label });
      runOn(30);
    }
    return rows;
  });

  // ---------- T5: ball and flag scale, approach shot and 15 m putt ----------
  if (want('scale')) res.scale = await page.evaluate(() => {
    const { G, E, R, putAt, swing, runOn, frame } = window.__S;
    const h = G.hole, out = {};
    const spot = (() => { let best = null; for (const p of h.pts) { const d = Math.hypot(p.x - h.pin.x, p.z - h.pin.z); if (!best || Math.abs(d - 120) < Math.abs(best.d - 120)) best = { x: p.x, z: p.z, d }; } return best; })();
    const summarize = (fr, iSwing) => {
      let gMax = 0, aMax = 0, nG = 0;
      const flags = new Set();
      let iAim = fr.findIndex((r, i) => i > iSwing && r.mode === 'aim');
      if (iAim < 0) iAim = fr.length;
      for (let i = iSwing; i < iAim; i++) flags.add(+fr[i].flag.toFixed(6));
      for (const r of fr) {
        const ground = r.st !== 'air' || r.landed;
        if (ground && r.mode !== 'menu') { gMax = Math.max(gMax, r.ballScale); nG++; } else aMax = Math.max(aMax, r.ballScale);
      }
      const near = fr.filter(r => r.dPin < 1 && r.st !== 'holed');
      return { maxBallScaleOnGround: gMax, groundFrames: nG, maxBallScaleInAir: aMax, maxScaleWithin1mOfCup: near.length ? Math.max(...near.map(r => r.ballScale)) : null,
        flagValuesSwingToNextAim: [...flags], flagAfterNextAimEase: fr.length ? fr[fr.length - 1].flag : null };
    };
    // approach: club chosen for ~120 m
    const ci = (() => { for (let i = E.CLUBS.length - 2; i >= 0; i--) if (E.CLUBS[i].fullCarry >= spot.d * 0.96) return i; return 3; })();
    putAt(spot.x, spot.z, ci);
    G.flagScale = Math.max(1, Math.hypot(h.pin.x - G.ball.x, h.pin.z - G.ball.z) / 45); G.flagFrom = G.flagTo = G.flagScale; G.flagT = 1;
    R.frames = [];
    const n0 = 0;
    swing({ power: 0.99, pullMs: 450, flickMs: 150 });
    runOn(1400, r => r.mode === 'aim');
    runOn(45);
    let fr = R.frames; R.frames = null;
    out.approach = { club: E.CLUBS[ci].id, fromM: spot.d, ...summarize(fr, n0),
      log: fr.filter((r, i) => i % 6 === 0 || (i > 0 && fr[i - 1].st !== r.st)).map(r => [+r.t.toFixed(2), r.mode, r.st, r.landed ? 'L' : '', +r.hag.toFixed(2), +r.dPin.toFixed(1), +r.ballScale.toFixed(2), +r.flag.toFixed(3)]) };
    // 15 m putt on the green
    let pp = null;
    for (let k = 0; k < 72 && !pp; k++) { const a = k * Math.PI / 36, x = h.pin.x + Math.sin(a) * 15, z = h.pin.z + Math.cos(a) * 15; if (h.surface(x, z) === E.S.GREEN) pp = { x, z }; }
    if (pp) {
      putAt(pp.x, pp.z, E.CLUBS.length - 1);
      G.flagScale = Math.max(1, 15 / 45); G.flagFrom = G.flagTo = G.flagScale; G.flagT = 1;
      R.frames = [];
      const target = 15 / E.puttMax(15);
      swing({ power: target * 1.08, pullMs: 400, flickMs: 380, over: 0 });
      runOn(900, r => r.mode === 'aim' || r.mode === 'holed');
      runOn(45);
      fr = R.frames; R.frames = null;
      out.putt15 = { ...summarize(fr, 0), log: fr.filter((r, i) => i % 6 === 0).map(r => [+r.t.toFixed(2), r.mode, r.st, +r.dPin.toFixed(2), +r.ballScale.toFixed(2), +r.flag.toFixed(3)]) };
    } else out.putt15 = { error: 'no green spot 15 m from the pin on this hole' };
    // 3 m putt rolling up to and past (or into) the cup: real size within 1 m of it
    let p3 = null;
    for (let k = 0; k < 72 && !p3; k++) { const a = k * Math.PI / 36, x = h.pin.x + Math.sin(a) * 3, z = h.pin.z + Math.cos(a) * 3; if (h.surface(x, z) === E.S.GREEN) p3 = { x, z }; }
    if (p3) {
      putAt(p3.x, p3.z, E.CLUBS.length - 1);
      R.frames = [];
      swing({ power: 3.4 / E.puttMax(3), pullMs: 350, flickMs: 300, over: 0 });
      runOn(600, r => r.mode === 'aim' || r.mode === 'holed');
      fr = R.frames; R.frames = null;
      const near = fr.filter(r => r.dPin < 1 && r.st !== 'holed'), nearAfter03 = [];
      let tIn = null; for (const r of fr) { if (r.dPin < 1 && r.st !== 'holed') { if (tIn == null) tIn = r.t; if (r.t - tIn >= 0.3) nearAfter03.push(r.ballScale); } else tIn = null; }
      out.putt3 = { maxBallScaleOnGround: Math.max(...fr.filter(r => r.st !== 'holed').map(r => r.ballScale)), framesWithin1m: near.length,
        scaleWithin1m: near.length ? [Math.min(...near.map(r => r.ballScale)), Math.max(...near.map(r => r.ballScale))] : null,
        maxScaleAfter03sWithin1m: nearAfter03.length ? Math.max(...nearAfter03) : null, end: fr[fr.length - 1].st };
    }
    return out;
  });

  res.errors = errs;
  fs.writeFileSync(OUTF, JSON.stringify(res, null, 1));
  console.log('wrote ' + OUTF + (errs.length ? ' errors: ' + errs.join(' | ') : ''));
  await browser.close();
})();
