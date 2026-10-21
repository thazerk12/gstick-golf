// Round 5 Task 2: the play area, at 390x844, 430x932 and 360x780, on the real game loop (simulated clock, synthetic touch).
// 1. Swing zone: its pixel range under the ball, swingLen, and where a full pull and a 112% pull end.
// 2. The play column (the ball, the aim line, the landing ring and the space between them; in flight the ball and the
//    shot's landing point) measured every frame in aim, swing and flight against every visible UI box: the HUD cards, the
//    toast, the score / hole popup, the map hint and the bottom buttons. Overlap in px (the overlapping rectangle's larger side).
// 3. Screenshots of every transient state: hole intro, aim (with the first-shots hint), mid-pull (power in the card),
//    overswing, flight with the shot toast, the rest toast, PURE, a penalty toast, BIRDIE / PAR / BOGEY, the map hint,
//    the pause screen, the hole card and the results. Also counts how many transient cards are up at once.
// usage: node test/ui5.js <page.html> <outdir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/ui5';
fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY || '';
const SIZES = (process.env.SIZES || '390x844,430x932,360x780').split(',').map(s => s.split('x').map(Number));
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = {};
  for (const [W, H] of SIZES) {
    const tag = W + 'x' + H;
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.addInitScript(() => {
      const real = performance.now.bind(performance); window.__sim = { on: false, t: 0 }; performance.now = () => (window.__sim.on ? window.__sim.t : real());
      // the game's timeouts (toast and popup lifetimes) run on the simulated clock once it is on, so a 1.4 s toast lasts 84 frames
      const rST = window.setTimeout.bind(window), rCT = window.clearTimeout.bind(window); let tid = 1e7; window.__timers = new Map();
      window.setTimeout = (fn, ms, ...a) => { if (!window.__sim.on) return rST(fn, ms, ...a); const id = ++tid; window.__timers.set(id, { due: window.__sim.t + (+ms || 0), fn, a }); return id; };
      window.clearTimeout = (id) => { if (window.__timers.has(id)) window.__timers.delete(id); else rCT(id); };
      window.__runTimers = () => { for (const [id, t] of [...window.__timers]) if (t.due <= window.__sim.t) { window.__timers.delete(id); try { t.fn(...t.a); } catch (e) { console.error(e); } } };
    });
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await require('./fontroute')(page);
    const f = path.join(OUT, 'pg_' + W + '.html');
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
    await page.goto('file://' + f);
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
    // in-page helpers
    await page.evaluate(() => {
      const T = window.__tempo, G = T.G, sim = window.__sim, v = new THREE.Vector3();
      window.__k = 0;
      window.__tick = (n, draw) => { for (let i = 0; i < n; i++) { window.__k++; sim.t = sim.base + window.__k * 1000 / 60; T.tick(1 / 60, draw && i === n - 1); window.__runTimers(); if (G.mode !== window.__lastMode) { window.__lastMode = G.mode; window.__modeK = window.__k; } window.__col && window.__col(); } };
      window.__ev = (type, x, y) => (type === 'pointerdown' ? document.getElementById('touch') : window).dispatchEvent(new PointerEvent(type, { pointerId: 9, clientX: x, clientY: y, button: 0, bubbles: true, isPrimary: true, pointerType: 'touch' }));
      const vis = (el) => { if (!el) return 0; let o = 1, e = el; while (e && e !== document.body) { const c = getComputedStyle(e); if (e.hidden || c.display === 'none' || c.visibility === 'hidden') return 0; o *= +c.opacity; e = e.parentElement; } return o; };
      // visible UI boxes; the toast and popup count from the moment they are shown (their CSS fade runs on the real clock)
      window.__ui = () => {
        const out = [], add = (el, name, force) => { if (!el) return; const o = force ? 1 : vis(el); if (o < 0.05) return; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return; out.push({ name, r: [r.left, r.top, r.right, r.bottom] }); };
        document.querySelectorAll('#hudTop .card').forEach((e, i) => add(e, 'hudcard' + i));
        for (const id of ['toast', 'banner']) { const e = document.getElementById(id); if (e.classList.contains('show') && !e.hidden) { const c = e.querySelector('.tcard'); const r = c.getBoundingClientRect(); const tr = getComputedStyle(e).transform; out.push({ name: id, r: [r.left, r.top + (tr && tr !== 'none' ? -new DOMMatrix(tr).m42 : 0), r.right, r.bottom + (tr && tr !== 'none' ? -new DOMMatrix(tr).m42 : 0)] }); } }
        add(document.getElementById('maphint'), 'maphint');
        for (const id of ['btnPause', 'clubPrev', 'clubNext', 'btnMap']) add(document.getElementById(id), id);
        add(document.querySelector('#hudBot .clubball'), 'clubball');
        return out;
      };
      const P = (x, y, z) => { v.set(x, y, z).project(T.camera); return [(v.x * 0.5 + 0.5) * innerWidth, (0.5 - v.y * 0.5) * innerHeight, v.z]; };
      // the play column: ball -> landing ring (aim / swing) or ball -> the shot's landing point (flight)
      window.__colBox = () => {
        const cam = T.camera; cam.updateMatrixWorld();
        const bm = T.ballMesh.position, b = P(bm.x, bm.y, bm.z), right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        const bq = P(bm.x + right.x * T.ballMesh.scale.x, bm.y + right.y * T.ballMesh.scale.x, bm.z + right.z * T.ballMesh.scale.x), br = Math.hypot(bq[0] - b[0], bq[1] - b[1]);
        let tx, tz, rr;
        const m = G.mode, putter = T.E.CLUBS[G.club].putter;
        if (m === 'aim' || m === 'swing' || m === 'impact') {
          if (putter || !G.preview) { tx = G.hole.pin.x; tz = G.hole.pin.z; rr = 0.3; }
          else { tx = G.preview.x; tz = G.preview.z; rr = Math.min(7, Math.max(1.5, G.preview.carry * 0.028)); }
        } else if (m === 'flight') {
          // the shot's real first touchdown: the ball copied at the first flight frame and stepped by the engine to its landing
          if (G.shot && window.__landShot !== G.shot) {
            window.__landShot = G.shot; window.__land = null;
            if (!G.shot.putt) { const c = new T.E.Ball(); for (const k in G.ball) { const v0 = G.ball[k]; if (typeof v0 !== 'function') c[k] = Array.isArray(v0) ? v0.slice() : (v0 && typeof v0 === 'object' ? Object.assign({}, v0) : v0); }
              const ev = []; let n = 0; while (c.state === 'air' && !c.landed && n < 40000) { ev.length = 0; c.step(G.hole, T.E.DT, ev); n++; }
              window.__land = { x: c.x, z: c.z, rr: Math.min(7, Math.max(1.5, Math.hypot(c.x - G.shot.sx, c.z - G.shot.sz) * 0.028)) }; }
          }
          if (window.__land && G.shot && !G.shot.landed) { tx = window.__land.x; tz = window.__land.z; rr = window.__land.rr; }
          else return { b: [b[0], b[1]], br: Math.max(br, 6), t: null, tr: 6, mode: m };
        } else return null;
        const ty = G.hole.height(tx, tz), t = P(tx, ty, tz), tq = P(tx + right.x * rr, ty + right.y * rr, tz + right.z * rr), tr = Math.hypot(tq[0] - t[0], tq[1] - t[1]);
        // a capsule: the ball (its drawn radius, at least 6 px) to the landing ring (its drawn radius); a target behind the camera
        // drops out and only the ball counts
        return { b: [b[0], b[1]], br: Math.max(br, 6), t: t[2] < 1 && t[2] > -1 ? [t[0], t[1]] : null, tr: Math.min(24, Math.max(tr, 6)), mode: m };
      };
      window.__stats = {};
      window.__colOff = () => { window.__col = null; };
      // a shot struck by takeShot from a set spot (teleport first, camera settled, then measured): club, power, path 0
      window.__shotFrom = (label, x, z, ci, power) => {
        window.__colOff(); const h = G.hole, E = T.E;
        G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = ci; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.shot = null; G.map = false; G.previewDirty = true; G.swing = null;
        T.setupClub(ci); T.snap(); window.__tick(5, false); T.snap(); window.__tick(60, false);
        window.__colOn(label); window.__tick(30, false);
        T.takeShot(power, 0, 1, 0);
        return { lie: E.SURF_NAMES[G.lie], label: G.shot && G.shot.label };
      };
      window.__colOn = (label) => {
        window.__col = () => {
          const m = G.mode; if (!(m === 'aim' || m === 'swing' || m === 'impact' || m === 'flight')) return;
          if (label === 'map' && !G.map) return;
          const c = window.__colBox(); if (!c) return;
          const S = window.__stats[label + ':' + m] || (window.__stats[label + ':' + m] = { frames: 0, maxOverlapPx: 0, worst: null, maxCards: 0 });
          S.frames++;
          if (m === 'flight') { S.ballY = S.ballY || []; if (S.frames % 6 === 0) S.ballY.push(Math.round(c.b[1])); S.minBallY = Math.min(S.minBallY == null ? 1e9 : S.minBallY, Math.round(c.b[1])); S.maxTiltDeg = Math.max(S.maxTiltDeg || 0, +((G.camTilt || 0) * 180 / Math.PI).toFixed(2)); }
          const ui = window.__ui();
          let cards = 0; for (const u of ui) if (u.name === 'toast' || u.name === 'banner' || u.name === 'maphint') cards++;
          S.maxCards = Math.max(S.maxCards, cards);
          // samples every 3 px along the capsule, inside the screen; overlap = how far a UI box reaches into the capsule (px)
          const smp = []; const n = c.t ? Math.max(1, Math.ceil(Math.hypot(c.t[0] - c.b[0], c.t[1] - c.b[1]) / 3)) : 0;
          smp.push([c.b[0], c.b[1], c.br]); for (let i = 1; i <= n; i++) { const q = i / n; smp.push([c.b[0] + (c.t[0] - c.b[0]) * q, c.b[1] + (c.t[1] - c.b[1]) * q, c.br + (c.tr - c.br) * q]); }
          for (const u of ui) for (const p of smp) {
            if (p[0] < -p[2] || p[0] > innerWidth + p[2] || p[1] < -p[2] || p[1] > innerHeight + p[2]) continue;
            const dx = Math.max(u.r[0] - p[0], 0, p[0] - u.r[2]), dy = Math.max(u.r[1] - p[1], 0, p[1] - u.r[3]), inside = dx === 0 && dy === 0;
            const pen = inside ? p[2] + Math.min(p[0] - u.r[0], u.r[2] - p[0], p[1] - u.r[1], u.r[3] - p[1]) : p[2] - Math.hypot(dx, dy);
            if (pen > 0) { S.overFrames = (S.overFrames || 0) + (S._lastK === window.__k ? 0 : 1); S._lastK = window.__k;
              if (pen > S.maxOverlapPx) { S.maxOverlapPx = +pen.toFixed(1); S.worst = { ui: u.name, uiBox: u.r.map(Math.round), ball: c.b.map(Math.round), target: c.t && c.t.map(Math.round), at: p.map(Math.round), k: window.__k, modeAge: window.__k - (window.__modeK || 0) }; } }
          }
        };
      };
    });
    // redraw once inside a real animation frame (dt 0, nothing moves) so the 2D overlay the screenshot shows is this frame's
    const shot = async (name) => { await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => { window.__tempo.tick(0, true); requestAnimationFrame(() => res()); }))); await page.waitForTimeout(350); await page.screenshot({ path: path.join(OUT, tag + '_' + name + '.png'), timeout: 180000 }); };
    const R = { size: tag };
    // ---- hole intro ----
    R.intro = await page.evaluate(() => {
      const T = window.__tempo, G = T.G; T.save().seenHow = true; T.save().shots = 0;
      T.startRound({ kind: 'quick', seed: 'ui-5', tier: 2, course: 0 }); G.manual = true; window.__sim.base = performance.now(); window.__sim.on = true;
      window.__tick(50, true);
      return { mode: G.mode, ui: window.__ui().filter(u => !u.name.startsWith('btn') && !u.name.startsWith('club')) };
    });
    await shot('intro');
    // ---- aim ----
    R.aim = await page.evaluate(() => {
      const T = window.__tempo, G = T.G;
      for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1, false);
      G.club = 0; window.__colOn('drive'); window.__tick(90, true);
      const z = T.swingZone(), L = T.swingLen();
      return { mode: G.mode, zone: { ballY: +z.ballY.toFixed(1), top: +z.top.toFixed(1), bottom: +z.bottom.toFixed(1) }, swingLen: +L.toFixed(1), fullPullEnds: +(z.top + L).toFixed(1), pull112Ends: +(z.top + 1.12 * L).toFixed(1), screenH: innerHeight, cards: window.__ui().map(u => u.name) };
    });
    await shot('aim');
    // ---- pull to 60%, then overswing (110%) ----
    R.pull = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, z = T.swingZone(), L = T.swingLen(), x = innerWidth / 2, y0 = Math.ceil(z.top) + 8;
      window.__ev('pointerdown', x, y0); window.__tick(1, false);
      for (let i = 1; i <= 16; i++) { window.__ev('pointermove', x, y0 + 0.6 * L * i / 16); window.__tick(1, false); }
      window.__tick(1, true);
      const card = document.getElementById('lieChip'), pw = document.getElementById('pwPct'), carry = document.getElementById('pwCarry');
      return { y0, mode: G.mode, power: G.swing && +G.swing.power.toFixed(3), cardPower: card.classList.contains('power'), pct: pw.textContent, carry: carry.textContent, over: pw.classList.contains('over') };
    });
    await shot('pull');
    R.overswing = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, L = T.swingLen(), x = innerWidth / 2, y0 = G.swing.y0 != null ? G.swing.y0 : null;
      const ys = G.swing.y; for (let i = 1; i <= 10; i++) { window.__ev('pointermove', x, ys + (0.5 * L) * i / 10); window.__tick(1, false); }
      window.__tick(1, true);
      const pw = document.getElementById('pwPct');
      return { mode: G.mode, power: G.swing && +G.swing.power.toFixed(3), pct: pw.textContent, over: pw.classList.contains('over'), color: getComputedStyle(pw).color };
    });
    await shot('overswing');
    // ---- flick: the shot, flight with the toast, then the rest toast ----
    R.flight = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, x = innerWidth / 2; let y = G.swing.y;
      for (let i = 1; i <= 30 && (G.mode === 'swing'); i++) { y -= 6 * i; window.__ev('pointermove', x, y); window.__tick(1, false); }
      window.__ev('pointerup', x, y);
      for (let i = 0; i < 240 && G.mode !== 'flight'; i++) window.__tick(1, false);
      window.__tick(18, true);
      const t = document.getElementById('toast');
      return { mode: G.mode, label: G.shot && G.shot.label, toast: t.classList.contains('show') ? t.textContent.trim() : null };
    });
    await shot('flight_toast');
    R.rest = await page.evaluate(() => {
      const T = window.__tempo, G = T.G;
      for (let i = 0; i < 1500 && G.mode === 'flight'; i++) window.__tick(1, false);
      window.__colOn('next'); window.__tick(20, true);
      const t = document.getElementById('toast');
      return { mode: G.mode, toast: t.classList.contains('show') ? t.textContent.trim() : null, cards: window.__ui().map(u => u.name), fanA: G.fanA, swing: !!G.swing, lieCard: document.getElementById('lieChip').className };
    });
    await shot('rest_toast');
    // ---- PURE: the next shot, struck straight (takeShot with a zero path) ----
    R.pure = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, E = T.E, h = G.hole;
      for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1, false);
      window.__tick(90, false);   // the 'next' move to the new address, measured
      const i7 = E.CLUBS.findIndex(c => c.id === '7I'), p = h.pointAtS(Math.max(40, h.len - 150));
      const r = window.__shotFrom('pure7I', p.x, p.z, i7, 1); window.__tick(10, true);
      const t = document.getElementById('toast');
      return Object.assign(r, { mode: G.mode, toast: t.classList.contains('show') ? t.textContent.trim() : null, toastLow: t.classList.contains('low') });
    });
    await shot('pure');
    R.more = await page.evaluate(() => {
      const T = window.__tempo, G = T.G, E = T.E, h = G.hole, out = {};
      const fly = () => { for (let i = 0; i < 1500 && G.mode === 'flight'; i++) window.__tick(1, false); window.__colOff(); };
      fly();
      const sw = E.CLUBS.findIndex(c => c.id === 'SW'), pw = E.CLUBS.findIndex(c => c.id === 'PW');
      let p = h.pointAtS(Math.max(30, h.len - 75)); out.wedge = window.__shotFrom('wedgeSW', p.x, p.z, sw, 1); fly();
      // a chip: 25 m short of the pin, 40% PW
      const dx = h.green.x - h.pin.x, dz = h.green.z - h.pin.z; p = h.pointAtS(Math.max(20, h.len - 25)); out.chip = window.__shotFrom('chipPW', p.x, p.z, pw, 0.4); fly();
      // an 8 m putt on the green
      let sx = h.pin.x, sz = h.pin.z; for (let a = 0; a < 6.3; a += 0.3) { const x = h.pin.x + Math.cos(a) * 8, z = h.pin.z + Math.sin(a) * 8; if (h.surface(x, z) === E.S.GREEN) { sx = x; sz = z; break; } }
      out.putt = window.__shotFrom('putt8m', sx, sz, E.CLUBS.length - 1, 0.55); fly();
      return out;
    });
    // ---- penalty toast (the game's OB toast, shown at rest as the game does) ----
    R.penalty = await page.evaluate(() => {
      const T = window.__tempo, G = T.G;
      for (let i = 0; i < 1500 && G.mode === 'flight'; i++) window.__tick(1, false);
      window.__tick(20, false);
      T.showToast('OUT OF BOUNDS', 'Penalty stroke · replay from the last spot', 1800); window.__tick(12, true);
      const t = document.getElementById('toast');
      return { mode: G.mode, toast: t.classList.contains('show') ? t.textContent.trim() : null, cards: window.__ui().map(u => u.name) };
    });
    await shot('penalty');
    // ---- map hint ----
    R.maphint = await page.evaluate(() => {
      const T = window.__tempo, G = T.G;
      for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1, false);
      window.__colOn('map'); document.getElementById('btnMap').click(); window.__tick(40, true);
      const mh = document.getElementById('maphint').getBoundingClientRect();
      return { map: G.map, cards: window.__ui().map(u => u.name), maphint: [mh.left, mh.top, mh.right, mh.bottom].map(Math.round), text: document.getElementById('maphint').textContent.trim() };
    });
    await shot('maphint');
    await page.evaluate(() => { document.getElementById('btnMap').click(); window.__tick(30, false); });
    // ---- pause ----
    R.pause = await page.evaluate(() => { document.getElementById('btnPause').click(); window.__tick(2, true); const s = document.getElementById('scrPause'); return { shown: !s.hidden, scroll: [s.scrollWidth, s.clientWidth, s.scrollHeight, s.clientHeight] }; });
    await shot('pause');
    await page.evaluate(() => { document.getElementById('pResume').click(); window.__tick(5, false); });
    // ---- BIRDIE / PAR / BOGEY: real hole-outs from 2 m (the hole-out flow shows the popup) ----
    R.popups = [];
    await page.evaluate(() => window.__colOff());
    for (const [word, d] of [['birdie', -1], ['par', 0], ['bogey', 1]]) {
      const r = await page.evaluate((d) => {
        const T = window.__tempo, G = T.G, E = T.E;
        for (let i = 0; i < 900 && G.mode !== 'aim'; i++) window.__tick(1, false);
        const h = G.hole, pin = h.pin;
        let dx = h.green.x - pin.x, dz = h.green.z - pin.z, dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        let sx, sz, aim0, v, off = null;
        const sim1 = (o) => { const b = new E.Ball(); b.place(h, sx, sz); b.putt(h, v, aim0 + o); const ev = []; let n = 0; while ((b.state === 'roll' || b.state === 'air') && n < 20000) { ev.length = 0; b.step(h, E.DT, ev); n++; } return b.state === 'holed'; };
        for (const dist of [2, 1.5, 1]) { for (let a = 0; a < 6.28 && off == null; a += 0.5) { const c = Math.cos(a), s = Math.sin(a); sx = pin.x + (dx * c - dz * s) * dist; sz = pin.z + (dx * s + dz * c) * dist; if (h.surface(sx, sz) !== E.S.GREEN) continue;
          aim0 = Math.atan2(pin.x - sx, pin.z - sz); v = E.puttSpeed(h, dist + 0.3); for (let o = 0; o <= 0.08; o += 0.0005) { if (sim1(o)) { off = o; break; } if (sim1(-o)) { off = -o; break; } } } if (off != null) break; }
        if (off == null) off = 0;
        document.getElementById('banner').classList.remove('show'); document.getElementById('toast').classList.remove('show');
        G.ball.place(h, sx, sz); G.ball.state = 'rest'; G.lie = h.surface(sx, sz); G.club = E.CLUBS.length - 1; G.aim = aim0 + off; G.mode = 'aim'; G.sinkS = null; G.map = false;
        window.__tick(30, false);
        for (let i = 0; i < 600 && document.getElementById('banner').classList.contains('show'); i++) window.__tick(1, false);   // the hole intro's banner goes first
        G.shot = { club: 'PT', putt: true, sx, sz, lie: G.lie, power: 0.5, dev: 0, landed: false, carry: 0 }; G.strokes = h.par + d;
        G.ball.putt(h, v, aim0 + off); G.mode = 'flight'; G.acc = 0; G.ip.x = G.ball.x; G.ip.y = G.ball.y; G.ip.z = G.ball.z;
        let shown = null; for (let i = 0; i < 600; i++) { window.__tick(1, false); if (document.getElementById('banner').classList.contains('show')) { shown = i; break; } }
        window.__tick(20, true);
        const b = document.getElementById('banner');
        return { mode: G.mode, shots: T.save().shots, holed: G.ball.state === 'holed', strokes: G.strokes, par: h.par, banner: b.classList.contains('show') ? b.textContent.trim() : null, framesToBanner: shown, cards: window.__ui().map(u => u.name) };
      }, d);
      R.popups.push(Object.assign({ want: word }, r));
      await shot('popup_' + word);
      // on to the next hole for the next one
      await page.evaluate(() => { const T = window.__tempo, G = T.G; for (let i = 0; i < 1200 && G.mode !== 'aim' && G.mode !== 'intro'; i++) { window.__tick(1, false); const c = document.getElementById('scrCard'); if (c && !c.hidden) { const b = c.querySelector('#cNext, .cta'); if (b) b.click(); } } for (let i = 0; i < 600 && G.mode !== 'aim'; i++) window.__tick(1, false); });
    }
    // ---- hole card and results ----
    R.card = await page.evaluate(() => { const T = window.__tempo; T.showCard(); window.__tick(1, true); const s = document.getElementById('scrCard'); return { shown: !s.hidden, scroll: [s.scrollWidth, s.clientWidth] }; });
    await shot('card');
    R.results = await page.evaluate(() => { const T = window.__tempo; T.finishRound(); window.__tick(1, true); const s = document.getElementById('scrResults'); return { shown: !s.hidden, scroll: [s.scrollWidth, s.clientWidth] }; });
    await shot('results');
    R.stats = await page.evaluate(() => window.__stats);
    R.errors = errs;
    report[tag] = R;
    console.log(tag, JSON.stringify({ more: R.more, pure: R.pure, zone: R.aim.zone, swingLen: R.aim.swingLen, fullPullEnds: R.aim.fullPullEnds, pull112Ends: R.aim.pull112Ends, pull: R.pull, overswing: R.overswing, flight: R.flight, popups: R.popups.map(p => [p.want, p.banner, p.holed]), stats: R.stats, errors: errs }));
    await page.close();
  }
  fs.writeFileSync(path.join(OUT, 'ui5.json'), JSON.stringify(report, null, 1));
  await browser.close();
})();
