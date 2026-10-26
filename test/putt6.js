// Round 6 Task 4: putting you can learn.
// 1. Pull % -> flat roll at stimp 8.5, 10.5 and 12.2: the game's own putt curve (puttRoll + E.puttSpeed), each putt run by the
//    engine on a flat green to a stop.
// 2. The same pull from 2.0 m and from 2.1 m (and 3, 6 m): launch speed and the flat roll it gives, on a real green (both
//    builds: round 5 scaled the pull by puttMax of the distance).
// 3. Stroke time: a 50% pull, then an upstroke of 0.2, 0.5 or 0.8 s through the start line (synthetic touch): tempoMul, the
//    launch speed and the flat roll.
// 4. The power card while pulling (flat roll, last putt), the club button, the long / short toast after a miss.
// usage: node test/putt6.js <page.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUTF = process.argv[3] || '/tmp/putt6.json';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real());
    const rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window); let tid = 1e7; window.__timers = new Map();
    window.setTimeout = (fn, ms, ...a) => { if (!window.__sim.on) return rST(fn, ms, ...a); const id = ++tid; window.__timers.set(id, { due: window.__sim.t + (+ms || 0), fn, a }); return id; };
    window.clearTimeout = (id) => { if (window.__timers.has(id)) window.__timers.delete(id); else rCT(id); };
    window.__runTimers = () => { for (const [id, t] of [...window.__timers]) if (t.due <= window.__sim.t) { window.__timers.delete(id); try { t.fn(...t.a); } catch (e) { console.error(e); } } };
  });
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(path.dirname(OUTF), 'p6_' + path.basename(path.dirname(SRC)) + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const res = await page.evaluate(() => {
    const T = window.__tempo, G = T.G, CV = T.CV, E = T.E, sim = window.__sim, out = { r6: !!T.puttRoll };
    T.save().seenHow = true; T.save().shots = 99;
    T.startRound({ kind: 'quick', seed: 'sim-b', tier: 4, course: 0 }); G.manual = true;
    sim.base = performance.now(); sim.on = true; let k = 0;
    const tick = (n) => { for (let i = 0; i < n; i++) { k++; sim.t = sim.base + k * 1000 / 60; T.tick(1 / 60, false); window.__runTimers(); } };
    const ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 5, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    const flatRoll = (hole, v) => { const b = new E.Ball(); b.place(hole, 0, 0); b.putt(hole, v, 0); const ev2 = []; let n = 0; while ((b.state === 'roll' || b.state === 'air') && n < 200000) { ev2.length = 0; b.step(hole, E.DT, ev2); n++; } return Math.hypot(b.x, b.z); };
    const flatHole = (stimp) => Object.assign({}, E.FLAT, { pin: { x: 0, z: 1e6, y: 0 }, greenRoll: (1.83 * 1.83) / (2 * stimp * 0.3048) / E.G, surface() { return E.S.GREEN; } });
    // 1. the curve at three green speeds
    if (out.r6) {
      out.curve = [];
      for (const p of [0.1, 0.25, 0.5, 0.75, 1, 1.12]) {
        const row = { pullPct: p * 100, target: +T.puttRoll(p).toFixed(3) };
        for (const st of [8.5, 10.5, 12.2]) { const h = flatHole(st); row['stimp' + st] = +flatRoll(h, E.puttSpeed(h, T.puttRoll(p))).toFixed(3); }
        out.curve.push(row);
      }
    }
    // a green spot d m from the pin, facing away from the cup (so the roll is not stopped by it)
    const h = G.hole, P = T.E.CLUBS.length - 1;
    const spot = (d) => { for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, x = h.pin.x + Math.sin(t) * d, z = h.pin.z + Math.cos(t) * d; if (h.surface(x, z) === E.S.GREEN && h.surface(x + Math.sin(t) * 12, z + Math.cos(t) * 12) === E.S.GREEN) return { x, z, away: t }; } return null; };
    const putAt = (x, z, aim) => {
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = P; G.strokes = 0; G.aim = aim; G.mode = 'aim'; G.swing = null; G.press = null; G.pendingShot = null; G.shot = null; G.map = false; G.look = null; G.camYaw = null;
      Object.assign(CV, { a: 0, v: 0, b: 0, phase: 'address', t: 0, alpha: 0, alphaT: 0, shot: null, hit: false, bend: 0, bendV: 0, flexInit: false }); T.setupClub(P); tick(30);
    };
    // 2. the same pull from different distances
    out.dist = [];
    const flatHere = flatHole(h.stimp);
    for (const d of [2.0, 2.1, 3, 6]) {
      const s = spot(d); if (!s) { out.dist.push({ d, error: 'no spot' }); continue; }
      putAt(s.x, s.z, s.away);
      let v = null; const bp = G.ball.putt; G.ball.putt = function (hole, sp) { v = sp; return bp.apply(this, arguments); };
      T.takeShot(0.4, 0, 1); G.ball.putt = bp;
      out.dist.push({ d, pullPct: 40, launch: +v.toFixed(4), flatRoll: +flatRoll(flatHere, v).toFixed(3), stimp: +h.stimp.toFixed(2) });
      tick(400);
    }
    // 3. stroke time, with the real gesture
    out.stroke = [];
    for (const up of [0.2, 0.5, 0.8]) {
      const s = spot(4); putAt(s.x, s.z, s.away);
      const L = T.swingLen(), Y0 = T.swingZone ? Math.max(560, Math.ceil(T.swingZone().top) + 8) : 560, D = L * 0.5;   // round 5: inside its swing zone
      ev('pointerdown', 195, Y0); for (let i = 1; i <= 20; i++) { ev('pointermove', 195, Y0 + D * i / 20); tick(1); }
      tick(4);
      const n = Math.round(up * 60); let shot = null, v = null;
      // the ball's speed as struck: read inside takeShot, right after the putt is launched
      const ts0 = T.takeShot; let v0 = null; T.takeShot = function () { const r = ts0.apply(this, arguments); return r; };
      const bp = G.ball.putt; G.ball.putt = function (hole, sp, aim) { v0 = sp; return bp.apply(this, arguments); };
      for (let i = 1; i <= n + 3; i++) { const y = Y0 + D - (D + 20) * Math.min(1, i / n); ev('pointermove', 195, y); if (!shot && G.pendingShot) shot = Object.assign({}, G.pendingShot); tick(1); if (v == null && G.mode === 'flight') v = Math.hypot(G.ball.vx, G.ball.vz); }
      ev('pointerup', 195, Y0 - 20); for (let i = 0; i < 20 && v == null; i++) { tick(1); if (G.mode === 'flight') v = Math.hypot(G.ball.vx, G.ball.vz); }
      G.ball.putt = bp; T.takeShot = ts0;
      out.stroke.push({ upstrokeS: up, power: shot && +shot.power.toFixed(4), tempoMul: shot && shot.tempoMul, label: G.shot && G.shot.label, struck: v0 && +v0.toFixed(5), flatRoll: v0 && +flatRoll(flatHere, v0).toFixed(3) });
      tick(400);
    }
    // 4. the putt HUD: power card while pulling, the club button, the long / short toast
    if (out.r6) {
      const s = spot(5); putAt(s.x, s.z, Math.atan2(h.pin.x - s.x, h.pin.z - s.z)); T.updateHUD && T.updateHUD(true); tick(2);
      out.clubButton = document.getElementById('clubCarry').textContent;
      G.lastPutt = 2.7;
      const L = T.swingLen(); ev('pointerdown', 195, 560); for (let i = 1; i <= 12; i++) { ev('pointermove', 195, 560 + L * 0.45 * i / 12); tick(1); }
      out.powerCard = { big: document.getElementById('pwPct').textContent, small: document.getElementById('pwCarry').textContent, expected: T.fmtFt(T.puttRoll(0.45)) };
      ev('pointercancel', 195, 600); G.swing = null; G.mode = 'aim'; tick(2);
      // a putt 30% short and one 30% long, straight at the cup from 5 m
      out.toasts = [];
      for (const k2 of [0.7, 1.3]) {
        putAt(s.x, s.z, Math.atan2(h.pin.x - s.x, h.pin.z - s.z));
        T.takeShot(T.puttPull(5 * k2), 0, 1);
        for (let i = 0; i < 900 && G.mode === 'flight'; i++) tick(1);
        const sh = G.shot; out.toasts.push({ want: k2 < 1 ? 'short' : 'long', mode: G.mode, toast: document.getElementById('tQ').textContent, sub: document.getElementById('tD').textContent, missM: sh && sh.miss != null ? +sh.miss.toFixed(3) : null, show: document.getElementById('toast').classList.contains('show'), lastPutt: G.lastPutt });
        tick(120);
      }
    }
    return out;
  });
  res.errors = errs;
  fs.writeFileSync(OUTF, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
