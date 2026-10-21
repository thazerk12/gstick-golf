// Green height tint check: putting camera at 390x844 (DPR 2) on tier 1, 5 and 9 greens under a low and a high sun.
// Luma is read from the 3D canvas itself (no HUD). Points are projected with the new build's camera; the same pixel
// positions are measured on the comparison build (same course, ball and camera code).
// usage: OUT=<dir> node test/greens2.js <new.html> <before.html> <out.json>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT || '/tmp';
const [SRC, SRC0, OUTF] = [process.argv[2], process.argv[3], process.argv[4] || (process.env.OUT || '/tmp') + '/greens2.json'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const open = async (src, tag) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); page.errs = []; page.on('pageerror', e => page.errs.push(e.message));
    await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
    await page.route('**/fonts.*/**', r => r.abort());
    const f = OUT + '/g2_' + tag + '.html';
    fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(src, 'utf8') + '</body></html>');
    await page.goto('file://' + f, { timeout: 240000 });
    await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 240000 });
    await page.evaluate(() => { window.__tempo.G.manual = true; });   // stop this page's own render loop while the other loads
    return page;
  };
  const pN = await open(SRC, 'new'), pB = await open(SRC0, 'before');
  // pick seeds: hole 1 with a low (< 30 deg) or high (> 42 deg) sun
  const picks = await pN.evaluate(() => {
    const E = window.__tempo.E, out = [];
    for (const tier of [1, 5, 9]) for (const sun of ['low', 'high']) {
      for (let n = 0; n < 400; n++) {
        const seed = 'g2-' + tier + '-' + n, cfg = E.makeRound(seed, tier, 0).holes[0];
        const sr = E.mulberry32(cfg.seed ^ 0x51f3); sr(); const el = 27 + sr() * 18;
        if ((sun === 'low' && el < 30) || (sun === 'high' && el > 42)) { out.push({ tier, sun, seed, el }); break; }
      }
    }
    return out;
  });
  // set up the same scene in a page; returns pin/ball info (and, in the new build, projected sample points)
  const setup = (page, p, project) => page.evaluate(([p, project]) => {
    const T = window.__tempo, G = T.G, E = T.E, S = E.S;
    T.save().seenHow = true; T.startRound({ kind: 'quick', seed: p.seed, tier: p.tier, course: 0 });
    G.manual = true; G.timer = 9; for (let i = 0; i < 5; i++) T.tick(1 / 60, false);
    const h = G.hole, n = { x: 0, y: 0, z: 0 };
    h.normal(h.pin.x, h.pin.z, n);
    let dx = n.x, dz = n.z, l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;          // downhill at the cup
    let bd = 9.5; while (bd > 4 && h.surface(h.pin.x + dx * bd, h.pin.z + dz * bd) !== S.GREEN) bd -= 0.5;
    const bx = h.pin.x + dx * bd, bz = h.pin.z + dz * bd;
    G.ball.place(h, bx, bz); G.ball.state = 'rest'; G.lie = S.GREEN; G.club = E.CLUBS.length - 1;
    G.aim = Math.atan2(h.pin.x - bx, h.pin.z - bz); G.mode = 'aim'; G.previewDirty = true;
    for (let i = 0; i < 90; i++) T.tick(1 / 60, i > 80); T.snap(); T.tick(1 / 60, true);
    const info = { slopePct: 100 * l / n.y, ballFromCup: bd, pinY: h.pin.y };
    if (project) {
      const cam = T.camera, W = T.renderer.domElement.width, H = T.renderer.domElement.height, V = cam.position.constructor;
      const px = (x, z) => { const v = new V(x, h.height(x, z), z).project(cam); return { x, z, u: Math.round((v.x * 0.5 + 0.5) * W), v: Math.round((0.5 - v.y * 0.5) * H), inView: Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1, green: h.surface(x, z) === S.GREEN, y: h.height(x, z) }; };
      // beside the cup: 0.7 m across the fall line (about cup height), both sides. 8 m up and down the fall line, sampled 0.8 m to
      // either side of the line so the window misses the flagstick (uphill, straight above the cup on screen) and the aim line (downhill).
      const side = (x, z, o) => [px(x + dz * o, z - dx * o), px(x - dz * o, z + dx * o)];
      info.pts = { beside: side(h.pin.x, h.pin.z, 0.7), up8: side(h.pin.x - dx * 8, h.pin.z - dz * 8, 0.8), down8: side(h.pin.x + dx * 8, h.pin.z + dz * 8, 0.8) };
      info.dy = { up8: h.height(h.pin.x - dx * 8, h.pin.z - dz * 8) - h.pin.y, down8: h.height(h.pin.x + dx * 8, h.pin.z + dz * 8) - h.pin.y };
      // five points on the green: luma 1.5 m downhill of each point against 1.5 m uphill of it, along that point's own fall line
      // (the direction the slope dots flow), skipping points near the cup-ball line
      info.slopePts = [];
      for (const [r, a] of [[3, 0.7], [4, -0.8], [5.5, 0.45], [6.5, -0.45], [4.5, 1.2], [3.5, -1.4], [7.5, 0.35], [2.5, 2.4], [5.5, -2.3], [6, 1.8], [6, -1.7], [8.5, -0.3], [8, 0.9], [3, 2], [3, -2.1], [2.2, 1.1], [2.2, -1.2], [7, -1.2]]) {
        if (info.slopePts.length >= 5) break;
        const ang = Math.atan2(-dx, -dz) + a, x = h.pin.x + Math.sin(ang) * r, z = h.pin.z + Math.cos(ang) * r;
        if (h.surface(x, z) !== S.GREEN) continue;
        const m = { x: 0, y: 0, z: 0 }; h.normal(x, z, m); let ex = m.x, ez = m.z; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
        const U = px(x - ex * 1.5, z - ez * 1.5), D = px(x + ex * 1.5, z + ez * 1.5);
        const lat = (q) => Math.abs((q.x - h.pin.x) * dz - (q.z - h.pin.z) * dx);
        if (!U.inView || !D.inView || !U.green || !D.green || lat({ x: x - ex * 1.5, z: z - ez * 1.5 }) < 0.7 || lat({ x: x + ex * 1.5, z: z + ez * 1.5 }) < 0.7) continue;
        info.slopePts.push({ U, D, slopePct: 100 * el / m.y, drop: U.y - D.y });
      }
    }
    return info;
  }, [p, project]);
  // render the 3D canvas and measure luma (mean over a 9x9 px window) at given pixels; also return a PNG
  const measure = (page, pts) => page.evaluate((pts) => {
    const T = window.__tempo, R = T.renderer, gl = R.getContext();
    T.tick(0, true);
    const W = R.domElement.width, H = R.domElement.height, buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const png = R.domElement.toDataURL('image/png');
    const lum = (u, v, r) => { let s = 0, n = 0; for (let y = v - r; y <= v + r; y++) for (let x = u - r; x <= u + r; x++) { if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = ((H - 1 - y) * W + x) * 4; s += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; n++; } return s / Math.max(1, n); };
    return { png, L: pts.map(p => lum(p.u, p.v, p.r == null ? 4 : p.r)) };
  }, pts);
  const res = { picks, cases: [], errors: [] };
  const setTint = (page, A, H) => page.evaluate(([A, H]) => { const t = window.__tempo.greenTint, F = window.__tempo.FEEL.green; t.uTintA.value = A == null ? F.tintA : A; t.uTintH.value = H == null ? F.tintH : H; }, [A, H]);
  const avg = (a, b) => (a + b) / 2, pct = (x, ref) => 100 * (x - ref) / ref;
  for (const p of picks) {
    const iN = await setup(pN, p, true); await setup(pB, p, false);
    const P = iN.pts, nS = iN.slopePts.length;
        const list = [...P.beside, ...P.up8, ...P.down8].concat(...iN.slopePts.map(s => [s.U, s.D]));
    const mN = await measure(pN, list), mB = await measure(pB, list);
    await setTint(pN, 0, null); const mOff = await measure(pN, list);
    const sweep = {};
    for (const H of [0.1, 0.15]) { await setTint(pN, null, H); sweep[H] = (await measure(pN, list)).L; }
    await setTint(pN, null, null);
    const tag = 't' + p.tier + '_' + p.sun;
    fs.writeFileSync(OUT + '/g2_' + tag + '_after.png', Buffer.from(mN.png.split(',')[1], 'base64'));
    fs.writeFileSync(OUT + '/g2_' + tag + '_before.png', Buffer.from(mB.png.split(',')[1], 'base64'));
    const ok = (a, b) => a.inView && b.inView && a.green && b.green;
    const fall = (L) => {
      const beside = avg(L[0], L[1]);
      return { besideLuma: +beside.toFixed(1), up8: ok(P.up8[0], P.up8[1]) ? +pct(avg(L[2], L[3]), beside).toFixed(1) : null, down8: ok(P.down8[0], P.down8[1]) ? +pct(avg(L[4], L[5]), beside).toFixed(1) : null };
    };
    const slope = (L) => iN.slopePts.map((s, i) => +pct(L[6 + 2 * i + 1], L[6 + 2 * i]).toFixed(2));
    const after = fall(mN.L), before = fall(mB.L), off = fall(mOff.L);
    const aS = slope(mN.L), oS = slope(mOff.L), bS = slope(mB.L);
    // tint field: |on - off| luma x 8 as a grey image, to show where the tint acts and that it fades out across the fringe
    const diffPng = await pN.evaluate(() => {
      const T = window.__tempo, R = T.renderer, gl = R.getContext(), W = R.domElement.width, H = R.domElement.height, t = T.greenTint;
      const grab = () => { T.tick(0, true); const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
      const on = grab(), a0 = t.uTintA.value; t.uTintA.value = 0; const off = grab(); t.uTintA.value = a0;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4, l = (k) => 0.2126 * k[i] + 0.7152 * k[i + 1] + 0.0722 * k[i + 2];
        const d = (l(on) - l(off)) * 8; im.data[o] = d > 0 ? Math.min(255, 128 + d) : 128; im.data[o + 1] = 128 - Math.min(127, Math.abs(d)) * 0.3; im.data[o + 2] = d < 0 ? Math.min(255, 128 - d) : 128; im.data[o + 3] = 255;
      }
      g.putImageData(im, 0, 0); return c.toDataURL('image/png');
    });
    fs.writeFileSync(OUT + '/g2_' + tag + '_tintfield.png', Buffer.from(diffPng.split(',')[1], 'base64'));
    const sw = {}; for (const H in sweep) sw['H' + H] = fall(sweep[H]);
    res.cases.push({ ...p, slopeAtCupPct: +iN.slopePct.toFixed(2), ballFromCup: iN.ballFromCup, dyUp8: +iN.dy.up8.toFixed(3), dyDown8: +iN.dy.down8.toFixed(3),
      after, tintOff: off, before, sweep: sw,
      downhill: iN.slopePts.map((s, i) => ({ slopePct: +s.slopePct.toFixed(2), dropM: +s.drop.toFixed(3), afterPct: aS[i], tintOnlyPct: +(aS[i] - oS[i]).toFixed(2), tintOffPct: oS[i], beforePct: bS[i] })),
      px: { beside: P.beside, up8: P.up8, down8: P.down8, slope: iN.slopePts.map(q => [q.U, q.D]) } });
  }
  res.errors = pN.errs.concat(pB.errs);
  fs.writeFileSync(OUTF, JSON.stringify(res, null, 1));
  console.log('wrote ' + OUTF);
  await browser.close();
})();
