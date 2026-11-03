// Round 7 Task 3: the green's height shading, round 6 vs round 7, from the putting camera (Standard preset) at 402x874 (DPR 2).
// Greens: hole 1 of seed 'green-7', course 0, at tiers 1, 5 and 9; the ball 7 m from the pin on the green (the first of 72
// directions on the green), the putter out, the camera settled.
// The visible green: the scene is drawn once as the game draws it, and once with the green mesh in a flat marker colour
// (magenta where its tint weight is 1, i.e. on the green, not the fringe; the same polygon offset as the game's green);
// pixels that come out pure magenta are green surface that nothing covers (not the ball, club, flag, dots or grid).
// Over those pixels: luma (Rec. 709 on the sRGB bytes, 0-255) P5, P50, P95 and the P5-P95 spread; the same for the luma
// averaged over 8x8-pixel blocks with at least 75% green pixels (large-scale light and dark, without the grass grain); the
// tint's own share: the scene drawn again with uTintA = 0, per-pixel luma ratio tinted / untinted, P5..P95; colour: hue
// (deg) and saturation (HSV) P5/P50/P95, and the share of pixels with any channel at 255 (clipping).
// usage: node test/green7.js <page.html> <outdir>   (env TINTS=A/H,A/H...: exploration only, the tint uniforms set to each pair in
// turn instead of the game's values; no screenshots)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../tempo-golf.html')), OUT = process.argv[3] || '/tmp/green7';
fs.mkdirSync(OUT, { recursive: true });
const tag = path.basename(path.dirname(SRC)) === 'baseline_r6' ? 'r6' : 'r7';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/three.min.js', r => r.fulfill({ path: path.join(__dirname, '../three.min.js'), contentType: 'application/javascript' }));
  await require('./fontroute')(page);
  const f = path.join(OUT, 'gr7_' + tag + '.html');
  fs.writeFileSync(f, '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(SRC, 'utf8') + '</body></html>');
  await page.goto('file://' + f);
  await page.waitForFunction(() => window.__tempo && window.__tempo.G.mode === 'menu', null, { timeout: 180000 });
  const rows = [];
  const TINTS = process.env.TINTS ? process.env.TINTS.split(',').map(q => q.split('/').map(Number)) : [null];
  for (const tier of [1, 5, 9]) for (const tint of TINTS) {
    const r = await page.evaluate(([tier, tint]) => {
      const T = window.__tempo, G = T.G, E = T.E;
      T.save().seenHow = true; T.save().shots = 99; T.save().settings.cam = 'std';
      T.startRound({ kind: 'quick', seed: 'green-7', tier, course: 0 }); G.manual = true;
      for (let i = 0; i < 900 && G.mode !== 'aim'; i++) T.tick(1 / 60, false);
      const h = G.hole; let x = h.pin.x, z = h.pin.z - 7;
      for (let a = 0; a < 72; a++) { const t = a * Math.PI / 36, px = h.pin.x + Math.sin(t) * 7, pz = h.pin.z + Math.cos(t) * 7; if (h.surface(px, pz) === E.S.GREEN && h.greenQ(px, pz) < 0.9) { x = px; z = pz; break; } }
      for (const id of ['toast', 'banner']) document.getElementById(id).classList.remove('show');
      G.ball.place(h, x, z); G.ball.state = 'rest'; G.lie = h.surface(x, z); G.club = E.CLUBS.length - 1; G.aim = Math.atan2(h.pin.x - x, h.pin.z - z); G.mode = 'aim'; G.camYaw = null; G.camLock = false; G.shot = null; G.swing = null;
      T.setupClub(G.club); T.tick(1 / 60, false); T.snap(); for (let i = 0; i < 90; i++) T.tick(1 / 60, false); T.tick(1 / 60, true);
      if (tint) { T.greenTint.uTintA.value = tint[0]; T.greenTint.uTintH.value = tint[1]; }
      const rd = T.renderer, gl = rd.getContext(), cam = T.camera; let scene = T.ballMesh; while (scene.parent) scene = scene.parent;
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const read = () => { rd.render(scene, cam); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
      const gm = T.world.greenMesh, m0 = gm.material;
      const A = read();
      const tA = T.greenTint.uTintA.value; T.greenTint.uTintA.value = 0; const B = read(); T.greenTint.uTintA.value = tA;
      const mk = new THREE.ShaderMaterial({ vertexShader: 'attribute float tintW;\nvarying float vW;\nvoid main() { vW = tintW; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'varying float vW;\nvoid main() { gl_FragColor = vW > 0.999 ? vec4(1.0, 0.0, 1.0, 1.0) : vec4(0.0, 1.0, 1.0, 1.0); }' });
      mk.polygonOffset = m0.polygonOffset; mk.polygonOffsetFactor = m0.polygonOffsetFactor; mk.polygonOffsetUnits = m0.polygonOffsetUnits;
      gm.material = mk; const M = read(); gm.material = m0; mk.dispose();
      T.tick(0, true);
      const L = (a, i) => 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
      const isG = (i) => M[i] > 250 && M[i + 1] < 4 && M[i + 2] > 250;
      const lum = [], ratio = [], hue = [], sat = []; let clip = 0;
      for (let i = 0; i < W * H * 4; i += 4) {
        if (!isG(i)) continue;
        const l = L(A, i); lum.push(l); const lb = L(B, i); if (lb > 4) ratio.push(l / lb);
        const r = A[i] / 255, g = A[i + 1] / 255, b = A[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
        if (A[i] >= 255 || A[i + 1] >= 255 || A[i + 2] >= 255) clip++;
        let hh = 0; if (d > 0) { if (mx === r) hh = 60 * (((g - b) / d) % 6); else if (mx === g) hh = 60 * ((b - r) / d + 2); else hh = 60 * ((r - g) / d + 4); } if (hh < 0) hh += 360;
        hue.push(hh); sat.push(mx > 0 ? d / mx : 0);
      }
      const blk = []; const S = 8;
      for (let by = 0; by + S <= H; by += S) for (let bx = 0; bx + S <= W; bx += S) {
        let n = 0, s = 0; for (let y = by; y < by + S; y++) for (let x = bx; x < bx + S; x++) { const i = (y * W + x) * 4; if (isG(i)) { n++; s += L(A, i); } }
        if (n >= 0.75 * S * S) blk.push(s / n);
      }
      const pc = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
      const st = (a, k) => ({ p5: +pc(a, 0.05).toFixed(k), p50: +pc(a, 0.5).toFixed(k), p95: +pc(a, 0.95).toFixed(k), spread: +(pc(a, 0.95) - pc(a, 0.05)).toFixed(k) });
      let hiY = -1e9, loY = 1e9; { const g = h; for (let a = 0; a < 360; a += 5) for (let rr = 0.5; rr <= 8; rr += 0.5) { const px = g.pin.x + Math.sin(a * Math.PI / 180) * rr, pz = g.pin.z + Math.cos(a * Math.PI / 180) * rr; if (g.surface(px, pz) !== E.S.GREEN) continue; const y = g.height(px, pz); hiY = Math.max(hiY, y); loY = Math.min(loY, y); } }
      return { tier, seed: 'green-7', pinY: +h.pin.y.toFixed(3), heightRange8m: +(hiY - loY).toFixed(3), greenPx: lum.length, frac: +(lum.length / (W * H)).toFixed(3), luma: st(lum, 1), block8: Object.assign(st(blk, 1), { n: blk.length }), tintRatio: st(ratio, 3), hue: st(hue, 1), sat: st(sat, 3), clipPct: +(100 * clip / Math.max(1, lum.length)).toFixed(2), tintA: tA, tintH: T.greenTint.uTintH.value };
    }, [tier, tint]);
    rows.push(r); console.log(tag, JSON.stringify(r));
    if (tint) continue;
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${tag}_green_tier${tier}.png`), timeout: 180000 });
  }
  fs.writeFileSync(path.join(OUT, 'green7_' + tag + '.json'), JSON.stringify({ rows, errors: errs }, null, 1));
  if (errs.length) console.log('errors', errs);
  await browser.close();
})();
